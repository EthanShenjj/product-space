import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

// GET: 获取单个会话详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 500 });
    }

    const { sessionId } = await params;

    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', currentUser.userId)
      .single();

    if (error || !conversation) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        sessionId: conversation.session_id,
        title: conversation.title || '新对话',
        messages: conversation.messages || [],
        summary: conversation.summary || {},
        stage: conversation.stage,
        messageCount: conversation.message_count,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
    });
  } catch (error) {
    console.error('[CONVERSATION DETAIL] Error:', error);
    return NextResponse.json({ error: '获取会话详情失败' }, { status: 500 });
  }
}

// DELETE: 删除会话
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 500 });
    }

    const { sessionId } = await params;

    const { error } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', currentUser.userId);

    if (error) {
      console.error('[CONVERSATION DELETE] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CONVERSATION DELETE] Error:', error);
    return NextResponse.json({ error: '删除会话失败' }, { status: 500 });
  }
}
