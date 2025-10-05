from storycraft.app.services.supabase_client import (
    get_supabase_client,
    reset_supabase_client,
)
from storycraft.app.snippet_store import SnippetStore


def test_snippet_store_branching(tmp_path):
    reset_supabase_client()
    client = get_supabase_client()
    store = SnippetStore(client=client)
    story = "Test Story"

    # Create root (user input)
    root = store.create_snippet(story=story, content="A", kind="user", parent_id=None)
    assert root.parent_id is None
    assert root.child_id is None

    # Append AI continuation; becomes active child
    b = store.create_snippet(story=story, content="B", kind="ai", parent_id=root.id)
    parent = store.get(root.id)
    assert parent and parent.child_id == b.id

    # Regenerate an alternative to B; do not auto-activate
    c = store.regenerate_snippet(
        story=story, target_snippet_id=b.id, content="C", kind="ai", set_active=False
    )
    # Parent should still point to B
    parent = store.get(root.id)
    assert parent and parent.child_id == b.id
    # Two children now
    kids = store.list_children(story, root.id)
    assert {k.id for k in kids} == {b.id, c.id}

    # Choose C as the active branch
    store.choose_active_child(story=story, parent_id=root.id, child_id=c.id)
    parent = store.get(root.id)
    assert parent and parent.child_id == c.id

    # Main path should be A -> C
    path = store.main_path(story)
    assert [p.content for p in path] == ["A", "C"]
    assert store.build_text(path) == "A\n\nC"

    # Insert above C (between A and C)
    ins = store.insert_above(story=story, target_snippet_id=c.id, content="ABOVE", kind="user")
    # Main path should be A -> ABOVE -> C (since parent to C should now point to ABOVE)
    path2 = store.main_path(story)
    assert [p.content for p in path2] == ["A", "ABOVE", "C"]

    # Insert below ABOVE (between ABOVE and C)
    store.insert_below(story=story, parent_snippet_id=ins.id, content="BELOW", kind="user")
    path3 = store.main_path(story)
    assert [p.content for p in path3] == ["A", "ABOVE", "BELOW", "C"]

    # Delete leaf (BELOW is not leaf after we inserted below, so delete C first)
    ok = store.delete_snippet(story=story, snippet_id=path3[-1].id)
    assert ok
    path4 = store.main_path(story)
    assert [p.content for p in path4] == ["A", "ABOVE", "BELOW"]


def test_truncate_story_resets_to_single_empty_root(tmp_path):
    reset_supabase_client()
    client = get_supabase_client()
    store = SnippetStore(client=client)
    story = "Resettable"

    root = store.create_snippet(story=story, content="Opening", kind="user", parent_id=None)
    child = store.create_snippet(story=story, content="Follow-up", kind="ai", parent_id=root.id)
    store.upsert_branch(story=story, name="main", head_id=child.id)

    fresh_root = store.truncate_story(story)

    assert fresh_root.story == story
    assert fresh_root.parent_id is None
    assert fresh_root.content == ""
    assert store.list_children(story, fresh_root.id) == []
    assert store.list_branches(story) == []

    path = store.main_path(story)
    assert len(path) == 1
    assert path[0].id == fresh_root.id
