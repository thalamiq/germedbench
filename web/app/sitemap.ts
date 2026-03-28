import type { MetadataRoute } from "next";
import { getBenchmarkCases, getLeaderboard } from "@/lib/data";

const SITE_URL = "https://germedbench.de";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/benchmarks`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/methodik`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Dynamic task pages
  const tasks = ["icd10_coding"];
  for (const task of tasks) {
    entries.push({
      url: `${SITE_URL}/benchmarks/${task}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });

    const cases = getBenchmarkCases(task);
    for (const c of cases) {
      entries.push({
        url: `${SITE_URL}/benchmarks/${task}/${c.id}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // Model pages
  const leaderboard = getLeaderboard();
  for (const entry of leaderboard) {
    entries.push({
      url: `${SITE_URL}/model/${encodeURIComponent(entry.model)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
