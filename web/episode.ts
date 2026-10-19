// 抓取脚本产出、播放页消费的静态 JSON 形状。

export interface Paragraph {
  start: number; // 秒
  end: number;
  speaker: string;
  sentences: string[]; // 抓取时切好，避免不同浏览器的 Intl.Segmenter 切法不同导致译文错位
  zh?: string[]; // 与 sentences 一一对应
}

export interface Episode {
  podcast: { id: string; title: string };
  id: string; // 节目内唯一，也是文件名：data/<podcast.id>/<id>.json
  number?: number; // 有期号的节目才有
  title: string;
  date: string; // YYYY-MM-DD
  audioUrl: string;
  sourceUrl: string;
  paragraphs: Paragraph[];
}

// 以下为构建时从全部剧集派生的 data/index.json

export interface EpisodeSummary {
  id: string;
  number?: number;
  title: string;
  date: string;
  duration: number; // 秒，取 transcript 末尾，近似值
  translated: boolean;
}

export interface PodcastSummary {
  id: string;
  title: string;
  description: string;
  homepage: string;
  episodes: EpisodeSummary[];
}

export interface SiteIndex {
  podcasts: PodcastSummary[];
}
