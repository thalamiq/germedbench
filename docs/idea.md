# GerMedBench

**Ein offenes Benchmark-Framework zur Evaluation von Large Language Models auf deutschen klinischen Texten**

---

## Hintergrund und Motivation

Large Language Models (LLMs) werden zunehmend im klinischen Alltag eingesetzt — für die Generierung von Arztbriefen, die Kodierung von Diagnosen und die Unterstützung klinischer Entscheidungen. Für den englischsprachigen Raum existieren etablierte Benchmarks wie MedQA, MedHELM oder LLMEval-Med. Der deutschsprachige klinische Bereich ist hingegen ein blinder Fleck: Bestehende deutsche Datensätze (GGPONC, BRONCO, GraSCCo) wurden für die BERT-Ära entwickelt und evaluieren vorwiegend klassische NLP-Tasks wie Named Entity Recognition. Generative klinische Fähigkeiten moderner LLMs — Zusammenfassung, klinisches Reasoning, ICD-Kodierung aus Freitext, Halluzinationserkennung — wurden für Deutsch bisher nicht systematisch und öffentlich bewertet.

GerMedBench schließt diese Lücke.

---

## Projektziel

GerMedBench ist ein offenes, community-getriebenes Leaderboard, das LLMs auf realistischen deutschen klinischen Aufgaben bewertet. Ziel ist es, für Kliniken, Forschungseinrichtungen und KI-Unternehmen eine verlässliche, transparente Grundlage zu schaffen, um die klinische Eignung von Sprachmodellen für den deutschen Markt zu beurteilen.

---

## Evaluation-Tasks (MVP)

### Task 1 — Klinische Entitätsextraktion
**Input:** Synthetischer deutscher Arztbrief  
**Aufgabe:** Extraktion von Diagnosen (ICD-10), Medikamenten (Wirkstoff, Dosierung), Prozeduren (OPS) und relevanten Laborwerten  
**Evaluation:** F1-Score gegen strukturierte Ground Truth; automatisch berechenbar  
**Referenzdaten:** Synthetisch generiert + angelehnt an BRONCO-Schema

### Task 2 — Arztbrief-Zusammenfassung
**Input:** Vollständiger Entlassbrief (Internist, Kardiologie, Onkologie)  
**Aufgabe:** Strukturierte Kurzfassung mit Hauptdiagnose, Therapie, Procedere und offenen Fragen  
**Evaluation:** LLM-as-Judge (Claude Opus) anhand einer klinisch validierten Rubrik: Faktentreue, Vollständigkeit, Halluzinationsrate, Formatkonformität (je 1–5)  

### Task 3 — ICD-10-Kodierung aus Freitext
**Input:** Klinischer Entlassungstext oder Kurzepikrise  
**Aufgabe:** Korrekte Zuordnung von Haupt- und Nebendiagnosen nach ICD-10-GM  
**Evaluation:** Exact Match und partial credit (Kategorie-Level vs. Voll-Code); automatisch

### Task 4 — Klinisches Reasoning (geplant für V2)
**Input:** Fallvignette aus Arztbrief  
**Aufgabe:** Offene Fragen zu Differenzialdiagnosen, Therapieentscheidungen, nächsten diagnostischen Schritten  
**Evaluation:** LLM-as-Judge + optional Community-Rating durch Ärzte

---

## Datenstrategie

**Phase 1 — Synthetische Texte (MVP)**  
Ein Frontier-Modell (Claude Sonnet) generiert realistische Arztbriefe nach klinisch validierten Templates, überprüft durch Ärzte. Unterschiedliche Fachbereiche (Innere Medizin, Kardiologie, Onkologie, Neurologie), Komplexitätsgrade und Schreibstile. Kein Datenschutzproblem, sofort verfügbar.

**Phase 2 — Öffentliche Korpora**  
Integration bestehender öffentlicher Datensätze (GraSCCo, GGPONC 2.0, BRONCO150) für NER-basierte Tasks.

