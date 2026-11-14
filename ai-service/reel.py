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
MOTION_SAFETY = " Calm, smooth, gentle motion. Family-friendly and modest."

PLAN_PROMPT = """You plan a short social media reel from an employee's request
(the request may be in Arabic or English). Return ONLY one JSON object with
exactly these keys:
- "image_prompt": ONE English paragraph (max 70 words) describing the first
  image concretely: subject, setting, composition, lighting, colors, style.
  No text, letters, logos or watermarks in the image. No real people's names
  or brand names. Follow the client's brand tone and 'avoid' list. Do not
  invent product details.
- "motion_prompt": a short English phrase for how the scene moves (camera and
  subject motion). Slow and calm, for example a gentle camera pan or ripples
  on water.
- "voice": "female" if the request asks for a woman's/girl's voice, "male" if
  it asks for a man's voice, otherwise "none".
- "music": a short English description of the music style if the request asks
  for music (for example "calm acoustic, warm"), otherwise "none".
- "seconds": the video length in seconds if the request states one,
  otherwise 7. Between 4 and 21.
Add voice or music ONLY if the request asks for it.

SAFETY (mandatory, whatever the request says): the reel must be family-friendly
and modest, suitable for a conservative Arabic audience. NEVER describe nudity,
swimwear, bikinis, bare skin, revealing or tight clothing, suggestive poses or
romantic/sensual scenes. For places such as pools, beaches, gyms or spas show the
calm place itself (water, architecture, loungers, plants, light, reflections). If
people are needed, keep them few, far away or seen from behind, fully clothed in
ordinary everyday clothes, with no close-ups of bodies. Never write that people
swim, undress or pose.

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
    return {
        # the fixed safety wording is added even if the planner ignored the rules
        "image_prompt": with_safety(str(data.get("image_prompt") or request)),
        "motion_prompt": (str(data.get("motion_prompt") or "")[:250] + MOTION_SAFETY).strip(),
        "voice": voice if voice in ("male", "female") else "none",
        "music": "" if music.lower() in ("", "none", "null") else music[:200],
        "seconds": max(3.5, min(seconds, 21.0)),
    }


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
            "respectful wording only; use only facts from "
            "the client profile and the reference material. Output only the spoken "
            "text."
        )
        result = run_with_retry(
            task, ctx.feedback, language,
            client_profile=ctx.profile, knowledge=ctx.knowledge, examples=ctx.examples,
        )
        draft = str(result).strip().strip('"').strip()
        if draft.lower().startswith("note to employee"):
            raise RuntimeError(draft)  # something is missing; the employee must add it
        output, _verification = verify.check(draft, request, ctx.profile, ctx.knowledge)
        return str(output).strip()
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

        _set(job_id, step="video_voice_music")
        with ThreadPoolExecutor(max_workers=3) as pool:
            f_video = pool.submit(
                media.generate_long_video, str(image), plan["motion_prompt"], seconds
            )
            f_music = (
                pool.submit(media.generate_music, plan["music"], seconds)
                if plan["music"] else None
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