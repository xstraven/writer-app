from __future__ import annotations

import os
import reflex as rx

from ..state import AppState
from ..components.tiptap_editor import tiptap_editor

DEBUG_TIPTAP = os.getenv("STORYCRAFT_DEBUG_TIPTAP", "0").lower() in ("1", "true", "yes", "on")


 

def memory_panel() -> rx.Component:
    return rx.box(
        rx.heading("Memory", size="5", mb=2),
        rx.divider(),
        rx.vstack(
            rx.box(
                rx.text("Characters", weight="bold"),
                rx.unordered_list(
                    rx.foreach(
                        AppState.memory.characters,
                        lambda it: rx.list_item(rx.text(f"{it.label}: {it.detail}")),
                    )
                ),
                mb=3,
            ),
            rx.box(
                rx.text("Subplots", weight="bold"),
                rx.unordered_list(
                    rx.foreach(
                        AppState.memory.subplots,
                        lambda it: rx.list_item(rx.text(f"{it.label}: {it.detail}")),
                    )
                ),
                mb=3,
            ),
            rx.box(
                rx.text("Facts", weight="bold"),
                rx.unordered_list(
                    rx.foreach(
                        AppState.memory.facts,
                        lambda it: rx.list_item(rx.text(f"{it.label}: {it.detail}")),
                    )
                ),
            ),
            align_items="stretch",
            spacing="2",
        ),
        p=3,
        border="1px solid",
        border_color="gray.200",
        border_radius="8px",
    )


def context_panel() -> rx.Component:
    return rx.box(
        rx.hstack(
            rx.heading("Context", size="5"),
            rx.spacer(),
            rx.switch(
                checked=AppState.include_context,
                on_change=AppState.set_include_context,
                label="Include",
            ),
        ),
        rx.divider(),
        rx.vstack(
            rx.box(
                rx.text("Scene Summary", weight="bold"),
                tiptap_editor(
                    value=AppState.context.summary,  # type: ignore[arg-type]
                    placeholder="Short summary of the current scene...",
                    min_height="100px",
                    on_change=AppState.set_context_summary,
                ),
                mb=3,
            ),
            rx.hstack(
                rx.button("Auto-generate from draft", on_click=AppState.suggest_context, size="2"),
                rx.button("Clear", on_click=AppState.clear_context, size="2", color_scheme="gray"),
                justify="start",
            ),
            rx.box(
                rx.text("NPCs", weight="bold"),
                rx.unordered_list(
                    rx.foreach(
                        AppState.context.npcs,
                        lambda it: rx.list_item(
                            rx.hstack(
                                rx.text(f"{it.label}: {it.detail}"),
                                rx.spacer(),
                                rx.button("Remove", size="1", on_click=lambda: AppState.remove_npc(it.label)),
                            )
                        ),
                    )
                ),
                rx.hstack(
                    rx.input(placeholder="Name", value=AppState.new_npc_label, on_change=AppState.set_new_npc_label),
                    rx.input(placeholder="Detail", value=AppState.new_npc_detail, on_change=AppState.set_new_npc_detail),
                    rx.button("Add", size="1", on_click=AppState.add_npc_from_inputs),
                ),
                mb=3,
            ),
            rx.box(
                rx.text("Objects", weight="bold"),
                rx.unordered_list(
                    rx.foreach(
                        AppState.context.objects,
                        lambda it: rx.list_item(
                            rx.hstack(
                                rx.text(f"{it.label}: {it.detail}"),
                                rx.spacer(),
                                rx.button("Remove", size="1", on_click=lambda: AppState.remove_object(it.label)),
                            )
                        ),
                    )
                ),
                rx.hstack(
                    rx.input(placeholder="Name", value=AppState.new_object_label, on_change=AppState.set_new_object_label),
                    rx.input(placeholder="Detail", value=AppState.new_object_detail, on_change=AppState.set_new_object_detail),
                    rx.button("Add", size="1", on_click=AppState.add_object_from_inputs),
                ),
            ),
            spacing="2",
            align_items="stretch",
        ),
        p=3,
        border="1px solid",
        border_color="gray.200",
        border_radius="8px",
    )


