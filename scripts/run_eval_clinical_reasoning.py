"""Evaluate models on clinical reasoning / differential diagnosis task."""

import json
import logging
import sys
import time
from typing import Callable

from openai import APIError

from germedbench.config import settings
from germedbench.eval_helpers import model_slug, extract_json, update_latest, get_client, call_model, parse_eval_args, run_eval
from germedbench.evaluation.clinical_reasoning_scoring import (
    ClinicalReasoningScore,
    judge_clinical_reasoning_gemini,
)
from germedbench.logging import setup_run_logger
from germedbench.schemas import ClinicalReasoningCase

log: logging.Logger = logging.getLogger(__name__)

TASK_NAME = "clinical_reasoning"

CLINICAL_REASONING_PROMPT = """\
Du bist ein erfahrener deutscher Klinikarzt. Lies die folgende klinische Fallvignette \
und erstelle eine Differentialdiagnose-Liste mit klinischer Begründung.

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "differentialdiagnosen": [
    {{
      "name": "Diagnose-Name",
      "icd10_code": "ICD-10-GM Code (optional)",
      "reasoning": "Klinische Begründung in 1-2 Sätzen",
      "likelihood": "hoch/mittel/gering"
    }}
  ]
}}

Erstelle 3-5 Differentialdiagnosen, geordnet nach Wahrscheinlichkeit (wahrscheinlichste zuerst). \
Beziehe dich in der Begründung konkret auf Befunde aus dem Falltext.

Klinische Fallvignette:
{text}
"""


def load_cases() -> list[ClinicalReasoningCase]:
    path = settings.clinical_reasoning_output_file
    if not path.exists():
        print(f"Error: {path} not found. Run generate_clinical_reasoning_cases.py first.", file=sys.stderr)
        sys.exit(1)
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            cases.append(ClinicalReasoningCase.model_validate_json(line))
    return cases


def generate_ddx(client, model: str, text: str) -> dict:
    """Send clinical vignette to model and parse DDx response."""
    prompt = CLINICAL_REASONING_PROMPT.format(text=text)

    raw, usage = call_model(client, model, prompt)
    json_str = extract_json(raw)

    result = {"raw": raw, "prompt_length": len(prompt), "response_length": len(raw), "usage": usage}

    try:
        data = json.loads(json_str)
        ddx = data.get("differentialdiagnosen", [])
        return {"differentialdiagnosen": ddx, **result}
    except (json.JSONDecodeError, KeyError):
        return {"differentialdiagnosen": None, "parse_error": True, **result}


