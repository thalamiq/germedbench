"""Scoring for medical QA (multiple-choice) task."""

from dataclasses import dataclass


@dataclass
class MedQAScore:
    correct: bool  # Whether the model chose the correct answer


def score_med_qa(predicted_answer: str, correct_answer: str) -> MedQAScore:
    """Score a single MC answer. Normalizes to uppercase single letter."""
    pred = predicted_answer.strip().upper()[:1]
    gold = correct_answer.strip().upper()[:1]
    return MedQAScore(correct=pred == gold)
