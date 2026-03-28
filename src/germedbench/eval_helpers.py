"""Shared helpers for evaluation scripts."""

import json
import logging

from germedbench.config import settings

log = logging.getLogger(__name__)

# Task -> primary metric field for sorting
PRIMARY_METRICS: dict[str, str] = {
    "icd10_coding": "exact_match_f1",
    "summarization": "overall_score",
    "clinical_reasoning": "overall_score",
    "ner": "micro_f1",
    "med_extraction": "wirkstoff_f1",
}


def model_slug(model: str) -> str:
    """Convert model ID to filesystem-safe directory name."""
    return model.replace("/", "__")


def extract_json(raw: str) -> str:
    """Extract JSON string from model response, handling markdown fences."""
    if "```" not in raw:
        return raw
    for part in raw.split("```"):
        stripped = part.strip()
        if stripped.startswith("json"):
            stripped = stripped[4:]
        stripped = stripped.strip()
        if stripped.startswith("{"):
            return stripped
    return raw


def _sort_key(entry: dict) -> float:
    """Get primary metric value for leaderboard sorting."""
    task = entry.get("task", "")
    metric = PRIMARY_METRICS.get(task, "")
    if metric:
        return entry.get(metric, 0)
    # Fallback: try common metric names
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
