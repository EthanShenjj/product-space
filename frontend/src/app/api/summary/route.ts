import { NextRequest, NextResponse } from 'next/server';
import { createSummaryAgent, summarySchema } from '@/server/agents/definitions';
import { runWithFallback } from '@/server/agents/runtime';
import type { ChatMessage, CustomModelConfig, SummaryOutput } from '@/server/agents/types';

export const runtime = 'nodejs';

const fallbackSummary = (previous?: Partial<SummaryOutput>): SummaryOutput => ({
  productTitle: previous?.productTitle || '待用户补充',
  product: previous?.product || '暂无明确结论',
  aiAdvice: previous?.aiAdvice || '暂无明确结论',
  userNotes: previous?.userNotes || '待用户补充',
  cases: Array.isArray(previous?.cases) ? previous.cases : [],
});

function modelConfig(value: unknown): CustomModelConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const config = value as CustomModelConfig;
  return typeof config.baseUrl === 'string' && typeof config.apiKey === 'string' && typeof config.model === 'string' ? config : undefined;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = Array.isArray(body.messages) ? body.messages as ChatMessage[] : [];
  const previous = body.prevSummary as Partial<SummaryOutput> | undefined;
  const input = [
    previous ? `上一轮总结：${JSON.stringify(previous)}` : '',
    ...messages.slice(-16).map((message) => `${message.role === 'user' ? '用户' : '顾问'}：${message.content}`),
    '请输出本轮最新总结。',
  ].filter(Boolean).join('\n\n');

  try {
    const { result, provider } = await runWithFallback(createSummaryAgent, input, {
      customModel: modelConfig(body.modelConfig),
      workflowName: 'conversation-summary',
      groupId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    });
    const summary = summarySchema.parse(result.finalOutput);
    console.log(`[Summary] completed with ${provider.name}`);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('[Summary] failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ summary: fallbackSummary(previous), error: 'Failed to get summary response' });
  }
}
