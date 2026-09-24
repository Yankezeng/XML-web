import json
import logging
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from time import monotonic

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage

from app.agent.executor import get_agent_executor
from app.config import get_settings
from app.schemas.chat import ChatRequest

router = APIRouter(prefix="/api/v1", tags=["chat"])
logger = logging.getLogger(__name__)
request_windows: dict[str, deque[float]] = defaultdict(deque)


def sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") in {"text", "output_text"}:
                parts.append(str(block.get("text", "")))
        return "".join(parts)
    return str(content or "")


def extract_reasoning(chunk) -> str:
    """Read reasoning tokens across OpenAI-compatible chunk shapes."""
    candidates = [
        getattr(chunk, "reasoning_content", None),
        (getattr(chunk, "additional_kwargs", {}) or {}).get("reasoning_content"),
        (getattr(chunk, "additional_kwargs", {}) or {}).get("reasoning"),
        (getattr(chunk, "response_metadata", {}) or {}).get("reasoning_content"),
        (getattr(chunk, "response_metadata", {}) or {}).get("reasoning"),
    ]
    for value in candidates:
        if value:
            return str(value)

    content = getattr(chunk, "content", None)
    if not isinstance(content, list):
        return ""
    parts = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") not in {"reasoning", "reasoning_content", "thinking"}:
            continue
        parts.append(
            str(
                block.get("reasoning_content")
                or block.get("reasoning")
                or block.get("text")
                or block.get("summary")
                or ""
            )
        )
    return "".join(parts)


def history_messages(request: ChatRequest):
    messages = []
    for item in request.history:
        if item.role == "user":
            messages.append(HumanMessage(content=item.content))
        else:
            additional_kwargs = {}
            if item.reasoning_content:
                additional_kwargs["reasoning_content"] = item.reasoning_content
            messages.append(AIMessage(content=item.content, additional_kwargs=additional_kwargs))
    return messages


def enforce_rate_limit(request: Request) -> None:
    limit = get_settings().chat_rate_limit_per_minute
    if limit <= 0:
        return

    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_key = forwarded_for.split(",", 1)[0].strip()
    if not client_key:
        client_key = request.client.host if request.client else "unknown"

    now = monotonic()
    window = request_windows[client_key]
    while window and now - window[0] >= 60:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试。")
    window.append(now)


async def stream_agent(request: ChatRequest) -> AsyncIterator[str]:
    try:
        settings = get_settings()
        emitted_statuses = {"我先顺着你的问题想一想。\n"}
        emitted_sources: set[tuple[str, str, str, int | None]] = set()
        yield sse("reasoning", {"text": "我先顺着你的问题想一想。\n"})
        executor = get_agent_executor()
        inputs = {
            "input": request.message,
            "chat_history": history_messages(request),
        }
        async for event in executor.astream_events(inputs, version="v2"):
            event_name = event.get("event", "")
            event_target = event.get("name", "")
            data = event.get("data") or {}

            if event_name == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk is None:
                    continue
                reasoning = extract_reasoning(chunk)
                if reasoning:
                    yield sse("reasoning", {"text": reasoning})
                text = extract_text(getattr(chunk, "content", ""))
                if text:
                    yield sse("token", {"text": text})

            elif event_name == "on_tool_start" and event_target == "knowledge_search":
                status = "我去 AI 通识局的资料里翻一下相关内容。\n"
                if status not in emitted_statuses:
                    emitted_statuses.add(status)
                    yield sse("reasoning", {"text": status})

            elif event_name == "on_tool_end" and event_target == "knowledge_search":
                output = data.get("output")
                raw = getattr(output, "content", output)
                try:
                    parsed = json.loads(raw) if isinstance(raw, str) else raw
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, dict):
                    for document in parsed.get("documents", []):
                        source_key = (
                            document.get("title", ""),
                            document.get("section", ""),
                            document.get("source", ""),
                            document.get("page"),
                        )
                        if (
                            source_key in emitted_sources
                            or len(emitted_sources) >= settings.rag_final_k
                        ):
                            continue
                        emitted_sources.add(source_key)
                        yield sse(
                            "source",
                            {
                                "title": document.get("title", ""),
                                "section": document.get("section", ""),
                                "source": document.get("source", ""),
                                "page": document.get("page"),
                                "score": document.get("score", 0.0),
                            },
                        )
                status = "找到了几处相关内容，我把它们合在一起，挑重点讲给你。\n"
                if status not in emitted_statuses:
                    emitted_statuses.add(status)
                    yield sse("reasoning", {"text": status})

        yield sse("done", {"session_id": request.session_id})
    except Exception as exc:
        message = str(exc)
        logger.exception("Knowledge agent request failed")
        lowered = message.lower()
        if "deepseek_api_key" in lowered:
            message = "知识助手尚未配置模型访问密钥。"
        elif "connection error" in lowered or "connect" in lowered:
            message = "模型服务暂时无法连接，请稍后重试。"
        elif "milvus" in lowered:
            settings = get_settings()
            message = (
                "Milvus 尚未连接。请先启动 Milvus，并确认 "
                f"{settings.milvus_host}:{settings.milvus_port} 可访问。"
            )
        else:
            message = "知识助手暂时遇到问题，请稍后重试。"
        yield sse("error", {"message": message})


@router.post("/chat")
async def chat(payload: ChatRequest, request: Request):
    enforce_rate_limit(request)
    return StreamingResponse(
        stream_agent(payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
