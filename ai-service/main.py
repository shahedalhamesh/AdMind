import time
from crewai import Crew, Task, Process

from agents import (
    main_agent,
    client_agent,
    content_agent,
    campaign_agent,
    analytics_agent,
)

MAX_ATTEMPTS = 5


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
            if attempt == MAX_ATTEMPTS:
                raise
            wait = 20 * attempt  # 20s, 40s, 60s, 80s
            print(f"[retry] Waiting {wait}s before trying again...\n")
            time.sleep(wait)


if __name__ == "__main__":
    request = "Write 3 Instagram captions for a new coffee shop launching next week."
    result = run_with_retry(request)
    print("\n===== FINAL RESULT =====\n")
    print(result)