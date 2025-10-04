# Repository Guidelines

## Project Structure & Module Organization
- Backend FastAPI app lives in `src/storycraft/app/`; routers sit under `routes/`, stores in this directory handle Supabase access, and shared services live in `services/`.
- Next.js frontend is in `frontend-ts/` with React components inside `src/components/`, Zustand stores in `src/stores/`, and shared utilities under `src/lib/`.
- Pytest suites are under `tests/`, while onboarding or utility scripts land in `scripts/` (e.g., `setup_supabase.py`).

## Build, Test, and Development Commands
- `uv sync` — install and lock Python dependencies into `.venv`.
- `uv run uvicorn storycraft.app.main:app --reload --port 8000` — start the FastAPI API locally.
- `uv run pytest -q` — execute backend tests with quiet output.
- `uv run pytest -q tests/test_snippet_store.py` — run a focused backend test file during development.
- `cd frontend-ts && npm install` — install frontend dependencies once.
- `cd frontend-ts && npm run dev` — run the Next.js dev server on port 3000.

## Coding Style & Naming Conventions
- Python: 4-space indentation, max line length 100, type hints required. Prefer descriptive snake_case functions and variables; use PascalCase for classes.
- TypeScript/React: follow Next.js defaults; functional components, PascalCase filenames for components, camelCase hooks/state, Tailwind utility classes for styling.
- Apply `uv run ruff format .` for formatting and `uv run ruff check .` for linting.

## Testing Guidelines
- Backend tests rely on Pytest; name files `test_*.py` and keep fixtures in `tests/conftest.py` when sharing setup.
- Use the in-memory Supabase client supplied by fixtures; avoid network calls in tests.
- Aim for coverage on new modules and regressions; run `uv run pytest -q` before opening a PR.

## Commit & Pull Request Guidelines
- Use Conventional Commits such as `feat(app): add snippet duplication API` or `fix(frontend): reset editor selection`.
- PRs should summarize changes, list verification steps (tests run, manual QA), link issues, and include screenshots for UI updates.
- Keep diffs focused; split refactors from feature work to simplify reviews.

## Security & Configuration Tips
- Environment variables must be prefixed `STORYCRAFT_`. Store secrets (Supabase keys, OpenRouter tokens) in `.env` and never commit them.
- Run `STORYCRAFT_SUPABASE_DB_URL="postgresql://…" uv run python scripts/setup_supabase.py` once per environment to provision tables before hitting Supabase.
