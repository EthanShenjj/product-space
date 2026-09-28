'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Summary } from '@/app/chat/types';
import { ExpertSelector, AnalysisProgress, ReportView } from './components';
import { useAnalysis } from './hooks/useAnalysis';

export default function AnalysisPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 从 sessionStorage 获取 summary
  useEffect(() => {
    const storedSummary = sessionStorage.getItem('analysis_summary');
    if (storedSummary) {
      try {
        setSummary(JSON.parse(storedSummary));
      } catch {
        // 解析失败
      }
    }
    setIsLoading(false);
  }, []);

  const { state, startAnalysis, goToReport, goToSelect } = useAnalysis(
    summary || {
      productTitle: '',
      product: '',
      aiAdvice: '',
      userNotes: '',
      cases: [],
    }
  );

  const handleContinueChat = () => {
    router.push('/chat');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink" />
      </div>
    );
  }

  if (!summary || !summary.product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold mb-4">暂无产品信息</h2>
          <p className="text-ink-muted mb-6">请先在对话中描述你的产品</p>
          <Link
            href="/chat"
            className="btn-primary px-6 py-3 text-sm"
          >
            开始对话
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* 顶部导航 */}
      <div className="bg-surface border-b border-hairline">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/chat" className="text-ink-faint hover:text-ink transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-serif text-xl">多视角分析</h1>
        </div>
      </div>

      {/* 主内容 */}
      <div className="py-6 px-4">
        {state.step === 'select' && (
          <ExpertSelector summary={summary} onStartAnalysis={startAnalysis} />
        )}

        {state.step === 'analyzing' && (
          <AnalysisProgress
            analyses={state.analyses}
            onBack={goToSelect}
            onViewReport={goToReport}
          />
        )}

        {state.step === 'report' && (
          <ReportView
            summary={summary}
            analyses={state.analyses}
            userGoal={state.userGoal}
            onBack={goToSelect}
            onContinueChat={handleContinueChat}
          />
        )}
      </div>
    </div>
  );
}
