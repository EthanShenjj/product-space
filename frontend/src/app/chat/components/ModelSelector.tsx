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
                className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                aria-label="切换模型"
                aria-expanded={isSwitcherOpen}
            >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                    <Bot size={12} />
                </span>
                <span className="min-w-0 truncate font-medium">{selectedModel?.name || '默认模型'}</span>
                <span className="hidden min-w-0 truncate text-gray-400 sm:inline">{selectedModel?.model}</span>
                <ChevronDown size={14} className={`shrink-0 text-gray-400 transition ${isSwitcherOpen ? 'rotate-180' : ''}`} />
            </button>

            <button
                type="button"
                onClick={openManager}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
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
                    <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                        <div className="p-2">
                            {models.map(model => {
                                const selected = selectedModelId === model.id;
                                return (
                                    <button
                                        key={model.id}
                                        type="button"
                                        onClick={() => handleSelect(model.id)}
                                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${
                                            selected ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                                            selected ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            <Bot size={15} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{model.name}</span>
                                            <span className={`block truncate text-xs ${selected ? 'text-white/65' : 'text-gray-400'}`}>
                                                {model.model}
                                            </span>
                                        </span>
                                        {selected ? <Check size={16} className="shrink-0" /> : null}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="border-t border-gray-100 p-2">
                            <button
                                type="button"
                                onClick={openManager}
                                className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
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
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 py-5 sm:items-center"
                    onClick={() => setIsManagerOpen(false)}
                >
                    <div
                        className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">模型设置</h2>
                                <p className="mt-0.5 text-xs text-gray-500">快速切换默认模型，也可以添加 OpenAI 兼容接口。</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsManagerOpen(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                                aria-label="关闭"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <div className="grid max-h-[78vh] overflow-y-auto md:grid-cols-[280px_1fr]">
                            <div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r">
                                <div className="mb-2 text-xs font-medium text-gray-500">可用模型</div>
                                <div className="space-y-2">
                                    {models.map(model => {
                                        const selected = selectedModelId === model.id;
                                        return (
                                            <div
                                                key={model.id}
                                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                                                    selected ? 'border-gray-900 bg-gray-50' : 'border-gray-100'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectModel(model.id)}
                                                    className="min-w-0 flex-1 text-left"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className="truncate text-sm font-medium text-gray-900">{model.name}</span>
                                                        {selected ? <Check size={14} className="shrink-0 text-green-600" /> : null}
                                                    </span>
                                                    <span className="mt-0.5 block truncate text-xs text-gray-500">{model.model}</span>
                                                </button>
                                                {!model.isDefault ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteModel(model.id)}
                                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600"
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
                                    <p className="mt-3 text-xs leading-relaxed text-gray-400">
                                        自定义模型会保存在当前浏览器，本机下次打开仍可继续使用。
                                    </p>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4 p-4">
                                <div>
                                    <div className="text-xs font-medium text-gray-500">接口预设</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {providerPresets.map(preset => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => updateField('baseUrl', preset.baseUrl)}
                                                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                                                    form.baseUrl === preset.baseUrl
                                                        ? 'border-gray-900 bg-gray-900 text-white'
                                                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block text-xs font-medium text-gray-600">
                                        模型名称
                                        <input
                                            value={form.name}
                                            onChange={(event) => updateField('name', event.target.value)}
                                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-black/5"
                                            placeholder="例如 GPT-4.1"
                                        />
                                    </label>
                                    <label className="block text-xs font-medium text-gray-600">
                                        模型名
                                        <input
                                            value={form.model}
                                            onChange={(event) => updateField('model', event.target.value)}
                                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-black/5"
                                            placeholder="gpt-4.1"
                                        />
                                    </label>
                                </div>

                                <label className="block text-xs font-medium text-gray-600">
                                    接口地址
                                    <input
                                        value={form.baseUrl}
                                        onChange={(event) => updateField('baseUrl', event.target.value)}
                                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-black/5"
                                        placeholder="https://api.example.com/v1/chat/completions"
                                    />
                                </label>

                                <label className="block text-xs font-medium text-gray-600">
                                    API Key
                                    <span className="relative mt-1 block">
                                        <input
                                            type={showApiKey ? 'text' : 'password'}
                                            value={form.apiKey}
                                            onChange={(event) => updateField('apiKey', event.target.value)}
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-black/5"
                                            placeholder="sk-..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(prev => !prev)}
                                            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                                            aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                                        >
                                            {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </span>
                                </label>

                                {error ? <p className="text-xs text-red-600">{error}</p> : null}

                                <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsManagerOpen(false)}
                                        className="rounded-full px-4 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!isFormReady}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
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
