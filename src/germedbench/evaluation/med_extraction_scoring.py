"""Scoring functions for medication extraction task.

Fully automated — matches predicted medications against gold standard
by Wirkstoff (fuzzy), then checks Dosis and Frequenz.
"""

from dataclasses import dataclass

from germedbench.evaluation.utils import f1, match_names_llm


@dataclass
class MedExtractionScore:
    wirkstoff_f1: float  # F1 on Wirkstoff matching alone
    wirkstoff_precision: float
    wirkstoff_recall: float
    exact_f1: float  # F1 requiring Wirkstoff + Dosis + Frequenz all correct
    partial_f1: float  # F1 requiring Wirkstoff + at least Dosis or Frequenz


def _normalize_str(s: str) -> str:
    """Normalize string for comparison: lowercase, strip, collapse spaces, normalize units."""
    import re
    if not s:
        return ""
    s = s.strip().lower()
    # Remove parenthetical notes: "1-0-0 (tapering)" -> "1-0-0"
    s = re.sub(r"\s*\(.*?\)\s*", " ", s)
    # Normalize decimal separator: "47,5" -> "47.5"
    s = re.sub(r"(\d),(\d)", r"\1.\2", s)
    # Insert space between number and unit: "40mg" -> "40 mg", "4.5g" -> "4.5 g"
    s = re.sub(r"(\d)\s*([a-zµ])", r"\1 \2", s)
    return " ".join(s.split())


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
    predicted = predicted or []
    gold = gold or []

    # Match wirkstoffe using LLM-assisted matching
    gold_names = [g.get("wirkstoff", "") for g in gold]
    pred_names = [p.get("wirkstoff", "") for p in predicted]
    pairs = match_names_llm(gold_names, pred_names, domain="medications")

    wirkstoff_tp = len(pairs)
    partial_tp = 0
    exact_tp = 0

    for gi, pi in pairs:
        pred = predicted[pi]
        g = gold[gi]

        dosis_ok = _strings_match(pred.get("dosis", ""), g.get("dosis", ""))
        freq_ok = _strings_match(pred.get("frequenz", ""), g.get("frequenz", ""))

        if dosis_ok or freq_ok:
            partial_tp += 1
        if dosis_ok and freq_ok:
            exact_tp += 1

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
