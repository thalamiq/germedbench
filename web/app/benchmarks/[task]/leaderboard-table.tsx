"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@thalamiq/ui/components/card";

type Metric = { key: string; label: string; format: "pct" | "score" };

type LeaderboardEntry = {
  model: string;
  shortName: string;
  provider: string;
  n_parse_errors: number;
  n_api_errors: number;
  [key: string]: unknown;
};

const TOP_N = 3;

const formatVal = (v: number, fmt: "pct" | "score") =>
  fmt === "pct" ? `${(v * 100).toFixed(1)}%` : v.toFixed(1);

export function LeaderboardTable({
  leaderboard,
  metrics,
}: {
  leaderboard: LeaderboardEntry[];
  metrics: Metric[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = leaderboard.length > TOP_N;
  const visible = expanded ? leaderboard : leaderboard.slice(0, TOP_N);

  return (
    <Card>
      <CardContent className="overflow-x-auto py-0">
        <table className="w-full">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2.5 text-left font-medium w-8">#</th>
              <th className="py-2.5 text-left font-medium">Modell</th>
              {metrics.map((m) => (
                <th
                  key={m.key}
                  className="py-2.5 text-right font-medium whitespace-nowrap pl-3"
                >
                  {m.label}
                </th>
              ))}
              <th className="py-2.5 text-right font-medium pl-3">Err</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry, i) => {
              const errors = entry.n_parse_errors + entry.n_api_errors;
              return (
                <tr
                  key={entry.model}
                  className="border-b last:border-0 hover:bg-muted/50"
                >
                  <td className="py-2.5 text-sm text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="py-2.5 whitespace-nowrap">
                    <Link
                      href={`/model/${encodeURIComponent(entry.model)}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {entry.shortName}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {entry.provider}
                    </span>
                  </td>
                  {metrics.map((m, mi) => {
                    const val = (entry[m.key] as number) ?? 0;
                    return (
                      <td
                        key={m.key}
                        className={`py-2.5 text-right font-mono text-sm pl-3 ${mi === 0 ? "font-semibold" : "text-muted-foreground"}`}
                      >
                        {formatVal(val, m.format)}
                      </td>
                    );
                  })}
                  <td className="py-2.5 text-right text-xs pl-3">
                    {errors > 0 ? (
                      <span className="text-destructive">{errors}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hasMore && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {expanded
              ? "Weniger anzeigen"
              : `${leaderboard.length - TOP_N} weitere Modelle anzeigen`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
