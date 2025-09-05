# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

**Backend Development:**
- Run FastAPI backend: `uv run uvicorn storycraft.app.main:app --reload --port 8001`
- Backend health check: `http://127.0.0.1:8001/health`

**Frontend Development:**  
- **Legacy Reflex Frontend**: `STORYCRAFT_API_BASE=http://127.0.0.1:8001 uv run reflex run` (serves at `http://127.0.0.1:3000`)
- **New TypeScript Frontend**: `cd frontend-ts && npm run dev` (serves at `http://127.0.0.1:3001`)
- The `STORYCRAFT_API_BASE` environment variable is critical - it tells the frontend where to find the backend API

**Full Development Setup:**
```bash
uv sync                           # Install dependencies
uv pip install -e .             # Install package in editable mode
# Run backend in one terminal
uv run uvicorn storycraft.app.main:app --reload --port 8001
# Run frontend in another terminal  
STORYCRAFT_API_BASE=http://127.0.0.1:8001 uv run reflex run
```

**Testing & Quality:**
- Run tests: `uv run pytest -q`
- Lint: `uv run ruff check .`
- Format: `uv run ruff format .`

## Architecture Overview

**Dual-Server Architecture:**
- **Backend**: FastAPI server (`storycraft.app`) on port 8001 - handles LLM integration, data persistence, and business logic
- **Frontend**: Reflex server (`storycraft_frontend`) on port 3000 - Python-native web UI that calls the FastAPI backend
- Communication: Frontend makes HTTP requests to backend via `API_BASE` (configured via `STORYCRAFT_API_BASE` env var)

**Story Data Model:**
The app uses a sophisticated branching story structure based on "snippets":
- **Snippet**: Core unit of story content with `{id, story, parent_id, child_id, kind, content, created_at}`
- **Branching**: Each snippet can have multiple children, but only one "active" child at a time
- **Path**: The active story is the path from root through active children to the current head
- **Chunks**: Frontend concept - editable representations of the snippet path

**Key Data Stores:**
- `snippet_store.py`: DuckDB-based storage for story snippets and branching
- `lorebook_store.py`: JSON file storage for character/world lore entries  
- `state_store.py`: JSON persistence for app UI state

## Custom TipTap Integration

**Critical Implementation Detail:**
The app uses a custom TipTap React wrapper (`frontend/tiptap-reflex-wrapper/`) that bridges TipTap editor to Reflex:

- **Two modes**: Value mode (simple text) and Chunks mode (structured story content)
- **Chunk operations**: Split (Cmd/Ctrl+Enter), Merge (Backspace at chunk start)
- **Installation**: Must rebuild and reinstall the wrapper when modified:
  ```bash
  cd frontend/tiptap-reflex-wrapper && npm pack
  cd ../.. && npm install frontend/tiptap-reflex-wrapper/tiptap-reflex-wrapper-0.0.1.tgz
  ```

**Frontend State Architecture:**
- `AppState` in `state.py` manages all UI state and backend communication
- Per-story state snapshots (`_snapshot_state()`, `_apply_snapshot()`) preserve context when switching stories
- Chunk editing system with live sync between TipTap and backend via `chunk_edit_list`

## LLM Integration Architecture

**OpenRouter Integration:**
- `openrouter.py`: Client wrapper for OpenRouter API
- Supports development mode with stubbed responses when `STORYCRAFT_OPENROUTER_API_KEY` is unset
- `prompt_builder.py`: Assembles context (memory, lore, instructions) into LLM prompts

**Generation Flow:**
1. User triggers generation via frontend
2. Frontend calls backend `/api/continue` endpoint  
3. Backend assembles prompt from story context + lorebook + memory
4. Backend calls OpenRouter API
5. Response flows back to frontend and persists as new snippet

**Key Configuration:**
- All config uses `STORYCRAFT_` prefix (see `config.py`)
- `STORYCRAFT_API_BASE`: Frontend→Backend communication (default: `http://127.0.0.1:8000`, should be `8001` in dev)
- `STORYCRAFT_OPENROUTER_API_KEY`: Required for actual LLM calls

## Development Patterns

**Adding New Features:**
1. Define Pydantic models in `models.py` for request/response schemas
2. Add business logic in dedicated modules (e.g., `generation.py`, `memory.py`)  
3. Add FastAPI routes in `main.py`
4. Add frontend state methods in `state.py`
5. Update UI components in `pages/` or `components/`

**State Management:**
- Backend: Stateless FastAPI with data persistence via stores
- Frontend: Reflex state management with `AppState` as single source of truth
- Story switching: State is snapshotted per-story and restored on switch

**Error Handling:**
- Backend: HTTPException for API errors, graceful fallbacks for missing OpenRouter key
- Frontend: Status messages in `AppState.status`, user-visible error states

## Common Gotchas

**Port Configuration:**
- Default ports conflict: Backend defaults to 8000, but Reflex dev server also uses 8000
- Solution: Run backend on 8001, set `STORYCRAFT_API_BASE=http://127.0.0.1:8001`

**TipTap Wrapper Issues:**
- Changes to `frontend/tiptap-reflex-wrapper/index.js` require rebuilding the npm package
- Reflex may cache old versions - clear `.web/` and restart if needed
- Event handling between TipTap and Reflex can be fragile - prefer simple textarea fallbacks for critical functionality

**Story State Persistence:**
- Story data persists in DuckDB (`data/story.duckdb`)
- UI state persists in JSON (`data/base_settings.json`) 
- Lorebook persists separately (`data/lorebook.json`)
- Frontend has ephemeral per-story state that doesn't persist - only the snippet tree persists

## TypeScript Frontend Migration

**New Next.js Frontend** (`frontend-ts/`):
- **Framework**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Key Features Implemented**:
  - ✅ TipTap rich text editor with Cmd+Enter submit functionality
  - ✅ Chunk-based story editing with visual distinction between user and AI content
  - ✅ Real-time state management with Zustand
  - ✅ API integration with React Query for backend communication
  - ✅ Responsive design matching original mockup
  - ✅ TypeScript throughout for type safety
  - ✅ Modern UI components with shadcn/ui
  - ✅ Comprehensive error handling with error boundaries
  - ✅ Toast notifications for user feedback (via Sonner)
  - ✅ Loading states and spinners for better UX
  - ✅ Enhanced error displays with proper formatting

**Development Commands**:
```bash
cd frontend-ts
npm install        # Install dependencies
npm run dev        # Development server (http://localhost:3001)
npm run build      # Production build
npm run start      # Production server
```

**Key Technical Details**:
- **Direct TipTap Integration**: No custom wrapper needed, reliable Cmd+Enter functionality
- **State Management**: Zustand store (`src/stores/appStore.ts`) with proper TypeScript types
- **API Client**: Full TypeScript API client (`src/lib/api.ts`) with all backend endpoints
- **Error Handling**: Error boundaries, toast notifications, loading states throughout
- **SSR Compatibility**: Proper Next.js SSR handling with TipTap (`immediatelyRender: false`)

**Migration Benefits**:
- ✅ Resolved original Cmd+Enter reliability issues
- ✅ Better TypeScript support and development experience  
- ✅ More maintainable codebase with standard React patterns
- ✅ Improved UI/UX with proper loading states and error handling
- ✅ Direct control over editor behavior without wrapper complexity