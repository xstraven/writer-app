def test_reflex_app_import_and_compile():
    # Ensure rxconfig is loaded (from file) and app module exists, then dry-run compile.
    import importlib.util, os
    rx_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "rxconfig.py")
    if os.path.exists(rx_path):
        spec = importlib.util.spec_from_file_location("rxconfig", rx_path)
        mod = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(mod)  # type: ignore
    mod = __import__("storycraft_frontend.storycraft_frontend", fromlist=["app"])
    assert hasattr(mod, "app"), "Reflex app object not found"
    app = getattr(mod, "app")
    # Dry-run compile to catch component API errors without starting servers.
    app._compile(prerender_routes=set(), dry_run=True)
