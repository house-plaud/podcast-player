// 用法：npm run translate -- <节目> <剧集...> [--model haiku] [--concurrency 4]
// 读 public/data/<节目>/<剧集>.json，用本机 claude CLI 逐句补上中文译文。
// 每批完成即写盘，中断后重跑只翻译还缺的段落。
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runClaude } from '../src/claude.ts';
import { applyTranslations, pendingBatches, RESULT_SCHEMA, SYSTEM_PROMPT, type BatchItem, type TranslatedItem } from '../src/translate.ts';
import { hasTranslation } from '../web/timing.ts';
import type { Episode } from '../web/episode.ts';

const DATA_DIR = join(import.meta.dirname, '..', 'public', 'data');
// 第一轮大批省调用次数；不合格的段落第二轮用小批重试，降低模型数错句数的概率
const PASSES = [60, 12];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', default: 'haiku' },
    concurrency: { type: 'string', default: '4' },
  },
});
const [podcast, ...ids] = positionals;
if (!podcast || ids.length === 0) {
  console.error('用法：npm run translate -- <节目> <剧集...> [--model haiku] [--concurrency 4]');
  process.exit(1);
}
const concurrency = Math.max(1, Number(values.concurrency));

async function translateEpisode(id: string): Promise<number> {
  const file = join(DATA_DIR, podcast!, `${id}.json`);
  const label = `${podcast}/${id}`;
  const ep = JSON.parse(await readFile(file, 'utf8')) as Episode;

  // 并发批次共用一个文件，写盘串行化
  let saving = Promise.resolve();
  const save = () => (saving = saving.then(() => writeFile(file, JSON.stringify(ep))));

  const translateBatch = async (batch: BatchItem[]) => {
    const input = JSON.stringify({ podcast: ep.podcast.title, title: ep.title, paragraphs: batch });
    const out = (await runClaude(input, { model: values.model!, systemPrompt: SYSTEM_PROMPT, schema: RESULT_SCHEMA })) as {
      paragraphs: TranslatedItem[];
    };
    // 只接受本批请求过的下标，防止模型返回别处的 i 覆盖已有译文
    const asked = new Set(batch.map((b) => b.i));
    return applyTranslations(ep.paragraphs, out.paragraphs.filter((p) => asked.has(p.i)));
  };

  for (const size of PASSES) {
    const queue = pendingBatches(ep.paragraphs, size);
    if (queue.length === 0) break;
    console.log(`${label}：${queue.length} 批（每批 ≤${size} 句，并发 ${concurrency}，模型 ${values.model}）`);
    let done = 0;
    const worker = async () => {
      for (let batch = queue.shift(); batch; batch = queue.shift()) {
        try {
          const { applied, rejected } = await translateBatch(batch);
          await save();
          console.log(`  [${++done}] 段 ${batch[0]!.i}–${batch.at(-1)!.i}：通过 ${applied}，拒收 ${rejected}`);
        } catch (err) {
          console.error(`  [${++done}] 段 ${batch[0]!.i}–${batch.at(-1)!.i} 失败：${(err as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    await saving;
  }

  const missing = ep.paragraphs.filter((p) => p.sentences.length && !hasTranslation(p)).length;
  console.log(missing ? `✗ ${label}：仍有 ${missing} 段缺译文，重跑同一命令可续翻` : `✓ ${label}：全部 ${ep.paragraphs.length} 段已翻译`);
  return missing;
}

let failed = 0;
for (const id of ids) {
  try {
    if (await translateEpisode(id)) failed++;
  } catch (err) {
    failed++;
    console.error(`✗ ${podcast}/${id}：${(err as Error).message}`);
  }
}
if (failed) process.exit(1);
