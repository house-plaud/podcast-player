import type { Episode, EpisodeSummary, PodcastSummary, SiteIndex } from '../web/episode.ts';
import { hasTranslation } from '../web/timing.ts';

export type PodcastMeta = Omit<PodcastSummary, 'episodes'>;

export function summarizeEpisode(ep: Episode): EpisodeSummary {
  return {
    id: ep.id,
    ...(ep.number !== undefined && { number: ep.number }),
    title: ep.title,
    date: ep.date,
    duration: Math.round(ep.paragraphs.at(-1)?.end ?? 0),
    translated: ep.paragraphs.every((p) => p.sentences.length === 0 || hasTranslation(p)),
  };
}

// 首页数据完全由磁盘上的剧集派生，不单独维护列表，避免列表与文件不一致
export function buildIndex(registered: PodcastMeta[], episodes: Episode[]): SiteIndex {
  const groups = new Map<string, Episode[]>();
  for (const ep of episodes) {
    const list = groups.get(ep.podcast.id) ?? [];
    list.push(ep);
    groups.set(ep.podcast.id, list);
  }

  const known = registered.filter((m) => groups.has(m.id));
  // 数据源被移除但数据还在时，照样展示，标题取剧集里记录的节目名
  const orphans: PodcastMeta[] = [...groups.keys()]
    .filter((id) => !registered.some((m) => m.id === id))
    .map((id) => ({ id, title: groups.get(id)![0]!.podcast.title, description: '', homepage: '' }));

  return {
    podcasts: [...known, ...orphans].map((meta) => ({
      ...meta,
      episodes: groups
        .get(meta.id)!
        .map(summarizeEpisode)
        .sort((a, b) => b.date.localeCompare(a.date) || (b.number ?? 0) - (a.number ?? 0)),
    })),
  };
}
