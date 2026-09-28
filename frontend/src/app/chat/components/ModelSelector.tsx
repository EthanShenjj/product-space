'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Bot, Check, ChevronDown, Eye, EyeOff, Plus, Settings2, Trash2, X } from 'lucide-react';
import { ChatModelConfig, EditableModelConfig } from '../types';

interface ModelSelectorProps {
    models: ChatModelConfig[];
    selectedModelId: string;
    onSelectModel: (modelId: string) => void;
    onAddModel: (model: EditableModelConfig) => boolean;
    onDeleteModel: (modelId: string) => void;
    disabled?: boolean;
}

const emptyModel: EditableModelConfig = {
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
};

const providerPresets = [
    { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1/chat/completions' },
    {
        label: 'Gemini',
        name: 'Gemini 3.7 Flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        model: 'gemini-3.7-flash',
    },
    { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1/chat/completions' },
    { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1/chat/completions' },
];

export function ModelSelector({
    models,
    selectedModelId,
    onSelectModel,
    onAddModel,
    onDeleteModel,
    disabled,
}: ModelSelectorProps) {
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [form, setForm] = useState<EditableModelConfig>(emptyModel);
    const [error, setError] = useState('');

    const selectedModel = models.find(model => model.id === selectedModelId) || models[0];
    const customModels = models.filter(model => !model.isDefault);
    const isFormReady = useMemo(() => {
        return Boolean(form.name.trim() && form.baseUrl.trim() && form.apiKey.trim() && form.model.trim());
    }, [form]);

    const updateField = (field: keyof EditableModelConfig, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    const handleSelect = (modelId: string) => {
        onSelectModel(modelId);
        setIsSwitcherOpen(false);
    };

    const openManager = () => {
        setIsManagerOpen(true);
        setIsSwitcherOpen(false);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isFormReady) {
            setError('请补全模型名称、接口地址、API Key 和模型名');
            return;
        }

        const added = onAddModel(form);
        if (!added) {
            setError('请检查模型配置');
            return;
        }

        setForm(emptyModel);
        setError('');
        setIsManagerOpen(false);
    };

    return (
        <div className="relative mb-3 flex items-center justify-between gap-2">
            <button
                type="button"
                onClick={() => setIsSwitcherOpen(prev => !prev)}
                disabled={disabled}
                className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-hairline bg-surface-raised px-3 py-2 text-xs text-ink-secondary transition hover:border-hairline-strong hover:bg-surface disabled:opacity-60"
                aria-label="切换模型"
                aria-expanded={isSwitcherOpen}
            >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                    <Bot size={12} />
                </span>
                <span className="min-w-0 truncate font-medium">{selectedModel?.name || '默认模型'}</span>
                <span className="hidden min-w-0 truncate text-ink-faint sm:inline">{selectedModel?.model}</span>
                <ChevronDown size={14} className={`shrink-0 text-ink-faint transition ${isSwitcherOpen ? 'rotate-180' : ''}`} />
            </button>

            <button
                type="button"
                onClick={openManager}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-raised text-ink-secondary transition hover:border-hairline-strong hover:text-ink"
                aria-label="模型设置"
            >
                <Settings2 size={16} />
            </button>

            {isSwitcherOpen ? (
                <>
                    <button
                        type="button"
                        aria-label="关闭模型切换"
                        className="fixed inset-0 z-20 cursor-default"
                        onClick={() => setIsSwitcherOpen(false)}
                    />
                    <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-hairline bg-surface-raised shadow-float">
                        <div className="p-2">
                            {models.map(model => {
                                const selected = selectedModelId === model.id;
                                return (
                                    <button
                                        key={model.id}
                                        type="button"
                                        onClick={() => handleSelect(model.id)}
                                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${
                                            selected ? 'bg-ink text-paper' : 'text-ink-secondary hover:bg-surface-sunken'
                                        }`}
                                    >
                                        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                                            selected ? 'bg-paper/15 text-paper' : 'bg-surface-sunken text-ink-secondary'
                                        }`}>
                                            <Bot size={15} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{model.name}</span>
                                            <span className={`block truncate text-xs ${selected ? 'text-paper/65' : 'text-ink-faint'}`}>
                                                {model.model}
                                            </span>
                                        </span>
                                        {selected ? <Check size={16} className="shrink-0" /> : null}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="border-t border-hairline p-2">
                            <button
                                type="button"
                                onClick={openManager}
                                className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-ink-secondary transition hover:bg-surface-sunken hover:text-ink"
                            >
                                <Plus size={14} />
                                添加或管理模型
                            </button>
                        </div>
                    </div>
                </>
            ) : null}

            {isManagerOpen ? (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 py-5 sm:items-center"
                    onClick={() => setIsManagerOpen(false)}
                >
                    <div
                        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-surface-raised shadow-float"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                            <div>
                                <h2 className="text-base font-semibold text-ink">模型设置</h2>
                                <p className="mt-0.5 text-xs text-ink-muted">快速切换默认模型，也可以添加 OpenAI 兼容接口。</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsManagerOpen(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                                aria-label="关闭"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <div className="grid max-h-[78vh] overflow-y-auto md:grid-cols-[280px_1fr]">
                            <div className="border-b border-hairline p-4 md:border-b-0 md:border-r">
                                <div className="micro-label mb-2">可用模型</div>
                                <div className="space-y-2">
                                    {models.map(model => {
                                        const selected = selectedModelId === model.id;
                                        return (
                                            <div
                                                key={model.id}
                                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                                                    selected ? 'border-ink bg-surface-sunken' : 'border-hairline'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectModel(model.id)}
                                                    className="min-w-0 flex-1 text-left"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className="truncate text-sm font-medium text-ink">{model.name}</span>
                                                        {selected ? <Check size={14} className="shrink-0 text-score" /> : null}
                                                    </span>
                                                    <span className="mt-0.5 block truncate text-xs text-ink-muted">{model.model}</span>
                                                </button>
                                                {!model.isDefault ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteModel(model.id)}
                                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-danger-bg hover:text-danger"
                                                        aria-label={`删除 ${model.name}`}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                                {customModels.length ? null : (
                                    <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                                        自定义模型会保存在当前浏览器，本机下次打开仍可继续使用。
                                    </p>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4 p-4">
                                <div>
                                    <div className="micro-label">接口预设</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {providerPresets.map(preset => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        baseUrl: preset.baseUrl,
                                                        name: preset.name || prev.name,
                                                        model: preset.model || prev.model,
                                                    }));
                                                    setError('');
                                                }}
                                                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                                                    form.baseUrl === preset.baseUrl
                                                        ? 'border-ink bg-ink text-paper'
                                                        : 'border-hairline text-ink-secondary hover:border-hairline-strong hover:text-ink'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block text-xs font-medium text-ink-secondary">
                                        模型名称
                                        <input
                                            value={form.name}
                                            onChange={(event) => updateField('name', event.target.value)}
                                            className="input-field mt-1 px-3 py-2.5 text-sm"
                                            placeholder="例如 GPT-4.1"
                                        />
                                    </label>
                                    <label className="block text-xs font-medium text-ink-secondary">
                                        模型名
                                        <input
                                            value={form.model}
                                            onChange={(event) => updateField('model', event.target.value)}
                                            className="input-field mt-1 px-3 py-2.5 text-sm"
                                            placeholder="gpt-4.1"
                                        />
                                    </label>
                                </div>

                                <label className="block text-xs font-medium text-ink-secondary">
                                    接口地址
                                    <input
                                        value={form.baseUrl}
                                        onChange={(event) => updateField('baseUrl', event.target.value)}
                                        className="input-field mt-1 px-3 py-2.5 text-sm"
                                        placeholder="https://api.example.com/v1/chat/completions"
                                    />
                                </label>

                                <label className="block text-xs font-medium text-ink-secondary">
                                    API Key
                                    <span className="relative mt-1 block">
                                        <input
                                            type={showApiKey ? 'text' : 'password'}
                                            value={form.apiKey}
                                            onChange={(event) => updateField('apiKey', event.target.value)}
                                            className="input-field w-full px-3 py-2.5 pr-10 text-sm"
                                            placeholder="sk-..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(prev => !prev)}
                                            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
                                            aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                                        >
                                            {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </span>
                                </label>

                                {error ? <p className="text-xs text-danger">{error}</p> : null}

                                <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsManagerOpen(false)}
                                        className="rounded-full px-4 py-2 text-xs font-medium text-ink-secondary transition hover:bg-surface-sunken hover:text-ink"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!isFormReady}
                                        className="btn-primary px-4 py-2 text-xs disabled:cursor-not-allowed"
                                    >
                                        <Plus size={14} />
                                        保存并使用
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
