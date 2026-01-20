from __future__ import annotations
from typing import Any, Dict, List, Optional

import httpx

from .config import get_settings


OPENROUTER_CHAT_COMPLETIONS = "/chat/completions"


class OpenRouterClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None) -> None:
        settings = get_settings()
        # Prefer explicit arg, fallback to STORYCRAFT_ env via settings only.
        self.api_key = api_key or settings.openrouter_api_key
        self.base_url = (base_url or settings.openrouter_base_url).rstrip("/")
        self.default_model = settings.openrouter_default_model

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "X-Title": "Storycraft",
            "HTTP-Referer": "http://localhost",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def chat(
        self,
        *,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        timeout: Optional[float | httpx.Timeout] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{OPENROUTER_CHAT_COMPLETIONS}"
        payload: Dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
            **kwargs,
        }
        # Dev-mode fallback when no key is set.
        if not self.api_key:
            return {
                "id": "dev-mock",
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "[DEV MODE] No OPENROUTER_API_KEY set. This is a stubbed response.",
                        }
                    }
                ],
                "model": payload["model"],
            }
        request_timeout: float | httpx.Timeout = timeout or 120
        try:
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                resp = await client.post(url, headers=self._headers(), json=payload)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            # Graceful fallback to a stubbed response on network/API errors to avoid 500s in dev.
            return {
                "id": "dev-mock-error",
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": f"[DEV MODE] OpenRouter request failed: {e}. Returning stub.",
                        }
                    }
                ],
                "model": payload.get("model", self.default_model),
            }
