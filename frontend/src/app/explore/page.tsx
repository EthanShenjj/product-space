'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import cardsData from '@/data/cards.json';
import autoCardsData from '@/data/cards.auto.json';
import InsightCard, { CardData } from '@/components/Cards/InsightCard';
import { trackCardClick } from '@/lib/tracking';
import { type AgentPanelConfig, useAgentPanel } from '@/components/AgentPanelProvider';

export default function ExplorePage() {
    const [cmsCards, setCmsCards] = useState<CardData[]>([]);
    const [cmsError, setCmsError] = useState('');

    useEffect(() => {
        let active = true;
        const loadCmsCards = async () => {
            try {
                const res = await fetch('/api/cms/cards');
                if (!res.ok) {
                    throw new Error('加载 CMS 内容失败');
                }
                const data = await res.json();
                if (active) {
                    setCmsCards(Array.isArray(data.cards) ? data.cards : []);
                }
            } catch (error) {
                if (active) {
                    setCmsError(error instanceof Error ? error.message : '加载 CMS 内容失败');
                }
            }
        };
        loadCmsCards();
        return () => {
            active = false;
        };
    }, []);


    const combinedCards = useMemo(() => [...cmsCards, ...autoCardsData, ...cardsData] as CardData[], [cmsCards]);
    const categories = useMemo(() => {
        const unique = new Set(combinedCards.map(card => card.category).filter(Boolean));
        return ['全部', ...Array.from(unique)];
    }, [combinedCards]);

    const [activeCategory, setActiveCategory] = useState('全部');
    const [activeCard, setActiveCard] = useState<CardData | null>(null);

    const filteredCards = useMemo(() => {
        if (activeCategory === '全部') return combinedCards;
        return combinedCards.filter(card => card.category === activeCategory);
    }, [activeCategory, combinedCards]);

    const agentPanel = useMemo<AgentPanelConfig>(() => ({
        title: '灵感探索助理',
        description: '把一条灵感转成可验证的产品假设，而不止停留在收藏。',
        pageContext: `用户正在浏览 ProductThink 灵感火花页面。${activeCard ? `当前阅读的灵感是《${activeCard.title}》，分类为「${activeCard.category}」，内容摘要：${activeCard.content}` : '用户尚未打开具体灵感。'} 帮用户将灵感联系到真实用户、场景、假设与下一步验证。`,
        prompts: activeCard ? [`把《${activeCard.title}》转成一个产品假设`, '这条灵感最适合解决什么用户问题？', '如何用一周验证这条灵感是否成立？'] : ['帮我把一个产品灵感变成可验证假设', '这批灵感里适合冷启动的思路是什么？', '我想找一个能改善用户留存的灵感方向'],
    }), [activeCard]);
    useAgentPanel(agentPanel);

    return (
        <div className="agent-page-layout">
        <div className="explore-page-content mx-auto w-full max-w-5xl px-4 py-8">
            <header className="mb-6 text-center">
                <h1 className="font-serif text-3xl text-ink mb-2">灵感火花</h1>
                <p className="text-ink-secondary max-w-xl mx-auto">
                    来自全球顶尖产品领袖的核心洞察与心智模型
                </p>
                {cmsError ? (
                    <p className="text-xs text-danger mt-2">{cmsError}</p>
                ) : null}
            </header>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
                {categories.map(category => (
                    <button
                        key={category}
                        onClick={() => setActiveCategory(category)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                            activeCategory === category
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-surface text-ink-secondary border-hairline hover:border-hairline-strong hover:text-ink'
                        }`}
                    >
                        {category}
                    </button>
                ))}
            </div>

            <div className="explore-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCards.map((card) => (
                    <InsightCard
                        key={card.id}
                        card={card}
                        onClick={(selected) => {
                            trackCardClick(selected.id, selected.title);
                            setActiveCard(selected);
                        }}
                    />
                ))}
            </div>

            <footer className="mt-12 pt-8 border-t border-hairline text-center text-sm text-ink-muted space-y-3">
                <p>
                    📚 这里的内容来自互联网收集。如果你有好的产品文章或想法，欢迎点击右上方反馈投稿给ethan💌
                </p>
                <p>
                    ✨ 每一篇都是ethan亲自挑选的产品思维精华，会不定期更新，欢迎常来看看！
                </p>
            </footer>

            {activeCard ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
                    onClick={() => setActiveCard(null)}
                >
                    <div
                        className="bg-surface-raised max-w-2xl w-full rounded-2xl shadow-float p-6 max-h-[85vh] overflow-y-auto"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <span className="tag-soft mb-3">
                                    {activeCard.category}
                                </span>
                                <h2 className="font-serif text-2xl text-ink">{activeCard.title}</h2>
                                <p className="text-sm text-ink-muted mt-1">
                                    {activeCard.source ? `来源：${activeCard.source}` : `— ${activeCard.author}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="text-sm text-ink-muted hover:text-ink"
                                onClick={() => setActiveCard(null)}
                            >
                                关闭
                            </button>
                        </div>

                        <div className="prose prose-sm max-w-none text-ink-secondary">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {activeCard.fullArticle || activeCard.content}
                            </ReactMarkdown>
                        </div>

                        {activeCard.tags?.length ? (
                            <div className="flex flex-wrap gap-1.5 mt-6">
                                {activeCard.tags.map((tag, index) => (
                                    <span
                                        key={`${activeCard.id}-${tag}-${index}`}
                                        className="text-xs text-ink-muted bg-surface-sunken px-2 py-0.5 rounded-full whitespace-nowrap"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
        </div>
    );
}
