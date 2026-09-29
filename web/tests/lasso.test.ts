import { beforeEach, describe, expect, it } from 'vitest';
import { itemsInLasso } from '../src/canvas/lasso';
import { useBoard } from '../src/canvas/store';
import type { Obj, Stroke, V } from '../src/canvas/types';

const stroke = (id: string, x0: number, y0: number, x1: number, y1: number, n = 10): Stroke => ({
  type: 'stroke', id, seq: 1, color: '#111318', size: 3, kind: 'pen', pen: true,
  pts: Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (n - 1), y: y0 + ((y1 - y0) * i) / (n - 1), p: 0.5 })),
});
const box = (id: string, x: number, y: number): Obj => ({
  type: 'obj', id, seq: 2, prims: [{ t: 'poly', pts: [[0, 0], [100, 0], [100, 100], [0, 100]], closed: true }], x, y, rot: 0, scale: 1, color: '#000', lw: 2,
});
const loop = (cx: number, cy: number, r: number, n = 24): V[] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)]);

describe('lasso selection', () => {
  const items = [stroke('inside', 90, 90, 110, 110), stroke('outside', 400, 400, 450, 450), stroke('half', 90, 100, 500, 100), box('obj-in', 60, 60), box('obj-out', 500, 500)];
  it('selects what is inside the loop and nothing outside', () => {
    const ids = itemsInLasso(items, loop(100, 100, 90));
    expect(ids).toContain('inside');
    expect(ids).toContain('obj-in');
    expect(ids).not.toContain('outside');
    expect(ids).not.toContain('obj-out');
  });
  it('a stroke needs at least half of its points inside', () => {
    expect(itemsInLasso(items, loop(100, 100, 90))).not.toContain('half'); // only its first ~10% is inside
    expect(itemsInLasso(items, loop(300, 100, 250))).toContain('half');
  });
  it('an object needs most of its box inside', () => {
    expect(itemsInLasso([box('b', 0, 0)], [[-10, -10], [40, -10], [40, 110], [-10, 110]])).toEqual([]); // only ~half of the columns
    expect(itemsInLasso([box('b', 0, 0)], [[-10, -10], [80, -10], [80, 110], [-10, 110]])).toEqual(['b']);
  });
  it('degenerate loops select nothing', () => {
    expect(itemsInLasso(items, [])).toEqual([]);
    expect(itemsInLasso(items, [[0, 0], [10, 10]])).toEqual([]);
  });
  it('works for concave (C-shaped) loops', () => {
    const c: V[] = [[0, 0], [200, 0], [200, 60], [60, 60], [60, 140], [200, 140], [200, 200], [0, 200]];
    const ids = itemsInLasso([stroke('in-arm', 10, 10, 180, 30), stroke('in-notch', 100, 100, 180, 100)], c);
    expect(ids).toEqual(['in-arm']);
  });
});

describe('clipboard', () => {
  beforeEach(() => {
    useBoard.getState().load({ items: [], background: 'grid', viewport: { x: 0, y: 0, scale: 1 }, seq: 0 });
    useBoard.setState({ clipboard: [], tool: 'lasso' });
  });
  it('copy keeps the originals, paste adds cascading offset copies and selects them', () => {
    const s = () => useBoard.getState();
    s().addItems([stroke('a', 0, 0, 10, 10)], true);
    s().copySelected();
    expect(s().items).toHaveLength(1);
    s().paste();
    s().paste();
    expect(s().items).toHaveLength(3);
    const xs = s().items.map((i) => (i.type === 'stroke' ? i.pts[0].x : 0));
    expect(xs).toEqual([0, 24, 48]);
    expect(new Set(s().items.map((i) => i.id)).size).toBe(3);
    expect(s().selection).toHaveLength(1);
    s().undo();
    expect(s().items).toHaveLength(2);
  });
  it('cut removes, and paste brings it back; lasso tool keeps the selection', () => {
    const s = () => useBoard.getState();
    s().addItems([stroke('a', 0, 0, 10, 10)], true);
    s().setTool('lasso');
    expect(s().selection).toEqual(['a']);
    s().cutSelected();
    expect(s().items).toHaveLength(0);
    s().paste();
    expect(s().items).toHaveLength(1);
    s().setTool('pen');
    expect(s().selection).toEqual([]);
  });
  it('paste with an empty clipboard does nothing', () => {
    useBoard.getState().paste();
    expect(useBoard.getState().items).toHaveLength(0);
  });
});