def evaluate_model(
    client,
    judge_fn: Callable[..., ClinicalReasoningScore],
    model: str,
    cases: list[ClinicalReasoningCase],
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

    scores: list[ClinicalReasoningScore] = []
    predictions: list[dict] = []
    parse_errors = 0
    api_errors = 0

    for i, case in enumerate(cases):
        log.info(f"  Case {i+1}/{len(cases)} ({case.fachbereich}, {case.id})...")

        # Step 1: Get model DDx
        try:
            prediction = generate_ddx(client, model, case.text)
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

        log.debug(f"  Response ({prediction.get('response_length', 0)} chars): "
                   f"{prediction.get('raw', '')[:200]}")

        if prediction.get("parse_error"):
            parse_errors += 1
            predictions.append(prediction)
            log.warning(f"  PARSE ERROR — raw response: {prediction.get('raw', '')[:300]}")
            continue

        # Step 2: Judge the DDx
        try:
            score = judge_fn(
                vignette_text=case.text,
                gold_diagnoses=[d.model_dump() for d in case.gold_diagnoses],
                correct_diagnosis=case.correct_diagnosis,
                predicted_diagnoses=prediction["differentialdiagnosen"],
            )
            scores.append(score)
            prediction["automated_scores"] = {
                "top1_accuracy": score.top1_accuracy,
                "top3_recall": score.top3_recall,
                "ddx_overlap_f1": score.ddx_overlap_f1,
            }
            prediction["judge_scores"] = {
                "reasoning_quality": score.reasoning_quality,
                "ddx_plausibility": score.ddx_plausibility,
                "red_flag_awareness": score.red_flag_awareness,
            }
            log.info(f"    Top1={score.top1_accuracy:.0f} Top3={score.top3_recall:.0f} "
                     f"F1={score.ddx_overlap_f1:.2f} RQ={score.reasoning_quality:.0f} "
                     f"DP={score.ddx_plausibility:.0f} RF={score.red_flag_awareness:.0f} "
                     f"-> {score.overall:.2f}")
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
        "top1_accuracy": sum(s.top1_accuracy for s in scores) / n if n else 0,
        "top3_recall": sum(s.top3_recall for s in scores) / n if n else 0,
        "ddx_overlap_f1": sum(s.ddx_overlap_f1 for s in scores) / n if n else 0,
        "reasoning_quality": sum(s.reasoning_quality for s in scores) / n if n else 0,
        "ddx_plausibility": sum(s.ddx_plausibility for s in scores) / n if n else 0,
        "red_flag_awareness": sum(s.red_flag_awareness for s in scores) / n if n else 0,
        "overall_score": sum(s.overall for s in scores) / n if n else 0,
    }

    log.info(f"\n  Results for {model}:")
    log.info(f"    Top-1 Accuracy:       {summary['top1_accuracy']:.2f}")
    log.info(f"    Top-3 Recall:         {summary['top3_recall']:.2f}")
    log.info(f"    DDx Overlap F1:       {summary['ddx_overlap_f1']:.2f}")
    log.info(f"    Reasoning Quality:    {summary['reasoning_quality']:.2f}")
    log.info(f"    DDx Plausibility:     {summary['ddx_plausibility']:.2f}")
    log.info(f"    Red-Flag Awareness:   {summary['red_flag_awareness']:.2f}")
    log.info(f"    Overall:              {summary['overall_score']:.2f}")
    log.info(f"    Parse Errors:         {parse_errors}/{len(cases)}")
    log.info(f"    API Errors:           {api_errors}/{len(cases)}")

    # Save per-model detail
    run_dir = settings.results_dir / model_slug(model) / TASK_NAME
    run_dir.mkdir(parents=True, exist_ok=True)
    run_path = run_dir / f"{timestamp}.json"
    with open(run_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "predictions": predictions}, f, indent=2, ensure_ascii=False)
    log.info(f"  Saved to {run_path}")

    return summary


def _create_judge_fn() -> Callable[..., ClinicalReasoningScore]:
    """Create a judge function using Gemini."""
    if not settings.gemini_api_key:
        log.error("GEMINI_API_KEY not set in .env (required for LLM-as-Judge)")
        sys.exit(1)

    from google import genai

    gemini_client = genai.Client(api_key=settings.gemini_api_key)
    judge_model = settings.judge_model
    log.info(f"Using Gemini judge: {judge_model}")

    def judge_fn(
        vignette_text: str,
        gold_diagnoses: list[dict],
        correct_diagnosis: str,
        predicted_diagnoses: list[dict],
    ) -> ClinicalReasoningScore:
        return judge_clinical_reasoning_gemini(
            vignette_text=vignette_text,
            gold_diagnoses=gold_diagnoses,
            correct_diagnosis=correct_diagnosis,
            predicted_diagnoses=predicted_diagnoses,
            client=gemini_client,
            model=judge_model,
        )
    return judge_fn


def main():
    global log
    log = setup_run_logger(TASK_NAME)

    judge_fn = _create_judge_fn()

    cases = load_cases()
    log.info(f"Loaded {len(cases)} cases from {settings.clinical_reasoning_output_file}")

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
    log.info(f"{'Model':<45} {'Overall':>8} {'Top1':>6} {'Top3':>6} {'F1':>6} {'RQ':>6} {'DP':>6} {'RF':>6}")
    log.info("-" * 95)
    for r in sorted(all_results, key=lambda x: x["overall_score"], reverse=True):
        log.info(f"{r['model']:<45} {r['overall_score']:>8.2f} {r['top1_accuracy']:>6.2f} "
                 f"{r['top3_recall']:>6.2f} {r['ddx_overlap_f1']:>6.2f} {r['reasoning_quality']:>6.1f} "
                 f"{r['ddx_plausibility']:>6.1f} {r['red_flag_awareness']:>6.1f}")


if __name__ == "__main__":
    main()
