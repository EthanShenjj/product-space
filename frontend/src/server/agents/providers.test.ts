import { afterEach, describe, expect, it } from 'vitest';
import { getProviderAttempts } from './providers';

const keys = [
  'GEMINI_API_KEY', 'CLOUDSWAY_API_KEY', 'VECTORENGINE_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY',
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('provider resolution', () => {
  it('keeps the approved provider fallback order', () => {
    process.env.OPENAI_API_KEY = 'test';
    process.env.OPENROUTER_API_KEY = 'test';
    process.env.VECTORENGINE_API_KEY = 'test';
    process.env.CLOUDSWAY_API_KEY = 'test';
    process.env.GEMINI_API_KEY = 'test';
    expect(getProviderAttempts().map((provider) => provider.name)).toEqual([
      'Gemini', 'Cloudsway', 'VectorEngine', 'OpenRouter', 'OpenAI',
    ]);
  });

  it('uses a custom model only for the current request and puts it first', () => {
    process.env.OPENAI_API_KEY = 'test';
    const attempts = getProviderAttempts({
      name: 'Temporary model', baseUrl: 'https://example.test/v1/chat/completions', apiKey: 'temporary', model: 'model-x',
    });
    expect(attempts[0]).toMatchObject({ name: 'Temporary model', model: 'model-x', baseUrl: 'https://example.test/v1' });
    expect(attempts.slice(1).map((provider) => provider.name)).toContain('OpenAI');
  });
});
