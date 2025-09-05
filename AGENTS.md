# Repository Guidelines

## Project Structure & Module Organization
- Backend (FastAPI): `src/storycraft/app/`
  - `main.py` (routes), `models.py` (Pydantic), `openrouter.py` (LLM client), `prompt_builder.py`, `generation.py`, `memory.py`, `config.py`, `lorebook_store.py`, `snippet_store.py`, `state_store.py`.
- Frontend (Reflex): `src/storycraft_frontend/`
  - `storycraft_frontend.py` (app), `pages/` (routes), `state.py`.
- Tests: `tests/` — backend health, lorebook CRUD, memory, Reflex compile.
- Data: `data/` — `lorebook.json`, `story.duckdb`.
- Config: `pyproject.toml`, `rxconfig.py`, `.env` (local only).

## Build, Test, and Development Commands
- Install deps: `uv sync` — syncs a Python 3.13 environment.
- Run backend: `uv run uvicorn storycraft.app.main:app --reload --port 8000`.
- Run frontend: `uv run reflex run` — serves at `http://127.0.0.1:3000`.
- Run tests: `uv run pytest -q` — offline; uses OpenRouter dev stub when no key.
- Lint: `uv run ruff check .` • Format: `uv run ruff format .`.

## Coding Style & Naming Conventions
- Python 3.13, 4-space indents, max line length 100.
- Type hints required; use Pydantic models for request/response schemas.
- Naming: `snake_case` (funcs/vars), `PascalCase` (classes), `UPPER_CASE` (consts).
- FastAPI routes live in `main.py`; I/O schemas and stores in dedicated modules.
- Reflex components return `rx.Component`; pages under `src/storycraft_frontend/pages/`.

## Testing Guidelines
- Framework: Pytest; name tests `test_*.py` under `tests/`.
- Scope: health endpoint, lorebook CRUD, memory extraction/continuation, Reflex import/compile.
- Keep tests fast, isolated, and without network access. Run with `uv run pytest -q`.

## Commit & Pull Request Guidelines
- Use Conventional Commits. Examples:
  - `feat(backend): add prompt builder and branch generation`
  - `fix(frontend): align generate button`
- PRs: include a clear summary, steps to verify, screenshots for UI changes, and linked issues. Update `README`/`AGENTS.md` when endpoints or config change.

## Security & Configuration Tips
- Env vars use `STORYCRAFT_` prefix (see `config.py`). Secrets go in `.env` (never commit).
- OpenRouter key: `STORYCRAFT_OPENROUTER_API_KEY`. When unset, `openrouter.py` returns stub responses for development.
- CORS and ports are configurable via `config.py`.

