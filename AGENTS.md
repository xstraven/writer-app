# Repository Guidelines

## Project Structure & Module Organization
- `app/`: FastAPI backend (`main.py`, `models.py`, `memory.py`, `openrouter.py`, `config.py`, `lorebook_store.py`).
- `storycraft_frontend/`: Reflex UI (`storycraft_frontend.py`, `pages/`, `state.py`).
- `tests/`: Pytest tests (e.g., `test_backend_starts.py`, `test_reflex_imports.py`).
- `data/`: App data (e.g., `lorebook.json`).
- `rxconfig.py`, `pyproject.toml`: Reflex and project configuration. Note: `.web/` is generated.

## Build, Test, and Development Commands
- Install deps: `uv sync` (requires Python 3.13; see README for uv install).
- Run backend: `uv run uvicorn app.main:app --reload --port 8000`.
- Run frontend: `uv run reflex run` (opens on `http://127.0.0.1:3000`).
- Run tests: `uv run pytest -q`.
- Lint: `uv run ruff check .`  •  Format: `uv run ruff format .`.

## Coding Style & Naming Conventions
- Python 3.13, 4‑space indents, max line length 100 (ruff).
- Use type hints and Pydantic models for request/response data.
- Naming: `snake_case` for functions/vars, `PascalCase` for classes, `UPPER_CASE` for constants.
- FastAPI: group routes in `app/main.py`; keep IO and config in dedicated modules.
- Reflex: component functions return `rx.Component`; pages live under `storycraft_frontend/pages/`.

## Testing Guidelines
- Framework: Pytest. Place tests in `tests/` named `test_*.py`.
- Cover: health endpoint, lorebook CRUD, memory extraction/continuation, and Reflex compile.
- Quick run: `uv run pytest -q`; focus tests should be fast and isolated (no network).

## Commit & Pull Request Guidelines
- History is minimal; use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Scope tags encouraged: `feat(backend): ...`, `fix(frontend): ...`.
- PRs: include summary, screenshots of UI changes, steps to verify, and linked issues. Update README if endpoints/config change.

## Security & Configuration Tips
- Env prefix: `STORYCRAFT_` (see `app/config.py`). Use `.env` locally; do not commit secrets.
- OpenRouter key optional for dev; without it, stubs are returned. CORS and ports are configured in `config.py`.
