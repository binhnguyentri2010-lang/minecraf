import { describe, expect, it } from 'vitest';
import { fitCircle, pathLength, recognize, type XY } from '../src/canvas/snap';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
}

function polyline(corners: XY[], perEdge = 30, jitter = 0, seed = 1, closed = true): XY[] {
  const r = rng(seed);
  const out: XY[] = [];
  const n = closed ? corners.length : corners.length - 1;
  for (let i = 0; i < n; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    for (let s = 0; s < perEdge; s++) {
      const t = s / perEdge;
      out.push({ x: a.x + (b.x - a.x) * t + r() * jitter, y: a.y + (b.y - a.y) * t + r() * jitter });
    }
  }
  out.push(closed ? { ...out[0] } : { ...corners[corners.length - 1] });
  return out;
}

function circlePts(cx: number, cy: number, rx: number, ry: number, jitter = 0, seed = 2, start = 0, rot = 0): XY[] {
  const r = rng(seed);
  const pts: XY[] = [];
  for (let i = 0; i <= 90; i++) {
    const t = start + (i / 90) * Math.PI * 2 * 1.02; // slight overshoot like a hand-drawn loop
    const u = rx * Math.cos(t) + r() * jitter;
    const v = ry * Math.sin(t) + r() * jitter;
    pts.push({ x: cx + u * Math.cos(rot) - v * Math.sin(rot), y: cy + u * Math.sin(rot) + v * Math.cos(rot) });
  }
  return pts;
}

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

describe('shape recognition', () => {
  it('straight line, even when wobbly', () => {
    const rec = recognize(polyline([{ x: 10, y: 10 }, { x: 310, y: 60 }], 60, 4, 3, false))!;
    expect(rec.kind).toBe('line');
    expect(rec.pts).toHaveLength(2);
    expect(dist(rec.pts[0], { x: 10, y: 10 })).toBeLessThan(5);
    expect(dist(rec.pts[1], { x: 310, y: 60 })).toBeLessThan(5);
  });
  it('curve is not a line', () => {
    const arc = Array.from({ length: 60 }, (_, i) => ({ x: i * 5, y: 60 * Math.sin((i / 59) * Math.PI) }));
    expect(recognize(arc)).toBeNull();
  });
  it('circle (noisy, any start angle)', () => {
    for (const start of [0, 1.3, 4]) {
      const rec = recognize(circlePts(200, 150, 80, 80, 4, 5 + start, start))!;
      expect(rec.kind).toBe('circle');
      const c = rec.pts.reduce((a, p) => ({ x: a.x + p.x / rec.pts.length, y: a.y + p.y / rec.pts.length }), { x: 0, y: 0 });
      expect(dist(c, { x: 200, y: 150 })).toBeLessThan(6);
      expect(Math.abs(dist(rec.pts[0], c) - 80)).toBeLessThan(6);
    }
  });
  it('circle fit is accurate even with 2.5% overshoot and 3% wobble (coarse sampling)', () => {
    const n = 40;
    const pts = Array.from({ length: n + 2 }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + 0.7;
      const j = 1 + 0.03 * Math.sin(i * 1.7);
      return { x: 700 + 90 * j * Math.cos(a), y: 380 + 90 * j * Math.sin(a) };
    });
    const rec = recognize(pts)!;
    expect(rec.kind).toBe('circle');
    const c = rec.pts.slice(0, -1).reduce((a, p) => ({ x: a.x + p.x / (rec.pts.length - 1), y: a.y + p.y / (rec.pts.length - 1) }), { x: 0, y: 0 });
    expect(dist(c, { x: 700, y: 380 })).toBeLessThan(3);
    const r = dist(rec.pts[0], c);
    expect(Math.abs(r - 90)).toBeLessThan(3);
    // all output points equidistant from their own centre
    for (const p of rec.pts) expect(Math.abs(dist(p, c) - r)).toBeLessThan(0.5);
    const f = fitCircle(Array.from({ length: 50 }, (_, i) => ({ x: 10 + 25 * Math.cos(i / 8), y: -4 + 25 * Math.sin(i / 8) })));
    expect(f.c.x).toBeCloseTo(10, 6);
    expect(f.c.y).toBeCloseTo(-4, 6);
    expect(f.r).toBeCloseTo(25, 6);
  });
  it('ellipse, axis-aligned and rotated', () => {
    const a = recognize(circlePts(200, 150, 120, 60, 3, 9))!;
    expect(a.kind).toBe('ellipse');
    const b = recognize(circlePts(200, 150, 120, 55, 3, 11, 0, 0.6))!;
    expect(b.kind).toBe('ellipse');
  });
  it('rectangle becomes an exact rectangle with right angles', () => {
    const rec = recognize(polyline([{ x: 20, y: 20 }, { x: 260, y: 26 }, { x: 255, y: 160 }, { x: 15, y: 152 }], 30, 3, 4))!;
    expect(rec.kind).toBe('rectangle');
    const p = rec.pts;
    const corners = [p[0], p.find((q, i) => i > 0 && dist(q, p[0]) > 100 && Math.abs(q.y - p[0].y) < 1e-6)!];
    expect(corners[1]).toBeTruthy();
    // all points lie on an axis-aligned rectangle boundary
    const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (const q of p) {
      const onEdge = Math.abs(q.x - x0) < 1e-6 || Math.abs(q.x - x1) < 1e-6 || Math.abs(q.y - y0) < 1e-6 || Math.abs(q.y - y1) < 1e-6;
      expect(onEdge).toBe(true);
    }
    expect(x1 - x0).toBeGreaterThan(200);
    expect(y1 - y0).toBeGreaterThan(110);
    expect(dist(p[0], p[p.length - 1])).toBeLessThan(1e-6);
  });
  it('square stays square', () => {
    const rec = recognize(polyline([{ x: 0, y: 0 }, { x: 120, y: 2 }, { x: 122, y: 121 }, { x: 1, y: 119 }], 30, 2, 8))!;
    expect(rec.kind).toBe('rectangle');
    const xs = rec.pts.map((q) => q.x), ys = rec.pts.map((q) => q.y);
    expect(Math.abs(Math.max(...xs) - Math.min(...xs) - (Math.max(...ys) - Math.min(...ys)))).toBeLessThan(1e-6);
  });
  it('triangle keeps three vertices', () => {
    const rec = recognize(polyline([{ x: 100, y: 10 }, { x: 200, y: 180 }, { x: 0, y: 170 }], 40, 3, 6))!;
    expect(rec.kind).toBe('polygon');
    const verts = [{ x: 100, y: 10 }, { x: 200, y: 180 }, { x: 0, y: 170 }];
    for (const v of verts) expect(Math.min(...rec.pts.map((q) => dist(q, v)))).toBeLessThan(12);
  });
  it('scribbles and dots are ignored', () => {
    const r = rng(42);
    const scribble = Array.from({ length: 80 }, () => ({ x: 100 + r() * 200, y: 100 + r() * 200 }));
    expect(recognize(scribble)).toBeNull();
    expect(recognize([{ x: 5, y: 5 }, { x: 6, y: 5 }])).toBeNull();
    expect(recognize(Array.from({ length: 20 }, (_, i) => ({ x: i * 0.5, y: 0 })))).toBeNull();
  });
  it('resampling preserves length', () => {
    const pts = polyline([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, 0, 1, false);
    expect(pathLength(pts)).toBeCloseTo(100);
  });
});
