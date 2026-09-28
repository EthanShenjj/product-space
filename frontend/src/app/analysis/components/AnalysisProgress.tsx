'use client';

import { ExpertAnalysis } from '../types';
import { ExpertChat } from './ExpertChat';
import { getExpertById } from '@/data/experts';

interface AnalysisProgressProps {
  analyses: ExpertAnalysis[];
  onBack: () => void;
  onViewReport: () => void;
}

export function AnalysisProgress({ analyses, onBack, onViewReport }: AnalysisProgressProps) {
  const completedCount = analyses.filter((a) => a.status === 'completed').length;
  const totalCount = analyses.length;
  const allCompleted = completedCount === totalCount;
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* 进度条 */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg">多视角分析进行中</h2>
          <span className="text-sm text-ink-muted tabular-nums">
            {completedCount}/{totalCount} 位专家已完成
          </span>
        </div>

        <div className="metric-track">
          <div
            className="metric-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 专家头像列表 */}
        <div className="flex items-center gap-2 mt-4">
          {analyses.map((analysis) => {
            const expert = getExpertById(analysis.expertId);
            if (!expert) return null;

            return (
              <div
                key={analysis.expertId}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-paper text-sm font-medium transition-all ${
                  analysis.status === 'completed'
                    ? ''
                    : analysis.status === 'analyzing'
                    ? 'ring-2 ring-ink/40 ring-offset-2 ring-offset-surface'
                    : 'opacity-40'
                }`}
                style={{ backgroundColor: expert.color }}
                title={expert.name}
              >
                {expert.name.charAt(0)}
              </div>
            );
          })}
        </div>
      </div>

      {/* 专家分析卡片 */}
      <div className="space-y-4">
        {analyses.map((analysis) => (
          <ExpertChat key={analysis.expertId} analysis={analysis} />
        ))}
      </div>

      {/* 底部操作 */}
      <div className="sticky bottom-4 mt-6 bg-surface-raised rounded-2xl p-4 shadow-float border border-hairline">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="btn-ghost px-4 py-2 text-sm"
          >
            返回修改
          </button>

          <button
            onClick={onViewReport}
            disabled={!allCompleted}
            className="btn-primary px-6 py-3 text-sm"
          >
            {allCompleted ? '查看完整报告' : '分析中...'}
          </button>
        </div>
      </div>
    </div>
  );
}
