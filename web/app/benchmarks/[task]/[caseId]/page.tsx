import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBenchmarkCases,
  getLeaderboard,
  getModelRun,
  getICD10Catalog,
} from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@thalamiq/ui/components/card";
import { Badge } from "@thalamiq/ui/components/badge";
import { Separator } from "@thalamiq/ui/components/separator";
import { getModelMeta } from "@/lib/types";
import type { SummarizationPrediction, ClinicalReasoningPrediction, MedExtractionPrediction, MedQAPrediction, PatientTextPrediction } from "@/lib/types";

export const dynamic = "force-dynamic";

const TASK_NAMES: Record<string, string> = {
  icd10_coding: "ICD-10-GM Kodierung",
  summarization: "Arztbrief-Zusammenfassung",
  clinical_reasoning: "Klinisches Reasoning",
  med_extraction: "Medikamentenextraktion",
  med_qa: "Medizinisches Wissen",
  patient_text: "Patientenverständliche Erklärung",
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

// ---------------------------------------------------------------------------
// Score pill helper
// ---------------------------------------------------------------------------

function ScorePill({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`font-mono text-sm font-semibold ${muted ? "text-muted-foreground" : ""}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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
  const isMed = task === "med_extraction";
  const isQA = task === "med_qa";
  const isPT = task === "patient_text";

  const goldCodes = isICD10 && "diagnosen" in caseData
    ? new Set(caseData.diagnosen.map((d) => d.code))
    : new Set<string>();
  const catalog = isICD10 ? getICD10Catalog() : {};

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-1 flex gap-1 text-sm text-muted-foreground">
        <Link href="/benchmarks" className="hover:text-foreground transition-colors">
          Benchmarks
        </Link>
        <span>/</span>
        <Link href={`/benchmarks/${task}`} className="hover:text-foreground transition-colors">
          {taskName}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
        <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
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

      {/* Clinical text / Question */}
      <Card className="mb-8">
        <CardContent className="py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            {isQA ? "Frage" : "Klinischer Text"}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {"question" in caseData ? caseData.question : caseData.text}
          </p>
          {isQA && "options" in caseData && (
            <div className="mt-4 space-y-1.5">
              {(["A", "B", "C", "D", "E"] as const).map((letter) => (
                <div
                  key={letter}
                  className={`flex gap-2 rounded-md px-2 py-1.5 text-sm ${
                    letter === caseData.correct_answer
                      ? "bg-green-500/10 text-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="shrink-0 font-mono font-semibold">{letter})</span>
                  <span>{caseData.options[letter]}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ground truth */}
      <div className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Ground Truth
        </h2>

        <Card>
          <CardContent className="py-4">
            {isICD10 && "diagnosen" in caseData && (
              <div className="space-y-2">
                {caseData.diagnosen.map((d) => (
                  <div key={d.code} className="flex items-center gap-3 text-sm">
                    <code className="w-16 shrink-0 rounded bg-muted px-1.5 py-0.5 text-center font-mono text-xs">
                      {d.code}
                    </code>
                    <span className="flex-1 text-muted-foreground">{d.display}</span>
                    {d.typ === "Hauptdiagnose" && (
                      <Badge variant="default" className="shrink-0 text-xs">HD</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isSumm && "gold_summary" in caseData && (
              <div className="space-y-4">
                {([
                  ["Hauptdiagnose", caseData.gold_summary.hauptdiagnose],
                  ["Therapie", caseData.gold_summary.therapie],
                  ["Procedere", caseData.gold_summary.procedere],
                  ["Offene Fragen", caseData.gold_summary.offene_fragen],
                ] as const).map(([label, text]) => (
                  <div key={label}>
                    <p className="mb-1 text-xs font-medium text-foreground">{label}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            )}

            {isCR && "gold_diagnoses" in caseData && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">Bestätigte Diagnose:</span>
                  <Badge variant="default" className="text-xs">{caseData.correct_diagnosis}</Badge>
                </div>
                <Separator />
                <div className="space-y-3">
                  {caseData.gold_diagnoses.map((d, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{d.name}</span>
                          {d.icd10_code && (
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{d.icd10_code}</code>
                          )}
                          <Badge variant="secondary" className="text-xs">{d.likelihood}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {d.key_findings.join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isQA && "correct_answer" in caseData && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">Richtige Antwort:</span>
                  <Badge variant="default" className="font-mono text-xs">{caseData.correct_answer}</Badge>
                </div>
                {"explanation" in caseData && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {caseData.explanation}
                  </p>
                )}
              </div>
            )}

            {isPT && "gold_explanation" in caseData && (
              <div>
                <p className="mb-2 text-xs font-medium text-foreground">Referenz-Erklärung</p>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {caseData.gold_explanation}
                </p>
              </div>
            )}

            {isMed && "medications" in caseData && (
              <div className="space-y-2">
                {caseData.medications.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{m.wirkstoff}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{m.dosis}</span>
                    <span className="text-xs text-muted-foreground">{m.frequenz}</span>
                    {m.darreichungsform && (
                      <Badge variant="outline" className="text-xs">{m.darreichungsform}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model predictions */}
      {modelPredictions.length > 0 && (
        <div>
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modell-Ergebnisse ({modelPredictions.length})
          </h2>
          <div className="space-y-3">
            {modelPredictions.map(({ model, meta, prediction }) => {
              const hasError = prediction.error || prediction.parse_error;

              // ICD-10
              if (isICD10) {
                const predCodes = new Set((prediction.codes ?? []) as string[]);
                const tp = [...predCodes].filter((c) => goldCodes.has(c));
                const fp = [...predCodes].filter((c) => !goldCodes.has(c));
                const fn = [...goldCodes].filter((c) => !predCodes.has(c));
                const perfect = !hasError && fp.length === 0 && fn.length === 0;
                const goldHd = ("diagnosen" in caseData) ? caseData.diagnosen.find((d) => d.typ === "Hauptdiagnose") : undefined;
                const hdCorrect = goldHd && prediction.hauptdiagnose === goldHd.code;

                return (
                  <Card key={model} className={perfect ? "border-green-500/30" : ""}>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link href={`/model/${encodeURIComponent(model)}`} className="text-sm font-medium hover:underline">
                            {meta.shortName}
                          </Link>
                          <span className="text-xs text-muted-foreground">{meta.provider}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasError ? (
                            <Badge variant="destructive" className="text-xs">Fehler</Badge>
                          ) : (
                            <>
                              {goldHd && (
                                <span className={`text-xs font-medium ${hdCorrect ? "text-green-600" : "text-destructive"}`}>
                                  HD {hdCorrect ? "✓" : "✗"}
                                </span>
                              )}
                              <Badge variant={perfect ? "default" : "secondary"} className="text-xs">
                                {tp.length}/{goldCodes.size}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {hasError ? (
                        <p className="text-xs text-muted-foreground">
                          {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {tp.map((c) => (
                            <div key={c} className="flex items-center gap-2 text-xs">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-600 text-[10px]">✓</span>
                              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{c}</code>
                              {catalog[c] && <span className="text-muted-foreground">{catalog[c].display}</span>}
                            </div>
                          ))}
                          {fp.map((c) => (
                            <div key={c} className="flex items-center gap-2 text-xs">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive text-[10px]">+</span>
                              <code className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-destructive">{c}</code>
                              <span className="text-muted-foreground">{catalog[c] ? catalog[c].display : "ungültiger Code"}</span>
                            </div>
                          ))}
                          {fn.map((c) => (
                            <div key={c} className="flex items-center gap-2 text-xs">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px]">✗</span>
                              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground line-through">{c}</code>
                              <span className="text-muted-foreground">nicht erkannt</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }

              // Summarization
              if (isSumm) {
                const pred = prediction as SummarizationPrediction;
                const scores = pred.judge_scores;

                return (
                  <Card key={model}>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link href={`/model/${encodeURIComponent(model)}`} className="text-sm font-medium hover:underline">
                            {meta.shortName}
                          </Link>
                          <span className="text-xs text-muted-foreground">{meta.provider}</span>
                        </div>
                        {scores && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {scores.overall.toFixed(1)}/5
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {hasError ? (
                        <p className="text-xs text-muted-foreground">
                          {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {scores && (
                            <div className="flex gap-4 rounded-md bg-muted/50 px-3 py-2">
                              <ScorePill label="Fakten" value={scores.faktentreue} />
                              <ScorePill label="Vollst." value={scores.vollstaendigkeit} />
                              <ScorePill label="Präzision" value={scores.klinische_praezision} />
                            </div>
                          )}
                          {pred.summary && (
                            <div className="space-y-2 text-xs">
                              <div>
                                <span className="font-medium text-foreground">Hauptdiagnose: </span>
                                <span className="text-muted-foreground">{pred.summary.hauptdiagnose}</span>
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Therapie: </span>
                                <span className="text-muted-foreground">{pred.summary.therapie}</span>
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Procedere: </span>
                                <span className="text-muted-foreground">{pred.summary.procedere}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }

              // Clinical Reasoning
              if (isCR) {
                const pred = prediction as ClinicalReasoningPrediction;
                const jScores = pred.judge_scores;
                const aScores = pred.automated_scores;

                return (
                  <Card key={model}>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link href={`/model/${encodeURIComponent(model)}`} className="text-sm font-medium hover:underline">
                            {meta.shortName}
                          </Link>
                          <span className="text-xs text-muted-foreground">{meta.provider}</span>
                        </div>
                        {aScores && (
                          <Badge variant={aScores.top1_accuracy ? "default" : "secondary"} className="text-xs">
                            Top-1 {aScores.top1_accuracy ? "✓" : "✗"}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {hasError ? (
                        <p className="text-xs text-muted-foreground">
                          {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {(aScores || jScores) && (
                            <div className="flex gap-4 rounded-md bg-muted/50 px-3 py-2">
                              {aScores && (
                                <>
                                  <ScorePill label="Top-3" value={aScores.top3_recall ? "✓" : "✗"} muted={!aScores.top3_recall} />
                                  <ScorePill label="DDx F1" value={aScores.ddx_overlap_f1.toFixed(2)} />
                                </>
                              )}
                              {jScores && (
                                <>
                                  <ScorePill label="Reasoning" value={jScores.reasoning_quality} />
                                  <ScorePill label="Plausib." value={jScores.ddx_plausibility} />
                                  <ScorePill label="Red Flags" value={jScores.red_flag_awareness} />
                                </>
                              )}
                            </div>
                          )}
                          {pred.differentialdiagnosen && (
                            <div className="space-y-2">
                              {pred.differentialdiagnosen.map((d, i) => (
                                <div key={i} className="flex gap-2 text-xs">
                                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                                    {i + 1}
                                  </span>
                                  <div className="flex-1">
                                    <span className="font-medium text-foreground">{d.name}</span>
                                    <p className="mt-0.5 leading-relaxed text-muted-foreground">{d.reasoning}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }

              // Medical QA
              if (isQA) {
                const pred = prediction as MedQAPrediction;
                const goldAnswer = "correct_answer" in caseData ? caseData.correct_answer : "";
                const isCorrect = !hasError && pred.answer === goldAnswer;

                return (
                  <Card key={model} className={isCorrect ? "border-green-500/30" : ""}>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link href={`/model/${encodeURIComponent(model)}`} className="text-sm font-medium hover:underline">
                            {meta.shortName}
                          </Link>
                          <span className="text-xs text-muted-foreground">{meta.provider}</span>
                        </div>
                        {hasError ? (
                          <Badge variant="destructive" className="text-xs">Fehler</Badge>
                        ) : (
                          <Badge variant={isCorrect ? "default" : "secondary"} className="font-mono text-xs">
                            {pred.answer ?? "?"} {isCorrect ? "✓" : "✗"}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {hasError ? (
                        <p className="text-xs text-muted-foreground">
                          {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                        </p>
                      ) : pred.reasoning ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">{pred.reasoning}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              }

              // Patient Text
              if (isPT) {
                const pred = prediction as PatientTextPrediction;
                const scores = pred.judge_scores;

                return (
                  <Card key={model}>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link href={`/model/${encodeURIComponent(model)}`} className="text-sm font-medium hover:underline">
                            {meta.shortName}
                          </Link>
                          <span className="text-xs text-muted-foreground">{meta.provider}</span>
                        </div>
                        {scores && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {scores.overall.toFixed(1)}/5
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {hasError ? (
                        <p className="text-xs text-muted-foreground">
                          {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {scores && (
                            <div className="flex gap-4 rounded-md bg-muted/50 px-3 py-2">
                              <ScorePill label="Verständl." value={scores.verstaendlichkeit} />
                              <ScorePill label="Korrektheit" value={scores.medizinische_korrektheit} />
                              <ScorePill label="Vollst." value={scores.vollstaendigkeit} />
                            </div>
                          )}
                          {pred.explanation && (
                            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                              {pred.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }

              // Med Extraction
              if (isMed) {
                const pred = prediction as MedExtractionPrediction;
                const medCount = pred.medications?.length ?? 0;
                const goldCount = ("medications" in caseData) ? caseData.medications.length : 0;

                return (
                  <Card key={model}>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link href={`/model/${encodeURIComponent(model)}`} className="text-sm font-medium hover:underline">
                            {meta.shortName}
                          </Link>
                          <span className="text-xs text-muted-foreground">{meta.provider}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {medCount}/{goldCount} Medikamente
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      {hasError ? (
                        <p className="text-xs text-muted-foreground">
                          {pred.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {pred.medications?.map((m, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-medium text-foreground">{m.wirkstoff}</span>
                              {m.dosis && (
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{m.dosis}</span>
                              )}
                              {m.frequenz && (
                                <span className="text-muted-foreground">{m.frequenz}</span>
                              )}
                              {m.darreichungsform && (
                                <Badge variant="outline" className="text-xs">{m.darreichungsform}</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
