import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appRoot, '..');
const kbRoot = path.join(root, '产品知识库');
const configPath = path.join(appRoot, 'data', 'sparks_sources.json');
const directories = ['01-产品与设计', '02-商业与战略', '03-思维与认知', '04-成长与效能', '05-技术与AI'];

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return ['.md', '.txt'].includes(path.extname(entry.name)) ? [target] : [];
  }))).flat();
}

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as { approved?: string[]; pending?: string[] };
  const found = (await Promise.all(directories.map((directory) => walk(path.join(kbRoot, directory))))).flat()
    .map((file) => path.relative(kbRoot, file));
  const approved = new Set(config.approved || []);
  config.pending = [...new Set([...(config.pending || []), ...found.filter((file) => !approved.has(file))])].sort();
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Updated pending Sparks sources: ${config.pending.length}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
