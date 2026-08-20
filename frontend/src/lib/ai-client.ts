/**
 * AI API 客户端 - 支持多个 API 提供商的自动切换
 * 优先使用 Gemini，失败时自动切换到下一个提供商
 */

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIRequestOptions {
  messages: Message[];
  stream?: boolean;
  model?: string;
  preferredProvider?: 'Cloudsway' | 'VectorEngine' | 'OpenRouter';
  customModel?: CustomAIModelConfig;
}

interface CustomAIModelConfig {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

interface AIProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  headers: Record<string, string>;
  authHeaders?: Record<string, string>;
}

// Gemini 免费版速率限制：5 RPM，12s 间隔保证不超限
let lastGeminiCallTime = 0;
const GEMINI_MIN_INTERVAL_MS = 13_000; // 13s to be safe

async function rateLimitedFetch(
  provider: AIProvider,
  options: AIRequestOptions,
): Promise<Response> {
  const isGemini = provider.name === 'Gemini';

  if (isGemini) {
    const now = Date.now();
    const elapsed = now - lastGeminiCallTime;
    if (elapsed < GEMINI_MIN_INTERVAL_MS) {
      const waitMs = GEMINI_MIN_INTERVAL_MS - elapsed;
      console.log(`[AI Client] Gemini rate limit: waiting ${(waitMs / 1000).toFixed(0)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    lastGeminiCallTime = Date.now();
  }

  const requestHeaders: Record<string, string> = {
    ...provider.headers,
  };
  if (provider.apiKey) {
    requestHeaders['Authorization'] = `Bearer ${provider.apiKey}`;
  }
  if (provider.authHeaders) {
    Object.assign(requestHeaders, provider.authHeaders);
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(provider.baseUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        model: options.model || provider.model,
        messages: options.messages,
        stream: options.stream ?? true,
      }),
    });

    if (response.ok) return response;

    // 429 限流：等待后重试而非直接切换 provider
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const waitSeconds = (attempt + 1) * 15;
      console.warn(`[AI Client] ${provider.name} 429 rate limited, retrying in ${waitSeconds}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      continue;
    }

    // 非 429 或重试次数用完：抛出错误切换下一个 provider
    const errorBody = await response.text();
    throw new Error(`${provider.name} API error: ${response.status} - ${errorBody}`);
  }

  throw new Error(`${provider.name} exhausted retries after 429`);
}

function normalizeChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return trimmed;
}

function getProviders(
  preferredProvider?: AIRequestOptions['preferredProvider'],
  customModel?: CustomAIModelConfig,
): AIProvider[] {
  const providers: AIProvider[] = [];

  if (customModel?.baseUrl && customModel.apiKey && customModel.model) {
    providers.push({
      name: customModel.name || 'Custom',
      baseUrl: normalizeChatCompletionsUrl(customModel.baseUrl),
      apiKey: customModel.apiKey,
      model: customModel.model,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // 最优先使用 Gemini
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'Gemini',
      baseUrl: (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai/').replace(/\/$/, '') + '/chat/completions',
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_CHAT_MODEL || 'gemini-3-flash-preview',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // 其次使用 Cloudsway
  if (process.env.CLOUDSWAY_API_KEY) {
    providers.push({
      name: 'Cloudsway',
      baseUrl: process.env.CLOUDSWAY_BASE_URL || 'https://genaiapi.cloudsway.net/v1/ai/GMLRiwsNjqSYwmBE/chat/completions',
      model: process.env.CLOUDSWAY_MODEL || 'MaaS_Sonnet_4',
      headers: {
        'Content-Type': 'application/json',
      },
      authHeaders: {
        'Authorization': `Bearer ${process.env.CLOUDSWAY_API_KEY}`,
      },
    });
  }

  // 其次使用 VectorEngine
  if (process.env.VECTORENGINE_API_KEY) {
    providers.push({
      name: 'VectorEngine',
      baseUrl: 'https://api.vectorengine.ai/v1/chat/completions',
      apiKey: process.env.VECTORENGINE_API_KEY,
      model: 'claude-sonnet-4-5-20250929',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // OpenRouter 作为备用
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'anthropic/claude-3.5-sonnet',
      headers: {
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'ProductThink',
      },
    });
  }

  if (preferredProvider) {
    return providers
      .filter(p => p.name === preferredProvider)
      .concat(providers.filter(p => p.name !== preferredProvider));
  }

  return providers;
}

export async function createAICompletion(options: AIRequestOptions): Promise<{
  response: Response;
  provider: string;
}> {
  const providers = getProviders(options.preferredProvider, options.customModel);

  if (providers.length === 0) {
    throw new Error('No AI API key configured');
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`[AI Client] Trying ${provider.name}...`);
      const response = await rateLimitedFetch(provider, options);
      console.log(`[AI Client] ${provider.name} succeeded`);
      return { response, provider: provider.name };
    } catch (error) {
      console.error(`[AI Client] ${provider.name} request failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('All AI providers failed');
}

// 非流式请求的便捷方法
export async function createAICompletionJson(options: Omit<AIRequestOptions, 'stream'>): Promise<{
  content: string;
  provider: string;
}> {
  const { response, provider } = await createAICompletion({
    ...options,
    stream: false,
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return { content, provider };
}

export function getActiveProviders(): string[] {
  return getProviders().map(p => p.name);
}
