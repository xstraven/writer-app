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


def index() -> rx.Component:
    return rx.container(
        rx.vstack(
            rx.heading("Storycraft", size="8"),
            rx.text("AI-assisted novel writing with memory & lore."),
            spacing="3",
            align_items="stretch",
        ),
        rx.flex(
            rx.box(
                rx.vstack(
                    rx.text("Draft"),
                    rx.text_area(
                        placeholder="Paste or write your story here...",
                        value=AppState.draft_text,
                        on_change=AppState.set_draft_text,
                        rows="20",
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
                            "Back",
                            on_click=AppState.undo_generation,
                            disabled=rx.cond(AppState.can_undo, False, True),
                        ),
                        rx.button(
                            "Forward",
                            on_click=AppState.redo_generation,
                            disabled=rx.cond(AppState.can_redo, False, True),
                        ),
                        rx.badge(AppState.status),
                        rx.spacer(),
                        rx.input(value=AppState.model, on_change=AppState.set_model, width="220px"),
                        rx.text("Temp"),
                        rx.input(
                            type="number",
                            value=AppState.temperature,
                            on_change=AppState.update_temperature,
                            step=0.1,
                            width="90px",
                        ),
                        rx.text("Tokens"),
                        rx.input(
                            type="number",
                            value=AppState.max_tokens,
                            on_change=AppState.update_max_tokens,
                            step=64,
                            width="100px",
                        ),
                    ),
                    spacing="2",
                    align_items="stretch",
                ),
                flex="1 1 520px",
                min_width="320px",
            ),

            rx.box(
                rx.vstack(
                    rx.box(
                        rx.heading("Continuation", size="5", mb=2),
                        rx.divider(),
                        rx.text(
                            rx.cond(
                                AppState.continuation != "",
                                AppState.continuation,
                                "Output will appear here...",
                            ),
                            white_space="pre-wrap",
                        ),
                        p=3,
                        border="1px solid",
                        border_color="gray.200",
                        border_radius="8px",
                    ),
                    context_panel(),
                    memory_panel(),
                    lorebook_panel(),
                    spacing="3",
                ),
                flex="1 1 520px",
                min_width="320px",
            ),

            direction="row",
            wrap="wrap",
            gap="6",
        ),
        on_mount=[AppState.load_state, AppState.load_lore],
        py=6,
    )
