import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBenchmarkCases,
  getLeaderboard,
  getModelRun,
  getICD10Catalog,
} from "@/lib/data";
import { Card, CardContent } from "@thalamiq/ui/components/card";
import { Badge } from "@thalamiq/ui/components/badge";
import { getModelMeta } from "@/lib/types";
import type { SummarizationPrediction, ClinicalReasoningPrediction, NERPrediction, MedExtractionPrediction } from "@/lib/types";

export const dynamic = "force-dynamic";

const TASK_NAMES: Record<string, string> = {
  icd10_coding: "ICD-10-GM Kodierung",
  summarization: "Arztbrief-Zusammenfassung",
  clinical_reasoning: "Klinisches Reasoning",
  ner: "Klinische Entitätsextraktion",
  med_extraction: "Medikamentenextraktion",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ task: string; caseId: string }>;
}): Promise<Metadata> {
  const { task, caseId } = await params;
  const cases = getBenchmarkCases(task);
  const caseData = cases.find((c) => c.id === caseId);
  if (!caseData) return {};
  const taskName = TASK_NAMES[task] ?? task;
  return {
    title: `${caseId} — ${taskName}`,
    description: `Klinischer Fall ${caseId} (${caseData.fachbereich}): Modell-Ergebnisse und Ground Truth für ${taskName}.`,
    alternates: { canonical: `/benchmarks/${task}/${caseId}` },
  };
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ task: string; caseId: string }>;
}) {
  const { task, caseId } = await params;
  const cases = getBenchmarkCases(task);
  const caseData = cases.find((c) => c.id === caseId);
  if (!caseData) notFound();

  const taskName = TASK_NAMES[task] ?? task;

  const leaderboard = getLeaderboard(task);
  const modelPredictions = leaderboard
    .map((entry) => {
      const run = getModelRun(entry.model, task);
      if (!run) return null;
      const pred = run.predictions.find((p) => p.case_id === caseId);
      if (!pred) return null;
      return {
        model: entry.model,
        meta: getModelMeta(entry.model),
        prediction: pred,
      };
    })
    .filter(Boolean) as {
    model: string;
    meta: ReturnType<typeof getModelMeta>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prediction: any;
  }[];

  const isICD10 = task === "icd10_coding";
  const isSumm = task === "summarization";
  const isCR = task === "clinical_reasoning";
  const isNER = task === "ner";
  const isMed = task === "med_extraction";

  const goldCodes = isICD10 && "diagnosen" in caseData
    ? new Set(caseData.diagnosen.map((d) => d.code))
    : new Set<string>();
  const catalog = isICD10 ? getICD10Catalog() : {};

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex gap-1 text-sm text-muted-foreground">
        <Link href="/benchmarks" className="hover:text-foreground">
          Benchmarks
        </Link>
        <span>/</span>
        <Link href={`/benchmarks/${task}`} className="hover:text-foreground">
          {taskName}
        </Link>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {caseData.id}
        </h1>
        <Badge variant="outline">{caseData.fachbereich}</Badge>
        {"komplexitaet" in caseData && (
          <Badge variant="secondary" className="text-xs">
            {caseData.komplexitaet}
          </Badge>
        )}
        {"schwierigkeitsgrad" in caseData && (
          <Badge variant="secondary" className="text-xs">
            {caseData.schwierigkeitsgrad}
          </Badge>
        )}
      </div>

      {/* Clinical text */}
      <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
        {caseData.text}
      </p>

      {/* Ground truth */}
      <div className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Ground Truth
        </h2>

        {isICD10 && "diagnosen" in caseData && (
          <div className="space-y-1.5">
            {caseData.diagnosen.map((d) => (
              <div key={d.code} className="flex items-baseline gap-3 text-sm">
                <code className="w-16 shrink-0 font-mono text-xs">{d.code}</code>
                <span className="text-muted-foreground">{d.display}</span>
                {d.typ === "Hauptdiagnose" && (
                  <Badge variant="secondary" className="ml-auto text-xs">HD</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {isSumm && "gold_summary" in caseData && (
          <div className="space-y-3">
            {(["hauptdiagnose", "therapie", "procedere", "offene_fragen"] as const).map((field) => (
              <div key={field}>
                <p className="text-xs font-medium capitalize text-foreground">
                  {field === "offene_fragen" ? "Offene Fragen" : field.charAt(0).toUpperCase() + field.slice(1)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {caseData.gold_summary[field]}
                </p>
              </div>
            ))}
          </div>
        )}

        {isCR && "gold_diagnoses" in caseData && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-foreground">
              Bestätigte Diagnose: {caseData.correct_diagnosis}
            </p>
            {caseData.gold_diagnoses.map((d, i) => (
              <div key={i} className="flex items-baseline gap-3 text-sm">
                <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">#{i + 1}</span>
                <div>
                  <span className="font-medium">{d.name}</span>
                  {d.icd10_code && (
                    <code className="ml-2 text-xs text-muted-foreground">{d.icd10_code}</code>
                  )}
                  <Badge variant="secondary" className="ml-2 text-xs">{d.likelihood}</Badge>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.key_findings.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isNER && "entities" in caseData && (
          <div className="space-y-1.5">
            {(["diagnose", "prozedur", "medikament", "laborwert"] as const).map((typ) => {
              const filtered = caseData.entities.filter((e) => e.typ === typ);
              if (filtered.length === 0) return null;
              return (
                <div key={typ}>
                  <p className="mb-1 text-xs font-medium capitalize text-foreground">{typ}n ({filtered.length})</p>
                  {filtered.map((e, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{e.name}</span>
                      {e.code && <code className="font-mono">{e.code}</code>}
                      {e.wirkstoff && <span>{e.wirkstoff}</span>}
                      {e.dosierung && <span>{e.dosierung}</span>}
                      {e.parameter && <span>{e.parameter}</span>}
                      {e.wert && <span>{e.wert} {e.einheit}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {isMed && "medications" in caseData && (
          <div className="space-y-1.5">
            {caseData.medications.map((m, i) => (
              <div key={i} className="flex items-baseline gap-3 text-sm">
                <span className="font-medium text-foreground">{m.wirkstoff}</span>
                <span className="text-muted-foreground">{m.dosis}</span>
                <span className="text-muted-foreground">{m.frequenz}</span>
                {m.darreichungsform && (
                  <Badge variant="outline" className="text-xs">{m.darreichungsform}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model predictions */}
      {modelPredictions.length > 0 && (
        <div>
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modell-Ergebnisse
          </h2>
          <div className="space-y-3">
            {modelPredictions.map(({ model, meta, prediction }) => {
              const hasError = prediction.error || prediction.parse_error;

              if (isICD10) {
                const predCodes = new Set((prediction.codes ?? []) as string[]);
                const tp = [...predCodes].filter((c) => goldCodes.has(c));
                const fp = [...predCodes].filter((c) => !goldCodes.has(c));
                const fn = [...goldCodes].filter((c) => !predCodes.has(c));
                const perfect = !hasError && fp.length === 0 && fn.length === 0;

                return (
                  <Card key={model} className={perfect ? "border-green-500/20" : ""}>
                    <CardContent className="flex items-start gap-4 py-3">
                      <div className="w-32 shrink-0">
                        <Link
                          href={`/model/${encodeURIComponent(model)}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {meta.shortName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {hasError ? "Fehler" : perfect ? "Perfekt" : `${tp.length}/${goldCodes.size} korrekt`}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        {hasError ? (
                          <p className="text-xs text-destructive">
                            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {tp.map((c) => (
                              <div key={c} className="flex items-center gap-2 text-xs">
                                <span className="text-green-600">&#10003;</span>
                                <code className="font-mono">{c}</code>
                                {catalog[c] && <span className="text-muted-foreground">{catalog[c].display}</span>}
                              </div>
                            ))}
                            {fp.map((c) => (
                              <div key={c} className="flex items-center gap-2 text-xs">
                                <span className="text-destructive">+</span>
                                <code className="font-mono text-destructive">{c}</code>
                                <span className="text-muted-foreground">{catalog[c] ? catalog[c].display : "ungültiger Code"}</span>
                              </div>
                            ))}
                            {fn.map((c) => (
                              <div key={c} className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">&#10007;</span>
                                <code className="font-mono text-muted-foreground line-through">{c}</code>
                                <span className="text-muted-foreground">nicht erkannt</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              if (isMed) {
                const pred = prediction as MedExtractionPrediction;
                const medCount = pred.medications?.length ?? 0;

                return (
                  <Card key={model}>
                    <CardContent className="flex items-start gap-4 py-3">
                      <div className="w-32 shrink-0">
                        <Link
                          href={`/model/${encodeURIComponent(model)}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {meta.shortName}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">
                          {medCount} Medikamente
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        {hasError ? (
                          <p className="text-xs text-destructive">
                            {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                          </p>
                        ) : (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {pred.medications?.slice(0, 5).map((m, i) => (
                              <div key={i} className="flex items-baseline gap-2">
                                <span className="font-medium text-foreground">{m.wirkstoff}</span>
                                <span>{m.dosis}</span>
                                <span>{m.frequenz}</span>
                              </div>
                            ))}
                            {medCount > 5 && <p>+{medCount - 5} weitere</p>}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              if (isNER) {
                const pred = prediction as NERPrediction;
                const entityCount = pred.entities?.length ?? 0;

                return (
                  <Card key={model}>
                    <CardContent className="flex items-start gap-4 py-3">
                      <div className="w-32 shrink-0">
                        <Link
                          href={`/model/${encodeURIComponent(model)}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {meta.shortName}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">
                          {entityCount} Entitäten
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        {hasError ? (
                          <p className="text-xs text-destructive">
                            {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                          </p>
                        ) : (
                          <div className="space-y-1.5 text-xs text-muted-foreground">
                            {pred.entities?.slice(0, 6).map((e, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs shrink-0">{e.typ}</Badge>
                                <span className="font-medium text-foreground">{e.name}</span>
                                {e.code && <code className="font-mono">{e.code}</code>}
                              </div>
                            ))}
                            {(pred.entities?.length ?? 0) > 6 && (
                              <p className="text-muted-foreground">+{(pred.entities?.length ?? 0) - 6} weitere</p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              if (isCR) {
                const pred = prediction as ClinicalReasoningPrediction;
                const jScores = pred.judge_scores;
                const aScores = pred.automated_scores;

                return (
                  <Card key={model}>
                    <CardContent className="flex items-start gap-4 py-3">
                      <div className="w-32 shrink-0">
                        <Link
                          href={`/model/${encodeURIComponent(model)}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {meta.shortName}
                        </Link>
                        {aScores && (
                          <p className="font-mono text-xs text-muted-foreground">
                            Top-1: {aScores.top1_accuracy ? "Yes" : "No"}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {hasError ? (
                          <p className="text-xs text-destructive">
                            {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {(aScores || jScores) && (
                              <div className="flex gap-3">
                                {aScores && ([
                                  ["Top1", aScores.top1_accuracy ? "1" : "0"],
                                  ["Top3", aScores.top3_recall ? "1" : "0"],
                                  ["F1", aScores.ddx_overlap_f1.toFixed(2)],
                                ] as const).map(([label, val]) => (
                                  <div key={label} className="text-center">
                                    <p className="font-mono text-sm font-semibold">{val}</p>
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                  </div>
                                ))}
                                {jScores && ([
                                  ["RQ", jScores.reasoning_quality],
                                  ["DP", jScores.ddx_plausibility],
                                  ["RF", jScores.red_flag_awareness],
                                ] as const).map(([label, val]) => (
                                  <div key={label} className="text-center">
                                    <p className="font-mono text-sm font-semibold">{val}</p>
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {pred.differentialdiagnosen && (
                              <div className="space-y-1.5 text-xs text-muted-foreground">
                                {pred.differentialdiagnosen.map((d, i) => (
                                  <p key={i}>
                                    <span className="font-medium text-foreground">#{i + 1} {d.name}</span>
                                    {" "}{d.reasoning}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              // Summarization
              const pred = prediction as SummarizationPrediction;
              const scores = pred.judge_scores;

              return (
                <Card key={model}>
                  <CardContent className="flex items-start gap-4 py-3">
                    <div className="w-32 shrink-0">
                      <Link
                        href={`/model/${encodeURIComponent(model)}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {meta.shortName}
                      </Link>
                      {scores && (
                        <p className="font-mono text-xs text-muted-foreground">
                          {scores.overall.toFixed(1)}/5
                        </p>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {hasError ? (
                        <p className="text-xs text-destructive">
                          {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {scores && (
                            <div className="flex gap-3">
                              {([
                                ["F", scores.faktentreue],
                                ["V", scores.vollstaendigkeit],
                                ["H", scores.halluzinationsfreiheit],
                                ["K", scores.formatkonformitaet],
                              ] as const).map(([label, val]) => (
                                <div key={label} className="text-center">
                                  <p className="font-mono text-sm font-semibold">{val}</p>
                                  <p className="text-xs text-muted-foreground">{label}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {pred.summary && (
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <p><span className="font-medium text-foreground">HD:</span> {pred.summary.hauptdiagnose}</p>
                              <p><span className="font-medium text-foreground">Therapie:</span> {pred.summary.therapie}</p>
                              <p><span className="font-medium text-foreground">Procedere:</span> {pred.summary.procedere}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
