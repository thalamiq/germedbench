"""Evaluate models on discharge letter summarization task."""

import json
import logging
import sys
import time
from typing import Callable

from openai import OpenAI, APIError

from germedbench.config import settings
from germedbench.eval_helpers import model_slug, extract_json, update_latest
from germedbench.evaluation.summarization_scoring import (
    SummarizationScore,
    judge_summary_gemini,
)
from germedbench.logging import setup_run_logger
from germedbench.schemas import SummarizationCase

log: logging.Logger = logging.getLogger(__name__)

TASK_NAME = "summarization"

SUMMARIZATION_PROMPT = """\
Du bist ein erfahrener deutscher Klinikarzt. Lies den folgenden Entlassbrief und erstelle \
eine strukturierte Zusammenfassung.

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "hauptdiagnose": "Die Hauptdiagnose in einem Satz",
  "therapie": "Durchgeführte Therapie in 2-3 Sätzen",
  "procedere": "Empfohlenes weiteres Vorgehen in 2-3 Sätzen",
  "offene_fragen": "Offene klinische Fragen oder 'Keine'"
}}

Entlassbrief:
{text}
"""



def load_cases() -> list[SummarizationCase]:
    path = settings.summarization_output_file
    if not path.exists():
        print(f"Error: {path} not found. Run generate_summarization_cases.py first.", file=sys.stderr)
        sys.exit(1)
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            cases.append(SummarizationCase.model_validate_json(line))
    return cases


def generate_summary(client: OpenAI, model: str, text: str) -> dict:
    """Send discharge letter to model and parse structured summary."""
    prompt = SUMMARIZATION_PROMPT.format(text=text)

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
        return {
            "summary": {
                "hauptdiagnose": data.get("hauptdiagnose", ""),
                "therapie": data.get("therapie", ""),
                "procedere": data.get("procedere", ""),
                "offene_fragen": data.get("offene_fragen", ""),
            },
            **log,
        }
    except (json.JSONDecodeError, KeyError):
        return {"summary": None, "parse_error": True, **log}


def evaluate_model(
    client: OpenAI,
    judge_fn: Callable[..., SummarizationScore],
    model: str,
    cases: list[SummarizationCase],
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

    scores: list[SummarizationScore] = []
    predictions: list[dict] = []
    parse_errors = 0
    api_errors = 0

    for i, case in enumerate(cases):
        log.info(f"  Case {i+1}/{len(cases)} ({case.fachbereich}, {case.id})...")

        # Step 1: Get model summary
        try:
            prediction = generate_summary(client, model, case.text)
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

        log.debug(f"  Response ({prediction.get('response_length', 0)} chars, "
                   f"prompt={prediction.get('usage', {}).get('prompt_tokens')} tok, "
                   f"completion={prediction.get('usage', {}).get('completion_tokens')} tok): "
                   f"{prediction.get('raw', '')[:200]}")

        if prediction.get("parse_error"):
            parse_errors += 1
            predictions.append(prediction)
            log.warning(f"  PARSE ERROR — raw response: {prediction.get('raw', '')[:300]}")
            continue

        # Step 2: Judge the summary
        try:
            score = judge_fn(
                original_text=case.text,
                gold_summary=case.gold_summary.model_dump(),
                predicted_summary=prediction["summary"],
            )
            scores.append(score)
            prediction["judge_scores"] = {
                "faktentreue": score.faktentreue,
                "vollstaendigkeit": score.vollstaendigkeit,
                "halluzinationsfreiheit": score.halluzinationsfreiheit,
                "formatkonformitaet": score.formatkonformitaet,
                "overall": score.overall,
            }
            log.info(f"    F={score.faktentreue:.0f} V={score.vollstaendigkeit:.0f} H={score.halluzinationsfreiheit:.0f} K={score.formatkonformitaet:.0f} -> {score.overall:.1f}")
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
        "faktentreue": sum(s.faktentreue for s in scores) / n if n else 0,
        "vollstaendigkeit": sum(s.vollstaendigkeit for s in scores) / n if n else 0,
        "halluzinationsfreiheit": sum(s.halluzinationsfreiheit for s in scores) / n if n else 0,
        "formatkonformitaet": sum(s.formatkonformitaet for s in scores) / n if n else 0,
        "overall_score": sum(s.overall for s in scores) / n if n else 0,
    }

    log.info(f"\n  Results for {model}:")
    log.info(f"    Faktentreue:          {summary['faktentreue']:.2f}")
    log.info(f"    Vollständigkeit:      {summary['vollstaendigkeit']:.2f}")
    log.info(f"    Halluzinationsfreiheit: {summary['halluzinationsfreiheit']:.2f}")
    log.info(f"    Formatkonformität:    {summary['formatkonformitaet']:.2f}")
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


def _create_judge_fn() -> Callable[..., SummarizationScore]:
    """Create a judge function using Gemini."""
    if not settings.gemini_api_key:
        log.error("GEMINI_API_KEY not set in .env (required for LLM-as-Judge)")
        sys.exit(1)

    from google import genai

    gemini_client = genai.Client(api_key=settings.gemini_api_key)
    judge_model = settings.judge_model
    log.info(f"Using Gemini judge: {judge_model}")

    def judge_fn(original_text: str, gold_summary: dict, predicted_summary: dict) -> SummarizationScore:
        return judge_summary_gemini(
            original_text=original_text,
            gold_summary=gold_summary,
            predicted_summary=predicted_summary,
            client=gemini_client,
            model=judge_model,
        )
    return judge_fn


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
    judge_fn = _create_judge_fn()

    cases = load_cases()
    log.info(f"Loaded {len(cases)} cases from {settings.summarization_output_file}")
    log.info(f"Models: {settings.eval_models}")

    models = sys.argv[1:] if len(sys.argv) > 1 else settings.eval_models

    all_results = []
    for model in models:
        result = evaluate_model(client, judge_fn, model, cases)
        if result:
            all_results.append(result)

    if all_results:
        update_latest(all_results)

    log.info(f"\n{'='*60}")
    log.info(f"Leaderboard:")
    log.info(f"{'Model':<45} {'Overall':>10} {'Fakten':>10} {'Vollst':>10} {'Halluz':>10} {'Format':>10}")
    log.info("-" * 95)
    for r in sorted(all_results, key=lambda x: x["overall_score"], reverse=True):
        log.info(f"{r['model']:<45} {r['overall_score']:>10.2f} {r['faktentreue']:>10.2f} {r['vollstaendigkeit']:>10.2f} {r['halluzinationsfreiheit']:>10.2f} {r['formatkonformitaet']:>10.2f}")


if __name__ == "__main__":
    main()
