"""Generate synthetic clinical NER cases using Gemini."""

import json
import sys

from google import genai
from google.genai.types import GenerateContentConfig

from germedbench.config import FACHBEREICHE, KOMPLEXITAET, settings
from germedbench.gen_helpers import parse_gen_args, next_case_id, write_cases
from germedbench.schemas import NERCase

PROMPT_TEMPLATE = """\
Du bist ein erfahrener deutscher Klinikarzt. Erstelle einen realistischen \
Auszug aus einem Entlassbrief für einen fiktiven Patienten aus dem Fachbereich {fachbereich}.

Anforderungen an den Text:
- 200-400 Wörter, typischer deutscher klinischer Schreibstil
- Der Fall soll {komplexitaet} sein
- Verwende realistische, aber fiktive Patientendaten
- Der Text soll Diagnosen, Prozeduren, Medikamente und Laborwerte enthalten

Erstelle zusätzlich eine vollständige Liste aller klinischen Entitäten im Text. \
Jede Entität hat einen Typ, typspezifische Felder und eine Liste von "acceptable_names" — \
alternative Bezeichnungen, die ebenfalls korrekt wären. Typische Alternativen:
- Abkürzungen (z.B. "COPD" für "Chronisch obstruktive Lungenkrankheit")
- Handelsnamen vs. Wirkstoffe (z.B. "Beloc" für "Metoprolol")
- Laborabkürzungen (z.B. "CRP" für "C-reaktives Protein")
- Unterschiedliche Schreibweisen oder Synonyme
Wenn keine sinnvollen Alternativen existieren, lasse die Liste leer.

Entitätstypen:
- **diagnose**: name, acceptable_names, code (ICD-10-GM)
- **prozedur**: name, acceptable_names, code (OPS)
- **medikament**: name, acceptable_names, wirkstoff, dosierung, einheit
- **laborwert**: name, acceptable_names, parameter, wert, einheit

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "text": "Der Auszug aus dem Entlassbrief...",
  "entities": [
    {{"typ": "diagnose", "name": "Chronisch obstruktive Lungenkrankheit", "acceptable_names": ["COPD", "chronische Bronchitis"], "code": "J44.1"}},
    {{"typ": "prozedur", "name": "Elektrokardioversion", "acceptable_names": ["EKV", "Kardioversion"], "code": "8-640.0"}},
    {{"typ": "medikament", "name": "Metoprolol", "acceptable_names": ["Beloc", "Metoprolol-succinat"], "wirkstoff": "Metoprolol", "dosierung": "47.5mg 1-0-0", "einheit": "mg"}},
    {{"typ": "laborwert", "name": "C-reaktives Protein", "acceptable_names": ["CRP"], "parameter": "CRP", "wert": "4.2", "einheit": "mg/l"}}
  ]
}}
"""


def generate_cases(n: int, start_id: int = 1) -> list[NERCase]:
    if not settings.gemini_api_key:
        print("Error: GEMINI_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=settings.gemini_api_key)
    print(f"Using model: {settings.generation_model}")
    cases: list[NERCase] = []
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
            case = NERCase(
                id=f"ner_{case_id:03d}",
                fachbereich=fachbereich,
                text=data["text"],
                entities=data["entities"],
            )
            cases.append(case)
            counts = {}
            for e in case.entities:
                counts[e.typ] = counts.get(e.typ, 0) + 1
            print(f"  -> {len(case.entities)} entities ({', '.join(f'{k}: {v}' for k, v in sorted(counts.items()))})")
            case_id += 1
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"  -> Error parsing response: {e}, skipping", file=sys.stderr)
            continue

    return cases


def main():
    args = parse_gen_args("NER", settings.ner_num_cases)
    output = settings.ner_output_file
    start_id = 1 if args.overwrite else next_case_id(output, "ner")
    cases = generate_cases(args.n, start_id=start_id)
    write_cases(output, cases, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
