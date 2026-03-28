# GerMedBench

Offenes Benchmark-Framework zur Evaluation von LLMs auf deutschen klinischen Texten.

## Projekt-Setup

- **Benchmark (Python):** `src/germedbench/` — Schemas, Config, Evaluation, Katalog-Lookup
- **Website (Next.js):** `web/` — Leaderboard + Benchmark-Explorer
- **Paketmanager:** uv (Python), pnpm (Web)
- **Daten-Generierung:** Gemini 3.1 Pro (via `google-genai`)
- **Modell-Inferenz:** Together AI (via `openai` SDK)
- **Evaluation-Judge:** Gemini 3.1 Pro (via `google-genai`, für generative Tasks)
- **Lizenz:** Apache 2.0

## Architektur

```
germedbench/
├── src/germedbench/
│   ├── config.py               # pydantic-settings, .env
│   ├── schemas.py              # ICD10Case, SummarizationCase, etc.
│   ├── icd10_catalog.py        # BfArM ICD-10-GM 2025 Lookup
│   ├── gen_helpers.py           # Shared: parse_gen_args, load_base_cases, write_cases
│   ├── eval_helpers.py          # Shared: model_slug, extract_json, update_latest
│   └── evaluation/
│       ├── utils.py             # Shared: f1, names_match, normalize_code
│       ├── icd10_scoring.py     # Exact Match, Category Match
│       ├── summarization_scoring.py   # LLM-as-Judge
│       ├── clinical_reasoning_scoring.py  # Hybrid: Auto DDx + LLM-as-Judge
│       ├── ner_scoring.py       # Micro F1, per-type F1
│       └── med_extraction_scoring.py  # Wirkstoff/Partial/Exact F1
├── scripts/
│   ├── generate_icd10_cases.py          # Per-task generation
│   ├── generate_summarization_cases.py
│   ├── generate_clinical_reasoning_cases.py
│   ├── generate_ner_cases.py
│   ├── generate_med_extraction_cases.py
│   ├── run_eval_icd10.py               # Per-task evaluation
│   ├── run_eval_summarization.py
│   ├── run_eval_clinical_reasoning.py
│   ├── run_eval_ner.py
│   ├── run_eval_med_extraction.py
│   └── build_icd10_lookup.py
├── data/                       # Task-specific .jsonl datasets
├── results/                    # <model>/<task>/<timestamp>.json + latest.json
└── web/                        # Next.js 15 + @thalamiq/ui
    ├── app/                    # Leaderboard, Benchmarks, Model-Detail, Methodik
    ├── components/             # LeaderboardChart, Header
    └── lib/                    # Types (discriminated unions), Data Loaders
```

## Aktive Tasks

1. **ICD-10-GM Kodierung** — Extraktion, automatisch evaluierbar (Exact Match F1, Category F1, HD Accuracy)
2. **Arztbrief-Zusammenfassung** — Generativ, LLM-as-Judge (Faktentreue, Vollständigkeit, Halluzinationsfreiheit, Formatkonformität)
3. **Klinisches Reasoning** — Differentialdiagnostik, Hybrid-Scoring: automatisch (Top-1 Acc, Top-3 Recall, DDx F1) + LLM-as-Judge (Reasoning-Qualität, DDx-Plausibilität, Red-Flag-Bewusstsein)
4. **Klinische Entitätsextraktion (NER)** — Diagnosen, Prozeduren, Medikamente, Laborwerte; automatisch evaluierbar (Micro F1, per-type F1)
5. **Medikamentenextraktion** — Wirkstoff, Dosis, Frequenz aus Freitext; automatisch evaluierbar (Wirkstoff F1, Partial F1, Exact F1)

## Web-Stack

- Next.js 15 mit App Router + Turbopack
- Tailwind CSS v4 (CSS-basiert, kein tailwind.config)
- `@thalamiq/ui` für alle UI-Komponenten (shadcn-basiert)
- Discriminated union types für Multi-Task-Support (`ICD10Result | SummarizationResult`)

## Konventionen

- Datensätze als JSON Lines (.jsonl), ein Eintrag pro klinischer Fall
- Alle klinischen Texte auf Deutsch
- ICD-10-GM Version 2025 (deutsche Modifikation), Display-Namen aus BfArM-Katalog
- Results: `results/<model_slug>/<task>/<timestamp>.json` + `results/latest.json`
- latest.json key: `model:task` für Multi-Task-Koexistenz
