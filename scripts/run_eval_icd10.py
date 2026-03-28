"""Evaluate models on ICD-10 coding task via Together AI."""

import json
import logging
import sys
import time

from openai import OpenAI, APIError

from germedbench.config import settings
from germedbench.eval_helpers import model_slug, extract_json, update_latest
from germedbench.evaluation.icd10_scoring import score_icd10, ICD10Score
from germedbench.logging import setup_run_logger
from germedbench.schemas import ICD10Case

log: logging.Logger = logging.getLogger(__name__)

TASK_NAME = "icd10_coding"

EXTRACTION_PROMPT = """\
Du bist ein medizinischer Kodierer. Extrahiere alle ICD-10-GM Codes aus dem folgenden klinischen Text.

Regeln:
- Verwende ausschließlich ICD-10-GM Version 2025 (deutsche Modifikation)
- Code-Format: Buchstabe + 2 Ziffern + Punkt + Subklassifikation (z.B. "I21.0", "E11.90", "J44.11")
- Kodiere so spezifisch wie der Text es erlaubt
- Markiere genau eine Hauptdiagnose, der Rest sind Nebendiagnosen
- Extrahiere alle kodierbaren Diagnosen aus dem Text

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "diagnosen": [
    {{"code": "I21.0", "typ": "Hauptdiagnose"}},
    {{"code": "I10.90", "typ": "Nebendiagnose"}}
  ]
}}

Klinischer Text:
{text}
"""



def load_cases() -> list[ICD10Case]:
    path = settings.icd10_output_file
    if not path.exists():
        print(f"Error: {path} not found. Run generate_icd10_cases.py first.", file=sys.stderr)
        sys.exit(1)
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            cases.append(ICD10Case.model_validate_json(line))
    return cases


def extract_codes(client: OpenAI, model: str, text: str) -> dict:
    """Send clinical text to model and parse ICD-10 codes from response."""
    prompt = EXTRACTION_PROMPT.format(text=text)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=2048,
    )

    raw = response.choices[0].message.content or ""
    usage = response.usage

    json_str = extract_json(raw)

    log = {
        "raw": raw,
        "prompt_length": len(prompt),
        "response_length": len(raw),
        "usage": {
            "prompt_tokens": usage.prompt_tokens if usage else None,
            "completion_tokens": usage.completion_tokens if usage else None,
        },
    }

    try:
        data = json.loads(json_str)
        diagnosen = data.get("diagnosen", [])
        codes = [d["code"] for d in diagnosen]
        hauptdiagnose = next(
            (d["code"] for d in diagnosen if d.get("typ") == "Hauptdiagnose"),
            None,
        )
        return {"codes": codes, "hauptdiagnose": hauptdiagnose, **log}
    except (json.JSONDecodeError, KeyError):
        return {"codes": [], "hauptdiagnose": None, "parse_error": True, **log}


