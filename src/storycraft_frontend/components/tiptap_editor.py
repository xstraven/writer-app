from __future__ import annotations

import reflex as rx
from reflex.vars import Var


class TipTapEditor(rx.Component):
    """Custom TipTap editor wrapper (React) exposed to Reflex.

    NOTE: This requires a matching React component exported as `TipTapEditor`
    from a library named `tiptap-reflex-wrapper`. The wrapper should accept
    props: value (string), placeholder (string), minHeight (string),
    disabled (boolean), and event handlers: onChange(value: string), onBlur().

    Until the JS wrapper is provided, keep this behind a feature flag so the
    app renders with the default textarea editors.
    """

    library = "tiptap-reflex-wrapper"
    tag = "TipTapEditor"

    # Props
    value: Var[str]
    placeholder: Var[str]
    min_height: Var[str]
    disabled: Var[bool]

    # Events
    on_change: rx.EventHandler[lambda value: [value]]  # receives the new string value
    on_blur: rx.EventHandler[lambda: []]


def tiptap_editor(
    *,
    value: Var[str],
    placeholder: Var[str] | str = "",
    min_height: Var[str] | str = "140px",
    disabled: Var[bool] | bool = False,
    on_change: rx.EventHandler | None = None,
    on_blur: rx.EventHandler | None = None,
) -> rx.Component:
    return TipTapEditor.create(
        value=value,
        placeholder=placeholder,
        min_height=min_height,
        disabled=disabled,
        on_change=on_change,
        on_blur=on_blur,
        # Basic styling to make it fill width similar to textarea
        style={"width": "100%"},
    )

