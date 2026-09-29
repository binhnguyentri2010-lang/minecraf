import { describe, expect, it } from 'vitest';
import type { Prim, V } from '../src/canvas/types';
import { primBounds } from '../src/canvas/objects';
import { graphPolys } from '../src/shapes/coord';
import { QUADS, TRIANGLES, bisectorFoot, footOnLine, regularPolygon, triangleCenters } from '../src/shapes/plane';
import { GROUPS, SHAPES, defaultParams, generate, normalizeParams, shapeById } from '../src/shapes/registry';
import { bai2Points, conePrims, cylinderPrims } from '../src/shapes/solids';
import { KEY_ANGLES, radianTex, unitCirclePrims } from '../src/shapes/trig';
import { dist2, lineIntersect2 } from '../src/shapes/util';

const finite = (p: Prim): boolean => {
  const nums: number[] = [];
  switch (p.t) {
    case 'line':
    case 'arrow':
      nums.push(...p.a, ...p.b);
      break;
    case 'poly':
      p.pts.forEach((q) => nums.push(...q));
      break;
    case 'ellipse':
      nums.push(...p.o, p.rx, p.ry, p.a0 ?? 0, p.a1 ?? 0);
      break;
    case 'dot':
      nums.push(...p.o);
      break;
    case 'text':
      nums.push(...p.o);
  }
  return nums.every(Number.isFinite);
};

describe('registry', () => {
  it('has unique ids, valid groups, and the expected breadth', () => {
    const ids = SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(GROUPS.map((g) => g.id));
    for (const s of SHAPES) expect(groups.has(s.group), s.id).toBe(true);
    for (const g of GROUPS) expect(SHAPES.some((s) => s.group === g.id), g.id).toBe(true);
    expect(SHAPES.length).toBeGreaterThanOrEqual(60);
    for (const need of ['tetra', 'pyr4-square', 'box', 'cylinder', 'cone', 'sphere', 'unit-circle', 'bai2-a', 'bai2-b', 'bai2-c', 'fn-quadratic', 'conic-ellipse', 'venn3'])
      expect(shapeById(need), need).toBeTruthy();
  });

  it('every shape generates finite, non-empty, bounded geometry at default / min / max params', () => {
    for (const s of SHAPES) {
      const variants = [defaultParams(s)];
      for (const pick of ['min', 'max'] as const) {
        variants.push(Object.fromEntries(s.params.map((p) => [p.key, p.type === 'range' ? (pick === 'min' ? p.min! : p.max!) : p.type === 'toggle' ? (pick === 'min' ? 0 : 1) : p.def])));
      }
      for (const v of variants) {
        const prims = generate(s, v);
        expect(prims.length, s.id).toBeGreaterThan(0);
        for (const q of prims) expect(finite(q), `${s.id} ${JSON.stringify(v)}`).toBe(true);
        for (const q of prims) {
          const b = primBounds(q);
          expect(Math.max(Math.abs(b.minX), Math.abs(b.maxX), Math.abs(b.minY), Math.abs(b.maxY)), s.id).toBeLessThan(2500);
        }
      }
    }
  });

  it('is deterministic and clamps out-of-range params', () => {
    const s = shapeById('polygon-regular')!;
    expect(JSON.stringify(generate(s, { n: 6 }))).toBe(JSON.stringify(generate(s, { n: 6 })));
    expect(normalizeParams(s, { n: 99 }).n).toBe(12);
    expect(normalizeParams(s, { n: -5 }).n).toBe(3);
    expect(normalizeParams(s, { n: 'abc' }).n).toBe(5);
  });

  it('polygon-regular draws n edges', () => {
    for (const n of [3, 5, 8, 12]) {
      const prims = generate(shapeById('polygon-regular')!, { n });
      const poly = prims.find((p) => p.t === 'poly')!;
      expect(poly.t === 'poly' && poly.pts.length).toBe(n);
    }
  });
});

