import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, code, password } = await request.json();

    // 验证参数
    if (!email || !code || !password) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 500 });
    }

    const normalizedEmail = email.toLowerCase();

    // 检查用户是否存在
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single();

    if (!user) {
      return NextResponse.json({ error: '该邮箱未注册' }, { status: 400 });
    }

    // 验证验证码
    const { data: codeRecord } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', code)
      .eq('type', 'reset_password')
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!codeRecord) {
      return NextResponse.json({ error: '验证码无效或已过期' }, { status: 400 });
    }

    // 标记验证码为已使用
    await supabaseAdmin
      .from('verification_codes')
      .update({ used: true })
      .eq('id', codeRecord.id);

    // 更新密码
    const passwordHash = await hashPassword(password);
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_hash: passwordHash,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return NextResponse.json({ error: '密码重置失败，请稍后重试' }, { status: 500 });
    }

    // 生成 token 并设置 cookie
    const token = await generateToken(user.id, user.email);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: '系统错误' }, { status: 500 });
  }
}
