'use client';

import clsx from 'clsx';
import { Stage } from '../types';

interface PhaseIndicatorProps {
    currentStage: Stage;
}

const phases: { key: Stage; label: string }[] = [
    { key: 'info', label: 'Step 1 信息收集' },
    { key: 'deep', label: 'Step 2 深度追问' },
    { key: 'analysis', label: 'Step 3 多视角分析' },
];

export function PhaseIndicator({ currentStage }: PhaseIndicatorProps) {
    return (
        <div className="p-4 border-b border-hairline bg-surface/95 backdrop-blur sticky top-0 z-10">
            <div className="flex items-center gap-5 text-sm text-ink-muted">
                {phases.map((phase) => (
                    <span
                        key={phase.key}
                        className={clsx(
                            "pb-1 border-b-2 transition-colors",
                            currentStage === phase.key
                                ? "text-ink font-semibold border-ink"
                                : "text-ink-faint border-transparent"
                        )}
                    >
                        {phase.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
