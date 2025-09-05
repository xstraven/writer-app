SHELL := /bin/bash

.PHONY: tiptap-pack tiptap-clean tiptap-run tiptap

# Build a fresh local tarball for the TipTap wrapper
tiptap-pack:
	@echo "[tiptap] Packing local wrapper..."
	@cd frontend/tiptap-reflex-wrapper && npm pack

# Remove cached install markers and the installed wrapper to force reinstall
tiptap-clean:
	@echo "[tiptap] Cleaning Reflex web workspace..."
	@rm -f .web/reflex.install_frontend_packages.cached || true
	@rm -rf .web/node_modules/tiptap-reflex-wrapper || true

# One-shot: pack wrapper, clean cache, and run Reflex with TipTap enabled
tiptap-run: tiptap-pack tiptap-clean
	@echo "[tiptap] Starting Reflex with TipTap enabled..."
	@STORYCRAFT_USE_TIPTAP=1 uv run reflex run

# Alias
tiptap: tiptap-run

