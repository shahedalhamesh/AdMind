"""Turn a raw client brief (email, meeting notes) into profile fields.

One LLM call. It only PROPOSES values: the employee reviews them and saves
them with PUT /profile.
"""
import json

from llm import llm

FIELDS = ("client_name", "industry", "brand_tone", "audience", "platforms", "avoid")
MAX_FIELD_CHARS = 500

PROMPT = """You read a raw brief about ONE client of a marketing agency and fill in \
the client's profile.

Brief:
{text}

Return ONLY a JSON object with exactly these keys, all with string values:
- client_name: the brand's name
- industry: what the business does, in a few words
- brand_tone: how the brand talks (tone, dialect or language register, whether it \
mixes in English words, sentence length)
- audience: who the customers are (age, interests, location if stated)
- platforms: the social platforms the brand uses, separated by commas
- avoid: what the brand never wants in its content (words, topics, styles)

Rules:
- Use ONLY information that is stated in the brief. Never guess. If something is \
not stated, use an empty string.
- Write each value in the same language as the brief, short and plain (one line, \
no lists).
- Output the JSON object only: no explanation, no code fences.
"""


def extract_profile(text: str) -> dict[str, str]:
    """Returns the six profile fields. Raises ValueError if the answer is unreadable."""
    raw = str(llm.call(PROMPT.format(text=text))).strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in the model answer")
    data = json.loads(raw[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("the model answer is not a JSON object")
    return {k: str(data.get(k) or "").strip()[:MAX_FIELD_CHARS] for k in FIELDS}