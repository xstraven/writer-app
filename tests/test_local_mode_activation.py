from __future__ import annotations

import os
import sys

import pytest

from storycraft.app.services.neon_client import NeonClient
from storycraft.app.services.persistence_client import (
    InMemoryClient,
    get_persistence_client,
    reset_persistence_client,
)


@pytest.fixture(autouse=True)
def reset_client():
    """Reset the singleton client before and after each test."""
    reset_persistence_client()
    yield
    reset_persistence_client()


def test_test_mode_uses_in_memory_client(monkeypatch):
    """Test that tests automatically use in-memory client."""
    # PYTEST_CURRENT_TEST is automatically set by pytest
    # We'll verify it's set and uses in-memory
    assert os.getenv("PYTEST_CURRENT_TEST") is not None

    # Remove Neon URL to ensure we're not using it
    monkeypatch.delenv("STORYCRAFT_NEON_DATABASE_URL", raising=False)

    reset_persistence_client()
    client = get_persistence_client()

    # Verify it's in-memory client
    assert isinstance(client, InMemoryClient)


def test_runtime_requires_postgres_url_without_test_mode(monkeypatch):
    """Outside pytest mode, Postgres URL is required."""
    from storycraft.app.config import get_settings

    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delenv("STORYCRAFT_NEON_DATABASE_URL", raising=False)
    monkeypatch.delitem(sys.modules, "pytest", raising=False)
    get_settings.cache_clear()

    reset_persistence_client()
    with pytest.raises(RuntimeError, match="STORYCRAFT_NEON_DATABASE_URL is required"):
        get_persistence_client()


def test_runtime_uses_neon_client_when_url_present(monkeypatch):
    """Outside pytest mode, configured URL uses Neon client."""
    from storycraft.app.config import get_settings

    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delitem(sys.modules, "pytest", raising=False)
    monkeypatch.setenv("STORYCRAFT_NEON_DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
    get_settings.cache_clear()

    reset_persistence_client()
    client = get_persistence_client()

    assert isinstance(client, NeonClient)


def test_singleton_behavior_across_calls(monkeypatch):
    """Test that get_persistence_client returns the same instance."""
    from storycraft.app.config import get_settings

    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.setenv("STORYCRAFT_NEON_DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
    get_settings.cache_clear()

    reset_persistence_client()

    client1 = get_persistence_client()
    client2 = get_persistence_client()

    # Should be the same instance
    assert client1 is client2
