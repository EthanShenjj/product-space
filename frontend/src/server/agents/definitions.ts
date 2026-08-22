import { Agent, fileSearchTool, OpenAIResponsesModel } from '@openai/agents';
import type { Model } from '@openai/agents';
import { z } from 'zod';
import { PRODUCT_JUDGE_SYSTEM_PROMPT } from '@/data/prompts';
import { createKnowledgeTool } from './knowledge';
import type { Persona, RoleFeedback, SummaryOutput } from './types';

export const summarySchema = z.object({
  productTitle: z.string(),
  product: z.string(),
  aiAdvice: z.string(),
  userNotes: z.string(),
  cases: z.array(z.object({ name: z.string(), reason: z.string() })).max(3),
});

export const personasSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  scenario: z.string(),
  painPoints: z.array(z.string()).min(1),
  motivations: z.array(z.string()).min(1),
  willingnessToPay: z.string(),
  shortBio: z.string(),
})).min(3).max(3);

export const feedbackSchema = z.object({
  vote: z.enum(['RED', 'YELLOW', 'GREEN']),
  comment: z.string().max(500),
});

function knowledgeTools(model: Model) {
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  if (vectorStoreId && model instanceof OpenAIResponsesModel) {
    return [fileSearchTool(vectorStoreId, { maxNumResults: 5, includeSearchResults: true })];
  }
  return [createKnowledgeTool()];
}

export const boardVerdictSchema = z.object({
  verdict: z.enum(['BLOCKED', 'APPROVED', 'WARNING']),
  score: z.number().int().min(0).max(100),
  summary: z.string(),
});

export function createProductAdvisor(model: Model) {
  return new Agent({
    name: 'ProductThink 产品顾问',
    model,
    instructions: `${PRODUCT_JUDGE_SYSTEM_PROMPT}

当用户询问产品案例、方法论、增长策略、竞争或验证方式时，先使用 search_product_knowledge 检索，再自然引用结果。不要虚构知识库来源。`,
    tools: knowledgeTools(model),
  });
}

export function createSummaryAgent(model: Model) {
  return new Agent({
    name: 'ProductThink 对话总结员',
    model,
    instructions: `你是对话纪要助手。根据用户和产品顾问的对话生成中文总结。保持短句，信息不足时写“暂无明确结论”或“待用户补充”。
productTitle 不超过 20 字；product、aiAdvice、userNotes 各 2-4 条简短要点；cases 最多三条。`,
    outputType: summarySchema,
  });
}

export function createPersonaAgent(model: Model) {
  return new Agent({
    name: 'ProductThink 用户研究员',
    model,
    instructions: '你是一位产品研究员。根据产品描述生成恰好 3 个不同的中文目标用户画像。每个画像都必须包含真实场景、痛点、动机和付费意愿，避免泛泛而谈。',
    outputType: personasSchema,
  });
}

export function createExpertAgent(model: Model, instructions: string) {
  return new Agent({
    name: 'ProductThink 专家评审',
    model,
    instructions: `${instructions}

输出中文 Markdown 分析；最后必须包含一个 json 代码块，字段为 score（仅 0/1/2/5/8/10）、strengths、risks、suggestions、actionItems。`,
    tools: knowledgeTools(model),
  });
}

export function createRoleAgent(
  model: Model,
  role: { name: string; focus: string; prompt: string },
) {
  return new Agent({
    name: role.name,
    model,
    instructions: `${role.prompt}\n你负责 ${role.focus}。始终用中文回答。`,
    outputType: feedbackSchema,
    tools: knowledgeTools(model),
  });
}

export function createModeratorAgent(model: Model) {
  return new Agent({
    name: 'ProductThink 评审会主持人',
    model,
    instructions: '你是产品评审会主持人。根据六位评审的结果，用中文给出严格、简短的最终结论。任一 RED 通常应为 BLOCKED；强证据且多数 GREEN 才能 APPROVED；其余为 WARNING。',
    outputType: boardVerdictSchema,
  });
}

export const BOARD_ROLES = {
  pm: {
    name: 'Product Manager',
    focus: '真实需求（The Mom Test）',
    prompt: '你是一名怀疑但有帮助的产品经理。判断这是否是高频且强烈的真实痛点。',
  },
  strategy: {
    name: 'Strategy Consultant',
    focus: '护城河与竞争（Zero to One）',
    prompt: '你是一名战略顾问。判断护城河、竞争格局与差异化是否成立。',
  },
  growth: {
    name: 'Growth Hacker',
    focus: '分发与增长钩子',
    prompt: '你是一名增长顾问。判断冷启动、传播路径和增长机制是否可行。',
  },
  tech: {
    name: 'Tech Architect',
    focus: '技术可行性与套壳风险',
    prompt: '你是一名技术架构师。判断技术可行性、成本、交付风险与模型套壳风险。',
  },
  user: {
    name: 'User Simulator',
    focus: '用户体验与摩擦',
    prompt: '你是一名忙碌且挑剔的目标用户。判断用户动机、体验摩擦和首个价值时刻。',
  },
  investor: {
    name: 'Angel Investor',
    focus: '机会、回报与 Why now',
    prompt: '你是一名早期投资人。判断市场空间、回报、机会成本和为什么是现在。',
  },
} as const;

export type BoardRoleKey = keyof typeof BOARD_ROLES;
export type { Persona, RoleFeedback, SummaryOutput };
