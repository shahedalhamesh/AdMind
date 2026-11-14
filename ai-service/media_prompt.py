"""Turn an employee's request (any language) into one English image prompt.

Only this prompt is sent to the third-party image Space, never the client
profile itself.

Safety: every prompt is family-friendly and modest. The rules are written into the
rewrite instructions AND a fixed suffix is added to the final prompt (also when the
rewrite fails), so the generator never receives a prompt without them.
NEGATIVE_PROMPT is for generators that accept one; media.py and reel.py use it.
"""
import logging

from llm import llm

log = logging.getLogger("admind")

# Added to EVERY prompt, whatever the request says.
SAFETY_SUFFIX = (
    " Family-friendly, modest and respectful. If any people appear, they are "
    "fully clothed in ordinary everyday clothes, shown from a distance or "
    "from behind, never in swimwear or revealing clothing; no close-ups of "
    "bodies. Focus on the place, the product and the atmosphere."
)

NEGATIVE_PROMPT = (
    "nsfw, nudity, naked, topless, bikini, swimsuit, swimwear, underwear, lingerie, "
    "revealing clothes, cleavage, bare skin, sexy, sensual, suggestive, erotic, "
    "seductive pose, kissing, romantic intimacy, fetish, gore, violence, blood, "
    "text, watermark, logo"
)

INSTRUCTIONS = """You write prompts for an AI image generator (FLUX).
Turn the request below into ONE English paragraph (max 70 words) that
describes the image concretely: main subject, setting, composition,
lighting, colors, and photographic or illustration style.
Rules:
- Follow the brand tone and the 'avoid' list of the client profile.
- The result must be family-friendly and modest, suitable for a conservative
  Arabic audience. NEVER describe nudity, swimwear, bikinis, bare skin,
  revealing or tight clothing, suggestive poses, or romantic/sensual scenes.
- For places such as pools, beaches, gyms or spas: show the empty or calm place
  (water, architecture, loungers, plants, light, reflections). If people are
  needed, keep them few, far away or seen from behind, fully clothed in
  ordinary everyday clothes. No close-ups of bodies.
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


def with_safety(prompt: str) -> str:
    """Add the fixed safety suffix (kept within a sensible length)."""
    return prompt.strip()[:700] + SAFETY_SUFFIX


def to_image_prompt(request: str, profile: object = "") -> str:
    """Returns a safe English image prompt. Falls back to the raw request (still with the safety suffix)."""
    try:
        text = llm.call(
            [{"role": "user", "content": INSTRUCTIONS.format(
                profile=profile or "(none)", request=request)}]
        )
        text = str(text).strip().strip('"').strip()
        if text:
            return with_safety(text)
    except Exception as e:  # LLM quota / network: still try with the raw request
        log.warning("image prompt rewrite failed: %s: %s", type(e).__name__, e)
    return with_safety(request)