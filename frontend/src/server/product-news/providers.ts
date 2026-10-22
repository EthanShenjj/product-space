import { z } from 'zod';
import { type NewsProduct, type NewsSource, safeHttpUrl } from '@/lib/product-news';

const aiPattern = /\b(ai|llm|gpt|agents?|copilot|machine[- ]learning|artificial[- ]intelligence|generative|diffusion)\b|人工智能|大模型|智能体/i;
const softwarePattern = /\b(software|saas|developer[- ]tools?|productivity|apps?|automation|no[- ]code|design[- ]tools?|open[- ]source|web[- ]app|platform|coding|api|database|analytics)\b|软件|应用|工具/i;
const collectionPattern = /(?:^|[/\s_-])(awesome|tutorials?|courses?|interview|roadmap|cheatsheets?|books|papers|resources|examples|prompts)(?:$|[/\s_-])/i;
const categoryFor = (text: string) => aiPattern.test(text) ? 'ai' as const : 'software' as const;
const count = z.number().nonnegative().default(0);

export type ProviderResult = NewsProduct[] | { items: NewsProduct[]; message?: string };

export class SourceError extends Error {
  constructor(public status: 'unconfigured' | 'error', message: string) { super(message); }
}

async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new SourceError('error', '来源授权不可用，请检查 API 凭证和访问权限');
    if (response.status === 429) throw new SourceError('error', '来源请求额度已用完，等待下次更新');
    throw new SourceError('error', `来源暂时不可用（HTTP ${response.status}）`);
  }
  return response.json();
}

