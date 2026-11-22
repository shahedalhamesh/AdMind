"""A reel = image + video + optional voiceover + optional music,
built from ONE free-text request written by the employee."""
import json
import logging
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

import media
import memory_manager as mm
import tools
import verify
from llm import llm
from main import run_with_retry
from media_prompt import with_safety

log = logging.getLogger("admind")

_jobs: dict[str, dict] = {}  # in memory, lost on restart
_lock = threading.Lock()

# Added to every motion prompt: the video model animates the first image.
MOTION_SAFETY = (" Natural, realistic, believable motion like real footage filmed by a person. "
                 "Family-friendly and modest: any people are fully and modestly clothed in everyday clothes.")

PLAN_PROMPT = """You plan a short social media reel from an employee's request
(the request may be in Arabic or English). Return ONLY one JSON object with
exactly these keys:
- "image_prompt": ONE English paragraph (max 70 words) describing the first
  image concretely: subject, setting, composition, lighting, colors, style.
  Make it look like a natural, realistic, candid photo taken by a real
  photographer, not a stiff render: a believable lifestyle moment around the
  product, with natural details (condensation, ice, soft shadows, real textures).
  A person or a hand may appear when it fits (for example someone enjoying the
  drink), but always modestly dressed (see SAFETY). No text, letters, logos or
  watermarks in the image. No real people's names or brand names. Follow the
  client's brand tone and 'avoid' list. Do not invent product details.
- "motion_prompt": a short English phrase for how the scene moves, like real
  footage filmed by a person: natural, believable, physically sensible motion
  that matches the first image. Use only things that fit the image: a slow
  camera push-in or gentle handheld drift, ice shifting, condensation, steam,
  light shimmering, water rippling, leaves swaying, a person or a hand lifting
  or holding the product naturally. Never an impossible or absurd action (no
  pouring from a camera or other wrong objects, no objects morphing). Slow and calm.
- "voice": "female" if the request asks for a woman's/girl's voice, "male" if
  it asks for a man's voice, otherwise "none".
- "music": a short English description of the music style if the request asks
  for music (for example "calm acoustic, warm"), otherwise "none".
- "seconds": the video length in seconds if the request states one,
  otherwise 7. Between 4 and 21.
Add voice or music ONLY if the request asks for it.

SAFETY (mandatory, whatever the request says): the reel must be family-friendly
and modest, suitable for a conservative Arabic audience. NEVER describe nudity,
swimwear, bikinis, bare skin beyond hands and face, revealing or tight clothing,
suggestive poses or romantic/sensual scenes. People may appear naturally (hands,
a person drinking or sitting at a table, a family), but always fully and modestly
clothed in ordinary everyday clothes that cover shoulders, arms and legs (a
headscarf is fine), with no close-ups of bodies. For pools, beaches, gyms or spas
show people only dressed in everyday clothes, never in swimwear, and never write
that people swim, undress or pose.

Client profile:
{profile}

Request:
{request}
"""


def _parse_json(text: str) -> dict:
    m = re.search(r"\{.*\}", str(text), re.S)
    if not m:
        raise ValueError("The planner did not return JSON")
    return json.loads(m.group(0))


_VOICE_RE = re.compile(r"voice\s*-?over|voice|narrat|speak|talking|\u0635\u0648\u062a|\u062a\u0639\u0644\u064a\u0642|\u0631\u0627\u0648\u064a", re.I)
_MALE_RE = re.compile(r"\b(man|male|men|boy)\b|\bman's|\u0631\u062c\u0644|\u0634\u0627\u0628", re.I)
_MUSIC_RE = re.compile(r"music|soundtrack|\u0645\u0648\u0633\u064a\u0642", re.I)


def plan_reel(request: str, profile: object) -> dict:
    raw = llm.call(
        [{"role": "user", "content": PLAN_PROMPT.format(
            profile=profile or "(none)", request=request)}]
    )
    data = _parse_json(raw)
    voice = str(data.get("voice", "none")).strip().lower()
    music = str(data.get("music") or "").strip()
    try:
        seconds = float(data.get("seconds") or 7)
    except (TypeError, ValueError):
        seconds = 7.0
    # The planner sometimes misses an explicit request: fall back to the words of the request itself.
    if voice not in ("male", "female") and _VOICE_RE.search(request):
        voice = "male" if _MALE_RE.search(request) else "female"
    if music.lower() in ("", "none", "null") and _MUSIC_RE.search(request):
        music = "calm, warm, light background music"
    return {
        # the fixed safety wording is added even if the planner ignored the rules
        "image_prompt": with_safety(str(data.get("image_prompt") or request)),
        "motion_prompt": (str(data.get("motion_prompt") or "")[:250] + MOTION_SAFETY).strip(),
        "voice": voice if voice in ("male", "female") else "none",
        "music": "" if music.lower() in ("", "none", "null") else music[:200],
        "seconds": max(3.5, min(seconds, 21.0)),
    }


