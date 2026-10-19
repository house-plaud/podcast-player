import type { Episode, EpisodeIndexEntry } from './episode.ts';
import { buildSentences, findActive, formatTime, type Sentence } from './timing.ts';
import { placePopover } from './layout.ts';

const RATES = [0.75, 1, 1.25, 1.5, 2];
const SKIP = 15;
const LONG_PRESS_MS = 450;
const HOVER_MS = 250;
const PREFS_KEY = 'podcast-player:zh';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const audio = $<HTMLAudioElement>('audio');
const transcriptEl = $('transcript');
const seek = $<HTMLInputElement>('seek');
const playBtn = $<HTMLButtonElement>('play');
const rateBtn = $<HTMLButtonElement>('rate');
const followBtn = $<HTMLButtonElement>('follow');
const curEl = $('cur');
const durEl = $('dur');
const footer = document.querySelector<HTMLElement>('.player')!;
const subEl = $('sub');
const glossEl = $('gloss');
const zhBtn = $<HTMLButtonElement>('zh');
const prefsEl = $('prefs');
const prefSub = $<HTMLInputElement>('pref-sub');
const prefGloss = $<HTMLInputElement>('pref-gloss');

let sentences: Sentence[] = [];
let spans: HTMLElement[] = [];
let active = -1;
let following = true;
let seeking = false;

// 两个译文功能各自独立开关；默认只开字幕，悬停浮层在 PC 上移动鼠标时容易打扰
interface ZhPrefs {
  subtitle: boolean;
  gloss: boolean;
}
let prefs: ZhPrefs = { subtitle: true, gloss: false };
let hasZh = false;

async function loadEpisode(): Promise<Episode> {
  const param = new URLSearchParams(location.search).get('ep');
  let number = param ? Number(param) : NaN;
  if (!Number.isInteger(number)) {
    const index = (await (await fetch('data/index.json')).json()) as EpisodeIndexEntry[];
    if (!index[0]) throw new Error('还没有抓取任何节目，先运行 npm run fetch -- <期号>');
    number = index[0].number;
  }
  const res = await fetch(`data/${number}.json`);
  if (!res.ok) throw new Error(`第 ${number} 期未抓取（data/${number}.json → ${res.status}）`);
  return (await res.json()) as Episode;
}

function render(ep: Episode) {
  document.title = `#${ep.number} ${ep.title}`;
  $('ep-meta').textContent = `Syntax #${ep.number} · ${ep.date}`;
  $('ep-title').textContent = ep.title;
  $<HTMLAnchorElement>('source').href = ep.sourceUrl;

  sentences = buildSentences(ep.paragraphs);
  const frag = document.createDocumentFragment();
  const paraEls: HTMLElement[] = [];
  ep.paragraphs.forEach((p, i) => {
    const prev = ep.paragraphs[i - 1];
    // 源数据常在句中切段：同一说话人且上一段没说完时，接在同一个 <p> 里显示
    if (prev && prev.speaker === p.speaker && !/[.?!…]["')\]]?$/.test(prev.sentences.at(-1) ?? '')) {
      paraEls.push(paraEls.at(-1)!);
      return;
    }
    if (!prev || prev.speaker !== p.speaker) {
      const who = document.createElement('span');
      who.className = 'speaker';
      who.textContent = p.speaker;
      const ts = document.createElement('span');
      ts.className = 'ts';
      ts.textContent = formatTime(p.start);
      who.append(ts);
      frag.append(who);
    }
    const para = document.createElement('p');
    para.className = 'para';
    paraEls.push(para);
    frag.append(para);
  });
  spans = sentences.map((s, i) => {
    const span = document.createElement('span');
    span.className = 's';
    span.dataset.i = String(i);
    span.textContent = s.text;
    paraEls[s.paragraph]!.append(span, ' ');
    return span;
  });
  transcriptEl.replaceChildren(frag);

  hasZh = sentences.some((s) => s.zh);
  zhBtn.disabled = !hasZh;
  if (!hasZh) zhBtn.title = `本期还没有译文：npm run translate -- ${ep.number}`;
  applyPrefs();

  audio.src = ep.audioUrl;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: ep.title, artist: `Syntax #${ep.number}` });
  }
}

