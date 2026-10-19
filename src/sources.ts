import type { Source } from './source.ts';
import { syntax } from './syntax.ts';

// 注册顺序即首页节目顺序
export const SOURCES: Source[] = [syntax];

export function getSource(id: string): Source {
  const source = SOURCES.find((s) => s.id === id);
  if (!source) throw new Error(`未知节目 ${id}，可用：${SOURCES.map((s) => s.id).join(', ')}`);
  return source;
}
