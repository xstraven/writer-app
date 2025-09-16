# Repository Guidelines

## Project Structure & Module Organization
- Backend (FastAPI): `src/storycraft/app/`
  - `main.py` (routes), `models.py` (Pydantic), `openrouter.py` (LLM client), `prompt_builder.py`, `generation.py`, `memory.py`, `config.py`, `lorebook_store.py`, `snippet_store.py`, `story_settings_store.py`, `state_store.py`.
- Tests: `tests/` — health, lorebook CRUD, snippets, memory/prompt.
- Data: `data/` — `lorebook.json`, `story.duckdb`.
- Config: `pyproject.toml`, local `.env` (not committed).

## Build, Test, and Development Commands
- Install deps: `uv sync` — creates/syncs the Python 3.13 env.
- Run backend: `uv run uvicorn storycraft.app.main:app --reload --port 8000`.
- Run tests (offline): `uv run pytest -q`.
- Lint/format: `uv run ruff check .` • `uv run ruff format .`.

## Coding Style & Naming Conventions
- Language: Python 3.13; 4-space indent; max line length 100.
- Type hints required; request/response models live in `models.py` (Pydantic).
- Naming: `snake_case` (funcs/vars), `PascalCase` (classes), `UPPER_CASE` (consts).
- FastAPI routes in `main.py`; business/data logic in store modules.
 

## Testing Guidelines
- Framework: Pytest; tests under `tests/` named `test_*.py`.
- Tests must be fast and network-free; OpenRouter calls stub when no key.
- Run with `uv run pytest -q`. Add focused tests alongside the touched feature.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits, e.g. `feat(backend): add prompt builder`, `fix(frontend): align generate button`.
- PRs: clear summary, verification steps, and screenshots for UI changes; link issues; update `README`/`AGENTS.md` when endpoints/config change.

## Security & Configuration Tips
- Env vars are prefixed `STORYCRAFT_` (see `config.py`); store secrets in local `.env` (never commit).
- OpenRouter key: `STORYCRAFT_OPENROUTER_API_KEY`. If unset, development stubs are used in tests.
- CORS/ports configurable via `config.py`.
