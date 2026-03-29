"""Evaluate models on patient text simplification task."""

import json
import logging
import sys
import time
from typing import Callable

from openai import APIError

from germedbench.config import settings
from germedbench.eval_helpers import model_slug, extract_json, update_latest, get_client, call_model, parse_eval_args, run_eval
from germedbench.evaluation.patient_text_scoring import (
    PatientTextScore,
    judge_patient_text_gemini,
)
from germedbench.logging import setup_run_logger
from germedbench.schemas import PatientTextCase

log: logging.Logger = logging.getLogger(__name__)

TASK_NAME = "patient_text"

PATIENT_TEXT_PROMPT = """\
Du bist ein erfahrener Arzt, der medizinische Befunde für Patienten verständlich erklärt.

Lies den folgenden medizinischen Text und erkläre ihn so, dass ein Patient ohne \
medizinische Vorkenntnisse alles versteht.

Regeln:
- Erkläre jeden Fachbegriff in einfacher Sprache
- Behalte alle wichtigen Informationen bei (Befunde, Diagnosen, Empfehlungen)
- Verwende einen freundlichen, sachlichen Ton
- Ordne Messwerte und Befunde verständlich ein (Was ist normal? Was weicht ab?)
- Der Patient soll verstehen: Was wurde gefunden? Was bedeutet das? Was passiert als nächstes?

Antworte ausschließlich mit der Patienten-Erklärung als Fließtext (kein JSON, kein Markdown). \
Beginne direkt mit der Erklärung.

Medizinischer Text:
{text}
"""


def load_cases() -> list[PatientTextCase]:
    path = settings.patient_text_output_file
    if not path.exists():
        print(f"Error: {path} not found. Run generate_patient_text_cases.py first.", file=sys.stderr)
        sys.exit(1)
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            cases.append(PatientTextCase.model_validate_json(line))
    return cases


def generate_explanation(client, model: str, text: str) -> dict:
    """Send clinical text to model and get patient-friendly explanation."""
    prompt = PATIENT_TEXT_PROMPT.format(text=text)

    raw, usage = call_model(client, model, prompt)

    log_data = {"raw": raw, "prompt_length": len(prompt), "response_length": len(raw), "usage": usage}

    # For this task, the response is plain text (no JSON parsing needed)
    explanation = raw.strip()
    if not explanation:
        return {"explanation": None, "parse_error": True, **log_data}

    return {"explanation": explanation, **log_data}


def evaluate_model(
    client,
    judge_fn: Callable[..., PatientTextScore],
    model: str,
    cases: list[PatientTextCase],
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

    scores: list[PatientTextScore] = []
    predictions: list[dict] = []
    parse_errors = 0
    api_errors = 0

    for i, case in enumerate(cases):
        log.info(f"  Case {i+1}/{len(cases)} ({case.fachbereich}, {case.id})...")

        # Step 1: Get model explanation
        try:
            prediction = generate_explanation(client, model, case.text)
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

        if prediction.get("parse_error"):
            parse_errors += 1
            predictions.append(prediction)
            log.warning(f"  EMPTY RESPONSE")
            continue

        # Step 2: Judge the explanation
        try:
            score = judge_fn(
                original_text=case.text,
                gold_explanation=case.gold_explanation,
                pred_explanation=prediction["explanation"],
            )
            scores.append(score)
            prediction["judge_scores"] = {
                "verstaendlichkeit": score.verstaendlichkeit,
                "medizinische_korrektheit": score.medizinische_korrektheit,
                "vollstaendigkeit": score.vollstaendigkeit,
                "overall": score.overall,
            }
            log.info(f"    V={score.verstaendlichkeit:.0f} K={score.medizinische_korrektheit:.0f} Voll={score.vollstaendigkeit:.0f} -> {score.overall:.1f}")
        except Exception as e:
            log.error(f"  JUDGE ERROR: {e}")
            prediction["judge_error"] = str(e)

        predictions.append(prediction)
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
        "verstaendlichkeit": sum(s.verstaendlichkeit for s in scores) / n if n else 0,
        "medizinische_korrektheit": sum(s.medizinische_korrektheit for s in scores) / n if n else 0,
        "vollstaendigkeit": sum(s.vollstaendigkeit for s in scores) / n if n else 0,
        "overall_score": sum(s.overall for s in scores) / n if n else 0,
    }

    log.info(f"\n  Results for {model}:")
    log.info(f"    Verständlichkeit:      {summary['verstaendlichkeit']:.2f}")
    log.info(f"    Med. Korrektheit:      {summary['medizinische_korrektheit']:.2f}")
    log.info(f"    Vollständigkeit:       {summary['vollstaendigkeit']:.2f}")
    log.info(f"    Overall:               {summary['overall_score']:.2f}")
    log.info(f"    Parse Errors:          {parse_errors}/{len(cases)}")
    log.info(f"    API Errors:            {api_errors}/{len(cases)}")

    # Save per-model detail
    run_dir = settings.results_dir / model_slug(model) / TASK_NAME
    run_dir.mkdir(parents=True, exist_ok=True)
    run_path = run_dir / f"{timestamp}.json"
    with open(run_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "predictions": predictions}, f, indent=2, ensure_ascii=False)
    log.info(f"  Saved to {run_path}")

    return summary


def _create_judge_fn() -> Callable[..., PatientTextScore]:
    """Create a judge function using Gemini."""
    if not settings.gemini_api_key:
        log.error("GEMINI_API_KEY not set in .env (required for LLM-as-Judge)")
        sys.exit(1)

    from google import genai

    gemini_client = genai.Client(api_key=settings.gemini_api_key)
    judge_model = settings.judge_model
    log.info(f"Using Gemini judge: {judge_model}")

    def judge_fn(original_text: str, gold_explanation: str, pred_explanation: str) -> PatientTextScore:
        return judge_patient_text_gemini(
            original_text=original_text,
            gold_explanation=gold_explanation,
            pred_explanation=pred_explanation,
            client=gemini_client,
            model=judge_model,
        )
    return judge_fn


def main():
    global log
    log = setup_run_logger(TASK_NAME)

    judge_fn = _create_judge_fn()

    cases = load_cases()
    log.info(f"Loaded {len(cases)} cases from {settings.patient_text_output_file}")

    eval_args = parse_eval_args(TASK_NAME)
    log.info(f"Models: {[m.id for m in eval_args.models]}")

    def eval_fn(m):
        client = get_client(m.provider)
        return evaluate_model(client, judge_fn, m.id, cases)

    all_results = run_eval(eval_args, eval_fn)

    if all_results:
        update_latest(all_results)

    log.info(f"\n{'='*60}")
    log.info(f"Leaderboard:")
    log.info(f"{'Model':<45} {'Overall':>10} {'Verst.':>10} {'Korrekt':>10} {'Vollst.':>10}")
    log.info("-" * 85)
    for r in sorted(all_results, key=lambda x: x["overall_score"], reverse=True):
        log.info(f"{r['model']:<45} {r['overall_score']:>10.2f} {r['verstaendlichkeit']:>10.2f} {r['medizinische_korrektheit']:>10.2f} {r['vollstaendigkeit']:>10.2f}")


if __name__ == "__main__":
    main()
