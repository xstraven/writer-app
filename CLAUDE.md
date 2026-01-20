# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Python/FastAPI)
```bash
uv sync                                                    # Install dependencies
uv run uvicorn storycraft.app.main:app --reload --port 8000  # Run API server
uv run pytest -q                                           # Run all tests (uses in-memory storage)
uv run pytest tests/test_generation.py -q                  # Run specific test file
uv run ruff check .                                        # Lint
uv run ruff format .                                       # Format
```

### Frontend (Next.js/TypeScript)
```bash
cd frontend-ts
npm install        # Install dependencies
npm run dev        # Run dev server (port 3000)
npm run build      # Production build
npm run lint       # Lint
```

## Architecture

Storycraft is an AI-assisted fiction writing app with a FastAPI backend and Next.js frontend.

### Data Flow
```
Frontend (React + Zustand) → API calls (axios) → FastAPI → OpenRouter LLM
                                                    ↓
                                        DuckDB (local) or Supabase (cloud)
```

### Backend Structure (`src/storycraft/app/`)

**Routes** (`routes/`):
- `generation.py` - LLM continuation, story seeding, lorebook generation, memory extraction
- `snippets.py` - Story text chunks, branching operations
- `stories.py` - Story CRUD
- `lorebook.py` - Lore entries (characters, locations, items)
- `story_settings.py` - Per-story settings

**Stores** (injected via FastAPI dependencies):
- `snippet_store.py` - Story content as linked tree (parent_id/child_id)
- `lorebook_store.py` - Lore entries with keyword triggers
- `story_settings_store.py` - Per-story configuration

**Key Modules**:
- `models.py` - All Pydantic request/response models
- `prompt_builder.py` - Constructs multi-section prompts for LLM
- `openrouter.py` - OpenRouter HTTP client (returns stubs when no API key)
- `editor_workflow.py` - Experimental: generates 4 candidates, LLM picks best

### Frontend Structure (`frontend-ts/src/`)
- `stores/appStore.ts` - Zustand global state (story, chunks, settings, lorebook)
- `lib/api.ts` - Axios client with all API calls
- `lib/types.ts` - TypeScript interfaces matching backend models
- `components/sidebar/` - Settings panels (context, memory, lorebook, branches)

### Story Branching Model
- **Snippet**: Individual text chunk (user or AI-generated)
- **Tree Structure**: Snippets linked via `parent_id`/`child_id` forming branches
- **Branch**: Named pointer to a snippet (head_id), default is "main"
- **Path**: Active branch reconstructed by following `child_id` links

### Prompt Construction (PromptBuilder)
Messages sent to LLM follow this structure:
1. System message (configurable)
2. `[Story]` section (draft/history text)
3. Meta section: `[Story Description]`, `[Context]`, `[Lorebook]`, `[Memory]`
4. `[Task]` section (user instruction) - always last

### Lorebook Auto-Inclusion
- Entries have `keys` array for keyword triggers (case-insensitive substring match)
- `always_on` entries included in every prompt
- Selection uses last 4000 chars of story text for matching

### Database Auto-Selection
- **Local (DuckDB)**: Used when Supabase credentials absent → `./data/storycraft.duckdb`
- **Cloud (Supabase)**: Used when `STORYCRAFT_SUPABASE_URL` and `STORYCRAFT_SUPABASE_SERVICE_KEY` set

## Environment Variables

Backend (prefix `STORYCRAFT_`):
- `STORYCRAFT_OPENROUTER_API_KEY` - OpenRouter key (omit for stub responses)
- `STORYCRAFT_OPENROUTER_DEFAULT_MODEL` - Default model (default: `deepseek/deepseek-chat-v3-0324`)
- `STORYCRAFT_SUPABASE_URL` / `STORYCRAFT_SUPABASE_SERVICE_KEY` - For cloud mode
- `STORYCRAFT_DUCKDB_PATH` - Local DB path (default: `./data/storycraft.duckdb`)

Frontend:
- `NEXT_PUBLIC_STORYCRAFT_API_BASE` - Backend URL (default: `http://localhost:8000`)
