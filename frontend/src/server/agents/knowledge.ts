import OpenAI from 'openai';
import { tool } from '@openai/agents';
import { z } from 'zod';
import type { KnowledgeResult } from './types';

const MAX_CONTEXT_CHARS = 7_500;

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for knowledge retrieval');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function searchKnowledge(query: string, maxResults = 5): Promise<KnowledgeResult[]> {
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vectorStoreId) return [];

  const response = await getClient().vectorStores.search(vectorStoreId, {
    query: query.slice(0, 4_000),
    max_num_results: Math.max(1, Math.min(maxResults, 10)),
  });

  return response.data.map((item) => ({
    content: item.content
      .map((part) => ('text' in part ? part.text : ''))
      .join('\n')
      .slice(0, MAX_CONTEXT_CHARS),
    source: item.filename || item.file_id,
    score: item.score,
  })).filter((item) => item.content);
}

export async function getKnowledgeContext(query: string, maxResults = 5) {
  const results = await searchKnowledge(query, maxResults);
  return {
    results,
    context: results.map((result, index) => `[${index + 1}] ${result.source}\n${result.content}`).join('\n\n---\n\n'),
  };
}

export function createKnowledgeTool() {
  return tool({
    name: 'search_product_knowledge',
    description: '检索 ProductThink 内部产品、创业、增长和战略知识库。回答涉及案例、产品方法论、验证策略或历史经验时必须调用。',
    parameters: z.object({
      query: z.string().min(2).max(4_000).describe('适合检索的中文问题或关键词'),
      maxResults: z.number().int().min(1).max(8).optional(),
    }),
    async execute({ query, maxResults }) {
      const { results } = await getKnowledgeContext(query, maxResults || 5);
      if (!results.length) return '知识库没有匹配内容。请明确说明这是一条基于通用经验的建议。';
      return results.map((result, index) => `来源 ${index + 1}：${result.source}\n${result.content}`).join('\n\n---\n\n');
    },
  });
}
