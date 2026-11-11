"""Turn raw feedback into short, stable style rules for one client."""
from llm import llm

MAX_RULES_CHARS = 1200

PROMPT = """You maintain the writing rules for ONE client of a marketing agency.

Current rules:
{current}

New feedback from the agency employee about drafts that were rejected:
{feedback}

Update the rules:
- Merge the new feedback into the current rules.
- Remove duplicates. If two rules contradict each other, the newer feedback wins.
- Keep only rules about style, tone, length, format, dialect, or what to avoid. \
Ignore one-off comments about the facts of a single post.
- Each rule must be short and actionable. At most 8 rules.
- Write the rules in the same language as the feedback.
- Output ONLY the rules, one per line, each starting with "- ". No introduction.
"""


def merge_rules(current: str, feedback: list[str]) -> str:
    prompt = PROMPT.format(
        current=current or "(none yet)",
        feedback="\n".join(f"- {f}" for f in feedback),
    )
    text = str(llm.call(prompt)).strip()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip().startswith("- ")]
    return "\n".join(lines)[:MAX_RULES_CHARS]