// Remove only known tracking parameters; preserve parameters that identify a product.
export function canonicalProductUrl(value: string): string | undefined {
  const safe = safeHttpUrl(value);
  if (!safe) return undefined;
  const url = new URL(safe);
  if (/(^|\.)(x\.com|twitter\.com|t\.co|youtube\.com|youtu\.be|instagram\.com|linkedin\.com|discord\.gg)$/.test(url.hostname)) return undefined;
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|ref|ref_src|source|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

export function topProducts(items: NewsProduct[]): NewsProduct[] {
  const seen = new Set<string>();
  return [...items].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).filter(item => {
    const key = canonicalProductUrl(item.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

const githubSchema = z.object({
  incomplete_results: z.boolean().optional(),
  items: z.array(z.object({
    id: z.number(), name: z.string(), full_name: z.string(), html_url: z.string(),
    description: z.string().nullable(), stargazers_count: count,
    language: z.string().nullable(), topics: z.array(z.string()).default([]),
    archived: z.boolean(), fork: z.boolean(), owner: z.object({ login: z.string() }),
  })),
});

export function parseGithub(input: unknown): NewsProduct[] {
  const response = githubSchema.parse(input);
  if (response.incomplete_results && !response.items.length) throw new SourceError('error', 'GitHub 搜索暂未完成，保留上次榜单');
  return topProducts(response.items.flatMap(repo => {
    const text = `${repo.name} ${repo.description || ''} ${repo.topics.join(' ')}`;
    if (!safeHttpUrl(repo.html_url) || !repo.language || repo.archived || repo.fork || collectionPattern.test(repo.name) || (!aiPattern.test(text) && !softwarePattern.test(text))) return [];
    return [{ id: String(repo.id), name: repo.full_name, description: repo.description || '查看项目源码与产品介绍',
      url: repo.html_url, sourceUrl: repo.html_url, category: categoryFor(text), tags: [repo.language, ...repo.topics].slice(0, 3),
      score: repo.stargazers_count, metric: 'Stars', author: repo.owner.login }];
  }));
}

async function github(now: Date): Promise<ProviderResult> {
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const headers = {
    Accept: 'application/vnd.github+json', 'User-Agent': 'ProductThink-News',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
  // Repository search does not implement grouped OR topic expressions. Search
  // independently and merge; each topic's top five is sufficient for the union's top five.
  const results = await Promise.allSettled(['ai', 'llm', 'saas', 'developer-tools', 'productivity', 'automation'].map(async topic => {
    const url = new URL('https://api.github.com/search/repositories');
    url.search = new URLSearchParams({
      q: `topic:${topic} pushed:>=${since} archived:false fork:false stars:>=10`,
      sort: 'stars', order: 'desc', per_page: '100',
    }).toString();
    const response = githubSchema.parse(await requestJson(url.href, { headers }));
    return { items: parseGithub(response), incomplete: response.incomplete_results };
  }));
  const available = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const items = topProducts(available.flatMap(result => result.items));
  const failed = results.find(result => result.status === 'rejected');
  if (!items.length && failed?.status === 'rejected') throw failed.reason;
  return {
    items,
    message: failed || available.some(result => result.incomplete) ? 'GitHub 部分主题搜索未返回完整候选，当前按已返回的产品排序。' : undefined,
  };
}

const phSchema = z.object({
  errors: z.array(z.unknown()).optional(),
  data: z.object({ posts: z.object({ nodes: z.array(z.object({
    id: z.string(), name: z.string(), tagline: z.string(), url: z.string(), website: z.string(), votesCount: count,
    topics: z.object({ nodes: z.array(z.object({ name: z.string(), slug: z.string() })) }),
  })) }) }).nullish(),
});

export function parseProductHunt(input: unknown): NewsProduct[] {
  const response = phSchema.parse(input);
  if (response.errors?.length || !response.data) throw new SourceError('error', 'Product Hunt 查询失败，请检查 API 权限');
  return topProducts(response.data.posts.nodes.flatMap(post => {
    const topics = post.topics.nodes.flatMap(topic => [topic.name, topic.slug]).join(' ');
    const text = `${post.name} ${post.tagline} ${topics}`;
    const url = safeHttpUrl(post.website) || safeHttpUrl(post.url);
    const sourceUrl = safeHttpUrl(post.url);
    if (!url || !sourceUrl || (!aiPattern.test(text) && !softwarePattern.test(text))) return [];
    return [{ id: post.id, name: post.name, description: post.tagline, url, sourceUrl,
      category: categoryFor(text), tags: post.topics.nodes.slice(0, 3).map(topic => topic.name), score: post.votesCount, metric: '票' }];
  }));
}

async function producthunt(now: Date): Promise<NewsProduct[]> {
  const token = process.env.PRODUCTHUNT_ACCESS_TOKEN;
  if (!token) throw new SourceError('unconfigured', '等待接入 Product Hunt 数据源');
  const end = now.toISOString();
  const start = new Date(now.getTime() - 86_400_000).toISOString();
  return parseProductHunt(await requestJson('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `query($start: DateTime!, $end: DateTime!) {
      posts(first: 100, order: VOTES, postedAfter: $start, postedBefore: $end) {
        nodes { id name tagline url website votesCount topics(first: 10) { nodes { name slug } } }
      }
    }`, variables: { start, end } }),
  }));
}

const xSchema = z.object({
  data: z.array(z.object({
    id: z.string(), text: z.string(), author_id: z.string().optional(),
    public_metrics: z.object({ like_count: count, retweet_count: count, reply_count: count, quote_count: count }),
    entities: z.object({ urls: z.array(z.object({
      expanded_url: z.string().optional(), unwound_url: z.string().optional(), title: z.string().optional(), description: z.string().optional(),
    })).optional() }).optional(),
  })).optional(),
  includes: z.object({ users: z.array(z.object({ id: z.string(), username: z.string() })).optional() }).optional(),
  meta: z.object({ result_count: z.number().optional() }).optional(),
  errors: z.array(z.unknown()).optional(),
});

export function parseX(input: unknown): NewsProduct[] {
  const response = xSchema.parse(input);
  if (response.errors?.length || (!response.data && response.meta?.result_count !== 0)) throw new SourceError('error', 'X 搜索结果不完整，请稍后重试');
  const users = new Map(response.includes?.users?.map(user => [user.id, user.username]));
  return topProducts((response.data || []).flatMap(post => {
    const link = post.entities?.urls?.map(entity => ({ ...entity, productUrl: canonicalProductUrl(entity.unwound_url || entity.expanded_url || '') })).find(entity => entity.productUrl);
    if (!link?.productUrl) return [];
    const text = `${post.text} ${link.title || ''} ${link.description || ''}`;
    if (!aiPattern.test(text) && !softwarePattern.test(text)) return [];
    if (!/\b(launch(?:ed|ing)?|introducing|release[d]?|built|shipping|announcing)\b|发布|上线|推出/i.test(post.text)) return [];
    const metrics = post.public_metrics;
    const author = users.get(post.author_id || '');
    return [{ id: post.id, name: link.title?.slice(0, 120) || new URL(link.productUrl).hostname,
      description: (link.description || post.text.replace(/https?:\/\/\S+/g, '').trim()).slice(0, 500),
      url: link.productUrl, sourceUrl: `https://x.com/${author || 'i'}/status/${post.id}`,
      category: categoryFor(text), tags: [categoryFor(text) === 'ai' ? 'AI 产品' : '软件产品', '产品发布'],
      score: metrics.like_count + metrics.retweet_count * 2 + metrics.quote_count * 2 + metrics.reply_count,
      metric: '互动热度', author: author ? `@${author}` : undefined }];
  }));
}

async function x(now: Date): Promise<NewsProduct[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new SourceError('unconfigured', '等待接入 X 数据源');
  // X requires end_time to be at least 10 seconds before the request.
  const end = new Date(now.getTime() - 30_000);
  const url = new URL('https://api.x.com/2/tweets/search/recent');
  url.search = new URLSearchParams({
    query: '(AI OR software OR SaaS OR app OR "developer tool") (launch OR launched OR introducing OR released OR shipping OR built) has:links -is:retweet -is:reply',
    max_results: '100', sort_order: 'relevancy', start_time: new Date(end.getTime() - 86_400_000).toISOString(), end_time: end.toISOString(),
    'tweet.fields': 'public_metrics,entities,author_id,created_at', expansions: 'author_id', 'user.fields': 'username',
  }).toString();
  return parseX(await requestJson(url.href, { headers: { Authorization: `Bearer ${token}` } }));
}

export const providers: Record<NewsSource, (now: Date) => Promise<ProviderResult>> = { x, producthunt, github };
