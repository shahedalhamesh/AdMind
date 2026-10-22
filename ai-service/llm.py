import os
from dotenv import load_dotenv
from crewai import LLM

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

# Preferred model from .env first, then fallbacks
CANDIDATES = [
    os.getenv("MODEL"),
    "gemini/gemini-flash-latest",
    "gemini/gemini-flash-lite-latest",
    "gemini/gemini-2.5-flash",
    "gemini/gemini-2.5-flash-lite",
]


def get_llm() -> LLM:
    tried = set()
    for name in CANDIDATES:
        if not name or name in tried:
            continue
        tried.add(name)
        try:
            candidate = LLM(model=name, api_key=API_KEY, max_retries=3)
            candidate.call("ping")  # quick health check
            print(f"[llm] using {name}")
            return candidate
        except Exception as e:
            print(f"[llm] {name} unavailable: {str(e)[:60]}")
    raise RuntimeError("No Gemini model is available right now.")


llm = get_llm()