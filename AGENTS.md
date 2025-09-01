# Repository Guidelines

## Project Structure & Module Organization
- `app/`: FastAPI backend — `main.py` (routes), `models.py` (Pydantic), `memory.py`, `openrouter.py`, `config.py`, `lorebook_store.py`.
- `storycraft_frontend/`: Reflex UI — `storycraft_frontend.py`, `pages/`, `state.py`.
- `tests/`: Pytest tests — e.g., `test_backend_starts.py`, `test_reflex_imports.py`.
- `data/`: App data — e.g., `lorebook.json`.
- `rxconfig.py`, `pyproject.toml`: Reflex/project config. Note: `.web/` is generated.

## Build, Test, and Development Commands
- Install deps: `uv sync` (requires Python 3.13).
- Run backend: `uv run uvicorn app.main:app --reload --port 8000`.
- Run frontend: `uv run reflex run` (serves at `http://127.0.0.1:3000`).
- Run tests: `uv run pytest -q` (fast, isolated unit tests).
- Lint: `uv run ruff check .` • Format: `uv run ruff format .`.

## Coding Style & Naming Conventions
- Python 3.13, 4‑space indents, max line length 100 (ruff).
- Use type hints throughout; Pydantic models for request/response schemas.
- Naming: `snake_case` (functions/variables), `PascalCase` (classes), `UPPER_CASE` (constants).
- FastAPI: group routes in `app/main.py`; keep IO/config in dedicated modules.
- Reflex: component functions return `rx.Component`; pages live in `storycraft_frontend/pages/`.

## Testing Guidelines
- Framework: Pytest; place tests under `tests/` as `test_*.py`.
- Coverage focus: health endpoint, lorebook CRUD, memory extraction/continuation, Reflex compile.
- Command: `uv run pytest -q`. Tests should not require network access.

## Commit & Pull Request Guidelines
- Use Conventional Commits (keep history minimal), e.g.:
  - `feat(backend): add memory continuation endpoint`
  - `fix(frontend): align generate button`
- PRs include: clear summary, steps to verify, screenshots for UI changes, linked issues. Update README if endpoints/config change.

## Security & Configuration Tips
- Env vars use `STORYCRAFT_` prefix (see `app/config.py`). Use a local `.env`; never commit secrets.
- OpenRouter key is optional for dev; without it, stubs are returned.
- CORS and ports are configured in `config.py`.