def lorebook_panel() -> rx.Component:
    return rx.box(
        rx.hstack(
            rx.heading("Lorebook", size="5"),
            rx.button("Refresh", on_click=AppState.load_lore, size="2"),
            justify="between",
            mb=2,
        ),
        rx.divider(),
        rx.vstack(
            rx.foreach(
                AppState.lore,
                lambda e: rx.box(
                    rx.hstack(
                        rx.text(f"{e.name} · {e.kind}", weight="bold"),
                        rx.spacer(),
                        rx.switch(
                            checked=e.always_on,
                            on_change=lambda v, eid=e.id: AppState.set_lore_always_on(eid, v),
                            label="Always",
                            size="1",
                        ),
                        rx.button(
                            "Use",
                            size="1",
                            on_click=lambda _=None, eid=e.id: AppState.toggle_lore_selection(eid),
                        ),
                        rx.button(
                            "Delete",
                            color_scheme="red",
                            size="1",
                            on_click=lambda: AppState.delete_lore(e.id),
                        ),
                    ),
                    rx.hstack(
                        rx.input(
                            placeholder="keys (comma-separated)",
                            value=AppState.lore_keys_input[e.id],
                            on_change=lambda v, eid=e.id: AppState.set_lore_keys_input(eid, v),
                            width="60%",
                        ),
                        rx.button(
                            "Save Keys",
                            size="1",
                            on_click=lambda _=None, eid=e.id: AppState.save_lore_keys(eid),
                        ),
                        justify="end",
                    ),
                    rx.text(e.summary),
                    p=2,
                    border="1px solid",
                    border_color="#2a2f3a",
                    border_radius="6px",
                ),
            ),
            spacing="2",
            align_items="stretch",
            mb=3,
        ),
        rx.box(
            rx.text("Add new"),
            rx.hstack(
                rx.input(
                    placeholder="Name",
                    value=AppState.new_lore_name,
                    on_change=AppState.set_new_lore_name,
                ),
                rx.input(
                    placeholder="Kind",
                    width="120px",
                    value=AppState.new_lore_kind,
                    on_change=AppState.set_new_lore_kind,
                ),
            ),
            tiptap_editor(
                value=AppState.new_lore_summary,  # type: ignore[arg-type]
                placeholder="Summary",
                min_height="100px",
                on_change=AppState.set_new_lore_summary,
            ),
            rx.button("Add", on_click=AppState.submit_new_lore),
        ),
        p=3,
        border="1px solid",
        border_color="#374151",
        border_radius="8px",
    )


def top_menu() -> rx.Component:
    return rx.box(
        rx.hstack(
            rx.heading("Storycraft", size="7"),
            rx.spacer(),
            rx.text("Story:"),
            rx.select(
                AppState.story_options,
                value=AppState.current_story,
                on_change=AppState.switch_story,
                width="220px",
            ),
            rx.button("New Story", on_click=AppState.create_story, size="2", color_scheme="purple", variant="soft"),
            rx.divider(orientation="vertical", mx=2),
            rx.button("Story & Lore", variant="soft", color_scheme="purple", on_click=AppState.open_meta_panel, size="2"),
            rx.button("Branches", variant="soft", color_scheme="purple", on_click=AppState.open_branches, size="2"),
            rx.button("Settings", variant="soft", color_scheme="purple", on_click=AppState.open_settings, size="2"),
            rx.spacer(),
            rx.badge(
                rx.cond(AppState.backend_ok, "API: OK", "API: ERR"),
                color_scheme=rx.cond(AppState.backend_ok, "green", "red"),
            ),
            rx.tooltip(rx.icon("info"), content=AppState.backend_msg),
            align="center",
            py=3,
        ),
        class_name="app-topbar",
        px=4,
    )


def generation_settings_panel() -> rx.Component:
    return rx.box(
        rx.hstack(rx.heading("Generation Settings", size="5")),
        rx.divider(),
        rx.vstack(
            rx.hstack(
                rx.text("Model"),
                rx.input(value=AppState.model, on_change=AppState.set_model, width="220px"),
            ),
            rx.hstack(
                rx.text("Temperature"),
                rx.input(type="number", value=AppState.temperature, on_change=AppState.update_temperature, step=0.1, width="110px"),
            ),
            rx.hstack(
                rx.text("Max tokens"),
                rx.input(type="number", value=AppState.max_tokens, on_change=AppState.update_max_tokens, step=64, width="110px"),
            ),
            rx.box(
                rx.text("System Prompt", weight="bold"),
                tiptap_editor(
                    value=AppState.system_prompt,  # type: ignore[arg-type]
                    on_change=AppState.set_system_prompt,
                    min_height="120px",
                    placeholder="Guide the model's style, voice, and constraints...",
                ),
            ),
            rx.hstack(
                rx.text("Include memory"),
                rx.switch(checked=AppState.include_memory, on_change=AppState.set_include_memory),
                width="100%",
                justify="between",
            ),
            rx.hstack(
                rx.text("Include context"),
                rx.switch(checked=AppState.include_context, on_change=AppState.set_include_context),
                width="100%",
                justify="between",
            ),
            spacing="2",
            align_items="stretch",
        ),
        p=3,
        border="1px solid",
        border_color="#374151",
        border_radius="8px",
    )


