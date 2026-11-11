import os
import threading
import time

from dotenv import load_dotenv
from crewai import LLM

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

# Preferred model from .env first, then fallbacks.
# Free-tier quota is per model, so every distinct model adds headroom.
CANDIDATES = [
    os.getenv("MODEL"),
    "gemini/gemini-flash-latest",
    "gemini/gemini-flash-lite-latest",
    "gemini/gemini-3.5-flash-lite",
]

# unique, non-empty, in order
NAMES: list[str] = []
for _name in CANDIDATES:
    if _name and _name not in NAMES:
        NAMES.append(_name)

_lock = threading.Lock()
_active = {"index": 0}

# Errors where trying another model can help (quota, overload, dead model)
_SWITCH_MARKERS = (
    "429", "503", "unavailable", "quota", "rate limit", "high demand",
    "overloaded", "resource_exhausted",
    "404", "not found", "no longer available",
)

# No startup "ping": every call uses one of the (few) free daily requests.
llm = LLM(model=NAMES[0], api_key=API_KEY, max_retries=3)
print(f"[llm] using {NAMES[0]}")


def current_model() -> str:
    return NAMES[_active["index"]]


def switch_to_next_model() -> str:
    """Point the shared `llm` object at the next model in the list.

    Every module that imports `llm` (agents, verify, reel...) switches with it.
    """
    with _lock:
        _active["index"] = (_active["index"] + 1) % len(NAMES)
        name = NAMES[_active["index"]]
        bare = name.split("/", 1)[1] if "/" in name else name
        prefix = "gemini/" if str(getattr(llm, "model", "")).startswith("gemini/") else ""
        llm.model = prefix + bare
        print(f"[llm] switched to {name}")
        return name


def _should_switch(error: Exception) -> bool:
    message = str(error).lower()
    return any(marker in message for marker in _SWITCH_MARKERS)


# Make every direct `llm.call(...)` (reel planning, verify, image prompt...)
# fall back to the next model by itself, one full pass over the list at most.
_original_call = llm.call


def _call_with_fallback(*args, **kwargs):
    last_error = None
    for _ in range(len(NAMES)):
        try:
            return _original_call(*args, **kwargs)
        except Exception as e:
            last_error = e
            if not _should_switch(e) or len(NAMES) < 2:
                raise
            switch_to_next_model()
            time.sleep(1)
    raise last_error


try:
    llm.call = _call_with_fallback
except Exception as e:  # if the class forbids it, main.run_with_retry still works
    print(f"[llm] could not enable call-level fallback: {e}")