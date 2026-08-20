import os
import time
import functools
from typing import List, Dict
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.language_models import BaseChatModel
from langchain_community.tools.tavily_search import TavilySearchResults
from langgraph.graph import StateGraph, END
from db import retrieve_knowledge
from dotenv import load_dotenv

load_dotenv()

# 支持 Gemini / OpenRouter / OpenAI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_BASE = os.getenv("GEMINI_API_BASE")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class RateLimitedLLM:
    """Wrap an LLM with rate-limit retry for Gemini free tier (5 RPM for chat).

    Delegates attribute access to the underlying LLM so that methods like
    `with_structured_output()` still work transparently.
    """

    def __init__(self, llm: BaseChatModel, max_retries: int = 5, base_delay: float = 12.0):
        self._llm = llm
        self._max_retries = max_retries
        self._base_delay = base_delay

    def invoke(self, *args, **kwargs):
        for attempt in range(self._max_retries):
            try:
                return self._llm.invoke(*args, **kwargs)
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    wait_time = self._base_delay * (attempt + 1)
                    print(f"  ⏳ LLM 速率限制，等待 {wait_time:.0f}s 后重试 ({attempt + 1}/{self._max_retries})...")
                    time.sleep(wait_time)
                    continue
                raise
        return self._llm.invoke(*args, **kwargs)

    # Rate-limited: delegate
    def stream(self, *args, **kwargs):
        for attempt in range(self._max_retries):
            try:
                yield from self._llm.stream(*args, **kwargs)
                return
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    wait_time = self._base_delay * (attempt + 1)
                    print(f"  ⏳ LLM 速率限制（stream），等待 {wait_time:.0f}s 后重试 ({attempt + 1}/{self._max_retries})...")
                    time.sleep(wait_time)
                    continue
                raise
        yield from self._llm.stream(*args, **kwargs)

    def __getattr__(self, name):
        """Delegate everything else to the underlying LLM (e.g. with_structured_output)."""
        attr = getattr(self._llm, name)
        if callable(attr) and name == "with_structured_output":
            # Wrap the result so invoke/ainvoke also get rate-limited
            @functools.wraps(attr)
            def wrapper(*args, **kwargs):
                result = attr(*args, **kwargs)
                return _RateLimitedRunnable(result, self._max_retries, self._base_delay)
            return wrapper
        return attr


class _RateLimitedRunnable:
    """Rate-limit wrapper for structured-output runnables returned by with_structured_output."""

    def __init__(self, runnable, max_retries: int = 5, base_delay: float = 12.0):
        self._runnable = runnable
        self._max_retries = max_retries
        self._base_delay = base_delay

    def invoke(self, *args, **kwargs):
        for attempt in range(self._max_retries):
            try:
                return self._runnable.invoke(*args, **kwargs)
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    wait_time = self._base_delay * (attempt + 1)
                    print(f"  ⏳ LLM 速率限制，等待 {wait_time:.0f}s 后重试 ({attempt + 1}/{self._max_retries})...")
                    time.sleep(wait_time)
                    continue
                raise
        return self._runnable.invoke(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._runnable, name)


def get_llm():
    """Returns the LLM, supporting Gemini, OpenRouter and OpenAI."""
    if GEMINI_API_KEY:
        # 使用 Google Gemini（OpenAI 兼容接口）
        llm = ChatOpenAI(
            model=GEMINI_CHAT_MODEL,
            temperature=0.7,
            openai_api_key=GEMINI_API_KEY,
            openai_api_base=GEMINI_API_BASE,
        )
        return RateLimitedLLM(llm)
    elif OPENROUTER_API_KEY:
        # 使用 OpenRouter - 可以选择不同的模型
        return ChatOpenAI(
            model="openai/gpt-4o",  # 或 "anthropic/claude-3.5-sonnet"
            temperature=0.7,
            openai_api_key=OPENROUTER_API_KEY,
            openai_api_base="https://openrouter.ai/api/v1"
        )
    elif OPENAI_API_KEY:
        # 直接使用 OpenAI
        return ChatOpenAI(model="gpt-4o", temperature=0.7)
    else:
        raise ValueError("请设置 GEMINI_API_KEY、OPENROUTER_API_KEY 或 OPENAI_API_KEY")

# --- State Definition ---
class AgentState(Dict):
    pitch: str
    pitch_type: str
    conversation_history: List[str]
    knowledge_context: str  # RAG 检索到的知识库内容

    # State flags
    skipped_questions: bool

    # Validation Results (The Board)
    pm_feedback: Dict[str, str]
    strategy_feedback: Dict[str, str]
    growth_feedback: Dict[str, str]
    tech_feedback: Dict[str, str]
    user_feedback: Dict[str, str]
    investor_feedback: Dict[str, str]

    # Output
    questions: List[str]
    verdict: str
    final_score: int
    summary: str
    similar_cases: List[str]

