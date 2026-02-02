import { NextRequest } from 'next/server';
import { getExpertById, generateTargetUserPrompt } from '@/data/experts';
import { createAICompletion } from '@/lib/ai-client';

// 根据用户目标生成额外的提示词
function getGoalPrompt(userGoal: string): string {
  const goalPrompts: Record<string, string> = {
    validate: `
## 用户当前目标：验证需求 (0→0.1)
用户正处于产品早期阶段，想要验证产品是否有真实需求。

请特别关注并给出具体建议：
1. 如何用最小成本验证核心假设？
2. 第一批种子用户应该去哪里找？具体渠道和方法
3. 什么样的信号能证明产品有需求？（具体指标）
4. MVP 应该包含哪些核心功能？哪些可以先不做？
5. 推荐 1-2 个可以立即执行的验证实验

在 actionItems 中给出 3-5 个本周就能执行的具体行动，要���常具体可操作。`,

    positioning: `
## 用户当前目标：产品定位与营销
用户想要找到独特的市场定位，制定营销策略。

请特别关注并给出具体建议：
1. 产品的独特价值主张应该是什么？用一句话怎么说？
2. 目标用户画像应该如何精准定义？
3. 与竞品相比，应该强调哪些差异化优势？
4. 推荐的营销渠道和获客策略是什么？
5. 品牌调性和传播话术建议

在 actionItems 中给出 3-5 个具体的营销行动，包括渠道、内容方向、预算建议等。`,

    monetize: `
## 用户当前目标���商业化变现
用户想要探索盈利模式，实现产品商业化。

请特别关注并给出具体建议：
1. 推荐的商业模式是什么？为什么？
2. 定价策略建议（具体价格区间和依据）
3. 付费转化的关键节点在哪里？
4. 如何设计免费版和付费版的功能差异？
5. 潜在的 B 端或企业级变现机会

在 actionItems 中给出 3-5 个商业化的具体行动，包括定价测试、付费功能设计等。`,

    scale: `
## 用户当前目标：规模化增长
用户已验证需求，想要快速扩大用户规模。

请特别关注并给出具体建议：
1. 最适合的增长引擎是什么？（病毒传播/内容/付费/销售）
2. 如何设计增长飞轮？关键指标是什么？
3. 用户留存的关键动作是什么？如何优化？
4. 团队扩张建议（需要什么角色？）
5. 融资建议（是否需要？什么时机？）

在 actionItems 中给出 3-5 个增长相关的具体行动，包括实验设计、指标目标等。`,
  };

  return goalPrompts[userGoal] || '';
}

function getScoreGuideline(category: string): string {
  const guide: Record<string, string> = {
    product: '评分风格：更关注产品价值与用户需求匹配度，评分偏克制。',
    growth: '评分风格：更关注增长与留存，评分偏克制，除非证据充分。',
    investor: '评分风格：更关注商业化与风险，评分偏谨慎。',
    tech: '评分风格：更关注技术可行性与成本，评分偏谨慎。',
    design: '评分风格：更关注体验与呈现，评分偏克制。',
    user: '评分风格：更关注使用动机与易用性，评分偏真实体验。',
  };
  return guide[category] || '评分风格：根据你的专业视角给出客观评分，避免过高。';
}

function pickScoreStandardVariant(): string {
  const variants = [
    `## 本次评分标准（版本A：先分清晰度，再给分）
1) 先判断“概念是否清晰 + 是否有竞争力/差异化”
2) 再判断“是否有验证证据/可落地路径”
3) 最后才决定具体分数
提醒：如果概念不清晰或缺乏竞争力，直接 1 分；没有充分理由不要给 5 分。`,
    `## 本次评分标准（版本B：从否定条件出发）
- 出现“概念不清晰/价值主张矛盾/同质化” → 1 分
- 只有想法，没有用户与场景细节 → 2 分
- 用户/场景/价值主张清晰且一致，但无验证 → 5 分（慎用）
- 有验证信号或落地路径 → 8 分以上`,
    `## 本次评分标准（版本C：门槛法）
要给 5 分，必须同时满足：
1) 目标用户清晰
2) 核心场景清晰
3) 价值主张清晰且不矛盾
否则优先给 2 分；概念不清晰/无竞争力直接 1 分。`,
  ];
  const index = Math.floor(Math.random() * variants.length);
  return variants[index];
}

