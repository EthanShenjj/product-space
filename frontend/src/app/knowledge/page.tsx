'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { BookOpenText, ChevronRight, FileText, FolderOpen, LoaderCircle, Search, Sparkles, X } from 'lucide-react';
import cardsData from '@/data/cards.json';
import autoCardsData from '@/data/cards.auto.json';
import type { CardData } from '@/components/Cards/InsightCard';

type KnowledgeCard = CardData & { updatedAt?: string };
type SemanticResult = { source: string; content: string; score?: number };

function textOf(card: KnowledgeCard) {
  return [card.title, card.category, card.content, card.fullArticle, card.tags.join(' ')].join(' ').toLowerCase();
}

export default function KnowledgePage() {
  const [cmsCards, setCmsCards] = useState<KnowledgeCard[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [selected, setSelected] = useState<KnowledgeCard | null>(null);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetch('/api/cms/cards')
      .then((response) => response.ok ? response.json() : { cards: [] })
      .then((data) => setCmsCards(Array.isArray(data.cards) ? data.cards : []))
      .catch(() => setCmsCards([]));
  }, []);

  const documents = useMemo(() => {
    const seen = new Set<string>();
    return [...cmsCards, ...autoCardsData, ...cardsData].filter((card) => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    }) as KnowledgeCard[];
  }, [cmsCards]);

  const categories = useMemo(() => ['全部', ...Array.from(new Set(documents.map((card) => card.category).filter(Boolean)))], [documents]);
  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return documents.filter((card) => (
      (category === '全部' || card.category === category)
      && (!normalized || textOf(card).includes(normalized))
    ));
  }, [category, documents, query]);

  const semanticSearch = async () => {
    const searchQuery = query.trim();
    if (!searchQuery || isSearching) return;
    setIsSearching(true);
    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, k: 5 }),
      });
      const data = await response.json();
      setSemanticResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setSemanticResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 text-white shadow-sm sm:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-indigo-200"><BookOpenText size={15} /> KNOWLEDGE BASE</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">产品知识库</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">沉淀产品、增长、设计与 AI 的核心资料。先用关键词快速筛选，再用深度检索找到语义相关的原始片段。</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-left sm:min-w-64">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><p className="text-2xl font-semibold">{documents.length}</p><p className="mt-0.5 text-xs text-slate-300">已收录资料</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><p className="text-2xl font-semibold">{categories.length - 1}</p><p className="mt-0.5 text-xs text-slate-300">知识分类</p></div>
          </div>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={18} className="text-slate-400" />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setSemanticResults([]); }} onKeyDown={(event) => event.key === 'Enter' && void semanticSearch()} placeholder="搜索标题、正文或标签…" className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
            {query ? <button type="button" onClick={() => { setQuery(''); setSemanticResults([]); }} className="text-slate-400 hover:text-slate-700" aria-label="清除搜索"><X size={16} /></button> : null}
          </label>
          <button type="button" disabled={!query.trim() || isSearching} onClick={() => void semanticSearch()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isSearching ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} 深度检索
          </button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${category === item ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{item}</button>)}
        </div>
      </section>

      {semanticResults.length ? (
        <section className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950"><Sparkles size={16} className="text-indigo-600" /> 深度检索结果 <span className="font-normal text-indigo-600">{semanticResults.length} 条</span></div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {semanticResults.map((result, index) => <article key={`${result.source}-${index}`} className="rounded-xl border border-indigo-100 bg-white p-4"><p className="text-xs font-medium text-indigo-600">{result.source}</p><p className="mt-2 line-clamp-5 whitespace-pre-line text-sm leading-6 text-slate-600">{result.content}</p></article>)}
          </div>
        </section>
      ) : null}

      <section className="mt-7">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-900">全部资料</h2><p className="mt-1 text-sm text-slate-500">{visibleDocuments.length} 条匹配结果</p></div><FolderOpen size={20} className="text-slate-400" /></div>
        {visibleDocuments.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleDocuments.map((card) => <button key={card.id} type="button" onClick={() => setSelected(card)} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">{card.category}</span><ChevronRight size={17} className="mt-0.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" /></div>
            <h3 className="mt-4 line-clamp-2 text-base font-semibold leading-6 text-slate-900">{card.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{card.content}</p>
            <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400"><FileText size={13} /><span className="truncate">{card.source || card.author}</span></div>
          </button>)}
        </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">没有匹配资料，试试更宽泛的关键词或切换分类。</div>}
      </section>

      {selected ? <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/25" onClick={() => setSelected(null)}>
        <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">{selected.category}</span><h2 className="mt-4 text-2xl font-semibold leading-9 text-slate-900">{selected.title}</h2><p className="mt-2 text-sm text-slate-500">来源：{selected.source || selected.author}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="关闭资料"><X size={17} /></button></div>
          <article className="prose prose-slate mt-8 max-w-none prose-p:leading-7"><ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{selected.fullArticle || selected.content}</ReactMarkdown></article>
          {selected.tags.length ? <div className="mt-8 flex flex-wrap gap-2">{selected.tags.map((tag, index) => <span key={`${selected.id}-${tag}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">#{tag}</span>)}</div> : null}
        </aside>
      </div> : null}
    </main>
  );
}
