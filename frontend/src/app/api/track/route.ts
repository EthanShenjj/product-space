import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured, DbEvent } from '@/lib/supabase';

// 解析 IP 地址
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return 'unknown';
}

// 解析 User-Agent 获取设备信息
function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? 'mobile' : 'desktop';

  let browser = 'unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  let os = 'unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { device, browser, os };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 获取客户端信息
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const { device, browser, os } = parseUserAgent(userAgent);

    // 构建埋点记录
    const eventRecord: DbEvent = {
      session_id: body.sessionId || 'unknown',
      event_name: body.event,
      event_data: body.data || {},
      ip_address: ip,
      user_agent: userAgent,
      device_type: device,
      browser: browser,
      os: os,
      page_url: body.url || '',
    };

    // 输出到控制台（方便调试）
    console.log('[TRACK]', JSON.stringify({
      event: eventRecord.event_name,
      session: eventRecord.session_id,
      device: eventRecord.device_type,
      ip: eventRecord.ip_address,
    }));

    // 检查 Supabase 是否配置
    if (!isSupabaseConfigured || !supabaseAdmin) {
      // Supabase 未配置，仅输出日志
      console.warn('[TRACK] Supabase not configured, event logged to console only');
      return NextResponse.json({ success: true, storage: 'console' });
    }

    // 写入 Supabase
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert(eventRecord)
      .select('id')
      .single();

    if (error) {
      console.error('[TRACK] Supabase insert error:', error);
      return NextResponse.json({ success: true, storage: 'console-fallback' });
    }

    return NextResponse.json({ success: true, id: data?.id, storage: 'supabase' });
  } catch (error) {
    console.error('[TRACK] Error processing track request:', error);
    return NextResponse.json({ success: true, storage: 'console-fallback' });
  }
}

// GET: 查看统计数据（仅开发环境或有权限时）
export async function GET(request: NextRequest) {
  // 生产环境需要验证
  const authHeader = request.headers.get('authorization');
  const isAuthorized = process.env.NODE_ENV !== 'production' ||
    authHeader === `Bearer ${process.env.TRACK_API_SECRET}`;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'daily';

    let query;
    switch (view) {
      case 'sessions':
        query = supabaseAdmin.from('session_stats').select('*').limit(100);
        break;
      case 'events':
        query = supabaseAdmin.from('event_stats').select('*');
        break;
      case 'recent':
        query = supabaseAdmin
          .from('events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        break;
      case 'daily':
      default:
        query = supabaseAdmin.from('daily_stats').select('*').limit(30);
        break;
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ view, data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
