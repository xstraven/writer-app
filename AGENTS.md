# Repository Guidelines

## Project Structure & Module Organization
- Backend (FastAPI): `src/storycraft/app/`
  - `main.py` (routes), `models.py` (Pydantic), `openrouter.py` (LLM client), `prompt_builder.py`, `generation.py`, `memory.py`, `config.py`, `lorebook_store.py`, `snippet_store.py`, `state_store.py`.
- Frontend (Reflex): `src/storycraft_frontend/`
  - `storycraft_frontend.py`, `pages/`, `state.py` (`.web/` is generated).
- Tests: `tests/` — backend health, lorebook CRUD, memory, Reflex import/compile.
- Data: `data/` — `lorebook.json`, `story.duckdb`.
- Config: `pyproject.toml`, `rxconfig.py`, `.env` (local only).

## Build, Test, and Development Commands
- Install deps: `uv sync` — syncs Python 3.13 environment.
- Run backend: `uv run uvicorn storycraft.app.main:app --reload --port 8000` — dev server.
- Run frontend: `uv run reflex run` — serves at `http://127.0.0.1:3000`.
- Run tests: `uv run pytest -q` — offline; uses OpenRouter dev stub when no key.
- Lint/format: `uv run ruff check .` • `uv run ruff format .`.

## Coding Style & Naming Conventions
- Python 3.13, 4‑space indents, max line length 100.
- Type hints required; use Pydantic models for I/O schemas.
- Naming: `snake_case` (funcs/vars), `PascalCase` (classes), `UPPER_CASE` (consts).
- FastAPI routes live in `main.py`; IO/config and stores in dedicated modules.
- Reflex components return `rx.Component`; pages in `src/storycraft_frontend/pages/`.

## Testing Guidelines
- Framework: Pytest; name tests `test_*.py` under `tests/`.
- Focus: health endpoint, lorebook CRUD, memory extraction/continuation, Reflex compile.
- Run: `uv run pytest -q`. Keep tests fast, isolated, no network.

## Commit & Pull Request Guidelines
- Commits: use Conventional Commits, e.g.:
  - `feat(backend): add prompt builder and branch generation`
  - `fix(frontend): align generate button`
- PRs: clear summary, steps to verify, screenshots for UI changes, linked issues. Update `README`/`AGENTS.md` when endpoints or config change.

## Security & Configuration Tips
- Env vars prefixed `STORYCRAFT_` (see `config.py`); secrets in `.env` (never commit).
- OpenRouter key: `STORYCRAFT_OPENROUTER_API_KEY`. When unset, `openrouter.py` returns stub responses for development.
- CORS/ports configured via `config.py`.

