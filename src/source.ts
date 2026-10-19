import type { Episode } from '../web/episode.ts';
import type { PodcastMeta } from './site-index.ts';

// 接入一个新节目 = 实现一个 Source 并在 sources.ts 注册
export interface Source extends PodcastMeta {
  // ref 是该节目自己的剧集引用（Syntax 是期号），返回值的 id 即文件名
  fetchEpisode(ref: string): Promise<Episode>;
}
