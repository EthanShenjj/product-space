import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyEdition, newsDate, type NewsEdition, type NewsProduct } from '@/lib/product-news';
import { canonicalProductUrl, parseGithub, parseProductHunt, parseX, providers, SourceError, topProducts } from './providers';
import { syncNews } from './service';
import type { NewsStore } from './store';

const now = new Date('2026-10-21T01:00:00Z');
const product = (id: string, score = 1): NewsProduct => ({ id, name: id, description: 'AI app', url: `https://${id}.example.com`, sourceUrl: `https://${id}.example.com`, score, metric: 'Stars', category: 'ai', tags: ['AI'] });
function memoryStore(initial: NewsEdition[] = []) {
  let rows = initial;
  return {
    read: vi.fn(async () => rows),
    write: vi.fn(async (editions: NewsEdition[]) => {
      const merged = new Map(rows.map(row => [row.source, row]));
      editions.forEach(row => merged.set(row.source, row));
      rows = [...merged.values()];
    }),
  } satisfies NewsStore;
}
const fetchers = () => ({
  x: vi.fn(async () => [product('x')]),
  producthunt: vi.fn(async () => [product('producthunt')]),
  github: vi.fn(async () => [product('github')]),
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('normalization and ranking', () => {
  it('uses the Shanghai calendar date at the UTC day boundary', () => {
    expect(newsDate(new Date('2026-10-20T16:00:00Z'))).toBe('2026-10-21');
    expect(newsDate(new Date('2026-10-20T15:59:59Z'))).toBe('2026-10-20');
  });
  it('ranks by score, deduplicates tracking URLs, and keeps at most five', () => {
    const products = Array.from({ length: 7 }, (_, i) => product(`p${i}`, i));
    products.push({ ...product('copy', 100), url: 'https://p6.example.com/?utm_source=x' });
    const result = topProducts(products);
    expect(result).toHaveLength(5);
    expect(result.map(item => item.id)).toEqual(['copy', 'p5', 'p4', 'p3', 'p2']);
  });
  it('rejects unsafe and social URLs without removing meaningful product parameters', () => {
    expect(canonicalProductUrl('javascript:alert(1)')).toBeUndefined();
    expect(canonicalProductUrl('https://x.com/foo/status/1')).toBeUndefined();
    expect(canonicalProductUrl('https://www.example.com/?product=1&utm_source=x#top')).toBe('https://example.com/?product=1');
  });
  it('filters GitHub collections, forks, archives, and repositories without code', () => {
    const repo = { id: 1, name: 'tool', full_name: 'maker/tool', html_url: 'https://github.com/maker/tool', description: 'AI app', stargazers_count: 150, language: 'TypeScript', topics: ['ai'], archived: false, fork: false, owner: { login: 'maker' } };
    expect(parseGithub({ items: [repo, { ...repo, id: 2, name: 'awesome-ai' }, { ...repo, id: 3, fork: true }, { ...repo, id: 4, archived: true }, { ...repo, id: 5, language: null }] })).toEqual([expect.objectContaining({ id: '1', category: 'ai', score: 150 })]);
    expect(() => parseGithub({ items: [], incomplete_results: true })).toThrow();
  });
  it('filters Product Hunt nonsoftware entries and handles GraphQL errors', () => {
    const post = { id: '1', name: 'Desk', tagline: 'A wooden desk', url: 'https://www.producthunt.com/posts/desk', website: 'https://desk.example.com', votesCount: 500, topics: { nodes: [{ name: 'Furniture', slug: 'furniture' }] } };
    expect(parseProductHunt({ data: { posts: { nodes: [post, { ...post, id: '2', name: 'Writer', tagline: 'AI writing app', website: 'https://writer.example.com' }] } } })).toEqual([expect.objectContaining({ id: '2', category: 'ai' })]);
    expect(() => parseProductHunt({ errors: [{ message: 'private detail' }] })).toThrow('Product Hunt 查询失败');
  });
  it('extracts X products from launch posts, deduplicates links, and ranks engagement', () => {
    const post = { id: '1', text: 'Introducing an AI app', author_id: 'u1', public_metrics: { like_count: 10, retweet_count: 2, quote_count: 1, reply_count: 3 }, entities: { urls: [{ expanded_url: 'https://app.example.com/?utm_source=x', title: 'Useful AI' }] } };
    const result = parseX({ data: [post, { ...post, id: '2', public_metrics: { ...post.public_metrics, like_count: 1 } }, { ...post, id: '3', text: 'AI is the future', entities: { urls: [{ expanded_url: 'https://other.example.com' }] } }], includes: { users: [{ id: 'u1', username: 'maker' }] } });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '1', name: 'Useful AI', url: 'https://app.example.com/', score: 19, sourceUrl: 'https://x.com/maker/status/1' });
    expect(parseX({ meta: { result_count: 0 } })).toEqual([]);
    expect(() => parseX({ errors: [{}] })).toThrow();
  });
});

