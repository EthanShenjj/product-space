import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

const mapCard = (row: any) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    author: 'Sparks',
    source: row.source || '',
    tags: row.tags || [],
    fullArticle: row.full_article || row.content,
    updatedAt: row.updated_at,
});

export async function GET() {
    if (!isSupabaseConfigured || !supabaseAdmin) {
        return NextResponse.json({ cards: [], storage: 'local-fallback' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('cms_items')
            .select('*')
            .eq('status', 'published')
            .order('updated_at', { ascending: false });
        if (error) {
            console.error('[CMS] Supabase query error:', error);
            return NextResponse.json({ cards: [], storage: 'local-fallback' });
        }
        return NextResponse.json({ cards: (data || []).map(mapCard) });
    } catch (error) {
        console.error('[CMS] Supabase request failed:', error);
        return NextResponse.json({ cards: [], storage: 'local-fallback' });
    }
}
