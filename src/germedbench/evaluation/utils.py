"""Shared scoring utilities used across all evaluation tasks."""

import re


def f1(precision: float, recall: float) -> float:
    """Compute F1 score from precision and recall."""
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def tokenize(name: str) -> set[str]:
    """Lowercase, strip, split into word tokens."""
    return set(name.strip().lower().split())


def names_match(a: str, b: str) -> bool:
    """Fuzzy match: one contains the other, or word-token Jaccard > 0.5."""
    a_lower = a.strip().lower()
    b_lower = b.strip().lower()
    if a_lower in b_lower or b_lower in a_lower:
        return True
    tokens_a = tokenize(a)
    tokens_b = tokenize(b)
    if not tokens_a or not tokens_b:
        return False
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union) > 0.5


def normalize_code(code: str) -> str:
    """Normalize an ICD-10 or OPS code for comparison.

    - Uppercase
    - Strip whitespace
    - Remove trailing dash placeholders (e.g. 'I21.-' -> 'I21')
    """
    c = code.strip().upper()
    c = re.sub(r"\.-$", "", c)
    return c


def to_category(code: str) -> str:
    """Extract category from ICD-10 code: 'I21.0' -> 'I21'."""
    return normalize_code(code).split(".")[0]
