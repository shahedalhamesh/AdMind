"""Image, video, voice and music generation through free tools.

Images/video/music: free Hugging Face Spaces (gradio_client). Voice: edge-tts.
Third-party services: never send real client data through them.
"""
import asyncio
import logging
import math
import os
import random
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv
from gradio_client import Client, handle_file

load_dotenv()

log = logging.getLogger("admind")

HF_TOKEN = os.getenv("HF_TOKEN") or None
IMAGE_SPACE = os.getenv("IMAGE_SPACE", "black-forest-labs/FLUX.1-schnell")
VIDEO_SPACE = os.getenv("VIDEO_SPACE", "kulkas2pintu/wan777")
MUSIC_SPACE = os.getenv("MUSIC_SPACE", "ACE-Step/ACE-Step")
OUT_DIR = Path(__file__).parent / "media_out"

# aspect ratio -> (width, height); all multiples of 32
SIZES = {
    "1:1": (1024, 1024),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
    "4:3": (1152, 896),
    "3:4": (896, 1152),
}
ASPECT_RATIOS = tuple(SIZES)
IMAGE_ATTEMPTS = 3  # a retry helps when the GPU worker was busy or cold
RETRY_DELAY_SEC = 4
MIN_IMAGE_BYTES = 20 * 1024  # smaller than this = not a real image

SEGMENT_SECONDS = 3.5  # the most one Wan call gives us
MAX_SEGMENTS = 6  # safety cap so one request can't burn all the GPU quota

# Speaking speed of the voiceover (edge-tts "rate"): a little slower is clearer.
VOICE_RATE_EN = os.getenv("VOICE_RATE_EN", "-8%")
VOICE_RATE_AR = os.getenv("VOICE_RATE_AR", "-6%")

VOICES = {
    ("arabic", "female"): "ar-SA-ZariyahNeural",
    ("arabic", "male"): "ar-SA-HamedNeural",
    ("english", "female"): "en-US-AriaNeural",
    ("english", "male"): "en-US-GuyNeural",
}


def _connect(space: str, long_wait: bool = True) -> Client:
    """Create a gradio client. long_wait = long timeouts (slow networks)."""
    options: list[dict] = []
    if long_wait:
        timeout = httpx.Timeout(900.0, connect=60.0)
        options += [
            {"token": HF_TOKEN, "httpx_kwargs": {"timeout": timeout}},
            {"hf_token": HF_TOKEN, "httpx_kwargs": {"timeout": timeout}},
        ]
    options += [{"token": HF_TOKEN}, {"hf_token": HF_TOKEN}]
    for kwargs in options:
        try:
            return Client(space, **kwargs)
        except TypeError:  # this gradio_client version doesn't know the argument
            continue
    raise RuntimeError("Could not create the gradio client")


def _retry(fn, attempts: int = 3, delay: float = 8.0):
    """Retry only on network errors (timeouts, resets), not on Space errors."""
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except httpx.TransportError as e:
            last = e
            log.warning(
                "network error %d/%d: %s: %s", attempt, attempts, type(e).__name__, e
            )
            if attempt < attempts:
                time.sleep(delay)
    raise RuntimeError(f"Network problem after {attempts} attempts: {last}")


def _save(src: str, default_suffix: str) -> Path:
    """Copy a file the Space returned into our own output folder."""
    OUT_DIR.mkdir(exist_ok=True)
    suffix = Path(src).suffix or default_suffix
    dest = OUT_DIR / f"{uuid.uuid4().hex}{suffix}"
    shutil.copy(src, dest)
    return dest


