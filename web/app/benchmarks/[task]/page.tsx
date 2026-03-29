import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBenchmarkCases, getLeaderboard } from "@/lib/data";
import { TASK_CONFIG, type TaskId } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@thalamiq/ui/components/card";

export const dynamic = "force-dynamic";

const TASK_META: Record<string, { name: string; description: string; metrics: string[]; input: string; output: string; prompt: string }> = {
  icd10_coding: {
    name: "ICD-10-GM Kodierung",
    description: "Haupt- und Nebendiagnosen aus klinischem Freitext kodieren — Benchmark-Fälle und Ergebnisse.",
    metrics: ["Exact Match F1", "Category F1", "Hauptdiagnose Accuracy"],
    input: "Kurzepikrise / Entlassungsbrief",
    output: "ICD-10-GM Codes",
    prompt: `Du bist ein medizinischer Kodierer. Extrahiere alle ICD-10-GM Codes aus dem folgenden klinischen Text.

Regeln:
- Verwende ausschließlich ICD-10-GM Version 2025 (deutsche Modifikation)
- Code-Format: Buchstabe + 2 Ziffern + Punkt + Subklassifikation (z.B. "I21.0", "E11.90", "J44.11")
- Kodiere so spezifisch wie der Text es erlaubt
- Markiere genau eine Hauptdiagnose, der Rest sind Nebendiagnosen
- Extrahiere alle kodierbaren Diagnosen aus dem Text

Antworte ausschließlich im folgenden JSON-Format:
{
  "diagnosen": [
    {"code": "I21.0", "typ": "Hauptdiagnose"},
    {"code": "I10.90", "typ": "Nebendiagnose"}
  ]
}

Klinischer Text:
{text}`,
  },
  summarization: {
    name: "Arztbrief-Zusammenfassung",
    description: "Strukturierte Kurzfassung von Entlassbriefen — bewertet durch LLM-as-Judge.",
    metrics: ["Faktentreue", "Vollständigkeit", "Klinische Präzision", "Overall"],
    input: "Vollständiger Entlassbrief",
    output: "Strukturierte Zusammenfassung (Hauptdiagnose, Therapie, Procedere, Offene Fragen)",
    prompt: `Du bist ein erfahrener deutscher Klinikarzt. Lies den folgenden Entlassbrief und erstelle eine strukturierte Zusammenfassung.

Antworte ausschließlich im folgenden JSON-Format:
{
  "hauptdiagnose": "Die Hauptdiagnose in einem Satz",
  "therapie": "Durchgeführte Therapie in 2-3 Sätzen",
  "procedere": "Empfohlenes weiteres Vorgehen in 2-3 Sätzen",
  "offene_fragen": "Offene klinische Fragen oder 'Keine'"
}

Entlassbrief:
{text}`,
  },
  clinical_reasoning: {
    name: "Klinisches Reasoning",
    description: "Differentialdiagnostik und klinisches Reasoning aus Fallvignetten — bewertet durch automatische DDx-Metriken und LLM-as-Judge.",
    metrics: ["Top-1 Accuracy", "Top-3 Recall", "DDx F1", "Reasoning-Qualität", "DDx-Plausibilität", "Red Flags", "Overall"],
    input: "Klinische Fallvignette (Anamnese, Befunde, Labor)",
    output: "Geordnete Differentialdiagnose-Liste mit Begründung",
    prompt: `Du bist ein erfahrener deutscher Klinikarzt. Lies die folgende klinische Fallvignette und erstelle eine Differentialdiagnose-Liste mit klinischer Begründung.

Antworte ausschließlich im folgenden JSON-Format:
{
  "differentialdiagnosen": [
    {
      "name": "Diagnose-Name",
      "icd10_code": "ICD-10-GM Code (optional)",
      "reasoning": "Klinische Begründung in 1-2 Sätzen",
      "likelihood": "hoch/mittel/gering"
    }
  ]
}

Erstelle 3-5 Differentialdiagnosen, geordnet nach Wahrscheinlichkeit (wahrscheinlichste zuerst). Beziehe dich in der Begründung konkret auf Befunde aus dem Falltext.

Klinische Fallvignette:
{text}`,
  },
  med_extraction: {
    name: "Medikamentenextraktion",
    description: "Wirkstoff, Dosis und Frequenz aus klinischem Freitext extrahieren — vollautomatisch evaluiert.",
    metrics: ["Wirkstoff F1", "Partial F1", "Exact F1"],
    input: "Entlassbrief-Auszug mit Medikamentenliste",
    output: "Strukturierte Medikamentenliste (Wirkstoff, Dosis, Frequenz)",
    prompt: `Du bist ein pharmazeutischer Experte. Extrahiere alle Medikamente aus dem folgenden klinischen Text.

Für jedes Medikament extrahiere:
- wirkstoff: Der Wirkstoff (z.B. "Metoprolol", "Ramipril")
- dosis: Die Dosierung (z.B. "47.5 mg", "5 mg")
- frequenz: Die Einnahmefrequenz (z.B. "1-0-0", "2x täglich", "alle 8h")
- darreichungsform: Die Darreichungsform (z.B. "p.o.", "i.v.", "s.c.")

Antworte ausschließlich im folgenden JSON-Format:
{
  "medications": [
    {
      "wirkstoff": "Metoprolol",
      "dosis": "47.5 mg",
      "frequenz": "1-0-0",
      "darreichungsform": "p.o."
    }
  ]
}

Klinischer Text:
{text}`,
  },
  med_qa: {
    name: "Medizinisches Wissen",
    description: "Multiple-Choice-Fragen im IMPP-Stil (Zweiter Abschnitt der Ärztlichen Prüfung) — vollautomatisch evaluiert.",
    metrics: ["Accuracy"],
    input: "Klinische Vignette + Multiple-Choice-Frage (A–E)",
    output: "Antwortbuchstabe + Begründung",
    prompt: `Du bist ein erfahrener deutscher Facharzt und beantwortest eine medizinische Prüfungsfrage.

Lies die folgende Frage und die Antwortmöglichkeiten sorgfältig. Wähle die beste Antwort.

Antworte ausschließlich im folgenden JSON-Format:
{
  "answer": "B",
  "reasoning": "Kurze Begründung in 1-2 Sätzen"
}

Frage:
{question}

Antwortmöglichkeiten:
A) ...
B) ...
C) ...
D) ...
E) ...`,
  },
  patient_text: {
    name: "Patientenverständliche Erklärung",
    description: "Komplexe medizinische Befunde für Patienten verständlich erklären — bewertet durch LLM-as-Judge.",
    metrics: ["Verständlichkeit", "Med. Korrektheit", "Vollständigkeit", "Overall"],
    input: "Medizinischer Fachtext (Befund, Laborbericht, OP-Bericht)",
    output: "Patientenverständliche Erklärung in Laiensprache",
    prompt: `Du bist ein erfahrener Arzt, der medizinische Befunde für Patienten verständlich erklärt.

Lies den folgenden medizinischen Text und erkläre ihn so, dass ein Patient ohne medizinische Vorkenntnisse alles versteht.

Regeln:
- Erkläre jeden Fachbegriff in einfacher Sprache
- Behalte alle wichtigen Informationen bei (Befunde, Diagnosen, Empfehlungen)
- Verwende einen freundlichen, sachlichen Ton
- Ordne Messwerte und Befunde verständlich ein (Was ist normal? Was weicht ab?)
- Der Patient soll verstehen: Was wurde gefunden? Was bedeutet das? Was passiert als nächstes?

Antworte ausschließlich mit der Patienten-Erklärung als Fließtext (kein JSON, kein Markdown). Beginne direkt mit der Erklärung.

Medizinischer Text:
{text}`,
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ task: string }>;
}): Promise<Metadata> {
  const { task } = await params;
  const meta = TASK_META[task];
  if (!meta) return {};
  return {
    title: meta.name,
    description: meta.description,
    alternates: { canonical: `/benchmarks/${task}` },
  };
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ task: string }>;
}) {
  const { task } = await params;
  const meta = TASK_META[task];
  if (!meta) notFound();

  const cases = getBenchmarkCases(task);
  const leaderboard = getLeaderboard(task);
  const taskConfig = TASK_CONFIG[task as TaskId];
  const isPercent = taskConfig && !["overall_score"].includes(taskConfig.primaryMetric);

  return (
    <div>
      <div className="mb-1">
        <Link
          href="/benchmarks"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Benchmarks
        </Link>
      </div>

      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">{meta.name}</h1>
      </div>

      <div className="mb-8 space-y-2 text-sm text-muted-foreground sm:flex sm:flex-wrap sm:gap-4 sm:space-y-0">
        <div>
          <span className="font-medium text-foreground">Input:</span>{" "}
          {meta.input}
        </div>
        <div>
          <span className="font-medium text-foreground">Output:</span>{" "}
          {meta.output}
        </div>
        <div className="min-w-0">
          <span className="font-medium text-foreground">Metriken:</span>{" "}
          <span className="text-muted-foreground">{meta.metrics.join(" · ")}</span>
        </div>
      </div>

      {/* Prompt */}
      <details className="mb-8 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Verwendeter Prompt anzeigen
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/50 p-4 text-xs leading-relaxed whitespace-pre-wrap">
          {meta.prompt}
        </pre>
      </details>

      {/* Per-task leaderboard */}
      {leaderboard.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Leaderboard
          </h2>
          <Card>
            <CardContent className="overflow-x-auto py-0">
              <table className="w-full min-w-[360px]">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2.5 text-left font-medium w-8">#</th>
                    <th className="py-2.5 text-left font-medium">Modell</th>
                    <th className="py-2.5 text-right font-medium">
                      {taskConfig?.primaryMetricLabel ?? "Score"}
                    </th>
                    <th className="py-2.5 text-right font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 3).map((entry, i) => {
                    const primaryValue = (entry[taskConfig?.primaryMetric ?? ""] as number) ?? 0;
                    const errors = entry.n_parse_errors + entry.n_api_errors;
                    return (
                      <tr key={entry.model} className="border-b last:border-0">
                        <td className="py-2.5 text-sm text-muted-foreground">{i + 1}</td>
                        <td className="py-2.5">
                          <Link
                            href={`/model/${encodeURIComponent(entry.model)}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {entry.shortName}
                          </Link>
                          <span className="ml-2 text-xs text-muted-foreground">{entry.provider}</span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-sm">
                          {isPercent
                            ? `${(primaryValue * 100).toFixed(1)}%`
                            : primaryValue.toFixed(2)
                          }
                        </td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground">
                          {errors > 0 ? (
                            <span className="text-destructive">{errors}</span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {leaderboard.length > 3 && (
                <details className="border-t">
                  <summary className="cursor-pointer py-2.5 text-center text-xs text-muted-foreground hover:text-foreground">
                    {leaderboard.length - 3} weitere Modelle anzeigen
                  </summary>
                  <table className="w-full">
                    <tbody>
                      {leaderboard.slice(3).map((entry, i) => {
                        const primaryValue = (entry[taskConfig?.primaryMetric ?? ""] as number) ?? 0;
                        const errors = entry.n_parse_errors + entry.n_api_errors;
                        return (
                          <tr key={entry.model} className="border-b last:border-0">
                            <td className="py-2.5 text-sm text-muted-foreground w-8">{i + 4}</td>
                            <td className="py-2.5">
                              <Link
                                href={`/model/${encodeURIComponent(entry.model)}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {entry.shortName}
                              </Link>
                              <span className="ml-2 text-xs text-muted-foreground">{entry.provider}</span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-sm">
                              {isPercent
                                ? `${(primaryValue * 100).toFixed(1)}%`
                                : primaryValue.toFixed(2)
                              }
                            </td>
                            <td className="py-2.5 text-right text-xs text-muted-foreground">
                              {errors > 0 ? (
                                <span className="text-destructive">{errors}</span>
                              ) : (
                                "0"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Fälle vorhanden.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" >
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/benchmarks/${task}/${c.id}`}
              className="min-w-0"
            >
              <Card className="h-full min-w-0 transition-colors hover:border-foreground/20 hover:bg-muted/50">
                <CardHeader className="min-w-0 space-y-1 pb-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <CardTitle className="min-w-0 flex-1 truncate font-mono text-sm">
                      {c.id}
                    </CardTitle>
                    <span
                      className="max-w-[min(100%,12rem)] shrink-0 truncate text-right text-xs text-muted-foreground"
                      title={c.fachbereich}
                    >
                      {c.fachbereich}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="min-w-0">
                  <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {"question" in c ? c.question : c.text}
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
                    {"diagnosen" in c &&
                      c.diagnosen.map((d) => (
                        <span
                          key={d.code}
                          title={d.code}
                          className={
                            d.typ === "Hauptdiagnose"
                              ? "max-w-full truncate rounded-md bg-foreground/8 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                              : "max-w-full truncate rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[11px]"
                          }
                        >
                          {d.code}
                        </span>
                      ))}
                    {"gold_summary" in c && (
                      <span className="max-w-full truncate" title={c.komplexitaet}>
                        {c.komplexitaet}
                      </span>
                    )}
                    {"gold_diagnoses" in c && (
                      <>
                        <span
                          className="max-w-full shrink-0 truncate"
                          title={c.schwierigkeitsgrad}
                        >
                          {c.schwierigkeitsgrad}
                        </span>
                        <span
                          className="min-w-0 max-w-full basis-full wrap-break-word text-foreground/90 sm:basis-auto"
                          title={c.correct_diagnosis}
                        >
                          {c.correct_diagnosis}
                        </span>
                      </>
                    )}
                    {"medications" in c && (
                      <span className="tabular-nums">
                        {c.medications.length} Medikamente
                      </span>
                    )}
                    {"correct_answer" in c && "options" in c && (
                      <>
                        <span className="max-w-full truncate" title={c.schwierigkeitsgrad}>
                          {c.schwierigkeitsgrad}
                        </span>
                        <span className="font-mono text-foreground/90">
                          Antwort: {c.correct_answer}
                        </span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