# --- Roles & Prompts ---

ROLES = {
    "pm": {
        "name": "Product Manager",
        "focus": "True Demand (The Mom Test)",
        "prompt": """You are a skeptical Product Manager using 'The Mom Test'. 
        Analyze if this is a real burning problem or just a 'nice to have'. 
        Critique the frequency and intensity of the pain point.
        Output JSON: {"vote": "RED"|"GREEN"|"YELLOW", "comment": "Contextual feedback..."}"""
    },
    "strategy": {
        "name": "Strategy Consultant",
        "focus": "Moat & Competition (Zero to One)",
        "prompt": """You are a Strategy Consultant focused on 'Zero to One'. 
        Analyze the Moat (Defensibility) and Competition. Is it a monopoly or perfect competition?
        Output JSON: {"vote": "RED"|"GREEN"|"YELLOW", "comment": "Contextual feedback..."}"""
    },
    "growth": {
        "name": "Growth Hacker",
        "focus": "Distribution & Hooks",
        "prompt": """You are a Growth Hacker. 
        Analyze the 'Distribution Channels' and 'Hooks'. How does this spread virally?
        Output JSON: {"vote": "RED"|"GREEN"|"YELLOW", "comment": "Contextual feedback..."}"""
    },
    "tech": {
        "name": "Tech Architect",
        "focus": "Feasibility & Wrapper Risk",
        "prompt": """You are a Tech Architect in the Vibe Coding era.
        Analyze: 
        1. Wrapper Risk: Is this just a thin wrapper around OpenAI? 
        2. Feasibility: Is it too complex for current AI coding tools?
        Output JSON: {"vote": "RED"|"GREEN"|"YELLOW", "comment": "Contextual feedback..."}"""
    },
    "user": {
        "name": "User Simulator",
        "focus": "Experience & Friction",
        "prompt": """You are a cynical User who is lazy and busy.
        Analyze the Friction. Do you have to install something? Sign up? Copy paste?
        If it takes more than 3 seconds to get value, hate it.
        Output JSON: {"vote": "RED"|"GREEN"|"YELLOW", "comment": "Contextual feedback..."}"""
    },
    "investor": {
        "name": "Angel Investor",
        "focus": "ROI & Why Now",
        "prompt": """You are an Angel Investor.
        Analyze:
        1. Opportunity Cost: Is this worth a developer's time vs getting a job?
        2. Market Cap: Is the ceiling high enough?
        3. Why Now: Why hasn't Google done it?
        Output JSON: {"vote": "RED"|"GREEN"|"YELLOW", "comment": "Contextual feedback..."}"""
    }
}

llm = get_llm()

def run_role(state: AgentState, role_key: str):
    """Generic function to run a role's analysis with knowledge context."""
    pitch = state["pitch"]
    history = "\n".join(state.get("conversation_history", []))
    knowledge_context = state.get("knowledge_context", "")
    role_def = ROLES[role_key]

    print(f"DEBUG: {role_def['name']} is thinking...")

    msg = f"""
    Analyze this product idea as a {role_def['name']}.
    Focus on: {role_def['focus']}.

    PITCH: "{pitch}"
    CONTEXT FROM Q&A:
    {history}

    RELEVANT KNOWLEDGE FROM DATABASE:
    {knowledge_context if knowledge_context else "No relevant knowledge found."}

    Based on the knowledge above, provide your analysis. If there are relevant cases or principles, reference them.
    Strictly follow the JSON output format: {{"vote": "RED"|"GREEN"|"YELLOW", "comment": "..."}}
    RED = Fatal flaw / Hard stop.
    YELLOW = Concerns / Risky.
    GREEN = Looks good / Proceed.
    Keep comments punchy, cynical but helpful. Max 2-3 sentences. Include knowledge references if applicable.
    Always respond in Chinese.
    """

    # Using structured output for reliability
    structured_llm = llm.with_structured_output(method="json_mode")
    result = structured_llm.invoke(msg)

    # Handle list results (Gemini sometimes wraps output in an array)
    if isinstance(result, list):
        result = result[0] if result else {}
    # Fallback if result is string
    if isinstance(result, str):
         import json
         try:
             result = json.loads(result)
             if isinstance(result, list):
                 result = result[0] if result else {}
         except:
             result = {"vote": "YELLOW", "comment": "系统解析反馈失败。"}

    print(f"DEBUG: {role_key} vote: {result.get('vote')}")
    return {f"{role_key}_feedback": result}

