import fs from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const dir = new URL('../public/farukh-print/', import.meta.url);
const html = await fs.readFile(new URL('index.html', dir), 'utf8');
const sources = [...html.matchAll(/<script\s+src="\.\/([^"?]+\.js)(?:\?[^"]*)?"\s+defer><\/script>/g)].map(m => m[1].replace(/^legacy\\//, ''));
for (const relative of sources) {
  const sourcePath = new URL(relative, dir);
  const outputPath = new URL('legacy/' + relative, dir);
  const code = await fs.readFile(sourcePath, 'utf8');
  const result = await transform(code, { target: 'safari12', format: 'iife', loader: 'js', legalComments: 'inline' });
  await fs.mkdir(path.dirname(outputPath.pathname), { recursive: true });
  await fs.writeFile(outputPath, result.code);
}
console.log('Built ' + sources.length + ' Safari 12-compatible FARUKH PRINT scripts');
