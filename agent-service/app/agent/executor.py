from functools import lru_cache

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import knowledge_search
from app.config import get_settings


@lru_cache(maxsize=1)
def get_agent_executor():
    """Create a LangChain tool-calling Agent backed by DeepSeek's OpenAI-compatible API."""
    # Configure the Hugging Face cache before importing model-adjacent
    # libraries; some dependencies snapshot these environment values at import.
    settings = get_settings()

    from langchain.agents import AgentExecutor, create_tool_calling_agent
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

    if not settings.deepseek_api_key:
        raise RuntimeError("DEEPSEEK_API_KEY 未配置")

    extra_body = {}
    if settings.deepseek_thinking_enabled:
        # DeepSeek's thinking flag is a provider-specific JSON field. LangChain's
        # OpenAI adapter must send it through extra_body rather than as a Python kwarg.
        extra_body["thinking"] = {"type": "enabled"}

    llm = ChatOpenAI(
        model=settings.deepseek_model,
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
        temperature=0.45,
        streaming=True,
        reasoning_effort=settings.deepseek_reasoning_effort or None,
        extra_body=extra_body or None,
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ]
    )
    agent = create_tool_calling_agent(llm, [knowledge_search], prompt)
    return AgentExecutor(
        agent=agent,
        tools=[knowledge_search],
        verbose=False,
        handle_parsing_errors=True,
        return_intermediate_steps=False,
    )
