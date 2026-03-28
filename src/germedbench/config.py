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
    )

    # Gemini (data generation + LLM-as-Judge)
    gemini_api_key: str = ""
    generation_model: str = "gemini-3-flash-preview"
    generation_temperature: float = 0.9
    judge_model: str = "gemini-3.1-pro-preview"

    # Provider: Together AI
    together_api_key: str = ""
    together_base_url: str = "https://api.together.xyz/v1"

    # Provider: Chat-AI (Academic Cloud)
    chat_ai_api_key: str = ""
    chat_ai_base_url: str = "https://chat-ai.academiccloud.de/v1"

    # Per-task case generation
    icd10_num_cases: int = 10
    summarization_num_cases: int = 10
    clinical_reasoning_num_cases: int = 10
    ner_num_cases: int = 10
    med_extraction_num_cases: int = 10

    # Evaluation models
    eval_models: list[EvalModel] = [
        # --- Together AI ---
        EvalModel(id="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", provider="together"),
        EvalModel(id="deepseek-ai/DeepSeek-V3.1", provider="together"),
        EvalModel(id="mistralai/Mistral-Small-24B-Instruct-2501", provider="together"),
        EvalModel(id="mistralai/Mixtral-8x7B-Instruct-v0.1", provider="together"),
        EvalModel(id="Qwen/Qwen2.5-7B-Instruct-Turbo", provider="together"),
        EvalModel(id="google/gemma-3n-E4B-it", provider="together"),
        # --- Chat-AI (Academic Cloud) ---
        # Large
        # EvalModel(id="apertus-70b-instruct-2509", provider="chat_ai"),
        # EvalModel(id="deepseek-r1-distill-llama-70b", provider="chat_ai"),
        # EvalModel(id="devstral-2-123b-instruct-2512", provider="chat_ai"),
        EvalModel(id="mistral-large-3-675b-instruct-2512", provider="chat_ai"),
        EvalModel(id="openai-gpt-oss-120b", provider="chat_ai"),
        EvalModel(id="glm-4.7", provider="chat_ai"),
        # EvalModel(id="qwen3-235b-a22b", provider="chat_ai"),  # thinking model, too slow + hits max_tokens
        # Mid-range
        EvalModel(id="gemma-3-27b-it", provider="chat_ai"),
        EvalModel(id="medgemma-27b-it", provider="chat_ai"),
        EvalModel(id="llama-3.3-70b-instruct", provider="chat_ai"),
        EvalModel(id="llama-3.1-sauerkrautlm-70b-instruct", provider="chat_ai"),
        EvalModel(id="qwen3-30b-a3b-instruct-2507", provider="chat_ai"),
        # EvalModel(id="qwen3-32b", provider="chat_ai"),  # thinking model, too slow + hits max_tokens
        # Small
        # EvalModel(id="meta-llama-3.1-8b-instruct", provider="chat_ai"),  # refuses to answer, hallucinates tool calls
        # EvalModel(id="teuken-7b-instruct-research", provider="chat_ai"),
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
