import { getStroke } from 'perfect-freehand';
import { drawMath } from '../math/mathtext';
import { groupBounds, itemBounds } from './objects';
import type { Background, Item, Obj, Prim, Pt, Stroke, Viewport } from './types';
import { GRID } from './types';

export const PAPER = '#fbfbf8';
const FONT = '-apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif';

const pathCache = new WeakMap<Stroke, Path2D>();

/** stabiliser strength → perfect-freehand options (0.4 reproduces the original look) */
export const smoothingOptions = (smooth = 0.4) => ({ smoothing: 0.4 + 0.5 * smooth, streamline: 0.1 + 0.7 * smooth });

/** Catmull-Rom densification: the outline is built from a curve, not a polyline, so its edges come out round instead of faceted. */
export function curvePoints(pts: Pt[], step = 1.5): Pt[] {
  const n = pts.length;
  if (n < 3) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const k = Math.min(8, Math.max(1, Math.round(len / step)));
    for (let j = 1; j <= k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), p: p1.p + (p2.p - p1.p) * t });
    }
  }
  return out;
}

export function strokeOutline(s: Stroke): number[][] {
  return getStroke(
    curvePoints(s.pts).map((p) => [p.x, p.y, p.p]),
    {
      size: s.kind === 'highlighter' ? s.size : s.size * 1.7,
      thinning: s.kind === 'highlighter' ? 0 : 0.62,
      // ink-like: pointed start/end, pressure eased so light touches stay fine and firm ones swell
      easing: (t: number) => t * (2 - t),
      start: { taper: s.kind === 'highlighter' ? 0 : s.size, cap: true },
      end: { taper: s.kind === 'highlighter' ? 0 : s.size * 4, cap: true },
      ...smoothingOptions(s.smooth),
      simulatePressure: !s.pen,
    },
  );
}

function outlineToPath(pts: number[][]): Path2D {
  const p = new Path2D();
  if (pts.length < 2) return p;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    p.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  p.closePath();
  return p;
}

export function strokePath(s: Stroke, cache = true): Path2D {
  if (!cache) return outlineToPath(strokeOutline(s));
  let p = pathCache.get(s);
  if (!p) {
    p = outlineToPath(strokeOutline(s));
    pathCache.set(s, p);
  }
  return p;
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, cache = true) {
  ctx.save();
  if (s.kind === 'highlighter') ctx.globalAlpha = 0.35;
  ctx.fillStyle = s.color;
  ctx.fill(strokePath(s, cache));
  ctx.restore();
}

function drawPrim(ctx: CanvasRenderingContext2D, p: Prim, o: Obj) {
  const col = p.c ?? o.color;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  const lw = o.lw * (p.w ?? 1);
  ctx.lineWidth = lw;
  const dashed = !!(p.dash || o.dash);
  ctx.setLineDash(dashed ? [Math.max(4, o.lw * 3.2 + 3), Math.max(3, o.lw * 2.2 + 3)] : []);
  const stroke = () => {
    if (lw > 0) ctx.stroke();
  };
  switch (p.t) {
    case 'line':
      ctx.beginPath();
      ctx.moveTo(p.a[0], p.a[1]);
      ctx.lineTo(p.b[0], p.b[1]);
      stroke();
      break;
    case 'arrow': {
      const [ax, ay] = p.a;
      const [bx, by] = p.b;
      const ang = Math.atan2(by - ay, bx - ax);
      const head = 9 + lw * 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx - Math.cos(ang) * head * 0.6, by - Math.sin(ang) * head * 0.6);
      stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - head * Math.cos(ang - 0.42), by - head * Math.sin(ang - 0.42));
      ctx.lineTo(bx - head * 0.7 * Math.cos(ang), by - head * 0.7 * Math.sin(ang));
      ctx.lineTo(bx - head * Math.cos(ang + 0.42), by - head * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'poly': {
      if (p.pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(p.pts[0][0], p.pts[0][1]);
      for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i][0], p.pts[i][1]);
      if (p.closed) ctx.closePath();
      if (p.fill && p.closed) {
        ctx.save();
        ctx.globalAlpha = p.fill;
        ctx.fill();
        ctx.restore();
      }
      stroke();
      break;
    }
    case 'ellipse': {
      ctx.beginPath();
      const full = p.a0 === undefined;
      ctx.ellipse(p.o[0], p.o[1], Math.max(p.rx, 0.01), Math.max(p.ry, 0.01), 0, p.a0 ?? 0, p.a1 ?? Math.PI * 2);
      if (p.fill && full) {
        ctx.save();
        ctx.globalAlpha = p.fill;
        ctx.fill();
        ctx.restore();
      }
      stroke();
      break;
    }
    case 'dot':
      ctx.beginPath();
      ctx.arc(p.o[0], p.o[1], p.r ?? 3.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'text': {
      const size = p.size ?? 16;
      const anchor = p.anchor ?? 'middle';
      if (p.math) {
        drawMath(ctx, p.s, p.o[0], p.o[1], size, col, anchor, PAPER);
      } else {
        ctx.font = `${size}px ${FONT}`;
        ctx.textAlign = anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = PAPER;
        ctx.globalAlpha = 0.8;
        ctx.strokeText(p.s, p.o[0], p.o[1]);
        ctx.globalAlpha = 1;
        ctx.fillText(p.s, p.o[0], p.o[1]);
      }
    }
  }
}

