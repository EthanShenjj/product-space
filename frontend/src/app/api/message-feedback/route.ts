import { NextRequest } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

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

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const vote = String(payload.vote || '').trim();
  const messageId = String(payload.messageId || '').trim();
  const comment = String(payload.comment || '').trim();
  const stage = String(payload.stage || '').trim();
  const sessionId = String(payload.sessionId || '').trim();

  if (!vote || !['up', 'down'].includes(vote)) {
    return new Response(JSON.stringify({ error: 'Invalid vote' }), { status: 400 });
  }
  if (!messageId) {
    return new Response(JSON.stringify({ error: 'messageId is required' }), { status: 400 });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    console.warn('[MESSAGE_FEEDBACK] Supabase not configured:', { messageId, vote, comment, stage, sessionId });
    return new Response(JSON.stringify({ ok: true, storage: 'console' }), { status: 200 });
  }

  const ip = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || '';

  const { error } = await supabaseAdmin.from('message_feedback_items').insert({
    message_id: messageId,
    vote,
    comment,
    stage,
    session_id: sessionId,
    ip_address: ip,
    user_agent: userAgent,
  });

  if (error) {
    console.error('[MESSAGE_FEEDBACK] Supabase insert error:', error);
    return new Response(JSON.stringify({ ok: true, storage: 'console-fallback' }), { status: 200 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
