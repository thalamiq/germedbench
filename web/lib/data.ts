import fs from "fs";
import path from "path";
import type {
  BenchmarkCase,
  LeaderboardEntry,
  ModelResult,
  ModelRun,
} from "./types";
import { getModelMeta } from "./types";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const RESULTS_DIR = path.join(PROJECT_ROOT, "results");
const DATA_DIR = path.join(PROJECT_ROOT, "data");

export function getLeaderboard(task?: string): LeaderboardEntry[] {
  const latestPath = path.join(RESULTS_DIR, "latest.json");
  if (!fs.existsSync(latestPath)) return [];

  const raw = fs.readFileSync(latestPath, "utf-8");
  const results: ModelResult[] = JSON.parse(raw);
  const filtered = task ? results.filter((r) => r.task === task) : results;

  return filtered.map((r) => {
    const meta = getModelMeta(r.model);
    return { ...r, ...meta } as LeaderboardEntry;
  });
}

export function getModelRun(
  modelId: string,
  task: string
): ModelRun | null {
  const slug = modelId.replace("/", "__");
  const taskDir = path.join(RESULTS_DIR, slug, task);
  if (!fs.existsSync(taskDir)) return null;

  // Get the latest run file
  const files = fs
    .readdirSync(taskDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const raw = fs.readFileSync(path.join(taskDir, files[0]), "utf-8");
  return JSON.parse(raw);
}

export function getBenchmarkCases(task: string): BenchmarkCase[] {
  const filePath = path.join(DATA_DIR, `${task}.jsonl`);
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf-8");
  return raw
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

let _icd10Catalog: Record<string, { display: string; terminal: boolean }> | null = null;

export function getICD10Catalog(): Record<string, { display: string; terminal: boolean }> {
  if (!_icd10Catalog) {
    const catalogPath = path.join(DATA_DIR, "icd10gm_2025.json");
    if (!fs.existsSync(catalogPath)) return {};
    _icd10Catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  }
  return _icd10Catalog!;
}

export function icd10Display(code: string): string {
  const entry = getICD10Catalog()[code];
  return entry?.display ?? code;
}

export function getAllModelIds(): string[] {
  if (!fs.existsSync(RESULTS_DIR)) return [];
  return fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => {
      const full = path.join(RESULTS_DIR, f);
      return fs.statSync(full).isDirectory();
    })
    .map((slug) => slug.replace("__", "/"));
}
