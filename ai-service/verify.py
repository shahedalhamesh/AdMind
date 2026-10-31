"""Second pair of eyes: check the final draft against the client's own material.

One extra LLM call, independent from the crew. If anything goes wrong here, the
original draft is returned untouched, so a failed check never breaks a request.
"""
import logging
import os

from llm import llm

log = logging.getLogger("admind")

PROMPT = """You are a strict fact-checker for a marketing agency.

SOURCES you may rely on (nothing else counts as true):

Client profile:
{profile}

Client documents:
{knowledge}

Employee's request and conversation:
{request}
{history}

DRAFT to check:
{draft}

Task:
1. Look ONLY at factual claims in the draft: prices, numbers, discounts, offers, \
dates, opening hours, locations, product names or ingredients, guarantees, \
contact details. Also treat as factual claims: how long an offer lasts or that \
it is limited-time, urgency ("last chance", "don't miss"), and savings \
("save money", "cheaper").
2. A claim is supported only if the SOURCES above state it (or the employee \
gave it in the request).
3. If every factual claim is supported, or the draft has no factual claims, \
output exactly this single word: OK
4. Otherwise output the full corrected draft: remove or neutralize ONLY the \
unsupported claims, and keep everything else unchanged (language, tone, \
structure, length, emojis). Never add new facts. No comments, no explanation.
"""

MIN_RATIO = 0.3  # a "correction" far shorter than the draft is probably not a draft


def check(
    draft: str,
    request: str,
    profile: str = "",
    knowledge: str = "",
    history: str = "",
) -> tuple[str, str]:
    """Returns (final_text, status). status: ok | corrected | skipped | error."""
    if os.getenv("VERIFY_OUTPUT", "1") == "0":
        return draft, "skipped"
    if not draft.strip() or draft.strip().startswith("Note to employee:"):
        return draft, "skipped"

    prompt = PROMPT.format(
        profile=profile or "(none)",
        knowledge=knowledge or "(none)",
        request=request,
        history=("Conversation so far:\n" + history) if history else "",
        draft=draft,
    )
    try:
        text = str(llm.call(prompt)).strip()
    except Exception as e:
        log.warning("verification failed: %s", e)
        return draft, "error"

    if not text or text.strip(" .!\"'`").upper() == "OK":
        return draft, "ok"
    if len(text) < MIN_RATIO * len(draft):
        log.warning("verification returned a suspiciously short text; ignored")
        return draft, "ok"
    return text, "corrected"