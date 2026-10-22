'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Check, Clock3, Code2, Github, MessageCircle, Newspaper, RefreshCw, Search, Sparkles, Trophy } from 'lucide-react';
import { useAgentPanel } from '@/components/AgentPanelProvider';
import { NEWS_SOURCES, SOURCE_INFO, type NewsEdition, type NewsFeed, type NewsProduct, type NewsSource, safeHttpUrl } from '@/lib/product-news';

const sourceIcons = { x: MessageCircle, producthunt: Trophy, github: Github };
const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink';
const formatScore = (score: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(score);

function ProductCard({ product, rank }: { product: NewsProduct; rank: number }) {
  const url = safeHttpUrl(product.url);
  const sourceUrl = safeHttpUrl(product.sourceUrl);
  return (
    <article className="flex min-w-0 flex-col rounded-2xl bg-surface p-5 shadow-card transition-shadow hover:shadow-float motion-reduce:transition-none sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="font-serif text-2xl text-ink-secondary tabular-nums">{String(rank).padStart(2, '0')}<span className="sr-only"> 名</span></span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${product.category === 'ai' ? 'bg-score-bg text-score' : 'bg-surface-sunken text-ink-secondary'}`}>
          {product.category === 'ai' ? <Sparkles size={12} aria-hidden="true" /> : <Code2 size={12} aria-hidden="true" />}
          {product.category === 'ai' ? 'AI 产品' : '软件产品'}
        </span>
      </div>
      <h3 className="mb-3 break-words font-serif text-xl leading-snug text-ink">
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className={`group inline-flex max-w-full items-start gap-2 hover:underline underline-offset-4 ${focusStyle}`}>
          <span className="min-w-0 [overflow-wrap:anywhere]">{product.name}</span><ArrowUpRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-ink-secondary" />
          <span className="sr-only">（在新标签页打开）</span>
        </a> : product.name}
      </h3>
      <p className="mb-5 line-clamp-4 whitespace-pre-line break-words text-sm leading-7 text-ink-secondary">{product.description}</p>
      <div className="mb-5 mt-auto flex flex-wrap gap-1.5">
        {product.tags.map(tag => <span key={tag} className="max-w-full truncate rounded-full border border-hairline px-2.5 py-1 text-xs text-ink-secondary">{tag}</span>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4 text-xs text-ink-secondary">
        <span title={product.score.toLocaleString('zh-CN')}><span className="font-semibold text-ink tabular-nums">{formatScore(product.score)}</span> {product.metric}</span>
        {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-1 underline underline-offset-4 hover:text-ink ${focusStyle}`}>查看来源 <ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only">（在新标签页打开）</span></a> : null}
      </div>
    </article>
  );
}

function SourceSection({ edition, date, category, search }: { edition: NewsEdition; date: string; category: string; search: string }) {
  const info = SOURCE_INFO[edition.source];
  const Icon = sourceIcons[edition.source];
  const stale = Boolean(edition.editionDate && edition.editionDate !== date);
  const items = edition.items.map((product, index) => ({ product, rank: index + 1 })).filter(({ product }) =>
    (category === 'all' || product.category === category) && `${product.name} ${product.description} ${product.tags.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const statusText = stale ? `${edition.editionDate} 榜单` : edition.status === 'ready' ? '今日已更新' : edition.status === 'empty' ? '今日已检查' : edition.status === 'error' ? '更新暂时失败' : edition.status === 'unconfigured' ? '等待接入' : '等待更新';
  return (
    <section className="mb-12 scroll-mt-24" aria-labelledby={`${edition.source}-heading`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-surface"><Icon size={21} aria-hidden="true" /></span>
          <div><h2 id={`${edition.source}-heading`} className="font-serif text-2xl">{info.name} <span className="ml-2 font-sans text-xs font-medium tracking-wider text-ink-secondary">TOP 5</span></h2><p className="mt-1 text-xs text-ink-secondary">{info.caption}</p></div>
        </div>
        <div className="text-right text-xs text-ink-secondary">
          <span className="inline-flex items-center gap-1.5">{edition.status === 'ready' && !stale ? <Check size={13} aria-hidden="true" className="text-score" /> : <Clock3 size={13} aria-hidden="true" />}{statusText}</span>
          {edition.fetchedAt ? <p className="mt-1 tabular-nums">采集于 {new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(edition.fetchedAt))}</p> : null}
        </div>
      </div>
      {edition.items.length > 0 && (stale || ['error', 'unconfigured'].includes(edition.status)) ? <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-sm text-ink-secondary">{edition.message || '今日榜单尚未更新'}，当前展示上次成功采集的内容。</p> : null}
      {items.length ? (
        <div className="news-card-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map(({ product, rank }) => <ProductCard key={product.id} product={product} rank={rank} />)}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface/60 px-6 py-10 text-center">
          <Icon size={24} aria-hidden="true" className="mx-auto mb-3 text-ink-secondary" />
          <p className="text-sm font-medium">{edition.items.length ? '没有匹配的产品' : edition.message || '等待首次更新'}</p>
          <p className="mt-2 text-xs leading-6 text-ink-secondary">{edition.items.length ? '试试其他关键词，或切换到全部产品。' : edition.status === 'unconfigured' ? '数据源接入后，将在这里展示每日精选产品。' : '每天北京时间 09:00 计划更新，有结果后将在这里展示。'}</p>
        </div>
      )}
      <p className="mt-4 text-xs leading-6 text-ink-secondary">{info.rule}</p>
    </section>
  );
}

export default function NewsBoard({ initialFeed }: { initialFeed: NewsFeed }) {
  const [feed, setFeed] = useState(initialFeed);
  const [source, setSource] = useState<NewsSource | 'all'>('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [notice, setNotice] = useState('');
  const editions = feed.editions.filter(edition => source === 'all' || edition.source === source);
  const allProducts = feed.editions.flatMap(edition => edition.items);
  const todayCount = feed.editions.filter(edition => edition.editionDate === feed.date).reduce((sum, edition) => sum + edition.items.length, 0);
  const agentConfig = useMemo(() => ({
    title: '产品资讯助理', description: '从新产品中发现用户需求、差异化与验证方向。',
    pageContext: `用户正在浏览产品资讯。当前页面日期：${feed.date}。已采集产品（仅根据已有信息分析，不补造榜单）：${feed.editions.map(edition => `${SOURCE_INFO[edition.source].name}，数据日期 ${edition.editionDate || '暂无'}：${edition.items.map(item => `${item.name}：${item.description}`).join('；')}`).join('\n')}`,
    prompts: ['这些产品解决了哪些新需求？', '帮我分析一个产品的差异化', '从今天的产品中寻找创业灵感'],
  }), [feed]);
  useAgentPanel(agentConfig);

  async function refresh() {
    setRefreshing(true); setRefreshError(''); setNotice('');
    try {
      const response = await fetch('/api/product-news', { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error('资讯加载失败，请稍后重试。');
      setFeed(await response.json());
      setNotice('已读取最新榜单；数据源按每日计划更新。');
    } catch { setRefreshError('资讯加载失败，请稍后重试。当前保留已展示的内容。'); }
    finally { setRefreshing(false); }
  }

  return (
    <div className="agent-page-layout">
      <div className="news-page-content mx-auto w-full max-w-6xl px-4 py-8 pb-24 sm:py-12 sm:pb-24">
        <header className="mb-8 flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-widest text-ink-secondary"><Newspaper size={15} aria-hidden="true" /> PRODUCT RADAR / 每日产品观察</p>
            <h1 className="mb-4 text-balance font-serif text-4xl tracking-tight sm:text-5xl">下一款好产品，<br className="sm:hidden" />从这里发现。</h1>
            <p className="max-w-xl text-sm leading-7 text-ink-secondary">每天从 X、Product Hunt 和 GitHub，<br className="hidden sm:block" />发现值得关注的软件与 AI 产品。每个来源，精选 Top 5。</p>
          </div>
          <div className="flex shrink-0 items-center gap-7 border-l border-hairline-strong pl-5">
            <div><p className="mb-2 text-xs text-ink-secondary">今日收录</p><p className="font-serif text-3xl tabular-nums">{todayCount}<span className="ml-1 font-sans text-xs text-ink-secondary">/ 15</span></p></div>
            <div><p className="mb-2 text-xs text-ink-secondary">北京时间</p><p className="text-sm font-medium tabular-nums">{feed.date.replaceAll('-', '.')}</p><p className="mt-1 text-xs text-ink-secondary">每日 09:00 计划更新</p></div>
          </div>
        </header>

        <div className="mb-8 rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex max-w-full flex-wrap gap-1" role="group" aria-label="资讯来源">
              {(['all', ...NEWS_SOURCES] as const).map(value => <button key={value} type="button" aria-pressed={source === value} onClick={() => setSource(value)} className={`min-h-11 rounded-full px-3 text-sm transition-colors ${focusStyle} ${source === value ? 'bg-ink text-paper' : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'}`}>{value === 'all' ? '全部来源' : SOURCE_INFO[value].name}</button>)}
            </div>
            <button type="button" disabled={refreshing} onClick={refresh} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs text-ink-secondary hover:bg-surface-sunken disabled:opacity-50 ${focusStyle}`}><RefreshCw size={14} aria-hidden="true" className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />{refreshing ? '读取中…' : '刷新榜单'}</button>
          </div>
          <div className="mt-4 flex flex-col justify-between gap-4 border-t border-hairline pt-4 sm:flex-row sm:items-center">
            <div className="flex gap-2" role="group" aria-label="产品类型">{[{ value: 'all', label: '全部产品' }, { value: 'ai', label: 'AI 产品' }, { value: 'software', label: '软件产品' }].map(item => <button key={item.value} type="button" aria-pressed={category === item.value} onClick={() => setCategory(item.value)} className={`min-h-11 rounded-full border px-3 text-xs ${focusStyle} ${category === item.value ? 'border-ink text-ink' : 'border-transparent text-ink-secondary hover:border-hairline'}`}>{item.label}</button>)}</div>
            <div className="relative w-full sm:w-64"><Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" /><label htmlFor="news-search" className="sr-only">搜索产品、介绍或标签</label><input id="news-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索产品、介绍或标签" className="input-field min-h-11 rounded-full py-2 pr-3 pl-9 text-sm placeholder:text-ink-secondary" /></div>
          </div>
        </div>

        <div role="status" aria-live="polite" className="mb-5 text-sm text-ink-secondary">
          {feed.error || refreshError ? <p className="rounded-xl border border-danger/30 bg-surface p-4 text-danger">{refreshError || feed.error}</p> : notice ? <p>{notice}</p> : <p className="flex items-center gap-2"><ArrowDown size={14} aria-hidden="true" />{allProducts.length ? `已收录 ${allProducts.length} 个产品 · 各来源独立排名` : '等待数据源首次采集 · 各来源独立排名'}</p>}
        </div>
        <div aria-busy={refreshing}>{editions.map(edition => <SourceSection key={edition.source} edition={edition} date={feed.date} category={category} search={search} />)}</div>
        <footer className="border-t border-hairline pt-6 text-xs leading-6 text-ink-secondary">记录产品的变化，也寻找新的可能。榜单基于各平台公开数据与候选筛选，热度不等于产品质量。候选不足 5 个时展示实际数量。</footer>
      </div>
    </div>
  );
}