describe('daily synchronization', () => {
  it('isolates source failures and preserves the last successful edition', async () => {
    const previous: NewsEdition = { ...emptyEdition('x'), items: [product('old')], fetchedAt: '2026-10-20T01:00:00Z', editionDate: '2026-10-20', status: 'ready' };
    const store = memoryStore([previous]);
    const sourceFetchers = fetchers();
    sourceFetchers.x.mockRejectedValue(new SourceError('error', '来源暂时不可用'));
    const result = await syncNews({ now, store, fetchers: sourceFetchers });
    expect(result.ok).toBe(false);
    expect(result.successful).toBe(2);
    expect(result.editions[0]).toMatchObject({ items: previous.items, fetchedAt: previous.fetchedAt, editionDate: '2026-10-20', status: 'error' });
    expect((await store.read()).find(row => row.source === 'github')?.items).toHaveLength(1);
  });
  it('skips successful sources on duplicate runs and retries failed sources', async () => {
    const store = memoryStore();
    const sourceFetchers = fetchers();
    sourceFetchers.x.mockRejectedValueOnce(new Error('network failure'));
    await syncNews({ now, store, fetchers: sourceFetchers });
    const result = await syncNews({ now, store, fetchers: sourceFetchers });
    expect(result.ok).toBe(true);
    expect(sourceFetchers.github).toHaveBeenCalledTimes(1);
    expect(sourceFetchers.x).toHaveBeenCalledTimes(2);
    expect((await syncNews({ now, store, fetchers: sourceFetchers })).updated).toBe(0);
  });
  it('records a genuine empty result and does not reuse yesterday’s items as today’s', async () => {
    const store = memoryStore([{ ...emptyEdition('x'), items: [product('old')], editionDate: '2026-10-20', status: 'ready' }]);
    const sourceFetchers = fetchers();
    sourceFetchers.x.mockResolvedValue([]);
    const result = await syncNews({ now, store, fetchers: sourceFetchers });
    expect(result.editions[0]).toMatchObject({ items: [], editionDate: '2026-10-21', status: 'empty' });
    expect(result.ok).toBe(true);
  });
  it('reports missing credentials without making requests', async () => {
    vi.stubEnv('X_BEARER_TOKEN', ''); vi.stubEnv('PRODUCTHUNT_ACCESS_TOKEN', '');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(providers.x(now)).rejects.toMatchObject({ status: 'unconfigured' });
    await expect(providers.producthunt(now)).rejects.toMatchObject({ status: 'unconfigured' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('searches GitHub topics independently, then merges and deduplicates candidates', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ items: [{
      id: 1, name: 'ai-app', full_name: 'maker/ai-app', html_url: 'https://github.com/maker/ai-app',
      description: 'AI software', stargazers_count: 200, language: 'TypeScript', topics: ['ai'], archived: false, fork: false, owner: { login: 'maker' },
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', request);
    expect(await providers.github(now)).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(6);
    for (const [url] of request.mock.calls as unknown as [string][]) {
      expect(new URL(url).searchParams.get('q')).toMatch(/^topic:[\w-]+ pushed:>=2026-10-20T01:00:00.000Z/);
      expect(new URL(url).searchParams.get('q')).not.toContain(' OR ');
    }
  });
  it('does not report success when persistence fails', async () => {
    const store = memoryStore();
    store.write.mockRejectedValue(new Error('database unavailable'));
    await expect(syncNews({ now, store, fetchers: fetchers() })).rejects.toThrow('database unavailable');
  });
});
