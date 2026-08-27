import { NextRequest } from 'next/server';
import { createProductAdvisor } from '@/server/agents/definitions';
import { streamWithFallback } from '@/server/agents/runtime';
import { getConversationSession } from '@/server/agents/session';
import { encodeAgentEventStream } from '@/server/agents/stream';
import type { ChatMessage, CustomModelConfig } from '@/server/agents/types';

export const runtime = 'nodejs';

function isModelConfig(value: unknown): value is CustomModelConfig {
  return Boolean(value && typeof value === 'object'
    && typeof (value as CustomModelConfig).baseUrl === 'string'
    && typeof (value as CustomModelConfig).apiKey === 'string'
    && typeof (value as CustomModelConfig).model === 'string');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages as ChatMessage[] : [];
    const lastMessage = [...messages].reverse().find((message) => message.role === 'user' && message.content?.trim());
    if (!lastMessage) {
      return Response.json({ error: 'A user message is required' }, { status: 400 });
    }

    const session = await getConversationSession(typeof body.sessionId === 'string' ? body.sessionId : undefined, messages.slice(0, -1));
    const { result, provider } = await streamWithFallback(createProductAdvisor, lastMessage.content, {
      customModel: isModelConfig(body.modelConfig) ? body.modelConfig : undefined,
      session,
      workflowName: 'product-chat',
      groupId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    });

    console.log(`[Chat] streaming from ${provider.name}`);
    return new Response(encodeAgentEventStream(result, provider.name), {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat] failed:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
}
