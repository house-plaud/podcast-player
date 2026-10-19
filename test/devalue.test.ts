import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unflatten } from '../src/devalue.ts';

test('对象字段是指向扁平数组的下标', () => {
  assert.deepEqual(unflatten([{ a: 1, b: 2 }, 'x', 42]), { a: 'x', b: 42 });
});

test('数组元素同样是下标，重复引用复用同一个值', () => {
  const v = unflatten([[1, 1], { n: 2 }, 7]) as Array<{ n: number }>;
  assert.deepEqual(v, [{ n: 7 }, { n: 7 }]);
  assert.equal(v[0], v[1]);
});

test('负数下标表示特殊值', () => {
  assert.deepEqual(unflatten([{ u: -1, z: -6 }]), { u: undefined, z: -0 });
  assert.ok(Number.isNaN((unflatten([[-3]]) as number[])[0]));
});

test('首元素为字符串的数组是带类型的值', () => {
  const v = unflatten([{ d: 1 }, ['Date', '2026-09-16T11:00:00.000Z']]) as { d: Date };
  assert.ok(v.d instanceof Date);
  assert.equal(v.d.toISOString(), '2026-09-16T11:00:00.000Z');
});

test('未知类型直接报错，不静默返回错误数据', () => {
  assert.throws(() => unflatten([['Weird', 1]]), /Weird/);
});
