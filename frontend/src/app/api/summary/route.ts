import { NextRequest } from 'next/server';
import { createAICompletionJson } from '@/lib/ai-client';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const METASO_API_KEY = process.env.METASO_API_KEY;
const METASO_ENDPOINT = process.env.METASO_API_URL || 'https://api.ecn.ai/metaso/search';

async function getKnowledgeContext(query: string): Promise<string> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/knowledge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, k: 5 }),
        });

        if (response.ok) {
            const data = await response.json();
            return data.context || '';
        }
    } catch (error) {
        console.error('Failed to fetch knowledge context:', error);
    }
    return '';
}

const resolvePreferredProvider = (_inviteCode?: string) => {
    // 无论什么邀请码，都优先使用 Cloudsway，其次 VectorEngine，OpenRouter 兜底
    return undefined;
};

export async function POST(req: NextRequest) {
    const { messages, prevSummary, inviteCode } = await req.json();
    const preferredProvider = resolvePreferredProvider(inviteCode);

    // 取最近 16 条消息，确保有足够上下文
    const recentMessages: Message[] = messages.slice(-16);
    const conversationContext = recentMessages
        .map((m: Message) => m.content)
        .join('\n');
    const summaryContext = prevSummary ? JSON.stringify(prevSummary) : '';
    const knowledgeContext = await getKnowledgeContext(
        [conversationContext, summaryContext].filter(Boolean).join('\n')
    );
    const summaryPrompt: Message[] = [
        {
            role: 'system',
            content: `你是对话纪要助手。请基于用户与 AI 的对话，输出严格 JSON 格式，不要额外解释或 markdown。

字段格式如下：
{
  "productTitle": "一句话产品概述（20 字内）",
  "product": "用户产品情况（目标用户、关键点、阶段），用 2-4 行要点。",
  "aiAdvice": "AI 给出的建议，用 2-4 行要点。",
  "userNotes": "用户的观点/评论/补充，用 2-4 行要点。",
  "cases": [
    { "name": "案例或对标公司", "reason": "推荐原因，1-2 句" }
  ]
}

规则：
- 全部用中文
- 如果信息不足，写"暂无明确结论"或"待用户补充"
- cases 最多 3 条，可以为空数组
- 每个字段用简洁短句，避免长段落
- 只输出 JSON 对象，不要包含额外文字
- 所有 key 必须使用双引号
- 不要使用尾随逗号
- 你会收到上一轮 summary（如有），请基于最新对话内容重新整合输出，确保：
  1. 不要重复已有信息，如果新旧内容语义相同，只保留最新、最完整的表述
  2. 新信息应补充或替换旧信息，而非简单追加
  3. 每个字段最终只保留 2-4 行精炼要点，删除冗余`,
        },
        ...(knowledgeContext
            ? [{
                role: 'system' as const,
                content: `以下是知识库检索到的内容，请仅在有帮助时引用，用于补充对标案例或总结。\n\n${knowledgeContext}`,
            }]
            : []),
        ...(prevSummary
            ? [{
                role: 'user' as const,
                content: `上一轮 summary JSON：\n${JSON.stringify(prevSummary)}`,
            }]
            : []),
        ...recentMessages,
        {
            role: 'user',
            content: '请输出最新总结 JSON。',
        },
    ];

    let text = '';
    try {
        console.log('[Summary API] Preferred provider:', { inviteCode, preferredProvider });
        const result = await createAICompletionJson({
            messages: summaryPrompt,
            preferredProvider,
        });
        text = result.content || '';
    } catch (error) {
        console.error('Summary provider error:', error);
        return new Response(JSON.stringify({ error: 'Failed to get summary response' }), { status: 500 });
    }

    const coerceText = (value: unknown): string => {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value.map(coerceText).filter(Boolean).join('\n');
        if (value && typeof value === 'object') {
            return Object.entries(value as Record<string, unknown>)
                .map(([key, val]) => `${key}：${coerceText(val)}`)
                .filter(Boolean)
                .join('\n');
        }
        if (value == null) return '';
        return String(value);
    };

    const normalizeText = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return trimmed;
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(sanitizeJson(trimmed));
                return coerceText(parsed).trim();
            } catch {
                // fall through
            }
        }
        return trimmed
            .replace(/^[\[\{]\s*/g, '')
            .replace(/[\]\}]\s*$/g, '')
            .replace(/^[-•]\s*/gm, '')
            .replace(/",\s*$/gm, '"')
            .replace(/",?\s*$/gm, '')
            .trim();
    };

    const normalizeSummary = (value: unknown) => {
        const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
        const casesRaw = (obj.cases ?? []) as unknown;
        const cases = Array.isArray(casesRaw)
            ? casesRaw
                  .map(item => {
                      if (item && typeof item === 'object') {
                          const record = item as Record<string, unknown>;
                          return {
                              name: normalizeText(coerceText(record.name)),
                              reason: normalizeText(coerceText(record.reason)),
                          };
                      }
                      return { name: normalizeText(coerceText(item)), reason: '' };
                  })
                  .filter(item => item.name || item.reason)
            : [];
        const filteredCases = cases.filter(item => {
            const name = item.name?.trim();
            if (!name) return false;
            if (name === '[' || name === ']' || name === '{' || name === '}' || name === '"name"') return false;
            if (name.toLowerCase() === 'name') return false;
            if (name.startsWith('"') && name.endsWith('"')) return false;
            if (name.length <= 1) return false;
            return true;
        });
        const dedupedCases: { name: string; reason: string }[] = [];
        const seen = new Set<string>();
        for (const item of filteredCases) {
            const key = `${item.name}|${item.reason}`;
            if (seen.has(key)) continue;
            seen.add(key);
            dedupedCases.push(item);
        }

        return {
            productTitle: normalizeText(coerceText(obj.productTitle ?? obj.product_title ?? obj.product_summary)),
            product: normalizeText(coerceText(obj.product)),
            aiAdvice: normalizeText(coerceText(obj.aiAdvice)),
            userNotes: normalizeText(coerceText(obj.userNotes)),
            cases: dedupedCases,
        };
    };

    const sanitizeJson = (raw: string) => {
        let cleaned = raw.trim();
        cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '');
        cleaned = cleaned.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, '$1');
        cleaned = cleaned.replace(/([,{]\s*)([A-Za-z0-9_\\u4e00-\\u9fa5]+)\s*:/g, '$1"$2":');
        cleaned = cleaned.replace(/'([^']*)'/g, '"$1"');
        cleaned = cleaned.replace(/,(\s*[}\\]])/g, '$1');
        return cleaned;
    };

    type SearchItem = { title: string; link?: string; snippet?: string };

    const extractSearchItems = (payload: unknown): SearchItem[] => {
        const items: SearchItem[] = [];
        if (!payload || typeof payload !== 'object') return items;
        const values = Object.values(payload as Record<string, unknown>);
        for (const value of values) {
            if (!Array.isArray(value)) continue;
            for (const entry of value) {
                if (!entry || typeof entry !== 'object') continue;
                const record = entry as Record<string, unknown>;
                const title = coerceText(record.title || record.name || '').trim();
                if (!title) continue;
                const link = coerceText(record.link || record.url || '').trim();
                const snippet = coerceText(record.snippet || record.summary || record.description || '').trim();
                items.push({ title, link, snippet });
            }
        }
        const seen = new Set<string>();
        return items.filter(item => {
            const key = `${item.title}|${item.link || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const parseCasesFromText = (raw: string) => {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return [];
        try {
            const parsed = JSON.parse(sanitizeJson(match[0]));
            const normalized = normalizeSummary(parsed);
            return normalized.cases || [];
        } catch {
            return [];
        }
    };

    const searchMetaso = async (query: string) => {
        if (!METASO_API_KEY) {
            console.warn('[Metaso] Missing METASO_API_KEY');
            return [];
        }
        try {
            console.log('[Metaso] Searching:', { endpoint: METASO_ENDPOINT });
            const response = await fetch(METASO_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${METASO_API_KEY}`,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    q: query,
                    scope: 'webpage',
                    includeSummary: true,
                    size: 8,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Metaso] Non-200 response:', response.status, errorText);
                return [];
            }
            const data = await response.json();
            const items = extractSearchItems(data);
            console.log('[Metaso] Results:', items.length);
            return items;
        } catch (error) {
            console.error('Metaso search failed:', error);
            return [];
        }
    };

    const extractFallbackSummary = (raw: string) => {
        const textBlock = raw.replace(/\r\n/g, '\n');
        const keyPattern = /(?:^|\n)\s*"?\s*(product|aiAdvice|userNotes|cases)\s*"?\s*[:：]\s*/i;
        const findField = (key: string) => {
            const regex = new RegExp(`(?:^|\\n)\\s*"?\\s*${key}\\s*"?\\s*[:：]\\s*`, 'i');
            const match = textBlock.match(regex);
            if (!match || match.index == null) return '';
            const start = match.index + match[0].length;
            const rest = textBlock.slice(start);
            const next = rest.search(keyPattern);
            const segment = next === -1 ? rest : rest.slice(0, next);
            return segment.trim();
        };

        const product = findField('product');
        const aiAdvice = findField('aiAdvice');
        const userNotes = findField('userNotes');
        const casesRaw = findField('cases');

        let cases: { name: string; reason: string }[] = [];
        if (casesRaw) {
            const arrayMatch = casesRaw.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                try {
                    const parsed = JSON.parse(sanitizeJson(arrayMatch[0]));
                    const normalized = normalizeSummary({ cases: parsed });
                    cases = normalized.cases;
                } catch {
                    // fall through to line parsing
                }
            }
            if (!cases.length) {
                cases = casesRaw
                    .split('\n')
                    .map(line => line.replace(/^[-*]\s*/, '').trim())
                    .filter(Boolean)
                    .slice(0, 3)
                    .map(line => {
                        const [name, ...rest] = line.split(/[:：\-—]/);
                        return {
                            name: (name || '').trim(),
                            reason: rest.join(' ').trim(),
                        };
                    })
                    .filter(item => item.name || item.reason);
            }
        }

        if (!product && !aiAdvice && !userNotes && !cases.length) return null;
        return normalizeSummary({
            product,
            aiAdvice,
            userNotes,
            cases,
        });
    };

    const extractSearchIntent = async (summaryText: string, assistantText: string) => {
        const prompt = [
            {
                role: 'system' as const,
                content: `你是关键词提取助手。请从产品描述中提取 2-4 个用于搜索的核心关键词（短语），并从 AI 回复中提取明确出现的产品名。
输出严格 JSON：
{"keywords":["..."],"mentionedProducts":["..."]}`,
            },
            {
                role: 'user' as const,
                content: `产品摘要：\n${summaryText || '暂无'}\n\nAI 回复：\n${assistantText || '暂无'}`,
            },
        ];

        try {
            const result = await createAICompletionJson({ messages: prompt, preferredProvider });
            const match = result.content.match(/\{[\s\S]*\}/);
            if (!match) return { keywords: [], mentionedProducts: [] };
            const parsed = JSON.parse(sanitizeJson(match[0]));
            const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.map(coerceText).filter(Boolean) : [];
            const mentionedProducts = Array.isArray(parsed.mentionedProducts)
                ? parsed.mentionedProducts.map(coerceText).filter(Boolean)
                : [];
            return { keywords, mentionedProducts };
        } catch (error) {
            console.error('Extract search intent failed:', error);
            return { keywords: [], mentionedProducts: [] };
        }
    };

    const deriveCasesFromSearch = async (summaryText: string, items: SearchItem[]) => {
        if (!items.length) return [];
        const compact = items.slice(0, 8).map((item, index) => {
            return `${index + 1}. ${item.title}\n${item.snippet || ''}\n${item.link || ''}`.trim();
        }).join('\n\n');

        const prompt = [
            {
                role: 'system' as const,
                content: `你是产品对标提取助手。基于搜索结果提取可能是产品/平台名称，最多 3 个。
要求：
- 排除媒体报道、教程文章、招聘页、论坛帖子
- 优先保留真实产品/平台/工具
- 输出严格 JSON：{"cases":[{"name":"产品名","reason":"1 句相关性理由"}]}`,
            },
            {
                role: 'user' as const,
                content: `产品概述：\n${summaryText || '暂无'}\n\n搜索结果：\n${compact}\n\n请输出 JSON。`,
            },
        ];

        try {
            const result = await createAICompletionJson({ messages: prompt, preferredProvider });
            const cases = parseCasesFromText(result.content || '');
            return cases.slice(0, 3);
        } catch (error) {
            console.error('Derive cases from search failed:', error);
            return [];
        }
    };

    const summarizeProductFromSearch = async (productName: string, items: SearchItem[]) => {
        if (!items.length) return '';
        const compact = items.slice(0, 6).map((item, index) => {
            return `${index + 1}. ${item.title}\n${item.snippet || ''}\n${item.link || ''}`.trim();
        }).join('\n\n');

        const prompt = [
            {
                role: 'system' as const,
                content: `你是产品简介助手。基于搜索结果，用 1 句中文概括该产品的主要功能，尽量简短。只输出句子，不要额外格式。`,
            },
            {
                role: 'user' as const,
                content: `产品名：${productName}\n\n搜索结果：\n${compact}\n\n请输出一句话功能描述。`,
            },
        ];

        try {
            const result = await createAICompletionJson({ messages: prompt });
            return normalizeText(result.content || '');
        } catch (error) {
            console.error('Summarize product failed:', error);
            return '';
        }
    };

    const applyCaseFallback = async (summary: { product: string; aiAdvice: string; userNotes: string; cases: { name: string; reason: string }[] }) => {
        const summaryText = [summary.product, summary.aiAdvice, summary.userNotes]
            .filter(Boolean)
            .join('\n');
        const assistantText = recentMessages
            .filter((m: Message) => m.role === 'assistant')
            .map((m: Message) => m.content)
            .join('\n');

        const { keywords, mentionedProducts } = await extractSearchIntent(summaryText, assistantText);
        const merged = new Map<string, { name: string; reason: string }>();

        const addCase = (name: string, reason: string) => {
            const trimmed = name.trim();
            if (!trimmed) return;
            const key = trimmed.toLowerCase();
            if (merged.has(key)) return;
            merged.set(key, { name: trimmed, reason: reason.trim() });
        };

        // 1) AI 回复中明确提到的产品：补充主要功能说明
        for (const product of mentionedProducts.slice(0, 3)) {
            const items = await searchMetaso(`${product} 是什么 功能 产品`);
            const feature = await summarizeProductFromSearch(product, items);
            addCase(product, feature || 'AI 回复中明确提及的相关产品');
        }

        // 2) 用关键词做一次搜索，补齐对标产品
        if (merged.size < 3 && keywords.length) {
            const query = `${keywords.join(' ')} 类似产品 竞品 对标`;
            const searchItems = await searchMetaso(query);
            const searchCases = await deriveCasesFromSearch(summaryText, searchItems);
            searchCases.forEach(item => addCase(item.name, item.reason));
        }

        const cases = Array.from(merged.values()).slice(0, 3);
        return { ...summary, cases };
    };

    try {
        const parsed = JSON.parse(text);
        const normalized = normalizeSummary(parsed);
        const enhanced = await applyCaseFallback(normalized);
        return new Response(JSON.stringify({ summary: enhanced }), { status: 200 });
    } catch (error) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                const parsed = JSON.parse(sanitizeJson(match[0]));
                const normalized = normalizeSummary(parsed);
                const enhanced = await applyCaseFallback(normalized);
                return new Response(JSON.stringify({ summary: enhanced }), { status: 200 });
            } catch (innerError) {
                console.error('Failed to parse extracted summary JSON:', innerError);
            }
        }
        const fallback = extractFallbackSummary(text);
        if (fallback) {
            const enhanced = await applyCaseFallback(fallback);
            return new Response(JSON.stringify({ summary: enhanced }), { status: 200 });
        }
        console.error('Failed to parse summary JSON:', error);
        return new Response(
            JSON.stringify({
                summary: await applyCaseFallback(normalizeSummary({
                    product: '暂无明确结论',
                    aiAdvice: '暂无明确结论',
                    userNotes: '待用户补充',
                    cases: [],
                })),
            }),
            { status: 200 }
        );
    }
}
