#!/usr/bin/env python3
"""Validate Study Bro deck structure and flag assignment-dependent wording."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("question reference", re.compile(r"\bquestions?\b", re.IGNORECASE)),
    ("problem reference", re.compile(r"\bproblems?\b", re.IGNORECASE)),
    ("part label", re.compile(r"\bpart\s+(?:[a-z]|\d+)\b", re.IGNORECASE)),
    (
        "relative source reference",
        re.compile(r"\b(?:above|below|previous\s+question)\b", re.IGNORECASE),
    ),
    (
        "assignment context",
        re.compile(r"\b(?:this\s+assignment|this\s+problem)\b", re.IGNORECASE),
    ),
    (
        "numbered source reference",
        re.compile(
            r"\b(?:page|item|exercise)\s*(?:#|no\.?\s*)?\d+\b",
            re.IGNORECASE,
        ),
    ),
)


def require_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string.")
    return value.strip()


def validate_deck(data: object) -> tuple[str, list[dict[str, object]]]:
    if not isinstance(data, dict):
        raise ValueError("Deck must be a JSON object.")
    title = require_text(data.get("title"), "title")
    cards = data.get("cards")
    if not isinstance(cards, list) or not cards:
        raise ValueError('Deck needs a non-empty "cards" array.')

    reviews: list[dict[str, object]] = []
    for index, card in enumerate(cards, start=1):
        if not isinstance(card, dict):
            raise ValueError(f"Card {index} must be an object.")
        term = require_text(card.get("term"), f"Card {index} term")
        definition = require_text(card.get("definition"), f"Card {index} definition")
        for field, text in (("term", term), ("definition", definition)):
            for rule_name, pattern in RULES:
                match = pattern.search(text)
                if match:
                    reviews.append(
                        {
                            "card": index,
                            "field": field,
                            "rule": rule_name,
                            "match": match.group(0),
                            "text": text,
                        }
                    )
    return title, reviews


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Validate Study Bro card structure and report assignment-dependent "
            "language as review candidates."
        )
    )
    parser.add_argument("deck", type=Path, help="Draft Study Bro deck JSON")
    parser.add_argument(
        "--fail-on-review",
        action="store_true",
        help="Exit with status 1 when review candidates are found.",
    )
    args = parser.parse_args()

    try:
        with args.deck.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        title, reviews = validate_deck(data)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    for review in reviews:
        print(
            "REVIEW: "
            f"card {review['card']} {review['field']} contains "
            f"{review['rule']} ({review['match']!r}): {review['text']}"
        )

    print(f"title={title}")
    print(f"cards={len(data['cards'])}")
    print(f"review_candidates={len(reviews)}")
    if reviews and args.fail_on_review:
        return 1
    print("OK: deck structure is valid; review candidates are advisory")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
