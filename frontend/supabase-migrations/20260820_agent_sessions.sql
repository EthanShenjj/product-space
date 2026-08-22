-- Persistent OpenAI Agents SDK session items for existing conversations.
-- Safe to run repeatedly in Supabase SQL Editor.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS agent_items JSONB DEFAULT '[]';
