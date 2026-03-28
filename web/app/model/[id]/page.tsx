import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModelRun, getBenchmarkCases, getICD10Catalog } from "@/lib/data";
import { getModelMeta, TASK_CONFIG } from "@/lib/types";
import type { TaskId, SummarizationPrediction, ClinicalReasoningPrediction, NERPrediction, MedExtractionPrediction } from "@/lib/types";
import { Card, CardContent } from "@thalamiq/ui/components/card";
import { Badge } from "@thalamiq/ui/components/badge";

export const dynamic = "force-dynamic";

const ALL_TASKS: TaskId[] = ["icd10_coding", "summarization", "clinical_reasoning", "ner", "med_extraction"];

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

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const modelId = decodeURIComponent(id);
  const meta = getModelMeta(modelId);

  // Load runs for all tasks
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
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Leaderboard
        </Link>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
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
            <h2 className="mb-4 text-lg font-semibold">{taskConfig.name}</h2>

            {/* Stats */}
            <div className="mb-6 flex flex-wrap gap-6">
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
                  <Stat label="Halluz.freiheit" value={`${summary.halluzinationsfreiheit.toFixed(1)}`} />
                  <Stat label="Format" value={`${summary.formatkonformitaet.toFixed(1)}`} />
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
              {summary.task === "ner" && (
                <>
                  <Stat label="Micro F1" value={formatPct(summary.micro_f1)} />
                  <Stat label="Diagnose" value={formatPct(summary.diagnose_f1)} />
                  <Stat label="Prozedur" value={formatPct(summary.prozedur_f1)} />
                  <Stat label="Medikament" value={formatPct(summary.medikament_f1)} />
                  <Stat label="Laborwert" value={formatPct(summary.laborwert_f1)} />
                  <Stat label="Precision" value={formatPct(summary.micro_precision)} />
                  <Stat label="Recall" value={formatPct(summary.micro_recall)} />
                </>
              )}
              {summary.task === "med_extraction" && (
                <>
                  <Stat label="Wirkstoff F1" value={formatPct(summary.wirkstoff_f1)} />
                  <Stat label="Partial F1" value={formatPct(summary.partial_f1)} />
                  <Stat label="Exact F1" value={formatPct(summary.exact_f1)} />
                  <Stat label="Precision" value={formatPct(summary.wirkstoff_precision)} />
                  <Stat label="Recall" value={formatPct(summary.wirkstoff_recall)} />
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

                  if (task === "ner") {
                    return (
                      <NERCaseResult
                        key={pred.case_id}
                        task={task}
                        prediction={pred as NERPrediction}
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

function Stat({ label, value, destructive }: { label: string; value: string; destructive?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono text-xl font-semibold ${destructive ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}

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
    <Card className={perfect ? "border-green-500/20" : ""}>
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between">
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
              <span className="text-xs text-destructive">
                {prediction.parse_error ? "Parse Error" : "API Error"}
              </span>
            ) : (
              <>
                {goldHd && (
                  <span className={`text-xs ${hdCorrect ? "text-green-600" : "text-destructive"}`}>
                    HD {hdCorrect ? "✓" : "✗"}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{tp.length}/{goldCodes.size}</span>
              </>
            )}
          </div>
        </div>
        {hasError ? (
          <p className="text-xs text-muted-foreground">
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Ground Truth</p>
              <div className="space-y-1">
                {goldCase?.diagnosen?.map((d: { code: string; display: string; typ: string }) => (
                  <div key={d.code} className="flex items-center gap-2 text-xs">
                    <code className="w-16 shrink-0 font-mono">{d.code}</code>
                    <span className="text-muted-foreground">{d.display}</span>
                    {d.typ === "Hauptdiagnose" && <Badge variant="secondary" className="ml-auto shrink-0 text-xs">HD</Badge>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Prediction</p>
              <div className="space-y-1">
                {tp.map((c) => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="w-4 shrink-0 text-center text-green-600">✓</span>
                    <code className="font-mono">{c}</code>
                    {catalog[c] && <span className="text-muted-foreground">{catalog[c].display}</span>}
                  </div>
                ))}
                {fp.map((c) => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="w-4 shrink-0 text-center text-destructive">+</span>
                    <code className="font-mono text-destructive">{c}</code>
                    <span className="text-muted-foreground">{catalog[c] ? catalog[c].display : "ungültiger Code"}</span>
                  </div>
                ))}
                {fn.map((c) => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="w-4 shrink-0 text-center text-muted-foreground">✗</span>
                    <code className="font-mono text-muted-foreground line-through">{c}</code>
                    <span className="text-muted-foreground">{catalog[c] ? catalog[c].display : "nicht erkannt"}</span>
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
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between">
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
            <span className="font-mono text-xs text-muted-foreground">
              {scores.overall.toFixed(1)}/5
            </span>
          )}
        </div>
        {hasError ? (
          <p className="text-xs text-muted-foreground">
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="space-y-3">
            {scores && (
              <div className="flex gap-4">
                {([
                  ["Fakten", scores.faktentreue],
                  ["Vollst.", scores.vollstaendigkeit],
                  ["Halluz.", scores.halluzinationsfreiheit],
                  ["Format", scores.formatkonformitaet],
                ] as const).map(([label, val]) => (
                  <div key={label} className="text-center">
                    <p className="font-mono text-sm font-semibold">{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            )}
            {prediction.summary && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Prediction</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground">HD:</span> {prediction.summary.hauptdiagnose}</p>
                    <p><span className="font-medium text-foreground">Therapie:</span> {prediction.summary.therapie}</p>
                    <p><span className="font-medium text-foreground">Procedere:</span> {prediction.summary.procedere}</p>
                  </div>
                </div>
                {goldCase?.gold_summary && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Gold</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p><span className="font-medium text-foreground">HD:</span> {goldCase.gold_summary.hauptdiagnose}</p>
                      <p><span className="font-medium text-foreground">Therapie:</span> {goldCase.gold_summary.therapie}</p>
                      <p><span className="font-medium text-foreground">Procedere:</span> {goldCase.gold_summary.procedere}</p>
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
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between">
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
            <span className={`text-xs ${aScores.top1_accuracy ? "text-green-600" : "text-destructive"}`}>
              Top-1 {aScores.top1_accuracy ? "\u2713" : "\u2717"}
            </span>
          )}
        </div>
        {hasError ? (
          <p className="text-xs text-muted-foreground">
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="space-y-3">
            {(aScores || jScores) && (
              <div className="flex gap-4">
                {aScores && ([
                  ["F1", aScores.ddx_overlap_f1.toFixed(2)],
                ] as const).map(([label, val]) => (
                  <div key={label} className="text-center">
                    <p className="font-mono text-sm font-semibold">{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
                {jScores && ([
                  ["Reason.", jScores.reasoning_quality],
                  ["Plausi.", jScores.ddx_plausibility],
                  ["Red Fl.", jScores.red_flag_awareness],
                ] as const).map(([label, val]) => (
                  <div key={label} className="text-center">
                    <p className="font-mono text-sm font-semibold">{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            )}
            {prediction.differentialdiagnosen && (
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {prediction.differentialdiagnosen.slice(0, 3).map((d, i) => (
                  <p key={i}>
                    <span className="font-medium text-foreground">#{i + 1} {d.name}</span>
                    {" "}{d.reasoning}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NERCaseResult({
  task,
  prediction,
  goldCase,
}: {
  task: string;
  prediction: NERPrediction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goldCase: any;
}) {
  const hasError = prediction.error || prediction.parse_error;
  const predCount = prediction.entities?.length ?? 0;
  const goldCount = goldCase?.entities?.length ?? 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/benchmarks/${task}/${prediction.case_id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {prediction.case_id}
            </Link>
            <span className="text-xs text-muted-foreground">{goldCase?.fachbereich}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {predCount}/{goldCount} Entitäten
          </span>
        </div>
        {hasError ? (
          <p className="text-xs text-muted-foreground">
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {prediction.entities?.slice(0, 8).map((e, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {e.typ}: {e.name}
              </Badge>
            ))}
            {predCount > 8 && (
              <span className="text-xs text-muted-foreground">+{predCount - 8}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={`/benchmarks/${task}/${prediction.case_id}`}
              className="font-mono text-sm font-medium hover:underline"
            >
              {prediction.case_id}
            </Link>
            <span className="text-xs text-muted-foreground">{goldCase?.fachbereich}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {predCount}/{goldCount} Medikamente
          </span>
        </div>
        {hasError ? (
          <p className="text-xs text-muted-foreground">
            {prediction.parse_error ? "Antwort konnte nicht geparst werden" : "API-Fehler"}
          </p>
        ) : (
          <div className="space-y-1 text-xs text-muted-foreground">
            {prediction.medications?.slice(0, 5).map((m, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="font-medium text-foreground">{m.wirkstoff}</span>
                <span>{m.dosis}</span>
                <span>{m.frequenz}</span>
              </div>
            ))}
            {predCount > 5 && <p>+{predCount - 5} weitere</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
