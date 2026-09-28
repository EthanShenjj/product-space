import Link from 'next/link';
import { MessageSquare, Sparkles, ArrowRight, Lightbulb } from 'lucide-react';

export default function Home() {
    return (
        <div className="relative flex flex-col items-center justify-center min-h-[80vh] px-4 text-center max-w-4xl mx-auto">
            {/* Sticker accents — see design.md §5.9, keep ≤ 4 per screen */}
            <Lightbulb
                className="absolute left-2 top-10 hidden md:block w-9 h-9 -rotate-12 text-sticker-yellow"
                strokeWidth={2.5}
                fill="currentColor"
            />
            <Sparkles
                className="absolute right-6 top-24 hidden md:block w-7 h-7 rotate-12 text-sticker-pink"
                strokeWidth={2.5}
            />

            <div className="mb-8 p-3 bg-surface rounded-2xl shadow-card">
                <Sparkles className="w-8 h-8 text-ink" />
            </div>

            <h1 className="font-serif text-4xl md:text-6xl tracking-tight text-ink mb-6">
                打磨你的产品思维。
            </h1>

            <p className="text-lg text-ink-secondary mb-10 max-w-2xl leading-relaxed">
                用 AI 产品顾问挑战你的想法，或从全球顶尖产品领袖的智慧中获取灵感。
            </p>

            <div className="grid md:grid-cols-2 gap-4 w-full max-w-lg">
                <Link
                    href="/chat"
                    className="group relative flex flex-col items-start p-6 rounded-2xl bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
                >
                    <div className="mb-4 bg-ink text-paper p-2.5 rounded-full">
                        <MessageSquare size={20} />
                    </div>
                    <h3 className="text-lg font-semibold text-ink mb-1 flex items-center w-full justify-between">
                        深度对话
                        <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                    </h3>
                    <p className="text-sm text-ink-secondary text-left">
                        通过灵魂拷问，验证你的产品战略
                    </p>
                </Link>

                <Link
                    href="/explore"
                    className="group relative flex flex-col items-start p-6 rounded-2xl bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float"
                >
                    <div className="mb-4 bg-surface-sunken text-ink p-2.5 rounded-full">
                        <Sparkles size={20} />
                    </div>
                    <h3 className="text-lg font-semibold text-ink mb-1 flex items-center w-full justify-between transition-colors">
                        灵感火花
                        <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                    </h3>
                    <p className="text-sm text-ink-secondary text-left">
                        发现改变世界的产品思维
                    </p>
                </Link>
            </div>

            <Link href="/chat" className="btn-primary mt-10 px-6 py-3 text-sm">
                开始对话
                <ArrowRight size={16} />
            </Link>
        </div>
    );
}
