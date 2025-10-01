# Repository Guidelines

## Project Structure & Module Organization
- **Backend**: FastAPI app lives in `src/storycraft/app/`. Domain routers sit under `routes/`, shared helpers under `services/`, and runtime singletons remain in `runtime.py`.
- **Frontend**: Next.js client resides in `frontend-ts/` with React components in `src/components/`, Zustand stores in `src/stores/`, and shared utilities in `src/lib/`.
- **Tests**: Backend pytest suites are in `tests/`. Frontend tests are currently manual; add colocated `*.test.tsx` when introducing automated coverage.
- **Data & configs**: Seed data lives in `data/`, Python tooling is declared in `pyproject.toml`, and Node tooling in `frontend-ts/package.json`.

## Build, Test, and Development Commands
- `uv sync` — install Python dependencies and create the 3.13 virtual environment.
- `uv run uvicorn storycraft.app.main:app --reload --port 8000` — launch the FastAPI server locally.
- `uv run pytest -q` — execute backend unit and integration tests.
- `npm install` (inside `frontend-ts/`) — install Node dependencies.
- `npm run dev` — start the Next.js development server on port 3000.
- `uv run ruff check .` / `uv run ruff format .` — lint or auto-format the Python codebase.

## Coding Style & Naming Conventions
- Python: 4-space indentation, max line length 100, type hints required. Keep business logic in stores/services, routes thin.
- TypeScript/React: follow ESLint defaults, prefer functional components and hooks. Co-locate styles via Tailwind utility classes.
- Naming: snake_case for functions/vars, PascalCase for classes and React components, UPPER_CASE for constants.

## Testing Guidelines
- Use Pytest with async-aware tests where needed. Name files `test_*.py` and structure fixtures in `conftest.py` if shared.
- Ensure LLM-dependent tests rely on stubbed OpenRouter responses (no network calls). Run `uv run pytest -q` before every PR.
- Add targeted frontend tests (Jest/Testing Library) for new UI logic when feasible.

## Commit & Pull Request Guidelines
- Write Conventional Commits (e.g., `feat(backend): add snippet router`, `fix(frontend): persist context summary`).
- PRs should include a concise summary, verification steps (tests run, manual QA), and linked issues. Attach screenshots or clips for UI changes.
- Keep diffs focused; refactors belong in dedicated PRs.

## Security & Configuration Tips
- Environment variables must be prefixed `STORYCRAFT_` and defined in a local `.env` that is never committed.
- The OpenRouter API key is optional in development; stubs provide deterministic outputs when unset.
- Validate CORS origins in `config.py` before deploying to new environments.
