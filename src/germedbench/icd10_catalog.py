"""ICD-10-GM 2025 catalog lookup."""

import json
from functools import lru_cache

from germedbench.config import settings

CATALOG_PATH = settings.data_dir / "icd10gm_2025.json"


@lru_cache(maxsize=1)
def _load_catalog() -> dict[str, dict]:
    with open(CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


def lookup(code: str) -> dict | None:
    """Look up an ICD-10-GM code. Returns {'display': str, 'terminal': bool} or None."""
    return _load_catalog().get(code.strip())


def display(code: str) -> str:
    """Get display name for a code, or the code itself if not found."""
    entry = lookup(code)
    return entry["display"] if entry else code


def is_valid(code: str) -> bool:
    """Check if a code exists in ICD-10-GM 2025."""
    return lookup(code) is not None


def is_terminal(code: str) -> bool:
    """Check if a code is terminal (codeable)."""
    entry = lookup(code)
    return entry["terminal"] if entry else False
