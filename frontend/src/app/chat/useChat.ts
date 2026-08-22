'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Summary, Stage, StageConfig } from './types';
import { useModelSettings } from './useModelSettings';
import { WELCOME_MESSAGE } from '@/data/prompts';
import {
    trackChatStart,
    trackMessageSent,
    trackMessageReceived,
    trackStageChange,
    trackQuickAction,
    trackApiError,
} from '@/lib/tracking';

// 获取会话 ID
const getSessionId = (): string => {
    if (typeof window === 'undefined') return '';
    let sessionId = sessionStorage.getItem('track_session_id');
    if (!sessionId) {
        sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        sessionStorage.setItem('track_session_id', sessionId);
    }
    return sessionId;
};

// 设置会话 ID（用于加载历史会话）
const setSessionId = (sessionId: string): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('track_session_id', sessionId);
};

const getInviteCode = (): string => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('invite_code') || '';
};

// 保存对话到数据库
const saveConversation = async (
    messages: { role: string; content: string }[],
    summary: Summary,
    stage: Stage,
    inviteCode?: string
) => {
    try {
        await fetch('/api/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: getSessionId(),
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                summary,
                stage,
                inviteCode,
            }),
        });
    } catch (error) {
        console.warn('[Conversation] Failed to save:', error);
    }
};

