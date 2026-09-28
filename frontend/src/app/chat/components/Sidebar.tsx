'use client';

import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Users, CheckCircle2, Circle, Lock } from 'lucide-react';
import { Summary, StageConfig, Stage } from '../types';

interface SidebarProps {
    stageConfig: StageConfig;
    summary: Summary;
    isSummarizing: boolean;
    currentStage: Stage;
    canStartAnalysis: boolean;
    deepTurns: number;
    minDeepTurns: number;
}

const STAGES: { key: Stage; label: string; description: string }[] = [
    { key: 'info', label: 'Step 1 信息收集', description: '描述你的产品和目标用户' },
    { key: 'deep', label: 'Step 2 深度追问', description: '验证核心假设和风险' },
    { key: 'analysis', label: 'Step 3 多视角分析', description: '生成完整诊断报告' },
];

export function Sidebar({ stageConfig, summary, isSummarizing, currentStage, canStartAnalysis, deepTurns, minDeepTurns }: SidebarProps) {
    const router = useRouter();

    // 防止 stageConfig 未定义时报错
    if (!stageConfig) {
        return null;
    }

    const handleStartAnalysis = () => {
        sessionStorage.setItem('analysis_summary', JSON.stringify(summary));
        router.push('/analysis');
    };

    const remainingTurns = Math.max(0, minDeepTurns - deepTurns);

    // 计算阶段索引
    const currentIndex = STAGES.findIndex(s => s.key === currentStage);
    const normalizeCases = () => {
        const invalidNames = new Set(['[', ']', '{', '}', '"name"', 'name']);
        const entries = (summary.cases || [])
            .map(item => {
                const name = String(item.name || '').replace(/^[\s"{\[]+|[\s"}\]]+$/g, '').trim();
                const reason = String(item.reason || '').trim();
                if (!name || invalidNames.has(name)) return null;
                return { name, reason };
            })
            .filter((item): item is { name: string; reason: string } => Boolean(item));

        const merged = new Map<string, string[]>();
        for (const item of entries) {
            const key = item.name.toLowerCase();
            const reasons = merged.get(key) || [];
            if (item.reason && !reasons.includes(item.reason)) reasons.push(item.reason);
            merged.set(key, reasons);
        }

        return Array.from(merged.entries()).map(([key, reasons]) => ({
            name: entries.find(item => item.name.toLowerCase() === key)?.name || key,
            reason: reasons.join('；'),
        }));
    };

    return (
        <aside className="fixed right-4 top-20 bottom-4 z-30 hidden w-80 flex-col gap-4 overflow-y-auto pr-1 xl:flex">
            {/* 阶段进度 */}
            <div className="card border border-hairline p-4">
                <div className="text-sm font-semibold text-ink mb-4">对话进度</div>

                <div className="space-y-3">
                    {STAGES.map((stage, index) => {
                        const isCompleted = index < currentIndex;
                        const isCurrent = index === currentIndex;
                        const isLocked = index > currentIndex;

                        return (
                            <div
                                key={stage.key}
                                className={clsx(
                                    "flex items-start gap-3 p-2 rounded-xl transition-colors",
                                    isCurrent && "bg-surface-sunken",
                                )}
                            >
                                <div className="mt-0.5">
                                    {isCompleted ? (
                                        <CheckCircle2 size={18} className="text-score" />
                                    ) : isCurrent ? (
                                        <Circle size={18} className="text-ink fill-ink" />
                                    ) : (
                                        <Lock size={18} className="text-ink-faint" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className={clsx(
                                        "text-sm font-medium",
                                        isCompleted && "text-score",
                                        isCurrent && "text-ink",
                                        isLocked && "text-ink-faint",
                                    )}>
                                        {stage.label}
                                    </div>
                                    <div className={clsx(
                                        "text-xs mt-0.5",
                                        isLocked ? "text-ink-faint" : "text-ink-muted",
                                    )}>
                                        {stage.description}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 当前阶段详情 */}
            <div className="card border border-hairline p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-ink">{stageConfig.label}</span>
                    <span className="text-xs text-ink-faint">进行中</span>
                </div>
                <div className="text-xs text-ink-secondary mb-3">{stageConfig.goal}</div>
                <div className="space-y-2 text-xs text-ink-secondary">
                    {stageConfig.checklist.map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                            <span className={clsx(
                                "inline-flex h-2 w-2 rounded-full",
                                item.done ? "bg-score" : "bg-hairline-strong"
                            )} />
                            <span className={item.done ? "text-ink" : "text-ink-muted"}>
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 text-xs text-ink-muted">{stageConfig.takeaway}</div>
            </div>

            {/* 多视角分析入口 */}
            <div className="card border border-hairline p-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Users size={16} className={canStartAnalysis ? "text-ink" : "text-ink-faint"} />
                        <span className="text-sm font-semibold text-ink">多视角分析</span>
                    </div>
                    <span className={clsx(
                        "text-xs",
                        canStartAnalysis ? "text-score" : "text-ink-faint"
                    )}>
                        {canStartAnalysis ? "可进入" : "未解锁"}
                    </span>
                </div>
                <p className="text-xs text-ink-muted">
                    {canStartAnalysis ? "准备好后即可生成完整诊断报告。" : "再聊几轮关键问题，保证建议更贴合。"}
                </p>
                <div className="mt-3 flex items-center gap-2">
                    <button
                        onClick={handleStartAnalysis}
                        disabled={!canStartAnalysis}
                        className={clsx(
                            "text-xs px-3 py-1.5 rounded-full border transition-colors",
                            canStartAnalysis
                                ? "border-hairline-strong bg-surface-raised text-ink hover:border-ink/30"
                                : "border-hairline text-ink-faint cursor-not-allowed"
                        )}
                    >
                        进入多视角分析
                    </button>
                    {!canStartAnalysis && remainingTurns > 0 ? (
                        <span className="text-xs text-ink-faint">还需 {remainingTurns} 轮追问</span>
                    ) : null}
                </div>
            </div>

            {/* Summary */}
            <div className="card border border-hairline p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-ink">对话实时总结</span>
                    <span className="text-xs text-ink-faint">{isSummarizing ? '更新中...' : '已同步'}</span>
                </div>

                <div className="space-y-4 text-xs text-ink-secondary">
                    <div>
                        <div className="micro-label mb-1">产品情况</div>
                        <div className="whitespace-pre-wrap leading-relaxed">{summary.product}</div>
                    </div>
                    <div>
                        <div className="micro-label mb-1">AI 的建议</div>
                        <div className="whitespace-pre-wrap leading-relaxed">{summary.aiAdvice}</div>
                    </div>
                    <div>
                        <div className="micro-label mb-1">用户的评论</div>
                        <div className="whitespace-pre-wrap leading-relaxed">{summary.userNotes}</div>
                    </div>
                </div>
            </div>

            {/* Cases */}
            <div className="card border border-hairline p-4">
                <div className="text-sm font-semibold text-ink mb-3">案例/对标推荐</div>
                {normalizeCases().length === 0 ? (
                    <div className="text-xs text-ink-faint">暂时没有推荐，聊得更具体后会补充。</div>
                ) : (
                    <div className="space-y-3 text-xs text-ink-secondary">
                        {normalizeCases().map((item, index) => (
                            <div key={`${item.name}-${index}`} className="border-l-2 border-hairline-strong pl-3">
                                <div className="font-semibold text-ink">{item.name}</div>
                                <div className="text-ink-muted mt-1">{item.reason}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
