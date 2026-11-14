"""Speech to text with faster-whisper, running on this machine (free, no quota).

The first call downloads the model (about 500 MB for "small") and keeps it in memory.
Choose the size with WHISPER_MODEL in .env: tiny, base, small (default), medium.
Bigger = more accurate for Arabic dialects, but slower and heavier on the CPU.
"""
import os
import tempfile
import threading
from functools import lru_cache

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")


def _patch_av() -> None:
    """faster-whisper calls av.open(..., metadata_errors="ignore"), an option that newer
    versions of PyAV no longer accept. Drop it so both old and new PyAV work."""
    import av

    if getattr(av.open, "_admind_patched", False):
        return
    original = av.open

    def patched(*args, **kwargs):
        try:
            return original(*args, **kwargs)
        except TypeError as e:
            if "metadata_errors" not in str(e):
                raise
            kwargs.pop("metadata_errors", None)
            return original(*args, **kwargs)

    patched._admind_patched = True
    av.open = patched


_lock = threading.Lock()  # one recording at a time: transcribing uses all the CPU


@lru_cache(maxsize=1)
def _model():
    from faster_whisper import WhisperModel

    _patch_av()
    return WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")


def transcribe_bytes(data: bytes, suffix: str, language: str | None) -> dict:
    """Return {"text", "language", "duration"} for an audio file given as bytes."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data)
        path = f.name
    try:
        with _lock:
            segments, info = _model().transcribe(
                path, language=language, vad_filter=True, beam_size=5
            )
            # `segments` is a generator: the work happens while we read it
            text = "\n".join(s.text.strip() for s in segments if s.text.strip())
        return {
            "text": text,
            "language": info.language,
            "duration": round(info.duration, 1),
        }
    finally:
        os.unlink(path)