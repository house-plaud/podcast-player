import { unflatten } from './devalue.ts';
import type { Episode, Paragraph } from '../web/episode.ts';
import { splitSentences } from '../web/timing.ts';
import type { Source } from './source.ts';

const PODCAST = { id: 'syntax', title: 'Syntax' };

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
    podcast: PODCAST,
    id: String(show.number),
    number: show.number,
    title: show.title,
    date: show.date.toISOString().slice(0, 10),
    audioUrl: show.url,
    sourceUrl: transcriptPageUrl(show.number),
    paragraphs,
  };
}

export const syntax: Source = {
  ...PODCAST,
  description: 'Wes Bos 和 Scott Tolinski 聊 Web 开发的技术播客',
  homepage: 'https://syntax.fm',
  async fetchEpisode(ref) {
    const number = Number(ref);
    if (!Number.isInteger(number) || number <= 0) throw new Error(`Syntax 的剧集引用应为正整数期号，收到 ${ref}`);
    const url = transcriptDataUrl(number);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    const episode = extractEpisode(await res.json());
    if (episode.number !== number) throw new Error(`请求第 ${number} 期，返回的是第 ${episode.number} 期`);
    return episode;
  },
};
