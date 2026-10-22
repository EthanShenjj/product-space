import { NextResponse } from 'next/server';
import { readNewsFeed } from '@/server/product-news/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const feed = await readNewsFeed();
  return NextResponse.json(feed, { status: feed.error ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
}
