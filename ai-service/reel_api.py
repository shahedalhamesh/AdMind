from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

import reel

router = APIRouter()  # included into the protected router in api.py


class ReelRequest(BaseModel):
    company_id: int
    client_id: int
    request: str = Field(min_length=3, max_length=2000)  # the employee's own words
    language: str = "Arabic"  # language of the voiceover script
    aspect_ratio: Literal["1:1", "16:9", "9:16", "4:3", "3:4"] = "9:16"


@router.post("/media/reel")
def create_reel(body: ReelRequest, background: BackgroundTasks):
    """Start building a reel from one free-text request. Poll /media/reel/{job_id}."""
    try:
        job_id = reel.new_job(body.company_id)
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    background.add_task(
        reel.run_reel, job_id, body.company_id, body.client_id,
        body.request, body.language, body.aspect_ratio,
    )
    return {"job_id": job_id, "status": "running"}


@router.get("/media/reel/{job_id}")
def reel_status(job_id: str, company_id: int):
    job = reel.get_job(job_id, company_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, **job}