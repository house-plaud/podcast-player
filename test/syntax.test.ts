import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractEpisode, transcriptDataUrl } from '../src/syntax.ts';

// 结构照抄 2026-10-19 实测的 /show/1039/.../transcript/__data.json：
// nodes = [layout 根, 站点 layout, show 页, transcript 页]
const payload = {
  type: 'data',
  nodes: [
    null,
    { type: 'data', data: [{ latest: 1 }, []] },
    {
      type: 'data',
      data: [
        { show: 1, time_start: 7 },
        { number: 2, title: 3, date: 4, url: 5, slug: 6 },
        1039,
        'Should You Quit Your Job?',
        ['Date', '2026-09-16T11:00:00.000Z'],
        'https://traffic.megaphone.fm/FSI7656097330.mp3',
        'should-you-quit-your-job',
        -1,
      ],
    },
    {
      type: 'data',
      data: [
        { transcript: 1 },
        { show_number: 2, utterances: 3 },
        1039,
        [4, 9],
        { start: 5, end: 6, transcript_value: 7, speakerName: 8 },
        0.08,
        12.66,
        'Welcome to Syntax. We got a potluck episode.',
        'Wes Bos',
        { start: 10, end: 11, transcript_value: 12, speakerName: 13 },
        13.2,
        20,
        'Yeah!',
        'Scott Tolinski',
      ],
    },
  ],
};

test('从 __data.json 提取节目元数据，段落在抓取时切好句', () => {
  const ep = extractEpisode(payload);
  assert.equal(ep.number, 1039);
  assert.equal(ep.title, 'Should You Quit Your Job?');
  assert.equal(ep.date, '2026-09-16');
  assert.equal(ep.audioUrl, 'https://traffic.megaphone.fm/FSI7656097330.mp3');
  assert.deepEqual(ep.paragraphs, [
    { start: 0.08, end: 12.66, speaker: 'Wes Bos', sentences: ['Welcome to Syntax.', 'We got a potluck episode.'] },
    { start: 13.2, end: 20, speaker: 'Scott Tolinski', sentences: ['Yeah!'] },
  ]);
});

test('页面缺 transcript 时明确报错', () => {
  const noTranscript = { ...payload, nodes: payload.nodes.slice(0, 3) };
  assert.throws(() => extractEpisode(noTranscript), /transcript/);
});

test('transcript 期号与 show 不一致时报错，防止拼错数据', () => {
  const bad = structuredClone(payload);
  (bad.nodes[3]!.data as unknown[])[2] = 1040;
  assert.throws(() => extractEpisode(bad), /1040/);
});

test('数据 URL 只依赖期号，slug 位置用占位符', () => {
  assert.equal(transcriptDataUrl(1039), 'https://syntax.fm/show/1039/_/transcript/__data.json');
});
