"use client";

import { useMemo, useState } from "react";
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
// TaskChart
// ---------------------------------------------------------------------------

function TaskChart({
  task,
  data,
  activeModels,
}: {
  task: TaskId;
  data: LeaderboardEntry[];
  activeModels: Set<string>;
}) {
  const router = useRouter();
  const taskConfig = TASK_CONFIG[task];
  const taskData = data.filter(
    (d) => d.task === task && activeModels.has(d.model)
  );

  const primaryMetric = taskConfig.primaryMetric;
  const sorted = [...taskData].sort(
    (a, b) =>
      ((b[primaryMetric] as number) ?? 0) -
      ((a[primaryMetric] as number) ?? 0)
  );

  const isScaleToFive = task === "summarization" || task === "clinical_reasoning";
  const maxValue = isScaleToFive ? 5 : 100;
  const formatValue = (v: number) =>
    isScaleToFive ? v.toFixed(1) : `${v.toFixed(1)}%`;

  const chartData: ChartEntry[] = sorted.map((entry) => {
    const raw = (entry[primaryMetric] as number) ?? 0;
    return {
      name: entry.shortName,
      value: isScaleToFive ? raw : raw * 100,
      model: entry.model,
      provider: entry.provider,
      size: entry.size,
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
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={chartData}
              margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border, #e5e7eb)"
                opacity={0.5}
              />
              <XAxis
                type="category"
                dataKey="name"
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
                width={40}
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
                      <p className="mt-1 font-mono">
                        {formatValue(d.value)}
                      </p>
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

export function LeaderboardChart({ data }: { data: LeaderboardEntry[] }) {
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
      <Card className="mb-8">
        <CardContent className="py-4">
          <div className="flex flex-col gap-4">
            {/* Size filter */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
                Größe
              </span>
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
                    className="text-xs"
                  >
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Model toggles grouped by provider */}
            <div className="flex items-start gap-3">
              <span className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
                Modelle
              </span>
              <div className="flex flex-col gap-3 min-w-0">
                {[...providerGroups.entries()].map(([provider, models]) => {
                  const { color } = getProviderConfig(provider);
                  const visibleModels =
                    sizeFilter === "all"
                      ? models
                      : models.filter((m) => m.size === sizeFilter);
                  if (visibleModels.length === 0) return null;

                  const allActive = visibleModels.every((m) =>
                    activeModels.has(m.model)
                  );

                  return (
                    <div key={provider} className="flex items-center gap-2 flex-wrap">
                      {/* Provider label (clickable to toggle all) */}
                      <button
                        onClick={() => toggleProvider(provider)}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors shrink-0 ${
                          allActive
                            ? "border-border bg-background text-foreground"
                            : "border-transparent bg-muted/50 text-muted-foreground"
                        }`}
                        style={{
                          borderColor: allActive ? color : undefined,
                        }}
                      >
                        <ProviderIcon provider={provider} />
                        {provider}
                      </button>

                      {/* Individual model toggles */}
                      {visibleModels.map((m) => {
                        const isActive = activeModels.has(m.model);
                        return (
                          <button
                            key={m.model}
                            onClick={() => toggleModel(m.model)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                              isActive
                                ? "border-border bg-background text-foreground"
                                : "border-transparent bg-muted/50 text-muted-foreground line-through"
                            }`}
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full transition-opacity"
                              style={{
                                backgroundColor: color,
                                opacity: isActive ? 1 : 0.3,
                              }}
                            />
                            {m.shortName}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Select all / none */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={selectAll}
                  >
                    Alle
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={selectNone}
                  >
                    Keine
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task charts */}
      <div className="space-y-12">
        {availableTasks.map((task) => (
          <section key={task}>
            <h2 className="text-2xl font-semibold tracking-tight">
              {TASK_CONFIG[task].name}
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              {TASK_CONFIG[task].primaryMetricLabel}
            </p>
            <TaskChart
              task={task}
              data={data}
              activeModels={effectiveModels}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
