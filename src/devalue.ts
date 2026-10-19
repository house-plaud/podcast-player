// SvelteKit 的 __data.json 用 devalue 序列化：所有值平铺进一个数组，
// 对象字段 / 数组元素存的是下标，负数下标是特殊值。

const SPECIAL: Record<number, unknown> = {
  [-1]: undefined,
  [-2]: undefined, // 稀疏数组的空位
  [-3]: Number.NaN,
  [-4]: Number.POSITIVE_INFINITY,
  [-5]: Number.NEGATIVE_INFINITY,
  [-6]: -0,
};

export function unflatten(values: unknown[]): unknown {
  const cache = new Map<number, unknown>();

  const hydrate = (index: number): unknown => {
    if (index < 0) return SPECIAL[index];
    if (cache.has(index)) return cache.get(index);

    const raw = values[index];
    if (Array.isArray(raw)) {
      if (typeof raw[0] === 'string') {
        const value = hydrateTyped(raw[0], raw.slice(1), hydrate);
        cache.set(index, value);
        return value;
      }
      const arr: unknown[] = [];
      cache.set(index, arr);
      for (const i of raw as number[]) arr.push(hydrate(i));
      return arr;
    }
    if (raw !== null && typeof raw === 'object') {
      const obj: Record<string, unknown> = {};
      cache.set(index, obj);
      for (const [k, i] of Object.entries(raw as Record<string, number>)) obj[k] = hydrate(i);
      return obj;
    }
    cache.set(index, raw);
    return raw;
  };

  return hydrate(0);
}

function hydrateTyped(type: string, args: unknown[], hydrate: (i: number) => unknown): unknown {
  switch (type) {
    case 'Date':
      return new Date(args[0] as string);
    case 'BigInt':
      return BigInt(args[0] as string);
    case 'Object':
      return Object(args[0]);
    case 'Set':
      return new Set((args as number[]).map(hydrate));
    case 'Map': {
      const map = new Map();
      for (let i = 0; i < args.length; i += 2) map.set(hydrate(args[i] as number), hydrate(args[i + 1] as number));
      return map;
    }
    case 'null': {
      const obj = Object.create(null) as Record<string, unknown>;
      for (let i = 0; i < args.length; i += 2) obj[args[i] as string] = hydrate(args[i + 1] as number);
      return obj;
    }
    default:
      throw new Error(`devalue: 不支持的类型 ${type}`);
  }
}
