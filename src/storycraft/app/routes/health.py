from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import HealthResponse
from ..openrouter import OpenRouterClient


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@router.get("/health/llm", response_model=HealthResponse)
async def health_llm() -> HealthResponse:
    """Lightweight LLM connectivity check.

    Uses OpenRouter client. In dev without an API key, the client returns a stubbed
    response which we treat as OK to avoid blocking local workflows.
    """
    try:
        client = OpenRouterClient()
        # Minimal ping; model falls back to default
        _ = await client.chat(messages=[{"role": "user", "content": "ping"}], max_tokens=1, temperature=0)
        return HealthResponse()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM health check failed: {e}")
