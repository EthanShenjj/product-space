import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeContext } from '@/server/agents/knowledge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) return NextResponse.json({ context: '', sources: [] });
    const { context, results } = await getKnowledgeContext(query, typeof body.k === 'number' ? body.k : 5);
    return NextResponse.json({ context, sources: results.map((result) => result.source) });
  } catch (error) {
    console.error('[Knowledge] failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ context: '', sources: [] });
  }
}
