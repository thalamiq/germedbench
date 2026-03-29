"""Scoring functions for discharge letter summarization task.

Uses LLM-as-Judge (Gemini) to evaluate generated summaries
against a gold standard using a strict clinical rubric with
three dimensions: Faktentreue, Vollständigkeit, Klinische Präzision.
"""

import json
from dataclasses import dataclass

JUDGE_PROMPT = """\
Du bist ein strenger klinischer Qualitätsprüfer mit dem Auftrag, Zusammenfassungen \
von Entlassbriefen kritisch zu bewerten. Dein Ziel ist es, echte Qualitätsunterschiede \
aufzudecken — vergib hohe Punkte nur bei nachweislich exzellenter Leistung.

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

Bewerte jede Dimension einzeln. Nutze die volle Skala — eine 5 ist nur bei \
fehlerfreier, klinisch exzellenter Leistung gerechtfertigt. Jeder noch so kleine \
Mangel muss sich im Score widerspiegeln.

### Faktentreue (1-5)
Sind ALLE genannten Fakten korrekt und im Originaltext belegbar? \
Halluzinierte oder erfundene Informationen zählen als schwere Fehler.
- 5: Jede Aussage ist korrekt und im Original belegbar. Keine Halluzinationen.
- 4: Alle wesentlichen Fakten korrekt, aber eine einzelne Ungenauigkeit (z.B. ungenaue Dosisangabe, leicht unpräziser Zeitverlauf).
- 3: Überwiegend korrekt, aber 2-3 relevante Fehler oder eine einzelne Halluzination (Information, die nicht im Original steht).
- 2: Mehrere Fehler oder Halluzinationen, die das klinische Bild verzerren.
- 1: Grundlegende Fakten falsch oder umfangreiche Halluzinationen.

### Vollständigkeit (1-5)
Sind alle klinisch relevanten Informationen aus dem Gold Standard enthalten? \
Vergleiche Punkt für Punkt: Diagnosen, Therapiedetails, Medikamente mit Dosierungen, \
Laborwerte, Befunde, Nachsorgetermine.
- 5: Alle Kernpunkte des Gold Standards sind enthalten, inklusive spezifischer Werte (LVEF, Laborwerte, Dosierungen, Zeitangaben).
- 4: Die meisten Kernpunkte sind enthalten, aber 1-2 klinisch relevante Details fehlen (z.B. eine Medikamentendosis, ein Laborwert, ein Nachsorgetermin).
- 3: Die Hauptdiagnose und grobe Therapie sind korrekt, aber mehrere wichtige Details fehlen (Medikamentennamen ohne Dosis, fehlende Befunde, fehlende Nachsorge).
- 2: Nur die oberflächliche Kernaussage ist erkennbar. Wesentliche Therapie- oder Befunddetails fehlen komplett.
- 1: Stark unvollständig oder kaum Bezug zum Gold Standard.

### Klinische Präzision (1-5)
Ist die Zusammenfassung spezifisch und klinisch verwertbar? \
Generische Formulierungen, die nichts Konkretes aussagen, werden bestraft. \
Die Zusammenfassung muss einem übernehmenden Arzt konkret weiterhelfen.
- 5: Durchgehend spezifisch — konkrete Medikamentennamen mit Dosen, quantitative Befunde (z.B. "LVEF 35%", "CRP 45 mg/l"), präzise Nachsorgeempfehlungen mit Zeitangaben.
- 4: Überwiegend spezifisch, aber an 1-2 Stellen unnötig vage (z.B. "medikamentöse Therapie eingeleitet" statt konkrete Medikamente, "Labor kontrollieren" statt spezifische Parameter).
- 3: Mischung aus spezifischen und generischen Aussagen. Mehrere Stellen, an denen konkrete Informationen aus dem Originaltext durch vage Formulierungen ersetzt wurden.
- 2: Überwiegend generisch. Könnte auf viele verschiedene Patienten zutreffen. Kaum spezifische Werte oder Medikamente genannt.
- 1: Vollständig generisch oder unbrauchbar für die klinische Weiterbehandlung.

Antworte ausschließlich im folgenden JSON-Format:
{{
  "faktentreue": <1-5>,
  "vollstaendigkeit": <1-5>,
  "klinische_praezision": <1-5>
}}
"""


@dataclass
class SummarizationScore:
    faktentreue: float
    vollstaendigkeit: float
    klinische_praezision: float
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
    p = float(scores["klinische_praezision"])
    return SummarizationScore(
        faktentreue=f,
        vollstaendigkeit=v,
        klinische_praezision=p,
        overall=(f + v + p) / 3,
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
