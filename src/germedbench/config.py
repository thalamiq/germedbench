"""Central configuration — loaded from .env via pydantic-settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
    )

    # Gemini (data generation)
    gemini_api_key: str = ""
    generation_model: str = "gemini-3.1-pro-preview"
    generation_temperature: float = 0.9

    # Together AI (open-source model inference)
    together_api_key: str = ""
    together_base_url: str = "https://api.together.xyz/v1"

    # LLM-as-Judge (Gemini)
    judge_model: str = "gemini-3.1-pro-preview"

    # ICD-10 task
    icd10_num_cases: int = 3

    # Summarization task
    summarization_num_cases: int = 3

    # Clinical reasoning task
    clinical_reasoning_num_cases: int = 3

    # NER task
    ner_num_cases: int = 3

    # Medication extraction task
    med_extraction_num_cases: int = 3

    # Evaluation models (Together AI model IDs)
    eval_models: list[str] = [
        # Large (70B+) — reference performance
        "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
        "deepseek-ai/DeepSeek-V3.1",
        "moonshotai/Kimi-K2.5",
        "openai/gpt-oss-120b",
        # Mid-range (15-27B) — sweet spot for on-prem hospital GPU
        "mistralai/Mistral-Small-24B-Instruct-2501",
        "mistralai/Mixtral-8x7B-Instruct-v0.1",
        # Small (7-9B) — single consumer GPU / edge deployment
        "Qwen/Qwen2.5-7B-Instruct-Turbo",
        "Qwen/Qwen3.5-9B",
        "Qwen/Qwen3-Next-80B-A3B-Instruct",
        "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
        "google/gemma-3n-E4B-it",
    ]

    @property
    def data_dir(self) -> Path:
        return PROJECT_ROOT / "data"

    @property
    def results_dir(self) -> Path:
        return PROJECT_ROOT / "results"

    @property
    def icd10_output_file(self) -> Path:
        return self.data_dir / "icd10_coding.jsonl"

    @property
    def summarization_output_file(self) -> Path:
        return self.data_dir / "summarization.jsonl"

    @property
    def clinical_reasoning_output_file(self) -> Path:
        return self.data_dir / "clinical_reasoning.jsonl"

    @property
    def ner_output_file(self) -> Path:
        return self.data_dir / "ner.jsonl"

    @property
    def med_extraction_output_file(self) -> Path:
        return self.data_dir / "med_extraction.jsonl"


FACHBEREICHE = [
    "Innere Medizin",
    "Kardiologie",
    "Pneumologie",
    "Neurologie",
    "Gastroenterologie",
    "Onkologie",
]

KOMPLEXITAET = [
    "einfach (2-3 Diagnosen, klarer Fall)",
    "mittel (3-5 Diagnosen, typische Komorbiditäten)",
    "komplex (5-7 Diagnosen, Multimorbidität)",
]

SCHWIERIGKEITSGRAD = [
    "einfach (typische Symptomkonstellation, klare Befunde)",
    "mittel (einige atypische Befunde, breitere Differentialdiagnose)",
    "komplex (atypische Präsentation, seltene Differentialdiagnosen, Red Flags)",
]


settings = Settings()
