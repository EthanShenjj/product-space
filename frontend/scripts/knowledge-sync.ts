import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(appRoot, '..');
const manifestPath = path.join(appRoot, '.knowledge-manifest.json');
const roots = [
  path.join(appRoot, 'knowledge'),
  ...['01-产品与设计', '02-商业与战略', '03-思维与认知', '04-成长与效能', '05-技术与AI']
    .map((directory) => path.join(repositoryRoot, '产品知识库', directory)),
];
const allowed = new Set(['.md', '.txt', '.pdf']);

async function collect(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return collect(target);
      return allowed.has(path.extname(entry.name).toLowerCase()) ? [target] : [];
    }));
    return nested.flat();
  } catch {
    return [];
  }
}

async function readManifest() {
  try { return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, { hash: string; fileId: string }>; }
  catch { return {}; }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');
  const client = new OpenAI({ apiKey });
  let vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vectorStoreId) {
    const store = await client.vectorStores.create({ name: 'ProductThink 精华知识库' });
    vectorStoreId = store.id;
    console.log(`Created Vector Store: ${vectorStoreId}`);
    console.log(`Set OPENAI_VECTOR_STORE_ID=${vectorStoreId} before deploying.`);
  }
  const manifest = await readManifest();
  const files = (await Promise.all(roots.map(collect))).flat();
  let uploaded = 0;
  for (const file of files) {
    const bytes = await fs.readFile(file);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const relativePath = path.relative(repositoryRoot, file);
    if (manifest[relativePath]?.hash === hash) continue;
    if (manifest[relativePath]?.fileId) {
      await client.files.delete(manifest[relativePath].fileId).catch(() => undefined);
    }
    const attached = await client.vectorStores.files.uploadAndPoll(vectorStoreId, new File([bytes], path.basename(file)));
    if (attached.status !== 'completed') throw new Error(`Failed to index ${relativePath}: ${attached.last_error?.message || attached.status}`);
    manifest[relativePath] = { hash, fileId: attached.id };
    uploaded += 1;
    console.log(`Indexed ${relativePath}`);
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Knowledge sync complete: ${uploaded} updated, ${files.length} files scanned.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
