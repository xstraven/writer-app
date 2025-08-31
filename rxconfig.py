import reflex as rx


class AppConfig(rx.Config):
    pass


config = AppConfig(
    app_name="storycraft_frontend",
    # Silence sitemap plugin warnings by disabling it explicitly.
    disable_plugins=["reflex.plugins.sitemap.SitemapPlugin"],
)
