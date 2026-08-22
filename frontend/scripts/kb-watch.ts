import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(appRoot, '..');
const knowledgeRoot = path.join(repositoryRoot, '产品知识库');
const watched = [path.join(knowledgeRoot, '原始数据', '待处理'), ...['01-产品与设计', '02-商业与战略', '03-思维与认知', '04-成长与效能', '05-技术与AI'].map((name) => path.join(knowledgeRoot, name))];
let timer: NodeJS.Timeout | undefined;

function run(script: string) {
  const child = spawn('npx', ['tsx', script], { cwd: appRoot, stdio: 'inherit' });
  child.on('error', (error) => console.error(error));
}

function schedule(directory: string) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const isInbox = directory.includes('待处理');
    run(isInbox ? 'scripts/kb-process.ts' : 'scripts/sparks-scan.ts');
  }, 750);
}

for (const directory of watched) {
  fs.mkdirSync(directory, { recursive: true });
  fs.watch(directory, { recursive: true }, () => schedule(directory));
}
console.log(`Watching ${watched.length} knowledge directories. Press Ctrl+C to stop.`);
