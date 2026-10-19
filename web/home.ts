import type { PodcastSummary, SiteIndex } from './episode.ts';

const root = document.getElementById('podcasts')!;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function renderPodcast(p: PodcastSummary): HTMLElement {
  const section = el('section', 'podcast');
  const head = el('div', 'podcast-head');
  head.append(el('h2', 'podcast-title', p.title));
  if (p.homepage) {
    const link = el('a', 'podcast-link', '官网');
    link.href = p.homepage;
    link.target = '_blank';
    link.rel = 'noopener';
    head.append(link);
  }
  section.append(head);
  if (p.description) section.append(el('p', 'podcast-desc', p.description));

  const list = el('ul', 'episodes');
  for (const e of p.episodes) {
    const a = el('a', 'ep');
    a.href = `player.html?p=${encodeURIComponent(p.id)}&e=${encodeURIComponent(e.id)}`;
    a.append(el('span', 'ep-title', e.title));
    const meta = el('span', 'ep-meta');
    const parts = [e.number === undefined ? '' : `#${e.number}`, e.date, `${Math.round(e.duration / 60)} 分钟`].filter(Boolean);
    meta.append(parts.join(' · '));
    if (e.translated) meta.append(el('span', 'badge', '中文'));
    a.append(meta);
    const li = el('li', '');
    li.append(a);
    list.append(li);
  }
  section.append(list);
  return section;
}

// 旧链接 /?ep=1039 只有 Syntax 一个节目，转到新的播放页地址
const legacy = new URLSearchParams(location.search).get('ep');
if (legacy) {
  location.replace(`player.html?p=syntax&e=${encodeURIComponent(legacy)}`);
} else {
  try {
    const res = await fetch('data/index.json');
    if (!res.ok) throw new Error(`data/index.json → ${res.status}`);
    const index = (await res.json()) as SiteIndex;
    if (index.podcasts.length === 0) throw new Error('还没有任何剧集');
    root.replaceChildren(...index.podcasts.map(renderPodcast));
  } catch (err) {
    root.replaceChildren(el('p', 'error', `加载失败：${(err as Error).message}`));
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
