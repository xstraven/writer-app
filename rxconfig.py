import reflex as rx


class AppConfig(rx.Config):
    pass


config = AppConfig(
    app_name="storycraft_frontend",
    # Silence sitemap plugin warnings by disabling it explicitly.
    disable_plugins=["reflex.plugins.sitemap.SitemapPlugin"],
    # Optional: preinstall editor packages for custom TipTap wrapper experiments.
    frontend_packages=[
        "@tiptap/react@^2",
        "@tiptap/starter-kit@^2",
        "@tiptap/extension-placeholder@^2",
    ],
)
