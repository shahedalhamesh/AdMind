"""Live progress of one agent run, for the agency employee who is waiting.

CrewAI announces what it does (an agent starts, a tool is used, an agent gives its final answer).
We listen to those announcements and keep them in memory, per run, so the backend can ask
GET /run/{run_id}/events while the run is still working.

- A run is identified by the pair (company_id, run_id): the run_id is the agent_runs id of the backend.
- Kept in memory only (last 100 runs); the backend saves the events in agent_run_steps when the run ends.
- Events reach the run that started most recently. The crew runs one request at a time in practice
  (the model quota is small), so this is exact for normal use.
- Nothing here can break a run: every handler swallows its own errors.
"""

import importlib
import threading
from collections import OrderedDict
from datetime import datetime, timezone

MAX_RUNS = 100
MAX_EVENTS = 300
STALE_SECONDS = 30 * 60  # a run that never ended stops receiving events after this

_lock = threading.Lock()
_runs: "OrderedDict[str, dict]" = OrderedDict()
_active: list[str] = []
_installed = False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _key(company_id: int, run_id: str | int) -> str:
    return f"{company_id}:{run_id}"


def begin(company_id: int, run_id: str | int | None) -> str | None:
    """Start recording for a run. Returns a key to pass to add() and end(), or None if no run_id."""
    if not run_id:
        return None
    key = _key(company_id, run_id)
    with _lock:
        _prune()
        _runs[key] = {
            "company_id": company_id,
            "status": "running",
            "current_agent": None,
            "events": [],
            "started": _now(),
        }
        _runs.move_to_end(key)
        while len(_runs) > MAX_RUNS:
            _runs.popitem(last=False)
        if key in _active:
            _active.remove(key)
        _active.append(key)
    return key


def end(key: str | None, status: str = "done") -> None:
    if not key:
        return
    with _lock:
        if key in _runs:
            _runs[key]["status"] = status
            _runs[key]["current_agent"] = None
        if key in _active:
            _active.remove(key)


def add(kind: str, label: str, agent: str | None = None, detail: str = "", key: str | None = None) -> None:
    """Add one event to the given run (default: the run that started last)."""
    with _lock:
        key = key or (_active[-1] if _active else None)
        run = _runs.get(key) if key else None
        if run is None or len(run["events"]) >= MAX_EVENTS:
            return
        if kind == "agent_started" and agent:
            run["current_agent"] = agent
        run["events"].append({
            "n": len(run["events"]) + 1,
            "time": _now().isoformat(),
            "type": kind,
            "label": label,
            "agent": agent,
            "detail": (detail or "")[:300],
        })


def get(company_id: int, run_id: str | int, since: int = 0) -> dict | None:
    """Events with n > since, or None if this run is unknown (never started here, or the service restarted)."""
    with _lock:
        run = _runs.get(_key(company_id, run_id))
        if run is None:
            return None
        return {
            "status": run["status"],
            "current_agent": run["current_agent"],
            "events": [e for e in run["events"] if e["n"] > since],
        }


def _prune() -> None:
    """Forget runs that never ended (the service was busy or crashed) so they stop receiving events."""
    now = _now()
    for key in list(_active):
        run = _runs.get(key)
        if run is None or (now - run["started"]).total_seconds() > STALE_SECONDS:
            _active.remove(key)


# ---------------------------------------------------------------- CrewAI listeners


def _agent_name(event) -> str | None:
    name = getattr(event, "agent_role", None)
    if not name:
        name = getattr(getattr(event, "agent", None), "role", None)
    return str(name).strip() if name else None


def _short(value, size: int = 200) -> str:
    text = value if isinstance(value, str) else repr(value)
    text = " ".join(text.split())
    return text[:size]


def install() -> bool:
    """Register the CrewAI listeners once. Returns False if this CrewAI version has no event bus."""
    global _installed
    if _installed:
        return True

    module = None
    for name in ("crewai.events", "crewai.utilities.events"):
        try:
            module = importlib.import_module(name)
            break
        except ImportError:
            continue
    bus = getattr(module, "crewai_event_bus", None)
    if bus is None:
        print("[run_events] CrewAI event bus not found: live progress is off")
        return False

    def listen(class_name: str, kind: str, label: str, detail):
        cls = getattr(module, class_name, None)
        if cls is None:
            return

        def handler(source, event):
            try:
                add(kind, label, _agent_name(event), detail(event))
            except Exception as e:  # never break the run
                print(f"[run_events] ignored: {e}")

        bus.on(cls)(handler)

    tool = lambda e: _short(getattr(e, "tool_name", "") or "")
    listen("AgentExecutionStartedEvent", "agent_started", "Agent Started", lambda e: "")
    listen("ToolUsageStartedEvent", "tool_started", "Tool Execution Started", tool)
    listen("ToolUsageFinishedEvent", "tool_finished", "Tool Execution Completed", tool)
    listen("ToolUsageErrorEvent", "tool_error", "Tool Execution Failed",
           lambda e: _short(getattr(e, "tool_name", "") or "") + " " + _short(getattr(e, "error", "") or "", 100))
    listen("AgentExecutionCompletedEvent", "agent_final_answer", "Agent Final Answer",
           lambda e: _short(getattr(e, "output", "") or ""))

    _installed = True
    return True
