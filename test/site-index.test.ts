import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, summarizeEpisode } from '../src/site-index.ts';
import type { Episode } from '../web/episode.ts';

const ep = (id: string, date: string, zh: boolean, podcast = 'syntax'): Episode => ({
  podcast: { id: podcast, title: podcast === 'syntax' ? 'Syntax' : podcast },
  id,
  number: Number(id),
  title: `Episode ${id}`,
  date,
  audioUrl: `https://example.com/${id}.mp3`,
  sourceUrl: `https://example.com/${id}`,
  paragraphs: [
    { start: 0, end: 10, speaker: 'A', sentences: ['One.', 'Two.'], ...(zh && { zh: ['一。', '二。'] }) },
    { start: 12, end: 3650.4, speaker: 'B', sentences: ['Three.'], ...(zh && { zh: ['三。'] }) },
  ],
});

test('剧集摘要：时长取最后一段的结束时间，全部段落有译文才算已翻译', () => {
  assert.deepEqual(summarizeEpisode(ep('1039', '2026-09-16', true)), {
    id: '1039',
    number: 1039,
    title: 'Episode 1039',
    date: '2026-09-16',
    duration: 3650,
    translated: true,
  });
  const partial = ep('1040', '2026-09-18', true);
  delete partial.paragraphs[1]!.zh;
  assert.equal(summarizeEpisode(partial).translated, false);
});

const meta = [
  { id: 'syntax', title: 'Syntax', description: 'Web dev', homepage: 'https://syntax.fm' },
  { id: 'other', title: 'Other', description: '', homepage: '' },
];

test('按节目分组，组内按日期倒序；没有剧集的节目不出现', () => {
  const index = buildIndex(meta, [ep('1039', '2026-09-16', true), ep('1047', '2026-10-14', false)]);
  assert.deepEqual(index.podcasts.map((p) => p.id), ['syntax']);
  assert.deepEqual(index.podcasts[0]!.episodes.map((e) => e.id), ['1047', '1039']);
  assert.equal(index.podcasts[0]!.title, 'Syntax');
});

test('节目顺序跟随数据源注册顺序', () => {
  const index = buildIndex(meta, [ep('x1', '2026-10-01', false, 'other'), ep('1039', '2026-09-16', true)]);
  assert.deepEqual(index.podcasts.map((p) => p.id), ['syntax', 'other']);
});

test('未注册的节目不丢弃：用剧集自带的节目名兜底，排在已注册节目之后', () => {
  const index = buildIndex(meta.slice(0, 1), [ep('x1', '2026-10-01', false, 'mystery'), ep('1039', '2026-09-16', true)]);
  assert.deepEqual(index.podcasts.map((p) => [p.id, p.title]), [['syntax', 'Syntax'], ['mystery', 'mystery']]);
});
