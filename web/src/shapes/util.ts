import type { Params, Prim, V } from '../canvas/types';

export interface ParamDef {
  key: string;
  label: string;
  type: 'range' | 'text' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
  def: number | string;
}

export type GroupId = 'plane' | 'solid' | 'coord' | 'trig' | 'misc';

export interface ShapeDef {
  id: string;
  name: string;
  group: GroupId;
  params: ParamDef[];
  gen: (p: Params) => Prim[];
  /** graphs must stay aligned with the Oxy grid, so they are inserted at the world origin */
  atOrigin?: boolean;
}

export const COL = { blue: '#2563eb', orange: '#ea8c00', red: '#dc2626', teal: '#0f766e', grey: '#5b6472' };

/** design unit for plane figures (world units per "1") */
export const K = 34;

/** math coordinates (y up) → local canvas coordinates (y down) */
export const pv = (x: number, y: number, k = K): V => [x * k, -y * k];

export const num = (p: Params, k: string): number => Number(p[k]);
export const on = (p: Params, k: string): boolean => Number(p[k]) !== 0;
export const txt = (p: Params, k: string): string => String(p[k] ?? '');

export const centroid = (pts: V[]): V => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
];

export const label = (o: V, s: string, size = 16, extra: Partial<Extract<Prim, { t: 'text' }>> = {}): Prim => ({
  t: 'text',
  o,
  s,
  size,
  math: true,
  ...extra,
});

export const dotAt = (o: V, c?: string, r = 3.4): Prim => ({ t: 'dot', o, c, r });

/** labels placed radially outside the figure */
export function vertexLabels(pts: V[], names: string, dist = 15, centre?: V, size = 17): Prim[] {
  const c = centre ?? centroid(pts);
  const chars = [...names];
  const out: Prim[] = [];
  pts.forEach((p, i) => {
    if (!chars[i] || chars[i] === ' ') return;
    let dx = p[0] - c[0];
    let dy = p[1] - c[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    out.push(label([p[0] + dx * dist, p[1] + dy * dist], chars[i], size));
  });
  return out;
}

export function polyPrim(pts: V[], extra: { fill?: number; c?: string; w?: number; dash?: boolean } = {}): Prim {
  return { t: 'poly', pts, closed: true, ...extra };
}

export function rightAngleMark(vertex: V, a: V, b: V, size = 11): Prim {
  const ua = unit([a[0] - vertex[0], a[1] - vertex[1]]);
  const ub = unit([b[0] - vertex[0], b[1] - vertex[1]]);
  const p1: V = [vertex[0] + ua[0] * size, vertex[1] + ua[1] * size];
  const p3: V = [vertex[0] + ub[0] * size, vertex[1] + ub[1] * size];
  const p2: V = [p1[0] + ub[0] * size, p1[1] + ub[1] * size];
  return { t: 'poly', pts: [p1, p2, p3], closed: false, w: 0.6 };
}

export function unit(v: V): V {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/** arc at `vertex` between rays towards a and b, on the smaller side */
export function angleArc(vertex: V, a: V, b: V, r: number, c?: string): Prim {
  const ta = Math.atan2(a[1] - vertex[1], a[0] - vertex[0]);
  const tb = Math.atan2(b[1] - vertex[1], b[0] - vertex[0]);
  let d = tb - ta;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const a0 = d >= 0 ? ta : ta + d;
  const a1 = d >= 0 ? ta + d : ta;
  return { t: 'ellipse', o: vertex, rx: r, ry: r, a0, a1, w: 0.7, c };
}

export function lineIntersect2(p1: V, p2: V, p3: V, p4: V): V {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const den = d1x * d2y - d1y * d2x;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den;
  return [p1[0] + t * d1x, p1[1] + t * d1y];
}

export const mid = (a: V, b: V): V => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const dist2 = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const fmt = (n: number, d = 2): string => {
  const r = Math.round(n * 10 ** d) / 10 ** d;
  return (Object.is(r, -0) ? 0 : r).toString().replace('-', '−');
};

export const letters = (n: number, from = 'ABCDEFGHIJKL') => from.slice(0, n);
