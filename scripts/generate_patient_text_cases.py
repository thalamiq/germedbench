"""Generate synthetic patient text simplification cases using Gemini."""

import json
import sys

from google import genai
from google.genai.types import GenerateContentConfig

from germedbench.config import FACHBEREICHE, settings
from germedbench.gen_helpers import parse_gen_args, next_case_id, write_cases
from germedbench.schemas import PatientTextCase

# Different source text types to create variety
TEXT_TYPES = [
    "Befundbericht (Radiologie: CT, MRT oder Röntgen mit typischen radiologischen Fachbegriffen, Abkürzungen und Maßangaben)",
    "Histopathologischer Befund (Gewebediagnostik mit TNM-Klassifikation, Grading, Resektionsrändern)",
    "Auszug aus einem Entlassbrief (Diagnosen, Therapie und Procedere mit Medikamentenliste)",
    "Laborbefund mit klinischer Bewertung (auffällige Laborwerte mit Interpretation und empfohlener Diagnostik)",
    "Echokardiographie- oder Funktionsbefund (mit Messwerten, Normwertabweichungen und klinischer Bewertung)",
    "Operationsbericht-Zusammenfassung (Eingriff, Technik, Befunde, Komplikationen)",
]

PROMPT_TEMPLATE = """\
Du bist ein erfahrener deutscher Klinikarzt. Erstelle einen realistischen \
medizinischen Fachtext und eine dazugehörige patientenverständliche Erklärung.

## Aufgabe
Erstelle einen {text_type} aus dem Fachbereich {fachbereich}.

Anforderungen an den medizinischen Text:
- 100-250 Wörter, authentischer deutscher klinischer Schreibstil
- Typische medizinische Fachbegriffe, Abkürzungen und lateinische Termini
- Konkrete Messwerte, Befunde und klinische Bewertungen
- Der Text soll für einen medizinischen Laien schwer verständlich sein
- Realistisch, aber fiktive Patientendaten

Anforderungen an die Patienten-Erklärung (Gold Standard):
- Erkläre den gesamten medizinischen Text in einfacher, verständlicher Sprache
- JEDER Fachbegriff muss erklärt oder durch Alltagssprache ersetzt werden
- Alle klinisch relevanten Informationen müssen enthalten sein: Diagnose, \
Befunde, Bedeutung der Werte, empfohlene Maßnahmen
- Der Patient soll nach dem Lesen verstehen: Was wurde gefunden? \
Was bedeutet das für mich? Was passiert als nächstes?
- 150-300 Wörter, freundlicher aber sachlicher Ton
- Keine Verharmlosung, aber auch keine unnötige Angstmache
- Konkrete Informationen beibehalten (Zahlen, Termine, Medikamente), \
aber verständlich einordnen

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "text": "Der medizinische Fachtext...",
  "gold_explanation": "Die patientenverständliche Erklärung..."
}}
"""


def generate_cases(n: int, start_id: int = 1) -> list[PatientTextCase]:
    if not settings.gemini_api_key:
        print("Error: GEMINI_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=settings.gemini_api_key)
    print(f"Using model: {settings.generation_model}")
    cases: list[PatientTextCase] = []
    case_id = start_id

    for i in range(n):
        fachbereich = FACHBEREICHE[i % len(FACHBEREICHE)]
        text_type = TEXT_TYPES[i % len(TEXT_TYPES)]

        prompt = PROMPT_TEMPLATE.format(
            fachbereich=fachbereich,
            text_type=text_type,
        )

        print(f"Generating case {case_id}/{start_id + n - 1} ({fachbereich}, {text_type[:30]}...)...")

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
            case = PatientTextCase(
                id=f"pt_{case_id:03d}",
                fachbereich=fachbereich,
                text=data["text"],
                gold_explanation=data["gold_explanation"],
            )
            cases.append(case)
            print(f"  -> {len(case.text)} chars text, {len(case.gold_explanation)} chars explanation")
            case_id += 1
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"  -> Error parsing response: {e}, skipping", file=sys.stderr)
            continue

    return cases


def main():
    args = parse_gen_args("patient_text", settings.patient_text_num_cases)
    output = settings.patient_text_output_file
    start_id = 1 if args.overwrite else next_case_id(output, "pt")
    cases = generate_cases(args.n, start_id=start_id)
    write_cases(output, cases, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
