import type { Metadata } from 'next';
import { readNewsFeed } from '@/server/product-news/service';
import NewsBoard from './NewsBoard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '产品资讯 · ProductThink', description: '每天发现 X、Product Hunt 与 GitHub 上值得关注的软件和 AI 产品。' };

export default async function NewsPage() {
  return <NewsBoard initialFeed={await readNewsFeed()} />;
}
