Storycraft — Group RPG Adventure Builder
========================================

![Backend Tests](https://github.com/xstraven/writer-app/actions/workflows/backend-tests.yml/badge.svg)
![Frontend Tests](https://github.com/xstraven/writer-app/actions/workflows/frontend-tests.yml/badge.svg)

Storycraft is a multiplayer tabletop RPG platform with an AI game master. Create collaborative storytelling adventures with friends or family, with the AI dynamically narrating and responding to player actions.

**Features:**
- **Multiplayer**: Hot-seat/turn-based play on the same device, or share invite codes with friends
- **AI Game Master**: Generates worlds, characters, and narrates the adventure
- **Two Game Styles**: Narrative-focused (PbtA-style 2d6) or traditional RPG (D&D-style d20)
- **Family-Friendly Options**: Choose tone settings for kids, all ages, or mature audiences
- **Voice Input**: Describe your world and actions using voice

**Stack:**
- **Backend**: FastAPI with PostgreSQL persistence (local or cloud Neon)
- **Frontend**: Next.js + React + Tailwind
- **LLM**: OpenRouter chat completions (stubs enabled when no API key is present)
- **Package managers**: `uv` for Python, `npm` for the frontend

Quick Start
-----------

### Backend

Local development now assumes PostgreSQL (local Postgres or Neon branch).

1. Install uv (see https://docs.astral.sh/uv/) and sync dependencies:
   ```bash
   uv sync
   ```
2. Create a `.env` in the repo root and set:
   - `STORYCRAFT_NEON_DATABASE_URL` (use your local Postgres URL or a Neon connection string)
   - `STORYCRAFT_OPENROUTER_API_KEY` (optional during local dev; omit for stubbed responses)
3. Apply migrations:
   ```bash
   STORYCRAFT_NEON_DATABASE_URL="postgresql://…" uv run alembic upgrade head
   ```
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

How to Play
-----------

1. **Create an Adventure**: Set up a world (fantasy, sci-fi, etc.), choose tone and style
2. **Add Players**: Add local players for hot-seat play, or share the invite code
3. **Start**: The AI generates an opening scene and custom game system
4. **Take Turns**: Describe what your character does, the AI narrates the outcome
5. **Collaborate**: Build the story together with "yes, and..." energy

### Game Styles

- **Collaborative Story** (Narrative): Focus on storytelling with simple 2d6 dice. Characters are defined by who they are, not stats. Inspired by Dungeon World/Powered by the Apocalypse.
- **Story + Light Rules** (Hybrid): Storytelling with some game mechanics.
- **Classic RPG** (Mechanical): Traditional d20 + modifiers with attributes, HP, and skills.

### Tone Settings

- **Family Fun**: Great for kids! No scary stuff, focuses on teamwork and wonder.
- **All Ages**: Mild adventure peril, suitable for everyone.
- **Mature**: Realistic stakes and consequences.

Deployment
----------

This project is designed for local development. To deploy:

- **Backend**: The FastAPI app in `src/storycraft/app/` can be deployed to any server that runs Python (e.g., Heroku, Railway, Modal, Render).
- **Frontend**: The Next.js frontend in `frontend-ts/` can be deployed to Vercel, Netlify, or any static hosting service.
- **Database**: Neon can be replaced with any PostgreSQL-compatible database.

### Daily Dev Workflow

1. Sync Python dependencies:
   ```bash
   uv sync
   ```
2. If using Neon locally, apply current migrations:
   ```bash
   STORYCRAFT_NEON_DATABASE_URL="postgresql://…" uv run alembic upgrade head
   ```
3. Run backend:
   ```bash
   uv run uvicorn storycraft.app.main:app --reload --port 8000
   ```
4. Run backend tests before pushing:
   ```bash
   uv run pytest -q
   ```
5. When schema changes are needed:
   - add/update SQLAlchemy metadata in `src/storycraft/app/db/models.py`
   - create a migration in `alembic/versions/`
   - validate with:
     ```bash
     uv run alembic upgrade head
     uv run alembic downgrade -1
     uv run alembic upgrade head
     ```

### Modal + Neon deployment flow

- `Backend Deploy` workflow runs on push to `main`.
- It migrates the production database first, then deploys Modal.
- Required GitHub secrets:
  - `STORYCRAFT_NEON_DATABASE_URL`
  - `MODAL_TOKEN_ID`
  - `MODAL_TOKEN_SECRET`
- Modal uses the single secret:
  - `storycraft-backend-env`

### Migration commands

- Upgrade DB: `uv run alembic upgrade head`
- Downgrade one revision: `uv run alembic downgrade -1`
- Convenience wrapper (uses same migrations): `uv run python scripts/setup_neon.py`

Environment Variables
---------------------

All variables use the `STORYCRAFT_` prefix.

### Database Configuration
- `STORYCRAFT_NEON_DATABASE_URL` — PostgreSQL connection string for local dev and production deploys

### Other Configuration
- `STORYCRAFT_OPENROUTER_API_KEY` — OpenRouter key; omit to use stubbed responses
- `STORYCRAFT_OPENROUTER_BASE_URL` — override base URL (default `https://openrouter.ai/api/v1`)
- `STORYCRAFT_OPENROUTER_DEFAULT_MODEL` — default chat model (default `deepseek/deepseek-chat-v3-0324`)
- `STORYCRAFT_CORS_ORIGINS` — allowed browser origins (comma-separated or JSON array)
- `STORYCRAFT_CORS_ORIGIN_REGEX` — optional regex for additional dynamic origins

### Frontend Configuration (Optional)
- `NEXT_PUBLIC_STORYCRAFT_API_BASE` — Backend API URL (default: `http://localhost:8000`)
  - Only needed if deploying or using a non-standard backend URL
  - Set in `frontend-ts/.env.local` if needed

Key Endpoints
-------------

### Campaign/RPG Endpoints
- `GET /api/campaigns` — list your campaigns
- `POST /api/campaigns` — create a new campaign (generates game system + character)
- `POST /api/campaigns/join` — join a campaign via invite code
- `POST /api/campaigns/{id}/start` — start the adventure (GM only)
- `POST /api/campaigns/{id}/action` — take an action (resolves dice, generates narrative)
- `POST /api/campaigns/{id}/end-turn` — pass turn to next player
- `POST /api/campaigns/{id}/players` — add a local player (hot-seat multiplayer)

### Legacy Story Endpoints
- `GET /api/stories` — list stories
- `GET /api/snippets/path?story=...` — fetch the active branch text
- `POST /api/continue` — request an LLM continuation
- `GET/POST/PUT/DELETE /api/lorebook` — manage lore entries

Testing & Tooling
-----------------

- Run backend tests: `uv run pytest -q`
  - Tests automatically use in-memory storage (no database setup required)
- Lint / format Python: `uv run ruff check .` and `uv run ruff format .`
- Frontend lint: `cd frontend-ts && npm run lint`
- Frontend build: `cd frontend-ts && npm run build`

Project Layout
--------------

- `src/storycraft/app/` — FastAPI app (routers, services, stores, models)
- `frontend-ts/` — Next.js app (components, hooks, Zustand stores)
- `tests/` — Pytest coverage for APIs
- `data/` — Local database and sample data
- `scripts/` — Utility scripts such as `setup_neon.py`