def _fallback_script(request: str, language: str, budget: int) -> str:
    """A short neutral line built only from the employee's own words (no invented facts)."""
    topic = " ".join(request.split())[:120].rstrip(".")
    if media.is_arabic(language):
        text = f"{topic}. ندعوكم لزيارتنا وتجربة الفرق بأنفسكم."
    else:
        text = f"{topic}. Come visit us and see the difference for yourself."
    return " ".join(text.split()[: max(budget, 5)])


def write_script(company_id: int, client_id: int, request: str,
                 language: str, seconds: float) -> str:
    """The Content Agent writes the spoken text, then the fact-check runs.

    This runs in a worker thread, so the company/client context that the agent
    tools need is set here (contextvars are not inherited by pool threads).
    """
    token = tools.set_context(company_id, client_id)
    try:
        ctx = mm.recall(company_id, client_id, request)
        # slow, clear speech: a short script that fits the video without being rushed
        per_second = 1.6 if media.is_arabic(language) else 2.0
        budget = max(5, int((seconds - 1.5) * per_second))
        task = (
            f"Write the spoken voiceover for a {seconds:.0f}-second video ad. "
            f"Topic: {request}\n"
            f"Rules: at most {budget} words; plain spoken sentences only (no "
            "headings, no hashtags, NO emojis or symbols, no stage directions, no quotation "
            "marks); natural for a human narrator to say aloud, in everyday "
            "wording (no rare or invented words); modest, family-friendly and "
            "respectful wording only. Use facts from the request, the client profile and "
            "the reference material. If specific details (prices, dates, names, offers) "
            "are not given, do NOT invent them and do NOT ask for them: write a short, "
            "warm, general invitation based only on the request itself. Never write a "
            "note or a question; output only the spoken text."
        )
        result = run_with_retry(
            task, ctx.feedback, language,
            client_profile=ctx.profile, knowledge=ctx.knowledge, examples=ctx.examples,
        )
        draft = str(result).strip().strip('"').strip()
        if draft.lower().startswith("note to employee"):
            # The agent asked for more details. A reel needs a script, so use a safe general line
            # that only repeats the request, never invented facts.
            draft = _fallback_script(request, language, budget)
            return draft
        output, _verification = verify.check(draft, request, ctx.profile, ctx.knowledge)
        out = str(output).strip()
        if out.lower().startswith("note to employee"):
            return _fallback_script(request, language, budget)
        return out
    finally:
        tools.reset_context(token)


# ---------------------------------------------------------------- jobs


def new_job(company_id: int) -> str:
    with _lock:
        if any(j["status"] == "running" for j in _jobs.values()):
            # One at a time: the free GPU quota is shared and small
            raise RuntimeError("A reel is already being generated, try again later")
        job_id = uuid.uuid4().hex
        _jobs[job_id] = {"status": "running", "step": "queued",
                         "company_id": company_id, "warnings": []}
    return job_id


def _set(job_id: str, **fields) -> None:
    with _lock:
        _jobs[job_id].update(fields)


def get_job(job_id: str, company_id: int) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None or job["company_id"] != company_id:
            return None
        return {k: v for k, v in job.items() if k != "company_id"}


def run_reel(job_id: str, company_id: int, client_id: int, request: str,
             language: str, aspect_ratio: str) -> None:
    warnings: list[str] = []
    try:
        _set(job_id, step="planning")
        plan = plan_reel(request, mm.get_profile(company_id, client_id))
        _set(job_id, plan=plan)
        seconds = plan["seconds"]

        _set(job_id, step="image")
        image = media.generate_image(plan["image_prompt"], aspect_ratio=aspect_ratio)

        if plan["music"] and not media.MUSIC_ENABLED:
            warnings.append("Background music is not available at the moment: the reel has no music.")

        _set(job_id, step="video_voice_music")
        with ThreadPoolExecutor(max_workers=3) as pool:
            f_video = pool.submit(
                media.generate_long_video, str(image), plan["motion_prompt"], seconds
            )
            f_music = (
                pool.submit(media.generate_music, plan["music"], seconds)
                if plan["music"] and media.MUSIC_ENABLED else None
            )
            f_script = (
                pool.submit(write_script, company_id, client_id, request,
                            language, seconds)
                if plan["voice"] != "none" else None
            )
            video = f_video.result()
            script = f_script.result() if f_script else ""
            music = None
            if f_music is not None:
                try:
                    music = f_music.result()
                except Exception as e:  # the reel still works without music
                    warnings.append(f"Music failed, reel has no music: {str(e)[:150]}")

        if script or music:
            _set(job_id, step="mixing", script=script)
            final, info = media.add_audio(
                video, script, gender=plan["voice"], language=language,
                music_path=music or "",
            )
            if info.get("warning"):
                warnings.append(info["warning"])
        else:
            final = video
        _set(job_id, status="done", step="done", script=script, file=final.name,
             url=f"/media/file/{final.name}", warnings=warnings)
    except Exception as e:
        log.exception("reel job failed")
        _set(job_id, status="failed", error=str(e)[:300], warnings=warnings)