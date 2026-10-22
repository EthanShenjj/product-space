import { NEWS_SOURCES, emptyEdition, newsDate, type NewsEdition, type NewsFeed, type NewsSource } from '@/lib/product-news';
import { providers, SourceError, topProducts, type ProviderResult } from './providers';
import { createNewsStore, type NewsStore } from './store';

interface SyncOptions {
  now?: Date;
  force?: boolean;
  sources?: NewsSource[];
  store?: NewsStore;
  fetchers?: Record<NewsSource, (now: Date) => Promise<ProviderResult>>;
}

// A publishing window starts at 09:00 Asia/Shanghai (01:00 UTC).
function updateWindow(date: Date): number {
  return Math.floor((date.getTime() - 3_600_000) / 86_400_000);
}

function isCurrent(edition: NewsEdition, now: Date): boolean {
  return Boolean(edition.fetchedAt && ['ready', 'empty'].includes(edition.status)
    && updateWindow(new Date(edition.fetchedAt)) === updateWindow(now));
}

export async function readNewsFeed(options: SyncOptions = {}): Promise<NewsFeed> {
  const now = options.now || new Date();
  const date = newsDate(now);
  try {
    const store = options.store || createNewsStore();
    let editions = await store.read();
    if (store.readThrough) {
      const due = NEWS_SOURCES.filter(source => {
        const edition = editions.find(item => item.source === source);
        if (!edition) return true;
        if (isCurrent(edition, now)) return false;
        // Do not hammer unavailable or unconfigured APIs on every page view.
        return !edition.attemptedAt || now.getTime() - Date.parse(edition.attemptedAt) >= 15 * 60_000;
      });
      if (due.length) editions = (await syncNews({ ...options, now, store, sources: due })).editions;
    }
    return { date, editions: NEWS_SOURCES.map(source => editions.find(edition => edition.source === source) || emptyEdition(source)) };
  } catch (error) {
    console.error('[product-news] read failed', error instanceof Error ? error.message : 'unknown');
    return { date, editions: NEWS_SOURCES.map(emptyEdition), error: '资讯暂时无法加载，请稍后重试。' };
  }
}

export async function syncNews(options: SyncOptions = {}) {
  const now = options.now || new Date();
  const date = newsDate(now);
  const store = options.store || createNewsStore();
  const fetchers = options.fetchers || providers;
  const current = await store.read();
  const updated = await Promise.all(NEWS_SOURCES.map(async (source): Promise<NewsEdition | null> => {
    const previous = current.find(edition => edition.source === source) || emptyEdition(source);
    if (options.sources && !options.sources.includes(source)) return null;
    if (!options.force && isCurrent(previous, now)) return null;
    try {
      const result = await fetchers[source](now);
      const items = topProducts(Array.isArray(result) ? result : result.items);
      const note = Array.isArray(result) ? '' : result.message || '';
      return { source, items, editionDate: date, fetchedAt: now.toISOString(), attemptedAt: now.toISOString(),
        status: items.length ? 'ready' : 'empty', message: items.length ? note : '近 24 小时暂未发现符合条件的产品' };
    } catch (error) {
      return { ...previous, attemptedAt: now.toISOString(),
        status: error instanceof SourceError ? error.status : 'error',
        message: error instanceof SourceError ? error.message : '数据源更新失败，将在下次任务重试' };
    }
  }));
  const changes = updated.filter((edition): edition is NewsEdition => edition !== null);
  await store.write(changes);
  const editions = NEWS_SOURCES.map(source => changes.find(edition => edition.source === source) || current.find(edition => edition.source === source) || emptyEdition(source));
  const successful = editions.filter(edition => isCurrent(edition, now)).length;
  const unconfigured = editions.filter(edition => edition.status === 'unconfigured').length;
  return { date, editions, updated: changes.length, successful, ok: successful > 0 && successful + unconfigured === NEWS_SOURCES.length };
}
