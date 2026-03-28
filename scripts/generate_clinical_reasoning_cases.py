"""Generate synthetic clinical reasoning / DDx cases using Gemini 3 Flash."""

import json
import sys

from google import genai
from google.genai.types import GenerateContentConfig

from germedbench.config import FACHBEREICHE, SCHWIERIGKEITSGRAD, settings
from germedbench.gen_helpers import parse_gen_args, next_case_id, write_cases
from germedbench.schemas import ClinicalReasoningCase

PROMPT_TEMPLATE = """\
Du bist ein erfahrener deutscher Klinikarzt, der eine Fallkonferenz vorbereitet. \
Erstelle eine realistische klinische Fallvignette aus dem Fachbereich {fachbereich}.

Anforderungen an die Fallvignette:
- 200-400 Wörter, typischer deutscher klinischer Schreibstil
- Strukturiert in: Vorstellung/Aufnahmegrund, Anamnese, Untersuchungsbefund, \
Laborwerte (mit konkreten Zahlenwerten), ggf. Bildgebungsbefunde
- Der Fall soll {schwierigkeitsgrad} sein
- Verwende realistische, aber fiktive Patientendaten (Alter, Geschlecht, Vorgeschichte)
- Nenne NICHT die Diagnose im Text — der Text soll zur Differentialdiagnostik anregen

Erstelle zusätzlich:
- Eine geordnete Differentialdiagnose-Liste (3-5 Diagnosen, wahrscheinlichste zuerst)
- Für jede Differentialdiagnose: Name, ICD-10-GM Code, Wahrscheinlichkeit (hoch/mittel/gering), \
und die wichtigsten Befunde aus dem Text, die dafür sprechen
- Die bestätigte Enddiagnose (die in der Praxis bestätigt würde)

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "text": "Die klinische Fallvignette...",
  "gold_diagnoses": [
    {{
      "name": "Diagnose 1",
      "icd10_code": "X00.0",
      "likelihood": "hoch",
      "key_findings": ["Befund A", "Befund B"]
    }}
  ],
  "correct_diagnosis": "Diagnose 1",
  "correct_diagnosis_icd10": "X00.0"
}}
"""


def generate_cases(n: int, start_id: int = 1) -> list[ClinicalReasoningCase]:
    if not settings.gemini_api_key:
        print("Error: GEMINI_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=settings.gemini_api_key)
    print(f"Using model: {settings.generation_model}")
    cases: list[ClinicalReasoningCase] = []
    case_id = start_id

    for i in range(n):
        fachbereich = FACHBEREICHE[i % len(FACHBEREICHE)]
        schwierigkeitsgrad = SCHWIERIGKEITSGRAD[i % len(SCHWIERIGKEITSGRAD)]

        prompt = PROMPT_TEMPLATE.format(
            fachbereich=fachbereich,
            schwierigkeitsgrad=schwierigkeitsgrad,
        )

        print(f"Generating case {case_id}/{n} ({fachbereich}, {schwierigkeitsgrad[:10]}...)...")

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
            schwierigkeits_key = schwierigkeitsgrad.split("(")[0].strip()
            case = ClinicalReasoningCase(
                id=f"cr_{case_id:03d}",
                fachbereich=fachbereich,
                schwierigkeitsgrad=schwierigkeits_key,
                text=data["text"],
                gold_diagnoses=data["gold_diagnoses"],
                correct_diagnosis=data["correct_diagnosis"],
                correct_diagnosis_icd10=data.get("correct_diagnosis_icd10", ""),
            )
            cases.append(case)
            print(f"  -> {len(case.text)} chars, {len(case.gold_diagnoses)} DDx")
            case_id += 1
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"  -> Error parsing response: {e}, skipping", file=sys.stderr)
            continue

    return cases


def main():
    args = parse_gen_args("clinical reasoning", settings.clinical_reasoning_num_cases)
    output = settings.clinical_reasoning_output_file
    start_id = 1 if args.overwrite else next_case_id(output, "cr")
    cases = generate_cases(args.n, start_id=start_id)
    write_cases(output, cases, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
