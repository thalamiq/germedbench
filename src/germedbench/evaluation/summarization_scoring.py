"""Scoring functions for discharge letter summarization task.

Uses LLM-as-Judge (Gemini) to evaluate generated summaries
against a gold standard using a clinical rubric.
"""

import json
from dataclasses import dataclass

JUDGE_PROMPT = """\
Du bist ein erfahrener klinischer Qualitätsprüfer. Bewerte die folgende Zusammenfassung \
eines Entlassbriefs anhand der vier Kriterien unten.

## Originaltext (Entlassbrief)
{original_text}

## Referenz-Zusammenfassung (Gold Standard)
Hauptdiagnose: {gold_hauptdiagnose}
Therapie: {gold_therapie}
Procedere: {gold_procedere}
Offene Fragen: {gold_offene_fragen}

## Zu bewertende Zusammenfassung (Modell-Output)
Hauptdiagnose: {pred_hauptdiagnose}
Therapie: {pred_therapie}
Procedere: {pred_procedere}
Offene Fragen: {pred_offene_fragen}

## Bewertungskriterien (jeweils 1-5 Punkte)

**Faktentreue** (1-5): Sind alle genannten Fakten korrekt und im Originaltext belegbar?
- 5: Alle Fakten korrekt
- 3: Einzelne Ungenauigkeiten
- 1: Mehrere falsche Fakten

**Vollständigkeit** (1-5): Sind alle klinisch relevanten Informationen enthalten?
- 5: Alle wichtigen Punkte abgedeckt
- 3: Wesentliche Punkte fehlen
- 1: Stark unvollständig

**Halluzinationsfreiheit** (1-5): Enthält die Zusammenfassung Informationen, die nicht im Original stehen?
- 5: Keine Halluzinationen
- 3: Einzelne hinzugedichtete Details
- 1: Umfangreiche Halluzinationen

**Formatkonformität** (1-5): Entspricht die Zusammenfassung dem erwarteten strukturierten Format?
- 5: Perfekt strukturiert, klinisch angemessener Stil
- 3: Teilweise strukturiert, akzeptabler Stil
- 1: Unstrukturiert oder unbrauchbar

Antworte ausschließlich im folgenden JSON-Format:
{{
  "faktentreue": <1-5>,
  "vollstaendigkeit": <1-5>,
  "halluzinationsfreiheit": <1-5>,
  "formatkonformitaet": <1-5>
}}
"""


@dataclass
class SummarizationScore:
    faktentreue: float
    vollstaendigkeit: float
    halluzinationsfreiheit: float
    formatkonformitaet: float
    overall: float


def _build_prompt(
    original_text: str,
    gold_summary: dict,
    predicted_summary: dict,
) -> str:
    return JUDGE_PROMPT.format(
        original_text=original_text,
        gold_hauptdiagnose=gold_summary.get("hauptdiagnose", ""),
        gold_therapie=gold_summary.get("therapie", ""),
        gold_procedere=gold_summary.get("procedere", ""),
        gold_offene_fragen=gold_summary.get("offene_fragen", ""),
        pred_hauptdiagnose=predicted_summary.get("hauptdiagnose", ""),
        pred_therapie=predicted_summary.get("therapie", ""),
        pred_procedere=predicted_summary.get("procedere", ""),
        pred_offene_fragen=predicted_summary.get("offene_fragen", ""),
    )


def _to_score(scores: dict) -> SummarizationScore:
    f = float(scores["faktentreue"])
    v = float(scores["vollstaendigkeit"])
    h = float(scores["halluzinationsfreiheit"])
    k = float(scores["formatkonformitaet"])
    return SummarizationScore(
        faktentreue=f,
        vollstaendigkeit=v,
        halluzinationsfreiheit=h,
        formatkonformitaet=k,
        overall=(f + v + h + k) / 4,
    )


def judge_summary_gemini(
    original_text: str,
    gold_summary: dict,
    predicted_summary: dict,
    client: "google.genai.Client",  # type: ignore
    model: str,
) -> SummarizationScore:
    """Evaluate using Gemini as judge."""
    from google.genai.types import GenerateContentConfig

    prompt = _build_prompt(original_text, gold_summary, predicted_summary)
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
    return _to_score(scores)


