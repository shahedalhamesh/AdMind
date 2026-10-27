import logging
import uuid
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

import knowledge
import memory
from main import run_with_retry

log = logging.getLogger("admind")

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


def _knowledge_context(company_id: int, client_id: int, query: str) -> str:
    """Relevant document chunks for this client. Never breaks the request."""
    try:
        return knowledge.format_context(knowledge.search(company_id, client_id, query))
    except Exception as e:
        log.warning("knowledge search failed: %s", e)
        return ""


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.put("/profile")
def save_profile(body: ProfileRequest):
    """Create or fully replace a client's profile (semantic memory)."""
    fields = body.model_dump(exclude={"company_id", "client_id"})
    memory.save_profile(body.company_id, body.client_id, **fields)
    return {"saved": True}


@app.get("/profile")
def get_profile(company_id: int, client_id: int):
    return {"profile": memory.get_profile(company_id, client_id)}


@app.post("/knowledge")
def add_knowledge(body: KnowledgeRequest):
    """Store a client document in the vector database (Qdrant)."""
    doc_id, chunks = knowledge.add_document(
        body.company_id, body.client_id, body.title, body.text
    )
    if chunks == 0:
        raise HTTPException(status_code=422, detail="Document text is empty")
    return {"doc_id": doc_id, "chunks": chunks}


@app.post("/run")
def run(body: RunRequest):
    remembered = memory.get_recent_feedback(body.company_id, body.client_id)
    combined = "\n".join(p for p in (remembered, body.past_feedback) if p)
    profile = memory.get_profile(body.company_id, body.client_id)
    docs = _knowledge_context(body.company_id, body.client_id, body.request)

    try:
        result = run_with_retry(
            body.request,
            combined,
            body.language,
            client_profile=profile,
            knowledge=docs,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])

    output = str(result)
    episode_id = memory.save_episode(
        body.company_id, body.client_id, body.request, output
    )
    return {"episode_id": episode_id, "result": output}


@app.post("/chat")
def chat(body: ChatRequest):
    conversation_id = body.conversation_id or uuid.uuid4().hex

    history = memory.get_conversation(conversation_id, body.company_id)  # short-term
    remembered = memory.get_recent_feedback(body.company_id, body.client_id)  # long-term
    profile = memory.get_profile(body.company_id, body.client_id)  # semantic: profile
    docs = _knowledge_context(body.company_id, body.client_id, body.message)  # semantic: docs

    try:
        result = run_with_retry(
            body.message, remembered, body.language, history, profile, docs
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])

    output = str(result)
    # Save only after success, so failed runs don't pollute the conversation
    memory.add_message(conversation_id, body.company_id, body.client_id, "user", body.message)
    memory.add_message(conversation_id, body.company_id, body.client_id, "assistant", output)
    episode_id = memory.save_episode(
        body.company_id, body.client_id, body.message, output
    )
    return {
        "conversation_id": conversation_id,
        "episode_id": episode_id,
        "result": output,
    }


@app.post("/feedback")
def feedback(body: FeedbackRequest):
    saved = memory.add_feedback(
        body.episode_id, body.company_id, body.status, body.feedback
    )
    if not saved:
        raise HTTPException(status_code=404, detail="Episode not found")
    return {"saved": True}