describe('plane geometry is mathematically correct', () => {
  it('triangle centres', () => {
    const t = TRIANGLES.scalene;
    const c = triangleCenters(t);
    // circumcentre equidistant from vertices
    const R = c.circumradius;
    for (const v of [t.A, t.B, t.C]) expect(dist2(v, c.circumcenter)).toBeCloseTo(R, 9);
    // incentre equidistant (= inradius) from the three side lines
    const side = (P: V, L1: V, L2: V) => dist2(P, footOnLine(P, L1, L2));
    for (const [a, b] of [[t.A, t.B], [t.B, t.C], [t.C, t.A]] as [V, V][]) expect(side(c.incenter, a, b)).toBeCloseTo(c.inradius, 9);
    // orthocentre: AH ⟂ BC and BH ⟂ AC
    const dot = (u: V, v: V) => u[0] * v[0] + u[1] * v[1];
    const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
    expect(dot(sub(c.orthocenter, t.A), sub(t.B, t.C))).toBeCloseTo(0, 9);
    expect(dot(sub(c.orthocenter, t.B), sub(t.A, t.C))).toBeCloseTo(0, 9);
    // Euler line: G = (2/3)·median-avg → G divides OH as 1:2
    for (let k = 0; k < 2; k++) expect(c.centroid[k]).toBeCloseTo((2 * c.circumcenter[k] + c.orthocenter[k]) / 3, 9);
  });

  it('altitude foot lies on BC; bisector splits BC in ratio AB:AC', () => {
    const t = TRIANGLES.scalene;
    const H = footOnLine(t.A, t.B, t.C);
    expect(H[1]).toBeCloseTo(0);
    const D = bisectorFoot(t);
    expect(dist2(t.B, D) / dist2(D, t.C)).toBeCloseTo(dist2(t.A, t.B) / dist2(t.A, t.C), 9);
    // angle equality: ∠BAD = ∠DAC
    const ang = (P: V, Q: V, Rr: V) => {
      const u = [Q[0] - P[0], Q[1] - P[1]], v = [Rr[0] - P[0], Rr[1] - P[1]];
      return Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])));
    };
    expect(ang(t.A, t.B, D)).toBeCloseTo(ang(t.A, D, t.C), 9);
  });

  it('special triangles', () => {
    const r = TRIANGLES.right;
    expect(dist2(r.A, r.B) ** 2 + dist2(r.A, r.C) ** 2).toBeCloseTo(dist2(r.B, r.C) ** 2);
    const e = TRIANGLES.equilateral;
    expect(dist2(e.A, e.B)).toBeCloseTo(dist2(e.B, e.C));
    expect(dist2(e.A, e.C)).toBeCloseTo(dist2(e.B, e.C));
    const i = TRIANGLES.isosceles;
    expect(dist2(i.A, i.B)).toBeCloseTo(dist2(i.A, i.C));
  });

  it('quadrilaterals have the right defining properties', () => {
    const len = (q: V[], i: number) => dist2(q[i], q[(i + 1) % 4]);
    const vec = (q: V[], i: number): V => [q[(i + 1) % 4][0] - q[i][0], q[(i + 1) % 4][1] - q[i][1]];
    const cross = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
    const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
    const sq = QUADS.square;
    for (let i = 0; i < 4; i++) {
      expect(len(sq, i)).toBeCloseTo(len(sq, 0));
      expect(dot(vec(sq, i), vec(sq, (i + 1) % 4))).toBeCloseTo(0);
    }
    const rc = QUADS.rectangle;
    expect(len(rc, 0)).toBeCloseTo(len(rc, 2));
    expect(len(rc, 1)).toBeCloseTo(len(rc, 3));
    for (let i = 0; i < 4; i++) expect(dot(vec(rc, i), vec(rc, (i + 1) % 4))).toBeCloseTo(0);
    const pg = QUADS.parallelogram;
    expect(cross(vec(pg, 0), vec(pg, 2))).toBeCloseTo(0);
    expect(cross(vec(pg, 1), vec(pg, 3))).toBeCloseTo(0);
    expect(len(pg, 0)).toBeCloseTo(len(pg, 2));
    const rh = QUADS.rhombus;
    for (let i = 1; i < 4; i++) expect(len(rh, i)).toBeCloseTo(len(rh, 0));
    // rhombus diagonals are perpendicular
    expect(dot([rh[2][0] - rh[0][0], rh[2][1] - rh[0][1]], [rh[3][0] - rh[1][0], rh[3][1] - rh[1][1]])).toBeCloseTo(0);
    const tz = QUADS.trapezoid;
    expect(cross(vec(tz, 0), vec(tz, 2))).toBeCloseTo(0);
    expect(Math.abs(cross(vec(tz, 1), vec(tz, 3)))).toBeGreaterThan(0.5);
    const it = QUADS.isoTrapezoid;
    expect(cross(vec(it, 0), vec(it, 2))).toBeCloseTo(0);
    expect(len(it, 1)).toBeCloseTo(len(it, 3));
  });

  it('regular polygon: equal sides and circumradius', () => {
    for (const n of [3, 5, 6, 9]) {
      const pts = regularPolygon(n, 3.2);
      for (let i = 0; i < n; i++) {
        expect(dist2(pts[i], [0, 0])).toBeCloseTo(3.2);
        expect(dist2(pts[i], pts[(i + 1) % n])).toBeCloseTo(2 * 3.2 * Math.sin(Math.PI / n));
      }
    }
  });

  it('diagonals intersect at the parallelogram centre', () => {
    const q = QUADS.parallelogram;
    const O = lineIntersect2(q[0], q[2], q[1], q[3]);
    expect(O[0]).toBeCloseTo((q[0][0] + q[2][0]) / 2);
    expect(O[1]).toBeCloseTo((q[0][1] + q[2][1]) / 2);
  });
});

