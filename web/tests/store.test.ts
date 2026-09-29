import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uid } from '../src/canvas/id';
import { useBoard } from '../src/canvas/store';
import type { Item, Obj, Stroke } from '../src/canvas/types';
import { normalizeSnapshot } from '../src/storage/persist';

const stroke = (id: string, seq: number, extra: Partial<Stroke> = {}): Stroke => ({
  type: 'stroke', id, seq, color: '#111318', size: 3, kind: 'pen', pen: true,
  pts: [{ x: 0, y: 0, p: 0.5 }, { x: 10, y: 10, p: 0.5 }], ...extra,
});
const obj = (id: string, seq: number): Obj => ({
  type: 'obj', id, seq, prims: [{ t: 'line', a: [0, 0], b: [10, 0] }], x: 0, y: 0, rot: 0, scale: 1, color: '#111318', lw: 2,
});
const reset = () => useBoard.getState().load({ items: [], background: 'grid', viewport: { x: 0, y: 0, scale: 1 }, seq: 0 });
const S = () => useBoard.getState();

beforeEach(() => {
  reset();
  useBoard.setState({ tool: 'pen', color: '#111318', size: 3, dash: false, selection: [] });
});

describe('history', () => {
  it('add / undo / redo / erase / delete', () => {
    S().addItems([stroke('a', 1)]);
    S().addItems([obj('b', 2)]);
    expect(S().items.map((i) => i.id)).toEqual(['a', 'b']);
    S().undo();
    expect(S().items.map((i) => i.id)).toEqual(['a']);
    S().redo();
    expect(S().items.map((i) => i.id)).toEqual(['a', 'b']);
    S().removeLive(['a']);
    S().commitErase();
    expect(S().items.map((i) => i.id)).toEqual(['b']);
    S().undo();
    expect(S().items.map((i) => i.id)).toEqual(['a', 'b']); // restored in original order
    S().select(['a', 'b']);
    S().deleteSelected();
    expect(S().items).toHaveLength(0);
    S().undo();
    expect(S().items).toHaveLength(2);
    expect(S().selection).toEqual(['a', 'b'].filter((id) => S().selection.includes(id)));
  });

  it('a new action clears the redo stack', () => {
    S().addItems([stroke('a', 1)]);
    S().undo();
    expect(S().redoStack).toHaveLength(1);
    S().addItems([stroke('b', 2)]);
    expect(S().redoStack).toHaveLength(0);
  });

  it('move edit is one undo step and a tap (no change) adds nothing', () => {
    S().addItems([obj('a', 1)], true);
    const n = S().undoStack.length;
    S().beginEdit();
    S().endEdit(); // tap without moving
    expect(S().undoStack.length).toBe(n);
    S().beginEdit();
    S().applyEdit((it) => (it.type === 'obj' ? { ...it, x: it.x + 5 } : it));
    S().applyEdit((it) => (it.type === 'obj' ? { ...it, x: it.x + 9 } : it)); // always relative to the original
    S().endEdit();
    expect(S().undoStack.length).toBe(n + 1);
    expect((S().items[0] as Obj).x).toBe(9);
    S().undo();
    expect((S().items[0] as Obj).x).toBe(0);
  });

  it('duplicate creates offset copies with fresh ids and selects them', () => {
    S().addItems([obj('a', 1)], true);
    S().duplicateSelected();
    expect(S().items).toHaveLength(2);
    const copy = S().items[1] as Obj;
    expect(copy.id).not.toBe('a');
    expect(copy.x).toBe(24);
    expect(S().selection).toEqual([copy.id]);
    S().undo();
    expect(S().items).toHaveLength(1);
  });
});

