import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard } from "@/lib/data";
import { getModelMeta } from "@/lib/types";
import { getProviderConfig } from "@/lib/providers";
import { Badge } from "@thalamiq/ui/components/badge";

export const metadata: Metadata = {
  title: "Modelle",
  description: "Alle evaluierten Open-Weights-Modelle im GerMedBench.",
  alternates: { canonical: "/modelle" },
};

export const dynamic = "force-dynamic";

export default function ModellePage() {
  const leaderboard = getLeaderboard();

  // Group by model: count tasks, collect task names
  const modelMap = new Map<
    string,
    { tasks: Set<string>; nCases: number; nErrors: number }
  >();
  for (const entry of leaderboard) {
    const existing = modelMap.get(entry.model) ?? {
      tasks: new Set(),
      nCases: 0,
      nErrors: 0,
    };
    existing.tasks.add(entry.task);
    existing.nCases += entry.n_scored;
    existing.nErrors += entry.n_parse_errors + entry.n_api_errors;
    modelMap.set(entry.model, existing);
  }

  // Sort by number of tasks (desc), then by name
  const models = [...modelMap.entries()]
    .map(([modelId, data]) => {
      const meta = getModelMeta(modelId);
      return { modelId, meta, ...data };
    })
    .sort((a, b) => {
      if (b.tasks.size !== a.tasks.size) return b.tasks.size - a.tasks.size;
      return a.meta.shortName.localeCompare(b.meta.shortName);
    });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Modelle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {models.length} Open-Weights-Modelle evaluiert
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Modell</th>
              <th className="pb-2 pr-4 font-medium">Provider</th>
              <th className="pb-2 pr-4 font-medium text-center">Größe</th>
              <th className="pb-2 font-medium text-right">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {models.map(({ modelId, meta, tasks }) => {
              const { color } = getProviderConfig(meta.provider);
              return (
                <tr
                  key={modelId}
                  className="border-b border-border/30 transition-colors hover:bg-muted/50"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/model/${encodeURIComponent(modelId)}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {meta.shortName}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {meta.provider}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <Badge variant="secondary" className="text-xs uppercase">
                      {meta.size}
                    </Badge>
                  </td>
                  <td className="py-3 text-right font-mono text-muted-foreground">
                    {tasks.size}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