describe('triangle construction sheets', () => {
  it('perpendicular bisector: vertical line through the midpoint of BC, reaching above the triangle', () => {
    const prims = generate(shapeById('tri-perp')!, {});
    const red = prims.find((p) => p.t === 'line' && p.c === '#dc2626');
    if (!red || red.t !== 'line') throw new Error('no bisector');
    expect(red.a[0]).toBeCloseTo(3 * 34);
    expect(red.b[0]).toBeCloseTo(3 * 34);
    expect(red.a[1]).toBeGreaterThan(0); // slightly below BC (canvas y grows down)
    expect(red.b[1]).toBeLessThan(-4 * 34); // above the apex height (4.4)
  });
  it('altitude sheet: AH is perpendicular to BC and H lies on BC', () => {
    const prims = generate(shapeById('tri-altitude')!, {});
    const ah = prims.find((p) => p.t === 'line' && p.c === '#dc2626');
    if (!ah || ah.t !== 'line') throw new Error('no altitude');
    expect(ah.b[1]).toBeCloseTo(0); // foot on BC (y = 0)
    expect(ah.a[0]).toBeCloseTo(ah.b[0]); // vertical, BC is horizontal
  });
});

describe('graphs', () => {
  it('1/x never connects across the asymptote', () => {
    const segs = graphPolys((x) => 1 / x, -6, 6, 6);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    for (const s of segs) expect(s.every((p) => p[0] > 0) || s.every((p) => p[0] < 0)).toBe(true);
  });
  it('tan x is split at each asymptote and stays inside the y range', () => {
    const segs = graphPolys(Math.tan, -7, 7, 6);
    expect(segs.length).toBeGreaterThanOrEqual(4);
    for (const s of segs) for (const p of s) expect(Math.abs(p[1])).toBeLessThanOrEqual(6 * 40 + 1e-9);
  });
  it('sqrt has no points for x<0; parabola vertex is where expected', () => {
    const sq = graphPolys(Math.sqrt, -6, 6, 6);
    expect(sq.flat().every((p) => p[0] >= 0)).toBe(true);
    const par = graphPolys((x) => x * x - 2 * x - 1, -6, 6, 6).flat();
    const low = par.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(low[0] / 40).toBeCloseTo(1, 1);
    expect(-low[1] / 40).toBeCloseTo(-2, 1);
  });
  it('fn-custom reports errors as text instead of throwing', () => {
    const s = shapeById('fn-custom')!;
    const prims = generate(s, { expr: 'foo(' });
    expect(prims.some((p) => p.t === 'text' && p.c === '#dc2626')).toBe(true);
    expect(generate(s, { expr: 'sin(x)' }).some((p) => p.t === 'poly' && p.c === '#2563eb')).toBe(true);
  });
});

