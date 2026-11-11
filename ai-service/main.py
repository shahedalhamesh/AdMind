import os
import re
import time
from crewai import Crew, Task, Process

import llm as llm_module
from agents import (
    main_agent,
    client_agent,
    content_agent,
    campaign_agent,
    analytics_agent,
)

MAX_ATTEMPTS = 8  # a model switch uses one attempt
# Requests per minute the crew may send to the model. The free Gemini tier
# allowed 5/min on gemini-2.5-flash; raise MAX_RPM in .env if your model allows
# more. 0 = no limit.
MAX_RPM = int(os.getenv("MAX_RPM", "4")) or None

_LIMIT_MARKERS = (
    "429", "503", "unavailable", "quota", "rate limit", "high demand",
    "overloaded", "resource_exhausted",
    "404", "not found", "no longer available",
)
_TRANSIENT_MARKERS = _LIMIT_MARKERS + ("timed out", "timeout")


def _is_limit_error(error: Exception) -> bool:
    """Quota / overload errors: switching to another model can fix them."""
    message = str(error).lower()
    return any(marker in message for marker in _LIMIT_MARKERS)


def _is_transient(error: Exception) -> bool:
    """True for errors that usually go away by themselves (limits, overload)."""
    message = str(error).lower()
    return any(marker in message for marker in _TRANSIENT_MARKERS)


def _wait_seconds(error: Exception, default: float) -> float:
    """Use the wait time Google asks for ('Please retry in 23.2s') if present."""
    match = re.search(r"retry in ([\d.]+)s", str(error), re.IGNORECASE)
    return float(match.group(1)) + 2 if match else default


def build_crew() -> Crew:
    task = Task(
        description=(
            "PRIORITY ORDER when sources disagree (highest first):\n"
            "1) Current request  2) Client profile and learned style rules  "
            "3) Previous feedback  4) Reference documents (for facts only)  "
            "5) Approved examples (for quality only)  6) Conversation history.\n"
            "Example: if an approved example uses a different tone than the profile "
            "or the learned rules, follow the profile and the rules.\n\n"
            "Client profile (brand rules - always follow them):\n"
            "{client_profile}\n\n"
            "Previous feedback from this client (apply it, ignore if none):\n"
            "{past_feedback}\n\n"
            "Reference material from the client's documents (use it ONLY if it is "
            "relevant to the request; never invent prices, offers, dates or facts "
            "that are not written here or in the profile; if needed information is "
            "missing, say it is not available):\n"
            "{knowledge}\n\n"
            "Approved examples of past work for this client (match their quality "
            "only, NOT their tone if it conflicts with the profile; do NOT copy them "
            "word for word, and do not reuse their facts unless the request asks for "
            "the same thing):\n"
            "{examples}\n\n"
            "Conversation so far (use it to resolve references like 'the second one'):\n"
            "{conversation_history}\n\n"
            "Current request: {request}\n\n"
            "Write the final answer in this language: {language}."
        ),
        expected_output=(
            "Only the final deliverable for the agency employee, ready to copy and "
            "publish, with no introduction, comments, or closing remarks. Natural, "
            "correct language; no literal translation. ONLY if a fact the request "
            "needs is truly missing from the provided material, output a single line "
            "starting with 'Note to employee:' saying what is missing, and nothing else."
        ),
    )

    return Crew(
        agents=[client_agent, content_agent, campaign_agent, analytics_agent],
        tasks=[task],
        process=Process.hierarchical,
        manager_agent=main_agent,
        max_rpm=MAX_RPM,
        verbose=True,
    )


def run_with_retry(
    request: str,
    past_feedback: str = "",
    language: str = "English",
    conversation_history: str = "",
    client_profile: str = "",
    knowledge: str = "",
    examples: str = "",
):
    switches_in_row = 0  # models tried since the last real wait
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            # Build a fresh crew on each attempt to avoid stale state
            crew = build_crew()
            return crew.kickoff(
                inputs={
                    "request": request,
                    "past_feedback": past_feedback or "No previous feedback.",
                    "language": language,
                    "conversation_history": conversation_history or "No previous messages.",
                    "client_profile": client_profile or "No profile available.",
                    "knowledge": knowledge or "No documents found.",
                    "examples": examples or "No approved examples yet.",
                }
            )
        except Exception as e:
            print(f"\n[retry] Attempt {attempt}/{MAX_ATTEMPTS} failed: {str(e)[:120]}")
            # A bug in our code won't fix itself: only retry limit/overload errors
            if attempt == MAX_ATTEMPTS or not _is_transient(e):
                raise

            # Quota / overload on this model: try the next one right away
            if (
                _is_limit_error(e)
                and len(llm_module.NAMES) > 1
                and switches_in_row < len(llm_module.NAMES) - 1
            ):
                try:
                    llm_module.switch_to_next_model()
                    switches_in_row += 1
                    time.sleep(2)
                    continue
                except Exception as switch_error:
                    print(f"[retry] Could not switch model: {switch_error}")

            # Every model failed (or switching isn't possible): wait, then go again
            switches_in_row = 0
            wait = _wait_seconds(e, 20 * attempt)
            print(f"[retry] Waiting {wait:.0f}s before trying again...\n")
            time.sleep(wait)


if __name__ == "__main__":
    request = "Write 3 Instagram captions for a new coffee shop launching next week."
    result = run_with_retry(request)
    print("\n===== FINAL RESULT =====\n")
    print(result)