def generate_image(
    prompt: str, aspect_ratio: str = "1:1", steps: int = 4
) -> Path:
    """Text -> image (FLUX.1-schnell). Returns the saved file's path.

    Write the prompt in English: FLUX understands it far better than Arabic.
    """
    if aspect_ratio not in SIZES:
        raise ValueError(f"aspect_ratio must be one of {ASPECT_RATIOS}")
    width, height = SIZES[aspect_ratio]
    steps = max(1, min(int(steps), 12))

    last_error: Exception | None = None
    for attempt in range(1, IMAGE_ATTEMPTS + 1):
        try:
            client = _connect(IMAGE_SPACE)
            result, _seed = client.predict(
                prompt=prompt,
                seed=0,
                randomize_seed=True,
                width=width,
                height=height,
                num_inference_steps=steps,
                api_name="/infer",
            )
            path = result["path"] if isinstance(result, dict) else result
            size = Path(path).stat().st_size
            if size < MIN_IMAGE_BYTES:
                raise RuntimeError(
                    f"The Space returned a placeholder, not an image ({size} bytes)"
                )
            return _save(path, ".webp")
        except Exception as e:  # network, quota, Space bug: retry all of them
            last_error = e
            log.warning(
                "image attempt %d/%d failed: %s: %s",
                attempt, IMAGE_ATTEMPTS, type(e).__name__, e,
            )
            if attempt < IMAGE_ATTEMPTS:
                time.sleep(RETRY_DELAY_SEC)

    raise RuntimeError(
        f"Image generation failed after {IMAGE_ATTEMPTS} attempts: {last_error}"
    )


def generate_video(
    image_path: str, prompt: str = "", duration_seconds: float = 3.5
) -> Path:
    """Animate one image into a short video. Returns the saved file's path."""
    kwargs = {
        "input_image": handle_file(image_path),
        "last_image": None,
        "duration_seconds": duration_seconds,
        "api_name": "/generate_video",
    }
    if prompt:
        kwargs["prompt"] = prompt

    def _call():
        return _connect(VIDEO_SPACE).predict(**kwargs)

    _video, download_path, _seed = _retry(_call)
    return _save(download_path, ".mp4")


def _extract_last_frame(video_path: str, at_seconds: float) -> Path:
    """Ask the Space for one frame of a video (used to chain clips)."""

    def _call():
        client = _connect(VIDEO_SPACE)
        try:
            return client.predict(
                video_path=handle_file(video_path),
                timestamp=at_seconds,
                api_name="/extract_frame",
            )
        except Exception as e:
            if isinstance(e, httpx.TransportError):
                raise  # let _retry handle network errors
            # some versions want the {"video": file} shape
            return client.predict(
                video_path={"video": handle_file(video_path)},
                timestamp=at_seconds,
                api_name="/extract_frame",
            )

    frame = _retry(_call)
    src = frame["path"] if isinstance(frame, dict) else frame
    return _save(src, ".webp")


