import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const payload = await getCurrentUser();

    if (!payload) {
      return NextResponse.json({ user: null });
    }

    // 获取用户详细信息
    if (supabaseAdmin) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, email, nickname, avatar_url')
        .eq('id', payload.userId)
        .single();

      if (user) {
        return NextResponse.json({
          user: {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            avatarUrl: user.avatar_url,
          },
        });
      }
    }

    // 如果数据库查询失败，返回 JWT 中的基本信息
    return NextResponse.json({
      user: {
        id: payload.userId,
        email: payload.email,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json({ user: null });
  }
}
