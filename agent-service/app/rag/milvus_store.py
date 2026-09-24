from functools import lru_cache
from typing import Any

from app.config import get_settings

OUTPUT_FIELDS = [
    "doc_id",
    "chunk_id",
    "title",
    "section",
    "source",
    "page",
    "content",
    "version",
]


def build_schema(client: Any):
    """Collection schema shared by the embedded engine and the ingest script."""
    from pymilvus import DataType

    schema = client.create_schema(auto_id=False, enable_dynamic_field=False)
    schema.add_field("id", DataType.VARCHAR, is_primary=True, max_length=128)
    schema.add_field("doc_id", DataType.VARCHAR, max_length=256)
    schema.add_field("chunk_id", DataType.VARCHAR, max_length=256)
    schema.add_field("title", DataType.VARCHAR, max_length=512)
    schema.add_field("section", DataType.VARCHAR, max_length=512)
    schema.add_field("source", DataType.VARCHAR, max_length=512)
    schema.add_field("page", DataType.INT64)
    schema.add_field("content", DataType.VARCHAR, max_length=65535)
    schema.add_field("version", DataType.VARCHAR, max_length=128)
    schema.add_field("created_at", DataType.VARCHAR, max_length=64)
    schema.add_field("embedding", DataType.FLOAT_VECTOR, dim=1024)
    return schema


def build_index_params(client: Any, metric_type: str):
    params = client.prepare_index_params()
    params.add_index(
        field_name="embedding",
        index_type="HNSW",
        metric_type=metric_type,
        params={"M": 16, "efConstruction": 200},
    )
    return params


class MilvusKnowledgeStore:
    """Read side of the RAG store.

    Two deployment shapes are supported by the same code path:

    * embedded  - ``milvus_uri`` is a file path, so Milvus runs in-process
      through Milvus Lite (no Docker, no etcd, no MinIO);
    * server    - ``milvus_uri`` is empty, so we connect to ``milvus_host`` /
      ``milvus_port`` like the original Docker deployment did.
    """

    def __init__(self) -> None:
        from pymilvus import MilvusClient

        settings = get_settings()
        self.embedded = bool(settings.milvus_uri.strip())
        self.metric_type = settings.milvus_metric or "COSINE"
        self.collection_name = settings.milvus_collection

        if self.embedded:
            path = settings.milvus_uri.strip()
            from pathlib import Path

            Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
            self.client = MilvusClient(uri=path)
        else:
            self.client = MilvusClient(
                uri=f"http://{settings.milvus_host}:{settings.milvus_port}"
            )

    def describe(self) -> dict[str, Any]:
        return {
            "embedded": self.embedded,
            "collection": self.collection_name,
            "metric_type": self.metric_type,
            "rows": self.row_count(),
        }

    def row_count(self) -> int:
        try:
            result = self.client.query(
                collection_name=self.collection_name,
                filter="",
                output_fields=["count(*)"],
            )
        except Exception:
            return 0
        if not result:
            return 0
        return int(result[0].get("count(*)", 0))

    def search(self, vector: list[float], top_k: int) -> list[dict[str, Any]]:
        if not self.client.has_collection(self.collection_name):
            return []
        # Milvus releases collections when the server stops. Reload it lazily so
        # a normal service restart does not make the first search fail.
        self.client.load_collection(collection_name=self.collection_name)
        hits = self.client.search(
            collection_name=self.collection_name,
            data=[vector],
            limit=top_k,
            output_fields=OUTPUT_FIELDS,
            search_params={"metric_type": self.metric_type, "params": {"ef": 64}},
        )
        if not hits:
            return []

        documents: list[dict[str, Any]] = []
        for hit in hits[0]:
            entity = hit.get("entity") or {}
            item = {field: entity.get(field) for field in OUTPUT_FIELDS}
            item["chunk_id"] = item.get("chunk_id") or hit.get("id")
            item["vector_score"] = float(hit.get("distance", 0.0) or 0.0)
            documents.append(item)
        return documents


@lru_cache(maxsize=1)
def get_milvus_store() -> MilvusKnowledgeStore:
    return MilvusKnowledgeStore()
