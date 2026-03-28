"""Generate synthetic ICD-10 coding benchmark cases using Gemini."""

import json
import sys

from google import genai
from google.genai.types import GenerateContentConfig

from germedbench.config import FACHBEREICHE, KOMPLEXITAET, settings
from germedbench.gen_helpers import parse_gen_args, next_case_id, write_cases
from germedbench.icd10_catalog import display as icd10_display, is_valid
from germedbench.schemas import ICD10Case

PROMPT_TEMPLATE = """\
Du bist ein erfahrener deutscher Klinikarzt und medizinischer Kodierer. \
Erstelle eine realistische Kurzepikrise (Entlassungsbrief-Zusammenfassung) \
für einen fiktiven Patienten aus dem Fachbereich {fachbereich}.

Anforderungen an den Text:
- 150-300 Wörter, typischer deutscher klinischer Schreibstil
- Enthalte: Aufnahmegrund, Anamnese, Befunde, Therapie, Procedere
- Der Fall soll {komplexitaet} sein
- Verwende realistische, aber fiktive Patientendaten

Anforderungen an die Kodierung:
- Verwende ausschließlich ICD-10-GM Version 2025 (deutsche Modifikation)
- Verwende nur Codes, die tatsächlich in der ICD-10-GM 2025 existieren
- Markiere genau eine Hauptdiagnose, der Rest sind Nebendiagnosen
- Gib für jede Diagnose unter "acceptable_codes" alternative ICD-10-GM Codes an, \
die ebenfalls korrekt wären. Wenn keine sinnvollen Alternativen existieren, \
lasse die Liste leer.

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "text": "Die Kurzepikrise...",
  "diagnosen": [
    {{"code": "I21.0", "acceptable_codes": [], "typ": "Hauptdiagnose"}},
    {{"code": "I10.90", "acceptable_codes": ["I10.00"], "typ": "Nebendiagnose"}}
  ]
}}
"""


def _fix_code(code: str) -> str | None:
    """Validate an ICD-10-GM code, truncating to parent if needed."""
    if is_valid(code):
        return code
    truncated = code
    while len(truncated) > 3:
        truncated = truncated[:-1]
        if is_valid(truncated):
            print(f"  FIX: {code} -> {truncated}")
            return truncated
    print(f"  SKIP: {code} not found in ICD-10-GM 2025", file=sys.stderr)
    return None


def generate_cases(n: int, start_id: int = 1) -> list[ICD10Case]:
    if not settings.gemini_api_key:
        print("Error: GEMINI_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=settings.gemini_api_key)
    print(f"Using model: {settings.generation_model}")
    cases: list[ICD10Case] = []
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
            diagnosen = []
            for d in data["diagnosen"]:
                code = _fix_code(d["code"])
                if not code:
                    continue
                valid_alts = [c for c in (_fix_code(a) for a in d.get("acceptable_codes", [])) if c]
                diagnosen.append({
                    **d,
                    "code": code,
                    "display": icd10_display(code),
                    "acceptable_codes": valid_alts,
                })
            case = ICD10Case(
                id=f"case_{case_id:03d}",
                fachbereich=fachbereich,
                text=data["text"],
                diagnosen=diagnosen,
            )
            cases.append(case)
            print(f"  -> {len(case.diagnosen)} diagnoses")
            case_id += 1
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"  -> Error parsing response: {e}, skipping", file=sys.stderr)
            continue

    return cases


def main():
    args = parse_gen_args("ICD-10 coding", settings.icd10_num_cases)
    output = settings.icd10_output_file
    start_id = 1 if args.overwrite else next_case_id(output, "case")
    cases = generate_cases(args.n, start_id=start_id)
    write_cases(output, cases, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
