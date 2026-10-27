"""Semantic knowledge base (Qdrant, local mode) for client documents and
approved examples.

Every point is stored with company_id + client_id, and every search filters on
both, so one tenant can never read another tenant's data.
"""
import os
import re
import uuid
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointIdsList,
    PointStruct,
    VectorParams,
)

load_dotenv()

EMBED_MODEL = os.getenv(
    "EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)
# The model name is part of the collection names, so switching models later
# creates fresh collections instead of clashing on vector size.
_SLUG = re.sub(r"\W+", "_", EMBED_MODEL.split("/")[-1])
COLLECTION = "knowledge_" + _SLUG
EXAMPLES = "examples_" + _SLUG
DB_DIR = Path(__file__).parent / "qdrant_data"
MIN_SCORE = float(os.getenv("KNOWLEDGE_MIN_SCORE", "0"))


@lru_cache(maxsize=1)
def _embedder() -> TextEmbedding:
    return TextEmbedding(EMBED_MODEL)


def _ensure(client: QdrantClient, name: str) -> None:
    if not client.collection_exists(name):
        size = len(next(iter(_embedder().embed(["probe"]))))
        client.create_collection(
            name,
            vectors_config=VectorParams(size=size, distance=Distance.COSINE),
        )


@lru_cache(maxsize=1)
def _client() -> QdrantClient:
    client = QdrantClient(path=str(DB_DIR))
    _ensure(client, COLLECTION)
    _ensure(client, EXAMPLES)
    return client


def _embed(texts: list[str], kind: str) -> list[list[float]]:
    """kind is 'query' or 'passage'. e5 models need these prefixes; others don't."""
    prefix = ""
    if "e5" in EMBED_MODEL.lower():
        prefix = "query: " if kind == "query" else "passage: "
    return [v.tolist() for v in _embedder().embed([prefix + t for t in texts])]


def _tenant_filter(company_id: int, client_id: int) -> Filter:
    return Filter(
        must=[
            FieldCondition(key="company_id", match=MatchValue(value=company_id)),
            FieldCondition(key="client_id", match=MatchValue(value=client_id)),
        ]
    )


# ---------------------------------------------------------------- documents


def chunk_text(text: str, max_words: int = 200, overlap: int = 30) -> list[str]:
    """Split text into overlapping chunks of ~max_words words."""
    words = text.split()
    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunks.append(" ".join(words[i : i + max_words]))
        if i + max_words >= len(words):
            break
        i += max_words - overlap
    return chunks


def add_document(company_id: int, client_id: int, title: str, text: str) -> tuple[str, int]:
    """Store a document for one client. Returns (doc_id, number_of_chunks)."""
    chunks = chunk_text(text)
    if not chunks:
        return "", 0
    doc_id = uuid.uuid4().hex
    vectors = _embed(chunks, "passage")
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vec,
            payload={
                "company_id": company_id,
                "client_id": client_id,
                "doc_id": doc_id,
                "title": title,
                "chunk_index": i,
                "text": chunk,
            },
        )
        for i, (chunk, vec) in enumerate(zip(chunks, vectors))
    ]
    _client().upsert(COLLECTION, points=points)
    return doc_id, len(points)


def search(company_id: int, client_id: int, query: str, limit: int = 3) -> list[dict]:
    """Closest document chunks to the query, for this client only."""
    vector = _embed([query], "query")[0]
    result = _client().query_points(
        collection_name=COLLECTION,
        query=vector,
        query_filter=_tenant_filter(company_id, client_id),
        limit=limit,
        score_threshold=MIN_SCORE or None,
    )
    return [
        {"score": round(p.score, 3), "title": p.payload["title"], "text": p.payload["text"]}
        for p in result.points
    ]


def format_context(results: list[dict]) -> str:
    """Search results as plain text for the prompt."""
    return "\n\n".join(f"[{r['title']}]\n{r['text']}" for r in results)


# ----------------------------------------------------------------- examples


def _example_id(company_id: int, episode_id: int) -> str:
    # Deterministic id: approving the same episode twice overwrites, never duplicates.
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"example:{company_id}:{episode_id}"))


def add_example(
    company_id: int, client_id: int, episode_id: int, request: str, output: str
) -> None:
    """Save an approved answer. The REQUEST is what gets embedded, so a new
    similar request finds it."""
    vector = _embed([request], "passage")[0]
    _client().upsert(
        EXAMPLES,
        points=[
            PointStruct(
                id=_example_id(company_id, episode_id),
                vector=vector,
                payload={
                    "company_id": company_id,
                    "client_id": client_id,
                    "episode_id": episode_id,
                    "request": request,
                    "output": output,
                },
            )
        ],
    )


def remove_example(company_id: int, episode_id: int) -> None:
    """Forget an example (e.g. an approved answer that was later rejected)."""
    _client().delete(
        EXAMPLES,
        points_selector=PointIdsList(points=[_example_id(company_id, episode_id)]),
    )


def search_examples(company_id: int, client_id: int, query: str, limit: int = 2) -> list[dict]:
    """Approved answers for the most similar past requests of this client."""
    vector = _embed([query], "query")[0]
    result = _client().query_points(
        collection_name=EXAMPLES,
        query=vector,
        query_filter=_tenant_filter(company_id, client_id),
        limit=limit,
    )
    return [
        {
            "score": round(p.score, 3),
            "episode_id": p.payload["episode_id"],
            "request": p.payload["request"],
            "output": p.payload["output"],
        }
        for p in result.points
    ]


def format_examples(results: list[dict]) -> str:
    return "\n\n".join(
        f"Request: {r['request']}\nApproved answer: {r['output'][:600]}" for r in results
    )