import fs from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const dir = new URL('../public/farukh-print/', import.meta.url);
const html = await fs.readFile(new URL('index.html', dir), 'utf8');
const sources = [];
for (const part of html.split('<script src="./').slice(1)) {
  const src = part.split('"')[0].split('?')[0];
  if (src.endsWith('.js')) sources.push(src.startsWith('legacy/') ? src.slice(7) : src);
}
for (const relative of sources) {
  const sourcePath = new URL(relative, dir);
  const outputPath = new URL('legacy/' + relative, dir);
  const code = await fs.readFile(sourcePath, 'utf8');
  const result = await transform(code, { target: 'safari12', format: 'iife', loader: 'js', legalComments: 'inline' });
  await fs.mkdir(path.dirname(outputPath.pathname), { recursive: true });
  await fs.writeFile(outputPath, result.code);
}
console.log('Built ' + sources.length + ' Safari 12-compatible FARUKH PRINT scripts');
