import { NextRequest, NextResponse } from 'next/server';
import { BOARD_ROLES, createModeratorAgent, createRoleAgent, feedbackSchema, boardVerdictSchema } from '@/server/agents/definitions';
import { getKnowledgeContext } from '@/server/agents/knowledge';
import { runWithFallback } from '@/server/agents/runtime';
import type { CustomModelConfig, RoleFeedback } from '@/server/agents/types';

export const runtime = 'nodejs';

type RoleKey = keyof typeof BOARD_ROLES;

function modelConfig(value: unknown): CustomModelConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const config = value as CustomModelConfig;
  return typeof config.baseUrl === 'string' && typeof config.apiKey === 'string' && typeof config.model === 'string' ? config : undefined;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await task(items[current]);
    }
  }));
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pitch = typeof body.pitch_text === 'string' ? body.pitch_text.trim() : '';
    if (!pitch) return NextResponse.json({ error: 'pitch_text is required' }, { status: 400 });
    const history = Array.isArray(body.conversation_history) ? body.conversation_history.map(String) : [];
    const { context, results: knowledge } = await getKnowledgeContext([pitch, ...history].join('\n'), 5);
    const input = `产品想法：${pitch}\n\n问答上下文：${history.join('\n') || '暂无'}\n\n相关知识：${context || '暂无'}`;
    const customModel = modelConfig(body.modelConfig);
    const roleKeys = Object.keys(BOARD_ROLES) as RoleKey[];

    const feedbackEntries = await mapWithConcurrency(roleKeys, 3, async (key) => {
      const role = BOARD_ROLES[key];
      try {
        const { result } = await runWithFallback((model) => createRoleAgent(model, role), input, {
          customModel,
          workflowName: `board-${key}`,
        });
        return [key, feedbackSchema.parse(result.finalOutput)] as const;
      } catch {
        return [key, { vote: 'YELLOW', comment: '该视角暂时无法完成评估，请在下一轮补充信息。' } satisfies RoleFeedback] as const;
      }
    });
    const feedback = Object.fromEntries(feedbackEntries) as Record<RoleKey, RoleFeedback>;

    const moderatorInput = `产品想法：${pitch}\n\n六位评审：\n${JSON.stringify(feedback)}`;
    const { result: moderatorResult } = await runWithFallback(createModeratorAgent, moderatorInput, {
      customModel,
      workflowName: 'board-moderator',
    });
    const verdict = boardVerdictSchema.parse(moderatorResult.finalOutput);

    return NextResponse.json({
      verdict: verdict.verdict,
      score: verdict.score,
      summary: verdict.summary,
      pm_feedback: feedback.pm,
      strategy_feedback: feedback.strategy,
      growth_feedback: feedback.growth,
      tech_feedback: feedback.tech,
      user_feedback: feedback.user,
      investor_feedback: feedback.investor,
      similar_cases: knowledge.map((item) => item.content),
    });
  } catch (error) {
    console.error('[Judge] failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Judgment failed' }, { status: 500 });
  }
}
