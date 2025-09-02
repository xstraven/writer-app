# Repository Guidelines

## Project Structure & Module Organization
- Backend (FastAPI): `src/storycraft/app/` — `main.py` (routes), `models.py` (Pydantic), `openrouter.py` (LLM client), `prompt_builder.py`, `generation.py`, `memory.py`, `config.py`, `lorebook_store.py`, `snippet_store.py`, `state_store.py`.
- Frontend (Reflex): `src/storycraft_frontend/` — `storycraft_frontend.py`, `pages/`, `state.py`. Note: `.web/` is generated.
- Tests: `tests/` — e.g., `test_backend_starts.py`, `test_reflex_imports.py`.
- Data: `data/` — e.g., `lorebook.json`, `story.duckdb`.
- Config: `pyproject.toml`, `rxconfig.py`, `.env` (local only).

## Build, Test, and Development Commands
- Install deps: `uv sync` (Python 3.13).
- Run backend: `uv run uvicorn storycraft.app.main:app --reload --port 8000`.
- Run frontend: `uv run reflex run` (serves at `http://127.0.0.1:3000`).
- Run tests: `uv run pytest -q` (no network; uses OpenRouter dev stub when no key).
- Lint/Format: `uv run ruff check .` • `uv run ruff format .`.

## Coding Style & Naming Conventions
- Python 3.13, 4-space indents, max line length 100.
- Type hints required; Pydantic models for I/O schemas.
- Naming: `snake_case` (functions/vars), `PascalCase` (classes), `UPPER_CASE` (consts).
- FastAPI routes in `main.py`; IO/config and stores in dedicated modules.
- Reflex components return `rx.Component`; pages live in `src/storycraft_frontend/pages/`.

## Testing Guidelines
- Framework: Pytest. Name tests `test_*.py` under `tests/`.
- Coverage focus: health endpoint, lorebook CRUD, memory extraction/continuation, Reflex compile.
- Command: `uv run pytest -q`. Tests should be fast, isolated, and offline.

## Commit & Pull Request Guidelines
- Conventional Commits examples:
  - `feat(backend): add prompt builder and branch generation`
  - `fix(frontend): align generate button`
- PRs include: clear summary, steps to verify, screenshots for UI changes, linked issues. Update README/AGENTS.md if endpoints or config change.

## Security & Configuration Tips
- Env vars use `STORYCRAFT_` prefix (see `config.py`); keep secrets in `.env` (never commit).
- OpenRouter API key is `STORYCRAFT_OPENROUTER_API_KEY`. If not set, `openrouter.py` returns stub responses for development.
- CORS/ports configured via `config.py`.
