"""Scoring functions for clinical reasoning / differential diagnosis task.

Hybrid evaluation:
- Automated: DDx list matching (Top-1, Top-3, overlap F1)
- LLM-as-Judge (Gemini): reasoning quality, DDx plausibility, red-flag awareness
"""

import json
from dataclasses import dataclass

from germedbench.evaluation.utils import f1, names_match

JUDGE_PROMPT = """\
Du bist ein erfahrener klinischer Prüfer. Bewerte die folgende Differentialdiagnostik \
eines KI-Modells anhand der drei Kriterien unten.

## Klinische Fallvignette
{vignette_text}

## Referenz-Differentialdiagnosen (Gold Standard)
{gold_ddx_formatted}

## Bestätigte Enddiagnose
{correct_diagnosis}

## Zu bewertende Differentialdiagnosen (Modell-Output)
{predicted_ddx_formatted}

## Bewertungskriterien (jeweils 1-5 Punkte)

**Reasoning-Qualität** (1-5): Ist die klinische Begründung für jede Differentialdiagnose \
nachvollziehbar, korrekt und auf die Befunde im Fall bezogen?
- 5: Alle Begründungen klinisch exzellent und befundbasiert
- 3: Überwiegend korrekt, einzelne Lücken oder generische Aussagen
- 1: Begründungen falsch, nicht nachvollziehbar oder fehlend

**DDx-Plausibilität** (1-5): Ist die Reihenfolge der Differentialdiagnosen klinisch sinnvoll? \
Steht die wahrscheinlichste Diagnose an erster Stelle?
- 5: Optimale Rangfolge, klinisch nachvollziehbar
- 3: Grundsätzlich sinnvoll, aber mit Fehlpriorisierungen
- 1: Reihenfolge klinisch nicht nachvollziehbar

**Red-Flag-Bewusstsein** (1-5): Werden gefährliche Differentialdiagnosen, die dringend \
ausgeschlossen werden müssen, angemessen berücksichtigt?
- 5: Alle relevanten Red Flags erkannt und priorisiert
- 3: Teilweise erkannt, einzelne wichtige fehlen
- 1: Gefährliche Diagnosen nicht berücksichtigt

Antworte ausschließlich im folgenden JSON-Format:
{{
  "reasoning_quality": <1-5>,
  "ddx_plausibility": <1-5>,
  "red_flag_awareness": <1-5>
}}
"""


@dataclass
class ClinicalReasoningScore:
    # Automated metrics (0.0 - 1.0)
    top1_accuracy: float
    top3_recall: float
    ddx_overlap_f1: float
    # LLM-as-Judge metrics (1-5)
    reasoning_quality: float
    ddx_plausibility: float
    red_flag_awareness: float
    # Composite (1-5 scale)
    overall: float


def score_automated(
    predicted_diagnoses: list[dict],
    gold_diagnoses: list[dict],
    correct_diagnosis: str,
) -> tuple[float, float, float]:
    """Return (top1_accuracy, top3_recall, ddx_overlap_f1)."""
    pred_names = [d.get("name", "") for d in predicted_diagnoses]
    gold_names = [d.get("name", "") for d in gold_diagnoses]

    top1 = 1.0 if pred_names and names_match(pred_names[0], correct_diagnosis) else 0.0

    top3 = 0.0
    for name in pred_names[:3]:
        if names_match(name, correct_diagnosis):
            top3 = 1.0
            break

    # DDx overlap F1 (set-level, fuzzy)
    matched_gold: set[int] = set()
    matched_pred: set[int] = set()
    for pi, pn in enumerate(pred_names):
        for gi, gn in enumerate(gold_names):
            if gi in matched_gold:
                continue
            if names_match(pn, gn):
                matched_gold.add(gi)
                matched_pred.add(pi)
                break

    precision = len(matched_pred) / len(pred_names) if pred_names else 0.0
    recall = len(matched_gold) / len(gold_names) if gold_names else 0.0

    return top1, top3, f1(precision, recall)


def _format_ddx_list(diagnoses: list[dict], include_reasoning: bool = False) -> str:
    lines = []
    for i, d in enumerate(diagnoses, 1):
        line = f"{i}. {d.get('name', '?')} ({d.get('likelihood', '?')})"
        if include_reasoning and d.get("reasoning"):
            line += f"\n   Begründung: {d['reasoning']}"
        elif d.get("key_findings"):
            line += f"\n   Befunde: {', '.join(d['key_findings'])}"
        lines.append(line)
    return "\n".join(lines)


def _build_prompt(
    vignette_text: str,
    gold_diagnoses: list[dict],
    correct_diagnosis: str,
    predicted_diagnoses: list[dict],
) -> str:
    return JUDGE_PROMPT.format(
        vignette_text=vignette_text,
        gold_ddx_formatted=_format_ddx_list(gold_diagnoses),
        correct_diagnosis=correct_diagnosis,
        predicted_ddx_formatted=_format_ddx_list(predicted_diagnoses, include_reasoning=True),
    )


def _to_score(
    judge_scores: dict,
    top1: float,
    top3: float,
    ddx_f1: float,
) -> ClinicalReasoningScore:
    rq = float(judge_scores["reasoning_quality"])
    dp = float(judge_scores["ddx_plausibility"])
    rf = float(judge_scores["red_flag_awareness"])

    auto_normalized = (top1 * 5 + top3 * 5 + ddx_f1 * 5) / 3
    judge_avg = (rq + dp + rf) / 3
    overall = 0.4 * auto_normalized + 0.6 * judge_avg

    return ClinicalReasoningScore(
        top1_accuracy=top1,
        top3_recall=top3,
        ddx_overlap_f1=ddx_f1,
        reasoning_quality=rq,
        ddx_plausibility=dp,
        red_flag_awareness=rf,
        overall=overall,
    )


def judge_clinical_reasoning_gemini(
    vignette_text: str,
    gold_diagnoses: list[dict],
    correct_diagnosis: str,
    predicted_diagnoses: list[dict],
    client: "google.genai.Client",  # type: ignore
    model: str,
) -> ClinicalReasoningScore:
    """Evaluate using Gemini as judge."""
    from google.genai.types import GenerateContentConfig

    top1, top3, ddx_f1 = score_automated(predicted_diagnoses, gold_diagnoses, correct_diagnosis)

    prompt = _build_prompt(vignette_text, gold_diagnoses, correct_diagnosis, predicted_diagnoses)
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
        ),
    )
    parsed = json.loads(response.text)
    scores = parsed[0] if isinstance(parsed, list) else parsed
    return _to_score(scores, top1, top3, ddx_f1)
