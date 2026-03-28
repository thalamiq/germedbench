"""Scoring functions for ICD-10-GM coding task.

Handles code ambiguity: each gold diagnosis can have multiple acceptable codes.
A prediction matches if it hits any of the acceptable codes for that diagnosis.

Two matching levels:
- Exact Match: predicted code in {primary_code | acceptable_codes}
- Category Match: same ICD-10 3-character category (e.g. I21)
"""

from dataclasses import dataclass

from germedbench.evaluation.utils import f1, normalize_code, to_category


@dataclass
class ICD10Score:
    exact_match_precision: float
    exact_match_recall: float
    exact_match_f1: float
    category_match_precision: float
    category_match_recall: float
    category_match_f1: float
    hauptdiagnose_correct: bool


def score_icd10(
    predicted_codes: list[str],
    gold_diagnoses: list[dict],
    predicted_hauptdiagnose: str | None = None,
    gold_hauptdiagnose: str | None = None,
    gold_hauptdiagnose_acceptable: list[str] | None = None,
) -> ICD10Score:
    """Score predicted ICD-10 codes against gold standard.

    Args:
        predicted_codes: All predicted ICD-10-GM codes
        gold_diagnoses: List of dicts with 'code' and optional 'acceptable_codes'
        predicted_hauptdiagnose: Predicted primary diagnosis code
        gold_hauptdiagnose: Gold standard primary diagnosis code
        gold_hauptdiagnose_acceptable: Alternative acceptable codes for HD
    """
    pred_normalized = [normalize_code(c) for c in predicted_codes]
    pred_set = set(pred_normalized)

    # Build gold: each diagnosis has a set of acceptable codes
    gold_code_sets: list[set[str]] = []
    for diag in gold_diagnoses:
        codes = {normalize_code(diag["code"])}
        for alt in diag.get("acceptable_codes", []):
            codes.add(normalize_code(alt))
        gold_code_sets.append(codes)

    # Exact match: a prediction matches if it equals any acceptable code
    matched_golds: set[int] = set()

    for pred in pred_set:
        for i, gold_codes in enumerate(gold_code_sets):
            if i in matched_golds:
                continue
            if pred in gold_codes:
                matched_golds.add(i)
                break

    exact_tp = len(matched_golds)
    exact_precision = exact_tp / len(pred_set) if pred_set else 0.0
    exact_recall = exact_tp / len(gold_code_sets) if gold_code_sets else 0.0

    # Category-level match
    pred_cats = set(to_category(c) for c in pred_set)
    gold_cats = set()
    for gold_codes in gold_code_sets:
        for gc in gold_codes:
            gold_cats.add(to_category(gc))
    cat_tp = len(pred_cats & gold_cats)
    cat_precision = cat_tp / len(pred_cats) if pred_cats else 0.0
    cat_recall = cat_tp / len(gold_cats) if gold_cats else 0.0

    # Hauptdiagnose — check against primary + acceptable codes
    hd_correct = False
    if predicted_hauptdiagnose and gold_hauptdiagnose:
        pred_hd = normalize_code(predicted_hauptdiagnose)
        acceptable = {normalize_code(gold_hauptdiagnose)}
        for alt in gold_hauptdiagnose_acceptable or []:
            acceptable.add(normalize_code(alt))
        hd_correct = pred_hd in acceptable

    return ICD10Score(
        exact_match_precision=exact_precision,
        exact_match_recall=exact_recall,
        exact_match_f1=f1(exact_precision, exact_recall),
        category_match_precision=cat_precision,
        category_match_recall=cat_recall,
        category_match_f1=f1(cat_precision, cat_recall),
        hauptdiagnose_correct=hd_correct,
    )
