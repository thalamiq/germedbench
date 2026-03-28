"""Evaluate models on medication extraction task via Together AI."""

import json
import logging
import sys
import time

from openai import APIError

from germedbench.config import settings
from germedbench.eval_helpers import model_slug, extract_json, update_latest, get_client, call_model, parse_eval_args, run_eval
from germedbench.evaluation.med_extraction_scoring import score_med_extraction, MedExtractionScore
from germedbench.logging import setup_run_logger
from germedbench.schemas import MedExtCase

log: logging.Logger = logging.getLogger(__name__)

TASK_NAME = "med_extraction"

EXTRACTION_PROMPT = """\
Du bist ein pharmazeutischer Experte. Extrahiere alle Medikamente aus dem folgenden klinischen Text.

Für jedes Medikament extrahiere:
- wirkstoff: Der Wirkstoff (z.B. "Metoprolol", "Ramipril")
- dosis: Die Dosierung (z.B. "47.5 mg", "5 mg")
- frequenz: Die Einnahmefrequenz (z.B. "1-0-0", "2x täglich", "alle 8h")
- darreichungsform: Die Darreichungsform (z.B. "p.o.", "i.v.", "s.c.")

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "medications": [
    {{
      "wirkstoff": "Metoprolol",
      "dosis": "47.5 mg",
      "frequenz": "1-0-0",
      "darreichungsform": "p.o."
    }}
  ]
}}

Klinischer Text:
{text}
"""


def load_cases() -> list[MedExtCase]:
    path = settings.med_extraction_output_file
    if not path.exists():
        print(f"Error: {path} not found. Run generate_med_extraction_cases.py first.", file=sys.stderr)
        sys.exit(1)
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            cases.append(MedExtCase.model_validate_json(line))
    return cases


def extract_medications(client, model: str, text: str) -> dict:
    """Send clinical text to model and parse medication list."""
    prompt = EXTRACTION_PROMPT.format(text=text)

    raw, usage = call_model(client, model, prompt)
    json_str = extract_json(raw)

    result = {"raw": raw, "prompt_length": len(prompt), "response_length": len(raw), "usage": usage}

    try:
        data = json.loads(json_str)
        medications = data.get("medications", [])
        return {"medications": medications, **result}
    except (json.JSONDecodeError, KeyError):
        return {"medications": None, "parse_error": True, **result}


def evaluate_model(
    client, model: str, cases: list[MedExtCase]
) -> dict | None:
    """Run evaluation for a single model."""
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

    scores: list[MedExtractionScore] = []
    predictions: list[dict] = []
    parse_errors = 0
    api_errors = 0

    for i, case in enumerate(cases):
        log.info(f"  Case {i+1}/{len(cases)} ({case.fachbereich}, {case.id})...")

        try:
            prediction = extract_medications(client, model, case.text)
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

        if prediction.get("parse_error"):
            parse_errors += 1
            log.warning(f"  PARSE ERROR — raw response: {prediction.get('raw', '')[:300]}")
            continue

        gold = [m.model_dump() for m in case.medications]
        score = score_med_extraction(
            predicted=prediction["medications"],
            gold=gold,
        )
        scores.append(score)
        log.info(f"    Wirkstoff-F1={score.wirkstoff_f1:.2f} Partial={score.partial_f1:.2f} Exact={score.exact_f1:.2f}")

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
        "wirkstoff_f1": sum(s.wirkstoff_f1 for s in scores) / n if n else 0,
        "wirkstoff_precision": sum(s.wirkstoff_precision for s in scores) / n if n else 0,
        "wirkstoff_recall": sum(s.wirkstoff_recall for s in scores) / n if n else 0,
        "partial_f1": sum(s.partial_f1 for s in scores) / n if n else 0,
        "exact_f1": sum(s.exact_f1 for s in scores) / n if n else 0,
    }

    log.info(f"\n  Results for {model}:")
    log.info(f"    Wirkstoff F1:   {summary['wirkstoff_f1']:.3f}")
    log.info(f"    Partial F1:     {summary['partial_f1']:.3f}")
    log.info(f"    Exact F1:       {summary['exact_f1']:.3f}")
    log.info(f"    Parse Errors:   {parse_errors}/{len(cases)}")

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

    cases = load_cases()
    log.info(f"Loaded {len(cases)} cases from {settings.med_extraction_output_file}")

    eval_args = parse_eval_args(TASK_NAME)
    log.info(f"Models: {[m.id for m in eval_args.models]}")

    def eval_fn(m):
        client = get_client(m.provider)
        return evaluate_model(client, m.id, cases)

    all_results = run_eval(eval_args, eval_fn)

    if all_results:
        update_latest(all_results)

    log.info(f"\n{'='*60}")
    log.info(f"Leaderboard:")
    log.info(f"{'Model':<45} {'Wirkst.':>8} {'Partial':>8} {'Exact':>8}")
    log.info("-" * 70)
    for r in sorted(all_results, key=lambda x: x["wirkstoff_f1"], reverse=True):
        log.info(f"{r['model']:<45} {r['wirkstoff_f1']:>8.3f} {r['partial_f1']:>8.3f} {r['exact_f1']:>8.3f}")


if __name__ == "__main__":
    main()
