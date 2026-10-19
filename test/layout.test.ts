import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePopover } from '../web/layout.ts';

const viewport = { width: 390, height: 844, bottomInset: 200 };
const size = { width: 200, height: 60 };

test('默认放在句子下方，左对齐句子', () => {
  assert.deepEqual(placePopover({ left: 40, top: 100, bottom: 130 }, size, viewport), { left: 40, top: 136 });
});

test('下方会被播放条挡住时改放上方', () => {
  // 句子底部 600 + 6 + 60 > 844 - 200
  assert.deepEqual(placePopover({ left: 40, top: 570, bottom: 600 }, size, viewport), { left: 40, top: 504 });
});

test('水平方向夹在左右边距内', () => {
  assert.equal(placePopover({ left: 300, top: 100, bottom: 130 }, size, viewport).left, 390 - 16 - 200);
  assert.equal(placePopover({ left: 2, top: 100, bottom: 130 }, size, viewport).left, 16);
});
