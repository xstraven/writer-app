from __future__ import annotations

import logging
import sys
import traceback

from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)

from ..editor_workflow import run_internal_editor_workflow
from ..memory import continue_story, extract_memory_from_text
from ..models import (
    AppendSnippetRequest,
    BranchInfo,
    BranchPathResponse,
    ChooseActiveChildRequest,
    DeleteSnippetResponse,
    InsertAboveRequest,
    InsertBelowRequest,
    RegenerateAIRequest,
    RegenerateSnippetRequest,
    Snippet,
    TreeResponse,
    TreeRow,
    UpdateSnippetRequest,
    UpsertBranchRequest,
)
from ..services.experimental import internal_editor_enabled
from ..services.prompt_utils import merge_instruction
from ..dependencies import (
    get_lorebook_store,
    get_snippet_store,
    get_story_settings_store,
)
from ..lorebook_store import LorebookStore
from ..snippet_store import SnippetStore
from ..story_settings_store import StorySettingsStore


router = APIRouter()


@router.post("/api/snippets/append", response_model=Snippet)
async def append_snippet(
    req: AppendSnippetRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> Snippet:
    row = snippet_store.create_snippet(
        story=req.story,
        content=req.content,
        kind=req.kind,
        parent_id=req.parent_id,
        set_active=req.set_active,
    )
    if req.set_active is not False:
        branch_name = (req.branch or "main").strip() or "main"
        try:
            snippet_store.upsert_branch(story=req.story, name=branch_name, head_id=row.id)
        except Exception as e:
            logger.error(
                f"Failed to update branch for story '{req.story}': {e}",
                exc_info=True
            )
            raise HTTPException(
                status_code=500,
                detail=f"Snippet created but failed to update branch head: {e}"
            )
    return Snippet(**row.__dict__)


@router.post("/api/snippets/regenerate", response_model=Snippet)
async def regenerate_snippet(
    req: RegenerateSnippetRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> Snippet:
    row = snippet_store.regenerate_snippet(
        story=req.story,
        target_snippet_id=req.target_snippet_id,
        content=req.content,
        kind=req.kind,
        set_active=req.set_active,
    )
    if req.set_active:
        branch_name = (req.branch or "main").strip() or "main"
        try:
            snippet_store.upsert_branch(story=req.story, name=branch_name, head_id=row.id)
        except Exception as e:
            logger.error(
                f"Failed to update branch for story '{req.story}': {e}",
                exc_info=True
            )
            raise HTTPException(
                status_code=500,
                detail=f"Snippet regenerated but failed to update branch head: {e}"
            )
    return Snippet(**row.__dict__)


@router.post("/api/snippets/choose-active", response_model=dict)
async def choose_active_child(
    req: ChooseActiveChildRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> dict:
    snippet_store.choose_active_child(
        story=req.story, parent_id=req.parent_id, child_id=req.child_id
    )
    branch_name = (req.branch or "main").strip() or "main"
    try:
        snippet_store.upsert_branch(story=req.story, name=branch_name, head_id=req.child_id)
    except Exception as e:
        logger.error(
            f"Failed to update branch for story '{req.story}': {e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail=f"Active child set but failed to update branch head: {e}"
        )
    return {"ok": True}


@router.post("/api/snippets/regenerate-ai", response_model=Snippet)
async def regenerate_ai(
    req: RegenerateAIRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
) -> Snippet:
    target = snippet_store.get(req.target_snippet_id)
    if not target or target.story != req.story:
        raise HTTPException(status_code=404, detail="Target snippet not found")
    parent_id = target.parent_id
    if parent_id:
        base_path = snippet_store.path_from_head(req.story, parent_id)
    else:
        base_path = []
    base_text = snippet_store.build_text(base_path)
    try:
        win = int(getattr(req, "max_context_window", 0) or 0)
        if win > 0 and len(base_text) > win * 3:
            base_text = base_text[-(win * 3) :]
    except Exception:
        pass

    # Get adjacent chunks for context (helps LLM stitch text smoothly)
    preceding_text = ""
    following_text = ""
    # Chunk above: the immediate parent's content
    if parent_id:
        parent_snippet = snippet_store.get(parent_id)
        if parent_snippet:
            preceding_text = parent_snippet.content or ""
    # Chunk below: the active child's content (if exists)
    if target.child_id:
        child_snippet = snippet_store.get(target.child_id)
        if child_snippet:
            following_text = child_snippet.content or ""

    mem = None
    if req.use_memory and base_text.strip():
        mem = await extract_memory_from_text(text=base_text, model=req.model)

    lore_items = None
    if getattr(req, "lore_ids", None):
        lore_items = []
        for _id in req.lore_ids or []:
            entry = lore_store.get(_id)
            if entry:
                lore_items.append(entry)

    merged_instruction = merge_instruction(req.instruction, req.story, story_settings_store) or ""
    generation_kwargs = {
        "draft_text": base_text,
        "instruction": merged_instruction,
        "mem": mem,
        "context": (req.context if req.use_context else None),
        "model": req.model,
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
        "history_text": base_text,
        "lore_items": lore_items,
        "preceding_text": preceding_text,
        "following_text": following_text,
    }

    use_internal_editor = internal_editor_enabled(req.story, story_settings_store)

    try:
        if use_internal_editor:
            result = await run_internal_editor_workflow(
                generation_kwargs=generation_kwargs,
                user_instruction=req.instruction or "",
                story_so_far=base_text,
                draft_segment=base_text,
                judge_model=req.model,
            )
        else:
            result = await continue_story(**generation_kwargs)
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(status_code=502, detail=f"Regeneration failed: {e}")

    row = snippet_store.regenerate_snippet(
        story=req.story,
        target_snippet_id=req.target_snippet_id,
        content=result.get("continuation", ""),
        kind="ai",
        set_active=req.set_active,
    )
    if req.set_active:
        branch_name = (req.branch or "main").strip() or "main"
        try:
            snippet_store.upsert_branch(story=req.story, name=branch_name, head_id=row.id)
        except Exception as e:
            logger.error(
                f"Failed to update branch for story '{req.story}': {e}",
                exc_info=True
            )
            raise HTTPException(
                status_code=500,
                detail=f"AI regeneration succeeded but failed to update branch head: {e}"
            )
    return Snippet(**row.__dict__)


@router.post("/api/snippets/insert-above", response_model=Snippet)
async def insert_above(
    req: InsertAboveRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> Snippet:
    try:
        row = snippet_store.insert_above(
            story=req.story,
            target_snippet_id=req.target_snippet_id,
            content=req.content,
            kind=req.kind,
            set_active=req.set_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Snippet(**row.__dict__)


@router.post("/api/snippets/insert-below", response_model=Snippet)
async def insert_below(
    req: InsertBelowRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> Snippet:
    branch_name = (req.branch or "main").strip() or "main"
    parent_was_head = False
    try:
        branches = snippet_store.list_branches(req.story)
        parent_was_head = any(b[1] == branch_name and b[2] == req.parent_snippet_id for b in branches)
    except Exception:
        parent_was_head = False
    try:
        row = snippet_store.insert_below(
            story=req.story,
            parent_snippet_id=req.parent_snippet_id,
            content=req.content,
            kind=req.kind,
            set_active=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    if parent_was_head:
        try:
            snippet_store.upsert_branch(
                story=req.story,
                name=branch_name,
                head_id=row.id,
            )
        except Exception as e:
            logger.error(
                f"Failed to update branch for story '{req.story}': {e}",
                exc_info=True
            )
            raise HTTPException(
                status_code=500,
                detail=f"Snippet inserted but failed to update branch head: {e}"
            )
    return Snippet(**row.__dict__)


@router.put("/api/snippets/{snippet_id}", response_model=Snippet)
async def update_snippet(
    snippet_id: str,
    patch: UpdateSnippetRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> Snippet:
    row = snippet_store.update_snippet(
        snippet_id=snippet_id, content=patch.content, kind=patch.kind
    )
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return Snippet(**row.__dict__)


# POST endpoint mirrors PUT for sendBeacon compatibility (sendBeacon can only POST)
@router.post("/api/snippets/{snippet_id}/update", response_model=Snippet)
async def update_snippet_post(
    snippet_id: str,
    patch: UpdateSnippetRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> Snippet:
    row = snippet_store.update_snippet(
        snippet_id=snippet_id, content=patch.content, kind=patch.kind
    )
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return Snippet(**row.__dict__)


@router.delete("/api/snippets/{snippet_id}", response_model=DeleteSnippetResponse)
async def delete_snippet(
    snippet_id: str,
    story: str | None = None,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> DeleteSnippetResponse:
    row = snippet_store.get(snippet_id)
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    if story is not None and story.strip() and row.story != story.strip():
        raise HTTPException(status_code=400, detail="Snippet belongs to a different story")
    try:
        ok = snippet_store.delete_snippet(story=row.story, snippet_id=snippet_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return DeleteSnippetResponse(ok=True)


@router.get("/api/snippets/children/{parent_id}", response_model=list[Snippet])
async def get_children(
    story: str,
    parent_id: str,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> list[Snippet]:
    items = snippet_store.list_children(story, parent_id)
    return [Snippet(**it.__dict__) for it in items]


@router.get("/api/snippets/path", response_model=BranchPathResponse)
async def get_branch_path(
    story: str,
    branch: str | None = None,
    head_id: str | None = None,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> BranchPathResponse:
    path = []
    if head_id:
        path = snippet_store.path_from_head(story, head_id)
    elif branch and branch.strip() and branch.strip().lower() != "main":
        branches = snippet_store.list_branches(story)
        found = next((b for b in branches if b[1] == branch), None)
        if not found:
            raise HTTPException(status_code=404, detail="Branch not found")
        path = snippet_store.path_from_head(story, found[2])
    else:
        try:
            branches = snippet_store.list_branches(story)
            main_branch = next((b for b in branches if b[1] == "main"), None)
        except Exception:
            main_branch = None
        if main_branch:
            # Validate branch head integrity
            validation = snippet_store.validate_branch_head(story, main_branch[2])

            if not validation["valid"]:
                logger.warning(
                    f"Corrupted main branch detected for story '{story}': "
                    f"{validation['reason']}. Attempting repair..."
                )

                # Attempt auto-repair
                repaired_head = snippet_store.repair_branch_head(story, "main")

                if repaired_head:
                    logger.info(f"Successfully repaired main branch for story '{story}'")
                    path = snippet_store.path_from_head(story, repaired_head)
                else:
                    # Fallback to main_path if repair fails
                    logger.warning(f"Repair failed, using main_path fallback for story '{story}'")
                    path = snippet_store.main_path(story)
            else:
                path = snippet_store.path_from_head(story, main_branch[2])
        else:
            path = snippet_store.main_path(story)

    text = snippet_store.build_text(path)
    out_head_id = path[-1].id if path else None
    return BranchPathResponse(
        story=story,
        head_id=out_head_id,
        path=[Snippet(**p.__dict__) for p in path],
        text=text,
    )


@router.get("/api/snippets/tree-main", response_model=TreeResponse)
async def get_tree_for_main_path(
    story: str,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> TreeResponse:
    path = snippet_store.main_path(story)
    rows: list[TreeRow] = []
    for parent in path:
        children = snippet_store.list_children(story, parent.id)
        rows.append(
            TreeRow(parent=Snippet(**parent.__dict__), children=[Snippet(**c.__dict__) for c in children])
        )
    return TreeResponse(story=story, rows=rows)


@router.get("/api/branches", response_model=list[BranchInfo])
async def list_branches(
    story: str,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> list[BranchInfo]:
    rows = snippet_store.list_branches(story)
    out: list[BranchInfo] = []
    for r in rows:
        out.append(BranchInfo(story=r[0], name=r[1], head_id=r[2], created_at=r[3]))
    return out


@router.post("/api/branches", response_model=dict)
async def upsert_branch(
    req: UpsertBranchRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> dict:
    snippet = snippet_store.get(req.head_id)
    if not snippet or snippet.story != req.story:
        raise HTTPException(status_code=404, detail="head_id not found for story")
    snippet_store.upsert_branch(story=req.story, name=req.name, head_id=req.head_id)
    return {"ok": True}


@router.delete("/api/branches/{name}", response_model=dict)
async def delete_branch(
    name: str,
    story: str,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> dict:
    snippet_store.delete_branch(story=story, name=name)
    return {"ok": True}


@router.get("/api/branches/health", response_model=dict)
async def check_branch_health(
    story: str,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> dict:
    """
    Check integrity of all branches for a story.
    Returns health status and any issues found.
    """
    branches = snippet_store.list_branches(story)
    results = {}

    for branch_row in branches:
        name = branch_row[1]
        head_id = branch_row[2]
        validation = snippet_store.validate_branch_head(story, head_id)
        results[name] = validation

    all_valid = all(r["valid"] for r in results.values())

    return {
        "story": story,
        "healthy": all_valid,
        "branches": results,
    }


@router.get("/api/snippets/{snippet_id}", response_model=Snippet)
async def get_snippet(
    snippet_id: str,
    story: str,
    snippet_store: SnippetStore = Depends(get_snippet_store),
) -> Snippet:
    row = snippet_store.get(snippet_id)
    if not row or row.story != story:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return Snippet(**row.__dict__)