def sidebar() -> rx.Component:
    return rx.vstack(
        # Generation settings moved to drawer; keep sidebar lean

        # Meta & Lore moved to panel; keep sidebar minimal

        spacing="4",
        align_items="stretch",
        width="360px",
        min_width="300px",
    )


def branches_panel() -> rx.Component:
    return rx.box(
        rx.hstack(rx.heading("Branch Choices", size="5")),
        rx.text(
            rx.cond(
                AppState.last_parent_id.is_none(),
                "No branching available yet",
                "Alternatives for latest parent",
            )
        ),
        rx.cond(
            AppState.last_parent_id.is_none(),
            rx.box(),
            rx.vstack(
                rx.foreach(
                    AppState.last_parent_children,
                    lambda it: rx.box(
                        rx.hstack(
                            rx.text(
                                rx.cond(
                                    it.id == AppState.last_parent_active_child_id,
                                    "•",
                                    "○",
                                ),
                                width="12px",
                            ),
                            rx.text(f"{it.kind}: {it.content[:80]}"),
                            rx.spacer(),
                            rx.button(
                                "Activate",
                                size="1",
                                on_click=lambda it=it: AppState.choose_active_child(it.id),
                            ),
                        ),
                        p=2,
                        border="1px solid",
                        border_color="#2a2f3a",
                        border_radius="6px",
                    ),
                ),
                spacing="2",
                align_items="stretch",
            ),
        ),
        rx.box(
            rx.hstack(rx.heading("Main Path Tree", size="5")),
            rx.text("Parents with all children; activate any branch."),
            rx.vstack(
                rx.foreach(
                    AppState.tree_rows,
                    lambda row: rx.box(
                        rx.text(f"Parent: {row.parent.kind.upper()} • {row.parent.id[:8]}"),
                        rx.unordered_list(
                            rx.foreach(
                                row.children,
                                lambda c: rx.list_item(
                                    rx.hstack(
                                        rx.text(
                                            rx.cond(
                                                row.parent.child_id == c.id,
                                                "•",
                                                "○",
                                            ),
                                            width="12px",
                                        ),
                                        rx.text(f"{c.kind}: {c.content[:80]}"),
                                        rx.spacer(),
                                        rx.button(
                                            "Activate",
                                            size="1",
                                            on_click=lambda cid=c.id: AppState.choose_active_child(cid),
                                        ),
                                    )
                                ),
                            )
                        ),
                        p=2,
                        border="1px solid",
                        border_color="#2a2f3a",
                        border_radius="6px",
                    ),
                ),
                spacing="3",
                align_items="stretch",
            ),
            p=2,
            border="1px solid",
            border_color="#374151",
            border_radius="8px",
            mt=3,
        ),
        rx.box(
            rx.hstack(rx.heading("Branches", size="5")),
            rx.hstack(
                rx.input(
                    placeholder="Branch name",
                    value=AppState.branch_name_input,
                    on_change=AppState.set_branch_name_input,
                    width="240px",
                ),
                rx.button("Save current head", size="2", on_click=AppState.save_branch),
            ),
            rx.vstack(
                rx.foreach(
                    AppState.branches,
                    lambda b: rx.box(
                        rx.hstack(
                            rx.text(b.name),
                            rx.text(f"{b.head_id[:8]}", color="gray"),
                            rx.spacer(),
                            rx.button("Switch", size="1", on_click=lambda name=b.name: AppState.switch_branch(name)),
                            rx.button("Delete", size="1", color_scheme="red", on_click=lambda name=b.name: AppState.delete_branch(name)),
                        ),
                        p=2,
                        border="1px solid",
                        border_color="#2a2f3a",
                        border_radius="6px",
                    ),
                ),
                spacing="2",
                align_items="stretch",
            ),
            p=2,
            border="1px solid",
            border_color="#374151",
            border_radius="8px",
            mt=3,
        ),
        p=2,
    )


