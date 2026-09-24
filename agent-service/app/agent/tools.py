import json

from langchain_core.tools import tool

from app.rag.retriever import get_retriever


@tool
def knowledge_search(query: str) -> str:
    """在 AI 通识局知识库中检索相关文档片段，并返回来源信息。"""
    documents = get_retriever().search(query)
    if not documents:
        return json.dumps({"documents": [], "message": "知识库中暂无足够信息"}, ensure_ascii=False)

    payload = []
    for item in documents:
        payload.append(
            {
                "content": item.get("content", ""),
                "title": item.get("title", ""),
                "section": item.get("section", ""),
                "source": item.get("source", ""),
                "page": item.get("page"),
                "version": item.get("version", ""),
                "score": item.get("rerank_score", 0.0),
            }
        )
    return json.dumps({"documents": payload}, ensure_ascii=False)
