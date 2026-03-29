# GerMedBench

Ein offenes Benchmark-Framework zur Evaluation von Large Language Models auf deutschen klinischen Texten.

## Motivation

Für den englischsprachigen Raum existieren etablierte medizinische LLM-Benchmarks (MedQA, MedHELM). Für Deutsch gibt es bisher keine systematische, öffentliche Evaluation generativer klinischer Fähigkeiten. GerMedBench schließt diese Lücke.

## Tasks

| Task | Beschreibung | Evaluation | Primäre Metrik |
|------|-------------|------------|----------------|
| ICD-10-Kodierung | Haupt-/Nebendiagnosen aus klinischem Freitext nach ICD-10-GM kodieren | Automatisch | Exact Match F1 |
| Arztbrief-Zusammenfassung | Strukturierte Kurzfassung von Entlassbriefen | LLM-as-Judge (Faktentreue, Vollständigkeit, Klinische Präzision) | Overall Score |
| Klinisches Reasoning | Differentialdiagnostik mit klinischer Begründung aus Fallvignetten | Hybrid: Auto (Top-1, Top-3, DDx F1) + LLM-as-Judge | Overall Score |
| Medikamentenextraktion | Wirkstoff, Dosis, Frequenz aus Freitext | Automatisch | Exact F1 |
| Medizinisches Wissen | IMPP-Stil MC-Fragen (A–E) mit Fallvignette | Automatisch | Accuracy |
| Patientenverständliche Erklärung | Komplexe Befunde für Patienten verständlich erklären | LLM-as-Judge (Verständlichkeit, Med. Korrektheit, Vollständigkeit) | Overall Score |

Alle Texte variieren über 9 Fachbereiche (Innere Medizin, Kardiologie, Pneumologie, Neurologie, Gastroenterologie, Onkologie, Orthopädie/Unfallchirurgie, Psychiatrie/Psychosomatik, Gynäkologie/Geburtshilfe) und drei Komplexitätsgrade.

## Quickstart

### Setup

```bash
uv sync
cp .env.example .env
# API-Keys in .env eintragen (GEMINI_API_KEY, TOGETHER_API_KEY, CHAT_AI_API_KEY)
```

### Daten generieren

Jeder Task hat ein eigenes Generierungsskript. Standardmäßig wird angehängt (Append-Modus), mit `--overwrite` wird die Datei überschrieben.

```bash
uv run python scripts/generate_icd10_cases.py 50 --overwrite
uv run python scripts/generate_summarization_cases.py 50 --overwrite
uv run python scripts/generate_clinical_reasoning_cases.py 50 --overwrite
uv run python scripts/generate_med_extraction_cases.py 50 --overwrite
uv run python scripts/generate_med_qa_cases.py 50 --overwrite
uv run python scripts/generate_patient_text_cases.py 50 --overwrite
```

### Modelle evaluieren

```bash
# Automatische Tasks (kein Judge)
uv run python scripts/run_eval_icd10.py -j 6
uv run python scripts/run_eval_med_extraction.py -j 6
uv run python scripts/run_eval_med_qa.py -j 6

# LLM-as-Judge Tasks
uv run python scripts/run_eval_summarization.py -j 4
uv run python scripts/run_eval_clinical_reasoning.py -j 4
uv run python scripts/run_eval_patient_text.py -j 4

# Optionen
uv run python scripts/run_eval_icd10.py --provider together   # Nur Together-Modelle
uv run python scripts/run_eval_icd10.py -p chat_ai            # Nur Chat-AI-Modelle
uv run python scripts/run_eval_icd10.py "llama-3.3-70b-instruct"  # Spezifisches Modell
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
│   ├── schemas.py          # Datenmodelle (ICD10Case, MedQACase, PatientTextCase, ...)
│   └── evaluation/         # Scoring-Logik pro Task
├── scripts/                # Datengenerierung & Evaluation
│   ├── generate_*_cases.py # Generierung pro Task (6 Skripte)
│   ├── run_eval_*.py       # Evaluation pro Task (6 Skripte)
│   └── build_icd10_lookup.py
├── data/                   # Task-spezifische .jsonl Datensätze
├── results/                # Evaluation-Ergebnisse (pro Modell/Task/Run)
│   ├── <model>/<task>/<timestamp>.json
│   └── latest.json
└── web/                    # Next.js Leaderboard + Benchmark-Explorer
    ├── app/                # Seiten (Leaderboard, Benchmarks, Model-Detail, Methodik)
    ├── components/         # UI-Komponenten
    └── lib/                # Datentypen & Server-Side Data Loader
```

## Konfiguration

Alle Settings werden über `.env` gesteuert (siehe `.env.example`):

| Variable | Default | Beschreibung |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | API-Key für Datengenerierung + LLM-as-Judge |
| `GENERATION_MODEL` | `gemini-3-flash-preview` | Modell für synthetische Fälle |
| `JUDGE_MODEL` | `gemini-3-flash-preview` | Modell für LLM-as-Judge |
| `TOGETHER_API_KEY` | — | API-Key für Together AI Modelle |
| `CHAT_AI_API_KEY` | — | API-Key für Chat-AI (Academic Cloud) Modelle |

## Tech-Stack

- **Benchmark:** Python, pydantic-settings, google-genai, openai (Together AI + Chat-AI)
- **Website:** Next.js 15, Tailwind CSS v4, @thalamiq/ui
- **Paketmanager:** uv (Python), pnpm (Web)

## Lizenz

Apache 2.0

---

Ein Projekt von [ThalamiQ GmbH](https://thalamiq.io).
