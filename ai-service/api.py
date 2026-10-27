from dataclasses import asdict
import uuid
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

import memory_manager as mm
from main import run_with_retry

app = FastAPI(title="AdMind AI Service")


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


class KnowledgeRequest(BaseModel):
    company_id: int
    client_id: int
    title: str
    text: str

class ConsolidateRequest(BaseModel):
    company_id: int
    client_id: int


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.put("/profile")
def save_profile(body: ProfileRequest):
    """Create or fully replace a client's profile."""
    fields = body.model_dump(exclude={"company_id", "client_id"})
    mm.remember_profile(body.company_id, body.client_id, **fields)
    return {"saved": True}


@app.get("/profile")
def get_profile(company_id: int, client_id: int):
    return {"profile": mm.get_profile(company_id, client_id)}


@app.post("/knowledge")
def add_knowledge(body: KnowledgeRequest):
    """Store a client document in the vector database."""
    doc_id, chunks = mm.remember_document(
        body.company_id, body.client_id, body.title, body.text
    )
    if chunks == 0:
        raise HTTPException(status_code=422, detail="Document text is empty")
    return {"doc_id": doc_id, "chunks": chunks}


@app.post("/run")
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

    output = str(result)
    episode_id = mm.remember_exchange(
        body.company_id, body.client_id, body.request, output
    )
    return {"episode_id": episode_id, "result": output}


@app.post("/chat")
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

    output = str(result)
    # Saved only after success, so failed runs don't pollute the conversation
    episode_id = mm.remember_exchange(
        body.company_id, body.client_id, body.message, output, conversation_id
    )
    return {
        "conversation_id": conversation_id,
        "episode_id": episode_id,
        "result": output,
    }


@app.post("/feedback")
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


@app.post("/consolidate")
def consolidate_now(body: ConsolidateRequest):
    """Manual/debug: merge pending feedback into the client's rules right now."""
    rules = mm.maybe_consolidate(body.company_id, body.client_id, min_items=1)
    return {"rules": rules}

@app.get("/recall")
def recall(company_id: int, client_id: int, query: str, conversation_id: str | None = None):
    """Debug: show exactly what the crew would receive. No LLM call."""
    return asdict(mm.recall(company_id, client_id, query, conversation_id))