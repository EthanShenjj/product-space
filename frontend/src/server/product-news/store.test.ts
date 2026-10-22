import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getCache } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';
import { emptyEdition } from '@/lib/product-news';
import { createNewsStore } from './store';

vi.mock('@vercel/functions', () => ({ getCache: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

beforeEach(() => {
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('VERCEL_PROJECT_ID', 'test-project');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('uses project-scoped hosted cache without database credentials and recovers corrupt entries', async () => {
  const cache = { get: vi.fn(async (source: string) => source === 'github' ? emptyEdition('github') : source === 'x' ? { broken: true } : null),
    set: vi.fn(), delete: vi.fn(), expireTag: vi.fn() };
  vi.mocked(getCache).mockReturnValue(cache);
  const store = createNewsStore();
  expect(store.readThrough).toBe(true);
  expect(getCache).toHaveBeenCalledWith({ namespace: 'productthink-news-v1:test-project' });
  expect(await store.read()).toEqual([emptyEdition('github')]);
  await store.write([emptyEdition('x')]);
  expect(cache.set).toHaveBeenCalledWith('x', emptyEdition('x'), expect.objectContaining({ ttl: 604800 }));
  expect(createClient).not.toHaveBeenCalled();
});

it('keeps Supabase as the primary store when complete credentials are configured', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  const store = createNewsStore();
  expect(store.readThrough).not.toBe(true);
  expect(createClient).toHaveBeenCalledOnce();
  expect(getCache).not.toHaveBeenCalled();
});
