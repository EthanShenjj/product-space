import { createClient } from '@supabase/supabase-js';
import { getCache } from '@vercel/functions';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { NEWS_SOURCES, type NewsEdition } from '@/lib/product-news';

const productSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(), url: z.string().url(), sourceUrl: z.string().url(),
  category: z.enum(['ai', 'software']), tags: z.array(z.string()), score: z.number(), metric: z.string(), author: z.string().optional(),
});
const editionSchema = z.object({
  source: z.enum(NEWS_SOURCES), items: z.array(productSchema).max(5), editionDate: z.string().nullable(), fetchedAt: z.string().nullable(),
  attemptedAt: z.string().nullable(), status: z.enum(['ready', 'empty', 'unconfigured', 'error', 'pending']), message: z.string(),
});

export interface NewsStore {
  // Rebuild disposable hosted snapshots on cache misses; durable stores stay read-only on page views.
  readThrough?: boolean;
  read(): Promise<NewsEdition[]>;
  write(editions: NewsEdition[]): Promise<void>;
}

export function createNewsStore(): NewsStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }),
    } });
    return {
      async read() {
        const { data, error } = await db.from('product_news_sources').select('source,edition');
        if (error) throw new Error(`Product news storage: ${error.code}`);
        return z.array(editionSchema).parse((data || []).map(row => row.edition));
      },
      async write(editions) {
        if (!editions.length) return;
        const { error } = await db.from('product_news_sources').upsert(editions.map(edition => ({ source: edition.source, edition })), { onConflict: 'source' });
        if (error) throw new Error(`Product news storage: ${error.code}`);
      },
    };
  }
  if (process.env.VERCEL) {
    const cache = getCache({ namespace: `productthink-news-v1:${process.env.VERCEL_PROJECT_ID || 'product-space'}` });
    return {
      readThrough: true,
      async read() {
        const editions = await Promise.all(NEWS_SOURCES.map(async source => {
          const value = await cache.get(source);
          if (value == null) return null;
          const parsed = editionSchema.safeParse(value);
          // A corrupt/old cache entry is a miss and can be reconstructed.
          return parsed.success && parsed.data.source === source ? parsed.data : null;
        }));
        return editions.filter((edition): edition is NewsEdition => edition !== null);
      },
      async write(editions) {
        await Promise.all(editions.map(edition => cache.set(edition.source, edition, {
          ttl: 7 * 86_400, name: `ProductThink ${edition.source} news`,
        })));
      },
    };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Product news requires Supabase credentials outside Vercel');

  // Local development cache. Hosted snapshots never use the function filesystem.
  const file = path.join(process.cwd(), 'data', '.product-news.json');
  return {
    async read() {
      try { return z.array(editionSchema).parse(JSON.parse(await readFile(file, 'utf8'))); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      }
    },
    async write(editions) {
      const current = await this.read();
      const merged = new Map(current.map(edition => [edition.source, edition]));
      editions.forEach(edition => merged.set(edition.source, edition));
      await mkdir(path.dirname(file), { recursive: true });
      const temp = `${file}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify([...merged.values()], null, 2), { mode: 0o600 });
      await rename(temp, file);
    },
  };
}
