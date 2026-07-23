#!/usr/bin/env python3
"""Validate published image references for one Study Bro deck."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path, PurePosixPath


SUPPORTED_IMAGE_SUFFIXES = {".gif", ".jpeg", ".jpg", ".png", ".webp"}


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


def fail(message: str) -> None:
    raise ValueError(message)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate image paths, files, formats, and alt text for a Study Bro deck."
    )
    parser.add_argument("deck_file", type=Path, help="Installed deck JSON file")
    parser.add_argument("site_root", type=Path, help="Study Bro repository/site root")
    parser.add_argument(
        "--asset-url-prefix",
        default="deck-assets",
        help='Expected public image path prefix (default: "deck-assets")',
    )
    parser.add_argument(
        "--allow-orphans",
        action="store_true",
        help="Report but do not reject unreferenced files in this deck's asset folder.",
    )
    args = parser.parse_args()

    try:
        with args.deck_file.open("r", encoding="utf-8") as handle:
            deck = json.load(handle)
        cards = deck.get("cards") if isinstance(deck, dict) else None
        if not isinstance(cards, list) or not cards:
            fail('Deck must have a non-empty "cards" array.')

        site_root = args.site_root.resolve()
        expected_prefix = PurePosixPath(args.asset_url_prefix.strip("/"))
        expected_folder = expected_prefix / args.deck_file.stem
        referenced_paths: set[PurePosixPath] = set()

        for index, card in enumerate(cards, start=1):
            if not isinstance(card, dict):
                fail(f"Card {index} must be an object.")
            image = card.get("image")
            image_alt = card.get("imageAlt")
            if image is None:
                if image_alt is not None:
                    fail(f'Card {index} has "imageAlt" but no "image".')
                continue
            if not isinstance(image, str) or not image.strip():
                fail(f'Card {index} has an invalid "image" path.')
            if not isinstance(image_alt, str) or not image_alt.strip():
                fail(f'Card {index} with an image needs non-empty "imageAlt" text.')
            if "\\" in image or image.startswith(("/", "data:", "http://", "https://")):
                fail(f"Card {index} image must be a safe relative site path: {image}")

            public_path = PurePosixPath(image)
            if ".." in public_path.parts or public_path.parent != expected_folder:
                fail(
                    f"Card {index} image must be inside {expected_folder.as_posix()}/: "
                    f"{image}"
                )
            suffix = public_path.suffix.lower()
            if suffix not in SUPPORTED_IMAGE_SUFFIXES:
                fail(f"Card {index} image has an unsupported extension: {image}")

            local_path = (site_root / Path(*public_path.parts)).resolve()
            try:
                local_path.relative_to(site_root)
            except ValueError:
                fail(f"Card {index} image escapes the site root: {image}")
            if not local_path.is_file():
                fail(f"Card {index} image file is missing: {local_path}")

            detected_type = detect_image_type(local_path)
            suffix_type = "jpeg" if suffix in {".jpg", ".jpeg"} else suffix.lstrip(".")
            if detected_type != suffix_type:
                fail(f"Card {index} image contents do not match its extension: {image}")
            referenced_paths.add(public_path)

        asset_folder = site_root / Path(*expected_folder.parts)
        actual_paths: set[PurePosixPath] = set()
        if asset_folder.exists():
            for path in asset_folder.rglob("*"):
                if path.is_file():
                    actual_paths.add(
                        PurePosixPath(path.relative_to(site_root).as_posix())
                    )
        orphaned = sorted(actual_paths - referenced_paths, key=str)
        if orphaned and not args.allow_orphans:
            fail(
                "Unreferenced image assets found: "
                + ", ".join(path.as_posix() for path in orphaned)
            )
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    print(f"deck={args.deck_file.as_posix()}")
    print(f"images={len(referenced_paths)}")
    print(f"orphans={len(orphaned)}")
    for path in sorted(referenced_paths, key=str):
        print(f"image={path.as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
