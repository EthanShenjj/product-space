import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 服务端专用 key（用于绕过 RLS 策略）
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 检查是否配置了 Supabase
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// 创建客户端（仅在配置了 Supabase 时）
let supabaseInstance: SupabaseClient | null = null;
let supabaseAdminInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  supabaseAdminInstance = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabaseInstance;
}

// 客户端实例（用于前端）
export const supabase = supabaseInstance;

// 服务端实例（用于 API Routes，有完整权限）
export const supabaseAdmin = supabaseAdminInstance;

// 数据库表类型定义
export interface DbUser {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  ip_address: string;
  country?: string;
  city?: string;
  device_type: string;
  browser: string;
  os: string;
}

export interface DbEvent {
  id?: number;
  session_id: string;
  event_name: string;
  event_data: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  device_type: string;
  browser: string;
  os: string;
  page_url: string;
  created_at?: string;
}

export interface DbConversation {
  id: string;
  session_id: string;
  messages: Array<{ role: string; content: string }>;
  agent_items?: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
  stage: string;
  created_at?: string;
  updated_at?: string;
}
