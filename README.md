Storycraft — AI-Assisted Novel Writing
======================================

Storycraft is a full-stack starter writer kit for collaborative fiction writing with LLM assist.

- **Backend**: FastAPI + Supabase-backed persistence, modular routers under `src/storycraft/app/routes/`
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
2. Create a `.env` in the repo root and set:
   - `STORYCRAFT_SUPABASE_URL`
   - `STORYCRAFT_SUPABASE_SERVICE_KEY` (service role key for backend access)
   - `STORYCRAFT_OPENROUTER_API_KEY` (optional during local dev; omit for stubbed responses)
3. (One-time) provision the Supabase schema:
   ```bash
   STORYCRAFT_SUPABASE_DB_URL="postgresql://…" uv run python scripts/setup_supabase.py
   ```
   Use the project’s Postgres connection string from the Supabase dashboard.
4. Run the API:
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

Modal Deployment
----------------

1. Create a Modal secret containing the required backend env vars (Supabase URL, service key, optional OpenRouter key):
   ```bash
   modal secret create storycraft-backend-env \
     STORYCRAFT_SUPABASE_URL="https://...supabase.co" \
     STORYCRAFT_SUPABASE_SERVICE_KEY="..." \
     STORYCRAFT_OPENROUTER_API_KEY="sk-..."   # optional
   ```
2. Deploy the FastAPI app to Modal (uses `modal_app.py`):
   ```bash
   modal deploy modal_app.py
   ```
3. Keep an interactive dev server running with hot reloads when needed:
   ```bash
   modal serve modal_app.py
   ```
4. Inspect runtime logs in another terminal:
   ```bash
   modal app logs storycraft-backend
   ```
5. CI/CD: GitHub Actions deploys on pushes to `main` via `.github/workflows/deploy-modal.yml`. Provide `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` as repository secrets (`Settings → Secrets and variables → Actions`).

Environment Variables
---------------------

All variables use the `STORYCRAFT_` prefix.

- `STORYCRAFT_SUPABASE_URL` — Supabase project URL.
- `STORYCRAFT_SUPABASE_SERVICE_KEY` — Supabase service role key used by the backend.
- `STORYCRAFT_SUPABASE_DB_URL` — Postgres connection string (only required when running the setup script).
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
- `data/` — Sample lore and local JSON defaults (base settings, etc.)
- `scripts/` — Utility scripts such as `setup_supabase.py`

Contributing
------------

Review `AGENTS.md` for conventions, commit message style (Conventional Commits), and PR expectations. Always run the pytest and ruff commands listed above before submitting changes.
