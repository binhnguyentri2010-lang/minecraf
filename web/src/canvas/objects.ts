import { plainText } from '../math/mathtext';
import { strokeHit, strokesBounds } from './geometry';
import type { Item, Obj, Prim, V } from './types';

/** Similarity transform: x' = a·x − b·y + tx ; y' = b·x + a·y + ty */
export interface Mat {
  a: number;
  b: number;
  tx: number;
  ty: number;
}

export const applyMat = (m: Mat, x: number, y: number): V => [m.a * x - m.b * y + m.tx, m.b * x + m.a * y + m.ty];

/** Rotate by `rot` and scale by `k` about `pivot`, then translate by (dx, dy). */
export function similarity(pivot: V, dx: number, dy: number, rot: number, k: number): Mat {
  const a = k * Math.cos(rot);
  const b = k * Math.sin(rot);
  return { a, b, tx: pivot[0] - (a * pivot[0] - b * pivot[1]) + dx, ty: pivot[1] - (b * pivot[0] + a * pivot[1]) + dy };
}

export function transformItem(it: Item, m: Mat): Item {
  const k = Math.hypot(m.a, m.b);
  const ang = Math.atan2(m.b, m.a);
  if (it.type === 'stroke') {
    return {
      ...it,
      pts: it.pts.map((p) => {
        const [x, y] = applyMat(m, p.x, p.y);
        return { x, y, p: p.p };
      }),
      size: it.size * k,
    };
  }
  const [x, y] = applyMat(m, it.x, it.y);
  return { ...it, x, y, rot: it.rot + ang, scale: it.scale * k };
}

export const objToWorld = (o: Obj, lx: number, ly: number): V => {
  const c = Math.cos(o.rot) * o.scale;
  const s = Math.sin(o.rot) * o.scale;
  return [o.x + c * lx - s * ly, o.y + s * lx + c * ly];
};

export const worldToObj = (o: Obj, wx: number, wy: number): V => {
  const dx = wx - o.x;
  const dy = wy - o.y;
  const c = Math.cos(-o.rot) / o.scale;
  const s = Math.sin(-o.rot) / o.scale;
  return [c * dx - s * dy, s * dx + c * dy];
};

export function textExtent(p: Extract<Prim, { t: 'text' }>): { x0: number; x1: number; y0: number; y1: number } {
  const size = p.size ?? 16;
  const plain = p.math ? plainText(p.s) : p.s;
  const w = plain.length * size * 0.56 + 4;
  const h = size * (p.math && /[\\^_]/.test(p.s) ? 1.7 : 1.25);
  const anchor = p.anchor ?? 'middle';
  const x0 = anchor === 'start' ? p.o[0] : anchor === 'middle' ? p.o[0] - w / 2 : p.o[0] - w;
  return { x0, x1: x0 + w, y0: p.o[1] - h / 2, y1: p.o[1] + h / 2 };
}

export function primBounds(p: Prim): { minX: number; minY: number; maxX: number; maxY: number } {
  const acc = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x: number, y: number) => {
    acc.minX = Math.min(acc.minX, x);
    acc.minY = Math.min(acc.minY, y);
    acc.maxX = Math.max(acc.maxX, x);
    acc.maxY = Math.max(acc.maxY, y);
  };
  switch (p.t) {
    case 'line':
    case 'arrow':
      add(p.a[0], p.a[1]);
      add(p.b[0], p.b[1]);
      break;
    case 'poly':
      for (const q of p.pts) add(q[0], q[1]);
      break;
    case 'ellipse':
      add(p.o[0] - p.rx, p.o[1] - p.ry);
      add(p.o[0] + p.rx, p.o[1] + p.ry);
      break;
    case 'dot': {
      const r = p.r ?? 3.2;
      add(p.o[0] - r, p.o[1] - r);
      add(p.o[0] + r, p.o[1] + r);
      break;
    }
    case 'text': {
      const t = textExtent(p);
      add(t.x0, t.y0);
      add(t.x1, t.y1);
    }
  }
  return acc;
}

export function objLocalBounds(o: Obj) {
  const acc = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of o.prims) {
    const b = primBounds(p);
    acc.minX = Math.min(acc.minX, b.minX);
    acc.minY = Math.min(acc.minY, b.minY);
    acc.maxX = Math.max(acc.maxX, b.maxX);
    acc.maxY = Math.max(acc.maxY, b.maxY);
  }
  if (!Number.isFinite(acc.minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return acc;
}

export function itemBounds(it: Item): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (it.type === 'stroke') return strokesBounds([it]);
  const b = objLocalBounds(it);
  const cs = [objToWorld(it, b.minX, b.minY), objToWorld(it, b.maxX, b.minY), objToWorld(it, b.maxX, b.maxY), objToWorld(it, b.minX, b.maxY)];
  const pad = it.lw / 2 * it.scale;
  return {
    minX: Math.min(...cs.map((c) => c[0])) - pad,
    maxX: Math.max(...cs.map((c) => c[0])) + pad,
    minY: Math.min(...cs.map((c) => c[1])) - pad,
    maxY: Math.max(...cs.map((c) => c[1])) + pad,
  };
}

export function groupBounds(items: Item[]) {
  let acc: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const it of items) {
    const b = itemBounds(it);
    if (!b) continue;
    acc = acc
      ? { minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY), maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY) }
      : b;
  }
  return acc;
}

function distSeg(px: number, py: number, a: V, b: V): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

export function pointInPoly(px: number, py: number, pts: V[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function primHit(p: Prim, x: number, y: number, tol: number): boolean {
  switch (p.t) {
    case 'line':
    case 'arrow':
      return distSeg(x, y, p.a, p.b) <= tol;
    case 'poly': {
      const n = p.closed ? p.pts.length : p.pts.length - 1;
      for (let i = 0; i < n; i++) if (distSeg(x, y, p.pts[i], p.pts[(i + 1) % p.pts.length]) <= tol) return true;
      return !!p.closed && !!p.fill && p.fill > 0.02 && pointInPoly(x, y, p.pts);
    }
    case 'ellipse': {
      const r = Math.hypot((x - p.o[0]) / p.rx, (y - p.o[1]) / p.ry);
      if (p.fill && p.fill > 0.02 && p.a0 === undefined && r <= 1) return true;
      return Math.abs(r - 1) * Math.min(p.rx, p.ry) <= tol;
    }
    case 'dot':
      return Math.hypot(x - p.o[0], y - p.o[1]) <= (p.r ?? 3.2) + tol;
    case 'text': {
      const t = textExtent(p);
      return x >= t.x0 - tol && x <= t.x1 + tol && y >= t.y0 - tol && y <= t.y1 + tol;
    }
  }
}

export function objHit(o: Obj, wx: number, wy: number, tolWorld: number): boolean {
  const [x, y] = worldToObj(o, wx, wy);
  const tol = tolWorld / o.scale + (o.lw * 0.5);
  return o.prims.some((p) => primHit(p, x, y, tol));
}

export function itemHit(it: Item, wx: number, wy: number, tolWorld: number): boolean {
  return it.type === 'stroke' ? strokeHit(it, wx, wy, tolWorld) : objHit(it, wx, wy, tolWorld);
}
