from __future__ import annotations

from functools import lru_cache
from typing import Any, Callable, Optional, TypeVar

import instructor
from instructor import Mode
from openai import AsyncOpenAI

from .config import get_settings


ReturnT = TypeVar("ReturnT")


class StructuredLLMClient:
    """Wrapper around Instructor + OpenAI client for structured responses."""

    def __init__(self) -> None:
        settings = get_settings()
        self._default_model = settings.openrouter_default_model
        self._headers = {
            "X-Title": "Storycraft",
            "HTTP-Referer": "http://localhost",
        }
        self._has_api_key = bool(settings.openrouter_api_key)
        self._client = self._build_client(settings.openrouter_api_key, settings.openrouter_base_url)

    @property
    def has_api_key(self) -> bool:
        return self._has_api_key

    def _build_client(self, api_key: Optional[str], base_url: str):
        if not api_key:
            return None
        base = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            default_headers=self._headers,
        )
        return instructor.from_openai(base, mode=Mode.TOOLS)

    async def create(
        self,
        *,
        response_model: Any,
        messages: list[dict[str, Any]],
        model: Optional[str] = None,
        fallback: Optional[Callable[[], ReturnT] | ReturnT] = None,
        **kwargs: Any,
    ) -> ReturnT:
        if not self._client:
            if fallback is not None:
                return fallback() if callable(fallback) else fallback
            raise RuntimeError("Structured LLM calls require STORYCRAFT_OPENROUTER_API_KEY")
        return await self._client.chat.completions.create(
            model=model or self._default_model,
            response_model=response_model,
            messages=messages,
            **kwargs,
        )


@lru_cache
def get_structured_llm_client() -> StructuredLLMClient:
    return StructuredLLMClient()
