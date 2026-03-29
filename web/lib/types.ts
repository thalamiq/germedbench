export type ModelSize = "small" | "medium" | "large";
export type TaskId = "icd10_coding" | "summarization" | "clinical_reasoning" | "med_extraction" | "med_qa" | "patient_text";

// --- Task config ---

export const TASK_CONFIG: Record<
  TaskId,
  { name: string; primaryMetric: string; primaryMetricLabel: string }
> = {
  icd10_coding: {
    name: "ICD-10-GM Kodierung",
    primaryMetric: "exact_match_f1",
    primaryMetricLabel: "Exact Match F1",
  },
  summarization: {
    name: "Arztbrief-Zusammenfassung",
    primaryMetric: "overall_score",
    primaryMetricLabel: "Overall Score",
  },
  clinical_reasoning: {
    name: "Klinisches Reasoning",
    primaryMetric: "overall_score",
    primaryMetricLabel: "Overall Score",
  },
  med_extraction: {
    name: "Medikamentenextraktion",
    primaryMetric: "exact_f1",
    primaryMetricLabel: "Exact F1",
  },
  med_qa: {
    name: "Medizinisches Wissen",
    primaryMetric: "accuracy",
    primaryMetricLabel: "Accuracy",
  },
  patient_text: {
    name: "Patientenverständliche Erklärung",
    primaryMetric: "overall_score",
    primaryMetricLabel: "Overall Score",
  },
};

// --- Model results (discriminated union) ---

interface ModelResultBase {
  model: string;
  task: string;
  timestamp: string;
  n_cases: number;
  n_scored: number;
  n_parse_errors: number;
  n_api_errors: number;
}

export interface ICD10Result extends ModelResultBase {
  task: "icd10_coding";
  exact_match_f1: number;
  exact_match_precision: number;
  exact_match_recall: number;
  category_match_f1: number;
  hauptdiagnose_accuracy: number;
}

export interface SummarizationResult extends ModelResultBase {
  task: "summarization";
  faktentreue: number;
  vollstaendigkeit: number;
  klinische_praezision: number;
  overall_score: number;
}

export interface ClinicalReasoningResult extends ModelResultBase {
  task: "clinical_reasoning";
  top1_accuracy: number;
  top3_recall: number;
  ddx_overlap_f1: number;
  reasoning_quality: number;
  ddx_plausibility: number;
  red_flag_awareness: number;
  overall_score: number;
}

export interface MedExtractionResult extends ModelResultBase {
  task: "med_extraction";
  wirkstoff_f1: number;
  wirkstoff_precision: number;
  wirkstoff_recall: number;
  partial_f1: number;
  exact_f1: number;
}

export interface PatientTextResult extends ModelResultBase {
  task: "patient_text";
  verstaendlichkeit: number;
  medizinische_korrektheit: number;
  vollstaendigkeit: number;
  overall_score: number;
}

export interface MedQAResult extends ModelResultBase {
  task: "med_qa";
  accuracy: number;
  n_correct: number;
}

export type ModelResult = ICD10Result | SummarizationResult | ClinicalReasoningResult | MedExtractionResult | MedQAResult | PatientTextResult;

export function getPrimaryMetric(result: ModelResult): number {
  if (result.task === "icd10_coding") return result.exact_match_f1;
  if (result.task === "summarization") return result.overall_score;
  if (result.task === "clinical_reasoning") return result.overall_score;
  if (result.task === "med_extraction") return result.exact_f1;
  if (result.task === "med_qa") return result.accuracy;
  if (result.task === "patient_text") return result.overall_score;
  return 0;
}

// --- Predictions ---

export interface ICD10Prediction {
  case_id: string;
  codes?: string[];
  hauptdiagnose?: string | null;
  raw?: string;
  parse_error?: boolean;
  error?: string;
}

export interface SummarizationPrediction {
  case_id: string;
  summary?: {
    hauptdiagnose: string;
    therapie: string;
    procedere: string;
    offene_fragen: string;
  } | null;
  raw?: string;
  parse_error?: boolean;
  error?: string;
  judge_scores?: {
    faktentreue: number;
    vollstaendigkeit: number;
    klinische_praezision: number;
    overall: number;
  };
  judge_error?: string;
}

export interface ClinicalReasoningPrediction {
  case_id: string;
  differentialdiagnosen?: {
    name: string;
    icd10_code?: string;
    reasoning: string;
    likelihood: string;
  }[] | null;
  raw?: string;
  parse_error?: boolean;
  error?: string;
  automated_scores?: {
    top1_accuracy: number;
    top3_recall: number;
    ddx_overlap_f1: number;
  };
  judge_scores?: {
    reasoning_quality: number;
    ddx_plausibility: number;
    red_flag_awareness: number;
  };
  judge_error?: string;
}

