"""将 knowledge/raw 下的 PDF、DOCX、Markdown、TXT 切分并写入 Milvus。

写入目标由 settings.milvus_uri 决定：

* 填了文件路径 -> 写入进程内嵌的 Milvus Lite，不需要 Docker；
* 留空       -> 写入 milvus_host:milvus_port 上的 Milvus 服务。
"""

import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import get_settings  # noqa: E402
from app.rag.embeddings import get_embedding_model  # noqa: E402
from app.rag.milvus_store import build_index_params, build_schema  # noqa: E402


def load_documents(raw_dir: Path):
    from langchain_community.document_loaders import (
        Docx2txtLoader,
        PyPDFLoader,
        TextLoader,
    )

    documents = []
    for path in sorted(raw_dir.rglob("*")):
        if not path.is_file():
            continue
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            documents.extend(PyPDFLoader(str(path)).load())
        elif suffix == ".docx":
            documents.extend(Docx2txtLoader(str(path)).load())
        elif suffix in {".md", ".markdown", ".txt"}:
            documents.extend(TextLoader(str(path), encoding="utf-8").load())
    return documents


def section_of(document) -> str:
    """Use the nearest preceding Markdown heading as the section label."""
    if document.metadata.get("section"):
        return str(document.metadata["section"])
    for line in document.page_content.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()
    return ""


def main() -> None:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from pymilvus import MilvusClient

    settings = get_settings()
    raw_dir = ROOT / "knowledge" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    source_documents = load_documents(raw_dir)
    if not source_documents:
        raise SystemExit(f"未找到待处理文档，请把文件放入：{raw_dir}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
    chunks = splitter.split_documents(source_documents)
    print(f"读取 {len(source_documents)} 个文档，切分为 {len(chunks)} 个知识片段")

    embedder = get_embedding_model()
    vectors = embedder.embed_documents([chunk.page_content for chunk in chunks])
    now = datetime.now(timezone.utc).isoformat()

    if settings.milvus_uri.strip():
        Path(settings.milvus_uri).expanduser().resolve().parent.mkdir(
            parents=True, exist_ok=True
        )
        client = MilvusClient(uri=settings.milvus_uri.strip())
        target = f"Milvus Lite ({settings.milvus_uri})"
        if client.has_collection(settings.milvus_collection):
            client.drop_collection(settings.milvus_collection)
        client.create_collection(
            collection_name=settings.milvus_collection,
            schema=build_schema(client),
            index_params=build_index_params(client, settings.milvus_metric),
        )
    else:
        client = MilvusClient(
            uri=f"http://{settings.milvus_host}:{settings.milvus_port}"
        )
        target = f"Milvus 服务 ({settings.milvus_host}:{settings.milvus_port})"
        if not client.has_collection(settings.milvus_collection):
            client.create_collection(
                collection_name=settings.milvus_collection,
                schema=build_schema(client),
                index_params=build_index_params(client, settings.milvus_metric),
            )

    rows = []
    for index, (chunk, vector) in enumerate(zip(chunks, vectors)):
        source = str(chunk.metadata.get("source", ""))
        doc_id = hashlib.sha1(source.encode("utf-8")).hexdigest()[:20]
        chunk_id = f"{doc_id}-{index:05d}"
        rows.append(
            {
                "id": chunk_id,
                "doc_id": doc_id,
                "chunk_id": chunk_id,
                "title": Path(source).stem,
                "section": section_of(chunk),
                "source": source,
                "page": int(chunk.metadata.get("page", -1) or -1),
                "content": chunk.page_content,
                "version": "initial",
                "created_at": now,
                "embedding": vector,
            }
        )

    client.insert(collection_name=settings.milvus_collection, data=rows)
    client.flush(settings.milvus_collection)
    total = client.query(
        collection_name=settings.milvus_collection,
        filter="",
        output_fields=["count(*)"],
    )
    print(
        f"已写入 {len(rows)} 个知识片段到 {target} 的 {settings.milvus_collection}，"
        f"当前总片段数 {total[0].get('count(*)') if total else 0}"
    )
    client.close()


if __name__ == "__main__":
    main()
