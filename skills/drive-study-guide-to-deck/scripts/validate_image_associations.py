#!/usr/bin/env python3
"""Validate hybrid image-to-card association decisions before deck publishing."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


STRUCTURAL_EVIDENCE = {
    "anchored_block",
    "explicit_caption",
    "nearby_text",
    "same_section",
    "same_table_row",
}
SEMANTIC_EVIDENCE = {"ocr_semantic", "visual_semantic"}
DECISIONS = {"attach", "exclude", "review"}
REVIEW_STATUSES = {"approved", "not_required", "pending", "rejected"}


def require_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string.")
    return value.strip()


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate image association evidence, confidence, and review state."
    )
    parser.add_argument("manifest", type=Path, help="Image association manifest JSON")
    parser.add_argument("deck_draft", type=Path, help="Draft deck JSON with card terms")
    parser.add_argument(
        "--require-publishable",
        action="store_true",
        help="Reject pending/review decisions before installation or publication.",
    )
    args = parser.parse_args()

    try:
        manifest = load_json(args.manifest)
        deck = load_json(args.deck_draft)
        if not isinstance(manifest, dict):
            raise ValueError("Association manifest must be an object.")
        require_text(manifest.get("source_title"), "source_title")
        associations = manifest.get("associations")
        if not isinstance(associations, list):
            raise ValueError('Manifest needs an "associations" array.')
        cards = deck.get("cards") if isinstance(deck, dict) else None
        if not isinstance(cards, list) or not cards:
            raise ValueError('Deck draft needs a non-empty "cards" array.')
        card_terms = {
            require_text(card.get("term"), f"Card {index} term")
            for index, card in enumerate(cards, start=1)
            if isinstance(card, dict)
        }
        if len(card_terms) != len(cards):
            raise ValueError("Deck card terms must be unique for image association.")

        seen_ids: set[str] = set()
        counts = {"attach": 0, "exclude": 0, "review": 0}
        manifest_dir = args.manifest.resolve().parent

        for index, association in enumerate(associations, start=1):
            if not isinstance(association, dict):
                raise ValueError(f"Association {index} must be an object.")
            image_id = require_text(
                association.get("image_id"), f"Association {index} image_id"
            )
            if image_id in seen_ids:
                raise ValueError(f"Duplicate image_id: {image_id}")
            seen_ids.add(image_id)

            image_value = require_text(
                association.get("image_path"), f"Association {image_id} image_path"
            )
            image_path = Path(image_value).expanduser()
            if not image_path.is_absolute():
                image_path = manifest_dir / image_path
            if not image_path.resolve().is_file():
                raise ValueError(
                    f"Association {image_id} image file does not exist: {image_path}"
                )

            decision = require_text(
                association.get("decision"), f"Association {image_id} decision"
            )
            if decision not in DECISIONS:
                raise ValueError(
                    f"Association {image_id} decision must be attach, exclude, or review."
                )
            counts[decision] += 1

            review_status = association.get("review_status", "pending")
            if review_status not in REVIEW_STATUSES:
                raise ValueError(
                    f"Association {image_id} has invalid review_status: {review_status}"
                )

            if decision == "exclude":
                require_text(
                    association.get("reason"), f"Association {image_id} exclusion reason"
                )
                continue

            if decision == "review":
                require_text(
                    association.get("reason"), f"Association {image_id} review reason"
                )
                if args.require_publishable:
                    raise ValueError(
                        f"Association {image_id} still requires a user decision."
                    )
                continue

            card_term = require_text(
                association.get("card_term"), f"Association {image_id} card_term"
            )
            if card_term not in card_terms:
                raise ValueError(
                    f'Association {image_id} references unknown card term "{card_term}".'
                )
            confidence = association.get("confidence")
            if (
                isinstance(confidence, bool)
                or not isinstance(confidence, (int, float))
                or not 0 <= confidence <= 1
            ):
                raise ValueError(
                    f"Association {image_id} confidence must be between 0 and 1."
                )

            evidence = association.get("evidence")
            if not isinstance(evidence, list) or len(evidence) < 2:
                raise ValueError(
                    f"Association {image_id} needs at least two evidence signals."
                )
            evidence_types: set[str] = set()
            for evidence_index, item in enumerate(evidence, start=1):
                if not isinstance(item, dict):
                    raise ValueError(
                        f"Association {image_id} evidence {evidence_index} "
                        "must be an object."
                    )
                evidence_type = require_text(
                    item.get("type"),
                    f"Association {image_id} evidence {evidence_index} type",
                )
                require_text(
                    item.get("detail"),
                    f"Association {image_id} evidence {evidence_index} detail",
                )
                evidence_types.add(evidence_type)

            if not evidence_types.intersection(STRUCTURAL_EVIDENCE):
                raise ValueError(
                    f"Association {image_id} needs structural evidence."
                )
            if not evidence_types.intersection(SEMANTIC_EVIDENCE):
                raise ValueError(
                    f"Association {image_id} needs visual or OCR semantic evidence."
                )

            if confidence >= 0.9:
                if review_status not in {"not_required", "approved"}:
                    raise ValueError(
                        f"High-confidence association {image_id} must be "
                        "not_required or approved."
                    )
            elif review_status != "approved":
                raise ValueError(
                    f"Association {image_id} below 0.90 confidence needs user approval."
                )

            if args.require_publishable and review_status in {"pending", "rejected"}:
                raise ValueError(
                    f"Association {image_id} is not approved for publishing."
                )
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    print(f"source={manifest['source_title']}")
    print(f"images={len(associations)}")
    for decision in ("attach", "exclude", "review"):
        print(f"{decision}={counts[decision]}")
    print("publishable=true" if counts["review"] == 0 else "publishable=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
