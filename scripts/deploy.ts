// 用法：npm run deploy
// 本地构建后把 dist/ 强推到 origin 的 gh-pages 分支（GitHub Pages 从该分支发布）。
// 译文依赖本机 claude 登录，CI 里生成不了，所以部署产物在本地构建。
import { execFileSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SiteIndex } from '../web/episode.ts';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const run = (cmd: string, args: string[], cwd = root) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

const remote = run('git', ['remote', 'get-url', 'origin']);
run('node', [join(root, 'scripts', 'build.ts')]);
const index = JSON.parse(await readFile(join(dist, 'data', 'index.json'), 'utf8')) as SiteIndex;
if (index.podcasts.length === 0) {
  console.error('没有任何剧集，先 npm run fetch -- <节目> <剧集>');
  process.exit(1);
}

// 不需要 Jekyll 处理，直接按原样发布
await writeFile(join(dist, '.nojekyll'), '');

// dist/ 每次构建都会重建，在里面临时建仓库做一次性提交即可，gh-pages 不保留历史
await rm(join(dist, '.git'), { recursive: true, force: true });
run('git', ['init', '-q', '-b', 'gh-pages'], dist);
run('git', ['add', '-A'], dist);
run('git', ['-c', 'user.name=deploy', '-c', 'user.email=deploy@localhost', 'commit', '-q', '-m', `deploy ${new Date().toISOString()}`], dist);
run('git', ['push', '-q', '--force', remote, 'gh-pages'], dist);
await rm(join(dist, '.git'), { recursive: true, force: true });

console.log('已推送 gh-pages，GitHub Pages 通常 1 分钟内生效');
