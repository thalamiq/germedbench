"""Evaluate models on medical QA (multiple-choice) task."""

import json
import logging
import sys
import time

from openai import APIError

from germedbench.config import settings
from germedbench.eval_helpers import model_slug, extract_json, update_latest, get_client, call_model, parse_eval_args, run_eval
from germedbench.evaluation.med_qa_scoring import score_med_qa, MedQAScore
from germedbench.logging import setup_run_logger
from germedbench.schemas import MedQACase

log: logging.Logger = logging.getLogger(__name__)

TASK_NAME = "med_qa"

QA_PROMPT = """\
Du bist ein erfahrener deutscher Facharzt und beantwortest eine medizinische Prüfungsfrage.

Lies die folgende Frage und die Antwortmöglichkeiten sorgfältig. Wähle die beste Antwort.

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "answer": "B",
  "reasoning": "Kurze Begründung in 1-2 Sätzen"
}}

Frage:
{question}

Antwortmöglichkeiten:
A) {option_a}
B) {option_b}
C) {option_c}
D) {option_d}
E) {option_e}
"""


def load_cases() -> list[MedQACase]:
    path = settings.med_qa_output_file
    if not path.exists():
        print(f"Error: {path} not found. Run generate_med_qa_cases.py first.", file=sys.stderr)
        sys.exit(1)
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            cases.append(MedQACase.model_validate_json(line))
    return cases


def answer_question(client, model: str, case: MedQACase) -> dict:
    """Send MC question to model and parse answer."""
    prompt = QA_PROMPT.format(
        question=case.question,
        option_a=case.options["A"],
        option_b=case.options["B"],
        option_c=case.options["C"],
        option_d=case.options["D"],
        option_e=case.options["E"],
    )

    raw, usage = call_model(client, model, prompt)
    json_str = extract_json(raw)

    result = {"raw": raw, "prompt_length": len(prompt), "response_length": len(raw), "usage": usage}

    try:
        data = json.loads(json_str)
        answer = data.get("answer", "").strip().upper()[:1]
        reasoning = data.get("reasoning", "")
        if answer not in ("A", "B", "C", "D", "E"):
            return {"answer": None, "reasoning": reasoning, "parse_error": True, **result}
        return {"answer": answer, "reasoning": reasoning, **result}
    except (json.JSONDecodeError, KeyError):
        return {"answer": None, "reasoning": None, "parse_error": True, **result}


def evaluate_model(
    client, model: str, cases: list[MedQACase]
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

    scores: list[MedQAScore] = []
    predictions: list[dict] = []
    parse_errors = 0
    api_errors = 0

    for i, case in enumerate(cases):
        log.info(f"  Case {i+1}/{len(cases)} ({case.fachbereich}, {case.id})...")

        try:
            prediction = answer_question(client, model, case)
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

        score = score_med_qa(
            predicted_answer=prediction["answer"],
            correct_answer=case.correct_answer,
        )
        scores.append(score)
        correct_str = "CORRECT" if score.correct else "WRONG"
        log.info(f"    {correct_str} (predicted={prediction['answer']}, gold={case.correct_answer})")

        time.sleep(0.5)

    n = len(scores)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    n_correct = sum(1 for s in scores if s.correct)

    summary = {
        "model": model,
        "task": TASK_NAME,
        "timestamp": timestamp,
        "n_cases": len(cases),
        "n_scored": n,
        "n_parse_errors": parse_errors,
        "n_api_errors": api_errors,
        "accuracy": n_correct / n if n else 0,
        "n_correct": n_correct,
    }

    log.info(f"\n  Results for {model}:")
    log.info(f"    Accuracy:       {summary['accuracy']:.3f} ({n_correct}/{n})")
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
    log.info(f"Loaded {len(cases)} cases from {settings.med_qa_output_file}")

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
    log.info(f"{'Model':<45} {'Accuracy':>8} {'Correct':>8}")
    log.info("-" * 62)
    for r in sorted(all_results, key=lambda x: x["accuracy"], reverse=True):
        log.info(f"{r['model']:<45} {r['accuracy']:>8.3f} {r['n_correct']:>5}/{r['n_scored']}")


if __name__ == "__main__":
    main()
