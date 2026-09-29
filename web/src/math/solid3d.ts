import type { Prim, V } from '../canvas/types';

export type V3 = [number, number, number];

export interface Solid {
  verts: Record<string, V3>;
  faces: string[][];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
const rad = (d: number) => (d * Math.PI) / 180;

export interface Camera {
  view: V3;
  right: V3;
  up: V3;
  /** 3D → screen (y down), unscaled */
  proj: (p: V3) => V;
}

/** Parallel projection. Same convention as the original bai2_giao_tuyen_3d.py. */
export function camera(azDeg: number, elDeg: number): Camera {
  const a = rad(azDeg);
  const e = rad(elDeg);
  const view: V3 = [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
  const right: V3 = [-Math.sin(a), Math.cos(a), 0];
  const up = cross(view, right);
  return { view, right, up, proj: (p) => [dot(p, right), -dot(p, up)] };
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function solidEdges(s: Solid): [string, string][] {
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const f of s.faces)
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const k = key(a, b);
      if (!seen.has(k)) {
        seen.add(k);
        out.push([a, b]);
      }
    }
  return out;
}

function faceNormalOut(s: Solid, f: string[], centre: V3): V3 {
  // Newell's method
  let n: V3 = [0, 0, 0];
  for (let i = 0; i < f.length; i++) {
    const p = s.verts[f[i]];
    const q = s.verts[f[(i + 1) % f.length]];
    n = [n[0] + (p[1] - q[1]) * (p[2] + q[2]), n[1] + (p[2] - q[2]) * (p[0] + q[0]), n[2] + (p[0] - q[0]) * (p[1] + q[1])];
  }
  const fc: V3 = [0, 0, 0];
  for (const v of f) for (let k = 0; k < 3; k++) fc[k] += s.verts[v][k] / f.length;
  return dot(n, sub(fc, centre)) < 0 ? [-n[0], -n[1], -n[2]] : n;
}

/** Edge is hidden iff every face containing it faces away from the viewer (convex solids). */
export function hiddenEdges(s: Solid, view: V3): Set<string> {
  const names = Object.keys(s.verts);
  const centre: V3 = [0, 0, 0];
  for (const n of names) for (let k = 0; k < 3; k++) centre[k] += s.verts[n][k] / names.length;
  const facing = new Map<string, boolean[]>();
  for (const f of s.faces) {
    const vis = dot(faceNormalOut(s, f, centre), view) > 1e-9;
    for (let i = 0; i < f.length; i++) {
      const k = key(f[i], f[(i + 1) % f.length]);
      (facing.get(k) ?? facing.set(k, []).get(k)!).push(vis);
    }
  }
  const hidden = new Set<string>();
  for (const [k, v] of facing) if (!v.some(Boolean)) hidden.add(k);
  return hidden;
}

export interface ExtraLine {
  a: string;
  b: string;
  c?: string;
  dash?: boolean;
  w?: number;
  /** extend beyond b by this factor (1 = none) */
  ext?: number;
}
export interface ExtraPlane {
  pts: string[];
  c: string;
  fill?: number;
}
export interface SolidOpts {
  az: number;
  el: number;
  size?: number;
  extraPts?: Record<string, V3>;
  extraLines?: ExtraLine[];
  planes?: ExtraPlane[];
  /** names of points to label (default: all solid vertices + extraPts) */
  labelled?: string[];
  labelColors?: Record<string, string>;
  dotted?: string[];
  labels?: boolean;
  edgeColor?: string;
  /** free text placed at the centroid of named points (e.g. plane names) */
  texts?: { pts: string[]; s: string; c?: string; size?: number }[];
}

/** Fit a list of 2D points into a `size` box centred at the origin. */
export function fit(pts: V[], size: number): { s: number; cx: number; cy: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const d = Math.max(maxX - minX, maxY - minY) || 1;
  return { s: size / d, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function solidPrims(solid: Solid, o: SolidOpts): Prim[] {
  const cam = camera(o.az, o.el);
  const all: Record<string, V3> = { ...solid.verts, ...(o.extraPts ?? {}) };
  const raw: Record<string, V> = {};
  for (const [k, p] of Object.entries(all)) raw[k] = cam.proj(p);
  const { s, cx, cy } = fit(Object.values(raw), o.size ?? 190);
  const P = (n: string): V => [(raw[n][0] - cx) * s, (raw[n][1] - cy) * s];
  const hidden = hiddenEdges(solid, cam.view);
  const prims: Prim[] = [];
  const edgeC = o.edgeColor;

  for (const pl of o.planes ?? []) prims.push({ t: 'poly', pts: pl.pts.map(P), closed: true, fill: pl.fill ?? 0.16, c: pl.c, w: 0.5 });
  for (const [a, b] of solidEdges(solid)) {
    prims.push({ t: 'line', a: P(a), b: P(b), dash: hidden.has(key(a, b)), c: edgeC });
  }
  for (const l of o.extraLines ?? []) {
    const A = P(l.a);
    const B0 = P(l.b);
    const k = l.ext ?? 1;
    const B: V = [A[0] + (B0[0] - A[0]) * k, A[1] + (B0[1] - A[1]) * k];
    prims.push({ t: 'line', a: A, b: B, c: l.c, dash: l.dash, w: l.w });
  }
  const names = o.labelled ?? Object.keys(all);
  const centre: V = [0, 0];
  const pts = Object.keys(raw).map(P);
  for (const p of pts) {
    centre[0] += p[0] / pts.length;
    centre[1] += p[1] / pts.length;
  }
  for (const n of o.dotted ?? Object.keys(o.extraPts ?? {})) prims.push({ t: 'dot', o: P(n), c: o.labelColors?.[n], r: 3 });
  if (o.labels !== false)
    for (const n of names) {
      const p = P(n);
      let dx = p[0] - centre[0];
      let dy = p[1] - centre[1];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      prims.push({ t: 'text', o: [p[0] + dx * 15, p[1] + dy * 15], s: n, math: true, size: 17, c: o.labelColors?.[n] });
    }
  for (const t of o.texts ?? []) {
    const q = t.pts.map(P);
    prims.push({
      t: 'text',
      o: [q.reduce((a, b) => a + b[0], 0) / q.length, q.reduce((a, b) => a + b[1], 0) / q.length],
      s: t.s,
      math: true,
      size: t.size ?? 14,
      c: t.c,
    });
  }
  return prims;
}

/** Intersection of lines P1Q1 and P2Q2 assumed coplanar (least squares, like the Python original). */
export function lineIntersection(P1: V3, Q1: V3, P2: V3, Q2: V3): V3 {
  const d1 = sub(Q1, P1);
  const d2 = sub(Q2, P2);
  const w = sub(P2, P1);
  // minimise |P1 + t d1 - P2 - u d2|²
  const a = dot(d1, d1), b = dot(d1, d2), c = dot(d2, d2);
  const d = dot(d1, w), e = dot(d2, w);
  const den = a * c - b * b;
  const t = (c * d - b * e) / den;
  return [P1[0] + t * d1[0], P1[1] + t * d1[1], P1[2] + t * d1[2]];
}

// ---------------------------------------------------------------- solids

const V3s = (x: number, y: number, z: number): V3 => [x, y, z];

export function tetrahedron(): Solid {
  return {
    verts: { A: V3s(-0.2, 0.3, 3.4), B: V3s(-2.4, -0.9, 0), C: V3s(2.7, -1.5, 0), D: V3s(1.0, 2.5, 0) },
    faces: [['A', 'B', 'C'], ['A', 'B', 'D'], ['A', 'C', 'D'], ['B', 'C', 'D']],
  };
}

export function regularTetrahedron(): Solid {
  const a = 3;
  const h = Math.sqrt(2 / 3) * a;
  const r = a / Math.sqrt(3);
  return {
    verts: {
      A: V3s(0, 0, h),
      B: V3s(r, 0, 0),
      C: V3s(-r / 2, (r * Math.sqrt(3)) / 2, 0),
      D: V3s(-r / 2, -(r * Math.sqrt(3)) / 2, 0),
    },
    faces: [['A', 'B', 'C'], ['A', 'C', 'D'], ['A', 'D', 'B'], ['B', 'D', 'C']],
  };
}

export type Base = 'square' | 'parallelogram' | 'trapezoid';

export function baseQuad(kind: Base): [V3, V3, V3, V3] {
  switch (kind) {
    case 'square':
      return [V3s(-2, -2, 0), V3s(2, -2, 0), V3s(2, 2, 0), V3s(-2, 2, 0)];
    case 'parallelogram':
      return [V3s(-2.6, -1.6, 0), V3s(1.4, -1.6, 0), V3s(2.6, 1.6, 0), V3s(-1.4, 1.6, 0)];
    case 'trapezoid':
      return [V3s(-2.8, -1.6, 0), V3s(2.8, -1.6, 0), V3s(1.3, 1.6, 0), V3s(-1.3, 1.6, 0)];
  }
}

/** Pyramid S.ABCD, apex above the centre of the base. */
export function pyramid4(kind: Base, height = 3.6): Solid {
  const q = baseQuad(kind);
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
  const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  return {
    verts: { S: V3s(cx, cy, height), A: q[0], B: q[1], C: q[2], D: q[3] },
    faces: [['A', 'B', 'C', 'D'], ['S', 'A', 'B'], ['S', 'B', 'C'], ['S', 'C', 'D'], ['S', 'D', 'A']],
  };
}

export function pyramid3(height = 3.6): Solid {
  return {
    verts: { S: V3s(0.2, 0.4, height), A: V3s(-2.4, -1.4, 0), B: V3s(2.4, -1.4, 0), C: V3s(0.2, 2.6, 0) },
    faces: [['A', 'B', 'C'], ['S', 'A', 'B'], ['S', 'B', 'C'], ['S', 'C', 'A']],
  };
}

const PRIME = '′';

/** Parallelepiped ABCD.A'B'C'D' (shear moves the top face). */
export function box(w: number, d: number, h: number, shearX = 0, shearY = 0): Solid {
  const b = (x: number, y: number, z: number): V3 => [x, y, z];
  const hw = w / 2, hd = d / 2;
  const A = b(-hw, -hd, 0), B = b(hw, -hd, 0), C = b(hw, hd, 0), D = b(-hw, hd, 0);
  const up = (p: V3): V3 => [p[0] + shearX, p[1] + shearY, p[2] + h];
  const v: Record<string, V3> = { A, B, C, D, [`A${PRIME}`]: up(A), [`B${PRIME}`]: up(B), [`C${PRIME}`]: up(C), [`D${PRIME}`]: up(D) };
  const A1 = `A${PRIME}`, B1 = `B${PRIME}`, C1 = `C${PRIME}`, D1 = `D${PRIME}`;
  return {
    verts: v,
    faces: [
      ['A', 'B', 'C', 'D'],
      [A1, B1, C1, D1],
      ['A', 'B', B1, A1],
      ['B', 'C', C1, B1],
      ['C', 'D', D1, C1],
      ['D', 'A', A1, D1],
    ],
  };
}

/** Triangular prism ABC.A'B'C'. */
export function prism3(h = 3.2, shearX = 0.6): Solid {
  const A: V3 = [-2.2, -1.2, 0], B: V3 = [2.2, -1.2, 0], C: V3 = [0, 2.4, 0];
  const up = (p: V3): V3 => [p[0] + shearX, p[1], p[2] + h];
  const A1 = `A${PRIME}`, B1 = `B${PRIME}`, C1 = `C${PRIME}`;
  return {
    verts: { A, B, C, [A1]: up(A), [B1]: up(B), [C1]: up(C) },
    faces: [['A', 'B', 'C'], [A1, B1, C1], ['A', 'B', B1, A1], ['B', 'C', C1, B1], ['C', 'A', A1, C1]],
  };
}

export const PRIME_CHAR = PRIME;