const normalizeSummary = (value: unknown): Summary => {
    const sanitizeJsonText = (raw: string) => {
        let cleaned = raw.trim();
        cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '');
        cleaned = cleaned.replace(/^[\s\S]*?(\{[\s\S]*\}|\[[\s\S]*\])[\s\S]*$/m, '$1');
        cleaned = cleaned.replace(/([,{]\s*)([A-Za-z0-9_\\u4e00-\\u9fa5]+)\s*:/g, '$1"$2":');
        cleaned = cleaned.replace(/'([^']*)'/g, '"$1"');
        cleaned = cleaned.replace(/,(\s*[}\\]])/g, '$1');
        return cleaned;
    };

    const formatParsed = (parsed: unknown): string => {
        if (Array.isArray(parsed)) {
            return parsed
                .map(item => {
                    if (item == null) return '';
                    if (typeof item === 'string') return item.trim();
                    if (typeof item === 'object') {
                        return Object.entries(item as Record<string, unknown>)
                            .map(([key, val]) => `${key}：${formatParsed(val)}`)
                            .filter(Boolean)
                            .join('\n');
                    }
                    return String(item);
                })
                .filter(Boolean)
                .join('\n');
        }
        if (parsed && typeof parsed === 'object') {
            return Object.entries(parsed as Record<string, unknown>)
                .map(([key, val]) => `${key}：${formatParsed(val)}`)
                .filter(Boolean)
                .join('\n');
        }
        if (parsed == null) return '';
        return String(parsed);
    };

    const coerceText = (input: unknown): string => {
        if (typeof input === 'string') return input;
        if (Array.isArray(input)) return input.map(coerceText).filter(Boolean).join('\n');
        if (input && typeof input === 'object') {
            return Object.entries(input as Record<string, unknown>)
                .map(([key, val]) => `${key}：${coerceText(val)}`)
                .filter(Boolean)
                .join('\n');
        }
        if (input == null) return '';
        return String(input);
    };

    const extractQuotedLines = (raw: string) => {
        const matches = raw.match(/"([^"]+)"/g);
        if (!matches) return '';
        return matches.map(item => item.replace(/(^")|("$)/g, '').trim()).filter(Boolean).join('\n');
    };

    const normalizeText = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return trimmed;
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(sanitizeJsonText(trimmed));
                return formatParsed(parsed).trim();
            } catch {
                const quoted = extractQuotedLines(trimmed);
                return quoted || trimmed;
            }
        }
        return trimmed
            .replace(/^[\s"'`{[\]]+/, '')
            .replace(/[\s"'`\]}]+$/, '')
            .replace(/,+\s*$/g, '')
            .replace(/^\s*}\s*,?\s*$/g, '')
            .replace(/^\s*"\s*/g, '')
            .replace(/\s*"\s*$/g, '')
            .trim();
    };
    const normalizeLines = (text: string, maxLines: number) => {
        const normalizeLine = (line: string) =>
            line
                .replace(/^[-•]\s*/g, '')
                .replace(/^"+/, '')
                .replace(/"+$/, '')
                .replace(/,+\s*$/g, '')
                .trim();
        const lines = text
            .split('\n')
            .map(line => normalizeLine(line))
            .filter(Boolean)
            .filter(line => !/^[\s\]\[{}"']+$/.test(line))
            .filter(line => line !== '},' && line !== '}' && line !== '{');
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const line of lines) {
            const key = line.replace(/\s+/g, ' ').toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(line);
        }
        return deduped.slice(0, maxLines).join('\n');
    };

    const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const casesRaw = obj.cases ?? [];
    let casesArray: unknown[] = [];
    if (Array.isArray(casesRaw)) {
        casesArray = casesRaw;
    } else if (typeof casesRaw === 'string' && (casesRaw.trim().startsWith('[') || casesRaw.trim().startsWith('{'))) {
        try {
            const parsed = JSON.parse(sanitizeJsonText(casesRaw));
            casesArray = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            casesArray = [];
        }
    }
    const cleanCaseText = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return trimmed;
        if (trimmed.includes('"') && (trimmed.includes('{') || trimmed.includes('['))) {
            const quoted = extractQuotedLines(trimmed);
            return quoted || trimmed;
        }
        return trimmed;
    };

    let cases = casesArray
        .map(item => {
            if (item && typeof item === 'object') {
                const record = item as Record<string, unknown>;
                const rawName = normalizeText(coerceText(record.name));
                const rawReason = normalizeText(coerceText(record.reason));
                const cleanedName = cleanCaseText(rawName);
                const cleanedReason = cleanCaseText(rawReason);
                if (cleanedName.includes('\n')) {
                    const [first, ...rest] = cleanedName.split('\n').filter(Boolean);
                    return { name: first || '', reason: rest.join(' ') || cleanedReason };
                }
                return { name: cleanedName, reason: cleanedReason };
            }
            const raw = normalizeText(coerceText(item));
            const cleaned = cleanCaseText(raw);
            if (cleaned.includes('\n')) {
                const [first, ...rest] = cleaned.split('\n').filter(Boolean);
                return { name: first || '', reason: rest.join(' ') };
            }
            return { name: cleaned, reason: '' };
        })
        .filter(item => item.name || item.reason);

    if (!cases.length && typeof casesRaw === 'string') {
        const quoted = extractQuotedLines(casesRaw);
        if (quoted) {
            cases = quoted.split('\n').map(name => ({ name: name.trim(), reason: '' })).filter(item => item.name);
        }
    }
    cases = cases.flatMap(item => {
        if (item.name && (item.name.includes('{') || item.name.includes('['))) {
            const quoted = extractQuotedLines(item.name);
            if (quoted) {
                return quoted.split('\n').map(name => ({ name: name.trim(), reason: item.reason || '' })).filter(i => i.name);
            }
        }
        return [item];
    });
    if (!cases.length && typeof casesRaw === 'string') {
        const lines = casesRaw
            .replace(/[\[\]{}"]/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
        const cleaned: { name: string; reason: string }[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length <= 2) continue;
            const next = lines[i + 1] || '';
            if (next && next.length > 4 && !next.includes('推荐') && !next.includes('案例')) {
                cleaned.push({ name: line, reason: next });
                i += 1;
            } else {
                cleaned.push({ name: line, reason: '' });
            }
        }
        cases = cleaned;
    }

    return {
        productTitle: normalizeLines(
            normalizeText(coerceText(obj.productTitle ?? obj.product_title ?? obj.product_summary)),
            1
        ),
        product: normalizeLines(normalizeText(coerceText(obj.product)), 6),
        aiAdvice: normalizeLines(normalizeText(coerceText(obj.aiAdvice)), 6),
        userNotes: normalizeLines(normalizeText(coerceText(obj.userNotes)), 6),
        cases,
    };
};

const isMeaningful = (text: unknown, minLines: number) => {
    const normalized = typeof text === 'string' ? text : text == null ? '' : String(text);
    if (!normalized) return false;
    if (normalized.includes('暂无') || normalized.includes('待用户补充')) return false;
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.length >= minLines;
};

const mergeSummary = (prev: Summary, next: Summary): Summary => {
    const isBlank = (text: string) => {
        const normalized = text.trim();
        return !normalized || normalized.includes('暂无') || normalized.includes('待用户补充');
    };

    const stripPlaceholders = (text: string) => {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .filter(line => !line.includes('等待你介绍') && !line.includes('先聊聊你的产品背景'));
    };

    const scoreLines = (lines: string[]) => lines.length;

    const mergeText = (prevText: string, nextText: string, minLines = 1, maxLines = 6) => {
        if (!nextText || isBlank(nextText)) return prevText;
        if (!prevText || isBlank(prevText)) return nextText;
        if (!isMeaningful(nextText, minLines)) return prevText;
        if (prevText.includes(nextText)) return prevText;
        if (nextText.includes(prevText)) return nextText;

        const prevLines = stripPlaceholders(prevText);
        const nextLines = stripPlaceholders(nextText);

        // If next clearly more complete, replace instead of append
        if (scoreLines(nextLines) >= scoreLines(prevLines) + 2) {
            return nextLines.slice(0, maxLines).join('\n');
        }

        const normalizeKey = (line: string) =>
            line
                .replace(/^[-•]\s*/g, '')
                .replace(/^"+/, '')
                .replace(/"+$/, '')
                .replace(/,+\s*$/g, '')
                .replace(/\s+/g, ' ')
                .replace(/[，。、；：""''（）【】]/g, match => {
                    const map: Record<string, string> = {
                        '，': ',', '。': '.', '、': ',', '；': ';', '：': ':',
                        '\u201c': '"', '\u201d': '"', '\u2018': "'", '\u2019': "'",
                        '（': '(', '）': ')', '【': '[', '】': ']'
                    };
                    return map[match] || match;
                })
                .toLowerCase()
                .trim();

        const prevKeys = new Set(prevLines.map(normalizeKey).filter(Boolean));
        const nextKeys = new Set(nextLines.map(normalizeKey).filter(Boolean));
        const overlap = [...nextKeys].filter(key => prevKeys.has(key)).length;
        const overlapRatio = nextKeys.size ? overlap / nextKeys.size : 0;

        // If next is largely overlapping, prefer latest summary to avoid stacking duplicates.
        if (overlapRatio >= 0.6) {
            return nextLines.slice(0, maxLines).join('\n');
        }

        const normalizeLine = (line: string) =>
            line
                .replace(/^[-•]\s*/g, '')
                .replace(/^"+/, '')
                .replace(/"+$/, '')
                .replace(/,+\s*$/g, '')
                .trim();
        const combined = [...prevLines, ...nextLines].map(normalizeLine).filter(Boolean);
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const line of combined) {
            const key = normalizeKey(line);
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(line);
        }
        return deduped.slice(0, maxLines).join('\n');
    };

    const mergedCases = (() => {
        const combined = [...(prev.cases || []), ...(next.cases || [])];
        const seen = new Set<string>();
        return combined.filter(item => {
            const key = `${item.name}|${item.reason}`;
            if (!key.replace('|', '').trim()) return false;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    })();

    return {
        productTitle: mergeText(prev.productTitle, next.productTitle, 1, 1),
        product: mergeText(prev.product, next.product, 1, 6),
        aiAdvice: mergeText(prev.aiAdvice, next.aiAdvice, 1, 6),
        userNotes: mergeText(prev.userNotes, next.userNotes, 1, 6),
        cases: mergedCases,
    };
};

const MIN_DEEP_TURNS = 2;
const MIN_USER_CHARS_FOR_DEEP = 160;
const MIN_USER_MESSAGES_FOR_DEEP = 2;

const USER_SIGNAL_KEYWORDS = {
    user: ['目标用户', '用户画像', '人群', '人群画像', '使用者'],
    scenario: ['场景', '使用', '流程', '工作', '日常', '场合'],
    pain: ['痛点', '问题', '难点', '困扰', '焦虑'],
    value: ['价值', '优势', '差异', '收益', '好处'],
    stage: ['阶段', '进展', 'MVP', 'Demo', '测试', '上线', '发布', '验证'],
    monetize: ['付费', '价格', '订阅', '商业化', '变现'],
};

// 计算当前阶段
const computeStage = (
    summary: Summary,
    deepTurns: number,
    userMessageCount: number,
    userCharCount: number,
    userSignalScore: number
): Stage => {
    const productReady = isMeaningful(summary.product, 2);
    const adviceReady = isMeaningful(summary.aiAdvice, 2);
    const userNotesReady = isMeaningful(summary.userNotes, 1);

    if (!productReady) {
        if (
            userMessageCount >= MIN_USER_MESSAGES_FOR_DEEP ||
            userCharCount >= MIN_USER_CHARS_FOR_DEEP ||
            userSignalScore >= 2
        ) {
            return 'deep';
        }
        return 'info';
    }
    if (!adviceReady || !userNotesReady) return 'deep';
    if (deepTurns < MIN_DEEP_TURNS) return 'deep';
    return 'analysis';
};

const stageConfigs: Record<Stage, Omit<StageConfig, 'checklist'> & { checklist: { label: string; condition: (s: Summary) => boolean }[] }> = {
    info: {
        label: '信息收集',
        goal: '产出一句话产品定义 + 关键用户/场景',
        checklist: [
            { label: '目标用户 & 场景', condition: (s) => isMeaningful(s.product, 2) },
            { label: '核心问题/价值主张', condition: (s) => isMeaningful(s.product, 2) },
            { label: '当前阶段/进展', condition: (s) => isMeaningful(s.product, 2) },
        ],
        takeaway: '你会得到：清晰的产品轮廓和核心假设。',
    },
    deep: {
        label: '深度追问',
        goal: '产出关键假设 + 可验证路径',
        checklist: [
            { label: '最关键不确定点', condition: (s) => isMeaningful(s.aiAdvice, 2) },
            { label: '验证方案/指标', condition: (s) => isMeaningful(s.aiAdvice, 2) },
            { label: '用户视角补充', condition: (s) => isMeaningful(s.userNotes, 1) },
        ],
        takeaway: '你会得到：验证方案与风险清单。',
    },
    analysis: {
        label: '多视角分析',
        goal: '产出优势/风险/机会 + 行动建议',
        checklist: [
            { label: '产品视角判断', condition: (s) => isMeaningful(s.aiAdvice, 2) },
            { label: '商业/技术可行性', condition: (s) => isMeaningful(s.aiAdvice, 2) },
            { label: '建议与行动清单', condition: (s) => isMeaningful(s.aiAdvice, 2) },
        ],
        takeaway: '你会得到：完整诊断 + 可执行建议。',
    },
};

export function useChat() {
    const {
        models,
        selectedModel,
        selectedModelId,
        selectModel,
        addModel,
        deleteModel,
    } = useModelSettings();
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: WELCOME_MESSAGE,
        },
    ]);
    const [summary, setSummary] = useState<Summary>({
        productTitle: '',
        product: '等待你介绍产品后生成…',
        aiAdvice: '先聊聊你的产品背景，我会持续整理建议。',
        userNotes: '还没有记录到你的观点。',
        cases: [],
    });
    const [deepTurns, setDeepTurns] = useState(0);
    const [userSignals, setUserSignals] = useState({
        user: false,
        scenario: false,
        pain: false,
        value: false,
        stage: false,
        monetize: false,
    });
    const [userMessageCount, setUserMessageCount] = useState(0);
    const [userCharCount, setUserCharCount] = useState(0);
    const [currentSessionId, setCurrentSessionId] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevStageRef = useRef<Stage | null>(null);
    const shouldScrollRef = useRef(false);
    const isUserScrollingRef = useRef(false);

    const stageOrder: Stage[] = ['info', 'deep', 'analysis'];
    const [currentStage, setCurrentStage] = useState<Stage>('info');

    // 初始化时获取 sessionId
    useEffect(() => {
        setCurrentSessionId(getSessionId());
    }, []);

    useEffect(() => {
        const userSignalScore = Object.values(userSignals).filter(Boolean).length;
        const nextStage = computeStage(
            summary,
            deepTurns,
            userMessageCount,
            userCharCount,
            userSignalScore
        );
        const currentIndex = stageOrder.indexOf(currentStage);
        const nextIndex = stageOrder.indexOf(nextStage);
        if (nextIndex > currentIndex) {
            setCurrentStage(nextStage);
        }
    }, [summary, deepTurns, userMessageCount, userCharCount, userSignals, currentStage]);

    // 阶段切换埋点
    useEffect(() => {
        if (prevStageRef.current && prevStageRef.current !== currentStage) {
            trackStageChange(prevStageRef.current, currentStage);
        }
        prevStageRef.current = currentStage;
    }, [currentStage]);

    const scrollToBottom = useCallback(() => {
        if (!isUserScrollingRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [deepTurns, summary]);

    // 只在需要时滚动（用户发送消息后）
    useEffect(() => {
        if (shouldScrollRef.current) {
            scrollToBottom();
            shouldScrollRef.current = false;
        }
    }, [messages, scrollToBottom]);

    const requestSummary = useCallback(async (snapshot: Message[]) => {
        setIsSummarizing(true);
        try {
            const response = await fetch('/api/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: snapshot.map(m => ({ role: m.role, content: m.content })),
                    prevSummary: summary,
                    inviteCode: getInviteCode(),
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn('Summary request failed:', response.status, errorText);
                return;
            }

            const data = await response.json();
            if (data?.summary) {
                const incoming = normalizeSummary(data.summary);
                setSummary(prev => {
                    const merged = mergeSummary(prev, incoming);
                    const userSignalScore = Object.values(userSignals).filter(Boolean).length;
                    const newStage = computeStage(
                        merged,
                        deepTurns,
                        userMessageCount,
                        userCharCount,
                        userSignalScore
                    );
                    void saveConversation(snapshot, merged, newStage, getInviteCode());
                    return merged;
                });
            }
        } catch (error) {
            console.warn('Error calling summary API:', error);
        } finally {
            setIsSummarizing(false);
        }
    }, [deepTurns, userMessageCount, userCharCount, userSignals, summary]);

    const sendMessage = useCallback(async (content: string, isQuickAction?: string) => {
        if (!content.trim() || isLoading) return;

        if (!messages.some(msg => msg.role === 'user')) {
            trackChatStart();
        }

        if (currentStage === 'deep') {
            setDeepTurns(prev => prev + 1);
        }

        setUserMessageCount(prev => prev + 1);
        setUserCharCount(prev => prev + content.length);
        setUserSignals(prev => {
            const containsAny = (keywords: string[]) => keywords.some(k => content.includes(k));
            return {
                user: prev.user || containsAny(USER_SIGNAL_KEYWORDS.user),
                scenario: prev.scenario || containsAny(USER_SIGNAL_KEYWORDS.scenario),
                pain: prev.pain || containsAny(USER_SIGNAL_KEYWORDS.pain),
                value: prev.value || containsAny(USER_SIGNAL_KEYWORDS.value),
                stage: prev.stage || containsAny(USER_SIGNAL_KEYWORDS.stage),
                monetize: prev.monetize || containsAny(USER_SIGNAL_KEYWORDS.monetize),
            };
        });

        // 埋点：发送消息
        trackMessageSent(content.length, currentStage);
        if (isQuickAction) {
            trackQuickAction(isQuickAction);
        }

        // 用户发送消息时，标记需要滚动
        shouldScrollRef.current = true;
        isUserScrollingRef.current = false;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
        const currentMessages = [...messages, userMsg];
        setMessages(currentMessages);
        await saveConversation(
            currentMessages.map(m => ({ role: m.role, content: m.content })),
            summary,
            currentStage,
            getInviteCode()
        );
        setIsLoading(true);
        setIsThinking(true);

        const assistantId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
                    sessionId: getSessionId(),
                    inviteCode: getInviteCode(),
                    modelConfig: selectedModel.isDefault ? undefined : {
                        name: selectedModel.name,
                        baseUrl: selectedModel.baseUrl,
                        apiKey: selectedModel.apiKey,
                        model: selectedModel.model,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                const data = await response.json();
                const finalMessages = currentMessages.concat({
                    id: assistantId,
                    role: 'assistant',
                    content: data.message,
                });
                setMessages(prev =>
                    prev.map(m => (m.id === assistantId ? { ...m, content: data.message } : m))
                );
                setIsThinking(false);
                void requestSummary(finalMessages);
                // 埋点：收到回复
                trackMessageReceived(data.message.length, currentStage);
                return;
            }

            const decoder = new TextDecoder();
            let done = false;
            let accumulated = '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunk = decoder.decode(value || new Uint8Array(), { stream: !doneReading });
                if (!chunk) continue;
                setIsThinking(false);
                accumulated += chunk;
                setMessages(prev =>
                    prev.map(m => (m.id === assistantId ? { ...m, content: accumulated } : m))
                );
            }
            const finalMessages = currentMessages.concat({
                id: assistantId,
                role: 'assistant',
                content: accumulated,
            });
            void requestSummary(finalMessages);
            // 埋点：收到回复
            trackMessageReceived(accumulated.length, currentStage);
        } catch (error) {
            console.error('Error calling chat API:', error);
            // 埋点：API 错误
            trackApiError('chat', error instanceof Error ? error.message : 'Unknown error');
            const errorMsg: Message = {
                id: assistantId,
                role: 'assistant',
                content: "思考过程中遇到了问题。请确保 `.env.local` 文件中已正确设置可用的 API Key。",
            };
            setMessages(prev => prev.map(m => (m.id === assistantId ? errorMsg : m)));
        } finally {
            setIsLoading(false);
            setIsThinking(false);
        }
    }, [isLoading, messages, requestSummary, currentStage, summary, selectedModel]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading) return;
        const content = input;
        setInput('');
        await sendMessage(content);
    }, [input, isLoading, sendMessage]);

    const handleQuickSend = useCallback(async (content: string) => {
        if (isLoading) return;
        await sendMessage(content, content);
    }, [isLoading, sendMessage]);

    // 加载历史会话
    const loadConversation = useCallback(async (sessionId: string) => {
        setIsLoadingHistory(true);
        try {
            const res = await fetch(`/api/conversation/${sessionId}`);
            if (!res.ok) {
                console.error('Failed to load conversation');
                return;
            }

            const data = await res.json();
            const conv = data.conversation;

            // 设置新的 sessionId
            setSessionId(sessionId);
            setCurrentSessionId(sessionId);

            // 恢复消息
            if (conv.messages && conv.messages.length > 0) {
                const restoredMessages: Message[] = conv.messages.map((m: { role: string; content: string }, index: number) => ({
                    id: `restored-${index}`,
                    role: m.role,
                    content: m.content,
                }));
                setMessages(restoredMessages);
            }

            // 恢复 summary
            if (conv.summary) {
                setSummary(normalizeSummary(conv.summary));
            }

            // 恢复 stage
            if (conv.stage) {
                setCurrentStage(conv.stage as Stage);
            }

            // 计算用户消息数和字符数
            const userMsgs = (conv.messages || []).filter((m: { role: string }) => m.role === 'user');
            setUserMessageCount(userMsgs.length);
            setUserCharCount(userMsgs.reduce((acc: number, m: { content: string }) => acc + m.content.length, 0));

        } catch (error) {
            console.error('Error loading conversation:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    const stageConfig: StageConfig = {
        ...stageConfigs[currentStage],
        checklist: stageConfigs[currentStage].checklist.map(item => ({
            label: item.label,
            done: item.condition(summary),
        })),
    };

    return {
        input,
        setInput,
        isLoading,
        isThinking,
        isSummarizing,
        isLoadingHistory,
        messages,
        summary,
        messagesEndRef,
        isUserScrollingRef,
        currentStage,
        stageConfig,
        deepTurns,
        minDeepTurns: MIN_DEEP_TURNS,
        currentSessionId,
        models,
        selectedModelId,
        selectModel,
        addModel,
        deleteModel,
        handleSend,
        handleQuickSend,
        loadConversation,
    };
}
