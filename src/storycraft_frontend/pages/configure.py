from __future__ import annotations

import reflex as rx

from ..state import AppState
from .index import branches_panel, generation_settings_panel, base_styles


def configure() -> rx.Component:
    return rx.container(
        base_styles(),
        rx.hstack(
            rx.heading("Configure", size="7"),
            rx.spacer(),
            rx.link(rx.button("Back", variant="soft"), href="/"),
            align="center",
            py=3,
        ),
        rx.vstack(
            rx.box(
                rx.heading("Branches", size="6", mb=2),
                rx.text("Manage active branch choices, view main path tree, and saved branches."),
                rx.divider(),
                rx.scroll_area(
                    branches_panel(),
                    type="always",
                    scrollbars="vertical",
                    style={"height": "60vh"},
                ),
                p=2,
                class_name="panel-dark",
                bg="#0f131a",
                color="#e5e7eb",
                border="1px solid",
                border_color="#1f2937",
                border_radius="8px",
            ),
            rx.box(
                rx.heading("Generation", size="6", mb=2),
                rx.text("Tune model, temperature, tokens, and context usage."),
                rx.divider(),
                generation_settings_panel(),
                p=2,
                class_name="panel-dark",
                bg="#0f131a",
                color="#e5e7eb",
                border="1px solid",
                border_color="#1f2937",
                border_radius="8px",
            ),
            spacing="4",
            align_items="stretch",
        ),
        on_mount=[AppState.reload_branch, AppState.load_branches],
        py=2,
    )