def _ffmpeg() -> str:
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def _concat_videos(paths: list[Path]) -> Path:
    """Join clips into one mp4 with the ffmpeg bundled in imageio-ffmpeg."""
    OUT_DIR.mkdir(exist_ok=True)
    list_file = OUT_DIR / f"{uuid.uuid4().hex}.txt"
    list_file.write_text(
        "".join(f"file '{p.resolve().as_posix()}'\n" for p in paths),
        encoding="utf-8",
    )
    out = OUT_DIR / f"{uuid.uuid4().hex}.mp4"
    cmd = [
        _ffmpeg(), "-y",
        "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", str(out),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    finally:
        list_file.unlink(missing_ok=True)
    return out


def generate_long_video(
    image_path: str, prompt: str = "", total_seconds: float = 7.0
) -> Path:
    """Longer video by chaining clips: each one starts from the last frame
    of the previous one, then all are joined. Returns the final mp4 path.
    """
    segments = max(1, min(math.ceil(total_seconds / SEGMENT_SECONDS), MAX_SEGMENTS))
    clips: list[Path] = []
    current_image = image_path
    for i in range(segments):
        log.info("video segment %d/%d", i + 1, segments)
        clip = generate_video(str(current_image), prompt, SEGMENT_SECONDS)
        clips.append(clip)
        if i < segments - 1:
            current_image = _extract_last_frame(
                str(clip), max(0.0, SEGMENT_SECONDS - 0.15)
            )
    if len(clips) == 1:
        return clips[0]
    return _concat_videos(clips)


def generate_clip(
    image_prompt: str,
    motion_prompt: str = "",
    aspect_ratio: str = "9:16",
    duration_seconds: float = 3.5,
) -> tuple[Path, Path]:
    """Text -> image -> video. Returns (image_path, video_path).

    duration_seconds above 3.5 chains several clips automatically.
    """
    image = generate_image(image_prompt, aspect_ratio=aspect_ratio)
    if duration_seconds > SEGMENT_SECONDS:
        video = generate_long_video(str(image), motion_prompt, duration_seconds)
    else:
        video = generate_video(str(image), motion_prompt, duration_seconds)
    return image, video


# ------------------------------------------------------------------ music


def generate_music(style: str, seconds: float = 10.0) -> Path:
    """Instrumental background music from ACE-Step. Returns the saved file.

    The result can be a bit longer than `seconds`; add_audio trims and fades it.
    """
    duration = int(max(5, min(math.ceil(seconds) + 2, 60)))
    prompt = f"{style}, instrumental, background music, no vocals"

    last_error: Exception | None = None
    # first try with a random seed (so no two reels share a tune), then without
    for seed in (str(random.randint(1, 2**31 - 1)), None):
        kwargs = dict(
            audio_duration=duration,
            prompt=prompt,
            lyrics="[instrumental]",
            infer_step=30,
            api_name="/__call__",
        )
        if seed is not None:
            kwargs["manual_seeds"] = seed

        def _call():
            return _connect(MUSIC_SPACE).submit(**kwargs).result(timeout=900)

        try:
            result = _retry(_call)
            audio = result[0] if isinstance(result, (list, tuple)) else result
            path = audio["path"] if isinstance(audio, dict) else audio
            return _save(path, ".mp3")
        except Exception as e:
            last_error = e
            log.warning("music attempt failed: %s: %s", type(e).__name__, e)
    raise RuntimeError(f"Music generation failed: {last_error}")


# ------------------------------------------------------------------ voice + mix


def media_duration(path: str | Path) -> float:
    """Length in seconds, read from ffmpeg's banner (no ffprobe needed)."""
    proc = subprocess.run(
        [_ffmpeg(), "-i", str(path)], capture_output=True, text=True, errors="replace"
    )
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr)
    if not m:
        raise RuntimeError("Could not read the media duration")
    h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + float(s)


def is_arabic(language: str) -> bool:
    lang = (language or "").strip().lower()
    return lang.startswith("ar") or "عرب" in lang


def default_voice(language: str, gender: str = "female") -> str:
    lang = "arabic" if is_arabic(language) else "english"
    return VOICES[(lang, "male" if gender == "male" else "female")]


_EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002300-\U000023FF"
    "\U0000FE00-\U0000FE0F\U0000200D\U00002B00-\U00002BFF]+"
)


