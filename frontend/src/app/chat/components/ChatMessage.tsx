'use client';

import {
    ThumbsUp,
    ThumbsDown,
    Copy,
    Check,
    User,
    BrainCircuit,
    Wrench,
    ChevronDown,
    LoaderCircle,
    CircleCheck,
    Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Message } from '../types';
import { SandboxProposalCard } from './SandboxProposalCard';
import { trackMessageFeedback, submitMessageFeedback } from '@/lib/tracking';
import { useState } from 'react';

interface ChatMessageProps {
    message: Message;
    currentStage?: string;
}

export function ChatMessage({ message, currentStage }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
    const [comment, setComment] = useState('');
    const [showCommentBox, setShowCommentBox] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showExecution, setShowExecution] = useState(message.execution?.status === 'running');
    const hasContent = Boolean(message.content.trim());
    const execution = message.execution;
    const completedSteps = execution?.steps.filter((step) => step.status === 'completed').length ?? 0;
    const isRunning = execution?.status === 'running';

    const sendFeedback = (vote: 'up' | 'down') => {
        if (feedback === vote) return;
        setFeedback(vote);
        trackMessageFeedback(message.id, vote, currentStage);
        setShowCommentBox(true);
    };

    const submitFeedbackComment = async () => {
        if (!feedback) return;
        await submitMessageFeedback({
            messageId: message.id,
            vote: feedback,
            comment: comment.trim(),
            stage: currentStage,
        });
        setComment('');
        setShowCommentBox(false);
    };

    const copyMessage = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            // fallback: silently ignore
        }
    };

    return (
        <div
            className={clsx(
                "flex gap-4 max-w-2xl",
                isUser ? "ml-auto flex-row-reverse" : ""
            )}
        >
            <div className={clsx(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden",
                isUser ? "bg-black text-white" : "bg-transparent"
            )}>
                {isUser ? (
                    <User size={16} />
                ) : (
                    <img
                        src="/avatars/bot-avatar.jpg"
                        alt="产品顾问"
                        className="w-full h-full object-cover"
                    />
                )}
            </div>

            <div className={clsx('min-w-0 flex flex-col', isUser ? 'max-w-[min(100%,38rem)]' : 'w-full max-w-2xl')}>
                {isUser || hasContent ? (
                    <div className={clsx(
                        "p-4 rounded-2xl text-sm leading-[1.65] whitespace-normal break-words",
                        isUser
                            ? "bg-black text-white rounded-tr-none"
                            : "order-2 mt-3 bg-gray-100 text-gray-800 rounded-tl-none"
                    )}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="pl-5 my-2 list-disc space-y-1">{children}</ul>,
                                ol: ({ children, start }) => (
                                    <ol className="pl-5 my-2 list-decimal space-y-1" start={start}>
                                        {children}
                                    </ol>
                                ),
                                li: ({ children }) => <li className="mb-0.5">{children}</li>,
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                                code: ({ children, className }) => {
                                    const isBlock = className?.includes('language-');
                                    return isBlock ? (
                                        <code className="font-mono text-[0.85em]">{children}</code>
                                    ) : (
                                        <code className="px-1 py-0.5 rounded bg-black/5 font-mono text-[0.85em]">{children}</code>
                                    );
                                },
                                pre: ({ children }) => <pre className="p-3 rounded bg-black/5 overflow-x-auto">{children}</pre>,
                                blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 text-gray-500">{children}</blockquote>,
                                a: ({ children, href }) => (
                                    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                        {children}
                                    </a>
                                ),
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                ) : null}
                {!isUser ? (
                    <div className="contents">
                        {execution ? (
                            <section className={clsx(
                                'order-1 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.34)]',
                                isRunning ? 'border-indigo-200' : 'border-slate-200',
                            )} aria-label="回答执行过程">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                                    onClick={() => setShowExecution((value) => !value)}
                                    aria-expanded={showExecution}
                                >
                                    <span className={clsx(
                                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                                        isRunning ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600',
                                    )}>
                                        {isRunning
                                            ? <LoaderCircle size={15} className="animate-spin" />
                                            : <CircleCheck size={15} />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            {isRunning ? '正在准备回复' : '已完成执行'}
                                            {execution.provider ? <span className="truncate text-xs font-normal text-slate-400">{execution.provider}</span> : null}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-slate-500">
                                            {isRunning ? '正在完成必要的分析与工具调用' : `已完成 ${completedSteps} 个步骤，可展开查看`}
                                        </span>
                                    </span>
                                    <ChevronDown size={16} className={clsx('shrink-0 text-slate-400 transition-transform', showExecution ? 'rotate-180' : '')} />
                                </button>
                                {showExecution ? (
                                    <ol className="border-t border-slate-100 px-3.5 py-3">
                                        {execution.steps.length ? execution.steps.map((step, index) => (
                                            <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
                                                {index < execution.steps.length - 1 ? <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-slate-200" /> : null}
                                                <span className={clsx(
                                                    'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                                                    step.status === 'running'
                                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                                                        : 'border-emerald-200 bg-emerald-50 text-emerald-600',
                                                )}>
                                                    {step.status === 'running'
                                                        ? <LoaderCircle size={14} className="animate-spin" />
                                                        : step.kind === 'tool' ? <Wrench size={13} /> : <Sparkles size={13} />}
                                                </span>
                                                <div className="min-w-0 flex-1 pt-0.5">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="text-sm font-medium text-slate-700">{step.label}</span>
                                                        <span className={clsx(
                                                            'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                                            step.status === 'running' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-700',
                                                        )}>
                                                            {step.status === 'running' ? '执行中' : '已完成'}
                                                        </span>
                                                    </div>
                                                    {step.detail ? <p className="mt-1 break-words text-xs leading-5 text-slate-500">{step.detail}</p> : null}
                                                </div>
                                            </li>
                                        )) : (
                                            <li className="flex items-center gap-3 py-0.5 text-sm text-slate-500">
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600"><LoaderCircle size={14} className="animate-spin" /></span>
                                                已接收问题，正在选择处理方式…
                                            </li>
                                        )}
                                    </ol>
                                ) : null}
                            </section>
                        ) : null}
                        {message.sandboxProposals?.map((proposal) => <SandboxProposalCard key={proposal.id} proposal={proposal} />)}
                        <div className="order-4 mt-2 flex items-center gap-2 text-gray-400">
                            <button
                                type="button"
                                title="有用"
                                className={clsx(
                                    "rounded-full border p-1 transition",
                                    feedback === 'up' ? "border-green-400 text-green-600" : "border-gray-200 hover:border-gray-300 hover:text-gray-600"
                                )}
                                onClick={() => sendFeedback('up')}
                            >
                                <ThumbsUp size={12} />
                            </button>
                            <button
                                type="button"
                                title="不太有用"
                                className={clsx(
                                    "rounded-full border p-1 transition",
                                    feedback === 'down' ? "border-red-400 text-red-600" : "border-gray-200 hover:border-gray-300 hover:text-gray-600"
                                )}
                                onClick={() => sendFeedback('down')}
                            >
                                <ThumbsDown size={12} />
                            </button>
                        <button
                            type="button"
                            title="复制"
                            className="rounded-full border border-gray-200 p-1 transition hover:border-gray-300 hover:text-gray-600"
                            onClick={copyMessage}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                            {feedback ? (
                                <button
                                    type="button"
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowCommentBox((prev) => !prev)}
                                >
                                    {showCommentBox ? '收起评价' : '写点评'}
                                </button>
                            ) : null}
                        </div>
                        {feedback && showCommentBox ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700"
                                    rows={2}
                                    placeholder="写点具体建议（可选）"
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:border-gray-300"
                                        onClick={submitFeedbackComment}
                                    >
                                        提交
                                    </button>
                                    <button
                                        type="button"
                                        className="text-xs text-gray-400 hover:text-gray-600"
                                        onClick={() => {
                                            setShowCommentBox(false);
                                            setComment('');
                                        }}
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
