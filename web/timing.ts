import type { Paragraph } from './episode.ts';

export interface Sentence {
  start: number;
  end: number;
  text: string;
  paragraph: number; // 所属段落下标
  zh?: string;
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const { segment } of segmenter.segment(text)) {
    const s = segment.trim();
    if (s) out.push(s);
  }
  return out;
}

export function hasTranslation(p: Paragraph): p is Paragraph & { zh: string[] } {
  return p.zh?.length === p.sentences.length;
}

// 源数据只有段落级时间戳：段内按字符数比例估算每句的起止
export function buildSentences(paragraphs: Paragraph[]): Sentence[] {
  const out: Sentence[] = [];
  paragraphs.forEach((p, paragraph) => {
    const parts = p.sentences;
    const zh = hasTranslation(p) ? p.zh : undefined;
    const total = parts.reduce((n, s) => n + s.length, 0);
    const duration = p.end - p.start;
    let consumed = 0;
    parts.forEach((text, i) => {
      const start = p.start + (duration * consumed) / total;
      consumed += text.length;
      // 最后一句直接取段落终点，避免浮点累加误差
      const end = i === parts.length - 1 ? p.end : p.start + (duration * consumed) / total;
      out.push({ start, end, text, paragraph, zh: zh?.[i] });
    });
  });
  return out;
}

// 最后一个 start <= t 的句子；段间静音时停留在上一句
export function findActive(sentences: Sentence[], t: number): number {
  let lo = 0;
  let hi = sentences.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sentences[mid]!.start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
