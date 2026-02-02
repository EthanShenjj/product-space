import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendVerificationEmail, generateVerificationCode } from '@/lib/email';

const CODE_EXPIRY_MINUTES = 10;
const MAX_CODES_PER_HOUR = 5;

export async function POST(request: NextRequest) {
  try {
    const { email, type } = await request.json();

    // 验证参数
    if (!email || !type) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (!['register', 'reset_password'].includes(type)) {
      return NextResponse.json({ error: '无效的验证码类型' }, { status: 400 });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 500 });
    }

    // 检查用户是否已存在
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (type === 'register' && existingUser) {
      return NextResponse.json({ error: '该邮箱已注册，请直接登录' }, { status: 400 });
    }

    if (type === 'reset_password' && !existingUser) {
      return NextResponse.json({ error: '该邮箱未注册' }, { status: 400 });
    }

    // 频率限制：每小时最多发送 5 次
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('verification_codes')
      .select('*', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .gte('created_at', oneHourAgo);

    if (count && count >= MAX_CODES_PER_HOUR) {
      return NextResponse.json(
        { error: '发送太频繁，请稍后再试' },
        { status: 429 }
      );
    }

    // 生成验证码
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // 保存验证码
    const { error: insertError } = await supabaseAdmin.from('verification_codes').insert({
      email: email.toLowerCase(),
      code,
      type,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('Failed to save verification code:', insertError);
      return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
    }

    // 发送邮件
    const result = await sendVerificationEmail(email, code, type);

    if (!result.success) {
      return NextResponse.json({ error: result.error || '邮件发送失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    console.error('Send code error:', error);
    return NextResponse.json({ error: '系统错误' }, { status: 500 });
  }
}
