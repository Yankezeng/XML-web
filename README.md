# AI 通识局（XML-web）

面向大众的 AI 科普网站，包含响应式网页、互动时间轴、知识卡片、案例、测试题，以及可检索站内资料的流式知识库助手。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Yankezeng/XML-web)

## 功能

- AI 发展历史横向时间轴与响应式布局
- 机器学习、多模态、大语言模型、提示词和智能体知识卡片
- 工具筛选、案例轮播、一分钟 AI 边界测试与 Canvas 互动效果
- “AI 通识局知识导览员”角色化问答
- 站内资料检索、SSE 流式输出、检索进度和来源展示
- 桌面端和移动端适配

## 项目结构

```text
.
├─ index.html                         前端页面
├─ styles.css                         样式和响应式布局
├─ scripts.js                         页面交互与聊天流消费
├─ Figure/                            时间轴图示
├─ agent-service/
│  ├─ app/                            FastAPI、Agent 与检索代码
│  ├─ knowledge/raw/                  随部署发布的知识文档
│  ├─ requirements-render.txt         Render 轻量依赖
│  └─ requirements.txt                本地 Milvus+BGE 完整依赖
└─ render.yaml                        Render Blueprint
```

## Render 部署

仓库内的 `render.yaml` 会创建一个 Python Web Service。服务同时托管网页与 `/api/v1/chat`，不需要单独配置前端地址或 CORS。

1. 点击上方 **Deploy to Render**。
2. 登录 Render，选择创建 Blueprint。
3. Render 提示填写 `DEEPSEEK_API_KEY` 时，粘贴密钥并保存。
4. 等待构建完成，打开 Render 分配的 `onrender.com` 地址。

`DEEPSEEK_API_KEY` 在 Blueprint 中使用 `sync: false`，只存放在 Render Secret 环境变量中，不会写入 GitHub、网页 JavaScript 或构建日志。不要把密钥填进 `render.yaml` 或提交 `.env`。

Render 默认使用 `RAG_BACKEND=lexical`：它直接检索 `knowledge/raw/` 中的 Markdown 资料，不需要下载 BGE 模型或运行 Milvus，因此适合 Render 免费/低配实例。首次访问休眠中的免费服务时，Render 可能需要几十秒唤醒。

## 本地运行

完整本地模式使用 Milvus Lite、BGE Embedding 和 BGE Reranker，配置说明见 [agent-service/README.md](agent-service/README.md)。网页与 API 分别启动后访问：

```text
http://127.0.0.1:8000/index.html
```

也可以模拟 Render 的轻量单服务模式：

```powershell
$env:RAG_BACKEND = "lexical"
uvicorn app.main:app --app-dir agent-service --host 127.0.0.1 --port 8001
```

然后访问 `http://127.0.0.1:8001/`。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | 是 | 无 | DeepSeek API 密钥，仅配置在服务端 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | OpenAI-compatible API 地址 |
| `DEEPSEEK_MODEL` | 否 | `deepseek-flash` | 对话模型 |
| `RAG_BACKEND` | 否 | `milvus` | 本地用 `milvus`，Render 用 `lexical` |
| `CHAT_RATE_LIMIT_PER_MINUTE` | 否 | `12` | 单一客户端每分钟聊天请求上限 |

## 安全

- 根目录和后端目录的 `.gitignore` 均排除了 `.env`、模型缓存、Milvus 数据和运行日志。
- 前端仅能访问 `index.html`、CSS、JavaScript与 `Figure/`，后端源码和配置目录不会被静态托管。
- 后端错误会记录在服务端，对浏览器只返回脱敏提示。
- 公共聊天接口启用了基础频率限制，降低 API Key 被间接滥用的风险。

## 技术栈

HTML、CSS、原生 JavaScript、FastAPI、LangChain、DeepSeek API。Render 使用内置中文词法检索；本地完整模式可使用 Milvus Lite、BGE Embedding 与 BGE Reranker。
