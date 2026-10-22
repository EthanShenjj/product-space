import { NEWS_SOURCES, emptyEdition, newsDate, type NewsEdition, type NewsFeed, type NewsProduct, type NewsSource } from '@/lib/product-news';
import { providers, SourceError, topProducts } from './providers';
import { createNewsStore, type NewsStore } from './store';

export async function readNewsFeed(): Promise<NewsFeed> {
  const date = newsDate();
  try {
    const editions = await createNewsStore().read();
    return { date, editions: NEWS_SOURCES.map(source => editions.find(edition => edition.source === source) || emptyEdition(source)) };
  } catch (error) {
    console.error('[product-news] read failed', error instanceof Error ? error.message : 'unknown');
    return { date, editions: NEWS_SOURCES.map(emptyEdition), error: '资讯暂时无法加载，请检查数据存储配置后重试。' };
  }
}

export async function syncNews(options: {
  now?: Date;
  force?: boolean;
  store?: NewsStore;
  fetchers?: Record<NewsSource, (now: Date) => Promise<NewsProduct[]>>;
} = {}) {
  const now = options.now || new Date();
  const date = newsDate(now);
  const store = options.store || createNewsStore();
  const fetchers = options.fetchers || providers;
  const current = await store.read();
  const updated = await Promise.all(NEWS_SOURCES.map(async (source): Promise<NewsEdition | null> => {
    const previous = current.find(edition => edition.source === source) || emptyEdition(source);
    if (!options.force && previous.editionDate === date && ['ready', 'empty'].includes(previous.status)) return null;
    try {
      const items = topProducts(await fetchers[source](now));
      return { source, items, editionDate: date, fetchedAt: now.toISOString(), attemptedAt: now.toISOString(),
        status: items.length ? 'ready' : 'empty', message: items.length ? '' : '近 24 小时暂未发现符合条件的产品' };
    } catch (error) {
      return { ...previous, attemptedAt: now.toISOString(),
        status: error instanceof SourceError ? error.status : 'error',
        message: error instanceof SourceError ? error.message : '数据源更新失败，将在下次任务重试' };
    }
  }));
  const changes = updated.filter((edition): edition is NewsEdition => edition !== null);
  await store.write(changes);
  const editions = NEWS_SOURCES.map(source => changes.find(edition => edition.source === source) || current.find(edition => edition.source === source) || emptyEdition(source));
  const successful = editions.filter(edition => edition.editionDate === date && ['ready', 'empty'].includes(edition.status)).length;
  return { date, editions, updated: changes.length, successful, ok: successful === NEWS_SOURCES.length };
}
