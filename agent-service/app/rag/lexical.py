import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

from app.config import get_settings

LATIN_TOKEN = re.compile(r"[a-z0-9]+(?:[-_.][a-z0-9]+)*", re.IGNORECASE)
CJK_RUN = re.compile(r"[\u4e00-\u9fff]+")
HEADING = re.compile(r"^(#{1,2})\s+(.+?)\s*$")
QUERY_FILLERS = (
    "不用术语",
    "通俗地",
    "简单地",
    "请告诉我",
    "告诉我",
    "请问",
    "有什么区别",
    "有何区别",
    "区别是什么",
    "什么是",
    "是什么",
    "是怎么",
    "怎么理解",
    "如何理解",
    "一步步",
    "到今天",
    "解释一下",
    "讲一讲",
    "讲讲",
    "的",
)


def tokenize(text: str) -> list[str]:
    normalized = text.lower()
    tokens = LATIN_TOKEN.findall(normalized)
    for run in CJK_RUN.findall(normalized):
        if len(run) == 1:
            tokens.append(run)
            continue
        tokens.extend(run[index : index + 2] for index in range(len(run) - 1))
    return tokens


def tokenize_query(query: str) -> list[str]:
    normalized = query.lower()
    for filler in QUERY_FILLERS:
        normalized = normalized.replace(filler, " ")
    return tokenize(normalized)


class LexicalKnowledgeRetriever:
    """Small, dependency-free retriever used by memory-constrained deployments."""

    def __init__(self) -> None:
        knowledge_dir = Path(__file__).resolve().parents[2] / "knowledge" / "raw"
        self.documents = self._load_documents(knowledge_dir)
        self.term_counts: list[Counter[str]] = []
        self.document_frequency: Counter[str] = Counter()

        for document in self.documents:
            weighted_text = " ".join(
                [
                    str(document["title"]),
                    str(document["title"]),
                    str(document["section"]),
                    str(document["section"]),
                    str(document["content"]),
                ]
            )
            counts = Counter(tokenize(weighted_text))
            self.term_counts.append(counts)
            self.document_frequency.update(counts.keys())

        lengths = [sum(counts.values()) for counts in self.term_counts]
        self.average_length = sum(lengths) / len(lengths) if lengths else 1.0

    @staticmethod
    def _load_documents(knowledge_dir: Path) -> list[dict[str, Any]]:
        documents: list[dict[str, Any]] = []
        for path in sorted(knowledge_dir.glob("*.md")):
            title = path.stem
            section = title
            body: list[str] = []
            section_index = 0

            def append_section() -> None:
                nonlocal section_index
                content = "\n".join(body).strip()
                if not content:
                    return
                documents.append(
                    {
                        "doc_id": path.stem,
                        "chunk_id": f"{path.stem}-{section_index:03d}",
                        "title": title,
                        "section": section,
                        "source": f"knowledge/raw/{path.name}",
                        "page": -1,
                        "content": content,
                        "version": "bundled",
                    }
                )
                section_index += 1

            for line in path.read_text(encoding="utf-8").splitlines():
                match = HEADING.match(line)
                if match and match.group(1) == "#":
                    title = match.group(2)
                    section = title
                    continue
                if match and match.group(1) == "##":
                    append_section()
                    body.clear()
                    section = match.group(2)
                    continue
                body.append(line)
            append_section()
        return documents

    def search(self, query: str, final_k: int | None = None) -> list[dict[str, Any]]:
        query_counts = Counter(tokenize_query(query))
        if not query_counts or not self.documents:
            return []

        document_count = len(self.documents)
        scored: list[tuple[float, dict[str, Any]]] = []
        k1 = 1.5
        b = 0.72

        for document, counts in zip(self.documents, self.term_counts):
            document_length = max(sum(counts.values()), 1)
            score = 0.0
            for term, query_frequency in query_counts.items():
                frequency = counts.get(term, 0)
                if not frequency:
                    continue
                frequency_in_documents = self.document_frequency[term]
                inverse_frequency = math.log(
                    1 + (document_count - frequency_in_documents + 0.5)
                    / (frequency_in_documents + 0.5)
                )
                saturation = frequency + k1 * (
                    1 - b + b * document_length / self.average_length
                )
                score += (
                    inverse_frequency
                    * frequency
                    * (k1 + 1)
                    / saturation
                    * (1 + math.log(query_frequency))
                )

            if score <= 0:
                continue
            result = dict(document)
            result["rerank_score"] = score / (score + 5.0)
            result["vector_score"] = result["rerank_score"]
            scored.append((score, result))

        scored.sort(key=lambda item: item[0], reverse=True)
        limit = final_k or get_settings().rag_final_k
        return [document for _, document in scored[:limit]]