def lorebook_overlay() -> rx.Component:
    return rx.cond(
        AppState.show_lorebook,
        rx.box(
            rx.center(
                rx.box(
                    rx.hstack(
                        rx.heading("Lorebook", size="6"),
                        rx.spacer(),
                        rx.button("Close", on_click=AppState.close_lorebook, size="2", color_scheme="gray"),
                        mb=2,
                    ),
                    rx.scroll_area(
                        lorebook_panel(),
                        type="always",
                        scrollbars="vertical",
                        style={"height": "70vh"},
                    ),
                    p=4,
                    class_name="panel-dark",
                    bg="#0f131a",
                    color="#e5e7eb",
                    width=["95vw", "90vw", "900px"],
                    border_radius="10px",
                    box_shadow="lg",
                    border="1px solid",
                    border_color="#1f2937",
                )
            ),
            # Backdrop
            position="fixed",
            top="0",
            left="0",
            right="0",
            bottom="0",
            bg="rgba(0,0,0,0.6)",
            z_index=1000,
        ),
        None,
    )

def meta_lore_panel() -> rx.Component:
    return rx.box(
        rx.box(
            rx.hstack(rx.heading("Story Meta", size="5")),
            rx.divider(),
            rx.text("Story Description"),
            tiptap_editor(
                value=AppState.context.summary,  # type: ignore[arg-type]
                placeholder="What is this story about?",
                min_height="120px",
                on_change=AppState.set_context_summary,
            ),
            rx.hstack(
                rx.button("Suggest from draft", size="2", on_click=AppState.suggest_context),
                rx.button("Clear", size="2", color_scheme="gray", on_click=AppState.clear_context),
                justify="start",
            ),
            p=3,
            border="1px solid",
            border_color="gray.200",
            border_radius="8px",
            mb=3,
        ),
        rx.box(
            rx.hstack(rx.heading("Lorebook", size="5"), justify="between"),
            rx.divider(),
            lorebook_panel(),
            p=0,
            border="none",
        ),
    )

def branches_overlay() -> rx.Component:
    return rx.cond(
        AppState.show_branches,
        rx.box(
            # Drawer panel
            rx.box(
                rx.hstack(
                    rx.heading("Branches", size="6"),
                    rx.spacer(),
                    rx.button("Close", on_click=AppState.close_branches, size="2", variant="soft"),
                    mb=2,
                ),
                rx.scroll_area(
                    branches_panel(),
                    type="always",
                    scrollbars="vertical",
                    style={"height": "75vh"},
                ),
                p=4,
                class_name="panel-dark",
                bg="#0f131a",
                color="#e5e7eb",
                width=["95vw", "90vw", "900px"],
                max_width="900px",
                border_radius="10px 0 0 10px",
                box_shadow="lg",
                border="1px solid",
                border_color="#1f2937",
                position="fixed",
                top="0",
                right="0",
                bottom="0",
                overflow="hidden",
            ),
            # Backdrop
            position="fixed",
            top="0",
            left="0",
            right="0",
            bottom="0",
            bg="rgba(0,0,0,0.6)",
            z_index=1000,
        ),
        None,
    )

def settings_overlay() -> rx.Component:
    return rx.cond(
        AppState.show_settings,
        rx.box(
            # Drawer panel
            rx.box(
                rx.hstack(
                    rx.heading("Generation Settings", size="6"),
                    rx.spacer(),
                    rx.button("Close", on_click=AppState.close_settings, size="2", variant="soft"),
                    mb=2,
                ),
                generation_settings_panel(),
                rx.hstack(
                    rx.button(
                        "View Generation Prompt",
                        size="2",
                        on_click=AppState.open_prompt_preview,
                    ),
                    justify="start",
                    mt=2,
                ),
                p=4,
                class_name="panel-dark",
                bg="#0f131a",
                color="#e5e7eb",
                width=["90vw", "560px"],
                border_radius="10px 0 0 10px",
                box_shadow="lg",
                border="1px solid",
                border_color="#1f2937",
                position="fixed",
                top="0",
                right="0",
                bottom="0",
            ),
            # Backdrop
            position="fixed",
            top="0",
            left="0",
            right="0",
            bottom="0",
            bg="rgba(0,0,0,0.6)",
            z_index=1000,
        ),
        None,
    )

