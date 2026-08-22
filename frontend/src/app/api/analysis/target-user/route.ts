import { NextRequest, NextResponse } from 'next/server';
import { createPersonaAgent, personasSchema } from '@/server/agents/definitions';
import { runWithFallback } from '@/server/agents/runtime';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { summary, productType } = await req.json();
    const input = `产品类型：${productType || '未指定'}\n\n产品概要：${summary?.product || '暂无产品描述'}\n\n已有建议：${summary?.aiAdvice || '暂无'}\n\n用户补充：${summary?.userNotes || '暂无'}\n\n相关案例：${JSON.stringify(summary?.cases || [])}`;
    const { result, provider } = await runWithFallback(createPersonaAgent, input, { workflowName: 'target-personas' });
    const personas = personasSchema.parse(result.finalOutput);
    console.log(`[Personas] completed with ${provider.name}`);
    return NextResponse.json({ personas });
  } catch (error) {
    console.error('[Personas] failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