def clean_for_speech(text: str) -> str:
    """Make a script easy for a voice to read: no emojis, hashtags, links or markdown."""
    text = re.sub(r"https?://\S+", " ", text or "")
    text = _EMOJI.sub(" ", text)
    text = re.sub(r"#\w+", " ", text)
    text = re.sub(r"[*_`~>|\[\]{}<]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if text and text[-1] not in ".!?؟…":
        text += "."
    return text


def speak(text: str, voice: str, rate: str = "+0%") -> Path:
    """Text -> speech mp3 with edge-tts (free, needs internet)."""
    import edge_tts

    text = clean_for_speech(text)
    if not text:
        raise RuntimeError("The voiceover text is empty after cleaning")
    OUT_DIR.mkdir(exist_ok=True)
    dest = OUT_DIR / f"{uuid.uuid4().hex}.mp3"

    async def _go():
        await edge_tts.Communicate(text, voice, rate=rate).save(str(dest))

    asyncio.run(_go())
    if not dest.is_file() or dest.stat().st_size < 1000:
        raise RuntimeError("The voice service returned no audio")
    return dest


def add_audio(
    video_path: str | Path,
    voice_text: str = "",
    gender: str = "female",
    language: str = "Arabic",
    music_path: str | Path = "",
    music_volume: float = 0.18,
    voice: str = "",
) -> tuple[Path, dict]:
    """Mix a spoken voiceover and/or background music into a video.

    The voiceover is never cut: when it is longer than the video, the last frame is
    held for the missing time. Music loops and fades out. The voice is cleaned
    (high-pass, light compression) and the final mix is loudness-normalised so
    it is clear on a phone. Returns (new mp4 path, info dict).
    """
    voice_text = (voice_text or "").strip()
    if not voice_text and not music_path:
        raise ValueError("Give a voiceover text, a music file, or both")
    video = Path(video_path)
    total = media_duration(video)
    info: dict = {"video_seconds": round(total, 1)}

    voice_file: Path | None = None
    try:
        extra = 0.0
        if voice_text:
            rate = VOICE_RATE_AR if is_arabic(language) else VOICE_RATE_EN
            voice_file = speak(voice_text, voice or default_voice(language, gender), rate)
            vdur = media_duration(voice_file)
            info["voice_seconds"] = round(vdur, 1)
            if vdur + 0.6 > total:
                extra = vdur + 0.6 - total  # hold the last frame instead of cutting the voice
                info["extended_seconds"] = round(extra, 1)
        final_total = total + extra

        inputs = ["-i", str(video)]
        filters: list[str] = []
        labels: list[str] = []
        idx = 1
        if voice_file is not None:
            inputs += ["-i", str(voice_file)]
            filters.append(
                f"[{idx}:a]adelay=300:all=1,highpass=f=90,"
                "acompressor=threshold=-18dB:ratio=3:attack=5:release=80,volume=1.5[voice]"
            )
            labels.append("[voice]")
            idx += 1
        if music_path:
            volume = max(0.0, min(float(music_volume), 1.0))
            if not voice_text:
                volume = max(volume, 0.6)  # music alone should be clearly audible
            fade_start = max(0.0, final_total - 1.2)
            inputs += ["-stream_loop", "-1", "-i", str(music_path)]
            filters.append(
                f"[{idx}:a]volume={volume},afade=t=in:d=0.5,"
                f"afade=t=out:st={fade_start:.2f}:d=1.2[music]"
            )
            labels.append("[music]")
            idx += 1
        if len(labels) == 2:
            filters.append(
                "[voice][music]amix=inputs=2:duration=longest:"
                "dropout_transition=0:normalize=0[mix]"
            )
            mixed = "[mix]"
        else:
            mixed = labels[0]
        filters.append(f"{mixed}loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[a]")

        if extra > 0:
            filters.append(f"[0:v]tpad=stop_mode=clone:stop_duration={extra:.2f}[v]")
            vmap = ["-map", "[v]"]
            vcodec = ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
        else:
            vmap = ["-map", "0:v:0"]
            vcodec = ["-c:v", "copy"]

        OUT_DIR.mkdir(exist_ok=True)
        out = OUT_DIR / f"{uuid.uuid4().hex}.mp4"
        cmd = [
            _ffmpeg(), "-y", *inputs,
            "-filter_complex", ";".join(filters),
            *vmap, "-map", "[a]",
            *vcodec, "-c:a", "aac", "-b:a", "192k",
            "-t", f"{final_total:.2f}", str(out),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
        if proc.returncode != 0:
            raise RuntimeError("ffmpeg failed: " + proc.stderr[-300:])
    finally:
        if voice_file is not None:
            voice_file.unlink(missing_ok=True)
    return out, info