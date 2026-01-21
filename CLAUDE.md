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

Storycraft has two main modes:
1. **Fiction Writing Mode**: AI-assisted collaborative fiction writing
2. **Group RPG Adventure Builder**: Multiplayer tabletop RPG with AI game master

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
- `campaigns.py` - Campaign CRUD, player management, game start
- `turns.py` - Action resolution, turn management, dice rolling

**Stores** (injected via FastAPI dependencies):
- `snippet_store.py` - Story content as linked tree (parent_id/child_id)
- `lorebook_store.py` - Lore entries with keyword triggers
- `story_settings_store.py` - Per-story configuration
- `campaign_store.py` - Campaign persistence
- `player_store.py` - Player/character persistence
- `campaign_action_store.py` - Game action history

**Key Modules**:
- `models.py` - All Pydantic request/response models
- `prompt_builder.py` - Constructs multi-section prompts for LLM
- `openrouter.py` - OpenRouter HTTP client (returns stubs when no API key)

### Frontend Structure (`frontend-ts/src/`)

**Stores**:
- `stores/appStore.ts` - Fiction writing state (story, chunks, settings, lorebook)
- `stores/campaignStore.ts` - RPG campaign state (campaign, players, actions, turns)

**Pages** (`app/`):
- `/` - Adventure lobby (campaign list)
- `/campaigns/new` - Create new campaign
- `/campaigns/join` - Join via invite code
- `/campaigns/[id]` - Active game view

**Components**:
- `components/campaign/` - Campaign cards, forms (CreateCampaignForm, JoinCampaignForm, AddPlayerForm)
- `components/rpg/` - Game UI (AdventureView, NarrativeLog, ActionInput, PartyPanel, CharacterCard, DiceResults)
- `components/editor/` - Fiction writing editor
- `components/sidebar/` - Settings panels (context, memory, lorebook, branches)

### RPG Game System

**Two Game Styles**:
- **Narrative** (PbtA-style): 2d6 dice, outcomes are "full success" (10+), "partial success" (7-9), "miss" (6-). Characters have concept + special_trait, no stats.
- **Mechanical** (D&D-style): d20 + modifiers vs difficulty. Characters have attributes, HP, skills.

**Three Tone Settings**: `family_friendly`, `all_ages`, `mature` - affects content guidance in prompts.

**Local Multiplayer**: Multiple players can share the same session token (hot-seat play). Click character cards to switch active player.

### Story Branching Model (Fiction Mode)
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
