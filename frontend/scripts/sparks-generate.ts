import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appRoot, '..');
const kbRoot = path.join(root, '产品知识库');
const configPath = path.join(appRoot, 'data', 'sparks_sources.json');
const outputPath = path.join(appRoot, 'src', 'data', 'cards.auto.json');
const categoryMap: Record<string, string> = {
  '01-产品与设计': '产品与设计', '02-商业与战略': '商业与战略', '03-思维与认知': '思维与认知', '04-成长与效能': '成长与效能', '05-技术与AI': '技术与AI',
};

function textSummary(text: string) {
  return text.split(/\r?\n/).map((line) => line.replace(/^#{1,6}\s+|^[-*•]\s+/, '').trim())
    .find((line) => line && !line.startsWith('来源'))?.slice(0, 140) || '暂无明确结论';
}

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as { approved?: string[] };
  const cards = [] as Array<Record<string, unknown>>;
  for (const relativePath of config.approved || []) {
    const sourcePath = path.join(kbRoot, relativePath);
    const text = await fs.readFile(sourcePath, 'utf8').catch(() => '');
    if (!text) continue;
    const title = text.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim() || path.basename(relativePath, path.extname(relativePath));
    cards.push({
      id: crypto.createHash('md5').update(relativePath).digest('hex').slice(0, 12),
      title: title.slice(0, 30), category: categoryMap[relativePath.split('/')[0]] || '其他',
      content: textSummary(text), author: '内部整理', source: '', tags: [categoryMap[relativePath.split('/')[0]] || '其他'],
      fullArticle: text.slice(0, 4000), updatedAt: new Date().toISOString(),
    });
  }
  await fs.writeFile(outputPath, `${JSON.stringify(cards, null, 2)}\n`);
  console.log(`Generated ${cards.length} Sparks cards.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
