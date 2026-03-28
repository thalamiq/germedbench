"""Build a slim ICD-10-GM 2025 lookup JSON from BfArM metadata CSV."""

import json
from pathlib import Path

KODES_FILE = Path("data/icd10gm/icd10gm2025syst-meta/Klassifikationsdateien/icd10gm2025syst_kodes.txt")
OUTPUT_FILE = Path("data/icd10gm_2025.json")


def main():
    lookup: dict[str, dict] = {}

    with open(KODES_FILE, encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split(";")
            terminal = parts[1] == "T"  # T = terminal (codeable)
            code = parts[6]             # Code with dot, e.g. "A00.0"
            display = parts[8]          # Display name

            if code and display:
                # Strip ".-" suffix from non-terminal codes for cleaner lookup
                clean_code = code.replace(".-", "")
                lookup[clean_code] = {
                    "display": display,
                    "terminal": terminal,
                }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(lookup, f, ensure_ascii=False, indent=0)

    terminal_count = sum(1 for v in lookup.values() if v["terminal"])
    print(f"Built lookup with {len(lookup)} codes ({terminal_count} terminal) -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