def prompt_overlay() -> rx.Component:
    return rx.cond(
        AppState.show_prompt_preview,
        rx.box(
            rx.box(
                rx.hstack(
                    rx.heading("Generation Prompt", size="6"),
                    rx.spacer(),
                    rx.button("Close", on_click=AppState.close_prompt_preview, size="2", variant="soft"),
                    mb=2,
                ),
                rx.scroll_area(
                    rx.vstack(
                        rx.foreach(
                            AppState.prompt_messages,
                            lambda m: rx.box(
                                rx.hstack(
                                    rx.badge(m.role.upper(), color_scheme=rx.cond(m.role == "system", "purple", rx.cond(m.role == "user", "blue", "gray"))),
                                    rx.spacer(),
                                ),
                                rx.box(
                                    rx.text(m.content, style={"whiteSpace": "pre-wrap", "fontFamily": "monospace", "lineHeight": "1.6"}),
                                    p=2,
                                    border="1px solid",
                                    border_color="#2a2f3a",
                                    border_radius="6px",
                                    bg="#0b0f15",
                                ),
                                p=2,
                                border="1px solid",
                                border_color="#1f2937",
                                border_radius="8px",
                            ),
                        ),
                        spacing="2",
                        align_items="stretch",
                    ),
                    type="always",
                    scrollbars="vertical",
                    style={"height": "75vh"},
                ),
                p=4,
                class_name="panel-dark",
                bg="#0f131a",
                color="#e5e7eb",
                width=["95vw", "90vw", "900px"],
                max_width="900px",
                border_radius="10px 0 0 10px",
                box_shadow="lg",
                border="1px solid",
                border_color="#1f2937",
                position="fixed",
                top="0",
                right="0",
                bottom="0",
                overflow="hidden",
            ),
            position="fixed",
            top="0",
            left="0",
            right="0",
            bottom="0",
            bg="rgba(0,0,0,0.6)",
            z_index=1000,
        ),
        None,
    )

def meta_overlay() -> rx.Component:
    return rx.cond(
        AppState.show_meta_panel,
        rx.box(
            rx.box(
                rx.hstack(
                    rx.heading("Story & Lore", size="6"),
                    rx.spacer(),
                    rx.button("Close", on_click=AppState.close_meta_panel, size="2", variant="soft"),
                    mb=2,
                ),
                rx.scroll_area(
                    meta_lore_panel(),
                    type="always",
                    scrollbars="vertical",
                    style={"height": "75vh"},
                ),
                p=4,
                class_name="panel-dark",
                bg="#0f131a",
                color="#e5e7eb",
                width=["95vw", "90vw", "900px"],
                max_width="900px",
                border_radius="10px 0 0 10px",
                box_shadow="lg",
                border="1px solid",
                border_color="#1f2937",
                position="fixed",
                top="0",
                right="0",
                bottom="0",
                overflow="hidden",
            ),
            position="fixed",
            top="0",
            left="0",
            right="0",
            bottom="0",
            bg="rgba(0,0,0,0.6)",
            z_index=1000,
        ),
        None,
    )


def tiptap_help_overlay() -> rx.Component:
    return rx.cond(
        AppState.show_tiptap_help,
        rx.box(
            rx.center(
                rx.box(
                    rx.hstack(
                        rx.heading("Editor Tips", size="6"),
                        rx.spacer(),
                        rx.button("Close", on_click=AppState.close_tiptap_help, size="2", color_scheme="gray"),
                        mb=2,
                    ),
                    rx.vstack(
                        rx.text("Editing is seamless; chunks are preserved under the hood.", color="#9CA3AF"),
                        rx.unordered_list(
                            rx.list_item(rx.text("Split: Cmd/Ctrl + Enter at cursor → splits the current chunk.")),
                            rx.list_item(rx.text("Merge: Backspace at the very start of a chunk → merges into previous.")),
                            rx.list_item(rx.text("Save: Changes auto-save on idle and when focus leaves the editor.")),
                            rx.list_item(rx.text("Generate: Adds AI text into the composer; commit to save into the branch.")),
                            rx.list_item(rx.text("Boundaries: Subtle colored strip — green=user, blue=AI.")),
                        ),
                        spacing="2",
                        align_items="stretch",
                    ),
                    p=4,
                    class_name="panel-dark",
                    bg="#0f131a",
                    color="#e5e7eb",
                    width=["95vw", "90vw", "680px"],
                    border_radius="10px",
                    box_shadow="lg",
                    border="1px solid",
                    border_color="#1f2937",
                )
            ),
            position="fixed",
            top="0",
            left="0",
            right="0",
            bottom="0",
            bg="rgba(0,0,0,0.6)",
            z_index=1000,
        ),
        None,
    )


