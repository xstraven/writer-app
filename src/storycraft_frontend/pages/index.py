from __future__ import annotations

import reflex as rx

from ..state import AppState


def seamless_chunks_view() -> rx.Component:
    # Display the current branch as a single continuous text block.
    return rx.box(
        rx.text(
            rx.cond(
                (AppState.joined_chunks_text == ""),
                AppState.draft_text,
                AppState.joined_chunks_text,
            ),
            style={
                "whiteSpace": "pre-wrap",
                "lineHeight": "1.7",
            },
        ),
        p=0,
    )

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
            rx.text_area(
                placeholder="Summary",
                value=AppState.new_lore_summary,
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
                rx.text_area(
                    value=AppState.system_prompt,
                    on_change=AppState.set_system_prompt,
                    rows="6",
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
                    rx.text("Draft"),
                    # Integrated chunk editors; no inner scroll, let page scroll
                    rx.box(
                        rx.vstack(
                            rx.foreach(
                                AppState.chunk_edit_list,
                                lambda it: rx.box(
                                    # Text area editor
                                    rx.text_area(
                                        value=it.content,
                                        on_change=lambda v, sid=it.id: AppState.set_chunk_edit(sid, v),
                                        rows="1",
                                        auto_height=True,
                                        min_rows=1,
                                        max_rows=1000,
                                        on_blur=lambda _=None, sid=it.id: AppState.save_chunk(sid),
                                        id=f"chunk-{it.id}",
                                        data_chunk_id=it.id,
                                        width="100%",
                                        wrap="soft",
                                        style={
                                            "overflow": "hidden",
                                            "overflowY": "hidden",
                                            "maxHeight": "none",
                                            "resize": "none",
                                            "whiteSpace": "pre-wrap",
                                            "wordWrap": "break-word",
                                        },
                                    ),
                                    # Top-right overlay actions
                                    rx.hstack(
                                        rx.tooltip(
                                            rx.button("↑", size="1", variant="ghost",
                                                title="Insert above",
                                                on_click=lambda _=None, sid=it.id: AppState.insert_above(sid, "(write here)")
                                            ),
                                            content="Insert above",
                                        ),
                                        rx.tooltip(
                                            rx.button("↓", size="1", variant="ghost",
                                                title="Insert below",
                                                on_click=lambda _=None, sid=it.id: AppState.insert_below(sid, "(write here)")
                                            ),
                                            content="Insert below",
                                        ),
                                        rx.tooltip(
                                            rx.button("🗑️", size="1", color_scheme="red", variant="ghost",
                                                title="Delete chunk",
                                                on_click=lambda _=None, sid=it.id: AppState.delete_snippet(sid)
                                            ),
                                            content="Delete chunk",
                                        ),
                                        spacing="1",
                                        justify="end",
                                        class_name="chunk-actions",
                                        style={
                                            "position": "absolute",
                                            "top": "4px",
                                            "right": "6px",
                                        },
                                    ),
                                    # Row container styling
                                    position="relative",
                                    mb=2,
                                    style={
                                        "boxShadow": rx.cond(
                                            it.kind == "ai",
                                            "inset 3px 0 0 #60A5FA",  # blue-400
                                            "inset 3px 0 0 #4ADE80",  # green-400
                                        )
                                    },
                                    class_name="chunk-row",
                                ),
                            ),
                            spacing="2",
                            align_items="stretch",
                            id="draft-chunks",
                        ),
                    ),
                    # New user chunk composer at the end of the draft
                    rx.hstack(
                        # Left: composer input (84%)
                        rx.box(
                            rx.text_area(
                                placeholder="Write the next part here…",
                                value=AppState.new_chunk_text,
                                on_change=AppState.set_new_chunk_text,
                                rows="1",
                                auto_height=True,
                                min_rows=1,
                                max_rows=1000,
                                wrap="soft",
                                style={
                                    "overflow": "hidden",
                                    "overflowY": "hidden",
                                    "maxHeight": "none",
                                    "resize": "none",
                                    "whiteSpace": "pre-wrap",
                                    "wordWrap": "break-word",
                                },
                            ),
                            width="84%",
                        ),
                        # Right: meta/actions (16%) — simplified (removed quick Add button)
                        rx.box(width="16%", align_self="start"),
                        align="start",
                        mb=2,
                        style={"boxShadow": "inset 3px 0 0 #4ADE80"},
                        id="composer",
                        data_row_id="composer",
                    ),
                    # Hidden trigger to signal content changes for auto-expansion
                    rx.box(id="expand-trigger", data_version=AppState.joined_chunks_text, display="none"),
                    rx.text("Instruction (optional)"),
                    rx.text_area(
                        placeholder="e.g., continue with a tense cliffhanger...",
                        value=AppState.instruction,
                        on_change=AppState.set_instruction,
                        rows="4",
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
        confirm_overlay,
        rx.script(
            """
            (function(){
              const handler = function(e){
                const ta = e.target;
                if(!ta || ta.tagName !== 'TEXTAREA') return;
                const container = document.getElementById('draft-chunks');
                if(!container || !container.contains(ta)) return;
                const list = Array.from(container.querySelectorAll('textarea'));
                const idx = list.indexOf(ta);
                if(idx === -1) return;
                const atStart = ta.selectionStart === 0 && ta.selectionEnd === 0;
                const atEnd = ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
                const plain = !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey;
                if(e.key === 'ArrowDown' && atEnd && idx < list.length - 1 && plain){
                  e.preventDefault();
                  try { ta.blur(); } catch(_){}
                  const next = list[idx+1];
                  if(next){
                    try { next.focus(); next.setSelectionRange(0,0); } catch(_){ try { next.focus(); } catch(_){} }
                  }
                }
                if(e.key === 'ArrowUp' && atStart && idx > 0 && plain){
                  e.preventDefault();
                  try { ta.blur(); } catch(_){}
                  const prev = list[idx-1];
                  if(prev){
                    try { const len = prev.value.length; prev.focus(); prev.setSelectionRange(len,len); } catch(_){ try { prev.focus(); } catch(_){} }
                  }
                }
              };
              document.addEventListener('keydown', handler, true);
            })();
            """
        ),
        rx.script(
            """
            (function(){
              const timers = new WeakMap();
              function schedule(ta){
                const prev = timers.get(ta);
                if(prev) clearTimeout(prev);
                const start = ta.selectionStart, end = ta.selectionEnd;
                const t = setTimeout(()=>{
                  try {
                    // Ensure auto size before blur
                    try { ta.style.maxHeight = 'none'; ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight)+'px'; } catch(_){ }
                    ta.dataset.autosaving = '1';
                    ta.blur();
                    setTimeout(()=>{
                      if(document.body.contains(ta)){
                        try { ta.focus(); ta.setSelectionRange(start,end); } catch(_){ try { ta.focus(); } catch(_){} }
                        // Ensure auto size after refocus
                        try { ta.style.maxHeight = 'none'; ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight)+'px'; } catch(_){ }
                      }
                      delete ta.dataset.autosaving;
                    }, 40);
                  } catch(_){ }
                }, 450);
                timers.set(ta, t);
              }
              document.addEventListener('input', function(e){
                const ta = e.target;
                if(!ta || ta.tagName !== 'TEXTAREA') return;
                const container = document.getElementById('draft-chunks');
                if(!container || !container.contains(ta)) return;
                schedule(ta);
              }, true);
              // Flush pending edits on unload/visibility change by forcing blur
              function flush(){
                try {
                  const container = document.getElementById('draft-chunks');
                  if(!container) return;
                  container.querySelectorAll('textarea').forEach(function(ta){
                    try { ta.blur(); } catch(_){ }
                  });
                } catch(_){ }
              }
              window.addEventListener('beforeunload', flush, {capture: true});
              window.addEventListener('pagehide', flush, {capture: true});
              document.addEventListener('visibilitychange', function(){ if(document.hidden){ flush(); } }, true);
            })();
            """
        ),
        rx.script(
            """
            (function(){
              function autoExpand(ta){
                if(!ta) return;
                try {
                  ta.style.overflow = 'hidden';
                  ta.style.resize = 'none';
                  ta.style.maxHeight = 'none';
                  ta.style.height = 'auto';
                  ta.style.height = (ta.scrollHeight) + 'px';
                } catch(_){ }
              }
              function expandAll(){
                try {
                  document.querySelectorAll('#draft-chunks textarea, #composer textarea').forEach(function(ta){
                    autoExpand(ta);
                    try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch(_){ }
                  });
                } catch(_){ }
              }
              function scheduleBurst(){
                expandAll();
                try { requestAnimationFrame(expandAll); } catch(_){ }
                setTimeout(expandAll, 50);
                setTimeout(expandAll, 200);
                setTimeout(expandAll, 600);
                setTimeout(expandAll, 1200);
              }
              document.addEventListener('input', function(e){
                const ta = e.target;
                if(!ta || ta.tagName !== 'TEXTAREA') return;
                autoExpand(ta);
              }, true);
              document.addEventListener('focus', function(e){
                const ta = e.target;
                if(!ta || ta.tagName !== 'TEXTAREA') return;
                autoExpand(ta);
              }, true);
              const observer = new MutationObserver(function(){
                scheduleBurst();
              });
              observer.observe(document.body, { childList: true, subtree: true, characterData: true });
              const trig = document.getElementById('expand-trigger');
              if(trig){
                const attrObserver = new MutationObserver(function(){
                  scheduleBurst();
                });
                attrObserver.observe(trig, { attributes: true, attributeFilter: ['data-version'] });
              }
              window.addEventListener('load', scheduleBurst);
              document.addEventListener('DOMContentLoaded', scheduleBurst);
              window.addEventListener('resize', scheduleBurst);
              document.addEventListener('visibilitychange', function(){ if(!document.hidden){ scheduleBurst(); } });
            })();
            """
        ),
        rx.html("""
            <style>
            .rt-TextAreaRoot textarea { max-height: none !important; overflow-y: hidden !important; }
            textarea { overflow-y: hidden !important; }
            .panel-dark { background-color: #0f131a; color: #e5e7eb; }
            .panel-dark h1, .panel-dark h2, .panel-dark h3, .panel-dark h4, .panel-dark h5, .panel-dark h6 { color: #f3f4f6; }
            .panel-dark input, .panel-dark textarea, .panel-dark select { background-color: #111827 !important; color: #e5e7eb !important; border-color: #374151 !important; }
            .panel-dark .rt-TextAreaRoot textarea { background-color: #111827 !important; color: #e5e7eb !important; border-color: #374151 !important; }
            .panel-dark .rt-SelectTrigger, .panel-dark .rt-InputRoot { background-color: #111827 !important; color: #e5e7eb !important; border-color: #374151 !important; }
            .panel-dark .rt-BadgeRoot { background-color: #1f2937 !important; color: #e5e7eb !important; }
            .panel-dark .rt-ButtonRoot[data-variant="soft"] { background-color: #1f2937; color: #e5e7eb; }
            .panel-dark .rt-ButtonRoot:hover { filter: brightness(1.1); }
            </style>
        """),
        # Icons are always visible now; no reveal script needed
        on_mount=[AppState.load_stories, AppState.load_state, AppState.load_lore, AppState.reload_branch, AppState.probe_backend],
        py=4,
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
          input, textarea, select { background-color: #111827; color: #e5e7eb; border-color: #374151; }
          .rt-InputRoot, .rt-SelectTrigger, .rt-TextAreaRoot textarea { background-color: #111827; color: #e5e7eb; border-color: #374151; }
        </style>
        """
    )
