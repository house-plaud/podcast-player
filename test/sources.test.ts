import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSource, SOURCES } from '../src/sources.ts';

test('按 id 取数据源，Syntax 已注册', () => {
  assert.equal(getSource('syntax').id, 'syntax');
  assert.ok(SOURCES.every((s) => /^[a-z0-9-]+$/.test(s.id)), 'id 会用作目录名和 URL 参数');
});

test('未知数据源报错并列出可用的', () => {
  assert.throws(() => getSource('nope'), /syntax/);
});

test('Syntax 的剧集引用必须是正整数期号，非法时不发请求直接报错', async () => {
  await assert.rejects(getSource('syntax').fetchEpisode('abc'), /期号/);
  await assert.rejects(getSource('syntax').fetchEpisode('0'), /期号/);
});
