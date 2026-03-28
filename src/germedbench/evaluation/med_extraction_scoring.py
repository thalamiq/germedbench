"""Scoring functions for medication extraction task.

Fully automated — matches predicted medications against gold standard
by Wirkstoff (fuzzy), then checks Dosis and Frequenz.
"""

from dataclasses import dataclass

from germedbench.evaluation.utils import f1, names_match


@dataclass
class MedExtractionScore:
    wirkstoff_f1: float  # F1 on Wirkstoff matching alone
    wirkstoff_precision: float
    wirkstoff_recall: float
    exact_f1: float  # F1 requiring Wirkstoff + Dosis + Frequenz all correct
    partial_f1: float  # F1 requiring Wirkstoff + at least Dosis or Frequenz


def _normalize_str(s: str) -> str:
    """Normalize string for comparison: lowercase, strip, collapse spaces."""
    return " ".join(s.strip().lower().split())


def _strings_match(a: str, b: str) -> bool:
    """Exact match after normalization."""
    if not a or not b:
        return False
    return _normalize_str(a) == _normalize_str(b)


def score_med_extraction(
    predicted: list[dict],
    gold: list[dict],
) -> MedExtractionScore:
    """Score predicted medications against gold standard.

    Three levels:
    - wirkstoff: fuzzy name match only
    - partial: wirkstoff + (dosis OR frequenz correct)
    - exact: wirkstoff + dosis + frequenz all correct
    """
    matched_gold: set[int] = set()
    wirkstoff_tp = 0
    partial_tp = 0
    exact_tp = 0

    for pred in predicted:
        pred_wirkstoff = pred.get("wirkstoff", "")
        pred_dosis = pred.get("dosis", "")
        pred_frequenz = pred.get("frequenz", "")

        for gi, g in enumerate(gold):
            if gi in matched_gold:
                continue
            if not names_match(pred_wirkstoff, g.get("wirkstoff", "")):
                continue

            matched_gold.add(gi)
            wirkstoff_tp += 1

            dosis_ok = _strings_match(pred_dosis, g.get("dosis", ""))
            freq_ok = _strings_match(pred_frequenz, g.get("frequenz", ""))

            if dosis_ok or freq_ok:
                partial_tp += 1
            if dosis_ok and freq_ok:
                exact_tp += 1
            break

    n_pred = len(predicted)
    n_gold = len(gold)

    w_p = wirkstoff_tp / n_pred if n_pred else 0.0
    w_r = wirkstoff_tp / n_gold if n_gold else 0.0

    p_p = partial_tp / n_pred if n_pred else 0.0
    p_r = partial_tp / n_gold if n_gold else 0.0

    e_p = exact_tp / n_pred if n_pred else 0.0
    e_r = exact_tp / n_gold if n_gold else 0.0

    return MedExtractionScore(
        wirkstoff_f1=f1(w_p, w_r),
        wirkstoff_precision=w_p,
        wirkstoff_recall=w_r,
        exact_f1=f1(e_p, e_r),
        partial_f1=f1(p_p, p_r),
    )
