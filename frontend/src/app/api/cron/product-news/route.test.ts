import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';
import { GET } from './route';
import { syncNews } from '@/server/product-news/service';

vi.mock('@/server/product-news/service', () => ({ syncNews: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('rejects missing, incorrect and absent-server-secret authorization before fetching', async () => {
  vi.stubEnv('CRON_SECRET', 'expected');
  for (const token of ['', 'Bearer wrong', 'Bearer expected-and-more']) {
    const response = await GET(new NextRequest('http://localhost/api/cron/product-news', { headers: { authorization: token } }));
    expect(response.status).toBe(401);
  }
  vi.stubEnv('CRON_SECRET', '');
  expect((await GET(new NextRequest('http://localhost/api/cron/product-news', { headers: { authorization: 'Bearer ' } }))).status).toBe(401);
  expect(syncNews).not.toHaveBeenCalled();
});

it('runs authorized sync and surfaces partial failures to the scheduler', async () => {
  vi.stubEnv('CRON_SECRET', 'expected');
  vi.mocked(syncNews).mockResolvedValue({ date: '2026-10-21', editions: [], updated: 3, successful: 2, ok: false });
  const response = await GET(new NextRequest('http://localhost/api/cron/product-news', { headers: { authorization: 'Bearer expected' } }));
  expect(response.status).toBe(503);
  expect(syncNews).toHaveBeenCalledOnce();
});
