Storycraft — AI-Assisted Novel Writing
======================================

Storycraft is a full-stack starter kit for collaborative fiction writing with LLM assist.

- **Backend**: FastAPI + Pydantic, modular routers under `src/storycraft/app/routes/`
- **Frontend**: Next.js + React + Tailwind located in `frontend-ts/`
- **LLM**: OpenRouter chat completions (stubs enabled when no API key is present)
- **Package managers**: `uv` for Python, `npm` for the frontend

Quick Start
-----------

### Backend
1. Install uv (see https://docs.astral.sh/uv/) and sync dependencies:
   ```bash
   uv sync
   ```
2. Create a `.env` in the repo root and set `STORYCRAFT_OPENROUTER_API_KEY` (optional during local dev).
3. Run the API:
   ```bash
   uv run uvicorn storycraft.app.main:app --reload --port 8000
   ```
   Visit `http://127.0.0.1:8000/health` to confirm.

### Frontend
1. Install Node dependencies:
   ```bash
   cd frontend-ts
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
   The app is available at `http://localhost:3000` (expects the API on port 8000).

Environment Variables
---------------------

All variables use the `STORYCRAFT_` prefix.

- `STORYCRAFT_OPENROUTER_API_KEY` — OpenRouter key; omit to use stubbed responses.
- `STORYCRAFT_OPENROUTER_BASE_URL` — override base URL (default `https://openrouter.ai/api/v1`).
- `STORYCRAFT_OPENROUTER_DEFAULT_MODEL` — default chat model (default `deepseek/deepseek-chat-v3-0324`).
- Frontend envs go in `frontend-ts/.env.local` (e.g., `NEXT_PUBLIC_STORYCRAFT_API_BASE`).

Key Endpoints
-------------

- `GET /health` — API readiness probe.
- `GET /api/stories` — list stories across stores.
- `GET /api/snippets/path?story=...` — fetch the active branch text and metadata.
- `POST /api/continue` — request an LLM continuation for the active draft.
- `POST /api/prompt-preview` — inspect the prompt payload before sending to OpenRouter.
- `GET/POST/PUT/DELETE /api/lorebook` — manage lore entries scoped per story.

Testing & Tooling
-----------------

- Run backend tests: `UV_CACHE_DIR=.uv-cache uv run pytest -q`
- Lint / format Python: `uv run ruff check .` and `uv run ruff format .`
- Frontend lint: `cd frontend-ts && npm run lint`

Project Layout
--------------

- `src/storycraft/app/` — FastAPI app (routers, services, stores, models)
- `frontend-ts/` — Next.js app (components, hooks, Zustand store)
- `tests/` — Pytest coverage for health, generation, snippets, and settings APIs
- `data/` — Sample lore and DuckDB persistence

Contributing
------------

Review `AGENTS.md` for conventions, commit message style (Conventional Commits), and PR expectations. Always run the pytest and ruff commands listed above before submitting changes.