describe('style edits', () => {
  it('choosing a colour while erasing switches back to the pen', () => {
    S().setTool('eraser');
    S().setColor('#1f6feb');
    expect(S().tool).toBe('pen');
    expect(S().color).toBe('#1f6feb');
    S().setTool('highlighter');
    S().setColor('#d1242f');
    expect(S().tool).toBe('highlighter');
  });

  it('size slider keeps highlighter strokes wide and pens exact', () => {
    S().addItems([stroke('p', 1), stroke('h', 2, { kind: 'highlighter', size: 20 })]);
    S().setTool('select');
    S().select(['p', 'h']);
    S().setSize(2);
    const [p, h] = S().items as Stroke[];
    expect(p.size).toBe(2);
    expect(h.size).toBe(14); // max(2*5, 14)
    S().setSize(6);
    expect((S().items[1] as Stroke).size).toBe(30);
  });

  it('no-op patches leave history and redo untouched', () => {
    S().addItems([stroke('a', 1)], true);
    S().undo();
    S().redo();
    S().undo();
    expect(S().redoStack).toHaveLength(1);
    S().addItems([stroke('b', 2)], true); // clears redo, selects b
    S().undo();
    S().redo();
    S().undo();
    const undoLen = S().undoStack.length;
    const redoLen = S().redoStack.length;
    S().select(['a']);
    S().setDash(true); // strokes have no dash: nothing changes
    S().setColor('#111318'); // same colour: nothing changes
    expect(S().undoStack.length).toBe(undoLen);
    expect(S().redoStack.length).toBe(redoLen);
  });

  it('rapid recolours of the same item merge into one undo step', () => {
    S().addItems([stroke('a', 1)], true);
    const n = S().undoStack.length;
    S().setColor('#1f6feb');
    S().setColor('#d1242f');
    expect(S().undoStack.length).toBe(n + 1);
    S().undo();
    expect((S().items[0] as Stroke).color).toBe('#111318');
  });

  it('does not merge across different selections', () => {
    S().addItems([stroke('a', 1), stroke('b', 2)]);
    S().select(['a']);
    S().setColor('#1f6feb');
    S().select(['a', 'b']);
    S().setColor('#d1242f');
    S().undo();
    const [a, b] = S().items as Stroke[];
    expect(b.color).toBe('#111318'); // B is back to its original colour
    expect(a.color).toBe('#1f6feb'); // A keeps the first recolour
  });

  it('does not merge a recolour into the preceding move', () => {
    S().addItems([obj('a', 1)], true);
    S().beginEdit();
    S().applyEdit((it) => (it.type === 'obj' ? { ...it, x: 50 } : it));
    S().endEdit();
    S().setColor('#1f6feb');
    S().undo();
    const o = S().items[0] as Obj;
    expect(o.color).toBe('#111318');
    expect(o.x).toBe(50); // the move survived: only the recolour was undone
  });
});

describe('snapshots and ids', () => {
  it('migrates legacy snapshots (strokes without a type) and computes seq without spread limits', () => {
    const legacy = { strokes: [{ id: 'x', seq: 7, pts: [], color: '#000', size: 3, kind: 'pen', pen: true }], background: 'dots' };
    const snap = normalizeSnapshot(legacy)!;
    expect(snap.items[0].type).toBe('stroke');
    expect(snap.seq).toBe(7);
    expect(snap.background).toBe('dots');
    const big = { items: Array.from({ length: 200_000 }, (_, i) => ({ type: 'stroke', id: String(i), seq: i, pts: [] })) };
    expect(normalizeSnapshot(big)!.seq).toBe(199_999);
    expect(normalizeSnapshot(null)).toBeNull();
    expect(normalizeSnapshot({ items: 'nope' })).toBeNull();
  });

  it('uid works without crypto.randomUUID (plain http on an iPad)', () => {
    const ids = new Set<string>();
    vi.stubGlobal('crypto', undefined);
    for (let i = 0; i < 500; i++) ids.add(uid());
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => { for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256); return b; } });
    for (let i = 0; i < 500; i++) ids.add(uid());
    vi.unstubAllGlobals();
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(uid()).toBeTruthy();
  });

  it('load resets selection and history', () => {
    S().addItems([stroke('a', 1)], true);
    reset();
    expect(S().items).toHaveLength(0);
    expect(S().selection).toHaveLength(0);
    expect(S().undoStack).toHaveLength(0);
  });
});

void ({} as Item);