export interface MedExtractionPrediction {
  case_id: string;
  medications?: {
    wirkstoff: string;
    dosis: string;
    frequenz: string;
    darreichungsform?: string;
  }[] | null;
  raw?: string;
  parse_error?: boolean;
  error?: string;
}

export interface PatientTextPrediction {
  case_id: string;
  explanation?: string | null;
  raw?: string;
  parse_error?: boolean;
  error?: string;
  judge_scores?: {
    verstaendlichkeit: number;
    medizinische_korrektheit: number;
    vollstaendigkeit: number;
    overall: number;
  };
  judge_error?: string;
}

export interface MedQAPrediction {
  case_id: string;
  answer?: string | null;
  reasoning?: string | null;
  raw?: string;
  parse_error?: boolean;
  error?: string;
}

export type Prediction = ICD10Prediction | SummarizationPrediction | ClinicalReasoningPrediction | MedExtractionPrediction | MedQAPrediction | PatientTextPrediction;

export interface ModelRun {
  summary: ModelResult;
  predictions: Prediction[];
}

// --- Benchmark cases ---

export interface Diagnosis {
  code: string;
  acceptable_codes?: string[];
  display: string;
  typ: "Hauptdiagnose" | "Nebendiagnose";
}

export interface ICD10BenchmarkCase {
  id: string;
  fachbereich: string;
  text: string;
  diagnosen: Diagnosis[];
}

export interface SummarizationBenchmarkCase {
  id: string;
  fachbereich: string;
  komplexitaet: string;
  text: string;
  gold_summary: {
    hauptdiagnose: string;
    therapie: string;
    procedere: string;
    offene_fragen: string;
  };
}

export interface DifferentialDiagnosisEntry {
  name: string;
  icd10_code?: string;
  likelihood: string;
  key_findings: string[];
}

export interface ClinicalReasoningBenchmarkCase {
  id: string;
  fachbereich: string;
  schwierigkeitsgrad: string;
  text: string;
  gold_diagnoses: DifferentialDiagnosisEntry[];
  correct_diagnosis: string;
  correct_diagnosis_icd10?: string;
}

export interface MedExtractionBenchmarkCase {
  id: string;
  fachbereich: string;
  text: string;
  medications: {
    wirkstoff: string;
    dosis: string;
    frequenz: string;
    darreichungsform?: string;
  }[];
}

export interface PatientTextBenchmarkCase {
  id: string;
  fachbereich: string;
  text: string;
  gold_explanation: string;
}

export interface MedQABenchmarkCase {
  id: string;
  fachbereich: string;
  schwierigkeitsgrad: string;
  question: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
}

export type BenchmarkCase = ICD10BenchmarkCase | SummarizationBenchmarkCase | ClinicalReasoningBenchmarkCase | MedExtractionBenchmarkCase | MedQABenchmarkCase | PatientTextBenchmarkCase;

// --- Leaderboard ---

export interface LeaderboardEntry extends ModelResultBase {
  shortName: string;
  provider: string;
  size: ModelSize;
  // Allow any metric field
  [key: string]: unknown;
}

// --- Model metadata ---

export const MODEL_META: Record<
  string,
  { shortName: string; provider: string; size: ModelSize }
