import { createOpenAI } from '@ai-sdk/openai';
import { aisdk } from '@openai/agents-extensions/ai-sdk';
import type { Model } from '@openai/agents';
import { OpenAIResponsesModel } from '@openai/agents';
import OpenAI from 'openai';
import type { CustomModelConfig, ProviderAttempt } from './types';

const DEFAULT_ORDER = ['Gemini', 'Cloudsway', 'VectorEngine', 'OpenRouter', 'OpenAI'] as const;

function normalizeChatUrl(baseUrl: string) {
  const value = baseUrl.trim().replace(/\/$/, '');
  if (value.endsWith('/chat/completions')) return value.slice(0, -'/chat/completions'.length);
  return value;
}

function configuredProviders(): ProviderAttempt[] {
  const providers: ProviderAttempt[] = [];
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'Gemini',
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: normalizeChatUrl(process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai'),
      model: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
    });
  }
  if (process.env.CLOUDSWAY_API_KEY) {
    providers.push({
      name: 'Cloudsway',
      apiKey: process.env.CLOUDSWAY_API_KEY,
      baseUrl: normalizeChatUrl(process.env.CLOUDSWAY_BASE_URL || 'https://genaiapi.cloudsway.net/v1/ai/GMLRiwsNjqSYwmBE/chat/completions'),
      model: process.env.CLOUDSWAY_MODEL || 'MaaS_Sonnet_4',
    });
  }
  if (process.env.VECTORENGINE_API_KEY) {
    providers.push({
      name: 'VectorEngine',
      apiKey: process.env.VECTORENGINE_API_KEY,
      baseUrl: 'https://api.vectorengine.ai/v1',
      model: process.env.VECTORENGINE_MODEL || 'claude-sonnet-4-5-20250929',
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'OpenRouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
    });
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'OpenAI',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-5.4',
      nativeOpenAI: true,
    });
  }
  return providers.sort((a, b) => DEFAULT_ORDER.indexOf(a.name as (typeof DEFAULT_ORDER)[number]) - DEFAULT_ORDER.indexOf(b.name as (typeof DEFAULT_ORDER)[number]));
}

export function getProviderAttempts(custom?: CustomModelConfig): ProviderAttempt[] {
  const customProvider = custom?.baseUrl && custom.apiKey && custom.model
    ? [{
        name: custom.name?.trim() || 'Custom',
        apiKey: custom.apiKey,
        baseUrl: normalizeChatUrl(custom.baseUrl),
        model: custom.model,
      }]
    : [];
  return [...customProvider, ...configuredProviders()];
}

export function getActiveProviderNames() {
  return configuredProviders().map((provider) => provider.name);
}

export function getAgentModel(provider: ProviderAttempt): Model {
  if (provider.nativeOpenAI) {
    return new OpenAIResponsesModel(new OpenAI({ apiKey: provider.apiKey }), provider.model);
  }
  if (!provider.baseUrl || !provider.apiKey) {
    throw new Error(`Provider ${provider.name} is missing a base URL or API key`);
  }
  const client = createOpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
    name: provider.name.toLowerCase(),
    headers: provider.name === 'OpenRouter'
      ? {
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'ProductThink',
        }
      : undefined,
  });
  return aisdk(client.chat(provider.model));
}

export function hasOpenAIKnowledgeAccess() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_VECTOR_STORE_ID);
}
