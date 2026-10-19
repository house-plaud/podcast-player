import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, buildSentences, findActive, formatTime } from '../web/timing.ts';

test('按句切分并去掉首尾空白', () => {
  assert.deepEqual(splitSentences('Welcome to Syntax. We got a potluck! Ready?'), [
    'Welcome to Syntax.',
    'We got a potluck!',
    'Ready?',
  ]);
});

test('段落以半句结尾也保留为一句', () => {
  assert.deepEqual(splitSentences('How do we'), ['How do we']);
});

test('段内时间按字符数比例分配，首尾贴合段落边界', () => {
  // 10 字符 + 30 字符，段长 8s → 2s / 6s
  const s = buildSentences([{ start: 10, end: 18, speaker: 'A', sentences: ['Aaaaaaaaa.', 'Bbbbbbbbbbbbbbbbbbbbbbbbbbbbb.'] }]);
  assert.equal(s.length, 2);
  assert.equal(s[0]!.start, 10);
  assert.ok(Math.abs(s[0]!.end - 12) < 1e-9);
  assert.equal(s[1]!.start, s[0]!.end);
  assert.equal(s[1]!.end, 18);
  assert.deepEqual(s.map((x) => x.paragraph), [0, 0]);
});

test('多段落的句子平铺且保持时间有序', () => {
  const s = buildSentences([
    { start: 0, end: 4, speaker: 'A', sentences: ['One.', 'Two.'] },
    { start: 5, end: 6, speaker: 'B', sentences: ['Three.'] },
  ]);
  assert.deepEqual(s.map((x) => [x.text, x.paragraph]), [['One.', 0], ['Two.', 0], ['Three.', 1]]);
});

test('空段落不产生句子', () => {
  assert.deepEqual(buildSentences([{ start: 0, end: 1, speaker: 'A', sentences: [] }]), []);
});

test('译文与句子数一致时逐句挂上中文', () => {
  const s = buildSentences([{ start: 0, end: 2, speaker: 'A', sentences: ['One.', 'Two.'], zh: ['一。', '二。'] }]);
  assert.deepEqual(s.map((x) => x.zh), ['一。', '二。']);
});

test('译文数量对不上时整段不挂，宁缺勿错位', () => {
  const s = buildSentences([{ start: 0, end: 2, speaker: 'A', sentences: ['One.', 'Two.'], zh: ['一二。'] }]);
  assert.deepEqual(s.map((x) => x.zh), [undefined, undefined]);
});

const sentences = buildSentences([
  { start: 1, end: 3, speaker: 'A', sentences: ['Aa.', 'Bb.'] },
  { start: 5, end: 7, speaker: 'B', sentences: ['Cc.'] },
]);

test('开播前没有当前句', () => {
  assert.equal(findActive(sentences, 0.5), -1);
});

test('落在句子区间内即为当前句', () => {
  assert.equal(findActive(sentences, 1), 0);
  assert.equal(findActive(sentences, 2.5), 1);
  assert.equal(findActive(sentences, 6.9), 2);
});

test('段间静音保持上一句高亮，像字幕一样不闪烁', () => {
  assert.equal(findActive(sentences, 4), 1);
});

test('超过最后一句仍停在最后一句', () => {
  assert.equal(findActive(sentences, 100), 2);
});

test('时间格式化：不足一小时 m:ss，超过一小时 h:mm:ss', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(619.9), '10:19');
  assert.equal(formatTime(3650.5), '1:00:50');
  assert.equal(formatTime(Number.NaN), '0:00');
});