def evaluate_model(
    client: OpenAI, model: str, cases: list[ICD10Case]
) -> dict | None:
    """Run evaluation for a single model. Returns None if model is unavailable."""
    log.info(f"\n{'='*60}")
    log.info(f"Evaluating: {model}")
    log.info(f"{'='*60}")

    # Preflight check
    try:
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
    except APIError as e:
        log.warning(f"Skipping {model}: {e.message}")
        return None
    except Exception as e:
        log.warning(f"Skipping {model}: {e}")
        return None

    scores: list[ICD10Score] = []
    predictions: list[dict] = []
    parse_errors = 0
    api_errors = 0

    for i, case in enumerate(cases):
        log.info(f"  Case {i+1}/{len(cases)} ({case.fachbereich}, {case.id})...")

        try:
            prediction = extract_codes(client, model, case.text)
        except APIError as e:
            log.error(f"  API ERROR: {e.message}")
            predictions.append({"case_id": case.id, "error": e.message})
            api_errors += 1
            continue
        except Exception as e:
            log.error(f"  ERROR: {e}")
            predictions.append({"case_id": case.id, "error": str(e)})
            api_errors += 1
            continue

        prediction["case_id"] = case.id
        predictions.append(prediction)

        log.debug(f"  Response ({prediction.get('response_length', 0)} chars, "
                   f"prompt={prediction.get('usage', {}).get('prompt_tokens')} tok, "
                   f"completion={prediction.get('usage', {}).get('completion_tokens')} tok): "
                   f"{prediction.get('raw', '')[:200]}")

        if prediction.get("parse_error"):
            parse_errors += 1
            log.warning(f"  PARSE ERROR — raw response: {prediction.get('raw', '')[:300]}")
            continue

        gold_diagnoses = [d.model_dump() for d in case.diagnosen]
        hd = next((d for d in case.diagnosen if d.typ == "Hauptdiagnose"), None)

        score = score_icd10(
            predicted_codes=prediction["codes"],
            gold_diagnoses=gold_diagnoses,
            predicted_hauptdiagnose=prediction["hauptdiagnose"],
            gold_hauptdiagnose=hd.code if hd else None,
            gold_hauptdiagnose_acceptable=hd.acceptable_codes if hd else None,
        )
        scores.append(score)
        log.info(f"    F1={score.exact_match_f1:.2f} | Cat-F1={score.category_match_f1:.2f} | HD={'✓' if score.hauptdiagnose_correct else '✗'}")
        log.debug(f"    Predicted: {prediction['codes']} | Gold: {[d['code'] for d in gold_diagnoses]}")

        time.sleep(0.5)

    n = len(scores)
    timestamp = time.strftime("%Y%m%d_%H%M%S")

    summary = {
        "model": model,
        "task": TASK_NAME,
        "timestamp": timestamp,
        "n_cases": len(cases),
        "n_scored": n,
        "n_parse_errors": parse_errors,
        "n_api_errors": api_errors,
        "exact_match_f1": sum(s.exact_match_f1 for s in scores) / n if n else 0,
        "exact_match_precision": sum(s.exact_match_precision for s in scores) / n if n else 0,
        "exact_match_recall": sum(s.exact_match_recall for s in scores) / n if n else 0,
        "category_match_f1": sum(s.category_match_f1 for s in scores) / n if n else 0,
        "hauptdiagnose_accuracy": sum(s.hauptdiagnose_correct for s in scores) / n if n else 0,
    }

    log.info(f"\n  Results for {model}:")
    log.info(f"    Exact Match F1:       {summary['exact_match_f1']:.3f}")
    log.info(f"    Category Match F1:    {summary['category_match_f1']:.3f}")
    log.info(f"    Hauptdiagnose Acc:    {summary['hauptdiagnose_accuracy']:.3f}")
    log.info(f"    Parse Errors:         {parse_errors}/{len(cases)}")
    log.info(f"    API Errors:           {api_errors}/{len(cases)}")

    # Save to results/<model>/<task>/<timestamp>.json
    run_dir = settings.results_dir / model_slug(model) / TASK_NAME
    run_dir.mkdir(parents=True, exist_ok=True)
    run_path = run_dir / f"{timestamp}.json"
    with open(run_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "predictions": predictions}, f, indent=2, ensure_ascii=False)
    log.info(f"  Saved to {run_path}")

    return summary


def main():
    global log
    log = setup_run_logger(TASK_NAME)

    if not settings.together_api_key:
        log.error("TOGETHER_API_KEY not set in .env")
        sys.exit(1)

    client = OpenAI(
        api_key=settings.together_api_key,
        base_url=settings.together_base_url,
    )

    cases = load_cases()
    log.info(f"Loaded {len(cases)} cases from {settings.icd10_output_file}")
    log.info(f"Models: {settings.eval_models}")

    models = sys.argv[1:] if len(sys.argv) > 1 else settings.eval_models

    all_results = []
    for model in models:
        result = evaluate_model(client, model, cases)
        if result:
            all_results.append(result)

    if all_results:
        update_latest(all_results)

    log.info(f"\n{'='*60}")
    log.info(f"Leaderboard:")
    log.info(f"{'Model':<45} {'Exact F1':>10} {'Cat F1':>10} {'HD Acc':>10}")
    log.info("-" * 75)
    for r in sorted(all_results, key=lambda x: x["exact_match_f1"], reverse=True):
        log.info(f"{r['model']:<45} {r['exact_match_f1']:>10.3f} {r['category_match_f1']:>10.3f} {r['hauptdiagnose_accuracy']:>10.3f}")


if __name__ == "__main__":
    main()
