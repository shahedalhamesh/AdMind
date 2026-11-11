"""Tools the agents can call.

company_id / client_id are NEVER tool arguments: they come from the request
context that api.py sets, so the LLM can't read another company's data.
"""
import json
import re
from contextvars import ContextVar

from crewai.tools import tool

import memory_manager as mm

_ctx: ContextVar = ContextVar("admind_ctx", default=None)


def set_context(company_id: int, client_id: int):
    """Called by api.py before a run. Returns a token for reset_context."""
    return _ctx.set((company_id, client_id))


def reset_context(token) -> None:
    _ctx.reset(token)


def _ids() -> tuple[int, int]:
    ids = _ctx.get()
    if ids is None:
        raise RuntimeError("No request context: company and client are unknown")
    return ids


# profile text lines look like "- Never use / avoid: formal language"
_LABELS = {
    "client name": "client_name",
    "industry": "industry",
    "brand tone": "brand_tone",
    "target audience": "audience",
    "platforms": "platforms",
    "never use / avoid": "avoid",
}


def _parse_profile_text(text: str) -> dict:
    out: dict = {}
    for line in str(text).splitlines():
        line = line.strip().lstrip("-").strip()
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        key = _LABELS.get(label.strip().lower())
        if key:
            out[key] = value.strip()
    return out


def _profile() -> dict:
    """The client's profile as a dict, whether memory returns a dict or text."""
    company_id, client_id = _ids()
    p = mm.get_profile(company_id, client_id)
    if isinstance(p, dict):
        return p
    return _parse_profile_text(p or "")


def _terms(text: str) -> list[str]:
    """Split a comma/newline separated profile field into clean terms."""
    return [t.strip() for t in re.split(r"[,\n;،؛]+", str(text or "")) if t.strip()]


# ------------------------------------------------------------ client / content


@tool("get_client_profile")
def get_client_profile() -> str:
    """Return the saved profile of the current client: name, industry, brand
    tone, audience, platforms and the 'avoid' list."""
    try:
        profile = _profile()
    except Exception as e:
        return f"Tool error: {e}"
    return json.dumps(profile, ensure_ascii=False) if profile else "No profile saved."


@tool("search_client_knowledge")
def search_client_knowledge(query: str) -> str:
    """Search the current client's own documents (brand guide, price list,
    offers, notes) for facts. Input: a short question or keywords. Returns the
    matching passages, or says nothing relevant was found."""
    try:
        company_id, client_id = _ids()
        ctx = mm.recall(company_id, client_id, query)
    except Exception as e:
        return f"Tool error: {e}"
    found = str(ctx.knowledge).strip() if ctx.knowledge else ""
    return found or "No relevant material found in the client's documents."


@tool("search_approved_examples")
def search_approved_examples(query: str) -> str:
    """Find past content of this client that the client APPROVED and that is
    similar to the query. Input: a short description of the content."""
    try:
        company_id, client_id = _ids()
        ctx = mm.recall(company_id, client_id, query)
    except Exception as e:
        return f"Tool error: {e}"
    found = str(ctx.examples).strip() if ctx.examples else ""
    return found or "No approved examples yet."


@tool("check_avoid_list")
def check_avoid_list(text: str) -> str:
    """Check a draft text against the client's 'avoid' list. Input: the full
    draft text. Returns the forbidden words found in it, or confirms none were
    found. It only catches the exact words written in the list."""
    try:
        avoid = _terms(_profile().get("avoid", ""))
    except Exception as e:
        return f"Tool error: {e}"
    if not avoid:
        return "The client has no 'avoid' list saved."
    low = str(text).lower()
    hits = [t for t in avoid if t.lower() in low]
    if hits:
        return "FOUND forbidden terms: " + ", ".join(hits) + ". Rewrite without them."
    return (
        "No exact 'avoid' words found. The list is: " + ", ".join(avoid)
        + ". Check by yourself that the style also respects it."
    )


# ------------------------------------------------------------------- campaign


