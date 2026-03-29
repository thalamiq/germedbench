import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModelRun, getBenchmarkCases, getICD10Catalog, getLeaderboard } from "@/lib/data";
import { getModelMeta, TASK_CONFIG, getPrimaryMetric } from "@/lib/types";
import type { TaskId, ModelResult } from "@/lib/types";
import { ModelDetailClient } from "./client";

export const dynamic = "force-dynamic";

const ALL_TASKS: TaskId[] = ["icd10_coding", "med_extraction", "med_qa", "summarization", "clinical_reasoning", "patient_text"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const modelId = decodeURIComponent(id);
  const meta = getModelMeta(modelId);
  return {
    title: `${meta.shortName} — GerMedBench`,
    description: `${meta.shortName} von ${meta.provider} im GerMedBench. Detaillierte Ergebnisse pro Task und Fall.`,
    alternates: { canonical: `/model/${encodeURIComponent(modelId)}` },
  };
}

// Compute rank for each task
function computeRanks(modelId: string): Record<string, { rank: number; total: number }> {
  const leaderboard = getLeaderboard();
  const ranks: Record<string, { rank: number; total: number }> = {};

  for (const task of ALL_TASKS) {
    const taskEntries = leaderboard.filter((e) => e.task === task);
    if (taskEntries.length === 0) continue;

    const sorted = [...taskEntries].sort((a, b) => {
      const aVal = getPrimaryMetric(a as unknown as ModelResult);
      const bVal = getPrimaryMetric(b as unknown as ModelResult);
      return bVal - aVal;
    });

    const idx = sorted.findIndex((e) => e.model === modelId);
    if (idx !== -1) {
      ranks[task] = { rank: idx + 1, total: sorted.length };
    }
  }

  return ranks;
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const modelId = decodeURIComponent(id);
  const meta = getModelMeta(modelId);

  const taskRuns = ALL_TASKS.map((task) => {
    const run = getModelRun(modelId, task);
    if (!run) return null;
    const cases = getBenchmarkCases(task);
    return { task, run, cases };
  }).filter(Boolean) as { task: TaskId; run: NonNullable<ReturnType<typeof getModelRun>>; cases: ReturnType<typeof getBenchmarkCases> }[];

  if (taskRuns.length === 0) notFound();

  const ranks = computeRanks(modelId);
  const catalog = getICD10Catalog();

  // Serialize for client
  const taskData = taskRuns.map(({ task, run, cases }) => ({
    task,
    summary: run.summary,
    predictions: run.predictions,
    cases,
  }));

  return (
    <ModelDetailClient
      modelId={modelId}
      meta={meta}
      taskData={taskData}
      ranks={ranks}
      catalog={catalog}
    />
  );
}
