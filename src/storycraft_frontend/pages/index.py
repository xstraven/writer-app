from __future__ import annotations

import reflex as rx

from ..state import AppState


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
                rx.text_area(
                    placeholder="Short summary of the current scene...",
                    value=AppState.context.summary,
                    on_change=AppState.set_context_summary,
                    rows="4",
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
                        rx.button(
                            "Delete",
                            color_scheme="red",
                            size="1",
                            on_click=lambda: AppState.delete_lore(e.id),
                        ),
                    ),
                    rx.text(e.summary),
                    p=2,
                    border="1px solid",
                    border_color="gray.100",
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
            rx.text_area(
                placeholder="Summary",
                value=AppState.new_lore_summary,
                on_change=AppState.set_new_lore_summary,
            ),
            rx.button("Add", on_click=AppState.submit_new_lore),
        ),
        p=3,
        border="1px solid",
        border_color="gray.200",
        border_radius="8px",
    )


def top_menu() -> rx.Component:
    return rx.hstack(
        rx.heading("Storycraft", size="7"),
        rx.spacer(),
        rx.text("Story:"),
        rx.select(
            AppState.story_options,
            value=AppState.current_story,
            on_change=AppState.switch_story,
            width="220px",
        ),
        rx.button("New Story", on_click=AppState.create_story, size="2"),
        rx.spacer(),
        rx.badge(
            rx.cond(AppState.backend_ok, "API: OK", "API: ERR"),
            color_scheme=rx.cond(AppState.backend_ok, "green", "red"),
        ),
        rx.tooltip(rx.icon("info"), content=AppState.backend_msg),
        align="center",
        py=3,
    )


def sidebar() -> rx.Component:
    return rx.vstack(
        rx.box(
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
                rx.hstack(
                    rx.switch(checked=AppState.include_context, on_change=AppState.set_include_context, label="Include context"),
                ),
                spacing="2",
                align_items="stretch",
            ),
            p=3,
            border="1px solid",
            border_color="gray.200",
            border_radius="8px",
        ),

        rx.box(
            rx.hstack(rx.heading("Meta", size="5")),
            rx.divider(),
            rx.text("Story Description"),
            rx.text_area(
                placeholder="What is this story about?",
                value=AppState.context.summary,
                on_change=AppState.set_context_summary,
                rows="6",
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
        ),

        rx.box(
            rx.hstack(
                rx.heading("Lorebook", size="5"),
                rx.spacer(),
                rx.button("Manage", on_click=AppState.open_lorebook, size="2"),
            ),
            rx.text("Manage entries in the pop-out"),
            p=3,
            border="1px solid",
            border_color="gray.200",
            border_radius="8px",
        ),

        spacing="4",
        align_items="stretch",
        width="360px",
        min_width="300px",
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
                    bg="white",
                    width=["95vw", "90vw", "900px"],
                    border_radius="10px",
                    box_shadow="lg",
                )
            ),
            # Backdrop
            position="fixed",
            top="0",
            left="0",
            right="0",
            bottom="0",
            bg="rgba(0,0,0,0.35)",
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
        top_menu(),
        rx.hstack(
            # Main editor column
            rx.box(
                rx.vstack(
                    rx.text("Draft"),
                    rx.text_area(
                        placeholder="Paste or write your story here...",
                        value=AppState.draft_text,
                        on_change=AppState.set_draft_text,
                        rows="22",
                    ),
                    rx.text("Instruction (optional)"),
                    rx.text_area(
                        placeholder="e.g., continue with a tense cliffhanger...",
                        value=AppState.instruction,
                        on_change=AppState.set_instruction,
                        rows="4",
                    ),
                    rx.hstack(
                        rx.button(
                            "Continue",
                            on_click=AppState.do_continue,
                            loading=AppState.status == "thinking",
                        ),
                        rx.button(
                            "Commit User Chunk",
                            on_click=AppState.commit_user_chunk,
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
                    rx.box(
                        rx.hstack(rx.heading("Branch Choices", size="4")),
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
                                        border_color="gray.100",
                                        border_radius="6px",
                                    ),
                                ),
                                spacing="2",
                                align_items="stretch",
                            ),
                        ),
                        p=2,
                        border="1px solid",
                        border_color="gray.200",
                        border_radius="8px",
                    ),
                    rx.box(
                        rx.hstack(rx.heading("Chunks", size="4")),
                        rx.text("Edit and save any chunk in the current path."),
                        rx.vstack(
                            rx.foreach(
                                AppState.chunk_edit_list,
                                lambda it: rx.box(
                                    rx.text(f"{it.kind.upper()} • {it.id[:8]}"),
                                    rx.text_area(
                                        value=it.content,
                                        on_change=lambda v, sid=it.id: AppState.set_chunk_edit(sid, v),
                                        rows="6",
                                    ),
                                    rx.hstack(
                                        rx.button(
                                            "Save Chunk",
                                            size="2",
                                            on_click=lambda sid=it.id: AppState.save_chunk(sid),
                                        ),
                                        rx.button(
                                            "Insert Above",
                                            size="2",
                                            on_click=lambda sid=it.id: AppState.insert_above(sid, "(write here)")
                                        ),
                                        rx.button(
                                            "Insert Below",
                                            size="2",
                                            on_click=lambda sid=it.id: AppState.insert_below(sid, "(write here)")
                                        ),
                                        rx.button(
                                            "Delete",
                                            size="2",
                                            color_scheme="red",
                                            on_click=lambda sid=it.id: AppState.delete_snippet(sid),
                                        ),
                                    ),
                                    p=2,
                                    border="1px solid",
                                    border_color="gray.100",
                                    border_radius="6px",
                                ),
                            ),
                            spacing="3",
                            align_items="stretch",
                        ),
                        p=2,
                        border="1px solid",
                        border_color="gray.200",
                        border_radius="8px",
                    ),
                    rx.box(
                        rx.hstack(rx.heading("Main Path Tree", size="4")),
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
                                    border_color="gray.100",
                                    border_radius="6px",
                                ),
                            ),
                            spacing="3",
                            align_items="stretch",
                        ),
                        p=2,
                        border="1px solid",
                        border_color="gray.200",
                        border_radius="8px",
                    ),
                    rx.box(
                        rx.hstack(rx.heading("Branches", size="4")),
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
                                    border_color="gray.100",
                                    border_radius="6px",
                                ),
                            ),
                            spacing="2",
                            align_items="stretch",
                        ),
                        p=2,
                        border="1px solid",
                        border_color="gray.200",
                        border_radius="8px",
                    ),
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
        confirm_overlay,
        on_mount=[AppState.load_state, AppState.load_lore, AppState.reload_branch, AppState.probe_backend],
        py=4,
    )
