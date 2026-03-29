"""Generate synthetic medical QA benchmark cases (IMPP-style) using Gemini."""

import json
import sys

from google import genai
from google.genai.types import GenerateContentConfig

from germedbench.config import FACHBEREICHE, SCHWIERIGKEITSGRAD, settings
from germedbench.gen_helpers import parse_gen_args, next_case_id, write_cases
from germedbench.schemas import MedQACase

PROMPT_TEMPLATE = """\
Du bist ein erfahrener Medizindidaktiker und erstellst Prüfungsfragen im Stil \
des Zweiten Abschnitts der Ärztlichen Prüfung (IMPP M2 Staatsexamen).

Erstelle eine klinische Multiple-Choice-Frage aus dem Fachbereich {fachbereich}.

Anforderungen:
- Schwierigkeitsgrad: {schwierigkeitsgrad}
- Die Frage soll eine kurze klinische Vignette (3-6 Sätze) enthalten mit: \
Alter, Geschlecht, Leitsymptom, relevante Anamnese und Befunde
- Danach eine klare Fragestellung ("Welche Diagnose...", "Welche Therapie...", \
"Welcher Befund...", "Welches Medikament..." etc.)
- Genau 5 Antwortmöglichkeiten (A bis E)
- Genau eine richtige Antwort
- Die Distraktoren sollen plausibel aber eindeutig falsch sein
- Die Frage soll sich NUR auf Text beziehen (keine Bilder, EKGs, Röntgenbilder)
- Eine kurze Erklärung (2-3 Sätze), warum die richtige Antwort korrekt ist

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "question": "Ein 62-jähriger Mann stellt sich mit ...",
  "options": {{
    "A": "Antwort A",
    "B": "Antwort B",
    "C": "Antwort C",
    "D": "Antwort D",
    "E": "Antwort E"
  }},
  "correct_answer": "C",
  "explanation": "Die richtige Antwort ist C, weil ..."
}}
"""


def generate_cases(n: int, start_id: int = 1) -> list[MedQACase]:
    if not settings.gemini_api_key:
        print("Error: GEMINI_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=settings.gemini_api_key)
    print(f"Using model: {settings.generation_model}")
    cases: list[MedQACase] = []
    case_id = start_id

    for i in range(n):
        fachbereich = FACHBEREICHE[i % len(FACHBEREICHE)]
        schwierigkeitsgrad = SCHWIERIGKEITSGRAD[i % len(SCHWIERIGKEITSGRAD)]

        prompt = PROMPT_TEMPLATE.format(
            fachbereich=fachbereich,
            schwierigkeitsgrad=schwierigkeitsgrad,
        )

        print(f"Generating case {case_id}/{start_id + n - 1} ({fachbereich}, {schwierigkeitsgrad[:10]}...)...")

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

            # Validate structure
            options = data["options"]
            correct = data["correct_answer"].strip().upper()
            if correct not in ("A", "B", "C", "D", "E"):
                print(f"  -> Invalid correct_answer: {correct}, skipping", file=sys.stderr)
                continue
            if set(options.keys()) != {"A", "B", "C", "D", "E"}:
                print(f"  -> Invalid options keys: {set(options.keys())}, skipping", file=sys.stderr)
                continue

            case = MedQACase(
                id=f"qa_{case_id:03d}",
                fachbereich=fachbereich,
                schwierigkeitsgrad=schwierigkeitsgrad.split(" (")[0],
                question=data["question"],
                options=options,
                correct_answer=correct,
                explanation=data["explanation"],
            )
            cases.append(case)
            print(f"  -> Correct: {correct}")
            case_id += 1
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"  -> Error parsing response: {e}, skipping", file=sys.stderr)
            continue

    return cases


def main():
    args = parse_gen_args("Medical QA", settings.med_qa_num_cases)
    output = settings.med_qa_output_file
    start_id = 1 if args.overwrite else next_case_id(output, "qa")
    cases = generate_cases(args.n, start_id=start_id)
    write_cases(output, cases, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
