"""Image and video generation through free Hugging Face Spaces (gradio_client).

Third-party Spaces: never send real client data through them.
"""
import logging
import math
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from gradio_client import Client, handle_file

load_dotenv()

log = logging.getLogger("admind")

HF_TOKEN = os.getenv("HF_TOKEN") or None
IMAGE_SPACE = os.getenv("IMAGE_SPACE", "black-forest-labs/FLUX.1-schnell")
VIDEO_SPACE = os.getenv("VIDEO_SPACE", "kulkas2pintu/wan777")
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


def _connect(space: str) -> Client:
    try:
        return Client(space, token=HF_TOKEN)
    except TypeError:  # older gradio_client versions
        return Client(space, hf_token=HF_TOKEN)


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
    client = Client(VIDEO_SPACE, token=HF_TOKEN)
    kwargs = {
        "input_image": handle_file(image_path),
        "last_image": None,
        "duration_seconds": duration_seconds,
        "api_name": "/generate_video",
    }
    if prompt:
        kwargs["prompt"] = prompt
    _video, download_path, _seed = client.predict(**kwargs)
    return _save(download_path, ".mp4")


def _extract_last_frame(video_path: str, at_seconds: float) -> Path:
    """Ask the Space for one frame of a video (used to chain clips)."""
    client = Client(VIDEO_SPACE, token=HF_TOKEN)
    try:
        frame = client.predict(
            video_path=handle_file(video_path),
            timestamp=at_seconds,
            api_name="/extract_frame",
        )
    except Exception:  # some versions want the {"video": file} shape
        frame = client.predict(
            video_path={"video": handle_file(video_path)},
            timestamp=at_seconds,
            api_name="/extract_frame",
        )
    src = frame["path"] if isinstance(frame, dict) else frame
    return _save(src, ".webp")


def _concat_videos(paths: list[Path]) -> Path:
    """Join clips into one mp4 with the ffmpeg bundled in imageio-ffmpeg."""
    import imageio_ffmpeg

    OUT_DIR.mkdir(exist_ok=True)
    list_file = OUT_DIR / f"{uuid.uuid4().hex}.txt"
    list_file.write_text(
        "".join(f"file '{p.resolve().as_posix()}'\n" for p in paths),
        encoding="utf-8",
    )
    out = OUT_DIR / f"{uuid.uuid4().hex}.mp4"
    cmd = [
        imageio_ffmpeg.get_ffmpeg_exe(), "-y",
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