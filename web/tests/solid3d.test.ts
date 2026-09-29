import { describe, expect, it } from 'vitest';
import {
  box, camera, hiddenEdges, lineIntersection, prism3, pyramid3, pyramid4, regularTetrahedron, solidEdges, solidPrims,
  tetrahedron, type Solid, type V3,
} from '../src/math/solid3d';

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Independent occlusion oracle: an edge is hidden iff a ray from its midpoint towards the camera enters the solid. */
function oracleHidden(s: Solid, view: V3): Set<string> {
  const names = Object.keys(s.verts);
  const centre: V3 = [0, 0, 0];
  for (const n of names) for (let k = 0; k < 3; k++) centre[k] += s.verts[n][k] / names.length;
  const planes = s.faces.map((f) => {
    const [p0, p1, p2] = f.map((n) => s.verts[n]);
    let n = cross(sub(p1, p0), sub(p2, p0));
    if (dot(n, sub(p0, centre)) < 0) n = [-n[0], -n[1], -n[2]];
    const len = Math.hypot(...n);
    n = [n[0] / len, n[1] / len, n[2] / len];
    return { n, d: dot(n, p0) };
  });
  const out = new Set<string>();
  for (const [a, b] of solidEdges(s)) {
    const m: V3 = [(s.verts[a][0] + s.verts[b][0]) / 2, (s.verts[a][1] + s.verts[b][1]) / 2, (s.verts[a][2] + s.verts[b][2]) / 2];
    let tmax = Infinity;
    for (const pl of planes) {
      const nv = dot(pl.n, view);
      const slack = pl.d - dot(pl.n, m);
      if (nv > 1e-9) tmax = Math.min(tmax, slack / nv);
    }
    if (tmax > 1e-6) out.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  return out;
}

const solids: Record<string, Solid> = {
  tetra: tetrahedron(),
  regTetra: regularTetrahedron(),
  pyr3: pyramid3(),
  sq: pyramid4('square'),
  par: pyramid4('parallelogram'),
  trap: pyramid4('trapezoid'),
  box: box(4, 3, 3),
  oblique: box(4, 3, 3, 1.2, 0.8),
  prism: prism3(),
};

describe('3D solids: hidden edges', () => {
  it('edge counts (Euler): E = V + F - 2', () => {
    for (const [name, s] of Object.entries(solids)) {
      expect(solidEdges(s).length, name).toBe(Object.keys(s.verts).length + s.faces.length - 2);
    }
    expect(solidEdges(solids.tetra)).toHaveLength(6);
    expect(solidEdges(solids.box)).toHaveLength(12);
    expect(solidEdges(solids.sq)).toHaveLength(8);
    expect(solidEdges(solids.prism)).toHaveLength(9);
  });
  it('matches an independent ray-occlusion oracle for many viewpoints', () => {
    let checked = 0;
    for (const [name, s] of Object.entries(solids)) {
      for (let az = -170; az < 180; az += 23) {
        for (const el of [-50, -20, 8, 16, 33, 60, 80]) {
          const cam = camera(az, el);
          const got = hiddenEdges(s, cam.view);
          const want = oracleHidden(s, cam.view);
          expect([...got].sort(), `${name} az=${az} el=${el}`).toEqual([...want].sort());
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
  it('known cases: tetra hides 0, 1 or 3 edges (3/1, 2/2, 1/3 visible faces); box from above-corner hides exactly 3 meeting at one vertex', () => {
    for (let az = -180; az < 180; az += 15) {
      for (const el of [10, 30, 55]) expect([0, 1, 3]).toContain(hiddenEdges(solids.tetra, camera(az, el).view).size);
    }
    const h = hiddenEdges(solids.box, camera(-60, 25).view);
    expect(h.size).toBe(3);
    const counts = new Map<string, number>();
    for (const e of h) for (const v of e.split('|')) counts.set(v, (counts.get(v) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBe(3);
  });
  it('original Bài 2 view has exactly one dashed tetrahedron edge', () => {
    expect(hiddenEdges(tetrahedron(), camera(-62, 16).view).size).toBe(1);
  });
});

describe('3D geometry helpers', () => {
  it('line intersection of coplanar lines (Bài 2: I = AN ∩ CP)', () => {
    const { A, B, C, D } = tetrahedron().verts;
    const lerp = (u: V3, v: V3, t: number): V3 => [u[0] + t * (v[0] - u[0]), u[1] + t * (v[1] - u[1]), u[2] + t * (v[2] - u[2])];
    const N = lerp(C, D, 0.45);
    const P = lerp(A, D, 0.55);
    const I = lineIntersection(A, N, C, P);
    // I lies on both lines
    const onLine = (p: V3, u: V3, v: V3) => Math.hypot(...cross(sub(p, u), sub(v, u))) / Math.hypot(...sub(v, u));
    expect(onLine(I, A, N)).toBeLessThan(1e-9);
    expect(onLine(I, C, P)).toBeLessThan(1e-9);
    // and in plane (ACD)
    const nrm = cross(sub(C, A), sub(D, A));
    expect(Math.abs(dot(nrm, sub(I, A)))).toBeLessThan(1e-9);
    void B;
  });
  it('solidPrims: fits the requested size, centred, and dashes the hidden edge', () => {
    const prims = solidPrims(tetrahedron(), { az: -62, el: 16, size: 200, labels: false });
    const lines = prims.filter((p) => p.t === 'line');
    expect(lines).toHaveLength(6);
    expect(lines.filter((p) => p.dash)).toHaveLength(1);
    const xs = lines.flatMap((p) => (p.t === 'line' ? [p.a[0], p.b[0]] : []));
    const ys = lines.flatMap((p) => (p.t === 'line' ? [p.a[1], p.b[1]] : []));
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    expect(Math.max(w, h)).toBeCloseTo(200);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(0);
  });
});
