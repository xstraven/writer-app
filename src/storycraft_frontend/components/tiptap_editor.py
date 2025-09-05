from __future__ import annotations

import reflex as rx
from reflex.vars import Var


class TipTapEditor(rx.Component):
    """Custom TipTap editor wrapper (React) exposed to Reflex.

    Requires a matching React component exported as `TipTapEditor` from
    the `tiptap-reflex-wrapper` library. The wrapper should accept props:
    value (string) or chunks (array), placeholder (string), minHeight (string),
    disabled (boolean), version (string), and handlers:
    onChange(value: string), onBlur(), onOps(ops: array), onSubmit(value: string).
    """

    library = "tiptap-reflex-wrapper"
    tag = "TipTapEditor"

    # Props (two modes)
    # 1) Plain text mode (composer, instruction, summaries): value
    value: Var[str]
    # 2) Chunk mode (seamless editor): chunks = [{id, kind, content}]
    chunks: Var[list]  # list of dict-like items
    placeholder: Var[str]
    min_height: Var[str]
    disabled: Var[bool]
    version: Var[str]

    # Event triggers definitions
    on_change: rx.EventHandler[lambda value: [value]]  # receives the new string value
    on_blur: rx.EventHandler[lambda: []]
    on_ops: rx.EventHandler[lambda ops: [ops]]  # structural ops: split/merge
    on_submit: rx.EventHandler[lambda value: [value]]  # value-mode submit (Mod+Enter) passes current text


def tiptap_editor(
    *,
    value: Var[str] | None = None,
    chunks: Var[list] | None = None,
    placeholder: Var[str] | str = "",
    min_height: Var[str] | str = "140px",
    disabled: Var[bool] | bool = False,
    on_change: rx.EventHandler | None = None,
    on_blur: rx.EventHandler | None = None,
    version: Var[str] | None = None,
    on_ops: rx.EventHandler | None = None,
    on_submit: rx.EventHandler | None = None,
) -> rx.Component:
    props: dict = {
        "placeholder": placeholder,
        "min_height": min_height,
        "disabled": disabled,
        # Basic styling to make it fill width similar to textarea
        "style": {"width": "100%"},
    }
    if value is not None:
        props["value"] = value
    if chunks is not None:
        props["chunks"] = chunks
    if version is not None:
        props["version"] = version
    # Only set event props when provided, to avoid invalid no-op lambdas.
    if on_change is not None:
        props["on_change"] = on_change
    if on_blur is not None:
        props["on_blur"] = on_blur
    if on_ops is not None:
        props["on_ops"] = on_ops
    if on_submit is not None:
        props["on_submit"] = on_submit
    return TipTapEditor.create(**props)
