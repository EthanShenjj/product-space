import hashlib
import json
import os
import re
from datetime import datetime
from typing import Iterable

import requests

ROOT = "/Users/vivi/Documents/产品思考工具"
KB_DIR = os.path.join(ROOT, "产品知识库")
FRONTEND_CARDS = os.path.join(ROOT, "frontend", "src", "data", "cards.auto.json")
CACHE_FILE = os.path.join(ROOT, "backend", ".sparks_summary_cache.json")
CONFIG_FILE = os.path.join(ROOT, "backend", "sparks_sources.json")

# 从环境变量加载 API 配置（优先 Gemini，其次 OpenRouter）
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_API_BASE = os.environ.get("GEMINI_API_BASE", "")
GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

# 尝试加载 .env 文件
try:
    from dotenv import load_dotenv
    base_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(base_dir, ".env"))
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", GEMINI_API_KEY)
    GEMINI_API_BASE = os.environ.get("GEMINI_API_BASE", GEMINI_API_BASE)
    GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", GEMINI_CHAT_MODEL)
    OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", OPENROUTER_API_KEY)
except ImportError:
    pass

ESSENTIAL_DIRS = [
    "01-产品与设计",
    "02-商业与战略",
    "03-思维与认知",
    "04-成长与效能",
    "05-技术与AI",
    "06-其他",
]

CATEGORY_MAP = {
    "01-产品与设计": "产品与设计",
    "02-商业与战略": "商业与战略",
    "03-思维与认知": "思维与认知",
    "04-成长与效能": "成长与效能",
    "05-技术与AI": "技术与AI",
    "06-其他": "其他",
}

SOURCE_RE = re.compile(r"^\s*来源[:：]\s*(.+)\s*$")
HEADING_RE = re.compile(r"^\s*#{1,6}\s+(.*)$")
H2_RE = re.compile(r"^\s*##\s+(.*)$")


def read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def first_heading(text: str) -> str | None:
    for line in text.splitlines():
        m = HEADING_RE.match(line)
        if m:
            title = m.group(1).strip()
            if title:
                return title
    return None


def find_source(text: str, _fallback: str) -> str:
    for line in text.splitlines():
        m = SOURCE_RE.match(line)
        if m:
            return m.group(1).strip()
    return ""


def extract_summary(text: str) -> str:
    lines = [ln.strip() for ln in text.splitlines()]
    # Prefer "核心观点" section bullets
    for i, line in enumerate(lines):
        if re.match(r"^##+\s*核心观点", line):
            bullets = []
            for j in range(i + 1, min(i + 30, len(lines))):
                item = lines[j]
                if item.startswith("#"):
                    break
                if item.startswith("-") or item.startswith("•") or item.startswith("* "):
                    bullets.append(item.lstrip("-*• ").strip())
                if len(bullets) >= 3:
                    break
            if bullets:
                return "；".join(bullets[:2])

    # Fallback: first non-empty paragraph line
    for line in lines:
        if not line:
            continue
        if line.startswith("来源"):
            continue
        if line.startswith("#"):
            continue
        # skip list markers and quote markers
        if line.startswith(('-', '•', '*', '>')):
            line = line.lstrip('-•*> ').strip()
        if line:
            return line[:140]

    return "暂无明确结论"


def extract_keywords(text: str, limit: int = 4) -> list[str]:
    keywords: list[str] = []
    for line in text.splitlines():
        if line.strip().startswith(("-", "•", "*")):
            candidate = line.lstrip("-•* ").strip()
            if 2 <= len(candidate) <= 10:
                keywords.append(candidate)
        if len(keywords) >= limit:
            break
    return keywords


def tags_from_title(title: str) -> list[str]:
    parts = re.split(r"[\\s\\-—：:·,，/]+", title)
    tags = [p for p in parts if 1 < len(p) <= 6]
    return tags[:3]


def build_tags(category: str, title: str, text: str) -> list[str]:
    tags = [category, "精华"]
    tags.extend(tags_from_title(title))
    tags.extend(extract_keywords(text))
    # De-duplicate while preserving order
    seen = set()
    unique: list[str] = []
    for tag in tags:
        clean = tag.strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        unique.append(clean)
    return unique[:6]


