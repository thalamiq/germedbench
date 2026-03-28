"""Shared helpers for data generation scripts."""

import argparse
import json
import re
from pathlib import Path


def parse_gen_args(task_name: str, default_n: int) -> argparse.Namespace:
    """Parse CLI args for generate scripts: [N] [--overwrite]."""
    parser = argparse.ArgumentParser(
        description=f"Generate synthetic {task_name} benchmark cases."
    )
    parser.add_argument(
        "n", nargs="?", type=int, default=default_n,
        help=f"Number of cases to generate (default: {default_n})",
    )
    parser.add_argument(
        "--overwrite", action="store_true",
        help="Overwrite existing data instead of appending",
    )
    return parser.parse_args()


def next_case_id(output_path: Path, prefix: str) -> int:
    """Read existing JSONL and return the next case ID number.

    Scans IDs matching the pattern `{prefix}_NNN` and returns max + 1.
    Returns 1 if file doesn't exist or is empty.
    """
    if not output_path.exists():
        return 1

    max_id = 0
    pattern = re.compile(rf"^{re.escape(prefix)}_(\d+)$")

    with open(output_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                match = pattern.match(data.get("id", ""))
                if match:
                    max_id = max(max_id, int(match.group(1)))
            except (json.JSONDecodeError, KeyError):
                continue

    return max_id + 1


def write_cases(output_path: Path, cases: list, overwrite: bool) -> None:
    """Write cases to JSONL file (append or overwrite)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mode = "w" if overwrite else "a"

    with open(output_path, mode, encoding="utf-8") as f:
        for case in cases:
            f.write(case.model_dump_json() + "\n")

    verb = "written to" if overwrite else "appended to"
    print(f"\nDone. {len(cases)} cases {verb} {output_path}")
