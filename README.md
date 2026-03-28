# GerMedBench

Ein offenes Benchmark-Framework zur Evaluation von Large Language Models auf deutschen klinischen Texten.

## Motivation

Für den englischsprachigen Raum existieren etablierte medizinische LLM-Benchmarks (MedQA, MedHELM). Für Deutsch gibt es bisher keine systematische, öffentliche Evaluation generativer klinischer Fähigkeiten. GerMedBench schließt diese Lücke.

## Tasks

| Task | Beschreibung | Evaluation | Status |
|------|-------------|------------|--------|
| ICD-10-Kodierung | Zuordnung von Haupt-/Nebendiagnosen aus klinischem Freitext nach ICD-10-GM | Exact Match, Category F1, Hauptdiagnose-Accuracy | Aktiv |
| Arztbrief-Zusammenfassung | Strukturierte Kurzfassung von Entlassbriefen | LLM-as-Judge (Faktentreue, Vollständigkeit, Halluzinationsfreiheit, Format) | Aktiv |
| Klinisches Reasoning | Differentialdiagnostik mit klinischer Begründung aus Fallvignetten | Hybrid: Auto (Top-1, Top-3, DDx F1) + LLM-as-Judge (Reasoning, Plausibilität, Red Flags) | Aktiv |
| Klinische Entitätsextraktion | Diagnosen, Prozeduren, Medikamente, Laborwerte erkennen | Micro F1, per-type F1 (Diagnose, Prozedur, Medikament, Laborwert) | Aktiv |
| Medikamentenextraktion | Wirkstoff, Dosis, Frequenz aus Freitext | Wirkstoff F1, Partial F1, Exact F1 | Aktiv |

## Quickstart

### Setup

```bash
uv sync
cp .env.example .env
# API-Keys in .env eintragen (GEMINI_API_KEY, TOGETHER_API_KEY)
```

### Daten generieren

Jeder Task hat ein eigenes Generierungsskript, das fokussierte klinische Texte mit passender Ground Truth erstellt. Standardmäßig wird angehängt (Append-Modus), mit `--overwrite` wird die Datei überschrieben.

```bash
uv run python scripts/generate_icd10_cases.py               # ICD-10 Kodierung
uv run python scripts/generate_summarization_cases.py        # Arztbrief-Zusammenfassung
uv run python scripts/generate_clinical_reasoning_cases.py   # Klinisches Reasoning
uv run python scripts/generate_ner_cases.py                  # Klinische Entitätsextraktion
uv run python scripts/generate_med_extraction_cases.py       # Medikamentenextraktion

# Optionen
uv run python scripts/generate_icd10_cases.py 20             # 20 Fälle anhängen
uv run python scripts/generate_icd10_cases.py --overwrite    # Datei überschreiben
```

### Modelle evaluieren

```bash
# ICD-10 Kodierung (automatische Evaluation)
uv run python scripts/run_eval_icd10.py

# Arztbrief-Zusammenfassung (LLM-as-Judge)
uv run python scripts/run_eval_summarization.py

# Klinisches Reasoning (Hybrid: Auto + LLM-as-Judge)
uv run python scripts/run_eval_clinical_reasoning.py

# Klinische Entitätsextraktion (automatische Evaluation)
uv run python scripts/run_eval_ner.py

# Medikamentenextraktion (automatische Evaluation)
uv run python scripts/run_eval_med_extraction.py

# Spezifische Modelle:
uv run python scripts/run_eval_icd10.py "meta-llama/Llama-3.3-70B-Instruct-Turbo"
```

Ergebnisse werden nach `results/<model>/<task>/<timestamp>.json` geschrieben.
Ein aggregiertes `results/latest.json` wird automatisch aktualisiert.

### Website

```bash
cd web
pnpm install
pnpm dev
```

Die Website liest direkt aus `data/` und `results/` — kein separater API-Server nötig.

## Projektstruktur

```
germedbench/
├── src/germedbench/        # Python-Paket (Config, Schemas, Evaluation)
│   ├── config.py           # Zentrale Settings (pydantic-settings, .env)
│   ├── schemas.py          # Datenmodelle (ICD10Case, ClinicalReasoningCase, ...)
│   └── evaluation/         # Scoring-Logik pro Task
├── scripts/                # Datengenerierung & Evaluation
│   ├── generate_icd10_cases.py          # Generierung pro Task
│   ├── generate_summarization_cases.py
│   ├── generate_clinical_reasoning_cases.py
│   ├── generate_ner_cases.py
│   ├── generate_med_extraction_cases.py
│   ├── run_eval_icd10.py               # Evaluation pro Task
│   ├── run_eval_summarization.py
│   ├── run_eval_clinical_reasoning.py
│   ├── run_eval_ner.py
│   └── run_eval_med_extraction.py
├── data/                   # Task-spezifische .jsonl Datensätze
├── results/                # Evaluation-Ergebnisse (pro Modell/Task/Run)
│   ├── <model>/<task>/<timestamp>.json
│   └── latest.json
├── web/                    # Next.js Leaderboard + Benchmark-Explorer
│   ├── app/                # Seiten (Leaderboard, Benchmarks, Model-Detail)
│   ├── components/         # UI-Komponenten (Charts, Header)
│   └── lib/                # Datentypen & Server-Side Data Loader
└── docs/                   # Dokumentation
```

## Konfiguration

Alle Settings werden über `.env` gesteuert (siehe `.env.example`):

| Variable | Default | Beschreibung |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | API-Key für Datengenerierung + LLM-as-Judge |
| `GENERATION_MODEL` | `gemini-3-flash-preview` | Modell für synthetische Fälle |
| `GENERATION_TEMPERATURE` | `0.9` | Temperatur bei Generierung |
| `TOGETHER_API_KEY` | — | API-Key für Open-Source-Modell-Inferenz |
| `JUDGE_MODEL` | `gemini-3.1-pro-preview` | Modell für LLM-as-Judge |
| `ICD10_NUM_CASES` | `10` | Anzahl ICD-10 Fälle |
| `SUMMARIZATION_NUM_CASES` | `10` | Anzahl Zusammenfassungs-Fälle |
| `CLINICAL_REASONING_NUM_CASES` | `10` | Anzahl Reasoning-Fälle |
| `NER_NUM_CASES` | `10` | Anzahl NER-Fälle |
| `MED_EXTRACTION_NUM_CASES` | `10` | Anzahl Medikamentenextraktions-Fälle |

## Tech-Stack

- **Benchmark:** Python, pydantic-settings, google-genai, openai (Together AI)
- **Website:** Next.js 15, Tailwind CSS v4, @thalamiq/ui
- **Paketmanager:** uv (Python), pnpm (Web)

## Lizenz

Apache 2.0

---

Ein Projekt von [ThalamiQ GmbH](https://thalamiq.io) in Zusammenarbeit mit dem [Institut für KI in der Medizin (IKIM)](https://ikim.uk-essen.de), Universitätsklinikum Essen.
