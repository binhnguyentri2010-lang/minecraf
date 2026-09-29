import type { Pt, Stroke, Viewport } from './types';
import { MAX_SCALE, MIN_SCALE } from './types';

export function distToSegment(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

export function strokeHit(s: Stroke, wx: number, wy: number, radius: number): boolean {
  const r = radius + s.size / 2;
  if (s.pts.length === 1) return Math.hypot(wx - s.pts[0].x, wy - s.pts[0].y) <= r;
  for (let i = 1; i < s.pts.length; i++) {
    if (distToSegment(wx, wy, s.pts[i - 1], s.pts[i]) <= r) return true;
  }
  return false;
}

export function clampScale(s: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

export function screenToWorld(vp: Viewport, sx: number, sy: number) {
  return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
}

/** Keep the world point under (fromX, fromY) glued to (toX, toY) after scaling by `ratio`. */
export function transformViewport(
  vp: Viewport,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  ratio: number,
): Viewport {
  const scale = clampScale(vp.scale * ratio);
  const w = screenToWorld(vp, fromX, fromY);
  return { scale, x: toX - w.x * scale, y: toY - w.y * scale };
}

export function strokesBounds(strokes: Stroke[]) {
  if (strokes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    const r = s.size;
    for (const p of s.pts) {
      minX = Math.min(minX, p.x - r);
      minY = Math.min(minY, p.y - r);
      maxX = Math.max(maxX, p.x + r);
      maxY = Math.max(maxY, p.y + r);
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Light moving-average pass(es) over a stroke; endpoints stay fixed so the stroke still starts and ends where the pen did. */
export function smoothPoints(pts: Pt[], passes: number): Pt[] {
  let cur = pts;
  for (let k = 0; k < passes && cur.length >= 3; k++) {
    const src = cur;
    cur = src.map((p, i) =>
      i === 0 || i === src.length - 1 ? p : { x: (src[i - 1].x + 2 * p.x + src[i + 1].x) / 4, y: (src[i - 1].y + 2 * p.y + src[i + 1].y) / 4, p: p.p },
    );
  }
  return cur;
}
