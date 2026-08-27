-- Personal cloud-sandbox tools. Apply through the Supabase SQL editor before enabling chat provisioning.
CREATE TABLE IF NOT EXISTS sandbox_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_session_id VARCHAR(100),
  tool_id VARCHAR(64) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('cli', 'mcp', 'skill')),
  label VARCHAR(80) NOT NULL,
  description VARCHAR(240) NOT NULL,
  command TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '[]',
  network JSONB NOT NULL DEFAULT '[]',
  install JSONB NOT NULL DEFAULT '[]',
  snapshot_id TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_sandbox_tools_user_updated ON sandbox_tools(user_id, updated_at DESC);
ALTER TABLE sandbox_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access to sandbox tools" ON sandbox_tools
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_sandbox_tools_updated_at
  BEFORE UPDATE ON sandbox_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
