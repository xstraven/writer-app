Storycraft — AI-Assisted Novel Writing
======================================

Storycraft is a full-stack starter writer kit for collaborative fiction writing with LLM assist.

![alt text](<Screenshot 2025-11-03 at 22.06.30.png>)

- **Backend**: FastAPI with auto-switching persistence (local DuckDB or cloud Supabase), modular routers under `src/storycraft/app/routes/`
- **Frontend**: Next.js + React + Tailwind located in `frontend-ts/`
- **LLM**: OpenRouter chat completions (stubs enabled when no API key is present)
- **Package managers**: `uv` for Python, `npm` for the frontend

Quick Start
-----------

### Backend

Storycraft supports two database modes:
- **Local Mode (DuckDB)**: Perfect for local development and testing - no setup required!
- **Cloud Mode (Supabase)**: Use for production or when you want cloud-hosted storage

#### Option 1: Local Mode (Recommended for getting started)

1. Install uv (see https://docs.astral.sh/uv/) and sync dependencies:
   ```bash
   uv sync
   ```
2. Run the API:
   ```bash
   uv run uvicorn storycraft.app.main:app --reload --port 8000
   ```
   Visit `http://127.0.0.1:8000/health` to confirm.

That's it! The app will automatically create a local DuckDB database at `./data/storycraft.duckdb`.

**Optional**: Set `STORYCRAFT_OPENROUTER_API_KEY` in `.env` for real LLM responses (omit for stubbed responses during development).

#### Option 2: Cloud Mode with Supabase

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
   Use the project's Postgres connection string from the Supabase dashboard.
4. Run the API:
   ```bash
   uv run uvicorn storycraft.app.main:app --reload --port 8000
   ```
   Visit `http://127.0.0.1:8000/health` to confirm.

### Frontend

The frontend works out of the box with zero configuration!

1. Install Node dependencies:
   ```bash
   cd frontend-ts
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
   The app is available at `http://localhost:3000` (automatically connects to backend on `http://localhost:8000`).

**Optional**: To point to a different backend URL, create `frontend-ts/.env.local`:
```bash
NEXT_PUBLIC_STORYCRAFT_API_BASE=https://your-backend-url.com
```

Deployment
----------

This project is designed for local development. To deploy:

- **Backend**: The FastAPI app in `src/storycraft/app/` can be deployed to any server that runs Python (e.g., Heroku, Railway, Modal, Render).
- **Frontend**: The Next.js frontend in `frontend-ts/` can be deployed to Vercel, Netlify, or any static hosting service.
- **Database**: Supabase can be replaced with any PostgreSQL-compatible database.

Environment Variables
---------------------

All variables use the `STORYCRAFT_` prefix.

### Database Configuration
The app automatically selects the database backend:
- **Local Mode**: Used when Supabase credentials are not configured
- **Cloud Mode**: Used when Supabase credentials are provided

- `STORYCRAFT_DUCKDB_PATH` — Path to local DuckDB file (default: `./data/storycraft.duckdb`)
- `STORYCRAFT_SUPABASE_URL` — Supabase project URL
- `STORYCRAFT_SUPABASE_SERVICE_KEY` — Supabase service role key used by the backend
- `STORYCRAFT_SUPABASE_DB_URL` — Postgres connection string (only required when running the setup script)

### Other Configuration
- `STORYCRAFT_OPENROUTER_API_KEY` — OpenRouter key; omit to use stubbed responses
- `STORYCRAFT_OPENROUTER_BASE_URL` — override base URL (default `https://openrouter.ai/api/v1`)
- `STORYCRAFT_OPENROUTER_DEFAULT_MODEL` — default chat model (default `deepseek/deepseek-chat-v3-0324`)

### Frontend Configuration (Optional)
- `NEXT_PUBLIC_STORYCRAFT_API_BASE` — Backend API URL (default: `http://localhost:8000`)
  - Only needed if deploying or using a non-standard backend URL
  - Set in `frontend-ts/.env.local` if needed

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

- Run backend tests: `uv run pytest -q`
  - Tests automatically use in-memory storage (no database setup required)
- Lint / format Python: `uv run ruff check .` and `uv run ruff format .`
- Frontend lint: `cd frontend-ts && npm run lint`

Project Layout
--------------

- `src/storycraft/app/` — FastAPI app (routers, services, stores, models)
- `frontend-ts/` — Next.js app (components, hooks, Zustand store)
- `tests/` — Pytest coverage for health, generation, snippets, and settings APIs
- `data/` — Sample lore and local JSON defaults (base settings, etc.)
- `scripts/` — Utility scripts such as `setup_supabase.py`
