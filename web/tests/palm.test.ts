import { describe, expect, it } from 'vitest';
import { smoothPoints } from '../src/canvas/geometry';
import { PALM_WINDOW_MS, PalmGuard } from '../src/canvas/palm';
import { smoothingOptions, strokeOutline } from '../src/canvas/render';
import { snapLineEnd } from '../src/canvas/snap';
import type { Pt, Stroke } from '../src/canvas/types';

function clock() {
  let t = 1000;
  return { now: () => t, tick: (ms: number) => (t += ms) };
}

describe('PalmGuard', () => {
  it('accepts touches when the pen has never been used', () => {
    const c = clock();
    const g = new PalmGuard(c.now);
    expect(g.penActive).toBe(false);
    expect(g.touchDown(1)).toBe(true);
    expect(g.isIgnored(1)).toBe(false);
  });

  it('ignores touches that land while the pen is down, for their whole life', () => {
    const c = clock();
    const g = new PalmGuard(c.now);
    g.pen('down', 7);
    expect(g.touchDown(1)).toBe(false);
    c.tick(5000); // even long after the pen lifts, that palm stays ignored until it leaves the glass
    g.pen('up', 7);
    c.tick(5000);
    expect(g.isIgnored(1)).toBe(true);
    g.touchEnd(1);
    expect(g.isIgnored(1)).toBe(false);
  });

  it('drops a palm that was already resting when the pen lands', () => {
    const c = clock();
    const g = new PalmGuard(c.now);
    expect(g.touchDown(1)).toBe(true);
    expect(g.touchDown(2)).toBe(true);
    const dropped = g.pen('down', 9);
    expect(dropped.sort()).toEqual([1, 2]);
    expect(g.isIgnored(1)).toBe(true);
    expect(g.isIgnored(2)).toBe(true);
    // a second pen-down has nothing left to drop
    expect(g.pen('down', 9)).toEqual([]);
  });

  it('keeps ignoring new touches for a short window after the pen lifts', () => {
    const c = clock();
    const g = new PalmGuard(c.now);
    g.pen('down', 3);
    g.pen('up', 3);
    c.tick(PALM_WINDOW_MS - 50);
    expect(g.touchDown(1)).toBe(false);
    c.tick(PALM_WINDOW_MS + 100);
    expect(g.touchDown(2)).toBe(true);
  });

  it('a hovering pen (iPad Pro hover) also protects the surface', () => {
    const c = clock();
    const g = new PalmGuard(c.now);
    g.pen('hover', 3);
    c.tick(200);
    g.pen('hover', 3);
    c.tick(300);
    expect(g.touchDown(1)).toBe(false); // last hover 300 ms ago
    c.tick(600);
    expect(g.touchDown(2)).toBe(true);
  });

  it('two pens at once: the surface stays protected until both are up', () => {
    const c = clock();
    const g = new PalmGuard(c.now);
    g.pen('down', 1);
    g.pen('down', 2);
    g.pen('up', 1);
    c.tick(PALM_WINDOW_MS * 3);
    expect(g.penActive).toBe(true);
    g.pen('up', 2);
    c.tick(PALM_WINDOW_MS + 1);
    expect(g.penActive).toBe(false);
  });
});

describe('hold-to-straighten', () => {
  it('snaps to horizontal / vertical / 45° within 3°, keeps the length', () => {
    const a = { x: 10, y: 10 };
    const h = snapLineEnd(a, { x: 210, y: 14 }); // ~1.1°
    expect(h.y).toBeCloseTo(10);
    expect(h.x - 10).toBeCloseTo(Math.hypot(200, 4));
    const v = snapLineEnd(a, { x: 12, y: 300 });
    expect(v.x).toBeCloseTo(10);
    const d = snapLineEnd(a, { x: 110, y: 112 });
    expect(d.x - 10).toBeCloseTo(d.y - 10);
  });
  it('leaves other angles untouched and tolerates a zero-length line', () => {
    const b = { x: 200, y: 60 }; // ~17°
    expect(snapLineEnd({ x: 0, y: 0 }, b)).toEqual(b);
    expect(snapLineEnd({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });
});

describe('stroke smoothing', () => {
  const noisy: Pt[] = Array.from({ length: 60 }, (_, i) => ({ x: i * 5, y: 100 + ((i * 7919) % 13) - 6, p: 0.5 }));
  const roughness = (pts: Pt[]) => pts.slice(2).reduce((s, p, i) => s + (p.y - 2 * pts[i + 1].y + pts[i].y) ** 2, 0);

  it('keeps the endpoints and the point count, and reduces jitter with more passes', () => {
    const one = smoothPoints(noisy, 1), three = smoothPoints(noisy, 3);
    for (const s of [one, three]) {
      expect(s).toHaveLength(noisy.length);
      expect(s[0]).toEqual(noisy[0]);
      expect(s[s.length - 1]).toEqual(noisy[noisy.length - 1]);
    }
    expect(roughness(one)).toBeLessThan(roughness(noisy));
    expect(roughness(three)).toBeLessThan(roughness(one));
    expect(smoothPoints(noisy, 0)).toBe(noisy);
    expect(smoothPoints(noisy.slice(0, 2), 3)).toHaveLength(2);
  });
  it('a straight line is not changed by smoothing', () => {
    const line: Pt[] = Array.from({ length: 20 }, (_, i) => ({ x: i * 4, y: i * 2, p: 0.5 }));
    const s = smoothPoints(line, 3);
    s.forEach((p, i) => {
      expect(p.x).toBeCloseTo(line[i].x);
      expect(p.y).toBeCloseTo(line[i].y);
    });
  });
  it('maps the setting to stabiliser strength, with 0.4 reproducing the original look', () => {
    expect(smoothingOptions(0.4).smoothing).toBeCloseTo(0.6);
    expect(smoothingOptions(0.4).streamline).toBeCloseTo(0.38);
    expect(smoothingOptions(0).streamline).toBeLessThan(smoothingOptions(1).streamline);
    expect(smoothingOptions().streamline).toBeCloseTo(smoothingOptions(0.4).streamline); // strokes saved before the setting existed
  });
  it('a stronger setting yields a smoother outline for the same input', () => {
    const mk = (smooth: number): Stroke => ({ type: 'stroke', id: 's', seq: 1, color: '#000', size: 3, kind: 'pen', pen: true, smooth, pts: noisy });
    const wiggle = (o: number[][]) => o.slice(2).reduce((s, p, i) => s + Math.abs(p[1] - 2 * o[i + 1][1] + o[i][1]), 0);
    expect(wiggle(strokeOutline(mk(1)))).toBeLessThan(wiggle(strokeOutline(mk(0))));
  });
});
