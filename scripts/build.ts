// 产物 dist/ 是纯静态文件：tsc 编译 web/*.ts，拷贝静态资源和抓取好的数据，
// 再从全部剧集派生首页用的 data/index.json。
import { execFileSync } from 'node:child_process';
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndex } from '../src/site-index.ts';
import { SOURCES } from '../src/sources.ts';
import type { Episode } from '../web/episode.ts';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const dataDir = join(dist, 'data');

await rm(dist, { recursive: true, force: true });
execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', join(root, 'tsconfig.web.json')], { stdio: 'inherit' });

for (const name of await readdir(join(root, 'web'))) {
  if (!name.endsWith('.ts')) await cp(join(root, 'web', name), join(dist, name));
}
if (existsSync(join(root, 'public'))) await cp(join(root, 'public'), dist, { recursive: true });

const episodes: Episode[] = [];
if (existsSync(dataDir)) {
  for (const entry of await readdir(dataDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (entry.name.endsWith('.json')) console.warn(`忽略 data/${entry.name}：剧集应放在 data/<节目>/ 下，重新 fetch 即可迁移`);
      continue;
    }
    for (const file of await readdir(join(dataDir, entry.name))) {
      if (file.endsWith('.json')) episodes.push(JSON.parse(await readFile(join(dataDir, entry.name, file), 'utf8')) as Episode);
    }
  }
}
const index = buildIndex(SOURCES, episodes);
await writeFile(join(dataDir, 'index.json'), JSON.stringify(index));

const summary = index.podcasts.map((p) => `${p.id} ${p.episodes.length} 集`).join('，') || '没有剧集，先 npm run fetch -- <节目> <剧集>';
console.log(`built → ${dist}（${summary}）`);
