#!/usr/bin/env python3
"""Validate the basic structure of a Markdown study guide."""

from __future__ import annotations

import re
import sys
from pathlib import Path


REQUIRED_SECTIONS = (
    "scope and priorities",
    "common confusions and distinctions",
    "final review checklist",
    "practice questions",
    "answer key",
)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_study_guide.py GUIDE.md", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        return 2

    text = path.read_text(encoding="utf-8")
    errors: list[str] = []
    warnings: list[str] = []

    h1 = re.findall(r"(?m)^# (.+)$", text)
    h2 = [value.strip().lower() for value in re.findall(r"(?m)^## (.+)$", text)]

    if len(h1) != 1:
        errors.append(f"expected exactly one H1 title; found {len(h1)}")
    elif "study guide" not in h1[0].lower():
        warnings.append("H1 title does not contain 'Study Guide'")

    for section in REQUIRED_SECTIONS:
        if section not in h2:
            errors.append(f"missing required H2 section: {section.title()}")

    question_block = section_text(text, "Practice Questions")
    answer_block = section_text(text, "Answer Key")
    question_numbers = set(re.findall(r"(?m)^\s*(\d+)[.)]\s+", question_block))
    answer_numbers = set(re.findall(r"(?m)^\s*(\d+)[.)]\s+", answer_block))

    if len(question_numbers) < 4:
        warnings.append(f"only {len(question_numbers)} numbered practice questions found")
    if question_numbers != answer_numbers:
        errors.append("practice-question numbers and answer-key numbers do not match")

    if re.search(r"(?i)\b(TODO|TBD|lorem ipsum)\b", text):
        warnings.append("placeholder text found")

    for item in errors:
        print(f"ERROR: {item}")
    for item in warnings:
        print(f"WARNING: {item}")

    if errors:
        return 1
    print("OK: study guide structure is valid")
    return 0


def section_text(text: str, heading: str) -> str:
    match = re.search(
        rf"(?ims)^## {re.escape(heading)}[ \t]*\n(.*?)(?=^## |\Z)", text
    )
    return match.group(1) if match else ""


if __name__ == "__main__":
    raise SystemExit(main())
