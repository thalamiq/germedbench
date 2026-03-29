"""Central configuration — loaded from .env via pydantic-settings."""

from pathlib import Path

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class EvalModel(BaseModel):
    id: str
    provider: str = "together"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Gemini (data generation + LLM-as-Judge)
    gemini_api_key: str = ""
    generation_model: str = "gemini-3-flash-preview"
    generation_temperature: float = 0.9
    judge_model: str = "gemini-3-flash-preview"

    # Provider: Together AI
    together_api_key: str = ""
    together_base_url: str = "https://api.together.xyz/v1"

    # Provider: DeepInfra
    deepinfra_api_key: str = ""
    deepinfra_base_url: str = "https://api.deepinfra.com/v1/openai"

    # Per-task case generation
    icd10_num_cases: int = 50
    summarization_num_cases: int = 50
    clinical_reasoning_num_cases: int = 50
    med_extraction_num_cases: int = 50
    med_qa_num_cases: int = 50
    patient_text_num_cases: int = 50

    # Evaluation models
    eval_models: list[EvalModel] = [
        # --- Together AI ---
        EvalModel(id="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8"),
        EvalModel(id="meta-llama/Llama-3.3-70B-Instruct-Turbo"),
        EvalModel(id="deepseek-ai/DeepSeek-V3.1"),
        EvalModel(id="mistralai/Mistral-Small-24B-Instruct-2501"),
        EvalModel(id="mistralai/Mixtral-8x7B-Instruct-v0.1"),
        EvalModel(id="Qwen/Qwen2.5-7B-Instruct-Turbo"),
        EvalModel(id="google/gemma-3n-E4B-it"),
        EvalModel(id="openai/gpt-oss-120b"),
        # EvalModel(id="zai-org/GLM-4.7"),  # slow, poor output quality
        # --- DeepInfra ---
        EvalModel(id="google/gemma-3-27b-it", provider="deepinfra"),
        EvalModel(id="Qwen/Qwen2.5-72B-Instruct", provider="deepinfra"),
        # EvalModel(id="zai-org/GLM-5", provider="deepinfra"),  # slow, poor output quality
        EvalModel(id="deepseek-ai/DeepSeek-V3.2", provider="deepinfra"),
        EvalModel(id="meta-llama/Meta-Llama-3.1-8B-Instruct", provider="deepinfra"),
        EvalModel(id="nvidia/Llama-3.1-Nemotron-70B-Instruct", provider="deepinfra"),
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
    def med_extraction_output_file(self) -> Path:
        return self.data_dir / "med_extraction.jsonl"

    @property
    def med_qa_output_file(self) -> Path:
        return self.data_dir / "med_qa.jsonl"

    @property
    def patient_text_output_file(self) -> Path:
        return self.data_dir / "patient_text.jsonl"


FACHBEREICHE = [
    "Innere Medizin",
    "Kardiologie",
    "Pneumologie",
    "Neurologie",
    "Gastroenterologie",
    "Onkologie",
    "Orthopädie/Unfallchirurgie",
    "Psychiatrie/Psychosomatik",
    "Gynäkologie/Geburtshilfe",
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
