import os
import secrets
import threading
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Security,
    UploadFile,
)
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from extract import extract_text
import media
import memory_manager as mm
import verify
from main import run_with_retry
from media_prompt import to_image_prompt
from profile_extract import extract_profile

load_dotenv()
API_KEY = os.getenv("AI_SERVICE_KEY", "")
# Debug endpoints (/recall, /consolidate) exist only when this is set to "1"
DEBUG_ENDPOINTS = os.getenv("DEBUG_ENDPOINTS", "0") == "1"
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_key(key: str | None = Security(api_key_header)) -> None:
    """Reject any request without the right key. Fails closed if none is configured."""
    if not API_KEY:
        raise HTTPException(
            status_code=503, detail="AI_SERVICE_KEY is not configured on the server"
        )
    if not key or not secrets.compare_digest(key.encode(), API_KEY.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


app = FastAPI(title="AdMind AI Service")
protected = APIRouter(dependencies=[Depends(require_key)])


class RunRequest(BaseModel):
    company_id: int
    client_id: int
    request: str
    language: str = "English"
    past_feedback: str = ""  # optional extra notes, added to what memory returns


class ChatRequest(BaseModel):
    company_id: int
    client_id: int
    message: str
    conversation_id: str | None = None  # empty = start a new conversation
    language: str = "English"


class FeedbackRequest(BaseModel):
    company_id: int
    episode_id: int
    status: Literal["approved", "rejected"]
    feedback: str = ""


class ProfileRequest(BaseModel):
    company_id: int
    client_id: int
    client_name: str = ""
    industry: str = ""
    brand_tone: str = ""
    audience: str = ""
    platforms: str = ""
    avoid: str = ""


class ExtractProfileRequest(BaseModel):
    text: str = Field(min_length=10, max_length=20000)  # raw brief, email, notes


class KnowledgeRequest(BaseModel):
    company_id: int
    client_id: int
    title: str
    text: str


class ConsolidateRequest(BaseModel):
    company_id: int
    client_id: int


class ImageRequest(BaseModel):
    company_id: int
    client_id: int
    request: str = Field(min_length=3, max_length=2000)  # any language
    aspect_ratio: Literal["1:1", "16:9", "9:16", "4:3", "3:4"] = "1:1"
    raw_prompt: bool = False  # True = send `request` as is (must be English)


class VideoRequest(BaseModel):
    company_id: int
    client_id: int
    image_file: str  # a file name returned by POST /media/image
    motion_prompt: str = Field(default="", max_length=500)
    total_seconds: float = Field(default=3.5, gt=0, le=21)


# ---------------------------------------------------------------- open routes


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok"}


# ------------------------------------------------------------ protected routes


@protected.put("/profile")
def save_profile(body: ProfileRequest):
    """Create or fully replace a client's profile."""
    fields = body.model_dump(exclude={"company_id", "client_id"})
    mm.remember_profile(body.company_id, body.client_id, **fields)
    return {"saved": True}


@protected.get("/profile")
def get_profile(company_id: int, client_id: int):
    return {"profile": mm.get_profile(company_id, client_id)}


@protected.post("/profile/extract")
def extract_profile_fields(body: ExtractProfileRequest):
    """Read a raw client brief and PROPOSE profile fields. Nothing is saved:
    the employee reviews the fields, then saves them with PUT /profile."""
    try:
        fields = extract_profile(body.text)
    except ValueError:
        raise HTTPException(
            status_code=502, detail="Could not read the model's answer, try again"
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])
    return {"profile": fields, "saved": False}


@protected.post("/knowledge")
def add_knowledge(body: KnowledgeRequest):
    """Store a client document in the vector database."""
    doc_id, chunks = mm.remember_document(
        body.company_id, body.client_id, body.title, body.text
    )
    if chunks == 0:
        raise HTTPException(status_code=422, detail="Document text is empty")
    return {"doc_id": doc_id, "chunks": chunks}


@protected.get("/knowledge")
def list_knowledge(company_id: int, client_id: int):
    """List the documents stored for a client."""
    return {"documents": mm.list_documents(company_id, client_id)}


@protected.delete("/knowledge/{doc_id}")
def delete_knowledge(doc_id: str, company_id: int):
    """Delete a document (all its chunks)."""
    deleted = mm.forget_document(company_id, doc_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted_chunks": deleted}


MAX_UPLOAD = 10 * 1024 * 1024  # 10 MB


@protected.post("/knowledge/upload")
def upload_knowledge(
    company_id: int = Form(...),
    client_id: int = Form(...),
    title: str = Form(""),
    file: UploadFile = File(...),
):
    """Upload a PDF / DOCX / TXT / MD file for a client."""
    data = file.file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    try:
        text = extract_text(file.filename or "", data)
    except ValueError as e:
        raise HTTPException(status_code=415, detail=str(e))
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read this file")
    if not text:
        raise HTTPException(
            status_code=422,
            detail="No text found in the file (scanned PDFs need OCR)",
        )
    doc_id, chunks = mm.remember_document(
        company_id, client_id, title or file.filename or "Untitled", text
    )
    warning = None
    if (file.filename or "").lower().endswith(".pdf"):
        warning = (
            "PDF text order can be unreliable for Arabic, especially numbers "
            "(prices, hours). Prefer DOCX or TXT."
        )
    return {
        "doc_id": doc_id,
        "chunks": chunks,
        "characters": len(text),
        "warning": warning,
        "preview": text[:300],
    }


@protected.post("/run")
def run(body: RunRequest):
    ctx = mm.recall(
        body.company_id,
        body.client_id,
        body.request,
        extra_feedback=body.past_feedback,
    )
    try:
        result = run_with_retry(
            body.request,
            ctx.feedback,
            body.language,
            client_profile=ctx.profile,
            knowledge=ctx.knowledge,
            examples=ctx.examples,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])

    draft = str(result)
    output, verification = verify.check(
        draft, body.request, ctx.profile, ctx.knowledge
    )
    episode_id = mm.remember_exchange(
        body.company_id, body.client_id, body.request, output
    )
    response = {"episode_id": episode_id, "result": output, "verification": verification}
    if verification == "corrected":
        response["original"] = draft  # what the crew wrote before the fact-check
    return response


