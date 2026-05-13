-- =============================================
-- ProductThink - Supabase 数据库初始化脚本
-- =============================================
-- 使用方法：
-- 1. 登录 Supabase Dashboard (https://supabase.com/dashboard)
-- 2. 选择你的项目
-- 3. 进入 SQL Editor
-- 4. 复制粘贴此脚本并执行
-- =============================================

-- 1. 创建事件表（埋点数据）
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  page_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为常用查询创建索引
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_device_type ON events(device_type);

-- 2. 创建对话记录表
-- 用户表需要先创建，后面的 conversations.user_id 会引用 users(id)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  messages JSONB DEFAULT '[]',
  summary JSONB,
  stage VARCHAR(50) DEFAULT 'info',
  message_count INTEGER DEFAULT 0,
  starred BOOLEAN DEFAULT FALSE,
  starred_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- 兼容已有表结构
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- 2.1 创建 Sparks CMS 表（管理后台内容）
CREATE TABLE IF NOT EXISTS cms_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  full_article TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_items_status ON cms_items(status);
CREATE INDEX IF NOT EXISTS idx_cms_items_updated_at ON cms_items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_items_category ON cms_items(category);

-- 3. 创建会话统计视图（方便查询）
CREATE OR REPLACE VIEW session_stats AS
SELECT
  session_id,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen,
  COUNT(*) as event_count,
  COUNT(DISTINCT event_name) as unique_events,
  MAX(CASE WHEN event_name = 'page_view' THEN (event_data->>'page')::text END) as last_page,
  MAX(device_type) as device_type,
  MAX(browser) as browser,
  MAX(os) as os,
  MAX(ip_address) as ip_address
FROM events
GROUP BY session_id;

-- 4. 创建每日统计视图
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_events,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(*) FILTER (WHERE event_name = 'page_view') as page_views,
  COUNT(*) FILTER (WHERE event_name = 'message_sent') as messages_sent,
  COUNT(*) FILTER (WHERE event_name = 'api_error') as errors,
  COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile_users,
  COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop_users
FROM events
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 5. 创建事件统计视图
CREATE OR REPLACE VIEW event_stats AS
SELECT
  event_name,
  COUNT(*) as count,
  COUNT(DISTINCT session_id) as unique_sessions,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM events
GROUP BY event_name
ORDER BY count DESC;

-- 6. 设置 RLS（行级安全策略）
-- 启用 RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_items ENABLE ROW LEVEL SECURITY;

-- 允许服务端写入（使用 service_role key）
CREATE POLICY "Allow service role full access to events" ON events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to conversations" ON conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to cms_items" ON cms_items
  FOR ALL USING (true) WITH CHECK (true);

-- 7. 创建自动更新 updated_at 的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 8. IP 维度统计视图
-- =============================================
CREATE OR REPLACE VIEW total_unique_ips AS
SELECT COUNT(DISTINCT ip_address) AS total_unique_ips
FROM events
WHERE ip_address IS NOT NULL AND ip_address <> 'unknown';

CREATE OR REPLACE VIEW daily_ip_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL AND ip_address <> 'unknown') AS unique_ips,
  COUNT(DISTINCT ip_address) FILTER (
    WHERE event_name = 'page_view' AND ip_address IS NOT NULL AND ip_address <> 'unknown'
  ) AS page_view_ips,
  COUNT(DISTINCT ip_address) FILTER (
    WHERE event_name IN ('chat_start','message_sent') AND ip_address IS NOT NULL AND ip_address <> 'unknown'
  ) AS active_ips
FROM events
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW daily_ip_retention AS
WITH daily_ips AS (
  SELECT DATE(created_at) AS date, ip_address
  FROM events
  WHERE ip_address IS NOT NULL AND ip_address <> 'unknown'
  GROUP BY DATE(created_at), ip_address
),
joined AS (
  SELECT
    d1.date AS date,
    COUNT(DISTINCT d1.ip_address) AS active_ips,
    COUNT(DISTINCT d2.ip_address) AS retained_ips
  FROM daily_ips d1
  LEFT JOIN daily_ips d2
    ON d2.date = d1.date + INTERVAL '1 day'
   AND d2.ip_address = d1.ip_address
  GROUP BY d1.date
)
SELECT
  date,
  active_ips,
  retained_ips,
  CASE WHEN active_ips = 0 THEN 0 ELSE retained_ips::FLOAT / active_ips END AS retention_rate
