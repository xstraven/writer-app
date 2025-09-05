# Repository Guidelines

## Project Structure & Module Organization
- Backend (FastAPI): `src/storycraft/app/`
  - `main.py` (routes), `models.py` (Pydantic), `openrouter.py` (LLM client), `prompt_builder.py`, `generation.py`, `memory.py`, `config.py`, `lorebook_store.py`, `snippet_store.py`, `story_settings_store.py`, `state_store.py`.
- Frontend (Reflex): `src/storycraft_frontend/`
  - `storycraft_frontend.py` (app), `pages/` (routes), `state.py`.
- Tests: `tests/` — health check, lorebook CRUD, snippet APIs, prompt/generation, Reflex import/compile.
- Data: `data/` — `lorebook.json`, `story.duckdb`.
- Config: `pyproject.toml`, `rxconfig.py`, `.env` (local only).

## Build, Test, and Development Commands
- Install deps: `uv sync` — creates/syncs the Python 3.13 env.
- Run backend: `uv run uvicorn storycraft.app.main:app --reload --port 8000`.
- Run frontend (Reflex): `uv run reflex run` — serves `http://127.0.0.1:3000`.
- Run tests: `uv run pytest -q` — offline; uses OpenRouter stub when no key.
- Lint/format: `uv run ruff check .` • `uv run ruff format .`.

## Coding Style & Naming Conventions
- Python 3.13, 4-space indent, max line length 100.
- Type hints required; define request/response via Pydantic models in `models.py`.
- Naming: `snake_case` (funcs/vars), `PascalCase` (classes), `UPPER_CASE` (consts).
- FastAPI routes live in `main.py`; business/data logic in store modules.
- Reflex pages under `src/storycraft_frontend/pages/` and return `rx.Component`.

## Testing Guidelines
- Pytest; name tests `tests/test_*.py`.
- Focus: health endpoint, lorebook CRUD, snippet lifecycle, memory and prompt building, Reflex import/compile.
- Tests must be fast and network-free. Run with `uv run pytest -q`.

## Commit & Pull Request Guidelines
- Conventional Commits, e.g. `feat(backend): add prompt builder`, `fix(frontend): align generate button`.
- PRs include: clear summary, verification steps, screenshots for UI changes, and linked issues. Update `README`/`AGENTS.md` when endpoints/config change.

## Security & Configuration Tips
- Env vars use `STORYCRAFT_` (see `config.py`); store secrets in local `.env` (never commit).
- OpenRouter key: `STORYCRAFT_OPENROUTER_API_KEY`. Unset => dev stub responses.
- CORS/ports configurable via `config.py`.