@protected.post("/chat")
def chat(body: ChatRequest):
    conversation_id = body.conversation_id or uuid.uuid4().hex
    ctx = mm.recall(
        body.company_id,
        body.client_id,
        body.message,
        conversation_id=conversation_id,
    )
    try:
        result = run_with_retry(
            body.message,
            ctx.feedback,
            body.language,
            ctx.history,
            ctx.profile,
            ctx.knowledge,
            ctx.examples,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])

    draft = str(result)
    output, verification = verify.check(
        draft, body.message, ctx.profile, ctx.knowledge, ctx.history
    )
    # Saved only after success, so failed runs don't pollute the conversation
    episode_id = mm.remember_exchange(
        body.company_id, body.client_id, body.message, output, conversation_id
    )
    response = {
        "conversation_id": conversation_id,
        "episode_id": episode_id,
        "result": output,
        "verification": verification,
    }
    if verification == "corrected":
        response["original"] = draft
    return response


@protected.post("/feedback")
def feedback(body: FeedbackRequest, background: BackgroundTasks):
    client_id = mm.remember_feedback(
        body.company_id, body.episode_id, body.status, body.feedback
    )
    if client_id is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    if body.status == "rejected":
        # Runs after the response is sent, so the employee doesn't wait for the LLM
        background.add_task(mm.maybe_consolidate, body.company_id, client_id)
    return {"saved": True}


@protected.delete("/client")
def delete_client(company_id: int, client_id: int, confirm: bool = False):
    """Permanently delete everything stored about one client (all memories)."""
    if not confirm:
        raise HTTPException(
            status_code=400, detail="Pass confirm=true to delete this client's data"
        )
    return {"deleted": mm.forget_client(company_id, client_id)}


# ---------------------------------------------------------------- media

_jobs: dict[str, dict] = {}  # video jobs; in memory, lost on restart
_jobs_lock = threading.Lock()


def _media_file(name: str) -> Path:
    """Resolve a file name inside media_out/, rejecting anything else."""
    if not name or Path(name).name != name:
        raise HTTPException(status_code=400, detail="Invalid file name")
    path = (media.OUT_DIR / name).resolve()
    if path.parent != media.OUT_DIR.resolve() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return path


@protected.post("/media/image")
def media_image(body: ImageRequest):
    """Generate one image. Takes a few seconds to about a minute."""
    if body.raw_prompt:
        image_prompt = body.request
    else:
        profile = mm.get_profile(body.company_id, body.client_id)
        image_prompt = to_image_prompt(body.request, profile)
    try:
        path = media.generate_image(image_prompt, aspect_ratio=body.aspect_ratio)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])
    return {
        "file": path.name,
        "url": f"/media/file/{path.name}",
        "image_prompt": image_prompt,
    }


def _run_video_job(job_id: str, image_path: str, motion: str, seconds: float):
    try:
        out = media.generate_long_video(image_path, motion, seconds)
        update = {"status": "done", "file": out.name, "url": f"/media/file/{out.name}"}
    except Exception as e:
        update = {"status": "failed", "error": str(e)[:300]}
    with _jobs_lock:
        _jobs[job_id].update(update)


@protected.post("/media/video")
def media_video(body: VideoRequest, background: BackgroundTasks):
    """Start a video job from an existing image. Poll GET /media/jobs/{job_id}."""
    image = _media_file(body.image_file)
    with _jobs_lock:
        if any(j["status"] == "running" for j in _jobs.values()):
            # One at a time: the free GPU quota is shared and small
            raise HTTPException(
                status_code=429, detail="A video is already being generated, try later"
            )
        job_id = uuid.uuid4().hex
        _jobs[job_id] = {"status": "running", "company_id": body.company_id}
    background.add_task(
        _run_video_job, job_id, str(image), body.motion_prompt, body.total_seconds
    )
    return {"job_id": job_id, "status": "running"}


@protected.get("/media/jobs/{job_id}")
def media_job(job_id: str, company_id: int):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None or job["company_id"] != company_id:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"job_id": job_id, **{k: v for k, v in job.items() if k != "company_id"}}


@protected.get("/media/file/{name}")
def media_download(name: str):
    return FileResponse(_media_file(name))


# ------------------------------------------------------- debug routes (opt-in)

if DEBUG_ENDPOINTS:

    @protected.post("/consolidate")
    def consolidate_now(body: ConsolidateRequest):
        """Debug: merge pending feedback into the client's rules right now."""
        rules = mm.maybe_consolidate(body.company_id, body.client_id, min_items=1)
        return {"rules": rules}

    @protected.get("/recall")
    def recall(
        company_id: int,
        client_id: int,
        query: str,
        conversation_id: str | None = None,
    ):
        """Debug: show exactly what the crew would receive. No LLM call."""
        return asdict(mm.recall(company_id, client_id, query, conversation_id))


app.include_router(protected)