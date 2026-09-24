# Knowledge Agent 服务

这是网页知识库助手的 FastAPI 后端，通过 DeepSeek 的 OpenAI-compatible API 接入大语言模型。它支持两种检索后端：本地完整模式使用 Milvus + BGE Embedding/Rerank，Render 使用轻量词法检索。

## 当前配置

- Embedding：`BAAI/bge-large-zh-v1.5`，1024 维
- Rerank：`BAAI/bge-reranker-v2-m3`
- LLM：DeepSeek，默认模型 `deepseek-flash`
- 向量库：Milvus，Collection `knowledge_chunks`
- 管理界面：Attu（只用于管理 Milvus，不接入浏览器）
- 接口：`POST /api/v1/chat`，SSE 流式返回

## Render 轻量模式

Render 部署由仓库根目录的 `render.yaml` 管理，并设置 `RAG_BACKEND=lexical`。该模式直接读取 `knowledge/raw/*.md`，不安装 PyTorch、BGE 或 Milvus，适合内存较小的托管实例。

`DEEPSEEK_API_KEY` 必须在 Render 的 Secret 环境变量中填写，不能写入代码或提交 `.env`。

## Windows 本机 Milvus Lite

本项目使用 Windows 本机的 Milvus Lite gRPC 服务，不依赖 Docker 或 WSL。由于 `19530` 已被系统服务占用，服务端口固定为 `19531`，数据文件位于网页目录下的 `milvus-data/`。

启动服务：

```powershell
.\scripts\start_milvus_lite.ps1
```

Attu 连接参数：`127.0.0.1:19531`，数据库名 `default`。

## 本地准备

1. 复制 `.env.example` 为 `.env`，稍后填入 `DEEPSEEK_API_KEY`。
2. 将 PDF、DOCX、Markdown 或 TXT 文件放入 `knowledge/raw/`。
3. 在已经运行的 Milvus 上执行：

```powershell
python scripts/ingest.py
```

4. 启动 API：

```powershell
uvicorn app.main:app --reload --port 8001
```

健康检查：`http://127.0.0.1:8001/health`

前端联调时，在网页 `scripts.js` 之前增加：

```html
<script>window.KNOWLEDGE_AGENT_API_URL = "http://127.0.0.1:8001/api/v1/chat";</script>
```

未设置这个变量时，网页继续使用内置模拟流式响应；设置后会切换到真实 SSE 接口。

## SSE 事件

```text
event: reasoning   data: {"text":"..."}
event: token       data: {"text":"..."}
event: source      data: {"title":"...","source":"...","page":1}
event: done        data: {"session_id":"..."}
event: error       data: {"message":"..."}
```

前端的 `agent-thinking-output`、`agent-answer-output` 和 `agent-sources` 可以分别消费这些事件。

## 说明

- DeepSeek API Key 只放在本地 `.env` 或托管平台的 Secret 环境变量中，不要写入网页 JavaScript。
- `data.xml` 不参与此服务的知识库流程。
