import { NextRequest } from 'next/server';
import { PRODUCT_JUDGE_SYSTEM_PROMPT } from '@/data/prompts';
import { createAICompletion } from '@/lib/ai-client';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ModelConfig {
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
}

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

const resolvePreferredProvider = () => {
    // 无论什么邀请码，都优先使用 Cloudsway，其次 VectorEngine，OpenRouter 兜底
    return undefined;
};

export async function POST(req: NextRequest) {
    const { messages, inviteCode, modelConfig } = await req.json();
    const preferredProvider = resolvePreferredProvider();
    const customModel: ModelConfig | undefined =
        modelConfig &&
        typeof modelConfig === 'object' &&
        typeof modelConfig.baseUrl === 'string' &&
        typeof modelConfig.apiKey === 'string' &&
        typeof modelConfig.model === 'string'
            ? {
                name: typeof modelConfig.name === 'string' ? modelConfig.name : 'Custom',
                baseUrl: modelConfig.baseUrl,
                apiKey: modelConfig.apiKey,
                model: modelConfig.model,
            }
            : undefined;

    // 构建更完整的查询：结合最近几轮对话内容
    const recentMessages = messages.slice(-6); // 最近 3 轮对话
    const conversationContext = recentMessages
        .map((m: Message) => m.content)
        .join('\n');

    // 从后端获取相关知识库内容
    const knowledgeContext = await getKnowledgeContext(conversationContext);

    // 构建增强的系统提示词
    let enhancedSystemPrompt = PRODUCT_JUDGE_SYSTEM_PROMPT;

    if (knowledgeContext) {
        enhancedSystemPrompt += `

## 知识库内容（请在对话中自然引用）

以下是与当前对话相关的产品案例、理论和经验：

${knowledgeContext}

---

**如何使用这些知识：**
1. 在追问时引用相关案例："这让我想到 [某产品] 早期也遇到过类似的问题..."
2. 分享相关理论："有一个叫 [某理论] 的概念，说的就是这种情况..."
3. 提供参考："[某公司] 当时的做法是...你觉得这个思路对你有启发吗？"
4. 建立共鸣："很多成功的产品在早期都面临过这个挑战，比如..."

记住：你不是在考试用户，而是在和用户一起探索。分享知识是为了帮助用户思考，而不是炫耀。`;
    }

    const aiMessages = [
        { role: 'system' as const, content: enhancedSystemPrompt },
        ...messages,
    ];

    try {
        const { response, provider } = await createAICompletion({
            messages: aiMessages,
            stream: true,
            preferredProvider,
            customModel,
        });

        console.log(`[Chat API] Using provider: ${provider}`, { inviteCode, preferredProvider });

        if (!response.body) {
            return new Response(JSON.stringify({ error: 'No response stream' }), { status: 500 });
        }

        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body!.getReader();
                const decoder = new TextDecoder();
                const encoder = new TextEncoder();
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;
                        const data = trimmed.slice(5).trim();
                        if (data === '[DONE]') {
                            controller.close();
                            return;
                        }

                        try {
                            const json = JSON.parse(data);
                            const delta = json.choices?.[0]?.delta?.content;
                            if (delta) {
                                controller.enqueue(encoder.encode(delta));
                            }
                        } catch (error) {
                            console.error('Failed to parse stream chunk:', error);
                        }
                    }
                }

                controller.close();
            },
        });

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return new Response(JSON.stringify({ error: 'Failed to get AI response' }), { status: 500 });
    }
}