# --- Inquiry Node ---
def question_generator(state: AgentState):
    """Generates 3 critical clarifying questions."""
    print("DEBUG: Generating clarifying questions...")
    pitch = state["pitch"]
    
    prompt = f"""
    You are the Board of Directors (PM, Tech, Investor).
    The user has proposed a product idea. Before creating a verdict, you need to conduct a "Socratic Inquiry".
    
    PITCH: "{pitch}"
    
    Identify 3 most critical missing pieces of information that prevent a fair assessment.
    1. One about Users/Demand (PM)
    2. One about Implementation/Feasibility (Tech)
    3. One about Business/Strategy (Investor)
    
    Output a strictly formatted Python list of 3 strings. 
    Example: ["Who specifically is the user?", "How do you handle latency?", "Why now?"]
    """
    response = llm.invoke(prompt)
    try:
        questions = [line.strip('-" []') for line in response.content.split("\n") if "?" in line][:3]
    except:
        questions = ["Can you describe the specific user scenario?", "What is the technical implementation?", "How do you make money?"]
    
    return {"questions": questions, "verdict": "INQUIRY"}

# --- Moderator Node (Updates) ---
def node_moderator(state: AgentState):
    """Synthesizes the votes and decides the verdict."""
    print("DEBUG: Moderator aggregating votes...")
    feedbacks = [
        state.get("pm_feedback"),
        state.get("strategy_feedback"),
        state.get("growth_feedback"),
        state.get("tech_feedback"),
        state.get("user_feedback"),
        state.get("investor_feedback")
    ]
    feedbacks = [f for f in feedbacks if f] 
    
    red_cards = sum(1 for f in feedbacks if f.get("vote") == "RED")
    yellow_cards = sum(1 for f in feedbacks if f.get("vote") == "YELLOW")
    green_cards = sum(1 for f in feedbacks if f.get("vote") == "GREEN")
    
    total = len(feedbacks)
    raw_score = (green_cards * 100 + yellow_cards * 50) / (total if total > 0 else 1)
    score = int(raw_score)
        
    if red_cards >= 1:
        verdict = "BLOCKED"
        summary = "Round Table consensus: Significant risks detected. Proceed with extreme caution."
    elif score > 75:
        verdict = "APPROVED"
        summary = "Round Table consensus: Strong potential. Ready for execution."
    else:
        verdict = "WARNING"
        summary = "Round Table consensus: Viable but requires refinement."
        
    return {"verdict": verdict, "final_score": score, "summary": summary}

def node_knowledge(state: AgentState):
    """Retrieves relevant knowledge from the vector database."""
    pitch = state["pitch"]
    history = "\n".join(state.get("conversation_history", []))
    query = f"{pitch}\n{history}"

    print("DEBUG: Retrieving knowledge from database...")
    docs = retrieve_knowledge(query, k=5)

    if docs:
        knowledge_context = "\n\n---\n\n".join(docs)
        print(f"DEBUG: Found {len(docs)} relevant knowledge chunks")
    else:
        knowledge_context = ""
        print("DEBUG: No relevant knowledge found")

    return {"similar_cases": docs, "knowledge_context": knowledge_context}

# --- Router ---
def route_inquiry(state: AgentState):
    """Decides whether to ask questions or judge."""
    # If we already have history (answers) OR user explicitly skipped, we judge.
    if state.get("conversation_history") or state.get("skipped_questions"):
        return "judge"
    # Otherwise, we ask questions first.
    return "ask"

# --- Graph Construction ---
workflow = StateGraph(AgentState)

# Nodes
workflow.add_node("question_gen", question_generator)
workflow.add_node("knowledge", node_knowledge)  # 知识库检索节点
workflow.add_node("pm", lambda s: run_role(s, "pm"))
workflow.add_node("strategy", lambda s: run_role(s, "strategy"))
workflow.add_node("growth", lambda s: run_role(s, "growth"))
workflow.add_node("tech", lambda s: run_role(s, "tech"))
workflow.add_node("user", lambda s: run_role(s, "user"))
workflow.add_node("investor", lambda s: run_role(s, "investor"))
workflow.add_node("moderator", node_moderator)

def start_node(state: AgentState): return {}
workflow.add_node("start", start_node)
workflow.set_entry_point("start")

# Routing Logic
workflow.add_conditional_edges(
    "start",
    route_inquiry,
    {
        "ask": "question_gen",
        "judge": "knowledge"  # 先检索知识库
    }
)

# If asking, we stop after question_gen
workflow.add_edge("question_gen", END)

# 知识库检索后，进入 fan_out 节点
def fan_out_node(state: AgentState): return {}
workflow.add_node("fan_out", fan_out_node)

# 知识库检索完成后，进入 fan_out
workflow.add_edge("knowledge", "fan_out")

# 串行评审：每次只发一个 LLM 请求，避免触发 Gemini 免费版 5 RPM 限制
workflow.add_edge("fan_out", "pm")
workflow.add_edge("pm", "strategy")
workflow.add_edge("strategy", "growth")
workflow.add_edge("growth", "tech")
workflow.add_edge("tech", "user")
workflow.add_edge("user", "investor")
workflow.add_edge("investor", "moderator")

workflow.add_edge("moderator", END)

app = workflow.compile()
