'use client';

import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Download, Share2, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react';
import { ExpertAnalysis, USER_GOALS, UserGoal } from '../types';
import { getExpertById } from '@/data/experts';
import { Summary } from '@/app/chat/types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportViewProps {
  summary: Summary;
  analyses: ExpertAnalysis[];
  userGoal?: UserGoal;
  onBack: () => void;
  onContinueChat: () => void;
}

export function ReportView({ summary, analyses, userGoal = 'validate', onBack, onContinueChat }: ReportViewProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const completedAnalyses = analyses.filter((a) => a.status === 'completed');
  const ALLOWED_SCORES = [0, 1, 2, 5, 8, 10];
  const snapScore = (score: number) => {
    if (Number.isNaN(score)) return 2;
    if (score <= 0.5) return 0;
    if (score <= 1.5) return 1;
    if (score <= 2.5) return 2;
    if (score <= 4.5) return 2;
    if (score <= 5.5) return 5;
    if (score <= 7.5) return 8;
    if (score <= 9.0) return 8;
    return 10;
  };
  const computeOverallScore = () => {
    if (!completedAnalyses.length) return 0;
    const scores = completedAnalyses.map(a => a.score);
    const count5 = scores.filter(score => score === 5).length;
    if (count5 >= Math.ceil(scores.length / 2)) return 5;
    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const snapped = snapScore(avg);
    if (snapped !== 5) return snapped;
    return avg < 5 ? 2 : 8;
  };
  const overallScore = computeOverallScore();

  const getScoreRationale = () => {
    const linesCount = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean).length;
    const productLines = linesCount(summary.product || '');
    const adviceLines = linesCount(summary.aiAdvice || '');
    const notesLines = linesCount(summary.userNotes || '');
    const hasCases = (summary.cases || []).length > 0;
    const hasValidation = /验证|数据|指标|反馈|转化|付费|留存|复购|试点|上线|测试/.test(summary.product || '');
    const hasStage = /阶段|Demo|MVP|测试|上线|试点/.test(summary.product || '');

    if (overallScore <= 0) {
      return '综合评分极低，主要因为信息极不完整，无法判断产品的可行性与方向。建议先补齐最小可描述的用户、场景与问题。';
    }
    if (overallScore <= 1) {
      return '综合评分偏低，主要因为概念不清晰或缺乏竞争力，价值主张存在明显缺口。建议先澄清核心问题与差异化，再进入方案细化。';
    }
    if (overallScore <= 2) {
      return '综合评分偏低，主要因为当前信息较少或较分散，产品定位与关键场景仍不清晰，缺少可验证的证据。建议先补齐目标用户、核心场景与价值主张的最小描述。';
    }
    if (overallScore === 5) {
      return '综合评分处于中等水平，已具备基本的用户与场景描述，但验证证据与落地路径仍不充分。若能补充清晰的验证数据或实验结果，评分还有上升空间。';
    }
    if (overallScore === 8) {
      return '综合评分偏高，原因是产品描述较完整，包含明确的目标用户与场景，并已有阶段性进展' +
        `${hasValidation ? '与初步验证信号' : ''}。下一步建议补充量化指标与可持续增长路径以支撑更高评分。`;
    }
    if (overallScore >= 10) {
      return '综合评分极高，说明产品定位、目标用户与落地路径非常清晰，并且已有充分的验证证据与规模化迹象。当前重点是保持增长质量与可复制性。';
    }
    const detailSignals = [
      productLines >= 2 ? '产品描述较清晰' : '产品描述仍需补充',
      adviceLines >= 2 ? '建议可执行性较好' : '建议可执行性有待加强',
      notesLines >= 1 ? '用户补充信息较完整' : '用户补充信息较少',
      hasCases ? '具备参考案例' : '案例信息不足',
      hasStage ? '已有阶段性进展' : '阶段进展不明确',
    ];
    return `综合评分为 ${overallScore}，${detailSignals.join('，')}。`;
  };

  const getExpertScoreRationale = (category?: string, score?: number) => {
    const value = score ?? 0;
    const base = value >= 8
      ? '当前方案较成熟'
      : value >= 5
        ? '当前方案处于中等水平'
        : value <= 1
          ? '当前方案概念仍不清晰或缺乏竞争力'
          : '当前方案仍偏早期';
    switch (category) {
      case 'product':
        return `${base}，从产品价值与用户匹配度看，仍需补齐关键场景与价值主张的验证证据。`;
      case 'growth':
        return `${base}，从增长与留存视角看，需要更清晰的增长杠杆与复访机制支撑。`;
      case 'investor':
        return `${base}，从商业化与风险视角看，需证明可持续收入模型与可复制路径。`;
      case 'tech':
        return `${base}，从技术可行性与成本视角看，还需要明确实现路径与维护成本。`;
      case 'design':
        return `${base}，从体验与呈现视角看，信息架构与交互闭环仍有优化空间。`;
      case 'user':
        return `${base}，从用户动机与易用性视角看，核心触发点与持续使用理由需强化。`;
      default:
        return `${base}，需进一步补齐关键假设与验证证据。`;
    }
  };

  const stripJsonBlocks = (raw: string) => {
    if (!raw) return '';
    let cleaned = raw.replace(/```json[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/\n?\{[\s\S]*"score"[\s\S]*\}\s*$/g, '');
    return cleaned.trim();
  };

  // 汇总所有优势、风险、建议、行动项
  const allStrengths = [...new Set(completedAnalyses.flatMap((a) => a.strengths))];
  const allRisks = [...new Set(completedAnalyses.flatMap((a) => a.risks))];
  const allSuggestions = [...new Set(completedAnalyses.flatMap((a) => a.suggestions))];
  const allActionItems = [...new Set(completedAnalyses.flatMap((a) => a.actionItems || []))];

  // 获取当前目标信息
  const currentGoal = USER_GOALS.find(g => g.id === userGoal);

  const handleDownloadPDF = async () => {
    if (!reportRef.current || isGeneratingPDF) return;

    setIsGeneratingPDF(true);
    try {
      // 临时隐藏底部操作栏
      const actionBar = reportRef.current.querySelector('[data-action-bar]') as HTMLElement;
      if (actionBar) actionBar.style.display = 'none';

      // 临时增加底部留白，减少分页截断
      const previousPadding = reportRef.current.style.paddingBottom;
      reportRef.current.style.paddingBottom = '32px';

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f9fafb',
        onclone: (doc) => {
          const root = doc.querySelector('[data-pdf-root]') as HTMLElement | null;
          if (!root) return;

          const view = doc.defaultView;
          if (!view) return;

          const colorFnPattern = /(oklch|oklab|lab|lch|color-mix|color)\(/i;
          const shadowColorPattern = /(oklch|oklab|lab|lch|color-mix|color)\([^)]*\)/gi;
          const scratch = doc.createElement('canvas');
          scratch.width = 1;
          scratch.height = 1;
          const ctx = scratch.getContext('2d');
          if (!ctx) return;

          const normalizeColor = (value: string) => {
            if (!value || value === 'transparent') return value;
            try {
              const prev = ctx.fillStyle as string;
              ctx.fillStyle = value;
              const normalized = ctx.fillStyle as string;
              ctx.fillStyle = prev;
              return normalized;
            } catch {
              return value;
            }
          };

          const applyColor = (el: HTMLElement, prop: keyof CSSStyleDeclaration, value: string) => {
            if (!value) return;
            (el.style as any)[prop] = normalizeColor(value);
          };

          const normalizeElement = (el: HTMLElement) => {
            const style = view.getComputedStyle(el);

            if (colorFnPattern.test(style.color)) applyColor(el, 'color', style.color);
            if (colorFnPattern.test(style.backgroundColor)) applyColor(el, 'backgroundColor', style.backgroundColor);
            if (colorFnPattern.test(style.borderTopColor)) applyColor(el, 'borderTopColor', style.borderTopColor);
            if (colorFnPattern.test(style.borderRightColor)) applyColor(el, 'borderRightColor', style.borderRightColor);
            if (colorFnPattern.test(style.borderBottomColor)) applyColor(el, 'borderBottomColor', style.borderBottomColor);
            if (colorFnPattern.test(style.borderLeftColor)) applyColor(el, 'borderLeftColor', style.borderLeftColor);
            if (colorFnPattern.test(style.outlineColor)) applyColor(el, 'outlineColor', style.outlineColor);
            if (colorFnPattern.test(style.textDecorationColor)) applyColor(el, 'textDecorationColor', style.textDecorationColor);

            if (style.boxShadow && shadowColorPattern.test(style.boxShadow)) {
              el.style.boxShadow = style.boxShadow.replace(shadowColorPattern, (match) => normalizeColor(match));
            }

            const fill = style.getPropertyValue('fill');
            if (fill && colorFnPattern.test(fill)) el.style.setProperty('fill', normalizeColor(fill));
            const stroke = style.getPropertyValue('stroke');
            if (stroke && colorFnPattern.test(stroke)) el.style.setProperty('stroke', normalizeColor(stroke));
          };

          normalizeElement(root);
          root.querySelectorAll<HTMLElement>('*').forEach((el) => normalizeElement(el));
        },
      });

      reportRef.current.style.paddingBottom = previousPadding;

      // 恢复底部操作栏
      if (actionBar) actionBar.style.display = '';

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const headerHeight = 12;
      const footerHeight = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2 - headerHeight - footerHeight;

      const pxPerMm = canvas.width / usableWidth;
      const pageHeightPx = Math.floor(usableHeight * pxPerMm);
      const totalPages = Math.ceil(canvas.height / pageHeightPx);

      const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

      let headerImageData: string | null = null;
      let headerImageWidth = 0;
      let headerImageHeight = 0;
      try {
        const headerImage = await loadImage('/pdf-header.png');
        const headerCanvas = document.createElement('canvas');
        headerCanvas.width = headerImage.naturalWidth || headerImage.width;
        headerCanvas.height = headerImage.naturalHeight || headerImage.height;
        const headerCtx = headerCanvas.getContext('2d');
        if (headerCtx) {
          headerCtx.drawImage(headerImage, 0, 0);
          headerImageData = headerCanvas.toDataURL('image/png');
          const aspect = headerCanvas.width / headerCanvas.height;
          headerImageHeight = 8;
          headerImageWidth = headerImageHeight * aspect;
        }
      } catch {
        headerImageData = null;
      }

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) pdf.addPage();

        const sourceY = pageIndex * pageHeightPx;
        const sourceHeight = Math.min(pageHeightPx, canvas.height - sourceY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sourceHeight,
            0,
            0,
            canvas.width,
            sourceHeight
          );
        }

        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92);
        const imgHeight = (sourceHeight / pxPerMm);
        const contentY = margin + headerHeight;

        // 页眉
        if (headerImageData) {
          pdf.addImage(headerImageData, 'PNG', margin, margin, headerImageWidth, headerImageHeight);
        } else {
          pdf.setFontSize(10);
          pdf.setTextColor(40);
          pdf.text('ProductThink 报告', margin, margin + 6);
        }

        // 内容
        pdf.addImage(pageImg, 'JPEG', margin, contentY, usableWidth, imgHeight);

        // 页脚
        const footerY = pageHeight - margin - 3;
        pdf.setFontSize(9);
        pdf.setTextColor(120);
        pdf.textWithLink('productthink.vivi.wiki', margin, footerY, { url: 'https://productthink.vivi.wiki' });
        pdf.text(`${pageIndex + 1} / ${totalPages}`, pageWidth - margin - 10, footerY, { align: 'right' });
      }

      const fallbackName = `ProductThink报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`;
      const productName = summary?.product
        ? summary.product.split('\n').find(Boolean)?.replace(/[\\/:*?"<>|]/g, '').slice(0, 20)
        : '';
      const fileName = `${productName || fallbackName}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF 生成失败:', error);
      alert('PDF 生成失败，请重试');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleShare = async () => {
    // TODO: 实现分享功能
    if (navigator.share) {
      await navigator.share({
        title: 'ProductThink 产品诊断报告',
        text: `综合评分: ${overallScore.toFixed(1)}/10`,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('链接已复制到剪贴板');
    }
  };

  const getScoreColor = () => 'text-gray-900';

  return (
    <div ref={reportRef} data-pdf-root className="max-w-4xl mx-auto px-4 md:px-6">
      {/* 报告头部 */}
      <div className="bg-white border border-gray-200 text-gray-900 rounded-2xl p-8 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <img src="/bot-avatar.svg" alt="ProductThink" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">ProductThink 产品诊断报告</h1>
            <p className="text-gray-500 mt-1">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              title="分享"
            >
              <Share2 size={20} />
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              title="下载 PDF"
            >
              {isGeneratingPDF ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
            </button>
          </div>
        </div>

        {/* 用户目标 */}
        {currentGoal && (
          <div className="bg-gray-100 rounded-xl px-4 py-2 mb-6 inline-flex items-center gap-2 text-gray-700">
            <span className="text-xl">{currentGoal.icon}</span>
            <span className="text-sm">目标：{currentGoal.label}</span>
          </div>
        )}

        {/* 综合评分 */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-gray-900">
              {overallScore.toFixed(1)}
            </div>
            <div className="text-gray-500 text-sm mt-1">综合评分</div>
          </div>
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-gray-900"
                style={{ width: `${overallScore * 10}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0</span>
              <span>10</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600 leading-relaxed">
          {getScoreRationale()}
        </p>
      </div>

      {/* 本周行动 - 新增重点板块 */}
      {allActionItems.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 size={24} className="text-gray-900" />
            <h2 className="text-xl font-bold">本周行动清单</h2>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            根据你的目标「{currentGoal?.label}」，专家们建议你本周优先执行以下行动：
          </p>
          <div className="space-y-3">
            {allActionItems.slice(0, 5).map((item, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-xl p-4 flex items-start gap-3"
              >
                <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm leading-relaxed text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 产品概要 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold mb-4">产品概要</h2>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-gray-700 whitespace-pre-wrap">{summary.product || '暂无产品描述'}</p>
        </div>
      </div>

      {/* 访问链接 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold mb-2">继续体验 ProductThink</h2>
        <p className="text-sm text-gray-600">
          点击进入：<span className="font-medium">productthink.vivi.wiki</span>
        </p>
      </div>

      {/* 专家评分 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold mb-4">专家评分</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {completedAnalyses.map((analysis) => {
            const expert = getExpertById(analysis.expertId);
            if (!expert) return null;

            return (
              <div key={analysis.expertId} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium overflow-hidden"
                    style={{ backgroundColor: expert.color }}
                  >
                    {expert.avatar ? (
                      <img
                        src={expert.avatar}
                        alt={expert.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      expert.name.charAt(0)
                    )}
                  </div>
                  <span className="font-medium">{expert.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-900"
                      style={{ width: `${analysis.score * 10}%` }}
                    />
                  </div>
                  <span className={`font-bold ${getScoreColor()}`}>
                    {analysis.score.toFixed(1)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                  {getExpertScoreRationale(expert.category, analysis.score)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 核心洞察 */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* 优势 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 mb-4">核心优势</h3>
          <ul className="space-y-2">
            {allStrengths.slice(0, 5).map((s, i) => (
              <li key={i} className="text-sm text-gray-700">
                • {s}
              </li>
            ))}
          </ul>
        </div>

        {/* 风险 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 mb-4">主要风险</h3>
          <ul className="space-y-2">
            {allRisks.slice(0, 5).map((r, i) => (
              <li key={i} className="text-sm text-gray-700">
                • {r}
              </li>
            ))}
          </ul>
        </div>

        {/* 建议 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 mb-4">策略建议</h3>
          <ul className="space-y-2">
            {allSuggestions.slice(0, 5).map((s, i) => (
              <li key={i} className="text-sm text-gray-700">
                {i + 1}. {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 详细分析 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold mb-4">详细分析</h2>
        <div className="space-y-6">
          {completedAnalyses.map((analysis) => {
            const expert = getExpertById(analysis.expertId);
            if (!expert) return null;

            return (
              <div key={analysis.expertId} className="border-b border-gray-100 pb-6 last:border-0">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden"
                    style={{ backgroundColor: expert.color }}
                  >
                    {expert.avatar ? (
                      <img
                        src={expert.avatar}
                        alt={expert.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      expert.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{expert.name}</h3>
                    <p className="text-sm text-gray-500">{expert.title}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-gray-400">★</span>
                    <span className="font-bold">{analysis.score.toFixed(1)}</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-3">
                    {getExpertScoreRationale(expert.category, analysis.score)}
                  </p>
                  {isGeneratingPDF ? (
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {stripJsonBlocks(analysis.analysis)}
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="pl-5 my-2 list-disc space-y-1">{children}</ul>,
                          ol: ({ children, start }) => (
                            <ol className="pl-5 my-2 list-decimal space-y-1" start={start}>
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => <li className="mb-0.5">{children}</li>,
                          pre: ({ children }) => (
                            <pre className="whitespace-pre-wrap break-words overflow-x-auto bg-gray-100 p-3 rounded text-gray-600 leading-relaxed">
                              {children}
                            </pre>
                          ),
                          code: ({ children, className }) => {
                            const isBlock = className?.includes('language-');
                            return isBlock ? (
                              <code className="font-mono text-[0.9em] whitespace-pre-wrap break-words text-gray-700 leading-relaxed">
                                {children}
                              </code>
                            ) : (
                              <code className="px-1 py-0.5 rounded bg-gray-100 font-mono text-[0.9em] text-gray-700">
                                {children}
                              </code>
                            );
                          },
                          h1: ({ children }) => <h1 className="text-lg font-semibold mt-4 mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-2">{children}</h3>,
                        }}
                      >
                        {stripJsonBlocks(analysis.analysis)}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部操作 */}
      <div data-action-bar className="sticky bottom-4 bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-600 hover:text-black transition-colors"
          >
            重新分析
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="px-4 py-2 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isGeneratingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isGeneratingPDF ? '生成中...' : '下载 PDF'}
            </button>
            <button
              onClick={onContinueChat}
              className="px-6 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <MessageSquare size={18} />
              继续对话
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
