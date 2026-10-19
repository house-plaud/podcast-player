// 产物 dist/ 是纯静态文件：tsc 编译 web/*.ts，再拷贝静态资源和抓取好的数据。
import { execFileSync } from 'node:child_process';
import { cp, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', join(root, 'tsconfig.web.json')], { stdio: 'inherit' });

for (const name of await readdir(join(root, 'web'))) {
  if (!name.endsWith('.ts')) await cp(join(root, 'web', name), join(dist, name));
}
if (existsSync(join(root, 'public'))) await cp(join(root, 'public'), dist, { recursive: true });
else console.warn('public/ 不存在：还没抓取任何节目，先运行 npm run fetch -- <期号>');

console.log(`built → ${dist}`);
