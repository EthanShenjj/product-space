'use client';

import { useMemo, useState } from 'react';
import { ChatModelConfig, EditableModelConfig } from './types';

const STORAGE_KEY = 'chat_model_settings';
const SELECTED_MODEL_KEY = 'chat_selected_model_id';
const DEFAULT_MODEL_ID = 'system-default';

const defaultModel: ChatModelConfig = {
    id: DEFAULT_MODEL_ID,
    name: '默认模型',
    model: '系统自动选择',
    isDefault: true,
};

const createId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const readStoredModels = (): ChatModelConfig[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item): ChatModelConfig | null => {
                if (!item || typeof item !== 'object') return null;
                const record = item as Record<string, unknown>;
                const name = typeof record.name === 'string' ? record.name.trim() : '';
                const baseUrl = typeof record.baseUrl === 'string' ? record.baseUrl.trim() : '';
                const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : '';
                const model = typeof record.model === 'string' ? record.model.trim() : '';
                if (!name || !baseUrl || !apiKey || !model) return null;
                return {
                    id: typeof record.id === 'string' && record.id ? record.id : createId(),
                    name,
                    baseUrl,
                    apiKey,
                    model,
                };
            })
            .filter((item): item is ChatModelConfig => Boolean(item));
    } catch {
        return [];
    }
};

const readInitialSettings = () => {
    const storedModels = readStoredModels();
    if (typeof window === 'undefined') {
        return { customModels: storedModels, selectedModelId: DEFAULT_MODEL_ID };
    }

    const storedSelected = localStorage.getItem(SELECTED_MODEL_KEY);
    const selectedModelId =
        storedSelected && (storedSelected === DEFAULT_MODEL_ID || storedModels.some(model => model.id === storedSelected))
            ? storedSelected
            : DEFAULT_MODEL_ID;

    return { customModels: storedModels, selectedModelId };
};

export function useModelSettings() {
    const [{ customModels, selectedModelId }, setSettings] = useState(readInitialSettings);

    const models = useMemo(() => [defaultModel, ...customModels], [customModels]);
    const selectedModel = useMemo(
        () => models.find(model => model.id === selectedModelId) || defaultModel,
        [models, selectedModelId]
    );

    const persistModels = (nextModels: ChatModelConfig[]) => {
        setSettings(prev => ({ ...prev, customModels: nextModels }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextModels));
    };

    const selectModel = (modelId: string) => {
        const nextId = models.some(model => model.id === modelId) ? modelId : DEFAULT_MODEL_ID;
        setSettings(prev => ({ ...prev, selectedModelId: nextId }));
        localStorage.setItem(SELECTED_MODEL_KEY, nextId);
    };

    const addModel = (model: EditableModelConfig) => {
        const trimmed = {
            name: model.name.trim(),
            baseUrl: model.baseUrl.trim(),
            apiKey: model.apiKey.trim(),
            model: model.model.trim(),
        };
        if (!trimmed.name || !trimmed.baseUrl || !trimmed.apiKey || !trimmed.model) return false;

        const nextModel: ChatModelConfig = {
            id: createId(),
            ...trimmed,
        };
        const nextModels = [...customModels, nextModel];
        setSettings({ customModels: nextModels, selectedModelId: nextModel.id });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextModels));
        localStorage.setItem(SELECTED_MODEL_KEY, nextModel.id);
        return true;
    };

    const deleteModel = (modelId: string) => {
        const nextModels = customModels.filter(model => model.id !== modelId);
        persistModels(nextModels);
        if (selectedModelId === modelId) {
            setSettings({ customModels: nextModels, selectedModelId: DEFAULT_MODEL_ID });
            localStorage.setItem(SELECTED_MODEL_KEY, DEFAULT_MODEL_ID);
        }
    };

    return {
        models,
        selectedModel,
        selectedModelId,
        selectModel,
        addModel,
        deleteModel,
    };
}
