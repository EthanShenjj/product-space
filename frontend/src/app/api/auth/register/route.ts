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

    // 检查邮箱是否已注册
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: '该邮箱已注册，请直接登录' }, { status: 400 });
    }

    // 验证验证码
    const { data: codeRecord } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', code)
      .eq('type', 'register')
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

    // 创建用户
    const passwordHash = await hashPassword(password);
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
      })
      .select('id, email')
      .single();

    if (createError || !newUser) {
      console.error('Failed to create user:', createError);
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }

    // 生成 token 并设置 cookie
    const token = await generateToken(newUser.id, newUser.email);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: '系统错误' }, { status: 500 });
  }
}
