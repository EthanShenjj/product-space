import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function main() {
  const { syncNews } = await import('../src/server/product-news/service');
  const result = await syncNews({ force: process.argv.includes('--force') });
  console.log(JSON.stringify({ date: result.date, ok: result.ok, sources: result.editions.map(({ source, status, message, items }) => ({ source, status, message, count: items.length })) }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'News sync failed'); process.exitCode = 1; });
