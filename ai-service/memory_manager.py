"""Single entry point for every memory.

api.py talks only to this module. To swap a store later (SQLite -> MySQL) or
add a new memory, change it here and nothing else.
"""
import logging
from dataclasses import dataclass

import consolidate
import knowledge
import memory

log = logging.getLogger("admind")

# Merge feedback into the client's rules once this many new rejected comments exist.
CONSOLIDATE_AFTER = 3


@dataclass
class Context:
    """Everything the crew should know before it starts, as plain text."""

    profile: str = ""  # semantic: client profile + learned style rules
    knowledge: str = ""  # semantic: relevant document chunks
    examples: str = ""  # approved past answers for similar requests
    feedback: str = ""  # long-term: past feedback from this client
    history: str = ""  # short-term: this conversation


def recall(
    company_id: int,
    client_id: int,
    query: str,
    conversation_id: str | None = None,
    extra_feedback: str = "",
) -> Context:
    """Collect what every memory knows that is relevant to this request."""
    feedback = memory.get_recent_feedback(company_id, client_id)
    feedback = "\n".join(p for p in (feedback, extra_feedback) if p)

    history = ""
    if conversation_id:
        history = memory.get_conversation(conversation_id, company_id)

    docs = ""
    try:
        docs = knowledge.format_context(knowledge.search(company_id, client_id, query))
    except Exception as e:  # a failing vector store must never break the request
        log.warning("knowledge search failed: %s", e)

    examples = ""
    try:
        examples = knowledge.format_examples(
            knowledge.search_examples(company_id, client_id, query)
        )
    except Exception as e:
        log.warning("examples search failed: %s", e)

    profile = memory.get_profile(company_id, client_id)
    rules, _ = memory.get_rules(company_id, client_id)
    if rules:
        profile = (
            (profile + "\n" if profile else "")
            + "- Learned style rules (from this client's feedback):\n"
            + rules
        )

    return Context(
        profile=profile,
        knowledge=docs,
        examples=examples,
        feedback=feedback,
        history=history,
    )


def remember_exchange(
    company_id: int,
    client_id: int,
    request: str,
    output: str,
    conversation_id: str | None = None,
) -> int:
    """Save one request/answer pair. Returns the episode id."""
    if conversation_id:
        memory.add_message(conversation_id, company_id, client_id, "user", request)
        memory.add_message(conversation_id, company_id, client_id, "assistant", output)
    return memory.save_episode(company_id, client_id, request, output)


def remember_feedback(
    company_id: int, episode_id: int, status: str, feedback: str
) -> int | None:
    """Save the review. Approved answers become examples; rejected ones are forgotten.

    Returns the client_id, or None if the episode doesn't exist for this company.
    """
    if not memory.add_feedback(episode_id, company_id, status, feedback):
        return None
    ep = memory.get_episode(episode_id, company_id)
    if not ep:
        return None
    try:
        if status == "approved":
            knowledge.add_example(
                company_id, ep["client_id"], episode_id, ep["request"], ep["output"]
            )
        else:
            knowledge.remove_example(company_id, episode_id)
    except Exception as e:
        log.warning("examples update failed: %s", e)
    return ep["client_id"]


def maybe_consolidate(
    company_id: int, client_id: int, min_items: int = CONSOLIDATE_AFTER
) -> str:
    """Merge new rejected feedback into the client's rules once enough has piled up.

    Returns the client's current rules. Never raises: a failure here must not
    break anything else.
    """
    current, _ = memory.get_rules(company_id, client_id)
    try:
        pending = memory.get_unconsolidated_feedback(company_id, client_id)
        if len(pending) < min_items:
            return current
        rules = consolidate.merge_rules(current, [p["feedback"] for p in pending])
        if rules:
            memory.save_rules(company_id, client_id, rules, pending[-1]["id"])
            return rules
    except Exception as e:
        log.warning("consolidation failed: %s", e)
    return current


def remember_profile(company_id: int, client_id: int, **fields: str) -> None:
    memory.save_profile(company_id, client_id, **fields)


def remember_document(company_id: int, client_id: int, title: str, text: str) -> tuple[str, int]:
    return knowledge.add_document(company_id, client_id, title, text)


def get_profile(company_id: int, client_id: int) -> str:
    return memory.get_profile(company_id, client_id)

def list_documents(company_id: int, client_id: int) -> list[dict]:
    return knowledge.list_documents(company_id, client_id)


def forget_document(company_id: int, doc_id: str) -> int:
    return knowledge.delete_document(company_id, doc_id)