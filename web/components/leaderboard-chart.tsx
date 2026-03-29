"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@thalamiq/ui/components/toggle-group";
import { Card, CardContent } from "@thalamiq/ui/components/card";
import { Button } from "@thalamiq/ui/components/button";
import type { LeaderboardEntry, ModelSize, TaskId } from "@/lib/types";
import { TASK_CONFIG } from "@/lib/types";
import { getProviderConfig } from "@/lib/providers";
import type { AggregatedScore } from "@/lib/data";

function ProviderIcon({
  provider,
  size = 14,
  className,
}: {
  provider: string;
  size?: number;
  className?: string;
}) {
  const { icon } = getProviderConfig(provider);
  if (!icon) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={icon} alt={provider} width={size} height={size} className={className} />;
}

// ---------------------------------------------------------------------------
// Size labels
// ---------------------------------------------------------------------------

const SIZE_LABELS: Record<ModelSize | "all", string> = {
  all: "Alle",
  small: "S (<15B)",
  medium: "M (15-40B)",
  large: "L (>40B)",
};

/** Room for Y ticks and rotated X-axis model names (Recharts clips to SVG viewBox). */
const BAR_CHART_MARGIN = { top: 10, right: 14, left: 12, bottom: 52 };

// ---------------------------------------------------------------------------
// Per-task metric definitions
// ---------------------------------------------------------------------------

interface MetricDef {
  key: string;
  label: string;
  scale: "pct" | "score5";
  tip: string;
}