@tool("check_calendar")
def check_calendar(items: str) -> str:
    """Check a content calendar against the rules: at most one item per
    platform per day, and only the client's platforms. Input: a JSON list like
    [{"day": 1, "platform": "Instagram"}, {"day": 2, "platform": "Facebook"}].
    Returns the problems found, or OK."""
    try:
        rows = json.loads(items)
        profile = _profile()
    except Exception as e:
        return f"Tool error: {e}"
    problems: list[str] = []
    counts: dict[tuple[str, str], int] = {}
    for r in rows:
        key = (str(r.get("day")), str(r.get("platform", "")).strip().lower())
        counts[key] = counts.get(key, 0) + 1
    for (day, platform), n in counts.items():
        if n > 1:
            problems.append(f"Day {day}: {n} items on {platform} (max 1)")
    allowed = [t.lower() for t in _terms(profile.get("platforms", ""))]
    if allowed:
        for (day, platform) in counts:
            if platform and not any(a in platform or platform in a for a in allowed):
                problems.append(
                    f"Day {day}: '{platform}' is not one of the client's platforms"
                )
    return "OK: the calendar follows the rules." if not problems else "\n".join(problems)


# ------------------------------------------------------------------ analytics


@tool("calculate_rates")
def calculate_rates(data: str, base: str = "reach") -> str:
    """Compute rates for every item so they can be compared fairly. Input
    `data`: a JSON list with one object per item, using ONLY numbers the
    employee gave, e.g. [{"name": "Post A", "reach": 4000, "engagement": 120,
    "visits": 30}]. Each numeric field except `base` is divided by `base`
    (default "reach") and shown as a percentage. Also says which item is best
    and weakest per rate, and when rates are too close to call."""
    try:
        items = json.loads(data)
        rows = []
        for i, it in enumerate(items, 1):
            name = str(it.get("name", f"item {i}"))
            b = float(it.get(base, 0) or 0)
            rates: dict[str, tuple[float, float | None]] = {}
            for k, v in it.items():
                if k in ("name", base):
                    continue
                try:
                    val = float(v)
                except (TypeError, ValueError):
                    continue
                rates[k] = (val, round(val / b * 100, 2) if b else None)
            rows.append((name, b, rates))
    except Exception as e:
        return f"Tool error: {e}"

    lines = []
    for name, b, rates in rows:
        parts = [
            f"{k} = {val:g} / {b:g} = {r}%" if r is not None else f"{k}: {base} is 0"
            for k, (val, r) in rates.items()
        ]
        lines.append(f"{name}: " + "; ".join(parts))

    metrics = sorted({k for _, _, rates in rows for k in rates})
    for k in metrics:
        scored = [(n, rates[k][1]) for n, _, rates in rows
                  if k in rates and rates[k][1] is not None]
        if len(scored) < 2:
            continue
        hi = max(scored, key=lambda x: x[1])
        lo = min(scored, key=lambda x: x[1])
        if lo[1] > 0 and (hi[1] - lo[1]) < 0.10 * lo[1]:
            lines.append(f"[{k}] rates are SIMILAR (within 10%): no clear best or weakest.")
        else:
            lines.append(f"[{k}] best: {hi[0]} ({hi[1]}%); weakest: {lo[0]} ({lo[1]}%).")
    return "\n".join(lines)


@tool("percent_change")
def percent_change(old: float, new: float) -> str:
    """Percentage change between two numbers the employee gave (for example
    last week vs this week). Input: the old value and the new value."""
    if not old:
        return "Cannot compute: the old value is 0."
    return f"{(new - old) / old * 100:+.1f}% ({old:g} -> {new:g})"


# ---------------------------------------------------------------- tool lists
# Profile, documents and examples are already injected into every task, so
# agents only get tools that compute or check something (each tool call costs
# an extra LLM request, and the free Gemini tier allows ~5 per minute).

client_tools = [search_client_knowledge]
content_tools = [check_avoid_list]
campaign_tools = [check_calendar]
analytics_tools = [calculate_rates, percent_change]