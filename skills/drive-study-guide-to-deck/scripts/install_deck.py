#!/usr/bin/env python3
"""Validate a Study Bro deck, slug its title, and install it into /decks."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    if not slug:
        raise ValueError("The title cannot be converted into a filename slug.")
    return slug[:80].rstrip("-")


def clean_deck(data: object) -> dict[str, object]:
    if not isinstance(data, dict):
        raise ValueError("Deck JSON must be an object.")

    title = data.get("title")
    cards = data.get("cards")
    if not isinstance(title, str) or not title.strip():
        raise ValueError('Deck must have a non-empty string "title".')
    if not isinstance(cards, list) or not cards:
        raise ValueError('Deck must have a non-empty "cards" array.')

    cleaned_cards = []
    for index, card in enumerate(cards, start=1):
        if not isinstance(card, dict):
            raise ValueError(f"Card {index} must be an object.")
        term = card.get("term")
        definition = card.get("definition")
        if not isinstance(term, str) or not term.strip():
            raise ValueError(f'Card {index} needs a non-empty string "term".')
        if not isinstance(definition, str) or not definition.strip():
            raise ValueError(f'Card {index} needs a non-empty string "definition".')
        cleaned_cards.append(
            {"term": term.strip(), "definition": definition.strip()}
        )

    return {"title": title.strip(), "cards": cleaned_cards}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate and install a Study Bro deck JSON file."
    )
    parser.add_argument("source", type=Path, help="Temporary source JSON file")
    parser.add_argument("decks_dir", type=Path, help="Study Bro decks directory")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace an existing deck. Use only with explicit user approval.",
    )
    args = parser.parse_args()

    try:
        with args.source.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        deck = clean_deck(data)
        filename = f"{slugify(str(deck['title']))}.json"
        args.decks_dir.mkdir(parents=True, exist_ok=True)
        destination = args.decks_dir / filename
        if destination.exists() and not args.overwrite:
            raise FileExistsError(
                f"{destination} already exists; explicit overwrite approval is required."
            )
        with destination.open("w", encoding="utf-8") as handle:
            json.dump(deck, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    print(destination.as_posix())
    print(f"cards={len(deck['cards'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