def index() -> rx.Component:
    confirm_overlay = rx.cond(
        AppState.show_confirm_flatten,
        rx.box(
            rx.center(
                rx.box(
                    rx.heading("Flatten and Commit?", size="6", mb=2),
                    rx.text("This will create a new root from the entire current draft."),
                    rx.hstack(
                        rx.button("Cancel", color_scheme="gray", on_click=AppState.close_confirm_flatten),
                        rx.button("Confirm", color_scheme="orange", on_click=AppState.confirm_flatten_and_commit),
                    ),
                    p=4,
                    bg="white",
                    width=["95vw", "90vw", "720px"],
                    border_radius="10px",
                    box_shadow="lg",
                )
            ),
            position="fixed",
            top="0",
            left="0",
            right="0",
            bottom="0",
            bg="rgba(0,0,0,0.35)",
            z_index=1100,
        ),
        None,
    )

    return rx.container(
        base_styles(),
        top_menu(),
        rx.hstack(
            # Main editor column
            rx.box(
                rx.vstack(
                    rx.hstack(
                        rx.text("Draft", weight="bold"),
                        rx.tooltip(
                            rx.icon("info", size=18, color="#9CA3AF", cursor="pointer", on_click=AppState.open_tiptap_help),
                            content="Editor tips & shortcuts",
                        ),
                        rx.spacer(),
                        rx.cond(
                            AppState.joined_chunks_text == "",
                            rx.button("Load Sample", size="1", variant="soft", on_click=AppState.dev_seed_current),
                            None,
                        ),
                        justify="start",
                        align="center",
                        gap="2",
                    ),
                    # Integrated chunk editors; no inner scroll, let page scroll
                    # Status banner for errors/saves
                    rx.cond(
                        AppState.status.startswith("error:"),
                        rx.box(
                            rx.hstack(
                                rx.text("Error", color="#ef4444", weight="bold"),
                                rx.spacer(),
                                rx.button("Dismiss", size="1", variant="soft", color_scheme="gray", on_click=AppState.clear_status),
                            ),
                            rx.text(AppState.status, color="#fca5a5"),
                            p=2,
                            mb=2,
                            border="1px solid",
                            border_color="#7f1d1d",
                            border_radius="6px",
                            bg="#1b1212",
                        ),
                        rx.cond(
                            AppState.status == "saved",
                            rx.box(
                                rx.hstack(
                                    rx.text("Saved", color="#10b981", weight="bold"),
                                    rx.spacer(),
                                    rx.button("Dismiss", size="1", variant="soft", color_scheme="gray", on_click=AppState.clear_status),
                                ),
                                p=2,
                                mb=2,
                                border="1px solid",
                                border_color="#064e3b",
                                border_radius="6px",
                                bg="#0b1915",
                            ),
                            None,
                        ),
                    ),
                    rx.box(
                        tiptap_editor(
                            chunks=AppState.chunk_edit_dicts,  # type: ignore[arg-type]
                            placeholder="Draft your story…",
                            min_height="240px",
                            on_change=AppState.set_chunk_edits_bulk,
                            on_blur=AppState.save_all_chunks,
                            version=AppState.joined_chunks_text,
                            on_ops=AppState.apply_tiptap_ops,
                        ),
                        id="draft-chunks",
                    ),
                    # New user chunk composer (Simple textarea for reliability)
                    rx.box(
                        rx.text("Composer", weight="bold"),
                        rx.text_area(
                            value=AppState.new_chunk_text,
                            placeholder="Write the next part here… (Press Cmd+Enter to commit)",
                            min_height="140px",
                            on_change=AppState.set_new_chunk_text,
                            width="100%",
                            style={
                                "background": "#0b0f15",
                                "border": "1px solid #2a2f3a", 
                                "border_radius": "8px",
                                "padding": "0.75rem 0.9rem 0.8rem 0.9rem",
                                "color": "#e5e7eb",
                                "font_family": "inherit",
                                "line_height": "1.7",
                                "resize": "vertical"
                            },
                            id="composer-textarea",
                        ),
                        id="composer",
                        data_row_id="composer",
                        mb=2,
                    ),
                    # Hidden trigger to signal content changes for auto-expansion
                    rx.box(id="expand-trigger", data_version=AppState.joined_chunks_text, display="none"),
                    rx.text("Instruction (optional)"),
                    rx.box(
                        tiptap_editor(
                            value=AppState.instruction,  # type: ignore[arg-type]
                            placeholder="e.g., continue with a tense cliffhanger...",
                            min_height="100px",
                            on_change=AppState.set_instruction,
                        ),
                        id="instruction",
                        mb=2,
                    ),
                    rx.hstack(
                        rx.button(
                            "Generate",
                            on_click=AppState.do_continue,
                            loading=AppState.status == "thinking",
                        ),
                        rx.button(
                            "Commit Chunk",
                            on_click=AppState.commit_user_chunk,
                        ),
                        rx.button(
                            "Revert Head",
                            on_click=AppState.revert_head,
                            disabled=AppState.last_parent_id.is_none(),
                        ),
                        rx.button(
                            "Commit Entire Draft as New Root",
                            on_click=AppState.open_confirm_flatten,
                            color_scheme="orange",
                        ),
                        rx.button(
                            "Regenerate Latest (branch)",
                            on_click=AppState.regenerate_latest,
                        ),
                        rx.button(
                            "Refresh Branch",
                            on_click=AppState.reload_branch,
                        ),
                        rx.badge(AppState.status),
                        justify="start",
                        gap="2",
                    ),
                    # Branch panel link removed as requested
                    spacing="2",
                    align_items="stretch",
                ),
                flex="1 1 auto",
                min_width="420px",
            ),

            # Sidebar column
            sidebar(),

            align="start",
            gap="6",
            wrap="wrap",
        ),
        lorebook_overlay(),
        branches_overlay(),
        settings_overlay(),
        prompt_overlay(),
        meta_overlay(),
        tiptap_help_overlay(),
        confirm_overlay,
        # composer_keyhandler_script(),
        
        rx.html("""
            <script>
            console.log('[TEST] JavaScript is loading!');
            
            // Simple test function
            function testComposerHandler() {
                console.log('[TEST] Looking for textarea...');
                const textarea = document.getElementById('composer-textarea');
                console.log('[TEST] Found textarea:', textarea);
                
                if (textarea) {
                    console.log('[TEST] Adding simple keydown listener...');
                    textarea.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            console.log('[TEST] Cmd+Enter detected! Looking for button...');
                            e.preventDefault();
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const commitButton = buttons.find(b => b.textContent && b.textContent.includes('Commit Chunk'));
                            if (commitButton) {
                                console.log('[TEST] Found button, clicking...');
                                commitButton.click();
                            } else {
                                console.log('[TEST] No commit button found');
                            }
                        }
                    });
                } else {
                    console.log('[TEST] No textarea found, trying again...');
                    setTimeout(testComposerHandler, 500);
                }
            }
            
            // Try multiple times to attach
            testComposerHandler();
            setTimeout(testComposerHandler, 1000);
            setTimeout(testComposerHandler, 2000);
            </script>
            <style>
            /* TipTap editor basic dark theme adjustments */
            .tiptap-editor { color: #e5e7eb; background: transparent; line-height: 1.7; }
            .tiptap-editor .ProseMirror { outline: none; white-space: pre-wrap; word-break: break-word; min-height: inherit; }
            /* Chunk container: subtle like instruction pane */
            .tiptap-editor .chunk-node {
              position: relative;
              padding: 0.75rem 0.9rem 0.8rem 0.9rem;
              border: 1px solid transparent;
              border-radius: 8px;
              background: transparent;
              transition: background-color 120ms ease, border-color 120ms ease;
            }
            /* Keep the kind strip but soften */
            .tiptap-editor .chunk-node[data-chunk-kind="ai"] { box-shadow: inset 2px 0 0 #2563EB; }
            .tiptap-editor .chunk-node[data-chunk-kind="user"] { box-shadow: inset 2px 0 0 #16A34A; }
            /* Active/focused chunk: match instruction window look */
            .tiptap-editor .chunk-node:focus-within {
              background: #0b0f15;            /* similar to instruction area */
              border-color: #2a2f3a;           /* subtle border */
            }
            /* Paragraph spacing inside chunks */
            .tiptap-editor .chunk-node p { margin: 0.25rem 0; }
            .tiptap-editor .chunk-node p:first-child { margin-top: 0; }
            .tiptap-editor .chunk-node p:last-child { margin-bottom: 0; }
            /* Space between chunks */
            .tiptap-editor .chunk-node + .chunk-node { margin-top: 0.75rem; }
            /* Composer styling: match instruction pane look */
            #composer .tiptap-editor {
              background: #0b0f15;
              border: 1px solid #2a2f3a;
              border-radius: 8px;
              padding: 0.75rem 0.9rem 0.8rem 0.9rem;
            }
            /* Visible placeholder in dark mode */
            .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
              content: attr(data-placeholder);
              color: #9CA3AF; /* gray-400 */
              opacity: 0.85;
              pointer-events: none;
              height: 0;
              float: left;
            }
            #composer .tiptap-editor .ProseMirror p { margin: 0.25rem 0; }
            #composer .tiptap-editor .ProseMirror p:first-child { margin-top: 0; }
            #composer .tiptap-editor .ProseMirror p:last-child { margin-bottom: 0; }
            /* Instruction styling matches composer */
            #instruction .tiptap-editor {
              background: #0b0f15;
              border: 1px solid #2a2f3a;
              border-radius: 8px;
              padding: 0.6rem 0.8rem 0.7rem 0.8rem;
            }
            #instruction .tiptap-editor .ProseMirror p { margin: 0.25rem 0; }
            #instruction .tiptap-editor .ProseMirror p:first-child { margin-top: 0; }
            #instruction .tiptap-editor .ProseMirror p:last-child { margin-bottom: 0; }
            .panel-dark { background-color: #0f131a; color: #e5e7eb; }
            .panel-dark h1, .panel-dark h2, .panel-dark h3, .panel-dark h4, .panel-dark h5, .panel-dark h6 { color: #f3f4f6; }
            .panel-dark input, .panel-dark select { background-color: #111827 !important; color: #e5e7eb !important; border-color: #374151 !important; }
            .panel-dark .rt-SelectTrigger, .panel-dark .rt-InputRoot { background-color: #111827 !important; color: #e5e7eb !important; border-color: #374151 !important; }
            .panel-dark .rt-BadgeRoot { background-color: #1f2937 !important; color: #e5e7eb !important; }
            .panel-dark .rt-ButtonRoot[data-variant="soft"] { background-color: #1f2937; color: #e5e7eb; }
            .panel-dark .rt-ButtonRoot:hover { filter: brightness(1.1); }
            </style>
        """),
        rx.cond(
            DEBUG_TIPTAP,
            rx.box(
                rx.text("[Debug] TipTap enabled: true"),
                rx.text("[Debug] Current story: ", AppState.current_story),
                rx.text("[Debug] Joined length: ", rx.cond(AppState.joined_chunks_text == "", "0", "1")),
                p=2,
            ),
            None,
        ),
        # Icons are always visible now; no reveal script needed
        on_mount=[AppState.load_stories, AppState.load_state, AppState.load_lore, AppState.reload_branch, AppState.probe_backend],
        py=4,
    )
    
