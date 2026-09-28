'use client';

import { Quote } from 'lucide-react';

export interface CardData {
    id: string;
    title: string;
    category: string;
    content: string;
    author: string;
    source?: string;
    tags: string[];
    fullArticle?: string;
}

interface InsightCardProps {
    card: CardData;
    onClick?: (card: CardData) => void;
}

export default function InsightCard({ card, onClick }: InsightCardProps) {
    return (
        <button
            type="button"
            onClick={() => onClick?.(card)}
            className="group relative bg-surface rounded-2xl p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-float overflow-hidden text-left"
        >
            {/* Category Tag */}
            <div className="flex items-center justify-between mb-4">
                <span className="tag-soft">{card.category}</span>
            </div>

            <h3 className="text-lg font-semibold text-ink mb-3">
                {card.title}
            </h3>

            {/* Content — editorial serif quote */}
            <div className="mb-6 relative">
                <Quote className="absolute -top-2 -left-2 text-hairline fill-surface-sunken h-8 w-8 -z-10" />
                <p className="font-serif text-ink-secondary leading-relaxed">
                    &quot;{card.content}&quot;
                </p>
            </div>

            {/* Footer */}
            <div className="flex items-start justify-between gap-3 mt-auto pt-4 border-t border-hairline">
                <div className="text-xs text-ink-muted flex-1 min-w-0 truncate">
                    {card.source ? `来源：${card.source}` : `— ${card.author}`}
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[45%]">
                    {card.tags.slice(0, 3).map((tag, index) => (
                        <span
                            key={`${card.id}-${tag}-${index}`}
                            className="text-[11px] text-ink-muted bg-surface-sunken px-2 py-0.5 rounded-full whitespace-nowrap"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>
        </button>
    );
}
