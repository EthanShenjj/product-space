import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../../_lib';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

const ROOT = process.cwd();
const AUTO_CARDS = path.join(ROOT, 'frontend', 'src', 'data', 'cards.auto.json');
const SOURCES = path.join(ROOT, 'frontend', 'data', 'sparks_sources.json');
const KB_DIR = path.join(ROOT, '产品知识库');

const CATEGORY_MAP: Record<string, string> = {
    '01-产品与设计': '产品与设计',
    '02-商业与战略': '商业与战略',
    '03-思维与认知': '思维与认知',
    '04-成长与效能': '成长与效能',
    '05-技术与AI': '技术与AI',
    '06-其他': '其他',
};

const headingRe = /^\s*#{1,6}\s+(.*)$/;

function firstHeading(text: string) {
    for (const line of text.split(/\r?\n/)) {
        const match = headingRe.exec(line);
        if (match) return match[1].trim();
    }
    return '';
}

function shortSummary(text: string) {
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('来源')) continue;
        if (trimmed.startsWith('#')) continue;
        return trimmed.slice(0, 120);
    }
    return '';
}

export async function POST() {
    if (!(await requireAdmin())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    if (!isSupabaseConfigured || !supabaseAdmin) {
        return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 503 });
    }
    if (process.env.VERCEL) {
        return new Response(JSON.stringify({ error: 'Sync is only available in local dev' }), { status: 400 });
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
        .from('cms_items')
        .select('id');
    if (existingError) {
        return new Response(JSON.stringify({ error: existingError.message }), { status: 500 });
    }
    const existing = new Set((existingRows || []).map(row => row.id));
    const now = new Date().toISOString();
    const toInsert: any[] = [];

    if (fs.existsSync(AUTO_CARDS)) {
        const auto = JSON.parse(fs.readFileSync(AUTO_CARDS, 'utf-8') || '[]');
        for (const card of auto) {
            if (!card?.id || existing.has(card.id)) continue;
            toInsert.push({
                id: card.id,
                title: card.title || '未命名',
                category: card.category || '其他',
                content: card.content || '',
                source: card.source || '',
                tags: Array.isArray(card.tags) ? card.tags : [],
                full_article: card.fullArticle || '',
                status: 'published',
                created_at: now,
                updated_at: now,
            });
            existing.add(card.id);
        }
    }

    if (fs.existsSync(SOURCES)) {
        const sources = JSON.parse(fs.readFileSync(SOURCES, 'utf-8') || '{}');
        const pending: string[] = sources.pending || [];
        for (const rel of pending) {
            const id = crypto.createHash('md5').update(`pending:${rel}`).digest('hex').slice(0, 12);
            if (existing.has(id)) continue;
            const filePath = path.join(KB_DIR, rel);
            if (!fs.existsSync(filePath)) continue;
            const text = fs.readFileSync(filePath, 'utf-8');
            const title = firstHeading(text) || path.basename(rel, path.extname(rel));
            const categoryKey = rel.split('/')[0];
            const category = CATEGORY_MAP[categoryKey] || '其他';
            toInsert.push({
                id,
                title,
                category,
                content: shortSummary(text),
                source: '',
                tags: [category],
                full_article: text.slice(0, 4000),
                status: 'pending',
                created_at: now,
                updated_at: now,
            });
            existing.add(id);
        }
    }

    if (!toInsert.length) {
        return new Response(JSON.stringify({ ok: true, inserted: 0 }), { status: 200 });
    }
    const { error } = await supabaseAdmin.from('cms_items').insert(toInsert);
    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, inserted: toInsert.length }), { status: 200 });
}
