import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModelRun, getBenchmarkCases, getICD10Catalog } from "@/lib/data";
import { getModelMeta, TASK_CONFIG } from "@/lib/types";
import type { TaskId, SummarizationPrediction, ClinicalReasoningPrediction, MedExtractionPrediction, MedQAPrediction, PatientTextPrediction } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@thalamiq/ui/components/card";
import { Badge } from "@thalamiq/ui/components/badge";

export const dynamic = "force-dynamic";

const ALL_TASKS: TaskId[] = ["icd10_coding", "summarization", "clinical_reasoning", "med_extraction", "med_qa", "patient_text"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const modelId = decodeURIComponent(id);
  const meta = getModelMeta(modelId);
  return {
    title: `${meta.shortName} (${meta.size})`,
    description: `${meta.shortName} von ${meta.provider} im GerMedBench. Detaillierte Ergebnisse pro Fall.`,
    alternates: { canonical: `/model/${encodeURIComponent(modelId)}` },
  };
}

function formatPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function Stat({ label, value, destructive }: { label: string; value: string; destructive?: boolean }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-mono text-lg font-semibold ${destructive ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const modelId = decodeURIComponent(id);
  const meta = getModelMeta(modelId);

  const runs = ALL_TASKS.map((task) => ({
    task,
    run: getModelRun(modelId, task),
    cases: getBenchmarkCases(task),
  })).filter((r) => r.run !== null);

  if (runs.length === 0) notFound();

  const catalog = getICD10Catalog();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Leaderboard
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2 sm:gap-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {meta.shortName}
        </h1>
        <Badge variant="outline">{meta.provider}</Badge>
        <Badge variant="secondary" className="text-xs uppercase">
          {meta.size}
        </Badge>
      </div>

      {runs.map(({ task, run, cases }) => {
        if (!run) return null;
        const { summary } = run;
        const caseMap = new Map(cases.map((c) => [c.id, c]));
        const taskConfig = TASK_CONFIG[task];
        const errorCount = summary.n_parse_errors + summary.n_api_errors;

        return (
          <div key={task} className="mb-12">
            <h2 className="mb-4 text-lg font-semibold">
              <Link href={`/benchmarks/${task}`} className="hover:underline">
                {taskConfig.name}
              </Link>
            </h2>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              {task === "icd10_coding" && "exact_match_f1" in summary && (
                <>
                  <Stat label="Exact F1" value={formatPct(summary.exact_match_f1)} />
                  <Stat label="Category F1" value={formatPct(summary.category_match_f1)} />
                  <Stat label="HD Accuracy" value={formatPct(summary.hauptdiagnose_accuracy)} />
                  <Stat label="Precision" value={formatPct(summary.exact_match_precision)} />
                  <Stat label="Recall" value={formatPct(summary.exact_match_recall)} />
                </>
              )}
              {summary.task === "summarization" && (
                <>
                  <Stat label="Overall" value={`${summary.overall_score.toFixed(1)}/5`} />
                  <Stat label="Faktentreue" value={`${summary.faktentreue.toFixed(1)}`} />
                  <Stat label="Vollständigkeit" value={`${summary.vollstaendigkeit.toFixed(1)}`} />
                  <Stat label="Klin. Präzision" value={`${summary.klinische_praezision.toFixed(1)}`} />
                </>
              )}
              {summary.task === "clinical_reasoning" && (
                <>
                  <Stat label="Overall" value={`${summary.overall_score.toFixed(1)}/5`} />
                  <Stat label="Top-1 Acc" value={formatPct(summary.top1_accuracy)} />
                  <Stat label="Top-3 Recall" value={formatPct(summary.top3_recall)} />
                  <Stat label="DDx F1" value={formatPct(summary.ddx_overlap_f1)} />
                  <Stat label="Reasoning" value={`${summary.reasoning_quality.toFixed(1)}`} />
                  <Stat label="Plausibilität" value={`${summary.ddx_plausibility.toFixed(1)}`} />
                  <Stat label="Red Flags" value={`${summary.red_flag_awareness.toFixed(1)}`} />
                </>
              )}
              {summary.task === "med_extraction" && (
                <>
                  <Stat label="Exact F1" value={formatPct(summary.exact_f1)} />
                  <Stat label="Partial F1" value={formatPct(summary.partial_f1)} />
                  <Stat label="Wirkstoff F1" value={formatPct(summary.wirkstoff_f1)} />
                  <Stat label="Precision" value={formatPct(summary.wirkstoff_precision)} />
                  <Stat label="Recall" value={formatPct(summary.wirkstoff_recall)} />
                </>
              )}
              {summary.task === "med_qa" && (
                <>
                  <Stat label="Accuracy" value={formatPct(summary.accuracy)} />
                  <Stat label="Richtig" value={`${summary.n_correct}/${summary.n_scored}`} />
                </>
              )}
              {summary.task === "patient_text" && (
                <>
                  <Stat label="Overall" value={`${summary.overall_score.toFixed(1)}/5`} />
                  <Stat label="Verständl." value={`${summary.verstaendlichkeit.toFixed(1)}`} />
                  <Stat label="Korrektheit" value={`${summary.medizinische_korrektheit.toFixed(1)}`} />
                  <Stat label="Vollständigkeit" value={`${summary.vollstaendigkeit.toFixed(1)}`} />
                </>
              )}
              {errorCount > 0 && (
                <Stat label="Errors" value={`${errorCount}`} destructive />
              )}
            </div>

            {/* Per-case results */}
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ergebnisse pro Fall
              </h3>
              <div className="space-y-3">
                {run.predictions.map((pred) => {
                  const goldCase = caseMap.get(pred.case_id);

                  if (task === "icd10_coding") {
                    return (
                      <ICD10CaseResult
                        key={pred.case_id}
                        task={task}
                        prediction={pred}
                        goldCase={goldCase}
                        catalog={catalog}
                      />
                    );
                  }

                  if (task === "clinical_reasoning") {
                    return (
                      <ClinicalReasoningCaseResult
                        key={pred.case_id}
                        task={task}
                        prediction={pred as ClinicalReasoningPrediction}
                        goldCase={goldCase}
                      />
                    );
                  }

                  if (task === "med_extraction") {
                    return (
                      <MedExtractionCaseResult
                        key={pred.case_id}
                        task={task}
                        prediction={pred as MedExtractionPrediction}
                        goldCase={goldCase}
                      />
                    );
                  }

                  if (task === "patient_text") {
                    return (
                      <PatientTextCaseResult
                        key={pred.case_id}
                        task={task}
                        prediction={pred as PatientTextPrediction}
                        goldCase={goldCase}
                      />
                    );
                  }

                  if (task === "med_qa") {
                    return (
                      <MedQACaseResult
                        key={pred.case_id}
                        task={task}
                        prediction={pred as MedQAPrediction}
                        goldCase={goldCase}
                      />
                    );
                  }

                  return (
                    <SummarizationCaseResult
                      key={pred.case_id}
                      task={task}
                      prediction={pred as SummarizationPrediction}
                      goldCase={goldCase}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ICD-10
// ---------------------------------------------------------------------------

function ICD10CaseResult({
  task,
  prediction,
  goldCase,
  catalog,
}: {
  task: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prediction: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goldCase: any;
  catalog: Record<string, { display: string; terminal: boolean }>;
}) {
  const hasError = prediction.error || prediction.parse_error;
  const goldCodes = new Set<string>(goldCase?.diagnosen?.map((d: { code: string }) => d.code) ?? []);
  const predCodes = new Set<string>((prediction.codes ?? []) as string[]);
  const goldHd = goldCase?.diagnosen?.find((d: { typ: string }) => d.typ === "Hauptdiagnose");

  const tp = [...predCodes].filter((c) => goldCodes.has(c));
  const fp = [...predCodes].filter((c) => !goldCodes.has(c));
  const fn = [...goldCodes].filter((c) => !predCodes.has(c));
  const perfect = !hasError && fp.length === 0 && fn.length === 0;
  const hdCorrect = goldHd && prediction.hauptdiagnose === goldHd.code;

  return (
    <Card className={perfect ? "border-green-500/30" : ""}>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/benchmarks/${task}/${prediction.case_id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {prediction.case_id}
            </Link>
            <span className="text-xs text-muted-foreground">{goldCase?.fachbereich}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasError ? (
              <Badge variant="destructive" className="text-xs">
                {prediction.parse_error ? "Parse Error" : "API Error"}
              </Badge>
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
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Ground Truth</p>
              <div className="space-y-1.5">
                {goldCase?.diagnosen?.map((d: { code: string; display: string; typ: string }) => (
                  <div key={d.code} className="flex items-center gap-2 text-xs">
                    <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono">{d.code}</code>
                    <span className="text-muted-foreground">{d.display}</span>
                    {d.typ === "Hauptdiagnose" && <Badge variant="default" className="ml-auto shrink-0 text-[10px]">HD</Badge>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Prediction</p>
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Summarization
// ---------------------------------------------------------------------------

function SummarizationCaseResult({
  task,
  prediction,
  goldCase,
}: {
  task: string;
  prediction: SummarizationPrediction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goldCase: any;
}) {
  const hasError = prediction.error || prediction.parse_error;
  const scores = prediction.judge_scores;

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/benchmarks/${task}/${prediction.case_id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {prediction.case_id}
            </Link>
            <span className="text-xs text-muted-foreground">{goldCase?.fachbereich}</span>
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
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="space-y-3">
            {scores && (
              <div className="flex gap-4 rounded-md bg-muted/50 px-3 py-2">
                {([
                  ["Fakten", scores.faktentreue],
                  ["Vollst.", scores.vollstaendigkeit],
                  ["Präzision", scores.klinische_praezision],
                ] as const).map(([label, val]) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-sm font-semibold">{val}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {prediction.summary && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Prediction</p>
                  <div className="space-y-1.5 text-xs">
                    <p><span className="font-medium text-foreground">HD:</span> <span className="text-muted-foreground">{prediction.summary.hauptdiagnose}</span></p>
                    <p><span className="font-medium text-foreground">Therapie:</span> <span className="text-muted-foreground">{prediction.summary.therapie}</span></p>
                    <p><span className="font-medium text-foreground">Procedere:</span> <span className="text-muted-foreground">{prediction.summary.procedere}</span></p>
                  </div>
                </div>
                {goldCase?.gold_summary && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Gold</p>
                    <div className="space-y-1.5 text-xs">
                      <p><span className="font-medium text-foreground">HD:</span> <span className="text-muted-foreground">{goldCase.gold_summary.hauptdiagnose}</span></p>
                      <p><span className="font-medium text-foreground">Therapie:</span> <span className="text-muted-foreground">{goldCase.gold_summary.therapie}</span></p>
                      <p><span className="font-medium text-foreground">Procedere:</span> <span className="text-muted-foreground">{goldCase.gold_summary.procedere}</span></p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Clinical Reasoning
// ---------------------------------------------------------------------------

function ClinicalReasoningCaseResult({
  task,
  prediction,
  goldCase,
}: {
  task: string;
  prediction: ClinicalReasoningPrediction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goldCase: any;
}) {
  const hasError = prediction.error || prediction.parse_error;
  const jScores = prediction.judge_scores;
  const aScores = prediction.automated_scores;

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/benchmarks/${task}/${prediction.case_id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {prediction.case_id}
            </Link>
            <span className="text-xs text-muted-foreground">{goldCase?.fachbereich}</span>
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
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="space-y-3">
            {(aScores || jScores) && (
              <div className="flex gap-4 rounded-md bg-muted/50 px-3 py-2">
                {aScores && (
                  <>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-sm font-semibold">{aScores.ddx_overlap_f1.toFixed(2)}</span>
                      <span className="text-[10px] text-muted-foreground">DDx F1</span>
                    </div>
                  </>
                )}
                {jScores && ([
                  ["Reason.", jScores.reasoning_quality],
                  ["Plausi.", jScores.ddx_plausibility],
                  ["Red Fl.", jScores.red_flag_awareness],
                ] as const).map(([label, val]) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-sm font-semibold">{val}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {prediction.differentialdiagnosen && (
              <div className="space-y-2">
                {prediction.differentialdiagnosen.slice(0, 3).map((d, i) => (
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

// ---------------------------------------------------------------------------
// Med Extraction
// ---------------------------------------------------------------------------

function MedExtractionCaseResult({
  task,
  prediction,
  goldCase,
}: {
  task: string;
  prediction: MedExtractionPrediction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goldCase: any;
}) {
  const hasError = prediction.error || prediction.parse_error;
  const predCount = prediction.medications?.length ?? 0;
  const goldCount = goldCase?.medications?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/benchmarks/${task}/${prediction.case_id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {prediction.case_id}
            </Link>
            <span className="text-xs text-muted-foreground">{goldCase?.fachbereich}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {predCount}/{goldCount} Medikamente
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {hasError ? (
          <p className="text-xs text-muted-foreground">
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="space-y-1.5">
            {prediction.medications?.slice(0, 5).map((m, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-foreground">{m.wirkstoff}</span>
                {m.dosis && (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{m.dosis}</span>
                )}
                {m.frequenz && (
                  <span className="text-muted-foreground">{m.frequenz}</span>
                )}
              </div>
            ))}
            {predCount > 5 && (
              <p className="text-xs text-muted-foreground">+{predCount - 5} weitere</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Patient Text
// ---------------------------------------------------------------------------

function PatientTextCaseResult({
  task,
  prediction,
  goldCase,
}: {
  task: string;
  prediction: PatientTextPrediction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goldCase: any;
}) {
  const hasError = prediction.error || prediction.parse_error;
  const scores = prediction.judge_scores;

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/benchmarks/${task}/${prediction.case_id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {prediction.case_id}
            </Link>
            <span className="text-xs text-muted-foreground">{goldCase?.fachbereich}</span>
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
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="space-y-3">
            {scores && (
              <div className="flex gap-4 rounded-md bg-muted/50 px-3 py-2">
                {([
                  ["Verständl.", scores.verstaendlichkeit],
                  ["Korrekt.", scores.medizinische_korrektheit],
                  ["Vollst.", scores.vollstaendigkeit],
                ] as const).map(([label, val]) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-sm font-semibold">{val}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {prediction.explanation && (
              <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                {prediction.explanation}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Med QA
// ---------------------------------------------------------------------------

function MedQACaseResult({
  task,
  prediction,
  goldCase,
}: {
  task: string;
  prediction: MedQAPrediction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goldCase: any;
}) {
  const hasError = prediction.error || prediction.parse_error;
  const goldAnswer = goldCase?.correct_answer ?? "";
  const isCorrect = !hasError && prediction.answer === goldAnswer;

  return (
    <Card className={isCorrect ? "border-green-500/30" : ""}>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/benchmarks/${task}/${prediction.case_id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {prediction.case_id}
            </Link>
            <span className="text-xs text-muted-foreground">{goldCase?.fachbereich}</span>
          </div>
          {hasError ? (
            <Badge variant="destructive" className="text-xs">
              {prediction.parse_error ? "Parse Error" : "API Error"}
            </Badge>
          ) : (
            <Badge variant={isCorrect ? "default" : "secondary"} className="font-mono text-xs">
              {prediction.answer ?? "?"} {isCorrect ? "✓" : "✗"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {hasError ? (
          <p className="text-xs text-muted-foreground">
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : prediction.reasoning ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{prediction.reasoning}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
