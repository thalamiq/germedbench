"""Generate synthetic discharge letter summarization cases using Gemini."""

import json
import sys

from google import genai
from google.genai.types import GenerateContentConfig

from germedbench.config import FACHBEREICHE, KOMPLEXITAET, settings
from germedbench.gen_helpers import parse_gen_args, next_case_id, write_cases
from germedbench.schemas import SummarizationCase

PROMPT_TEMPLATE = """\
Du bist ein erfahrener deutscher Klinikarzt. Erstelle einen realistischen, \
vollständigen Entlassbrief für einen fiktiven Patienten aus dem Fachbereich {fachbereich}.

Anforderungen an den Entlassbrief:
- 600-1000 Wörter, typischer deutscher klinischer Schreibstil
- Enthält alle üblichen Abschnitte: Aufnahmegrund, Anamnese, Aufnahmebefund, \
Diagnostik, Diagnosen, Therapie/Verlauf, Empfehlungen/Procedere
- Der Fall soll {komplexitaet} sein
- Verwende realistische, aber fiktive Patientendaten
- Typische Abkürzungen und Fachbegriffe

WICHTIG — Der Brief soll realistisch komplex sein. Baue gezielt 2-3 der folgenden \
Elemente ein, die eine Zusammenfassung anspruchsvoll machen:
- Nebenbefunde und Komorbiditäten, die nicht zur Hauptdiagnose gehören aber relevant sind
- Therapieumstellungen oder -anpassungen während des Aufenthalts (z.B. Medikamentenwechsel, Dosisänderungen)
- Ausstehende Befunde oder offene diagnostische Fragen zum Entlasszeitpunkt
- Widersprüchliche oder unklare Befunde (z.B. erhöhter Tumormarker bei unauffälliger Bildgebung)
- Komplikationen während des Aufenthalts (z.B. Blutungskomplikation, nosokomiale Infektion, Delir)
- Relevante Informationen verstreut über mehrere Abschnitte (nicht alles sauber an einer Stelle)
- Mehrere Medikamente mit konkreten Dosierungen, Frequenzen und Darreichungsformen
- Quantitative Befunde: konkrete Laborwerte (mit Einheiten), Bildgebungsbefunde, Scores (LVEF, CHA2DS2-VASc, NYHA, etc.)
- Konkrete Zeitangaben für Nachsorgetermine und Kontrolluntersuchungen

Erstelle zusätzlich eine strukturierte Zusammenfassung des Entlassbriefs mit folgenden Feldern:
- hauptdiagnose: Die Hauptdiagnose in einem Satz
- therapie: Durchgeführte Therapie in 2-3 Sätzen, inklusive konkreter Medikamente mit Dosierungen
- procedere: Empfohlenes weiteres Vorgehen in 2-3 Sätzen, mit konkreten Zeitangaben und Kontrollen
- offene_fragen: Offene klinische Fragen, ausstehende Befunde oder Unsicherheiten (1-2 Sätze). \
Wenn der Fall Komplikationen oder unklare Befunde enthält, gehören diese hierher.

Die Zusammenfassung soll so spezifisch sein, dass sie nur auf diesen einen Patienten zutrifft — \
keine generischen Formulierungen wie "medikamentöse Therapie" oder "Labor kontrollieren".

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "text": "Der vollständige Entlassbrief...",
  "gold_summary": {{
    "hauptdiagnose": "...",
    "therapie": "...",
    "procedere": "...",
    "offene_fragen": "..."
  }}
}}
"""


def generate_cases(n: int, start_id: int = 1) -> list[SummarizationCase]:
    if not settings.gemini_api_key:
        print("Error: GEMINI_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=settings.gemini_api_key)
    print(f"Using model: {settings.generation_model}")
    cases: list[SummarizationCase] = []
    case_id = start_id

    for i in range(n):
        fachbereich = FACHBEREICHE[i % len(FACHBEREICHE)]
        komplexitaet = KOMPLEXITAET[i % len(KOMPLEXITAET)]

        prompt = PROMPT_TEMPLATE.format(
            fachbereich=fachbereich,
            komplexitaet=komplexitaet,
        )

        print(f"Generating case {case_id}/{start_id + n - 1} ({fachbereich}, {komplexitaet[:10]}...)...")

        response = client.models.generate_content(
            model=settings.generation_model,
            contents=prompt,
            config=GenerateContentConfig(
                temperature=settings.generation_temperature,
                response_mime_type="application/json",
            ),
        )

        try:
            data = json.loads(response.text)
            komp_key = komplexitaet.split("(")[0].strip()
            case = SummarizationCase(
                id=f"summ_{case_id:03d}",
                fachbereich=fachbereich,
                komplexitaet=komp_key,
                text=data["text"],
                gold_summary=data["gold_summary"],
            )
            cases.append(case)
            print(f"  -> {len(case.text)} chars")
            case_id += 1
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"  -> Error parsing response: {e}, skipping", file=sys.stderr)
            continue

    return cases


def main():
    args = parse_gen_args("summarization", settings.summarization_num_cases)
    output = settings.summarization_output_file
    start_id = 1 if args.overwrite else next_case_id(output, "summ")
    cases = generate_cases(args.n, start_id=start_id)
    write_cases(output, cases, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
