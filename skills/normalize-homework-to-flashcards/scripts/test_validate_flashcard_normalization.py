#!/usr/bin/env python3
"""Exercise normalization validation with representative academic-source cases."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("validate_flashcard_normalization.py")
SPEC = importlib.util.spec_from_file_location("normalization_validator", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load validator: {SCRIPT_PATH}")
VALIDATOR = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = VALIDATOR
SPEC.loader.exec_module(VALIDATOR)


def deck(*cards: tuple[str, str]) -> dict[str, object]:
    return {
        "title": "Fixture Deck",
        "cards": [
            {"term": term, "definition": definition}
            for term, definition in cards
        ],
    }


class NormalizationValidatorTests(unittest.TestCase):
    def review_rules(self, data: dict[str, object]) -> set[str]:
        _, reviews = VALIDATOR.validate_deck(data)
        return {review["rule"] for review in reviews}

    def test_completed_study_guide_remains_clean(self) -> None:
        data = deck(
            (
                "Mitosis",
                "Cell division that produces two genetically identical daughter cells.",
            )
        )
        self.assertEqual(self.review_rules(data), set())

    def test_homework_and_multipart_references_are_flagged(self) -> None:
        data = deck(
            (
                "Question 5",
                "In Part B, calculate the force on the proton.",
            )
        )
        self.assertEqual(
            self.review_rules(data), {"question reference", "part label"}
        )

    def test_mixed_source_flags_only_assignment_like_card(self) -> None:
        data = deck(
            (
                "Inflation",
                "A general rise in prices and decline in purchasing power.",
            ),
            (
                "Purchasing power in the problem",
                "Use the graph above to answer.",
            ),
        )
        _, reviews = VALIDATOR.validate_deck(data)
        self.assertTrue(reviews)
        self.assertTrue(all(review["card"] == 2 for review in reviews))

    def test_self_contained_numerical_cards_are_clean(self) -> None:
        data = deck(
            (
                "How is net force calculated from mass and acceleration?",
                "Apply Newton's second law, F_net = ma.",
            ),
            (
                "What is the net force on a 2 kg object accelerating at 3 m/s²?",
                "F_net = (2 kg)(3 m/s²) = 6 N.",
            ),
        )
        self.assertEqual(self.review_rules(data), set())

    def test_diagram_dependent_reference_is_flagged(self) -> None:
        data = deck(
            (
                "Magnetic-field direction",
                "Determine the direction at point P using the diagram below.",
            )
        )
        self.assertIn("relative source reference", self.review_rules(data))

    def test_ambiguous_previous_question_reference_is_flagged(self) -> None:
        data = deck(
            (
                "Final velocity",
                "Calculate it using values from the previous question.",
            )
        )
        self.assertIn("relative source reference", self.review_rules(data))


if __name__ == "__main__":
    unittest.main()
