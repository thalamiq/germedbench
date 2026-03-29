"""Shared scoring utilities used across all evaluation tasks."""

import json
import logging
import re

log = logging.getLogger(__name__)


def f1(precision: float, recall: float) -> float:
    """Compute F1 score from precision and recall."""
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def tokenize(name: str) -> set[str]:
    """Lowercase, strip, split into word tokens."""
    return set(name.strip().lower().split())


def names_match(a: str, b: str) -> bool:
    """Fast text-based fuzzy match: containment or word-token Jaccard > 0.5."""
    a_lower = a.strip().lower()
    b_lower = b.strip().lower()
    if a_lower in b_lower or b_lower in a_lower:
        return True
    tokens_a = tokenize(a)
    tokens_b = tokenize(b)
    if not tokens_a or not tokens_b:
        return False
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union) > 0.5


_MATCH_PROMPTS: dict[str, str] = {
    "diagnoses": (
        "Vergleiche die beiden Listen medizinischer Diagnosen. "
        "Finde Paare, die dieselbe klinische Diagnose beschreiben "
        "(auch wenn die Formulierung unterschiedlich ist)."
    ),
    "medications": (
        "Vergleiche die beiden Listen von Medikamenten-Wirkstoffen. "
        "Finde Paare, die denselben Wirkstoff beschreiben "
        "(auch bei unterschiedlicher Schreibweise, Handelsnamen vs. Wirkstoff, "
        "oder Salzform-Varianten wie Metoprololsuccinat/Metoprolol)."
    ),
}

_MATCH_TEMPLATE = """\
{domain_instruction}

Liste A (Gold):
{gold_list}

Liste B (Predicted):
{pred_list}

Antworte ausschließlich mit einem JSON-Array von Paaren [a_index, b_index] \
(0-basiert). Nur echte Übereinstimmungen. Leeres Array [] wenn keine.
"""

MATCH_MODEL = "gemini-3.1-flash-lite-preview"


def match_names_llm(
    gold_names: list[str],
    pred_names: list[str],
    domain: str = "diagnoses",
) -> list[tuple[int, int]]:
    """Match names using text matching first, then Gemini Flash Lite for remainders.

    Args:
        gold_names: Reference names
        pred_names: Predicted names
        domain: "diagnoses" or "medications" — controls the LLM prompt

    Returns: List of (gold_idx, pred_idx) pairs.
    """
    if not gold_names or not pred_names:
        return []

    # Try fast text matching first — only call LLM for unmatched
    text_matched_gold: set[int] = set()
    text_matched_pred: set[int] = set()
    text_pairs: list[tuple[int, int]] = []

    for pi, pn in enumerate(pred_names):
        for gi, gn in enumerate(gold_names):
            if gi in text_matched_gold:
                continue
            if names_match(pn, gn):
                text_matched_gold.add(gi)
                text_matched_pred.add(pi)
                text_pairs.append((gi, pi))
                break

    # If everything matched via text, skip LLM
    remaining_gold = [(i, n) for i, n in enumerate(gold_names) if i not in text_matched_gold]
    remaining_pred = [(i, n) for i, n in enumerate(pred_names) if i not in text_matched_pred]

    if not remaining_gold or not remaining_pred:
        return text_pairs

    # Call LLM for remaining unmatched names
    try:
        from google import genai
        from google.genai.types import GenerateContentConfig
        from germedbench.config import settings

        if not settings.gemini_api_key:
            return text_pairs

        client = genai.Client(api_key=settings.gemini_api_key)

        gold_fmt = "\n".join(f"  {i}: {n}" for i, n in enumerate(remaining_gold))
        pred_fmt = "\n".join(f"  {i}: {n}" for i, n in enumerate(remaining_pred))

        instruction = _MATCH_PROMPTS.get(domain, _MATCH_PROMPTS["diagnoses"])
        prompt = _MATCH_TEMPLATE.format(
            domain_instruction=instruction,
            gold_list=gold_fmt,
            pred_list=pred_fmt,
        )
        response = client.models.generate_content(
            model=MATCH_MODEL,
            contents=prompt,
            config=GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )

        pairs = json.loads(response.text)
        if isinstance(pairs, list):
            for pair in pairs:
                if isinstance(pair, list) and len(pair) == 2:
                    local_gi, local_pi = int(pair[0]), int(pair[1])
                    if local_gi < len(remaining_gold) and local_pi < len(remaining_pred):
                        real_gi = remaining_gold[local_gi][0]
                        real_pi = remaining_pred[local_pi][0]
                        if real_gi not in text_matched_gold and real_pi not in text_matched_pred:
                            text_pairs.append((real_gi, real_pi))
                            text_matched_gold.add(real_gi)
                            text_matched_pred.add(real_pi)

    except Exception as e:
        log.warning(f"LLM name matching ({domain}) failed, using text-only: {e}")

    return text_pairs


# Backward-compatible alias
def match_diagnoses_llm(
    gold_names: list[str],
    pred_names: list[str],
) -> list[tuple[int, int]]:
    return match_names_llm(gold_names, pred_names, domain="diagnoses")


def normalize_code(code: str) -> str:
    """Normalize an ICD-10 or OPS code for comparison.

    - Uppercase
    - Strip whitespace
    - Remove trailing dash placeholders (e.g. 'I21.-' -> 'I21')
    """
    c = code.strip().upper()
    c = re.sub(r"\.-$", "", c)
    return c


def to_category(code: str) -> str:
    """Extract category from ICD-10 code: 'I21.0' -> 'I21'."""
    return normalize_code(code).split(".")[0]
