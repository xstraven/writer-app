# AGENTS.md

This file defines the expected development and deployment workflow for code agents working in this repo.

## Scope

- Backend: FastAPI in `src/storycraft/app/`
- Frontend: Next.js in `frontend-ts/`
- Database: PostgreSQL (local Postgres for development, Neon in production)

## Local Development Workflow

1. Install/sync Python deps:
   ```bash
   uv sync
   ```
2. Set `STORYCRAFT_NEON_DATABASE_URL` and run migrations before backend startup:
   ```bash
   STORYCRAFT_NEON_DATABASE_URL="postgresql://…" uv run alembic upgrade head
   ```
3. Run backend API:
   ```bash
   uv run uvicorn storycraft.app.main:app --reload --port 8000
   ```
4. Run backend tests:
   ```bash
   uv run pytest -q
   ```
5. Optional frontend loop:
   ```bash
   cd frontend-ts
   npm install
   npm run dev
   ```

## Schema/Migration Workflow

1. Update schema metadata in `src/storycraft/app/db/models.py` when needed.
2. Add a new Alembic revision under `alembic/versions/`.
3. Validate migration round trip locally:
   ```bash
   uv run alembic upgrade head
   uv run alembic downgrade -1
   uv run alembic upgrade head
   ```
4. Keep `scripts/setup_neon.py` as compatibility wrapper (it runs Alembic upgrade to head).

## Deploy Workflow (GitHub Actions + Modal)

- Workflow: `.github/workflows/backend-deploy.yml`
- Order: migrate DB first, deploy Modal second
- Trigger: push to `main`
- Migration gate:
  - if migration fails, deploy does not run
- Modal app/secret naming in `modal_app.py`:
  - app: `storycraft-backend`
  - secret: `storycraft-backend-env`

## Required Secrets

### GitHub Actions

- `STORYCRAFT_NEON_DATABASE_URL`
- `MODAL_TOKEN_ID`
- `MODAL_TOKEN_SECRET`

### Modal

- `storycraft-backend-env`

The Modal secret must include:
- `STORYCRAFT_NEON_DATABASE_URL` (production database URL)
- `STORYCRAFT_CORS_ORIGINS` (allow deployed frontend origins, e.g. Vercel domain)
