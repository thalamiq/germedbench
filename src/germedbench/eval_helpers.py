"""Shared helpers for evaluation scripts."""

import argparse
import json
import logging
import sys

from openai import OpenAI

from germedbench.config import settings, EvalModel

log = logging.getLogger(__name__)

# Task -> primary metric field for sorting
PRIMARY_METRICS: dict[str, str] = {
    "icd10_coding": "exact_match_f1",
    "summarization": "overall_score",
    "clinical_reasoning": "overall_score",
    "ner": "micro_f1",
    "med_extraction": "wirkstoff_f1",
}

# Provider -> (api_key_attr, base_url_attr)
_PROVIDER_CONFIG: dict[str, tuple[str, str]] = {
    "together": ("together_api_key", "together_base_url"),
    "chat_ai": ("chat_ai_api_key", "chat_ai_base_url"),
}

_clients: dict[str, OpenAI] = {}


def get_client(provider: str) -> OpenAI:
    """Get or create an OpenAI-compatible client for the given provider."""
    if provider in _clients:
        return _clients[provider]

    cfg = _PROVIDER_CONFIG.get(provider)
    if not cfg:
        log.error(f"Unknown provider: {provider}. Known: {list(_PROVIDER_CONFIG)}")
        sys.exit(1)

    api_key = getattr(settings, cfg[0], "")
    base_url = getattr(settings, cfg[1], "")

    if not api_key:
        log.error(f"{cfg[0].upper()} not set in .env (required for provider '{provider}')")
        sys.exit(1)

    client = OpenAI(api_key=api_key, base_url=base_url)
    _clients[provider] = client
    return client


import time as _time

MAX_TOKENS = 8192  # high ceiling for thinking models; shorter responses stop early
MAX_RETRIES = 3


def call_model(client, model: str, prompt: str) -> tuple[str, dict]:
    """Call a model and return (raw_text, usage_dict). Retries on empty responses."""
    for attempt in range(MAX_RETRIES):
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=MAX_TOKENS,
        )
        raw = response.choices[0].message.content or ""
        usage = response.usage
        usage_dict = {
            "prompt_tokens": usage.prompt_tokens if usage else None,
            "completion_tokens": usage.completion_tokens if usage else None,
        }
        if raw.strip():
            return raw, usage_dict
        if attempt < MAX_RETRIES - 1:
            log.warning(f"  Empty response (attempt {attempt + 1}/{MAX_RETRIES}), retrying...")
            _time.sleep(1)
    return raw, usage_dict


class EvalArgs:
    models: list[EvalModel]
    parallel: int  # 0 = sequential, >0 = max workers


def parse_eval_args(task_name: str) -> EvalArgs:
    """Parse eval CLI args.

    Usage:
        run_eval_<task>.py                        # all models, sequential
        run_eval_<task>.py --parallel              # all models, parallel (4 workers)
        run_eval_<task>.py -j 8                    # all models, 8 workers
        run_eval_<task>.py --provider together     # only together models
        run_eval_<task>.py model_id1 model_id2     # specific models
    """
    parser = argparse.ArgumentParser(description=f"Evaluate models on {task_name}.")
    parser.add_argument("models", nargs="*", help="Specific model IDs to evaluate")
    parser.add_argument("--provider", "-p", help="Only run models from this provider")
    parser.add_argument("--parallel", "-j", nargs="?", const=4, type=int, default=0,
                        help="Run models in parallel (default: 4 workers)")
    args = parser.parse_args()

    if args.models:
        models = [EvalModel(id=m) for m in args.models]
    else:
        models = list(settings.eval_models)
        if args.provider:
            models = [m for m in models if m.provider == args.provider]
            if not models:
                log.error(f"No models found for provider '{args.provider}'")
                sys.exit(1)

    result = EvalArgs()
    result.models = models
    result.parallel = args.parallel
    return result


def model_slug(model: str) -> str:
    """Convert model ID to filesystem-safe directory name."""
    return model.replace("/", "__")


def extract_json(raw: str) -> str:
    """Extract first JSON object from model response.

    Handles: <think> blocks (closed and unclosed), markdown fences, trailing commentary.
    """
    import re

    # Strip <think>...</think> (or unclosed <think>... to end)
    text = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    text = re.sub(r"<think>.*", "", text, flags=re.DOTALL)
    text = text.strip()

    # Try markdown fences first
    if "```" in text:
        for part in text.split("```"):
            stripped = part.strip()
            if stripped.startswith("json"):
                stripped = stripped[4:].strip()
            if stripped.startswith("{"):
                return stripped

    # Find first { and match to its closing }
    start = text.find("{")
    if start == -1:
        return text
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]

    # Unclosed JSON (truncated response) — return from { to end
    return text[start:]


def run_eval(
    eval_args: EvalArgs,
    eval_fn,
) -> list[dict]:
    """Run eval_fn for each model, sequentially or in parallel.

    eval_fn(model: EvalModel) -> dict | None
    """
    models = eval_args.models

    if eval_args.parallel > 0:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        log.info(f"Running {len(models)} models in parallel ({eval_args.parallel} workers)")
        results = []
        with ThreadPoolExecutor(max_workers=eval_args.parallel) as pool:
            futures = {pool.submit(eval_fn, m): m for m in models}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)
        return results

    results = []
    for m in models:
        result = eval_fn(m)
        if result:
            results.append(result)
    return results


def _sort_key(entry: dict) -> float:
    """Get primary metric value for leaderboard sorting."""
    task = entry.get("task", "")
    metric = PRIMARY_METRICS.get(task, "")
    if metric:
        return entry.get(metric, 0)
    for key in ("overall_score", "exact_match_f1", "micro_f1", "wirkstoff_f1"):
        if key in entry:
            return entry[key]
    return 0


def update_latest(new_results: list[dict]) -> None:
    """Write latest.json with the newest result per (model, task) pair."""
    latest_path = settings.results_dir / "latest.json"

    existing: dict[str, dict] = {}
    if latest_path.exists():
        with open(latest_path, encoding="utf-8") as f:
            for entry in json.load(f):
                key = f"{entry['model']}:{entry.get('task', 'icd10_coding')}"
                existing[key] = entry

    for r in new_results:
        key = f"{r['model']}:{r['task']}"
        existing[key] = r

    entries = sorted(existing.values(), key=_sort_key, reverse=True)
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    log.info(f"Updated {latest_path}")
