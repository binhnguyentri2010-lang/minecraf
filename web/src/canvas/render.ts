import { getStroke } from 'perfect-freehand';
import { strokesBounds } from './geometry';
import type { Background, Stroke, Viewport } from './types';
import { GRID } from './types';

const pathCache = new WeakMap<Stroke, Path2D>();

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

function buildPath(s: Stroke): Path2D {
  const outline = getStroke(
    s.pts.map((p) => [p.x, p.y, p.p]),
    {
      size: s.kind === 'highlighter' ? s.size : s.size * 1.6,
      thinning: s.kind === 'highlighter' ? 0 : 0.5,
      smoothing: 0.6,
      streamline: 0.4,
      simulatePressure: !s.pen,
    },
  );
  return outlineToPath(outline);
}

export function strokePath(s: Stroke, cache = true): Path2D {
  if (!cache) return buildPath(s);
  let p = pathCache.get(s);
  if (!p) {
    p = buildPath(s);
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
  ctx.fillStyle = '#fbfbf8';
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
    ctx.font = `${fs}px -apple-system, "SF Pro Text", system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    const unit = GRID;
    const every = Math.max(1, Math.round(step / unit));
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      if (Math.abs(x) < 1e-6) continue;
      ctx.fillText(String(Math.round(x / unit / every) * every), x, 4 * px);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      if (Math.abs(y) < 1e-6) continue;
      ctx.fillText(String(Math.round(-y / unit / every) * every), -4 * px, y);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('O', -4 * px, 4 * px);
    ctx.textAlign = 'left';
    ctx.fillText('x', x1 - 14 * px, 6 * px);
    ctx.fillText('y', 8 * px, y0 + 4 * px);
  }
}

export function exportPng(strokes: Stroke[], bg: Background): Promise<Blob | null> {
  const b = strokesBounds(strokes) ?? { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  const pad = 40;
  const w = Math.ceil(b.maxX - b.minX + pad * 2);
  const h = Math.ceil(b.maxY - b.minY + pad * 2);
  const scale = Math.min(2, 4096 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  const vp: Viewport = { x: pad - b.minX, y: pad - b.minY, scale: 1 };
  drawBackground(ctx, bg, vp, w, h, scale);
  setViewTransform(ctx, vp, scale);
  for (const s of strokes) drawStroke(ctx, s, false);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
