# podcast-player

播放 podcast 时同步滚动显示 transcript 的播放器（手机优先，兼顾 PC）。数据源是 syntax.fm。

## 用法

```bash
npm install
npm run fetch -- syntax 1039 1045       # 抓取指定节目的剧集，写入 public/data/<节目>/
npm run translate -- syntax 1039 1045   # 用本机已登录的 claude CLI 逐句生成中文译文（默认 haiku）
npm run build                # 产出纯静态的 dist/
npm run serve                # 本地预览，同一 Wi-Fi 下手机可访问
npm run deploy               # 构建并发布到 GitHub Pages（推送 gh-pages 分支）
```

首页按节目分组列出已抓取的剧集（列表在构建时从 `public/data/` 派生），点进去是播放页 `player.html?p=<节目>&e=<剧集>`。

目前只接了 Syntax（约第 400 期起才有 transcript，个别期也没有）。接入新节目：在 `src/` 实现一个 `Source`（`src/source.ts`），并在 `src/sources.ts` 注册。

播放条右下角「译」打开中文设置，两项可分别开关（偏好存在本机浏览器）：

- 底部中文字幕：播放条上方实时显示当前句的译文（默认开）
- 长按 / 悬停句子看译文：手机长按、PC 鼠标悬停弹出该句译文；单击仍是跳转播放（默认关）

`translate` 每批完成就写盘，中断或有段落未通过校验时重跑同一命令即可续翻；重新 `fetch` 会沿用原文未变段落的译文。

- 测试：`npm test`；类型检查：`npm run typecheck`
- 线上地址：https://house-plaud.github.io/podcast-player/
- `public/data/`（transcript 与译文）不进 main，只随部署产物进 gh-pages 分支；音频直接链接 megaphone 原始 mp3，不托管

## 已知限制

- transcript 只有段落级时间戳，句子起止按字符数比例估算，长段落内可能有 1–2 秒偏差。
- megaphone 会动态插入广告，理论上音频时间轴可能与 transcript 错位。1039 期实测（2026-10-19）全程偏移中位数在 ±0.15s 内，只有片尾彩蛋三段不在当前音频里。