function setActive(next: number) {
  if (next === active) return;
  spans[active]?.classList.remove('on');
  // 只改动新旧位置之间的句子，seek 跨度再大也不用全量重刷
  if (next > active) for (let i = Math.max(active, 0); i < next; i++) spans[i]!.classList.add('done');
  else for (let i = next + 1; i <= active; i++) spans[i]!.classList.remove('done');
  active = next;
  updateSubtitle();
  const el = spans[active];
  if (!el) return;
  el.classList.remove('done');
  el.classList.add('on');
  if (following) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function syncTime() {
  const t = audio.currentTime;
  setActive(findActive(sentences, t));
  if (!seeking) {
    // rAF 每秒 60 次，只在显示值真正变化时写 DOM；开着无障碍树时每次写入都要重新序列化
    const pos = t.toFixed(1);
    if (seek.value !== pos) seek.value = pos;
    const label = formatTime(t);
    if (curEl.textContent !== label) curEl.textContent = label;
  }
}

// timeupdate 只有约 4Hz，播放时用 rAF 让高亮切换更跟手
let raf = 0;
function tick() {
  syncTime();
  raf = requestAnimationFrame(tick);
}

function seekTo(t: number) {
  audio.currentTime = Math.max(0, Math.min(t, audio.duration || t));
  syncTime();
}

function setFollowing(on: boolean) {
  following = on;
  followBtn.hidden = on;
  if (on) spans[active]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<ZhPrefs> | null;
    if (saved) prefs = { ...prefs, ...saved };
  } catch {}
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function applyPrefs() {
  prefSub.checked = prefs.subtitle;
  prefGloss.checked = prefs.gloss;
  zhBtn.classList.toggle('on', hasZh && (prefs.subtitle || prefs.gloss));
  document.body.classList.toggle('gloss-on', hasZh && prefs.gloss);
  if (!prefs.gloss) hideGloss();
  updateSubtitle();
}

function updateSubtitle() {
  const zh = prefs.subtitle ? sentences[active]?.zh : undefined;
  subEl.hidden = !hasZh || !prefs.subtitle;
  // 没有当前句或本句缺译文时留空行占位，避免播放条高度跳动
  subEl.textContent = zh ?? '\u00a0';
}

let glossFor: HTMLElement | null = null;

function showGloss(span: HTMLElement) {
  hideGloss();
  glossFor = span;
  span.classList.add('peek');
  glossEl.textContent = sentences[Number(span.dataset.i)]?.zh ?? '（本句暂无译文）';
  glossEl.hidden = false;
  // 多行句子取首行左边和末行底边，浮层贴着句子出现
  const rects = span.getClientRects();
  const first = rects[0] ?? span.getBoundingClientRect();
  const last = rects[rects.length - 1] ?? first;
  const pos = placePopover(
    { left: first.left, top: first.top, bottom: last.bottom },
    { width: glossEl.offsetWidth, height: glossEl.offsetHeight },
    { width: document.documentElement.clientWidth, height: innerHeight, bottomInset: footer.offsetHeight },
  );
  glossEl.style.left = `${pos.left + scrollX}px`;
  glossEl.style.top = `${pos.top + scrollY}px`;
}

function hideGloss() {
  glossFor?.classList.remove('peek');
  glossFor = null;
  glossEl.hidden = true;
}

function wireGloss() {
  const glossTarget = (e: Event) =>
    hasZh && prefs.gloss ? (e.target as HTMLElement).closest<HTMLElement>('.s') : null;

  // 触屏：长按出浮层；手指移动超过阈值视为滚动，取消
  let pressTimer = 0;
  let pressAt = { x: 0, y: 0 };
  transcriptEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const span = glossTarget(e);
    if (!span) return;
    pressAt = { x: e.clientX, y: e.clientY };
    pressTimer = window.setTimeout(() => {
      showGloss(span);
      suppressClick = true;
    }, LONG_PRESS_MS);
  });
  transcriptEl.addEventListener('pointermove', (e) => {
    if (pressTimer && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 10) clearTimeout(pressTimer);
  });
  for (const ev of ['pointerup', 'pointercancel']) transcriptEl.addEventListener(ev, () => clearTimeout(pressTimer));
  transcriptEl.addEventListener('contextmenu', (e) => glossTarget(e) && e.preventDefault());
  // 浮层打开后，点任意位置先关浮层
  document.addEventListener('pointerdown', (e) => {
    if (glossFor && e.pointerType !== 'mouse' && !glossFor.contains(e.target as Node)) hideGloss();
  });

  // 鼠标：悬停片刻出浮层，移开即收
  let hoverTimer = 0;
  transcriptEl.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const span = glossTarget(e);
    clearTimeout(hoverTimer);
    if (span) hoverTimer = window.setTimeout(() => showGloss(span), HOVER_MS);
  });
  transcriptEl.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(hoverTimer);
    if (glossFor && !glossFor.contains(e.relatedTarget as Node)) hideGloss();
  });
}

