from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import memory
from main import run_with_retry

app = FastAPI(title="AdMind AI Service")


class RunRequest(BaseModel):
    company_id: int
    client_id: int
    request: str
    language: str = "English"
    past_feedback: str = ""  # optional extra notes, added to what memory returns


class FeedbackRequest(BaseModel):
    company_id: int
    episode_id: int
    status: Literal["approved", "rejected"]
    feedback: str = ""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/run")
def run(body: RunRequest):
    remembered = memory.get_recent_feedback(body.company_id, body.client_id)
    combined = "\n".join(p for p in (remembered, body.past_feedback) if p)

    try:
        result = run_with_retry(body.request, combined, body.language)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])

    output = str(result)
    episode_id = memory.save_episode(
        body.company_id, body.client_id, body.request, output
    )
    return {"episode_id": episode_id, "result": output}


@app.post("/feedback")
def feedback(body: FeedbackRequest):
    saved = memory.add_feedback(
        body.episode_id, body.company_id, body.status, body.feedback
    )
    if not saved:
        raise HTTPException(status_code=404, detail="Episode not found")
    return {"saved": True}