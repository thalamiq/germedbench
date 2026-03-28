"""Evaluate models on clinical NER (entity extraction) task via Together AI."""

import json
import logging
import sys
import time

from openai import OpenAI, APIError

from germedbench.config import settings
from germedbench.eval_helpers import model_slug, extract_json, update_latest
from germedbench.evaluation.ner_scoring import score_ner, NERScore
from germedbench.logging import setup_run_logger
from germedbench.schemas import NERCase

log: logging.Logger = logging.getLogger(__name__)

TASK_NAME = "ner"

EXTRACTION_PROMPT = """\
Du bist ein medizinischer NLP-Experte. Extrahiere alle klinischen Entitäten aus dem folgenden Text.

Entitätstypen:
- **diagnose**: Erkrankungen und Befunde (name + ICD-10-GM code)
- **prozedur**: Eingriffe und Maßnahmen (name + OPS code)
- **medikament**: Arzneimittel (name, wirkstoff, dosierung, einheit)
- **laborwert**: Laborparameter (name, parameter, wert, einheit)

Antworte ausschließlich im folgenden JSON-Format (kein Markdown, kein Kommentar):
{{
  "entities": [
    {{"typ": "diagnose", "name": "Vorhofflimmern", "code": "I48.0"}},
    {{"typ": "prozedur", "name": "Elektrokardioversion", "code": "8-640.0"}},
    {{"typ": "medikament", "name": "Metoprolol", "wirkstoff": "Metoprolol", "dosierung": "47.5mg 1-0-0", "einheit": "mg"}},
    {{"typ": "laborwert", "name": "Kalium", "parameter": "Kalium", "wert": "4.2", "einheit": "mmol/L"}}
  ]
}}

Klinischer Text:
{text}
"""


def load_cases() -> list[NERCase]:
    path = settings.ner_output_file
    if not path.exists():
        print(f"Error: {path} not found. Run generate_ner_cases.py first.", file=sys.stderr)
        sys.exit(1)
    cases = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            cases.append(NERCase.model_validate_json(line))
    return cases


def extract_entities(client: OpenAI, model: str, text: str) -> dict:
    """Send clinical text to model and parse entities from response."""
    prompt = EXTRACTION_PROMPT.format(text=text)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content or ""
    usage = response.usage

    json_str = extract_json(raw)

    result = {
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
        entities = data.get("entities", [])
        return {"entities": entities, **result}
    except (json.JSONDecodeError, KeyError):
        return {"entities": None, "parse_error": True, **result}


def evaluate_model(
    client: OpenAI, model: str, cases: list[NERCase]
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

    scores: list[NERScore] = []
    predictions: list[dict] = []
    parse_errors = 0
    api_errors = 0

    for i, case in enumerate(cases):
        log.info(f"  Case {i+1}/{len(cases)} ({case.fachbereich}, {case.id})...")

        try:
            prediction = extract_entities(client, model, case.text)
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

        log.debug(f"  Response ({prediction.get('response_length', 0)} chars): "
                   f"{prediction.get('raw', '')[:200]}")

        if prediction.get("parse_error"):
            parse_errors += 1
            log.warning(f"  PARSE ERROR — raw response: {prediction.get('raw', '')[:300]}")
            continue

        gold_entities = [e.model_dump() for e in case.entities]
        score = score_ner(
            predicted_entities=prediction["entities"],
            gold_entities=gold_entities,
        )
        scores.append(score)
        log.info(f"    Micro-F1={score.micro_f1:.2f} | Diag={score.diagnose_f1:.2f} "
                 f"Proz={score.prozedur_f1:.2f} Med={score.medikament_f1:.2f} Lab={score.laborwert_f1:.2f}")

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
        "micro_f1": sum(s.micro_f1 for s in scores) / n if n else 0,
        "micro_precision": sum(s.micro_precision for s in scores) / n if n else 0,
        "micro_recall": sum(s.micro_recall for s in scores) / n if n else 0,
        "diagnose_f1": sum(s.diagnose_f1 for s in scores) / n if n else 0,
        "prozedur_f1": sum(s.prozedur_f1 for s in scores) / n if n else 0,
        "medikament_f1": sum(s.medikament_f1 for s in scores) / n if n else 0,
        "laborwert_f1": sum(s.laborwert_f1 for s in scores) / n if n else 0,
    }

    log.info(f"\n  Results for {model}:")
    log.info(f"    Micro F1:       {summary['micro_f1']:.3f}")
    log.info(f"    Diagnose F1:    {summary['diagnose_f1']:.3f}")
    log.info(f"    Prozedur F1:    {summary['prozedur_f1']:.3f}")
    log.info(f"    Medikament F1:  {summary['medikament_f1']:.3f}")
    log.info(f"    Laborwert F1:   {summary['laborwert_f1']:.3f}")
    log.info(f"    Parse Errors:   {parse_errors}/{len(cases)}")
    log.info(f"    API Errors:     {api_errors}/{len(cases)}")

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
    log.info(f"Loaded {len(cases)} cases from {settings.ner_output_file}")
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
    log.info(f"{'Model':<45} {'Micro F1':>9} {'Diag':>6} {'Proz':>6} {'Med':>6} {'Lab':>6}")
    log.info("-" * 80)
    for r in sorted(all_results, key=lambda x: x["micro_f1"], reverse=True):
        log.info(f"{r['model']:<45} {r['micro_f1']:>9.3f} {r['diagnose_f1']:>6.3f} "
                 f"{r['prozedur_f1']:>6.3f} {r['medikament_f1']:>6.3f} {r['laborwert_f1']:>6.3f}")


if __name__ == "__main__":
    main()
