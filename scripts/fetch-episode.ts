// 用法：npm run fetch -- <节目> <剧集...>，例如 npm run fetch -- syntax 1039 1040
// 抓取 transcript + 音频链接，写入 public/data/<节目>/<剧集>.json。首页列表在构建时派生。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSource } from '../src/sources.ts';
import { carryOverTranslations } from '../src/translate.ts';
import type { Episode } from '../web/episode.ts';

const [sourceId, ...refs] = process.argv.slice(2);
if (!sourceId || refs.length === 0) {
  console.error('用法：npm run fetch -- <节目> <剧集...>，例如 npm run fetch -- syntax 1039');
  process.exit(1);
}
const source = getSource(sourceId);
const dir = join(import.meta.dirname, '..', 'public', 'data', source.id);
await mkdir(dir, { recursive: true });

async function readEpisode(file: string): Promise<Episode | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Episode;
  } catch {
    return undefined;
  }
}

let failed = 0;
// 逐集写盘：某一集失败不影响已抓到的其他集
for (const ref of refs) {
  try {
    const ep = await source.fetchEpisode(ref);
    if (ep.paragraphs.length === 0) throw new Error('transcript 为空');
    const file = join(dir, `${ep.id}.json`);
    // 重抓不丢已有译文：原文没变的段落沿用旧译
    const old = await readEpisode(file);
    const carried = old ? carryOverTranslations(old.paragraphs, ep.paragraphs) : 0;
    await writeFile(file, JSON.stringify(ep));
    const last = ep.paragraphs.at(-1)!;
    console.log(`✓ ${source.id}/${ep.id} ${ep.title} — ${ep.paragraphs.length} 段，至 ${Math.round(last.end)}s${carried ? `，沿用译文 ${carried} 段` : ''}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${source.id}/${ref}: ${(err as Error).message}`);
  }
}
if (failed) process.exit(1);
