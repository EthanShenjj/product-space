'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { EXPERTS, getRecommendedExperts, EXPERT_CATEGORIES } from '@/data/experts';
import { ExpertCard } from './ExpertCard';
import { PRODUCT_TYPES, ProductType, USER_GOALS, UserGoal } from '../types';
import { Summary } from '@/app/chat/types';

interface ExpertSelectorProps {
  summary: Summary;
  onStartAnalysis: (selectedExperts: string[], productType: string, userGoal: UserGoal, targetUserDescription?: string) => void;
}

interface TargetUserPersona {
  id: string;
  name: string;
  role: string;
  scenario: string;
  painPoints: string[];
  motivations: string[];
  willingnessToPay: string;
  shortBio: string;
}

export function ExpertSelector({ summary, onStartAnalysis }: ExpertSelectorProps) {
  const [productType, setProductType] = useState<ProductType>('B2C消费品');
  const [userGoal, setUserGoal] = useState<UserGoal>('validate');
  const [selectedExperts, setSelectedExperts] = useState<string[]>(() => {
    const recommended = getRecommendedExperts('B2C消费品');
    return recommended.slice(0, 3);
  });
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [personas, setPersonas] = useState<TargetUserPersona[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [personaError, setPersonaError] = useState('');
  const autoStartRef = useRef(false);

  const recommendedExperts = getRecommendedExperts(productType);

  const handleProductTypeChange = (type: ProductType) => {
    setProductType(type);
    setShowTypeDropdown(false);
    const recommended = getRecommendedExperts(type);
    setSelectedExperts(recommended.slice(0, 3));
  };

  const toggleExpert = (expertId: string) => {
    setSelectedExperts((prev) =>
      prev.includes(expertId)
        ? prev.filter((id) => id !== expertId)
        : [...prev, expertId]
    );
  };

  const handleStart = useCallback(() => {
    if (selectedExperts.length === 0) return;
    const selectedList = personas.filter(p => selectedPersonaIds.includes(p.id));
    const targetUserDescription = selectedList.length
      ? selectedList
          .map(p => `${p.name}·${p.role}：${p.shortBio || p.scenario}`)
          .join('\n')
      : undefined;
    onStartAnalysis(selectedExperts, productType, userGoal, targetUserDescription);
  }, [selectedExperts, personas, selectedPersonaIds, onStartAnalysis, productType, userGoal]);

  const loadPersonas = async () => {
    setPersonaError('');
    setPersonaLoading(true);
    try {
      const res = await fetch('/api/analysis/target-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, productType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || '生成失败');
      }
      const data = await res.json();
      const list = Array.isArray(data.personas) ? data.personas : [];
      setPersonas(list);
      if (list.length > 0) {
        setSelectedPersonaIds([list[0].id]);
      }
    } catch (error) {
      setPersonaError(error instanceof Error ? error.message : '生成失败');
    } finally {
      setPersonaLoading(false);
    }
  };

  useEffect(() => {
    if (!summary?.product) return;
    void loadPersonas();
  }, [summary, productType]);

  useEffect(() => {
    if (autoStartRef.current) return;
    if (personaLoading) return;
    if (personas.length === 0) return;
    if (selectedPersonaIds.length === 0) return;
    autoStartRef.current = true;
    handleStart();
  }, [personaLoading, personas.length, selectedPersonaIds.length, handleStart]);

  // 按类别分组专家
  const expertsByCategory = EXPERT_CATEGORIES.map((category) => ({
    ...category,
    experts: EXPERTS.filter((e) => e.category === category.id && e.id !== 'target_user'),
  }));

  return (
    <div className="max-w-4xl mx-auto">
      {/* 产品概要 */}
      <div className="card p-6 mb-6">
        <div className="micro-label mb-3">产品概要</div>
        <div className="bg-surface-sunken rounded-xl p-4">
          <p className="text-ink whitespace-pre-wrap">{summary.product || '暂无产品描述'}</p>
        </div>
      </div>

      {/* 用户目标选择 - 新增 */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">你现在最想解决什么问题？</h2>
        <p className="text-sm text-ink-muted mb-4">选择你的目标，专家会给出更有针对性的落地建议</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {USER_GOALS.map((goal) => (
            <button
              key={goal.id}
              onClick={() => setUserGoal(goal.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                userGoal === goal.id
                  ? 'border-ink bg-surface-sunken'
                  : 'border-hairline hover:border-hairline-strong'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{goal.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{goal.label}</span>
                    {userGoal === goal.id && (
                      <Check size={16} className="text-score" />
                    )}
                  </div>
                  <p className="text-sm text-ink-muted mt-1">{goal.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 产品类型选择 */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">产品类型</h2>
        <p className="text-sm text-ink-muted mb-3">选择产品类型，我们会为你推荐最合适的专家</p>

        <div className="relative">
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="input-field px-4 py-3 flex items-center justify-between hover:border-hairline-strong transition-colors"
          >
            <span>{productType}</span>
            <ChevronDown size={20} className={`text-ink-faint transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showTypeDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface-raised border border-hairline rounded-xl shadow-float z-10 overflow-hidden">
              {PRODUCT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleProductTypeChange(type)}
                  className={`w-full px-4 py-3 text-left hover:bg-surface-sunken transition-colors ${
                    type === productType ? 'bg-surface-sunken font-medium' : ''
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 专家选择 */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">选择专家</h2>
        <p className="text-sm text-ink-muted mb-6">
          已选择 {selectedExperts.length} 位专家，带有"推荐"标签的专家最适合分析你的产品类型
        </p>

        {expertsByCategory.map((category) => (
          <div key={category.id} className="mb-6 last:mb-0">
            <div className="micro-label mb-3">{category.name}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {category.experts.map((expert) => (
                <ExpertCard
                  key={expert.id}
                  expert={expert}
                  isSelected={selectedExperts.includes(expert.id)}
                  isRecommended={recommendedExperts.includes(expert.id)}
                  onToggle={() => toggleExpert(expert.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 目标用户画像 */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">目标用户画像</h2>
            <p className="text-sm text-ink-muted mt-1">先生成画像，再选择你认为最贴近的用户（可多选）</p>
          </div>
          <button
            type="button"
            onClick={loadPersonas}
            className="btn-secondary text-sm px-3 py-1.5"
            disabled={personaLoading}
          >
            {personaLoading ? '生成中…' : '重新生成'}
          </button>
        </div>

        {personaError ? (
          <p className="text-sm text-danger mb-3">{personaError}</p>
        ) : null}

        {personaLoading && personas.length === 0 ? (
          <div className="text-sm text-ink-faint">正在生成画像…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setSelectedPersonaIds((prev) =>
                    prev.includes(p.id)
                      ? prev.filter((id) => id !== p.id)
                      : [...prev, p.id]
                  )
                }
                className={`text-left rounded-xl border p-4 transition ${
                  selectedPersonaIds.includes(p.id) ? 'border-ink bg-surface-sunken' : 'border-hairline hover:border-hairline-strong'
                }`}
              >
                <div className="font-medium text-ink">{p.name} · {p.role}</div>
                <p className="text-xs text-ink-muted mt-1">{p.shortBio}</p>
                <p className="text-xs text-ink-muted mt-2">场景：{p.scenario}</p>
                <p className="text-xs text-ink-muted mt-2">付费意愿：{p.willingnessToPay}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 开始分析按钮 */}
      <div className="sticky bottom-4 bg-surface-raised rounded-2xl p-4 shadow-float border border-hairline">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium tabular-nums">
              已选择 {selectedExperts.length} 位专家
            </p>
            <p className="text-sm text-ink-muted">
              目标：{USER_GOALS.find(g => g.id === userGoal)?.label}
            </p>
          </div>
          <button
            onClick={handleStart}
            disabled={selectedExperts.length === 0}
            className="btn-primary px-6 py-3 text-sm"
          >
            开始多视角分析
          </button>
        </div>
      </div>
    </div>
  );
}
