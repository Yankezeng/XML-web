import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-flash"
    deepseek_thinking_enabled: bool = True
    deepseek_reasoning_effort: str = "high"

    rag_backend: str = "milvus"
    chat_rate_limit_per_minute: int = 12

    embedding_model: str = "BAAI/bge-large-zh-v1.5"
    embedding_device: str = "cpu"
    rerank_model: str = "BAAI/bge-reranker-v2-m3"
    rerank_use_fp16: bool = False
    hf_endpoint: str = "https://hf-mirror.com"
    hf_home: str = ".cache/huggingface"
    hf_hub_cache: str = ".cache/huggingface/hub"

    milvus_host: str = "127.0.0.1"
    milvus_port: int = 19531
    milvus_collection: str = "knowledge_chunks"
    # Empty value means "connect to a Milvus server". Set a file path to run
    # Milvus in embedded mode (Milvus Lite) instead, which needs no Docker,
    # no etcd and no MinIO. Keep this path ASCII-only and short: the embedded
    # engine writes its own files next to it.
    milvus_uri: str = ""
    milvus_metric: str = "COSINE"
    milvus_recall_k: int = 30
    rag_final_k: int = 5

    cors_origins: str = "http://127.0.0.1:8000,http://localhost:8000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    # Hugging Face reads these values when model clients are created.
    os.environ.setdefault("HF_ENDPOINT", settings.hf_endpoint)
    os.environ.setdefault("HF_HOME", settings.hf_home)
    os.environ.setdefault("HF_HUB_CACHE", settings.hf_hub_cache)
    return settings
