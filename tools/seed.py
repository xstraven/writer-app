from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict

import httpx


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed Storycraft with local sample data")
    p.add_argument("--story", required=True, help="Story name to seed (e.g., 'Test Story 1')")
    p.add_argument(
        "--base",
        default=os.environ.get("STORYCRAFT_API_BASE", "http://127.0.0.1:8001"),
        help="Storycraft API base URL",
    )
    p.add_argument("--chunks", default=None, help="Override chunks filename under data/samples/")
    p.add_argument("--lore", default=None, help="Override lore filename under data/samples/")
    p.add_argument("--no-clear", dest="clear", action="store_false", help="Do not clear existing data for story")
    p.add_argument("--no-split", dest="split", action="store_false", help="Do not split chunks file by blank line")
    p.add_argument("--purge", action="store_true", help="Purge ALL stories and lore before seeding")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    payload: Dict[str, Any] = {
        "story": args.story,
        "clear_existing": bool(args.clear),
        "split_paragraphs": bool(args.split),
    }
    if args.purge:
        payload["purge"] = True
    if args.chunks:
        payload["chunks_filename"] = args.chunks
    if args.lore:
        payload["lore_filename"] = args.lore
    url = args.base.rstrip("/") + "/api/dev/seed"
    try:
        with httpx.Client(timeout=60) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
        print(json.dumps(data, indent=2))
        return 0
    except Exception as e:
        print(f"Error seeding data: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
