import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { requireAdmin } from '../_lib';

export async function POST(request: NextRequest) {
  const authed = await requireAdmin();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { id, starred } = body || {};

    if (!id || typeof starred !== 'boolean') {
      return NextResponse.json({ error: 'id and starred are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .update({
        starred,
        starred_at: starred ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select('id, starred, starred_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data?.id, starred: data?.starred, starred_at: data?.starred_at });
  } catch (error) {
    console.error('[ADMIN] Star update error:', error);
    return NextResponse.json({ error: 'Failed to update star' }, { status: 500 });
  }
}
