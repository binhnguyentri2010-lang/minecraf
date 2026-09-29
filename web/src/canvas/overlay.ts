import { groupBounds } from './objects';
import type { Item, Obj, V } from './types';

const ACCENT = '#2563eb';

export interface SelectionGeo {
  box: { minX: number; minY: number; maxX: number; maxY: number };
  center: V;
  rotate: V;
  scale: V;
}

export function selectionGeo(items: Item[], viewScale: number): SelectionGeo | null {
  const b = groupBounds(items);
  if (!b) return null;
  const pad = 6 / viewScale;
  const box = { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
  const cx = (box.minX + box.maxX) / 2;
  return { box, center: [cx, (box.minY + box.maxY) / 2], rotate: [cx, box.minY - 30 / viewScale], scale: [box.maxX, box.maxY] };
}

export function drawSelection(ctx: CanvasRenderingContext2D, geo: SelectionGeo, viewScale: number) {
  const px = 1 / viewScale;
  const { box } = geo;
  ctx.save();
  ctx.lineWidth = 1.5 * px;
  ctx.strokeStyle = ACCENT;
  ctx.setLineDash([6 * px, 4 * px]);
  ctx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(geo.rotate[0], box.minY);
  ctx.lineTo(geo.rotate[0], geo.rotate[1]);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(geo.rotate[0], geo.rotate[1], 9 * px, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(geo.rotate[0], geo.rotate[1], 3.5 * px, -2.4, 1.2);
  ctx.stroke();
  const s = 9 * px;
  ctx.fillRect(geo.scale[0] - s, geo.scale[1] - s, 2 * s, 2 * s);
  ctx.strokeRect(geo.scale[0] - s, geo.scale[1] - s, 2 * s, 2 * s);
  ctx.restore();
}

export function drawMarquee(ctx: CanvasRenderingContext2D, a: V, b: V, viewScale: number) {
  const px = 1 / viewScale;
  ctx.save();
  ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.2 * px;
  ctx.setLineDash([5 * px, 4 * px]);
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
  const w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function rectsIntersect(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export type DragShape = 'line' | 'arrow' | 'circle' | 'rect';

/** Builds a vector object from a drag gesture (compass = circle, straight edge = line ...). */
export function shapeFromDrag(
  tool: DragShape,
  s: V,
  c: V,
  style: { id: string; seq: number; color: string; lw: number; dash: boolean },
): Obj {
  let dx = c[0] - s[0];
  let dy = c[1] - s[1];
  const base = { type: 'obj' as const, id: style.id, seq: style.seq, x: s[0], y: s[1], rot: 0, scale: 1, color: style.color, lw: style.lw, dash: style.dash };
  if (tool === 'line' || tool === 'arrow') {
    // snap to 0/45/90° when the pen is within 3° of them
    const ang = Math.atan2(dy, dx);
    const q = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    if (Math.abs(ang - q) < (3 * Math.PI) / 180) {
      const len = Math.hypot(dx, dy);
      dx = Math.cos(q) * len;
      dy = Math.sin(q) * len;
    }
    return { ...base, prims: [{ t: tool, a: [0, 0], b: [dx, dy] }] };
  }
  if (tool === 'circle') {
    const r = Math.hypot(dx, dy);
    return { ...base, prims: [{ t: 'ellipse', o: [0, 0], rx: r, ry: r }, { t: 'dot', o: [0, 0], r: Math.max(2.5, style.lw * 1.1) }] };
  }
  return { ...base, prims: [{ t: 'poly', pts: [[0, 0], [dx, 0], [dx, dy], [0, dy]], closed: true }] };
}
