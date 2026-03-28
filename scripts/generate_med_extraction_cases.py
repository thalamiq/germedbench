"""Generate synthetic medication extraction cases using Gemini 3 Flash."""

import json
import sys

from google import genai
from google.genai.types import GenerateContentConfig

from germedbench.config import FACHBEREICHE, KOMPLEXITAET, settings
from germedbench.gen_helpers import parse_gen_args, next_case_id, write_cases
from germedbench.schemas import MedExtCase

PROMPT_TEMPLATE = """\
Du bist ein erfahrener deutscher Klinikarzt. Erstelle einen realistischen \
Auszug aus einem Entlassbrief für einen fiktiven Patienten aus dem Fachbereich {fachbereich}.

Anforderungen:
- 150-300 Wörter, typischer deutscher klinischer Schreibstil
- Der Fall soll {komplexitaet} sein (bezogen auf die Anzahl der Medikamente)
- Der Text soll eine Medikamentenliste im typischen Arztbrief-Stil enthalten \
(z.B. "Entlassmedikation:", "Therapie bei Entlassung:" oder inline im Fließtext)
- Verwende realistische Wirkstoffe, Dosierungen und Einnahmefrequenzen
- Mische verschiedene Darreichungsformen (Tabletten, Injektionen, Infusionen)

Erstelle zusätzlich eine strukturierte Liste aller Medikamente im Text:

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "text": "Der Auszug aus dem Entlassbrief...",
  "medications": [
    {{
      "wirkstoff": "Metoprolol",
      "dosis": "47.5 mg",
      "frequenz": "1-0-0",
      "darreichungsform": "p.o."
    }},
    {{
      "wirkstoff": "Enoxaparin",
      "dosis": "40 mg",
      "frequenz": "1x täglich",
      "darreichungsform": "s.c."
    }}
  ]
}}
"""


def generate_cases(n: int, start_id: int = 1) -> list[MedExtCase]:
    if not settings.gemini_api_key:
        print("Error: GEMINI_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=settings.gemini_api_key)
    print(f"Using model: {settings.generation_model}")
    cases: list[MedExtCase] = []
    case_id = start_id

    for i in range(n):
        fachbereich = FACHBEREICHE[i % len(FACHBEREICHE)]
        komplexitaet = KOMPLEXITAET[i % len(KOMPLEXITAET)]

        prompt = PROMPT_TEMPLATE.format(
            fachbereich=fachbereich,
            komplexitaet=komplexitaet,
        )

        print(f"Generating case {case_id}/{n} ({fachbereich}, {komplexitaet[:10]}...)...")

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
            case = MedExtCase(
                id=f"med_{case_id:03d}",
                fachbereich=fachbereich,
                text=data["text"],
                medications=data["medications"],
            )
            cases.append(case)
            print(f"  -> {len(case.text)} chars, {len(case.medications)} medications")
            case_id += 1
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"  -> Error parsing response: {e}, skipping", file=sys.stderr)
            continue

    return cases


def main():
    args = parse_gen_args("medication extraction", settings.med_extraction_num_cases)
    output = settings.med_extraction_output_file
    start_id = 1 if args.overwrite else next_case_id(output, "med")
    cases = generate_cases(args.n, start_id=start_id)
    write_cases(output, cases, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
