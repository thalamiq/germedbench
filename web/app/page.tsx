import type { Metadata } from "next";
import { getLeaderboard, getAggregatedScores } from "@/lib/data";
import { LeaderboardChart } from "@/components/leaderboard-chart";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Aktuelle Rangliste der LLM-Performance auf deutschen klinischen Benchmark-Tasks. Vergleiche Open-Source-Modelle bei ICD-10-Kodierung.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

export default function Home() {
  const data = getLeaderboard();
  const aggregated = getAggregatedScores();

  return <LeaderboardChart data={data} aggregated={aggregated} />;
}