export async function POST(req: NextRequest) {
  const { summary, expertId, productType, userGoal, targetUserDescription } = await req.json();

  const expert = getExpertById(expertId);
  if (!expert) {
    return new Response(JSON.stringify({ error: 'Expert not found' }), { status: 404 });
  }

  // 构建产品描述
  const productDescription = `
## 产品概要
${summary.product || '暂无产品描述'}

## AI 之前的建议
${summary.aiAdvice || '暂无'}

## 用户补充的信息
${summary.userNotes || '暂无'}

## 相关案例
${summary.cases?.map((c: { name: string; reason: string }) => `- ${c.name}: ${c.reason}`).join('\n') || '暂无'}

## 产品类型
${productType}
`.trim();

  // 根据专家类型选择 prompt
  let systemPrompt = expert.systemPrompt;
  if (expertId === 'target_user' && targetUserDescription) {
    systemPrompt = generateTargetUserPrompt(targetUserDescription);
  }

  // 获取目标相关的提示词
  const goalPrompt = getGoalPrompt(userGoal || 'validate');
  const scoreGuideline = getScoreGuideline(expert.category);
  const scoreStandardVariant = pickScoreStandardVariant();

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `${systemPrompt}
${goalPrompt}
${scoreGuideline}
${scoreStandardVariant}

## 输出格式要求
请按以下格式输出你的分析：

1. 首先用 2-3 段话详细分析这个产品
2. 然后针对用户的目标，给出具体的落地建议
3. 评分门槛检查（必须包含以下四项并逐条判断）：
   - 目标用户是否清晰？
   - 核心场景是否清晰？
   - 价值主张是否清晰且不矛盾？
   - 是否有差异化/竞争力？
4. 给出评分（必须从 0/1/2/5/8/10 中选择）
5. 最后用 JSON 格式总结：

\`\`\`json
{
  "score": 5,
  "gates": {
    "userClear": true,
    "scenarioClear": true,
    "valueClear": true,
    "hasDifferentiation": false
  },
  "strengths": ["优势1", "优势2", "优势3"],
  "risks": ["风险1", "风险2"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "actionItems": ["本周行动1：具体描述", "本周行动2：具体描述", "本周行动3：具体描述"]
}
\`\`\`

 注意：
 - 评分要客观偏克制，没有明确理由时不要选择 5 分
 - 评分只能使用以下集合：{0, 1, 2, 5, 8, 10}，不可使用其他数值或小数
 - 请基于你的专业视角给出独立评分，避免与其他专家出现相同分数
 - 评分基准（请严格遵守）：
  - 0：信息极不完整，几乎无法判断可行性
  - 1：概念不清晰或缺乏竞争力/差异化，价值主张自相矛盾
  - 2：概念可理解但信息较少，缺目标用户与场景细节
  - 5：用户/场景/价值主张清晰且一致，但缺验证数据与落地证据（只有“明显中等且无明显短板”时可用）
  - 8：清晰且有初步验证/指标/落地路径（明显偏高）
  - 10：目标与路径非常清晰，有实证数据与规模化迹象（明显偏高）
 - 评分案例（只作参考，不可机械套用）：
  - 0：只有一句话或空泛愿景，缺任何产品/用户信息
  - 1：问题都说不清，或只是“更好/更便宜”的同质替代
  - 2：想法能理解，但用户是谁、场景在哪、为什么会用都不清楚
  - 5：目标用户与核心场景明确，有清晰价值主张与解决路径，但没有验证数据
  - 8：已有 MVP/试点/付费或留存信号，指标能佐证价值
  - 10：已有可复制的增长引擎与规模化数据支撑
 - 评分标准样例（你必须参考样例的“判断结构”，而非内容本身）：
   - 0：一句话愿景 + 无用户/场景/价值信息 → 0
   - 1：场景模糊或价值主张矛盾 + 没有差异化 → 1
   - 2：概念可理解但用户/场景/价值不完整 → 2
   - 5：用户/场景/价值清晰且一致 + 仍无验证 → 5（慎用）
   - 8：有验证信号（MVP/试点/付费/留存）+ 价值被指标支撑 → 8
   - 10：验证充分 + 规模化迹象明显 + 可复制增长路径 → 10
 - 优势、风险、建议各 2-4 条，每条简洁有力
 - actionItems 是最重要的部分，要给出 3-5 个本周就能执行的具体行动
 - 每个 actionItem 要非常具体，包含：做什么、怎么做、预期结果
 - 在正文分析中，至少引用 1-2 个你亲身经历/曾经参与/投资过的真实案例，并说明与你的产品有什么可借鉴之处`,
    },
    {
      role: 'user',
      content: `请分析以下产品：\n\n${productDescription}`,
    },
  ];

  try {
    const { response, provider } = await createAICompletion({
      messages,
      stream: true,
    });

    console.log(`[Analysis API] Using provider: ${provider}`);

    // 返回流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Analysis API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
