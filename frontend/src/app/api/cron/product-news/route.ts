import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { syncNews } from '@/server/product-news/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncNews();
    // Partial failures stay visible to the scheduler as failures and can be retried safely.
    return NextResponse.json({ ok: result.ok, date: result.date, updated: result.updated, sources: result.editions.map(({ source, status, message }) => ({ source, status, message })) },
      { status: result.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[product-news] sync failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: '资讯更新失败，请检查存储配置' }, { status: 503 });
  }
}
