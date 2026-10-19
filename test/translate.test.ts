import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingBatches, applyTranslations, carryOverTranslations } from '../src/translate.ts';
import type { Paragraph } from '../web/episode.ts';

const para = (sentences: string[], zh?: string[]): Paragraph => ({ start: 0, end: 1, speaker: 'Wes Bos', sentences, ...(zh && { zh }) });

test('只把缺译文的段落分批，每批句数不超过上限', () => {
  const ps = [para(['a', 'b']), para(['c'], ['丙']), para(['d', 'e', 'f']), para(['g'])];
  const batches = pendingBatches(ps, 4);
  assert.deepEqual(
    batches.map((b) => b.map((x) => x.i)),
    [[0], [2, 3]],
  );
  assert.deepEqual(batches[0]![0], { i: 0, speaker: 'Wes Bos', en: ['a', 'b'] });
});

test('译文句数与原文不符的段落视为未翻译，会被重新分批', () => {
  const ps = [para(['a', 'b'], ['甲'])];
  assert.deepEqual(pendingBatches(ps, 10).flat().map((x) => x.i), [0]);
});

test('单段超过上限时独占一批，不切开段落', () => {
  const ps = [para(['a', 'b', 'c']), para(['d'])];
  assert.deepEqual(pendingBatches(ps, 2).map((b) => b.map((x) => x.i)), [[0], [1]]);
});

test('合格的译文写回段落，句数不符或下标越界的拒收', () => {
  const ps = [para(['a', 'b']), para(['c']), para(['d'])];
  const res = applyTranslations(ps, [
    { i: 0, zh: ['甲', '乙'] },
    { i: 1, zh: ['丙', '多出来的'] },
    { i: 9, zh: ['越界'] },
  ]);
  assert.deepEqual(ps[0]!.zh, ['甲', '乙']);
  assert.equal(ps[1]!.zh, undefined);
  assert.deepEqual(res, { applied: 1, rejected: 2 });
});

test('译文去掉首尾空白，空串视为不合格', () => {
  const ps = [para(['a']), para(['b'])];
  const res = applyTranslations(ps, [
    { i: 0, zh: ['  甲 '] },
    { i: 1, zh: ['   '] },
  ]);
  assert.deepEqual(ps[0]!.zh, ['甲']);
  assert.equal(ps[1]!.zh, undefined);
  assert.equal(res.rejected, 1);
});

test('重新抓取时沿用原文未变段落的译文，原文变了的丢弃', () => {
  const old = [para(['a', 'b'], ['甲', '乙']), para(['c'], ['丙']), para(['d'], ['丁'])];
  const fresh = [para(['a', 'b']), para(['c changed']), para(['d'])];
  assert.equal(carryOverTranslations(old, fresh), 2);
  assert.deepEqual(fresh.map((p) => p.zh), [['甲', '乙'], undefined, ['丁']]);
});