> = {
  // Large (70B+)
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": {
    shortName: "Llama 3.3 70B",
    provider: "Meta",
    size: "large",
  },
  "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": {
    shortName: "Llama 4 Maverick",
    provider: "Meta",
    size: "large",
  },
  "deepseek-ai/DeepSeek-V3.1": {
    shortName: "DeepSeek V3.1",
    provider: "DeepSeek",
    size: "large",
  },
  "moonshotai/Kimi-K2.5": {
    shortName: "Kimi K2.5",
    provider: "Moonshot",
    size: "large",
  },
  "openai/gpt-oss-120b": {
    shortName: "GPT-oss 120B",
    provider: "OpenAI",
    size: "large",
  },
  // Mid-range (15-27B)
  "mistralai/Mistral-Small-24B-Instruct-2501": {
    shortName: "Mistral Small 24B",
    provider: "Mistral",
    size: "medium",
  },
  "mistralai/Mixtral-8x7B-Instruct-v0.1": {
    shortName: "Mixtral 8x7B",
    provider: "Mistral",
    size: "medium",
  },
  // Small (7-9B)
  "Qwen/Qwen2.5-7B-Instruct-Turbo": {
    shortName: "Qwen 2.5 7B",
    provider: "Alibaba",
    size: "small",
  },
  "Qwen/Qwen3.5-9B": {
    shortName: "Qwen 3.5 9B",
    provider: "Alibaba",
    size: "small",
  },
  "Qwen/Qwen3-VL-8B-Instruct": {
    shortName: "Qwen 3 VL 8B",
    provider: "Alibaba",
    size: "small",
  },
  "Qwen/Qwen3-Next-80B-A3B-Instruct": {
    shortName: "Qwen 3 Next 80B",
    provider: "Alibaba",
    size: "large",
  },
  "meta-llama/Meta-Llama-3-8B-Instruct-Lite": {
    shortName: "Llama 3 8B Lite",
    provider: "Meta",
    size: "small",
  },
  "google/gemma-3n-E4B-it": {
    shortName: "Gemma 3n E4B",
    provider: "Google",
    size: "small",
  },
  // Chat-AI (Academic Cloud)
  "apertus-70b-instruct-2509": {
    shortName: "Apertus 70B",
    provider: "Swiss AI",
    size: "large",
  },
  "deepseek-r1-distill-llama-70b": {
    shortName: "DeepSeek R1 Distill 70B",
    provider: "DeepSeek",
    size: "large",
  },
  "devstral-2-123b-instruct-2512": {
    shortName: "Devstral 2 123B",
    provider: "Mistral",
    size: "large",
  },
  "mistral-large-3-675b-instruct-2512": {
    shortName: "Mistral Large 3 675B",
    provider: "Mistral",
    size: "large",
  },
  "openai-gpt-oss-120b": {
    shortName: "GPT-oss 120B",
    provider: "OpenAI",
    size: "large",
  },
  "glm-4.7": {
    shortName: "GLM-4.7",
    provider: "Z.ai",
    size: "large",
  },
  "qwen3-235b-a22b": {
    shortName: "Qwen 3 235B",
    provider: "Alibaba",
    size: "large",
  },
  "gemma-3-27b-it": {
    shortName: "Gemma 3 27B",
    provider: "Google",
    size: "medium",
  },
  "medgemma-27b-it": {
    shortName: "MedGemma 27B",
    provider: "Google",
    size: "medium",
  },
  "llama-3.3-70b-instruct": {
    shortName: "Llama 3.3 70B",
    provider: "Meta",
    size: "large",
  },
  "llama-3.1-sauerkrautlm-70b-instruct": {
    shortName: "SauerkrautLM 70B",
    provider: "Meta",
    size: "large",
  },
  "qwen3-30b-a3b-instruct-2507": {
    shortName: "Qwen 3 30B Instruct",
    provider: "Alibaba",
    size: "medium",
  },
  "qwen3-30b-a3b-thinking-2507": {
    shortName: "Qwen 3 30B Thinking",
    provider: "Alibaba",
    size: "medium",
  },
  "qwen3-32b": {
    shortName: "Qwen 3 32B",
    provider: "Alibaba",
    size: "medium",
  },
  "qwen3-coder-30b-a3b-instruct": {
    shortName: "Qwen 3 Coder 30B",
    provider: "Alibaba",
    size: "medium",
  },
  "meta-llama-3.1-8b-instruct": {
    shortName: "Llama 3.1 8B",
    provider: "Meta",
    size: "small",
  },
  "teuken-7b-instruct-research": {
    shortName: "Teuken 7B",
    provider: "OpenGPT-X",
    size: "small",
  },
};

const PROVIDER_ALIASES: Record<string, string> = {
  Qwen: "Alibaba",
  qwen: "Alibaba",
  "meta-llama": "Meta",
  "deepseek-ai": "DeepSeek",
  deepseek: "DeepSeek",
  mistralai: "Mistral",
  google: "Google",
  moonshotai: "Moonshot",
  openai: "OpenAI",
  swissai: "Swiss AI",
  zhipu: "Z.ai",
  opengptx: "OpenGPT-X",
};

export function getModelMeta(modelId: string) {
  if (MODEL_META[modelId]) return MODEL_META[modelId];
  const parts = modelId.split("/");
  const name = parts[parts.length - 1];
  const rawProvider = parts[0] ?? "Unknown";
  const provider = PROVIDER_ALIASES[rawProvider] ?? rawProvider;
  const sizeMatch = name.match(/(\d+)[Bb]/);
  const paramB = sizeMatch ? parseInt(sizeMatch[1]) : 0;
  const size: ModelSize =
    paramB >= 40 ? "large" : paramB >= 15 ? "medium" : "small";
  return { shortName: name, provider, size };
}
