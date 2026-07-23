#!/usr/bin/env python3
"""Create a GitHub-readable link record for a Study Bro deck."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import quote


DEFAULT_BASE_URL = "https://study-bro-nu.vercel.app/"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a Markdown link record for a Study Bro deck."
    )
    parser.add_argument("deck_file", type=Path, help="Validated deck JSON file")
    parser.add_argument("links_dir", type=Path, help="Deck link records directory")
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Study Bro site URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace an existing link record. Use only with explicit user approval.",
    )
    args = parser.parse_args()

    try:
        with args.deck_file.open("r", encoding="utf-8") as handle:
            deck = json.load(handle)
        title = deck.get("title")
        cards = deck.get("cards")
        if not isinstance(title, str) or not title.strip():
            raise ValueError('Deck must have a non-empty string "title".')
        if not isinstance(cards, list) or not cards:
            raise ValueError('Deck must have a non-empty "cards" array.')
        image_count = sum(
            1
            for card in cards
            if isinstance(card, dict)
            and isinstance(card.get("image"), str)
            and card["image"].strip()
        )

        args.links_dir.mkdir(parents=True, exist_ok=True)
        destination = args.links_dir / f"{args.deck_file.stem}.md"
        if destination.exists() and not args.overwrite:
            raise FileExistsError(
                f"{destination} already exists; explicit overwrite approval is required."
            )

        base_url = args.base_url.rstrip("/") + "/"
        deck_path = f"decks/{args.deck_file.name}"
        share_url = f"{base_url}?deck={quote(deck_path, safe='/')}"
        content = (
            f"# {title.strip()}\n\n"
            f"- [Open Study Bro deck]({share_url})\n"
            f"- Deck file: [`{deck_path}`](../{deck_path})\n"
            f"- Cards: {len(cards)}\n"
            f"- Images: {image_count}\n"
        )
        destination.write_text(content, encoding="utf-8")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    print(destination.as_posix())
    print(share_url)
    print(f"images={image_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
