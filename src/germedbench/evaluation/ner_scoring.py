"""Scoring functions for clinical NER (entity extraction) task.

Fully automated evaluation — no LLM-as-Judge needed.
Per-entity-type F1 + micro-averaged F1 across all types.
"""

from dataclasses import dataclass

from germedbench.evaluation.utils import f1, names_match, normalize_code


ENTITY_TYPES = ["diagnose", "prozedur", "medikament", "laborwert"]


@dataclass
class NERScore:
    micro_f1: float
    micro_precision: float
    micro_recall: float
    diagnose_f1: float
    prozedur_f1: float
    medikament_f1: float
    laborwert_f1: float


def _entities_match(pred: dict, gold: dict) -> bool:
    """Check if a predicted entity matches a gold entity of the same type."""
    typ = gold.get("typ", "")

    if not names_match(pred.get("name", ""), gold.get("name", "")):
        return False

    # For diagnose/prozedur: also check code if both have one
    if typ in ("diagnose", "prozedur"):
        pred_code = pred.get("code", "")
        gold_code = gold.get("code", "")
        if pred_code and gold_code:
            return normalize_code(pred_code) == normalize_code(gold_code)

    # For laborwert: also check parameter name match
    if typ == "laborwert":
        pred_param = pred.get("parameter", "")
        gold_param = gold.get("parameter", "")
        if pred_param and gold_param:
            return names_match(pred_param, gold_param)

    return True


def _score_type(
    predicted: list[dict],
    gold: list[dict],
) -> tuple[int, int, int]:
    """Score entities of a single type. Returns (tp, n_pred, n_gold)."""
    matched_gold: set[int] = set()
    tp = 0

    for pred in predicted:
        for gi, g in enumerate(gold):
            if gi in matched_gold:
                continue
            if _entities_match(pred, g):
                matched_gold.add(gi)
                tp += 1
                break

    return tp, len(predicted), len(gold)


def score_ner(
    predicted_entities: list[dict],
    gold_entities: list[dict],
) -> NERScore:
    """Score predicted entities against gold standard."""
    pred_by_type: dict[str, list[dict]] = {t: [] for t in ENTITY_TYPES}
    gold_by_type: dict[str, list[dict]] = {t: [] for t in ENTITY_TYPES}

    for e in predicted_entities:
        typ = e.get("typ", "")
        if typ in pred_by_type:
            pred_by_type[typ].append(e)

    for e in gold_entities:
        typ = e.get("typ", "")
        if typ in gold_by_type:
            gold_by_type[typ].append(e)

    type_scores: dict[str, float] = {}
    total_tp = 0
    total_pred = 0
    total_gold = 0

    for typ in ENTITY_TYPES:
        tp, n_pred, n_gold = _score_type(pred_by_type[typ], gold_by_type[typ])
        total_tp += tp
        total_pred += n_pred
        total_gold += n_gold

        p = tp / n_pred if n_pred else 0.0
        r = tp / n_gold if n_gold else 0.0
        type_scores[typ] = f1(p, r)

    micro_p = total_tp / total_pred if total_pred else 0.0
    micro_r = total_tp / total_gold if total_gold else 0.0

    return NERScore(
        micro_f1=f1(micro_p, micro_r),
        micro_precision=micro_p,
        micro_recall=micro_r,
        diagnose_f1=type_scores["diagnose"],
        prozedur_f1=type_scores["prozedur"],
        medikament_f1=type_scores["medikament"],
        laborwert_f1=type_scores["laborwert"],
    )
