import { assistant, MemorySession, user } from '@openai/agents';
import type { AgentInputItem, Session } from '@openai/agents';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';
import type { ChatMessage } from './types';

const MAX_SEED_MESSAGES = 24;

function seedItems(messages: ChatMessage[]): AgentInputItem[] {
  return messages.slice(-MAX_SEED_MESSAGES).flatMap((message) => {
    if (!message.content?.trim() || message.role === 'system') return [];
    return [message.role === 'assistant' ? assistant(message.content) : user(message.content)];
  });
}

class SupabaseSession implements Session {
  constructor(private readonly sessionId: string, private readonly initialMessages: ChatMessage[]) {}

  async getSessionId() {
    return this.sessionId;
  }

  private async readStoredItems() {
    if (!supabaseAdmin) return [];
    const { data } = await supabaseAdmin
      .from('conversations')
      .select('agent_items')
      .eq('session_id', this.sessionId)
      .maybeSingle();
    return Array.isArray(data?.agent_items) ? data.agent_items as AgentInputItem[] : [];
  }

  async getItems(limit?: number) {
    const items = await this.readStoredItems();
    const available = items.length ? items : seedItems(this.initialMessages);
    return typeof limit === 'number' ? available.slice(-limit) : available;
  }

  async addItems(items: AgentInputItem[]) {
    if (!supabaseAdmin || !items.length) return;
    const existing = await this.readStoredItems();
    const next = [...(existing.length ? existing : seedItems(this.initialMessages)), ...items].slice(-120);
    await supabaseAdmin
      .from('conversations')
      .update({ agent_items: next })
      .eq('session_id', this.sessionId);
  }

  async popItem() {
    const items = await this.readStoredItems();
    const last = items.pop();
    if (supabaseAdmin) {
      await supabaseAdmin.from('conversations').update({ agent_items: items }).eq('session_id', this.sessionId);
    }
    return last;
  }

  async clearSession() {
    if (supabaseAdmin) {
      await supabaseAdmin.from('conversations').update({ agent_items: [] }).eq('session_id', this.sessionId);
    }
  }
}

export async function getConversationSession(sessionId: string | undefined, messages: ChatMessage[]): Promise<Session> {
  if (sessionId && isSupabaseConfigured && supabaseAdmin) {
    return new SupabaseSession(sessionId, messages);
  }
  const session = new MemorySession();
  const items = seedItems(messages.slice(0, -1));
  if (items.length) await session.addItems(items);
  return session;
}
