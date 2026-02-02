import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // 验证参数
    if (!email || !password) {
      return NextResponse.json({ error: '请输入邮箱和密码' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 500 });
    }

    const normalizedEmail = email.toLowerCase();

    // 查找用户
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, nickname, avatar_url')
      .eq('email', normalizedEmail)
      .single();

    if (!user) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    // 更新最后登录时间
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // 生成 token 并设置 cookie
    const token = await generateToken(user.id, user.email);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '系统错误' }, { status: 500 });
  }
}
