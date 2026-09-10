'use client';

import { type CSSProperties, FormEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Bot, ChevronDown, CircleCheck, LoaderCircle, MessageCircleMore, Send, Sparkles, Wrench, X } from 'lucide-react';
import clsx from 'clsx';

type Step = {
  id: string;
  kind: 'reasoning' | 'tool';
  label: string;
  status: 'running' | 'completed';
  detail?: string;
};

type AgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  execution?: { provider?: string; status: 'running' | 'completed'; steps: Step[] };
};

type ChatEvent =
  | { type: 'meta'; provider: string }
  | { type: 'text'; delta: string }
  | { type: 'step'; id: string; kind: Step['kind']; label: string; status: Step['status']; detail?: string }
  | { type: 'done' };

interface AgentChatDrawerProps {
  title: string;
  description: string;
  pageContext: string;
  prompts: string[];
  onOpenChange?: (isOpen: boolean) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

const idFor = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function AgentChatDrawer({ title, description, pageContext, prompts, onOpenChange, width = 440, onWidthChange }: AgentChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uncontrolledWidth, setUncontrolledWidth] = useState(width);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const panelWidth = onWidthChange ? width : uncontrolledWidth;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    const root = document.documentElement;
    if (isOpen) {
      root.dataset.agentPanelOpen = 'true';
      root.style.setProperty('--agent-panel-width', `${panelWidth}px`);
    } else {
      delete root.dataset.agentPanelOpen;
      root.style.removeProperty('--agent-panel-width');
    }
    return () => {
      delete root.dataset.agentPanelOpen;
      root.style.removeProperty('--agent-panel-width');
    };
  }, [isOpen, panelWidth]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (window.innerWidth < 1024) return;
    event.preventDefault();
    const updateWidth = (clientX: number) => {
      const maxWidth = Math.min(720, window.innerWidth - 360);
      const nextWidth = Math.max(360, Math.min(maxWidth, window.innerWidth - clientX));
      if (onWidthChange) onWidthChange(nextWidth);
      else setUncontrolledWidth(nextWidth);
    };
    const onMove = (moveEvent: globalThis.PointerEvent) => updateWidth(moveEvent.clientX);
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      resizeCleanupRef.current = null;
    };
    resizeCleanupRef.current?.();
    resizeCleanupRef.current = onEnd;
    updateWidth(event.clientX);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd, { once: true });
  };

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || isLoading) return;

    const userMessage: AgentMessage = { id: idFor(), role: 'user', content };
    const requestMessages = [...messages, userMessage];
    const assistantId = idFor();
    setMessages([...requestMessages, {
      id: assistantId,
      role: 'assistant',
      content: '',
      execution: { status: 'running', steps: [] },
    }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages.map(({ role, content: message }) => ({ role, content: message })),
          pageContext,
        }),
      });
      if (!response.ok || !response.body) throw new Error('聊天服务暂时不可用');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';

      const updateAssistant = (update: (message: AgentMessage) => AgentMessage) => {
        setMessages(current => current.map(message => message.id === assistantId ? update(message) : message));
      };
      const applyEvent = (event: ChatEvent) => {
        if (event.type === 'text') {
          answer += event.delta;
          updateAssistant(message => ({ ...message, content: answer }));
          return;
        }
        if (event.type === 'meta') {
          updateAssistant(message => ({
            ...message,
            execution: { status: 'running', provider: event.provider, steps: message.execution?.steps || [] },
          }));
          return;
        }
        if (event.type === 'step') {
          updateAssistant(message => {
            const execution = message.execution || { status: 'running' as const, steps: [] };
            const nextStep: Step = { id: event.id, kind: event.kind, label: event.label, status: event.status, detail: event.detail };
            const existing = execution.steps.findIndex(step => step.id === event.id);
            const steps = existing === -1
              ? [...execution.steps, nextStep]
              : execution.steps.map((step, index) => index === existing ? { ...step, ...nextStep } : step);
            return { ...message, execution: { ...execution, steps } };
          });
          return;
        }
        if (event.type === 'done') {
          updateAssistant(message => message.execution ? { ...message, execution: { ...message.execution, status: 'completed' } } : message);
        }
      };
      const processBuffer = (flush = false) => {
        const frames = buffer.split('\n\n');
        buffer = flush ? '' : frames.pop() || '';
        for (const frame of frames) {
          const data = frame.split('\n').find(line => line.startsWith('data: '));
          if (!data) continue;
          try { applyEvent(JSON.parse(data.slice(6)) as ChatEvent); } catch { /* Ignore malformed stream frames. */ }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        processBuffer();
      }
      buffer += decoder.decode();
      processBuffer(true);
    } catch (error) {
      updateMessageError(assistantId, error instanceof Error ? error.message : '聊天服务暂时不可用，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const updateMessageError = (assistantId: string, content: string) => {
    setMessages(current => current.map(message => message.id === assistantId ? {
      ...message,
      content,
      execution: message.execution ? { ...message.execution, status: 'completed' } : undefined,
    } : message));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={clsx('fixed bottom-20 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:bottom-6', isOpen && 'pointer-events-none translate-x-4 opacity-0')}
        aria-label={`打开${title}`}
        aria-expanded={isOpen}
      >
        <MessageCircleMore size={18} />
        <span>{title}</span>
      </button>

      <aside style={{ '--agent-panel-width': `${panelWidth}px` } as CSSProperties} className={clsx('fixed right-0 top-0 z-40 flex h-[100dvh] w-full flex-col border-l border-slate-200 bg-white shadow-[-18px_0_40px_-30px_rgba(15,23,42,0.32)] transition-transform duration-300 lg:w-[var(--agent-panel-width)]', isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full')} aria-hidden={!isOpen}>
        <button type="button" onPointerDown={startResize} className="absolute -left-2 top-0 hidden h-full w-4 cursor-col-resize touch-none items-center justify-center lg:flex" aria-label="拖动调整 Agent 工作区宽度" title="拖动调整宽度">
          <span className="h-10 w-1 rounded-full bg-slate-200 transition group-hover:bg-indigo-300" />
        </button>
          <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Bot size={19} /></span>
            <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p></div>
            <button type="button" onClick={() => setMessages([])} className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800">新对话</button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="关闭"><X size={18} /></button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
            {!messages.length ? <div className="pt-8 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Sparkles size={21} /></span><h3 className="mt-4 text-sm font-semibold text-slate-900">和 {title} 一起想清楚</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">{description}</p><div className="mx-auto mt-5 flex max-w-sm flex-col gap-2 text-left">{prompts.map(prompt => <button key={prompt} type="button" onClick={() => void send(prompt)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-xs leading-5 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-slate-900">{prompt}</button>)}</div></div> : null}
            {messages.map(message => <MessageBubble key={message.id} message={message} />)}
          </div>

          <form onSubmit={onSubmit} className="border-t border-slate-100 bg-white p-4 sm:p-5">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
              <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder="输入你想讨论的问题…" rows={1} className="max-h-28 min-h-6 flex-1 resize-none bg-transparent py-1 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400" disabled={isLoading} />
              <button type="submit" disabled={isLoading || !input.trim()} className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="发送"><Send size={15} /></button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">Enter 发送 · Shift + Enter 换行</p>
          </form>
      </aside>
    </>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const [showSteps, setShowSteps] = useState(message.execution?.status === 'running');
  const isUser = message.role === 'user';
  const running = message.execution?.status === 'running';
  return (
    <div className={clsx('flex gap-2.5', isUser ? 'justify-end' : '')}>
      {!isUser ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><Bot size={14} /></span> : null}
      <div className={clsx('min-w-0', isUser ? 'max-w-[85%]' : 'max-w-[calc(100%-2.5rem)] flex-1')}>
        {message.execution ? <section className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white"><button type="button" onClick={() => setShowSteps(value => !value)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left"><span className={clsx('flex h-5 w-5 items-center justify-center rounded-full', running ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>{running ? <LoaderCircle size={13} className="animate-spin" /> : <CircleCheck size={13} />}</span><span className="min-w-0 flex-1 text-xs font-medium text-slate-700">{running ? '正在执行' : '已完成执行'}{message.execution.provider ? <span className="ml-1.5 font-normal text-slate-400">· {message.execution.provider}</span> : null}</span><ChevronDown size={14} className={clsx('text-slate-400 transition-transform', showSteps ? 'rotate-180' : '')} /></button>{showSteps ? <ol className="space-y-2 border-t border-slate-100 px-3 py-2.5">{message.execution.steps.length ? message.execution.steps.map(step => <li key={step.id} className="flex gap-2"><span className={clsx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', step.status === 'running' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>{step.status === 'running' ? <LoaderCircle size={12} className="animate-spin" /> : step.kind === 'tool' ? <Wrench size={11} /> : <Sparkles size={11} />}</span><span className="min-w-0 text-xs leading-5 text-slate-600"><span>{step.label}</span>{step.detail ? <span className="block text-slate-400">{step.detail}</span> : null}</span></li>) : <li className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle size={13} className="animate-spin text-indigo-600" />正在理解问题…</li>}</ol> : null}</section> : null}
        {message.content ? <div className={clsx('rounded-2xl px-3.5 py-3 text-sm leading-6', isUser ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md bg-slate-100 text-slate-700')}><ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={{ p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>, ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>, ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>, a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">{children}</a> }}>{message.content}</ReactMarkdown></div> : null}
      </div>
    </div>
  );
}
