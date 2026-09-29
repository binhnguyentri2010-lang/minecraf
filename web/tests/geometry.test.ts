import { describe, expect, it } from 'vitest';
import { distToSegment, strokeHit, transformViewport } from '../src/canvas/geometry';
import type { Stroke } from '../src/canvas/types';

const stroke = (pts: [number, number][], size = 2): Stroke => ({
  id: 's',
  seq: 1,
  color: '#000',
  size,
  kind: 'pen',
  pen: true,
  pts: pts.map(([x, y]) => ({ x, y, p: 0.5 })),
});

describe('geometry', () => {
  it('distance to segment: perpendicular, endpoint, degenerate', () => {
    const a = { x: 0, y: 0, p: 1 };
    const b = { x: 10, y: 0, p: 1 };
    expect(distToSegment(5, 3, a, b)).toBeCloseTo(3);
    expect(distToSegment(13, 4, a, b)).toBeCloseTo(5);
    expect(distToSegment(3, 4, a, a)).toBeCloseTo(5);
  });

  it('eraser hit test respects radius and stroke width', () => {
    const s = stroke([[0, 0], [100, 0]], 4);
    expect(strokeHit(s, 50, 10, 8)).toBe(true);
    expect(strokeHit(s, 50, 15, 8)).toBe(false);
    expect(strokeHit(stroke([[5, 5]]), 6, 5, 1)).toBe(true);
  });

  it('zoom keeps the anchor world point fixed', () => {
    const vp = { x: 30, y: -20, scale: 1.5 };
    const next = transformViewport(vp, 200, 120, 200, 120, 2);
    const before = { x: (200 - vp.x) / vp.scale, y: (120 - vp.y) / vp.scale };
    const after = { x: (200 - next.x) / next.scale, y: (120 - next.y) / next.scale };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(next.scale).toBeCloseTo(3);
  });

  it('pan moves the anchor with the finger', () => {
    const next = transformViewport({ x: 0, y: 0, scale: 1 }, 100, 100, 130, 90, 1);
    expect(next.x).toBe(30);
    expect(next.y).toBe(-10);
  });
});
