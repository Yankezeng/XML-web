from functools import lru_cache

from app.config import get_settings


@lru_cache(maxsize=1)
def get_reranker():
    """Load BAAI/bge-reranker-v2-m3 lazily for second-stage ranking."""
    from FlagEmbedding import FlagReranker

    settings = get_settings()
    return FlagReranker(settings.rerank_model, use_fp16=settings.rerank_use_fp16)


def score_pairs(pairs: list[tuple[str, str]]) -> list[float]:
    if not pairs:
        return []
    scores = get_reranker().compute_score(pairs, normalize=True)
    if isinstance(scores, (float, int)):
        return [float(scores)]
    return [float(score) for score in scores]
