export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CustomModelConfig {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface ProviderAttempt {
  name: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  nativeOpenAI?: boolean;
}

export interface KnowledgeResult {
  content: string;
  source: string;
  score?: number;
}

export interface SummaryOutput {
  productTitle: string;
  product: string;
  aiAdvice: string;
  userNotes: string;
  cases: Array<{ name: string; reason: string }>;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  scenario: string;
  painPoints: string[];
  motivations: string[];
  willingnessToPay: string;
  shortBio: string;
}

export interface RoleFeedback {
  vote: 'RED' | 'YELLOW' | 'GREEN';
  comment: string;
}
