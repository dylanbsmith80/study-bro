#!/usr/bin/env python3
"""Validate a Study Bro deck and install its JSON and optional image assets."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path


SUPPORTED_IMAGE_SUFFIXES = {".gif", ".jpeg", ".jpg", ".png", ".webp"}


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    if not slug:
        raise ValueError("The title cannot be converted into a filename slug.")
    return slug[:80].rstrip("-")


def detect_image_type(path: Path) -> str | None:
    with path.open("rb") as handle:
        header = handle.read(16)
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if header.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "webp"
    return None


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
        cleaned_card = {"term": term.strip(), "definition": definition.strip()}
        image = card.get("image")
        image_alt = card.get("imageAlt")
        if image is not None:
            if not isinstance(image, str) or not image.strip():
                raise ValueError(f'Card {index} has an invalid "image" path.')
            if image.startswith(("data:", "http://", "https://")):
                raise ValueError(
                    f"Card {index} image must be a local temporary file path, "
                    "not a data URL or remote URL."
                )
            if not isinstance(image_alt, str) or not image_alt.strip():
                raise ValueError(
                    f'Card {index} with an image needs non-empty "imageAlt" text.'
                )
            cleaned_card["image"] = image.strip()
            cleaned_card["imageAlt"] = image_alt.strip()
        elif image_alt is not None:
            raise ValueError(f'Card {index} has "imageAlt" but no "image".')
        cleaned_cards.append(cleaned_card)

    return {"title": title.strip(), "cards": cleaned_cards}


def prepare_images(
    deck: dict[str, object],
    source_dir: Path,
    assets_dir: Path,
    asset_url_prefix: str,
    deck_slug: str,
    overwrite: bool,
) -> list[tuple[Path, Path, str]]:
    prepared = []
    for index, card in enumerate(deck["cards"], start=1):
        image_value = card.get("image")
        if not image_value:
            continue

        source_image = Path(str(image_value)).expanduser()
        if not source_image.is_absolute():
            source_image = source_dir / source_image
        source_image = source_image.resolve()
        if not source_image.is_file():
            raise ValueError(f"Card {index} image does not exist: {source_image}")

        suffix = source_image.suffix.lower()
        if suffix not in SUPPORTED_IMAGE_SUFFIXES:
            raise ValueError(
                f"Card {index} image must be PNG, JPEG, GIF, or WebP: {source_image}"
            )
        detected_type = detect_image_type(source_image)
        suffix_type = "jpeg" if suffix in {".jpg", ".jpeg"} else suffix.lstrip(".")
        if detected_type != suffix_type:
            raise ValueError(
                f"Card {index} image contents do not match its extension: {source_image}"
            )

        try:
            term_slug = slugify(str(card["term"]))[:40]
        except ValueError:
            term_slug = "card"
        destination_name = f"{index:03d}-{term_slug}{suffix}"
        destination = assets_dir / deck_slug / destination_name
        if destination.exists() and not overwrite:
            raise FileExistsError(
                f"{destination} already exists; explicit overwrite approval is required."
            )

        public_path = (
            f"{asset_url_prefix.strip('/')}/{deck_slug}/{destination_name}"
        )
        prepared.append((source_image, destination, public_path))

    return prepared


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate and install a Study Bro deck JSON file."
    )
    parser.add_argument("source", type=Path, help="Temporary source JSON file")
    parser.add_argument("decks_dir", type=Path, help="Study Bro decks directory")
    parser.add_argument(
        "--assets-dir",
        type=Path,
        help="Image asset directory (default: SITE_ROOT/deck-assets)",
    )
    parser.add_argument(
        "--asset-url-prefix",
        default="deck-assets",
        help='Public image path prefix stored in deck JSON (default: "deck-assets")',
    )
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
        deck_slug = slugify(str(deck["title"]))
        filename = f"{deck_slug}.json"
        args.decks_dir.mkdir(parents=True, exist_ok=True)
        destination = args.decks_dir / filename
        if destination.exists() and not args.overwrite:
            raise FileExistsError(
                f"{destination} already exists; explicit overwrite approval is required."
            )

        assets_dir = args.assets_dir or (args.decks_dir.parent / "deck-assets")
        prepared_images = prepare_images(
            deck=deck,
            source_dir=args.source.resolve().parent,
            assets_dir=assets_dir,
            asset_url_prefix=args.asset_url_prefix,
            deck_slug=deck_slug,
            overwrite=args.overwrite,
        )
        image_paths = iter(public_path for _, _, public_path in prepared_images)
        for card in deck["cards"]:
            if card.get("image"):
                card["image"] = next(image_paths)

        for source_image, asset_destination, _ in prepared_images:
            asset_destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_image, asset_destination)

        with destination.open("w", encoding="utf-8") as handle:
            json.dump(deck, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    print(destination.as_posix())
    print(f"cards={len(deck['cards'])}")
    print(f"images={len(prepared_images)}")
    for _, asset_destination, _ in prepared_images:
        print(f"asset={asset_destination.as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
