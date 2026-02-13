from fastapi.testclient import TestClient

from storycraft.app.main import app


def test_legacy_story_editor_routes_are_not_exposed() -> None:
    legacy_paths = [
        "/api/state",
        "/api/story-settings",
        "/api/lorebook",
        "/api/continue",
        "/api/snippets/path",
        "/api/stories",
        "/api/rpg/state",
    ]

    with TestClient(app) as client:
        for path in legacy_paths:
            response = client.get(path)
            assert response.status_code == 404, f"Expected 404 for removed route {path}"
