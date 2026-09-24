from functools import lru_cache

from app.config import get_settings


@lru_cache(maxsize=1)
def get_embedding_model():
    """Load BAAI/bge-large-zh-v1.5 lazily so health checks stay cheap."""
    from langchain_huggingface import HuggingFaceEmbeddings

    settings = get_settings()
    return HuggingFaceEmbeddings(
        model_name=settings.embedding_model,
        model_kwargs={"device": settings.embedding_device},
        encode_kwargs={"normalize_embeddings": True},
    )
