# Repository Guidelines

## Project Structure & Module Organization
- `src/storycraft/app/`: FastAPI backend (routers in `routes/`, stores in `*_store.py`, services in `services/`).
- `frontend-ts/`: Next.js + React UI (components, hooks, Zustand store).
- `tests/`: Pytest suite for backend APIs and storage.
- `data/`: Local storage defaults and assets (e.g., `data/storycraft.duckdb`, `data/images/`).
- `scripts/`: One-off utilities (e.g., `scripts/setup_supabase.py`).

## Build, Test, and Development Commands
Backend (Python, managed by `uv`):
```bash
uv sync
uv run uvicorn storycraft.app.main:app --reload --port 8000
uv run pytest
uv run ruff check .
uv run ruff format .
```
Frontend (Node):
```bash
cd frontend-ts
npm install
npm run dev
npm run build
npm run lint
```

## Coding Style & Naming Conventions
- Python: 4-space indentation; follow Ruff defaults with `line-length = 100`.
- TypeScript/React: 2-space indentation; prefer `camelCase` for variables and `PascalCase` for components.
- File naming: backend modules are snake_case; frontend components are PascalCase (`StoryEditor.tsx`).

## Testing Guidelines
- Framework: pytest (backend only).
- Test naming: files in `tests/` use `test_*.py`; functions use `test_*`.
- Run all tests with `uv run pytest` or a single test node, e.g. `uv run pytest tests/test_snippets_api.py::test_story_crud`.

## Commit & Pull Request Guidelines
- No strict commit convention; recent commits are short, lowercase, and imperative (e.g., “fix branch generation bug”).
- PRs should include a clear description, test evidence, and UI screenshots when frontend behavior changes.

## Configuration & Security Tips
- Backend uses `STORYCRAFT_*` env vars (see `README.md` for full list).
- Local mode uses DuckDB at `data/storycraft.duckdb`; Supabase requires service key and URL.
- Avoid committing secrets or generated data under `data/`.
