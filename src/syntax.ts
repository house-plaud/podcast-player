import { unflatten } from './devalue.ts';
import type { Episode, Paragraph } from '../web/episode.ts';
import { splitSentences } from '../web/timing.ts';

// syntax.fm 只按期号路由，slug 段任意填都返回同一期
export function transcriptDataUrl(number: number): string {
  return `https://syntax.fm/show/${number}/_/transcript/__data.json`;
}

export function transcriptPageUrl(number: number): string {
  return `https://syntax.fm/show/${number}/_/transcript`;
}

interface RawShow {
  number: number;
  title: string;
  date: Date;
  url: string;
}

interface RawUtterance {
  start: number;
  end: number;
  transcript_value: string;
  speakerName?: string;
}

interface RawTranscript {
  show_number: number;
  utterances: RawUtterance[];
}

export function extractEpisode(payload: unknown): Episode {
  const nodes = (payload as { nodes?: unknown[] }).nodes;
  if (!Array.isArray(nodes)) throw new Error('__data.json 缺少 nodes');

  let show: RawShow | undefined;
  let transcript: RawTranscript | undefined;
  for (const node of nodes) {
    const data = (node as { type?: string; data?: unknown[] } | null)?.data;
    if (!Array.isArray(data)) continue;
    const value = unflatten(data) as Record<string, unknown>;
    if (value.show) show = value.show as RawShow;
    if (value.transcript) transcript = value.transcript as RawTranscript;
  }

  if (!show) throw new Error('__data.json 中找不到 show 节点');
  if (!transcript) throw new Error(`第 ${show.number} 期没有 transcript 节点`);
  if (transcript.show_number !== show.number) {
    throw new Error(`transcript 期号 ${transcript.show_number} 与 show 期号 ${show.number} 不一致`);
  }

  const paragraphs: Paragraph[] = transcript.utterances.map((u) => ({
    start: u.start,
    end: u.end,
    speaker: u.speakerName ?? '',
    sentences: splitSentences(u.transcript_value),
  }));

  return {
    number: show.number,
    title: show.title,
    date: show.date.toISOString().slice(0, 10),
    audioUrl: show.url,
    sourceUrl: transcriptPageUrl(show.number),
    paragraphs,
  };
}
