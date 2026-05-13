import { NextRequest } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    const payload = await req.json();
    const content = String(payload.content || '').trim();
    const contact = String(payload.contact || '').trim();

    if (!content) {
        return new Response(JSON.stringify({ error: '请填写意见内容' }), { status: 400 });
    }

    if (!isSupabaseConfigured || !supabaseAdmin) {
        console.warn('[FEEDBACK] Supabase not configured:', { content, contact });
        return new Response(JSON.stringify({ ok: true, storage: 'console' }), { status: 200 });
    }

    const { error } = await supabaseAdmin.from('feedback_items').insert({
      content,
      contact,
      source: 'site',
    });

    if (error) {
        console.error('[FEEDBACK] Supabase insert error:', error);
        return new Response(JSON.stringify({ ok: true, storage: 'console-fallback' }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
