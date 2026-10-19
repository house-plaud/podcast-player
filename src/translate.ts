import type { Paragraph } from '../web/episode.ts';
import { hasTranslation } from '../web/timing.ts';

export interface BatchItem {
  i: number; // 段落下标，模型原样返回，用来对回段落
  speaker: string;
  en: string[];
}

export interface TranslatedItem {
  i: number;
  zh: string[];
}

// 连续的未翻译段落按句数打包；段落不拆开，保证模型看到的上下文是完整的一段
export function pendingBatches(paragraphs: Paragraph[], maxSentences: number): BatchItem[][] {
  const batches: BatchItem[][] = [];
  let current: BatchItem[] = [];
  let count = 0;
  paragraphs.forEach((p, i) => {
    if (hasTranslation(p) || p.sentences.length === 0) return;
    if (current.length && count + p.sentences.length > maxSentences) {
      batches.push(current);
      current = [];
      count = 0;
    }
    current.push({ i, speaker: p.speaker, en: p.sentences });
    count += p.sentences.length;
  });
  if (current.length) batches.push(current);
  return batches;
}

// 逐段校验后写回；不合格的段落保持未翻译，下一轮会被重新分批
export function applyTranslations(paragraphs: Paragraph[], items: TranslatedItem[]) {
  let applied = 0;
  let rejected = 0;
  for (const { i, zh } of items) {
    const p = paragraphs[i];
    const cleaned = zh.map((s) => s.trim());
    if (!p || cleaned.length !== p.sentences.length || cleaned.some((s) => !s)) {
      rejected++;
      continue;
    }
    p.zh = cleaned;
    applied++;
  }
  return { applied, rejected };
}

export const SYSTEM_PROMPT = `你是英文播客的字幕译者，读者是借播客学英语的中文听众。
输入是 JSON：节目名 podcast、本集标题 title 和若干段落，每段有下标 i、说话人 speaker 和英文句子数组 en。
把每个英文句子译成简体中文，规则：
1. 逐句对应：每段返回的 zh 数组与 en 数量相同、顺序相同，一句对一句，不合并、不拆分。
2. 转写稿常在句子中间切段：碎片就照碎片译，不补全，不加括号注释或任何说明。
3. 口语自然、忠实原意，让学习者能对照出原句结构；语气词照实译（Yeah → 对啊，Right? → 对吧？）。
4. 专业术语、产品名、人名保留英文（如 React、TypeScript、人名）。
5. 每段的 i 原样返回。`;

export const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    paragraphs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { i: { type: 'integer' }, zh: { type: 'array', items: { type: 'string' } } },
        required: ['i', 'zh'],
      },
    },
  },
  required: ['paragraphs'],
} as const;

// 按下标对齐新旧段落，原文逐句相同才沿用译文；返回沿用的段数
export function carryOverTranslations(old: Paragraph[], fresh: Paragraph[]): number {
  let carried = 0;
  fresh.forEach((p, i) => {
    const prev = old[i];
    if (prev && hasTranslation(prev) && prev.sentences.join('\n') === p.sentences.join('\n')) {
      p.zh = prev.zh;
      carried++;
    }
  });
  return carried;
}
