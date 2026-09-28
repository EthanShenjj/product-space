'use client';

import {
    ThumbsUp,
    ThumbsDown,
    Copy,
    Check,
    User,
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
                isUser ? "bg-ink text-paper" : "bg-transparent"
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
                            ? "bg-ink text-paper rounded-tr-none"
                            : "order-2 mt-3 bg-surface-raised border border-hairline text-ink rounded-tl-none"
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
                                        <code className="px-1 py-0.5 rounded bg-surface-sunken font-mono text-[0.85em]">{children}</code>
                                    );
                                },
                                pre: ({ children }) => <pre className="p-3 rounded-xl bg-surface-sunken overflow-x-auto">{children}</pre>,
                                blockquote: ({ children }) => <blockquote className="border-l-2 border-hairline-strong pl-3 text-ink-muted">{children}</blockquote>,
                                a: ({ children, href }) => (
                                    <a href={href} target="_blank" rel="noreferrer" className="u-link">
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
                                'order-1 overflow-hidden rounded-2xl bg-surface-raised shadow-card',
                                'border',
                                isRunning ? 'border-hairline-strong' : 'border-hairline',
                            )} aria-label="回答执行过程">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/30"
                                    onClick={() => setShowExecution((value) => !value)}
                                    aria-expanded={showExecution}
                                >
                                    <span className={clsx(
                                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                                        isRunning ? 'bg-surface-sunken text-ink-secondary' : 'bg-score-bg text-score',
                                    )}>
                                        {isRunning
                                            ? <LoaderCircle size={15} className="animate-spin" />
                                            : <CircleCheck size={15} />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                                            {isRunning ? '正在准备回复' : '已完成执行'}
                                            {execution.provider ? <span className="truncate text-xs font-normal text-ink-faint">{execution.provider}</span> : null}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-ink-muted">
                                            {isRunning ? '正在完成必要的分析与工具调用' : `已完成 ${completedSteps} 个步骤，可展开查看`}
                                        </span>
                                    </span>
                                    <ChevronDown size={16} className={clsx('shrink-0 text-ink-faint transition-transform', showExecution ? 'rotate-180' : '')} />
                                </button>
                                {showExecution ? (
                                    <ol className="border-t border-hairline px-3.5 py-3">
                                        {execution.steps.length ? execution.steps.map((step, index) => (
                                            <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
                                                {index < execution.steps.length - 1 ? <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-hairline" /> : null}
                                                <span className={clsx(
                                                    'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                                                    step.status === 'running'
                                                        ? 'border-hairline-strong bg-surface-sunken text-ink-secondary'
                                                        : 'border-score/20 bg-score-bg text-score',
                                                )}>
                                                    {step.status === 'running'
                                                        ? <LoaderCircle size={14} className="animate-spin" />
                                                        : step.kind === 'tool' ? <Wrench size={13} /> : <Sparkles size={13} />}
                                                </span>
                                                <div className="min-w-0 flex-1 pt-0.5">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="text-sm font-medium text-ink">{step.label}</span>
                                                        <span className={clsx(
                                                            'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                                            step.status === 'running' ? 'bg-surface-sunken text-ink-secondary' : 'bg-score-bg text-score',
                                                        )}>
                                                            {step.status === 'running' ? '执行中' : '已完成'}
                                                        </span>
                                                    </div>
                                                    {step.detail ? <p className="mt-1 break-words text-xs leading-5 text-ink-muted">{step.detail}</p> : null}
                                                </div>
                                            </li>
                                        )) : (
                                            <li className="flex items-center gap-3 py-0.5 text-sm text-ink-muted">
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline-strong bg-surface-sunken text-ink-secondary"><LoaderCircle size={14} className="animate-spin" /></span>
                                                已接收问题，正在选择处理方式…
                                            </li>
                                        )}
                                    </ol>
                                ) : null}
                            </section>
                        ) : null}
                        {message.sandboxProposals?.map((proposal) => <SandboxProposalCard key={proposal.id} proposal={proposal} />)}
                        <div className="order-4 mt-2 flex items-center gap-2 text-ink-faint">
                            <button
                                type="button"
                                title="有用"
                                className={clsx(
                                    "rounded-full border p-1 transition",
                                    feedback === 'up' ? "border-score/40 text-score" : "border-hairline hover:border-hairline-strong hover:text-ink-secondary"
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
                                    feedback === 'down' ? "border-danger/40 text-danger" : "border-hairline hover:border-hairline-strong hover:text-ink-secondary"
                                )}
                                onClick={() => sendFeedback('down')}
                            >
                                <ThumbsDown size={12} />
                            </button>
                        <button
                            type="button"
                            title="复制"
                            className="rounded-full border border-hairline p-1 transition hover:border-hairline-strong hover:text-ink-secondary"
                            onClick={copyMessage}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                            {feedback ? (
                                <button
                                    type="button"
                                    className="text-xs text-ink-faint hover:text-ink-secondary"
                                    onClick={() => setShowCommentBox((prev) => !prev)}
                                >
                                    {showCommentBox ? '收起评价' : '写点评'}
                                </button>
                            ) : null}
                        </div>
                        {feedback && showCommentBox ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    className="input-field px-2 py-1 text-xs"
                                    rows={2}
                                    placeholder="写点具体建议（可选）"
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn-secondary text-xs px-3 py-1"
                                        onClick={submitFeedbackComment}
                                    >
                                        提交
                                    </button>
                                    <button
                                        type="button"
                                        className="text-xs text-ink-faint hover:text-ink-secondary"
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
