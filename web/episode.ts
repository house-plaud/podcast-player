// 抓取脚本产出、播放页消费的静态 JSON 形状。

export interface Paragraph {
  start: number; // 秒
  end: number;
  speaker: string;
  sentences: string[]; // 抓取时切好，避免不同浏览器的 Intl.Segmenter 切法不同导致译文错位
  zh?: string[]; // 与 sentences 一一对应
}

export interface Episode {
  number: number;
  title: string;
  date: string; // YYYY-MM-DD
  audioUrl: string;
  sourceUrl: string;
  paragraphs: Paragraph[];
}

export interface EpisodeIndexEntry {
  number: number;
  title: string;
  date: string;
}
