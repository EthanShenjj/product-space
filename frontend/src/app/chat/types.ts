export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export interface Summary {
    productTitle: string;
    product: string;
    aiAdvice: string;
    userNotes: string;
    cases: { name: string; reason: string }[];
}

export type Stage = 'info' | 'deep' | 'analysis';

export interface StageConfig {
    label: string;
    goal: string;
    checklist: { label: string; done: boolean }[];
    takeaway: string;
}
