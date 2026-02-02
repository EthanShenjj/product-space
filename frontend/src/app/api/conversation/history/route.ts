import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

// GET: 获取当前用户的历史会话列表
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 500 });
    }

    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select('id, session_id, title, stage, message_count, created_at, updated_at, summary')
      .eq('user_id', currentUser.userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[HISTORY] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 格式化返回数据
    const formattedConversations = (conversations || []).map(conv => ({
      id: conv.id,
      sessionId: conv.session_id,
      title: conv.title || '新对话',
      stage: conv.stage,
      messageCount: conv.message_count,
      productTitle: conv.summary?.productTitle || '',
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    }));

    return NextResponse.json({ conversations: formattedConversations });
  } catch (error) {
    console.error('[HISTORY] Error:', error);
    return NextResponse.json({ error: '获取历史会话失败' }, { status: 500 });
  }
}