# Add script tag as a separate component to ensure it loads
def composer_keyhandler_script() -> rx.Component:
    return rx.html(
        """
        <script>
        console.log('[Composer] Script loading...');
        window.setupComposer = function() {
            console.log('[Composer] setupComposer called');
            const textarea = document.getElementById('composer-textarea');
            if (textarea) {
                console.log('[Composer] Found textarea:', textarea);
                textarea.addEventListener('keydown', function(e) {
                    console.log('[Composer] Key event:', e.key, 'Meta:', e.metaKey, 'Ctrl:', e.ctrlKey);
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        console.log('[Composer] Cmd+Enter detected!');
                        e.preventDefault();
                        const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Commit Chunk'));
                        if (button) {
                            console.log('[Composer] Clicking button');
                            button.click();
                        }
                    }
                });
            } else {
                console.log('[Composer] Textarea not found');
            }
        };
        // Try immediately and then with delays
        if (document.readyState === 'complete') {
            window.setupComposer();
        } else {
            window.addEventListener('load', window.setupComposer);
        }
        setTimeout(window.setupComposer, 1000);
        setTimeout(window.setupComposer, 2000);
        </script>
        """
    )
def base_styles() -> rx.Component:
    return rx.html(
        """
        <style>
          html, body { background-color: #0f131a; color: #e5e7eb; }
          a { color: #a78bfa; }
          .app-topbar { background-color: #111827; border-bottom: 1px solid #1f2937; position: sticky; top: 0; z-index: 20; }
          .app-topbar .rt-ButtonRoot[data-variant="soft"] { background-color: rgba(147, 51, 234, 0.15); color: #c4b5fd; }
          .app-topbar .rt-ButtonRoot[data-variant="soft"]:hover { background-color: rgba(147, 51, 234, 0.25); }
          /* Inputs general dark */
          input, select { background-color: #111827; color: #e5e7eb; border-color: #374151; }
          .rt-InputRoot, .rt-SelectTrigger { background-color: #111827; color: #e5e7eb; border-color: #374151; }
        </style>
        """
    )
