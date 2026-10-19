const MARGIN = 16;
const GAP = 6;
// 计算译文浮层的视口坐标：优先放句子下方，会被底部播放条挡住时翻到上方
export function placePopover(anchor, size, viewport) {
    const left = Math.max(MARGIN, Math.min(anchor.left, viewport.width - MARGIN - size.width));
    const below = anchor.bottom + GAP;
    const fitsBelow = below + size.height <= viewport.height - viewport.bottomInset;
    return { left, top: fitsBelow ? below : anchor.top - GAP - size.height };
}