let suppressClick = false;

function wirePrefs() {
  loadPrefs();
  zhBtn.onclick = () => {
    prefsEl.hidden = !prefsEl.hidden;
    zhBtn.setAttribute('aria-expanded', String(!prefsEl.hidden));
  };
  prefSub.onchange = () => {
    prefs.subtitle = prefSub.checked;
    savePrefs();
    applyPrefs();
  };
  prefGloss.onchange = () => {
    prefs.gloss = prefGloss.checked;
    savePrefs();
    applyPrefs();
  };
  // 播放条高度随字幕 / 设置面板变化，同步给 CSS 用于留白和滚动居中
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--player-h', `${footer.offsetHeight}px`);
  }).observe(footer);
}

function wire() {
  wirePrefs();
  wireGloss();
  playBtn.onclick = () => (audio.paused ? audio.play() : audio.pause());
  $('back').onclick = () => seekTo(audio.currentTime - SKIP);
  $('fwd').onclick = () => seekTo(audio.currentTime + SKIP);
  rateBtn.onclick = () => {
    const next = RATES[(RATES.indexOf(audio.playbackRate) + 1) % RATES.length]!;
    audio.playbackRate = next;
    rateBtn.textContent = `${next}x`;
  };

  audio.addEventListener('play', () => {
    playBtn.textContent = '❚❚';
    playBtn.ariaLabel = '暂停';
    cancelAnimationFrame(raf);
    tick();
  });
  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
    playBtn.ariaLabel = '播放';
    cancelAnimationFrame(raf);
    syncTime();
  });
  audio.addEventListener('loadedmetadata', () => {
    seek.max = String(audio.duration);
    durEl.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('timeupdate', () => audio.paused && syncTime());

  // 拖动时只更新时间标签，松手再真正 seek，避免拖动过程中反复缓冲
  seek.addEventListener('input', () => {
    seeking = true;
    curEl.textContent = formatTime(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    seeking = false;
    seekTo(Number(seek.value));
  });

  transcriptEl.addEventListener('click', (e) => {
    // 长按出浮层后紧跟的那次 click 不触发跳转
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const i = (e.target as HTMLElement).closest<HTMLElement>('.s')?.dataset.i;
    if (i === undefined) return;
    seekTo(sentences[Number(i)]!.start);
    setFollowing(true);
    if (audio.paused) audio.play();
  });

  // 用户手动滚动时暂停自动跟随；只监听手势事件，程序触发的滚动不会误判
  for (const ev of ['wheel', 'touchmove']) {
    window.addEventListener(ev, () => following && setFollowing(false), { passive: true });
  }
  followBtn.onclick = () => setFollowing(true);

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      playBtn.click();
    } else if (e.code === 'ArrowLeft') seekTo(audio.currentTime - SKIP);
    else if (e.code === 'ArrowRight') seekTo(audio.currentTime + SKIP);
  });

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => audio.play());
    ms.setActionHandler('pause', () => audio.pause());
    ms.setActionHandler('seekbackward', () => seekTo(audio.currentTime - SKIP));
    ms.setActionHandler('seekforward', () => seekTo(audio.currentTime + SKIP));
    ms.setActionHandler('seekto', (d) => d.seekTime !== undefined && seekTo(d.seekTime));
  }
}

try {
  wire();
  render(await loadEpisode());
} catch (err) {
  $('ep-meta').textContent = '';
  const msg = document.createElement('p');
  msg.className = 'error';
  msg.textContent = (err as Error).message;
  transcriptEl.replaceChildren(msg);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