export function drawObj(ctx: CanvasRenderingContext2D, o: Obj) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot);
  ctx.scale(o.scale, o.scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of o.prims) {
    ctx.save();
    drawPrim(ctx, p, o);
    ctx.restore();
  }
  ctx.restore();
}

export function drawItem(ctx: CanvasRenderingContext2D, it: Item, cache = true) {
  if (it.type === 'stroke') drawStroke(ctx, it, cache);
  else drawObj(ctx, it);
}

const boundsCache = new WeakMap<Item, ReturnType<typeof itemBounds>>();

/** Draws only the items that intersect the visible world rectangle. */
export function drawVisibleItems(ctx: CanvasRenderingContext2D, items: Item[], vp: Viewport, w: number, h: number) {
  const margin = 24 / vp.scale;
  const x0 = -vp.x / vp.scale - margin, y0 = -vp.y / vp.scale - margin;
  const x1 = (w - vp.x) / vp.scale + margin, y1 = (h - vp.y) / vp.scale + margin;
  for (const it of items) {
    let b = boundsCache.get(it);
    if (b === undefined) {
      b = itemBounds(it);
      boundsCache.set(it, b);
    }
    if (b && (b.maxX < x0 || b.minX > x1 || b.maxY < y0 || b.minY > y1)) continue;
    drawItem(ctx, it);
  }
}

export function setViewTransform(ctx: CanvasRenderingContext2D, vp: Viewport, dpr: number) {
  ctx.setTransform(dpr * vp.scale, 0, 0, dpr * vp.scale, dpr * vp.x, dpr * vp.y);
}

function niceStep(scale: number): number {
  let step = GRID;
  while (step * scale < 18) step *= 2;
  while (step * scale > 90) step /= 2;
  return step;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: Background,
  vp: Viewport,
  w: number,
  h: number,
  dpr: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  if (bg === 'blank') return;
  setViewTransform(ctx, vp, dpr);
  const x0 = -vp.x / vp.scale;
  const y0 = -vp.y / vp.scale;
  const x1 = (w - vp.x) / vp.scale;
  const y1 = (h - vp.y) / vp.scale;
  const step = niceStep(vp.scale);
  const px = 1 / vp.scale;
  const startX = Math.floor(x0 / step) * step;
  const startY = Math.floor(y0 / step) * step;

  if (bg === 'dots') {
    ctx.fillStyle = 'rgba(60,70,90,0.45)';
    for (let x = startX; x <= x1; x += step)
      for (let y = startY; y <= y1; y += step) ctx.fillRect(x - px, y - px, 2 * px, 2 * px);
    return;
  }

  ctx.lineWidth = px;
  ctx.strokeStyle = 'rgba(70,110,170,0.20)';
  ctx.beginPath();
  for (let x = startX; x <= x1; x += step) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let y = startY; y <= y1; y += step) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();

  if (bg === 'axes') {
    ctx.strokeStyle = 'rgba(20,30,50,0.85)';
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.lineWidth = 1.6 * px;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x1, 0);
    ctx.moveTo(0, y0);
    ctx.lineTo(0, y1);
    ctx.stroke();
    const fs = 12 * px;
    ctx.font = `${fs}px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    const every = Math.max(1, Math.round(step / GRID));
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      if (Math.abs(x) < 1e-6) continue;
      ctx.fillText(String(Math.round(x / GRID / every) * every), x, 4 * px);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      if (Math.abs(y) < 1e-6) continue;
      ctx.fillText(String(Math.round(-y / GRID / every) * every), -4 * px, y);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('O', -4 * px, 4 * px);
    ctx.textAlign = 'left';
    ctx.fillText('x', x1 - 14 * px, 6 * px);
    ctx.fillText('y', 8 * px, y0 + 4 * px);
  }
}

/** Renders a board into a canvas that fits all content (used for PNG / JPEG / PDF export). */
export function renderBoardToCanvas(items: Item[], bg: Background, maxSide = 4096, preferScale = 2): HTMLCanvasElement {
  const b = groupBounds(items) ?? { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  const pad = 40;
  const w = Math.ceil(b.maxX - b.minX + pad * 2);
  const h = Math.ceil(b.maxY - b.minY + pad * 2);
  const scale = Math.min(preferScale, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext('2d')!;
  const vp: Viewport = { x: pad - b.minX, y: pad - b.minY, scale: 1 };
  drawBackground(ctx, bg, vp, w, h, scale);
  setViewTransform(ctx, vp, scale);
  for (const it of items) drawItem(ctx, it, false);
  return c;
}

export function exportPng(items: Item[], bg: Background): Promise<Blob | null> {
  const c = renderBoardToCanvas(items, bg);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
