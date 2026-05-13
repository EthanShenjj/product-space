import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;
  return 'unknown';
}

// 从消息中提取对话标题
function extractTitle(messages: { role: string; content: string }[]): string {
  // 找到第一条用户消息
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return '新对话';

  // 截取前 50 个字符作为标题
  const content = firstUserMessage.content.trim();
  if (content.length <= 50) return content;
  return content.slice(0, 50) + '...';
}

// POST: 保存或更新对话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, messages, summary, stage, inviteCode } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // 获取当前登录用户
    const currentUser = await getCurrentUser();
    const userId = currentUser?.userId || null;

    // 输出到控制台
    console.log('[CONVERSATION] Save:', {
      sessionId,
      messageCount: messages?.length || 0,
      stage,
      inviteCode,
      userId,
    });

    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    if (!isSupabaseConfigured || !supabaseAdmin) {
      console.warn('[CONVERSATION] Supabase not configured');
      return NextResponse.json({ success: true, storage: 'console' });
    }

    // 提取对话标题
    const title = extractTitle(messages || []);

    // 检查是否已存在该会话
    const { data: existing } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (existing) {
      // 更新现有对话
      const updateData: Record<string, unknown> = {
        messages,
        summary,
        stage,
        message_count: messages?.length || 0,
        ip_address: ip,
        user_agent: userAgent,
        invite_code: inviteCode || null,
        title,
      };
      // 如果用户已登录且对话还没有关联用户，则关联
      if (userId) {
        updateData.user_id = userId;
      }

      const { error } = await supabaseAdmin
        .from('conversations')
        .update(updateData)
        .eq('session_id', sessionId);

      if (error) {
        console.error('[CONVERSATION] Update error:', error);
        return NextResponse.json({ success: true, storage: 'console-fallback' });
      }
    } else {
      // 创建新对话
      const { error } = await supabaseAdmin
        .from('conversations')
        .insert({
          session_id: sessionId,
          messages,
          summary,
          stage,
          message_count: messages?.length || 0,
          ip_address: ip,
          user_agent: userAgent,
          invite_code: inviteCode || null,
          user_id: userId,
          title,
        });

      if (error) {
        console.error('[CONVERSATION] Insert error:', error);
        return NextResponse.json({ success: true, storage: 'console-fallback' });
      }
    }

    return NextResponse.json({ success: true, storage: 'supabase' });
  } catch (error) {
    console.error('[CONVERSATION] Error:', error);
    return NextResponse.json({ success: true, storage: 'console-fallback' });
  }
}