describe('trigonometry', () => {
  it('radian labels for special angles', () => {
    const map = Object.fromEntries(KEY_ANGLES.map(([d, f]) => [d, radianTex(f)]));
    expect(map[0]).toBe('0');
    expect(map[30]).toBe('\\frac{\\pi}{6}');
    expect(map[180]).toBe('\\pi');
    expect(map[270]).toBe('\\frac{3\\pi}{2}');
    expect(map[330]).toBe('\\frac{11\\pi}{6}');
    for (const [d, [n, k]] of KEY_ANGLES) expect((n * 180) / k).toBeCloseTo(d);
  });
  it('unit circle point and value text match sin/cos/tan', () => {
    const prims = unitCirclePrims(30, true);
    const M = prims.find((p) => p.t === 'dot' && p.r === 4);
    expect(M && M.t === 'dot' && M.o[0]).toBeCloseTo(110 * Math.cos(Math.PI / 6));
    expect(M && M.t === 'dot' && M.o[1]).toBeCloseTo(-110 * 0.5);
    const texts = prims.filter((p) => p.t === 'text').map((p) => (p.t === 'text' ? p.s : ''));
    expect(texts.some((s) => s.includes('\\sin\\alpha=0.5') && s.includes('\\cos\\alpha=0.87'))).toBe(true);
    expect(texts.some((s) => s.includes('\\tan\\alpha=0.58'))).toBe(true);
    const at90 = unitCirclePrims(90, true).filter((p) => p.t === 'text').map((p) => (p.t === 'text' ? p.s : ''));
    expect(at90.some((s) => s.includes('không xác định'))).toBe(true);
  });
});

describe('solids', () => {
  it('Bài 2: I and J are the intersections used by the solution', () => {
    const { A, B, C, D, N, P, M, I, J } = bai2Points();
    const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
    const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
    // I ∈ (ACD) ; J ∈ (ABD)
    expect(Math.abs(dot(cross(sub(C, A), sub(D, A)), sub(I, A)))).toBeLessThan(1e-9);
    expect(Math.abs(dot(cross(sub(B, A), sub(D, A)), sub(J, A)))).toBeLessThan(1e-9);
    // I collinear with A,N and with C,P ; J with D,M and B,P
    for (const [X, U, W] of [[I, A, N], [I, C, P], [J, D, M], [J, B, P]] as number[][][])
      expect(Math.hypot(...cross(sub(X, U), sub(W, U)))).toBeLessThan(1e-9);
  });
  it('Bài 2 sheets: 6 tetra edges (1 dashed), red intersection line, labelled points', () => {
    for (const [id, pts] of [['bai2-a', ['M', 'N']], ['bai2-b', ['I', 'N', 'P']], ['bai2-c', ['J', 'M', 'P']]] as [string, string[]][]) {
      const prims = generate(shapeById(id)!, {});
      const labels = prims.filter((p) => p.t === 'text').map((p) => (p.t === 'text' ? p.s : ''));
      for (const n of ['A', 'B', 'C', 'D', ...pts]) expect(labels, `${id} ${n}`).toContain(n);
      const red = prims.filter((p) => p.t === 'line' && p.c === '#dc2626');
      expect(red, id).toHaveLength(1);
      const plain = prims.filter((p) => p.t === 'line' && p.c === undefined);
      expect(plain).toHaveLength(6);
      expect(plain.filter((p) => p.t === 'line' && p.dash)).toHaveLength(1);
    }
  });
  it('cylinder / cone: hidden half of the base is dashed, silhouette lines touch the ellipse', () => {
    const cyl = cylinderPrims(22, true);
    expect(cyl.filter((p) => p.t === 'ellipse' && p.dash)).toHaveLength(1);
    const cone = conePrims(22, true);
    const lines = cone.filter((p) => p.t === 'line' && !p.dash);
    expect(lines).toHaveLength(2);
    // tangent point (xt, yt) must lie on the base ellipse and the line apex→T must be tangent there
    const R = 70, H = 170, ry = R * Math.sin((22 * Math.PI) / 180);
    const l = lines[0];
    if (l.t !== 'line') throw new Error();
    const [tx, ty] = l.b;
    expect((tx / R) ** 2 + ((ty - H / 2) / ry) ** 2).toBeCloseTo(1, 9);
    // tangency: gradient of the ellipse at T is perpendicular to the line direction
    const gx = (2 * tx) / R ** 2, gy = (2 * (ty - H / 2)) / ry ** 2;
    const dx = tx - l.a[0], dy = ty - l.a[1];
    expect(Math.abs(gx * dx + gy * dy) / (Math.hypot(gx, gy) * Math.hypot(dx, dy))).toBeLessThan(1e-9);
  });
});
