export const NEWS_SOURCES = ['x', 'producthunt', 'github'] as const;
export type NewsSource = typeof NEWS_SOURCES[number];
export type NewsCategory = 'ai' | 'software';
export type NewsStatus = 'ready' | 'empty' | 'unconfigured' | 'error' | 'pending';

export const SOURCE_INFO = {
  x: { name: 'X', caption: '发现正在被讨论的产品', rule: '近 24 小时含产品链接的发布帖，按点赞 + 转发 × 2 + 引用 × 2 + 回复排序；同一产品链接去重，取搜索候选中的前 5。' },
  producthunt: { name: 'Product Hunt', caption: '新产品的第一站', rule: '近 24 小时发布的软件与 AI 产品，按 Product Hunt 票数排序，取前 100 个候选中符合条件的前 5。' },
  github: { name: 'GitHub', caption: '从开源社区看下一波趋势', rule: '近 24 小时有代码更新的 AI、SaaS、开发工具与应用项目，排除资料合集和教程，按总 Star 数排序；不是当日新增 Star 榜。' },
} satisfies Record<NewsSource, { name: string; caption: string; rule: string }>;

export interface NewsProduct {
  id: string;
  name: string;
  description: string;
  url: string;
  sourceUrl: string;
  category: NewsCategory;
  tags: string[];
  score: number;
  metric: string;
  author?: string;
}

export interface NewsEdition {
  source: NewsSource;
  items: NewsProduct[];
  editionDate: string | null;
  fetchedAt: string | null;
  attemptedAt: string | null;
  status: NewsStatus;
  message: string;
}

export interface NewsFeed {
  date: string;
  editions: NewsEdition[];
  error?: string;
}

export function newsDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function emptyEdition(source: NewsSource): NewsEdition {
  return { source, items: [], editionDate: null, fetchedAt: null, attemptedAt: null, status: 'pending', message: '等待首次更新' };
}

export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
