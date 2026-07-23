#!/usr/bin/env python3
"""Conservatively verify that a Study Bro app build supports image decks."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


REQUIRED_MARKERS = {
    "optional image alt-text schema": "imageAlt",
    "card image rendering": "card.image",
    "temporary enlargement control": "data-enlarge-card-image",
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check whether Study Bro app code contains the image-deck contract."
    )
    parser.add_argument("app_file", type=Path, help="Study Bro index.html file")
    args = parser.parse_args()

    try:
        source = args.app_file.read_text(encoding="utf-8")
    except OSError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    missing = [
        label for label, marker in REQUIRED_MARKERS.items() if marker not in source
    ]
    if missing:
        print(
            "Error: app does not advertise required image-deck support: "
            + ", ".join(missing),
            file=sys.stderr,
        )
        return 1

    print(f"app={args.app_file.as_posix()}")
    print("image_deck_support=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
