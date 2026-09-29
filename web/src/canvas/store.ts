import { create } from 'zustand';
import { uid } from './id';
import type { Aid, Background, Item, Tool, Viewport } from './types';

type Entry =
  | { type: 'add' | 'remove'; items: Item[] }
  | { type: 'update'; before: Item[]; after: Item[] };

function readPref<T extends boolean | number>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`bt-${key}`);
    if (raw === null) return fallback;
    const v = JSON.parse(raw);
    return typeof v === typeof fallback ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, v: boolean | number) {
  try {
    localStorage.setItem(`bt-${key}`, JSON.stringify(v));
  } catch {
    /* private mode: keep in memory only */
  }
}
/** touch-first devices (iPad/phone) start with palm-safe "Pencil only" */
function coarsePointer(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export const COLORS = ['#111318', '#1f6feb', '#d1242f', '#f2c200', '#1a7f37', '#e16f24', '#8250df', '#db2777'];

export interface Snapshot {
  items: Item[];
  background: Background;
  viewport: Viewport;
  seq: number;
}

export interface BoardMeta {
  id: string;
  name: string;
  updated: number;
  fav?: boolean;
}

interface BoardState {
  items: Item[];
  selection: string[];
  undoStack: Entry[];
  redoStack: Entry[];
  tool: Tool;
  color: string;
  size: number;
  dash: boolean;
  snap: boolean;
  background: Background;
  pencilOnly: boolean;
  palette: string[];
  addColor: (c: string) => void;
  smooth: number;
  viewport: Viewport;
  seq: number;
  ruler: Aid | null;
  protractor: Aid | null;
  boards: BoardMeta[];
  boardId: string;
  clipboard: Item[];
  busy: boolean;

  nextSeq: () => number;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setSize: (n: number) => void;
  setDash: (v: boolean) => void;
  setSnap: (v: boolean) => void;
  setBackground: (b: Background) => void;
  setPencilOnly: (v: boolean) => void;
  setSmooth: (v: number) => void;
  setViewport: (v: Viewport) => void;
  setRuler: (a: Aid | null) => void;
  setProtractor: (a: Aid | null) => void;

  addItems: (items: Item[], select?: boolean) => void;
  removeLive: (ids: string[]) => void;
  commitErase: () => void;
  select: (ids: string[]) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  paste: () => void;
  beginEdit: () => void;
  applyEdit: (fn: (it: Item) => Item) => void;
  endEdit: () => void;
  patchSelected: (fn: (it: Item) => Item, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  load: (s: Snapshot) => void;
  setBoards: (boards: BoardMeta[], boardId: string) => void;
}

let pendingRemoved: Item[] = [];
let pasteCount = 0;
let editBase: Item[] | null = null;
let lastPatch: { key: string; time: number; entry: Entry } | null = null;

const bySeq = (a: Item, b: Item) => a.seq - b.seq;
const idSet = (items: Item[]) => new Set(items.map((i) => i.id));

function clone(it: Item, seq: number, dx: number, dy: number): Item {
  const id = uid();
  if (it.type === 'stroke') return { ...it, id, seq, pts: it.pts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  return { ...it, id, seq, x: it.x + dx, y: it.y + dy, gen: it.gen && { id: it.gen.id, params: { ...it.gen.params } } };
}

export const useBoard = create<BoardState>((set, get) => {
  const prune = (items: Item[], selection: string[]) => {
    const ids = idSet(items);
    return selection.filter((id) => ids.has(id));
  };

  return {
    items: [],
    selection: [],
    undoStack: [],
    redoStack: [],
    tool: 'pen',
    color: COLORS[0],
    size: 3,
    dash: false,
    snap: true,
    background: 'dots',
    palette: [...COLORS],
    addColor: (c) =>
      set((st) => {
        const palette = st.palette.includes(c) ? st.palette : [...st.palette.slice(-9), c];
        return { palette, color: c, tool: st.tool === 'eraser' ? 'pen' : st.tool };
      }),
    pencilOnly: readPref('pencilOnly', coarsePointer()),
    smooth: readPref('smooth', 0.5),
    viewport: { x: 0, y: 0, scale: 1 },
    seq: 0,
    ruler: null,
    protractor: null,
    boards: [],
    boardId: '',
    clipboard: [],
    busy: false,

    nextSeq: () => {
      const n = get().seq + 1;
      set({ seq: n });
      return n;
    },
    setTool: (tool) => set((st) => ({ tool, selection: tool === 'select' || tool === 'lasso' ? st.selection : [] })),
    setColor: (color) => {
      // picking a colour while erasing means "draw with it"
      set((st) => ({ color, tool: st.tool === 'eraser' ? 'pen' : st.tool }));
      if (get().selection.length) get().patchSelected((it) => (it.color === color ? it : { ...it, color }), 'color');
    },
    setSize: (size) => {
      set({ size });
      if (get().selection.length)
        get().patchSelected((it) => {
          if (it.type === 'obj') return it.lw === size ? it : { ...it, lw: size };
          const s = it.kind === 'highlighter' ? Math.max(size * 5, 14) : size;
          return it.size === s ? it : { ...it, size: s };
        }, 'size');
    },
    setDash: (dash) => {
      set({ dash });
      if (get().selection.length) get().patchSelected((it) => (it.type === 'obj' && !!it.dash !== dash ? { ...it, dash } : it), 'dash');
    },
    setSnap: (snap) => set({ snap }),
    setBackground: (background) => set({ background }),
    setPencilOnly: (pencilOnly) => {
      writePref('pencilOnly', pencilOnly);
      set({ pencilOnly });
    },
    setSmooth: (smooth) => {
      writePref('smooth', smooth);
      set({ smooth });
    },
    setViewport: (viewport) => set({ viewport }),
    setRuler: (ruler) => set({ ruler }),
    setProtractor: (protractor) => set({ protractor }),

    addItems: (items, select = false) =>
      set((st) => ({
        items: [...st.items, ...items].sort(bySeq),
        selection: select ? items.map((i) => i.id) : st.selection,
        undoStack: [...st.undoStack, { type: 'add', items }],
        redoStack: [],
      })),

    removeLive: (ids) => {
      if (ids.length === 0) return;
      const gone = new Set(ids);
      const st = get();
      pendingRemoved.push(...st.items.filter((s) => gone.has(s.id)));
      const items = st.items.filter((s) => !gone.has(s.id));
      set({ items, selection: prune(items, st.selection) });
    },
    commitErase: () => {
      if (pendingRemoved.length === 0) return;
      const removed = pendingRemoved;
      pendingRemoved = [];
      set((st) => ({ undoStack: [...st.undoStack, { type: 'remove', items: removed }], redoStack: [] }));
    },

    select: (selection) => set({ selection }),
    deleteSelected: () => {
      const st = get();
      if (!st.selection.length) return;
      const gone = new Set(st.selection);
      const removed = st.items.filter((i) => gone.has(i.id));
      set({
        items: st.items.filter((i) => !gone.has(i.id)),
        selection: [],
        undoStack: [...st.undoStack, { type: 'remove', items: removed }],
        redoStack: [],
      });
    },
    duplicateSelected: () => {
      const st = get();
      const sel = st.items.filter((i) => st.selection.includes(i.id));
      if (!sel.length) return;
      let seq = st.seq;
      const copies = sel.map((i) => clone(i, ++seq, 24, 24));
      set({
        seq,
        items: [...st.items, ...copies].sort(bySeq),
        selection: copies.map((c) => c.id),
        undoStack: [...st.undoStack, { type: 'add', items: copies }],
        redoStack: [],
      });
    },

    copySelected: () => {
      const st = get();
      const sel = st.items.filter((i) => st.selection.includes(i.id));
      if (!sel.length) return;
      pasteCount = 0;
      set({ clipboard: sel });
    },
    cutSelected: () => {
      get().copySelected();
      get().deleteSelected();
    },
    paste: () => {
      const st = get();
      if (!st.clipboard.length) return;
      pasteCount += 1;
      let seq = st.seq;
      const off = 24 * pasteCount;
      const copies = st.clipboard.map((i) => clone(i, ++seq, off, off));
      set({
        seq,
        items: [...st.items, ...copies].sort(bySeq),
        selection: copies.map((c) => c.id),
        undoStack: [...st.undoStack, { type: 'add', items: copies }],
        redoStack: [],
      });
    },
    beginEdit: () => {
      const st = get();
      editBase = st.items.filter((i) => st.selection.includes(i.id));
      set({ busy: true });
    },
    applyEdit: (fn) => {
      if (!editBase) return;
      const map = new Map(editBase.map((b) => [b.id, fn(b)]));
      set((st) => ({ items: st.items.map((i) => map.get(i.id) ?? i) }));
    },
    endEdit: () => {
      if (!editBase) return;
      const base = editBase;
      editBase = null;
      set({ busy: false });
      const st = get();
      const ids = idSet(base);
      const after = st.items.filter((i) => ids.has(i.id));
      if (!after.some((a) => a !== base.find((b) => b.id === a.id))) return;
      set({ undoStack: [...st.undoStack, { type: 'update', before: base, after }], redoStack: [] });
    },
    patchSelected: (fn, key) => {
      const st = get();
      const sel = st.items.filter((i) => st.selection.includes(i.id));
      if (!sel.length) return;
      const next = new Map(sel.map((i) => [i.id, fn(i)]));
      if (sel.every((i) => next.get(i.id) === i)) return; // nothing changed: no history entry, redo stack kept
      const items = st.items.map((i) => next.get(i.id) ?? i);
      const now = Date.now();
      const last = st.undoStack[st.undoStack.length - 1];
      // merge only into the entry this same control created a moment ago, for exactly the same items
      const merge =
        !!key &&
        !!lastPatch &&
        lastPatch.key === key &&
        now - lastPatch.time < 900 &&
        last === lastPatch.entry &&
        last.type === 'update' &&
        last.after.length === sel.length &&
        sel.every((i) => last.after.some((a) => a.id === i.id));
      const after = sel.map((i) => next.get(i.id)!);
      const entry: Entry = { type: 'update', before: merge ? (last as Extract<Entry, { type: 'update' }>).before : sel, after };
      lastPatch = key ? { key, time: now, entry } : null;
      const undoStack = merge ? [...st.undoStack.slice(0, -1), entry] : [...st.undoStack, entry];
      set({ items, undoStack, redoStack: [] });
    },

    undo: () => {
      const st = get();
      const e = st.undoStack[st.undoStack.length - 1];
      if (!e) return;
      let items: Item[];
      if (e.type === 'update') {
        const m = new Map(e.before.map((i) => [i.id, i]));
        items = st.items.map((i) => m.get(i.id) ?? i);
      } else {
        const ids = idSet(e.items);
        items = e.type === 'add' ? st.items.filter((i) => !ids.has(i.id)) : [...st.items, ...e.items].sort(bySeq);
      }
      lastPatch = null;
      set({ items, selection: prune(items, st.selection), undoStack: st.undoStack.slice(0, -1), redoStack: [...st.redoStack, e] });
    },
    redo: () => {
      const st = get();
      const e = st.redoStack[st.redoStack.length - 1];
      if (!e) return;
      let items: Item[];
      if (e.type === 'update') {
        const m = new Map(e.after.map((i) => [i.id, i]));
        items = st.items.map((i) => m.get(i.id) ?? i);
      } else {
        const ids = idSet(e.items);
        items = e.type === 'add' ? [...st.items, ...e.items].sort(bySeq) : st.items.filter((i) => !ids.has(i.id));
      }
      lastPatch = null;
      set({ items, selection: prune(items, st.selection), redoStack: st.redoStack.slice(0, -1), undoStack: [...st.undoStack, e] });
    },
    clear: () => {
      const st = get();
      if (st.items.length === 0) return;
      set({ items: [], selection: [], undoStack: [...st.undoStack, { type: 'remove', items: st.items }], redoStack: [] });
    },
    load: (s) => {
      pendingRemoved = [];
      editBase = null;
      lastPatch = null;
      set({ busy: false, items: s.items, background: s.background, viewport: s.viewport, seq: s.seq, selection: [], undoStack: [], redoStack: [] });
    },
    setBoards: (boards, boardId) => set({ boards, boardId }),
  };
});
