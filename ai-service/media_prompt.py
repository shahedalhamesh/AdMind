"""Turn an employee's request (any language) into one English image prompt.

Only this prompt is sent to the third-party image Space, never the client
profile itself.
"""
import logging

from llm import llm

log = logging.getLogger("admind")

INSTRUCTIONS = """You write prompts for an AI image generator (FLUX).
Turn the request below into ONE English paragraph (max 80 words) that
describes the image concretely: main subject, setting, composition,
lighting, colors, and photographic or illustration style.
Rules:
- Follow the brand tone and the 'avoid' list of the client profile.
- Do NOT put any text, letters, words, logos, or watermarks in the image.
- No real people's names and no brand names.
- Use only what the request and the profile support; do not invent product
  details.
- Output ONLY the prompt, nothing else.

Client profile:
{profile}

Request:
{request}
"""


def to_image_prompt(request: str, profile: object = "") -> str:
    """Returns an English image prompt. Falls back to the raw request."""
    try:
        text = llm.call(
            [{"role": "user", "content": INSTRUCTIONS.format(
                profile=profile or "(none)", request=request)}]
        )
        text = str(text).strip().strip('"').strip()
        if text:
            return text[:800]
    except Exception as e:  # LLM quota / network: still try with the raw request
        log.warning("image prompt rewrite failed: %s: %s", type(e).__name__, e)
    return request