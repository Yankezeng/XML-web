from functools import lru_cache
from typing import Any

from app.config import get_settings
from app.rag.embeddings import get_embedding_model
from app.rag.milvus_store import get_milvus_store
from app.rag.reranker import score_pairs


class KnowledgeRetriever:
    def search(self, query: str, final_k: int | None = None) -> list[dict[str, Any]]:
        settings = get_settings()
        embedding = get_embedding_model().embed_query(query)
        candidates = get_milvus_store().search(embedding, settings.milvus_recall_k)
        if not candidates:
            return []

        pairs = [(query, str(item.get("content") or "")) for item in candidates]
        scores = score_pairs(pairs)
        for item, score in zip(candidates, scores):
            item["rerank_score"] = score

        candidates.sort(key=lambda item: item.get("rerank_score", 0.0), reverse=True)
        return candidates[: final_k or settings.rag_final_k]


@lru_cache(maxsize=1)
def get_retriever():
    backend = get_settings().rag_backend.strip().lower()
    if backend == "lexical":
        from app.rag.lexical import LexicalKnowledgeRetriever

        return LexicalKnowledgeRetriever()
    if backend != "milvus":
        raise RuntimeError(f"Unsupported RAG_BACKEND: {backend}")
    return KnowledgeRetriever()
