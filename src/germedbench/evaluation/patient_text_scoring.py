"""Scoring functions for patient text simplification task.

Uses LLM-as-Judge (Gemini) to evaluate patient-friendly explanations
of complex clinical texts against a gold standard.
"""

import json
from dataclasses import dataclass

JUDGE_PROMPT = """\
Du bist ein erfahrener Arzt mit Spezialisierung auf Patientenkommunikation. \
Bewerte die folgende Patienten-Erklärung eines komplexen medizinischen Textes \
anhand der drei Kriterien unten. Sei streng — vergib hohe Punkte nur bei \
nachweislich exzellenter Leistung.

## Medizinischer Originaltext
{original_text}

## Referenz-Erklärung (Gold Standard)
{gold_explanation}

## Zu bewertende Erklärung (Modell-Output)
{pred_explanation}

## Bewertungskriterien (jeweils 1-5 Punkte)

### Verständlichkeit (1-5)
Ist der Text für einen medizinischen Laien ohne Vorkenntnisse verständlich? \
Jeder medizinische Fachbegriff, der ohne Erklärung verwendet wird, ist ein Fehler.
- 5: Vollständig laienverständlich. Alle Fachbegriffe sind erklärt oder durch Alltagssprache ersetzt. Ein Patient ohne medizinische Vorkenntnisse versteht den Text sofort.
- 4: Weitgehend verständlich, aber 1-2 Fachbegriffe sind nicht ausreichend erklärt oder die Erklärung verwendet an einzelnen Stellen unnötig komplizierte Satzstrukturen.
- 3: Teilweise verständlich. Mehrere Fachbegriffe sind unerklärt, oder die Satzstruktur ist stellenweise zu komplex für Laien.
- 2: Überwiegend medizinische Sprache. Ein Laie würde große Teile nicht verstehen.
- 1: Praktisch unveränderte Fachsprache oder unverständlich.

### Medizinische Korrektheit (1-5)
Sind alle medizinischen Sachverhalte inhaltlich korrekt wiedergegeben? \
Vereinfachung darf nicht zu falschen oder irreführenden Aussagen führen.
- 5: Alle medizinischen Fakten sind korrekt vereinfacht. Keine inhaltlichen Fehler, keine irreführenden Vereinfachungen, keine Halluzinationen.
- 4: Im Wesentlichen korrekt, aber eine einzelne Vereinfachung ist leicht ungenau (z.B. "Blutverdünner" für einen Thrombozytenaggregationshemmer — akzeptabel, aber nicht perfekt).
- 3: Überwiegend korrekt, aber 2-3 Ungenauigkeiten durch Vereinfachung, oder eine einzelne medizinisch relevante Falschaussage.
- 2: Mehrere medizinisch relevante Fehler oder eine grob falsche Aussage, die den Patienten in die Irre führen könnte.
- 1: Grundlegend falsche medizinische Aussagen oder umfangreiche Halluzinationen.

### Vollständigkeit (1-5)
Sind alle klinisch relevanten Informationen aus dem Originaltext kommuniziert? \
Vergleiche mit dem Gold Standard: Welche Punkte wurden aufgegriffen, welche fehlen?
- 5: Alle wesentlichen Punkte des Gold Standards sind abgedeckt: Diagnose, Befunde, Therapie, Empfehlungen, offene Fragen — soweit im Original vorhanden.
- 4: Die meisten Kernpunkte sind enthalten, aber 1-2 klinisch relevante Details fehlen (z.B. ein wichtiges Medikament, ein Kontrolltermin).
- 3: Die Hauptaussage ist erkennbar, aber mehrere wichtige Details fehlen. Der Patient würde wesentliche Informationen nicht erfahren.
- 2: Nur die oberflächliche Kernaussage ist vorhanden. Wichtige Therapie- oder Befunddetails fehlen komplett.
- 1: Stark unvollständig oder kaum Bezug zum Originaltext.

Antworte ausschließlich im folgenden JSON-Format:
{{
  "verstaendlichkeit": <1-5>,
  "medizinische_korrektheit": <1-5>,
  "vollstaendigkeit": <1-5>
}}
"""


@dataclass
class PatientTextScore:
    verstaendlichkeit: float
    medizinische_korrektheit: float
    vollstaendigkeit: float
    overall: float


def _build_prompt(
    original_text: str,
    gold_explanation: str,
    pred_explanation: str,
) -> str:
    return JUDGE_PROMPT.format(
        original_text=original_text,
        gold_explanation=gold_explanation,
        pred_explanation=pred_explanation,
    )


def _to_score(scores: dict) -> PatientTextScore:
    v = float(scores["verstaendlichkeit"])
    k = float(scores["medizinische_korrektheit"])
    voll = float(scores["vollstaendigkeit"])
    return PatientTextScore(
        verstaendlichkeit=v,
        medizinische_korrektheit=k,
        vollstaendigkeit=voll,
        overall=(v + k + voll) / 3,
    )


def judge_patient_text_gemini(
    original_text: str,
    gold_explanation: str,
    pred_explanation: str,
    client: "google.genai.Client",  # type: ignore
    model: str,
) -> PatientTextScore:
    """Evaluate using Gemini as judge."""
    from google.genai.types import GenerateContentConfig

    prompt = _build_prompt(original_text, gold_explanation, pred_explanation)
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
