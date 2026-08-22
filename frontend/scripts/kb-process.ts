import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(appRoot, '..');
const knowledgeRoot = path.join(repositoryRoot, '产品知识库');
const inbox = path.join(knowledgeRoot, '原始数据', '待处理');
const ocrRoot = path.join(knowledgeRoot, '原始数据', 'OCR文本');
const rawRoot = path.join(knowledgeRoot, '原始数据');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.heic', '.heif', '.tif', '.tiff', '.bmp']);

async function moveUnique(source: string, destinationDirectory: string) {
  await fs.mkdir(destinationDirectory, { recursive: true });
  const parsed = path.parse(source);
  let target = path.join(destinationDirectory, parsed.base);
  for (let suffix = 1; ; suffix += 1) {
    try { await fs.access(target); target = path.join(destinationDirectory, `${parsed.name}_${suffix}${parsed.ext}`); }
    catch { break; }
  }
  await fs.rename(source, target);
  return target;
}

async function ocrImage(file: string) {
  const output = path.join(ocrRoot, path.parse(file).name);
  await fs.mkdir(ocrRoot, { recursive: true });
  await execFileAsync('tesseract', [file, output, '-l', 'chi_sim+eng', '--psm', '6']);
}

async function ocrPdf(file: string) {
  const temporary = await fs.mkdtemp(path.join(process.env.TMPDIR || '/tmp', 'productthink-ocr-'));
  const output = path.join(ocrRoot, `${path.parse(file).name}-ocr.txt`);
  await fs.mkdir(ocrRoot, { recursive: true });
  try {
    const { stdout } = await execFileAsync('pdfinfo', [file]);
    const pages = Number(stdout.match(/Pages:\s+(\d+)/)?.[1] || 0);
    const chunks: string[] = [];
    for (let page = 1; page <= pages; page += 1) {
      const image = path.join(temporary, `page-${page}`);
      await execFileAsync('pdftoppm', ['-f', String(page), '-l', String(page), '-r', '200', '-png', '-singlefile', file, image]);
      const { stdout: text } = await execFileAsync('tesseract', [`${image}.png`, 'stdout', '-l', 'chi_sim+eng', '--psm', '6']);
      chunks.push(`${text}\n\n---- page ${page} ----`);
    }
    await fs.writeFile(output, `${chunks.join('\n\n')}\n`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

async function main() {
  const entries = await fs.readdir(process.argv[2] || inbox, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const source = path.join(process.argv[2] || inbox, entry.name);
    const extension = path.extname(entry.name).toLowerCase();
    try {
      if (imageExtensions.has(extension)) await ocrImage(source);
      if (extension === '.pdf') await ocrPdf(source);
    } catch (error) {
      console.warn(`OCR skipped for ${entry.name}:`, error instanceof Error ? error.message : 'Unknown error');
    }
    const destination = imageExtensions.has(extension) ? path.join(rawRoot, '图片')
      : extension === '.html' || extension === '.htm' || extension === '.url' ? path.join(rawRoot, '网页')
      : path.join(rawRoot, '文档');
    await moveUnique(source, destination);
  }
  console.log('Inbox processing complete. Run npm run knowledge:sync and npm run sparks:scan afterwards.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