def truncate_title(text: str, limit: int = 30) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip("，。；,;:： ")


def clean_markdown(text: str) -> str:
    cleaned_lines = []
    for line in text.splitlines():
        # Drop markdown headings like ## Title
        line = re.sub(r"^\s*#{1,6}\s+", "", line).strip()
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def load_cache() -> dict[str, str]:
    if not os.path.exists(CACHE_FILE):
        return {}
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_cache(cache: dict[str, str]) -> None:
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def call_llm_summary(text: str, api_key: str) -> str:
    prompt = (
        "请把下面内容提炼成 1-2 句中文知识卡片摘要，要求清晰、可读、可执行，"
        "不要列表，不要引用，不要 markdown。\n\n内容：\n" + text[:4000]
    )

    # 优先使用 Gemini OpenAI 兼容接口
    if GEMINI_API_KEY and GEMINI_API_BASE:
        model = GEMINI_CHAT_MODEL
        base_url = GEMINI_API_BASE.rstrip("/") + "/chat/completions"
        headers = {
            "Authorization": f"Bearer {GEMINI_API_KEY}",
            "Content-Type": "application/json",
        }
    elif api_key:
        # OpenRouter fallback
        model = "anthropic/claude-3.5-sonnet"
        base_url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.environ.get("APP_URL", "http://localhost:3002"),
            "X-Title": "ProductThink",
        }
    else:
        return ""

    response = requests.post(
        base_url,
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": "你是知识卡片写作者，输出简洁中文摘要。"},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "").strip()


def summarize_card(text: str, cache: dict[str, str]) -> str:
    api_key = GEMINI_API_KEY or OPENROUTER_API_KEY
    key = hashlib.md5(text.encode("utf-8")).hexdigest()
    if key in cache:
        return cache[key]
    if not api_key:
        return extract_summary(text)
    try:
        summary = call_llm_summary(text, api_key)
        if not summary:
            summary = extract_summary(text)
    except Exception:
        summary = extract_summary(text)
    cache[key] = summary
    return summary


def split_sections(text: str) -> list[tuple[str, str]]:
    """Return list of (section_title, section_body)."""
    sections: list[tuple[str, str]] = []
    current_title = ""
    current_lines: list[str] = []

    def flush():
        nonlocal current_title, current_lines
        body = "\n".join(current_lines).strip()
        if current_title or body:
            sections.append((current_title.strip(), body))
        current_title = ""
        current_lines = []

    for line in text.splitlines():
        h2 = H2_RE.match(line)
        if h2:
            flush()
            current_title = h2.group(1).strip()
            continue
        current_lines.append(line)

    flush()
    return sections


def extract_bullets(text: str, limit: int = 8) -> list[str]:
    bullets = []
    for line in text.splitlines():
        if line.strip().startswith(("-", "•", "*")):
            item = line.lstrip("-•* ").strip()
            if item:
                bullets.append(item)
        if len(bullets) >= limit:
            break
    return bullets


def build_cards_from_text(
    path: str,
    rel_path: str,
    category: str,
    title: str,
    text: str,
    cache: dict[str, str],
) -> Iterable[dict]:
    source = find_source(text, rel_path)
    sections = split_sections(text)

    # Prefer: each bullet under “核心观点” becomes a card
    for sec_title, sec_body in sections:
        if "核心观点" in sec_title:
            for bullet in extract_bullets(sec_body, limit=12):
                content = summarize_card(bullet, cache)
                card_title = truncate_title(bullet.strip("。；；,，:："))
                tags = build_tags(category, card_title, bullet)
                yield {
                    "id": make_id(f"{rel_path}#{card_title}"),
                    "title": card_title,
                    "category": category,
                    "content": content,
                    "author": "内部整理",
                    "source": f"{source} · 核心观点" if source else "",
                    "tags": tags,
                    "fullArticle": clean_markdown(bullet),
                    "updatedAt": datetime.fromtimestamp(os.path.getmtime(path)).isoformat(timespec="seconds"),
                }

    # Fallback: split by H2 sections
    for sec_title, sec_body in sections:
        if not sec_title or "核心观点" in sec_title:
            continue
        if not sec_body.strip():
            continue
        section_text = sec_body.strip()
        content = summarize_card(section_text, cache)
        title_base = sec_title or title
        card_title = truncate_title(title_base)
        tags = build_tags(category, title_base, section_text)
        yield {
            "id": make_id(f"{rel_path}#{sec_title or title}"),
            "title": card_title,
            "category": category,
            "content": content,
            "author": "内部整理",
            "source": source,
            "tags": tags,
            "fullArticle": clean_markdown(section_text[:4000]),
            "updatedAt": datetime.fromtimestamp(os.path.getmtime(path)).isoformat(timespec="seconds"),
        }


def load_config() -> dict:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def lenny_summary_cards(cache: dict[str, str]) -> list[dict]:
    path = os.path.join(ROOT, "backend", "knowledge", "lenny_podcast_essentials.md")
    if not os.path.exists(path):
        return []

    text = read_text(path)
    rel_path = "backend/knowledge/lenny_podcast_essentials.md"
    title = first_heading(text) or "Lenny 播客精华"
    cards = []
    for card in build_cards_from_text(
        path=path,
        rel_path=rel_path,
        category="播客精华",
        title=title,
        text=text,
        cache=cache,
    ):
        card["author"] = "Lenny's Podcast"
        if not card.get("source"):
            card["source"] = "Lenny 播客精华"
        card["tags"] = ["播客精华", "Lenny", *card.get("tags", [])]
        cards.append(card)
    return cards


def org_evolution_cards(org_dir: str) -> list[dict]:
    if not org_dir:
        return []
    base = org_dir
    if not os.path.isabs(base):
        base = os.path.join(KB_DIR, base)
    if not os.path.isdir(base):
        return []

    cards: list[dict] = []
    for root, _dirs, files in os.walk(base):
        for name in files:
            if not (name.endswith(".md") or name.endswith(".txt")):
                continue
            path = os.path.join(root, name)
            rel_path = os.path.relpath(path, KB_DIR)
            try:
                text = read_text(path)
            except Exception:
                continue
            title = first_heading(text) or os.path.splitext(name)[0]
            title = truncate_title(title)
            cards.append({
                "id": make_id(f"org_evolution::{rel_path}"),
                "title": title,
                "category": "组织进化论",
                "content": title,
                "author": "组织进化论",
                "source": "",
                "tags": ["组织进化论"],
                "fullArticle": clean_markdown(text[:4000]),
                "updatedAt": datetime.fromtimestamp(os.path.getmtime(path)).isoformat(timespec="seconds"),
            })
    return cards


def make_id(path: str) -> str:
    return hashlib.md5(path.encode("utf-8")).hexdigest()[:12]


def main() -> None:
    cards: list[dict] = []
    cache = load_cache()
    config = load_config()
    approved = config.get("approved", [])
    org_dir = config.get("org_evolution_dir", "")

    cards.extend(lenny_summary_cards(cache))

    cards.extend(org_evolution_cards(org_dir))

    for rel_path in approved:
        path = os.path.join(KB_DIR, rel_path)
        if not os.path.exists(path):
            continue
        try:
            text = read_text(path)
        except Exception:
            continue
        title = first_heading(text) or os.path.splitext(os.path.basename(path))[0]
        subdir = rel_path.split("/", 1)[0] if "/" in rel_path else ""
        category = CATEGORY_MAP.get(subdir, "其他")
        cards.extend(
            build_cards_from_text(
                path=path,
                rel_path=rel_path,
                category=category,
                title=title,
                text=text,
                cache=cache,
            )
        )

    # Newest first
    cards.sort(key=lambda c: c.get("updatedAt", ""), reverse=True)

    os.makedirs(os.path.dirname(FRONTEND_CARDS), exist_ok=True)
    with open(FRONTEND_CARDS, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=4)

    save_cache(cache)
    print(f"Generated {len(cards)} cards -> {FRONTEND_CARDS}")


if __name__ == "__main__":
    main()
