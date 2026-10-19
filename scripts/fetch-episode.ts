// 用法：npm run fetch -- 1039 [1040 ...]
// 抓取指定期数的 transcript + mp3 链接，写入 public/data/<期号>.json，并更新 index.json。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractEpisode, transcriptDataUrl } from '../src/syntax.ts';
import { carryOverTranslations } from '../src/translate.ts';
import type { Episode, EpisodeIndexEntry } from '../web/episode.ts';

const DATA_DIR = join(import.meta.dirname, '..', 'public', 'data');

async function fetchEpisode(number: number) {
  const url = transcriptDataUrl(number);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const episode = extractEpisode(await res.json());
  if (episode.number !== number) throw new Error(`请求第 ${number} 期，返回的是第 ${episode.number} 期`);
  if (episode.paragraphs.length === 0) throw new Error(`第 ${number} 期 transcript 为空`);
  return episode;
}

async function readJson<T>(name: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, name), 'utf8')) as T;
  } catch {
    return undefined;
  }
}

async function readIndex(): Promise<EpisodeIndexEntry[]> {
  return (await readJson<EpisodeIndexEntry[]>('index.json')) ?? [];
}

const numbers = process.argv.slice(2).map(Number);
if (numbers.length === 0 || numbers.some((n) => !Number.isInteger(n) || n <= 0)) {
  console.error('用法：npm run fetch -- <期号> [期号...]');
  process.exit(1);
}

await mkdir(DATA_DIR, { recursive: true });
const index = await readIndex();
let failed = 0;

// 逐期写盘：某一期失败不影响已抓到的其他期
for (const number of numbers) {
  try {
    const ep = await fetchEpisode(number);
    // 重抓不丢已有译文：原文没变的段落沿用旧译
    const old = await readJson<Episode>(`${number}.json`);
    const carried = old ? carryOverTranslations(old.paragraphs, ep.paragraphs) : 0;
    await writeFile(join(DATA_DIR, `${number}.json`), JSON.stringify(ep));
    const entry = { number: ep.number, title: ep.title, date: ep.date };
    const i = index.findIndex((e) => e.number === number);
    if (i >= 0) index[i] = entry;
    else index.push(entry);
    const last = ep.paragraphs.at(-1)!;
    console.log(`✓ #${number} ${ep.title} — ${ep.paragraphs.length} 段，至 ${Math.round(last.end)}s，音频 ${ep.audioUrl}${carried ? `，沿用译文 ${carried} 段` : ''}`);
  } catch (err) {
    failed++;
    console.error(`✗ #${number}: ${(err as Error).message}`);
  }
}

index.sort((a, b) => b.number - a.number);
await writeFile(join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2));
if (failed) process.exit(1);
