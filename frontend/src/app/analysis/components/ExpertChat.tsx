'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ExpertAnalysis } from '../types';
import { getExpertById } from '@/data/experts';

interface ExpertChatProps {
  analysis: ExpertAnalysis;
}

export function ExpertChat({ analysis }: ExpertChatProps) {
  const expert = getExpertById(analysis.expertId);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (analysis.status === 'analyzing' && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [analysis.analysis, analysis.status]);

  if (!expert) return null;

  const statusIcon = {
    pending: <div className="w-5 h-5 rounded-full bg-hairline-strong" />,
    analyzing: <Loader2 size={20} className="text-ink-secondary animate-spin" />,
    completed: <CheckCircle size={20} className="text-score" />,
    error: <AlertCircle size={20} className="text-danger" />,
  };

  const stripAnalysisJson = (raw: string) => {
    if (!raw) return '';
    let cleaned = raw.replace(/```json[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/\n?\{[\s\S]*"score"[\s\S]*\}\s*$/g, '');
    return cleaned.trim();
  };

  const formatSections = (raw: string) => {
    if (!raw) return '';
    const lines = raw.split('\n').map(l => l.trim());
    const headingKeywords: Record<string, string> = {
      '战略分析': '🧭',
      '产品分析': '🧩',
      '具体建议': '✅',
      'MVP验证方向': '🔬',
      '种子用户获取': '🎯',
      '风险': '⚠️',
      '建议': '💡',
      '优势': '🌟',
      '评分': '⭐',
      '行动建议': '📝',
      '结论': '📌',
      '总结': '📎',
    };

    const formatted: string[] = [];
    for (const line of lines) {
      if (!line) {
        formatted.push('');
        continue;
      }
      const normalized = line.replace(/[:：]\s*$/, '');
      if (headingKeywords[normalized]) {
        formatted.push(`**${headingKeywords[normalized]} ${normalized}**`);
        formatted.push('');
      } else {
        const matched = Object.keys(headingKeywords).find(k => line.startsWith(k));
        if (matched) {
          const rest = line.slice(matched.length).replace(/^[:：]\s*/, '');
          formatted.push(`**${headingKeywords[matched]} ${matched}**`);
          if (rest) formatted.push(rest);
          formatted.push('');
        } else {
          formatted.push(line);
        }
      }
    }
    return formatted.join('\n');
  };

  const displayText = formatSections(stripAnalysisJson(analysis.analysis || ''));

  return (
    <div className={`card overflow-hidden transition-all ${
      analysis.status === 'pending' ? 'opacity-50' : ''
    }`}>
      {/* 头部 */}
      <div className="p-4 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-3">
          {expert.avatar ? (
            <img
              src={expert.avatar}
              alt={expert.name}
              className="w-10 h-10 rounded-full object-cover border border-hairline"
              loading="lazy"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-paper font-bold"
              style={{ backgroundColor: expert.color }}
            >
              {expert.name.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-semibold">{expert.name}</h3>
            <p className="text-sm text-ink-muted">{expert.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {analysis.status === 'completed' && analysis.score > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-sticker-yellow">★</span>
              <span className="font-semibold tabular-nums">{analysis.score.toFixed(1)}</span>
              <span className="text-ink-faint tabular-nums">/10</span>
            </div>
          )}
          {statusIcon[analysis.status]}
        </div>
      </div>

      {/* 内容 */}
      <div ref={contentRef} className="p-4 max-h-96 overflow-y-auto">
        {analysis.status === 'pending' && (
          <p className="text-ink-faint text-center py-8">等待分析...</p>
        )}

        {analysis.status === 'error' && (
          <p className="text-danger text-center py-8">分析失败，请重试</p>
        )}

        {(analysis.status === 'analyzing' || analysis.status === 'completed') && (
          <div className="prose prose-sm max-w-none text-ink-secondary text-[13px] leading-loose prose-pre:whitespace-pre-wrap prose-pre:break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="pl-5 my-3 list-disc space-y-1">{children}</ul>,
                ol: ({ children, start }) => (
                  <ol className="pl-5 my-3 list-decimal space-y-1" start={start}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="mb-0.5">{children}</li>,
                pre: ({ children }) => (
                  <pre className="whitespace-pre-wrap break-words overflow-x-auto bg-surface-sunken p-3 rounded-lg text-ink-secondary leading-loose">
                    {children}
                  </pre>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-');
                  return isBlock ? (
                    <code className="font-mono text-[0.9em] whitespace-pre-wrap break-words text-ink-secondary leading-loose">
                      {children}
                    </code>
                  ) : (
                    <code className="px-1 py-0.5 rounded bg-surface-sunken font-mono text-[0.9em] text-ink-secondary">
                      {children}
                    </code>
                  );
                },
              }}
            >
              {displayText || '正在思考中...'}
            </ReactMarkdown>
          </div>
        )}

        {/* 结构化结果 */}
        {analysis.status === 'completed' && (
          <div className="mt-4 space-y-3">
            {analysis.needsCaseSupplement ? (
              <div className="bg-surface-sunken rounded-lg p-3">
                <p className="text-xs text-ink-muted">案例待补充：稍后我会补充更贴近的真实案例。</p>
              </div>
            ) : null}
            {analysis.strengths.length > 0 && (
              <div className="bg-score-bg rounded-lg p-3">
                <h4 className="text-sm font-medium text-score mb-2">优势</h4>
                <ul className="text-sm text-score space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.risks.length > 0 && (
              <div className="bg-warn-bg rounded-lg p-3">
                <h4 className="text-sm font-medium text-warn mb-2">风险</h4>
                <ul className="text-sm text-warn space-y-1">
                  {analysis.risks.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.suggestions.length > 0 && (
              <div className="bg-info-bg rounded-lg p-3">
                <h4 className="text-sm font-medium text-info mb-2">建议</h4>
                <ul className="text-sm text-info space-y-1">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
