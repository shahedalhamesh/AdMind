from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from main import run_with_retry

app = FastAPI(title="AdMind AI Service")


class RunRequest(BaseModel):
    request: str
    past_feedback: str = ""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/run")
def run(body: RunRequest):
    try:
        result = run_with_retry(body.request, body.past_feedback)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])
    return {"result": str(result)}