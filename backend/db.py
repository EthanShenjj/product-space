import os
import time
from typing import List
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings
from dotenv import load_dotenv

load_dotenv()

# Persistence directory for the vector DB
DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")

# 支持 Gemini / OpenRouter / OpenAI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class RateLimitedEmbeddings(Embeddings):
    """Wrap embeddings with rate limiting and retry for Gemini free tier (100 RPM)."""

    def __init__(self, base_embeddings: Embeddings, max_retries: int = 5):
        self._base = base_embeddings
        self._max_retries = max_retries

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed documents with rate limit handling."""
        for attempt in range(self._max_retries):
            try:
                return self._base.embed_documents(texts)
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    wait_time = min(10 * (attempt + 1), 60)
                    print(f"  ⏳ 速率限制，等待 {wait_time}s 后重试 ({attempt + 1}/{self._max_retries})...")
                    time.sleep(wait_time)
                    continue
                raise
        return self._base.embed_documents(texts)

    def embed_query(self, text: str) -> List[float]:
        """Embed query with rate limit handling."""
        for attempt in range(self._max_retries):
            try:
                return self._base.embed_query(text)
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    wait_time = min(10 * (attempt + 1), 60)
                    print(f"  ⏳ 速率限制，等待 {wait_time}s 后重试 ({attempt + 1}/{self._max_retries})...")
                    time.sleep(wait_time)
                    continue
                raise
        return self._base.embed_query(text)


def get_embeddings():
    """Returns the embeddings model, supporting Gemini, OpenRouter and OpenAI."""
    if GEMINI_API_KEY:
        # 使用 Google Gemini Embedding（原生接口）
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        base = GoogleGenerativeAIEmbeddings(
            model=GEMINI_EMBEDDING_MODEL,
            google_api_key=GEMINI_API_KEY,
        )
        return RateLimitedEmbeddings(base)
    elif OPENROUTER_API_KEY:
        # 使用 OpenRouter 的 OpenAI 兼容接口
        return OpenAIEmbeddings(
            model="openai/text-embedding-3-small",
            openai_api_key=OPENROUTER_API_KEY,
            openai_api_base="https://openrouter.ai/api/v1"
        )
    elif OPENAI_API_KEY:
        # 直接使用 OpenAI
        return OpenAIEmbeddings(model="text-embedding-3-small")
    else:
        raise ValueError("请设置 GEMINI_API_KEY、OPENROUTER_API_KEY 或 OPENAI_API_KEY")

def get_vector_store():
    """Returns the ChromaDB vector store instance."""
    embeddings = get_embeddings()

    vector_store = Chroma(
        collection_name="product_wisdom",
        embedding_function=embeddings,
        persist_directory=DB_DIR,
    )
    return vector_store

def retrieve_knowledge(query: str, k: int = 3) -> List[str]:
    """Retrieves relevant knowledge from the vector store based on the query."""
    try:
        vector_store = get_vector_store()
        docs = vector_store.similarity_search(query, k=k)
        return [doc.page_content for doc in docs]
    except Exception as e:
        print(f"Knowledge retrieval error: {e}")
        return []
