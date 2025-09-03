import reflex as rx

from .pages import index, configure


# Reflex expects an `app` in `<app_name>/<app_name>.py`.
# Apply a global dark theme with purple accent (Radix).
theme = rx.theme(appearance="dark", accent_color="purple")
app = rx.App(theme=theme)
app.add_page(index.index, route="/")
app.add_page(configure.configure, route="/configure")