const TASK_METRICS: Record<TaskId, MetricDef[]> = {
  icd10_coding: [
    { key: "exact_match_f1", label: "Exact F1", scale: "pct", tip: "F1 auf vollständigen ICD-10-GM Codes (z.B. I21.0)" },
    { key: "category_match_f1", label: "Cat F1", scale: "pct", tip: "F1 auf Kategorie-Ebene (z.B. I21 statt I21.0)" },
    { key: "hauptdiagnose_accuracy", label: "HD Acc", scale: "pct", tip: "Korrekte Hauptdiagnose identifiziert?" },
    { key: "exact_match_precision", label: "Precision", scale: "pct", tip: "Anteil korrekter Codes unter allen vorhergesagten" },
    { key: "exact_match_recall", label: "Recall", scale: "pct", tip: "Anteil gefundener Codes unter allen Gold-Codes" },
  ],
  summarization: [
    { key: "overall_score", label: "Overall", scale: "score5", tip: "Durchschnitt über alle drei Dimensionen (1–5)" },
    { key: "faktentreue", label: "Faktentreue", scale: "score5", tip: "Sind alle genannten Fakten korrekt und belegbar?" },
    { key: "vollstaendigkeit", label: "Vollständigkeit", scale: "score5", tip: "Sind alle klinisch relevanten Informationen enthalten?" },
    { key: "klinische_praezision", label: "Präzision", scale: "score5", tip: "Ist die Zusammenfassung spezifisch und klinisch verwertbar?" },
  ],
  clinical_reasoning: [
    { key: "overall_score", label: "Overall", scale: "score5", tip: "Gewichteter Durchschnitt aller Metriken" },
    { key: "top1_accuracy", label: "Top-1 Acc", scale: "pct", tip: "Korrekte Diagnose an erster Stelle?" },
    { key: "top3_recall", label: "Top-3 Recall", scale: "pct", tip: "Korrekte Diagnose unter den ersten drei?" },
    { key: "ddx_overlap_f1", label: "DDx F1", scale: "pct", tip: "Überlappung mit Referenz-Differentialdiagnosen" },
    { key: "reasoning_quality", label: "Reasoning", scale: "score5", tip: "Klinisch nachvollziehbare, befundbasierte Begründung?" },
    { key: "ddx_plausibility", label: "Plausibilität", scale: "score5", tip: "Klinisch sinnvolle Reihenfolge der Differentialdiagnosen?" },
    { key: "red_flag_awareness", label: "Red Flags", scale: "score5", tip: "Werden gefährliche Differentialdiagnosen berücksichtigt?" },
  ],
  med_extraction: [
    { key: "exact_f1", label: "Exact F1", scale: "pct", tip: "Wirkstoff, Dosis und Frequenz alle korrekt" },
    { key: "partial_f1", label: "Partial F1", scale: "pct", tip: "Wirkstoff korrekt + mindestens Dosis oder Frequenz" },
    { key: "wirkstoff_f1", label: "Wirkstoff F1", scale: "pct", tip: "F1 auf Ebene der Wirkstoff-Erkennung (fuzzy)" },
    { key: "wirkstoff_precision", label: "Precision", scale: "pct", tip: "Anteil korrekter Wirkstoffe unter allen extrahierten" },
    { key: "wirkstoff_recall", label: "Recall", scale: "pct", tip: "Anteil gefundener Wirkstoffe unter allen Gold-Wirkstoffen" },
  ],
  med_qa: [
    { key: "accuracy", label: "Accuracy", scale: "pct", tip: "Anteil korrekt beantworteter MC-Fragen" },
  ],
  patient_text: [
    { key: "overall_score", label: "Overall", scale: "score5", tip: "Durchschnitt über alle drei Dimensionen (1–5)" },
    { key: "verstaendlichkeit", label: "Verständlichkeit", scale: "score5", tip: "Für Laien ohne Vorkenntnisse verständlich?" },
    { key: "medizinische_korrektheit", label: "Korrektheit", scale: "score5", tip: "Medizinisch korrekt vereinfacht, ohne Irreführung?" },
    { key: "vollstaendigkeit", label: "Vollständigkeit", scale: "score5", tip: "Alle klinisch relevanten Informationen kommuniziert?" },
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelInfo {
  model: string;
  shortName: string;
  provider: string;
  size: ModelSize;
}

// ---------------------------------------------------------------------------
// Custom XAxis tick with provider icon
// ---------------------------------------------------------------------------

interface ChartEntry {
  name: string;
  value: number;
  model: string;
  provider: string;
  size: ModelSize;
  errorRate: number; // 0-1
}

function AxisTickWithIcon({
  x,
  y,
  payload,
  chartData,
}: {
  x: number;
  y: number;
  payload: { value: string };
  chartData: ChartEntry[];
}) {
  const entry = chartData.find((d) => d.name === payload.value);
  const provider = entry?.provider ?? "";
  const { icon } = getProviderConfig(provider);
  const ICON = 16;

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Icon centered above the text */}
      {icon && (
        <foreignObject
          x={-ICON / 2}
          y={0}
          width={ICON}
          height={ICON}
          style={{ overflow: "visible" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt={provider} width={ICON} height={ICON} />
        </foreignObject>
      )}
      {/* Rotated model name */}
      <text
        x={0}
        y={ICON + 6}
        textAnchor="end"
        fontSize={11}
        fill="var(--muted-foreground, #6b7280)"
        transform={`rotate(-35, 0, ${ICON + 6})`}
      >
        {payload.value}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// AggregatedChart
// ---------------------------------------------------------------------------

function AggregatedChart({
  aggregated,
  activeModels,
}: {
  aggregated: AggregatedScore[];
  activeModels: Set<string>;
}) {
  const router = useRouter();
  const filtered = aggregated.filter((d) => activeModels.has(d.model));

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Keine Ergebnisse.
        </CardContent>
      </Card>
    );
  }

  const chartData: ChartEntry[] = filtered.map((entry) => ({
    name: entry.shortName,
    value: entry.score,
    model: entry.model,
    provider: entry.provider,
    size: entry.size,
    errorRate: 0,
  }));

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData} margin={BAR_CHART_MARGIN}>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border, #e5e7eb)"
                opacity={0.5}
              />
              <XAxis
                type="category"
                dataKey="name"
                padding={{ left: 8, right: 8 }}
                tick={(props: Record<string, unknown>) => (
                  <AxisTickWithIcon
                    x={props.x as number}
                    y={props.y as number}
                    payload={props.payload as { value: string }}
                    chartData={chartData}
                  />
                )}
                height={100}
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "var(--border, #e5e7eb)" }}
              />
              <YAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                width={48}
                stroke="var(--muted-foreground, #6b7280)"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <ProviderIcon provider={d.provider} />
                        <p className="font-medium">{d.name}</p>
                      </div>
                      <p className="text-muted-foreground">{d.provider}</p>
                      <p className="mt-1 font-mono">{d.value.toFixed(1)}%</p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(_data: any) => {
                  const model = _data?.model as string | undefined;
                  if (model) router.push(`/model/${encodeURIComponent(model)}`);
                }}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.model}
                    fill={getProviderConfig(entry.provider).color}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TaskChart
