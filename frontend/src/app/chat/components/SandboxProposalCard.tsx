'use client';

import { CheckCircle2, CloudCog, LoaderCircle, Network, PackagePlus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { SandboxProposal } from '../types';

export function SandboxProposalCard({ proposal }: { proposal: SandboxProposal }) {
  const [status, setStatus] = useState<'idle' | 'creating' | 'ready' | 'failed'>('idle');
  const [error, setError] = useState('');

  const createTool = async () => {
    setStatus('creating');
    setError('');
    try {
      const response = await fetch('/api/sandbox/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal,
          sessionId: sessionStorage.getItem('track_session_id') || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(response.status === 401 ? '请先登录，再创建你的个人沙箱。' : data.error || '创建失败，请稍后重试。');
        setStatus('failed');
        return;
      }
      setStatus('ready');
    } catch {
      setError('网络连接失败，请稍后重试。');
      setStatus('failed');
    }
  };

  return (
    <section className="order-3 mt-3 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-[0_8px_24px_-18px_rgba(79,70,229,0.45)]">
      <div className="flex gap-3 border-b border-indigo-100 bg-indigo-50/60 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
          <CloudCog size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">创建个人云端工具</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">这是安装提案，确认前不会下载或运行任何软件。</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{proposal.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{proposal.description}</p>
        </div>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
            <PackagePlus size={14} className="shrink-0 text-indigo-600" />
            <span className="truncate font-mono">{proposal.packageName}@{proposal.packageVersion}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
            <Network size={14} className="shrink-0 text-indigo-600" />
            <span className="truncate">{proposal.network.length ? proposal.network.join('、') : '运行时禁止联网'}</span>
          </div>
        </div>
        <p className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-600">{proposal.reason}</p>
        <div className="flex flex-wrap items-center gap-2">
          {status === 'ready' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={15} /> 个人隔离环境已创建</span>
          ) : (
            <button
              type="button"
              onClick={createTool}
              disabled={status === 'creating'}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70"
            >
              {status === 'creating' ? <LoaderCircle size={14} className="animate-spin" /> : <PackagePlus size={14} />}
              {status === 'creating' ? '正在创建隔离环境…' : '确认并创建'}
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><ShieldCheck size={13} /> 每位用户独立沙箱，不读取宿主密钥</span>
        </div>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
    </section>
  );
}
