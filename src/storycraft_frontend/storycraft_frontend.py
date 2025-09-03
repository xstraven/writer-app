import reflex as rx

from .pages import index, configure


# Reflex expects an `app` in `<app_name>/<app_name>.py`.
app = rx.App()
app.add_page(index.index, route="/")
app.add_page(configure.configure, route="/configure")
