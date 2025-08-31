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
        on_mount=AppState.load_lore,
        py=6,
    )