FROM joined
ORDER BY date DESC;

-- =============================================
-- 9. 对话完成率（按 IP）
-- =============================================
CREATE OR REPLACE VIEW daily_chat_completion_ip AS
WITH chat_visits AS (
  SELECT DATE(created_at) AS date, ip_address
  FROM events
  WHERE event_name = 'page_view'
    AND ((event_data->>'page') = 'chat' OR (event_data->>'page') LIKE '%/chat%')
    AND ip_address IS NOT NULL AND ip_address <> 'unknown'
  GROUP BY DATE(created_at), ip_address
),
message_senders AS (
  SELECT DATE(created_at) AS date, ip_address
  FROM events
  WHERE event_name = 'message_sent'
    AND ip_address IS NOT NULL AND ip_address <> 'unknown'
  GROUP BY DATE(created_at), ip_address
),
joined AS (
  SELECT
    v.date AS date,
    COUNT(DISTINCT v.ip_address) AS started_ips,
    COUNT(DISTINCT s.ip_address) AS completed_ips
  FROM chat_visits v
  LEFT JOIN message_senders s
    ON s.date = v.date
   AND s.ip_address = v.ip_address
  GROUP BY v.date
)
SELECT
  date,
  started_ips,
  completed_ips,
  CASE WHEN started_ips = 0 THEN 0 ELSE completed_ips::FLOAT / started_ips END AS completion_rate
FROM joined
ORDER BY date DESC;

-- =============================================
-- 10. 阶段分布（按 IP）
-- =============================================
CREATE OR REPLACE VIEW stage_ip_stats AS
SELECT
  stage,
  COUNT(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL AND ip_address <> 'unknown') AS unique_ips,
  COUNT(*) AS conversations
FROM conversations
GROUP BY stage
ORDER BY unique_ips DESC;

-- =============================================
-- 11. 消息反馈统计
-- =============================================
CREATE OR REPLACE VIEW message_feedback_stats AS
SELECT
  COUNT(*) FILTER (WHERE event_data->>'vote' = 'up') AS likes,
  COUNT(*) FILTER (WHERE event_data->>'vote' = 'down') AS dislikes
FROM events
WHERE event_name = 'message_feedback';

-- =============================================
-- 12. 对话框/消息量统计
-- =============================================
CREATE OR REPLACE VIEW total_conversation_messages AS
SELECT COALESCE(SUM(message_count), 0) AS total_messages
FROM conversations;

CREATE OR REPLACE VIEW daily_conversation_metrics AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS conversations,
  COALESCE(SUM(message_count), 0) AS total_messages,
  CASE WHEN COUNT(*) = 0 THEN 0 ELSE COALESCE(SUM(message_count), 0)::FLOAT / COUNT(*) END AS avg_messages_per_conversation
FROM conversations
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE TRIGGER update_cms_items_updated_at
  BEFORE UPDATE ON cms_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 8. 用户反馈（建议/评论）
-- =============================================
CREATE TABLE IF NOT EXISTS feedback_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  contact TEXT DEFAULT '',
  source TEXT DEFAULT 'site',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to feedback_items" ON feedback_items
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 9. 消息反馈（点赞/踩 + 评论）
-- =============================================
CREATE TABLE IF NOT EXISTS message_feedback_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  vote TEXT NOT NULL,
  comment TEXT DEFAULT '',
  stage TEXT DEFAULT '',
  session_id TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to message_feedback_items" ON message_feedback_items
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 10. 用户认证系统
-- =============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to users" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- 验证码表（注册验证 + 忘记密码）
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type VARCHAR(20) NOT NULL,  -- 'register' 或 'reset_password'
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to verification_codes" ON verification_codes
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 完成！
--
-- 接下来需要在 .env.local 中配置：
-- NEXT_PUBLIC_SUPABASE_URL=你的项目URL
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon key
-- SUPABASE_SERVICE_ROLE_KEY=你的service role key
-- RESEND_API_KEY=你的Resend API Key
-- =============================================