**Phase 3 — Crowdsourcing (Community)**  
Ärzte können anonymisierte/pseudonymisierte Fälle einreichen. Standardisierter Einreichungsprozess mit Einverständniserklärung.

---

## Technische Architektur

```
Orchestrator (Claude Sonnet)
  ├── Generierung synthetischer Arztbriefe
  ├── Erstellung von Tasks + Ground Truth
  └── Aufruf der zu evaluierenden Modelle via API

Judge (Claude Opus)
  ├── Bewertung generativer Outputs nach Rubrik
  ├── Halluzinationserkennung
  └── Strukturierter Score-Output (JSON)

Leaderboard (statische Website)
  ├── Öffentliches Ranking aller evaluierten Modelle
  ├── Aufschlüsselung nach Task und Subkategorie
  └── Submission via GitHub Pull Request
```

**Stack:** Python (Evaluation-Framework), GitHub (Submissions + Versionierung), Vercel (Leaderboard-Website)  
**Lizenz:** Apache 2.0 (Framework + Datensätze), Submissions unter CC-BY 4.0

---

## Evaluierte Modelle (geplant für Launch)

Open-Source-Fokus:
- Llama 3.x (Meta)
- Mistral / Mixtral
- Qwen 2.5 (Alibaba)
- Meditron (EPFL)
- medbert.de / BioGottBERT (als Baseline für NER-Tasks)

Closed-Source als Referenz:
- GPT-4o
- Claude Sonnet/Opus
- Gemini 2.5 Pro

---

## Differenzierung

| | GerMedBench | MedHELM | BRONCO |
|---|---|---|---|
| Sprache | Deutsch | Englisch | Deutsch |
| LLM-fokussiert | ✓ | ✓ | ✗ |
| Generative Tasks | ✓ | ✓ | ✗ |
| Öffentliches Leaderboard | ✓ | teilweise | ✗ |
| ICD-10-GM | ✓ | ✗ | ✗ |
| Open Source | ✓ | ✗ | ✓ |
| Crowdsourcing | geplant | ✗ | ✗ |

---

## Team und Hintergrund

GerMedBench wird von **ThalamiQ GmbH** initiiert — einem deutschen Healthcare-AI-Unternehmen mit Fokus auf klinische KI-Infrastruktur und FHIR-Interoperabilität. Das Projekt entsteht in enger Zusammenarbeit mit dem **Institut für KI in der Medizin (IKIM)** am Universitätsklinikum Essen, das direkte klinische Deployment-Erfahrung und Zugang zu medizinisch-informatischem Know-how einbringt.

Wir verstehen GerMedBench als neutrales, wissenschaftlich fundiertes Instrument — kein Vendor-Tool, sondern ein offener Standard für die Community.

---

## Roadmap

| Meilenstein | Zeitraum |
|---|---|
| Synthetischer Korpus V1 (50 Arztbriefe, 3 Fachbereiche) | Q2 2026 |
| Evaluation-Framework (Tasks 1–3) + Judge-Rubrik | Q2 2026 |
| Leaderboard-Website Launch + erste Modell-Evaluationen | Q3 2026 |
| Community-Submission-Prozess | Q3 2026 |
| Task 4 (Clinical Reasoning) + V2 Korpus | Q4 2026 |
| Paper-Submission (GMDS / BioNLP) | Q1 2027 |

---

## Mitmachen

GerMedBench lebt von der Community. Wir suchen:

- **Klinische Reviewer** — Ärzte die synthetische Texte validieren (Aufwand: ~2h)
- **Modell-Submissions** — Teams die ihre Modelle evaluieren lassen möchten
- **Datenbeiträge** — anonymisierte klinische Texte nach unserem Schema

Kontakt: [bench@thalamiq.io](mailto:bench@thalamiq.io) | GitHub: [github.com/thalamiq/germedbench](https://github.com/thalamiq/germedbench)

---

*GerMedBench ist ein Open-Source-Projekt von ThalamiQ GmbH, München. Gefördert durch die Überzeugung, dass klinische KI in Deutschland einer soliden, unabhängigen Evaluationsgrundlage bedarf.*