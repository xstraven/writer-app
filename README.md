Storycraft — AI-Assisted Novel Writing
======================================

An opinionated starter template for an AI-assisted story writing app.

- Backend: FastAPI with Pydantic for structured models
- Frontend: Reflex (Python-native UI) calling the FastAPI API
- LLM: OpenRouter chat completions (pluggable model)
- Package manager: uv

Quick Start
-----------

1) Install dependencies (managed by uv):

   - Install uv: https://docs.astral.sh/uv/
   - Then in this folder run: `uv sync`

2) Configure environment:

   - Copy `.env.example` to `.env` and set your OpenRouter key

3) Run the FastAPI backend:

   - `uv run uvicorn app.main:app --reload --port 8000`
   - Check health: `http://127.0.0.1:8000/health`

4) Run the Reflex frontend (separate terminal):

   - `uv run reflex run` (first run will set up the web build)
   - App opens at `http://127.0.0.1:3000`

Environment Variables
---------------------

Prefix all variables with `STORYCRAFT_` to match Settings.

- `STORYCRAFT_OPENROUTER_API_KEY`: Your OpenRouter API key.
- `STORYCRAFT_OPENROUTER_BASE_URL` (optional): Defaults to `https://openrouter.ai/api/v1`.
- `STORYCRAFT_OPENROUTER_DEFAULT_MODEL` (optional): Defaults to `openrouter/auto`.

Endpoints
---------

- `GET /health` — basic health check.
- `GET /api/lorebook` — list lore entries.
- `POST /api/lorebook` — add entry `{name, kind, summary, tags?}`.
- `PUT /api/lorebook/{id}` — update entry.
- `DELETE /api/lorebook/{id}` — delete entry.
- `POST /api/extract-memory` — extract MemoryState from text `{current_text, max_items?, model?}`.
- `POST /api/continue` — continue story `{draft_text, instruction?, model?, temperature?, max_tokens?, use_memory?}`.

Notes
-----

- If `OPENROUTER_API_KEY` is not set, the backend returns stubbed responses for development.
- Lorebook is persisted to `data/lorebook.json`. This is a simple JSON store; switch to a DB if needed.
- The memory extractor uses Pydantic JSON schema as `response_format` for structured output.

Project Layout
--------------

- `app/` — FastAPI backend
  - `main.py` — API routes and CORS
  - `models.py` — Pydantic models and schemas
  - `memory.py` — LLM-powered memory extraction and continuation
  - `openrouter.py` — OpenRouter client wrapper
  - `lorebook_store.py` — simple JSON file store for lore entries
  - `config.py` — settings via pydantic-settings
- `storycraft_frontend/` — Reflex UI
  - `pages/index.py` — main UI page
  - `state.py` — Reflex state, API calls to backend
- `rxconfig.py` — Reflex configuration
- `pyproject.toml` — project and dependencies (uv-compatible)

Troubleshooting
---------------

- CORS: The API allows localhost ports 3000 and 8000. Adjust in `app/config.py` if needed.
- Ports: Frontend on 3000, Backend on 8000. Update `API_BASE` in `storycraft_frontend/state.py` if you change them.
- Models: Update `AppState.model` or set `STORYCRAFT_OPENROUTER_DEFAULT_MODEL`.

Next Steps
----------

- Add user auth and per-user lorebooks.
- Add scene/chapters with autosave.
- Add export to Markdown/EPUB.
- Add tool for style calibration from sample chapters.