// ---------------------------------------------------------------------------

function TaskChart({
  task,
  data,
  activeModels,
  metric,
}: {
  task: TaskId;
  data: LeaderboardEntry[];
  activeModels: Set<string>;
  metric: MetricDef;
}) {
  const router = useRouter();
  const taskData = data.filter(
    (d) => d.task === task && activeModels.has(d.model)
  );

  const sorted = [...taskData].sort(
    (a, b) =>
      ((b[metric.key] as number) ?? 0) -
      ((a[metric.key] as number) ?? 0)
  );

  const isScaleToFive = metric.scale === "score5";
  const maxValue = isScaleToFive ? 5 : 100;
  const formatValue = (v: number) =>
    isScaleToFive ? v.toFixed(1) : `${v.toFixed(1)}%`;

  const chartData: ChartEntry[] = sorted.map((entry) => {
    const raw = (entry[metric.key] as number) ?? 0;
    const errors = entry.n_parse_errors + entry.n_api_errors;
    const total = entry.n_cases || 1;
    return {
      name: entry.shortName,
      value: isScaleToFive ? raw : raw * 100,
      model: entry.model,
      provider: entry.provider,
      size: entry.size,
      errorRate: errors / total,
    };
  });

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Keine Ergebnisse für diesen Task.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData} margin={BAR_CHART_MARGIN}>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border, #e5e7eb)"
                opacity={0.5}
              />
              <XAxis
                type="category"
                dataKey="name"
                padding={{ left: 8, right: 8 }}
                tick={(props: Record<string, unknown>) => (
                  <AxisTickWithIcon
                    x={props.x as number}
                    y={props.y as number}
                    payload={props.payload as { value: string }}
                    chartData={chartData}
                  />
                )}
                height={100}
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "var(--border, #e5e7eb)" }}
              />
              <YAxis
                type="number"
                domain={[0, maxValue]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatValue(v)}
                width={48}
                stroke="var(--muted-foreground, #6b7280)"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as ChartEntry;
                  return (
                    <div className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <ProviderIcon provider={d.provider} />
                        <p className="font-medium">{d.name}</p>
                      </div>
                      <p className="text-muted-foreground">{d.provider}</p>
                      <p className="mt-1 font-mono">
                        {formatValue(d.value)}
                      </p>
                      {d.errorRate > 0 && (
                        <p className="mt-0.5 text-xs text-destructive">
                          {Math.round(d.errorRate * 100)}% Errors
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(_data: any) => {
                  const model = _data?.model as string | undefined;
                  if (model) {
                    router.push(`/model/${encodeURIComponent(model)}`);
                  }
                }}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.model}
                    fill={getProviderConfig(entry.provider).color}
                    opacity={entry.errorRate > 0.5 ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LeaderboardChart (main)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TaskSection — title + metric tabs + chart
// ---------------------------------------------------------------------------

function TaskSection({
  task,
  data,
  activeModels,
}: {
  task: TaskId;
  data: LeaderboardEntry[];
  activeModels: Set<string>;
}) {
  const metrics = TASK_METRICS[task];
  const [activeMetric, setActiveMetric] = useState(metrics[0].key);
  const metric = metrics.find((m) => m.key === activeMetric) ?? metrics[0];

  return (
    <section className="min-w-0">
      <h2 className="text-lg font-semibold tracking-tight">
        <Link href={`/benchmarks/${task}`} className="hover:underline">
          {TASK_CONFIG[task].name}
        </Link>
      </h2>
      {metrics.length > 1 ? (
        <div className="mt-1.5 mb-3 flex flex-wrap gap-1">
          {metrics.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              title={m.tip}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                m.key === activeMetric
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {metrics[0].label}
        </p>
      )}
      <TaskChart
        task={task}
        data={data}
        activeModels={activeModels}
        metric={metric}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// LeaderboardChart (main)
// ---------------------------------------------------------------------------

export function LeaderboardChart({ data, aggregated }: { data: LeaderboardEntry[]; aggregated: AggregatedScore[] }) {
  const allModels = useMemo<ModelInfo[]>(() => {
    const seen = new Map<string, ModelInfo>();
    for (const d of data) {
      if (!seen.has(d.model)) {
        seen.set(d.model, {
          model: d.model,
          shortName: d.shortName,
          provider: d.provider,
          size: d.size,
        });
      }
    }
    return [...seen.values()];
  }, [data]);

  // Group models by provider for the filter bar
  const providerGroups = useMemo(() => {
    const groups = new Map<string, ModelInfo[]>();
    for (const m of allModels) {
      const list = groups.get(m.provider) ?? [];
      list.push(m);
      groups.set(m.provider, list);
    }
    return groups;
  }, [allModels]);

  const [activeModels, setActiveModels] = useState<Set<string>>(
    () => new Set(allModels.map((m) => m.model))
  );
  const [sizeFilter, setSizeFilter] = useState<ModelSize | "all">("all");

  const effectiveModels = useMemo(() => {
    if (sizeFilter === "all") return activeModels;
    const sizeModels = new Set(
      allModels.filter((m) => m.size === sizeFilter).map((m) => m.model)
    );
    return new Set([...activeModels].filter((id) => sizeModels.has(id)));
  }, [activeModels, sizeFilter, allModels]);

  const availableTasks = useMemo(
    () => [...new Set(data.map((d) => d.task))] as TaskId[],
    [data]
  );

  const toggleModel = (model: string) => {
    setActiveModels((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  const toggleProvider = (provider: string) => {
    const models = providerGroups.get(provider) ?? [];
    const modelIds = models.map((m) => m.model);
    setActiveModels((prev) => {
      const next = new Set(prev);
      const allActive = modelIds.every((id) => next.has(id));
      for (const id of modelIds) {
        if (allActive) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const selectAll = () =>
    setActiveModels(new Set(allModels.map((m) => m.model)));
  const selectNone = () => setActiveModels(new Set());

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {/* Size filter */}
        <ToggleGroup
          type="single"
          value={sizeFilter}
          onValueChange={(v) => {
            if (v) setSizeFilter(v as ModelSize | "all");
          }}
        >
          {Object.entries(SIZE_LABELS).map(([value, label]) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="text-xs h-7"
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <span className="mx-1 h-4 w-px bg-border" />

        {/* Model pills — flat list */}
        {allModels
          .filter((m) => sizeFilter === "all" || m.size === sizeFilter)
          .map((m) => {
            const isActive = activeModels.has(m.model);
            const { color } = getProviderConfig(m.provider);
            return (
              <button
                key={m.model}
                onClick={() => toggleModel(m.model)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  isActive
                    ? "border-border bg-background text-foreground"
                    : "border-transparent bg-muted/50 text-muted-foreground line-through"
                }`}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }}
                />
                {m.shortName}
              </button>
            );
          })}

        <span className="mx-1 h-4 w-px bg-border" />

        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectAll}>
          Alle
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectNone}>
          Keine
        </Button>

        <span className="mx-1 h-4 w-px bg-border" />

        <a
          href="https://github.com/thalamiq/germedbench/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          Es fehlt ein Modell? Issue öffnen
        </a>
      </div>

      {/* Gesamt-Ranking */}
      {aggregated.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Gesamt-Ranking
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Normalisierter Durchschnitt über alle Tasks
          </p>
          <AggregatedChart
            aggregated={aggregated}
            activeModels={effectiveModels}
          />
        </section>
      )}

      {/* Per-task charts in grid */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {availableTasks.map((task) => (
          <TaskSection
            key={task}
            task={task}
            data={data}
            activeModels={effectiveModels}
          />
        ))}
      </div>

    </div>
  );
}
