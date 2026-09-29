import { create } from 'zustand';
import type { Background, Stroke, Tool, Viewport } from './types';

type Entry =
  | { type: 'add'; strokes: Stroke[] }
  | { type: 'remove'; strokes: Stroke[] };

export const COLORS = ['#111318', '#1f6feb', '#d1242f', '#1a7f37', '#e16f24', '#8250df'];

export interface Snapshot {
  strokes: Stroke[];
  background: Background;
  viewport: Viewport;
  seq: number;
}

interface BoardState {
  strokes: Stroke[];
  undoStack: Entry[];
  redoStack: Entry[];
  tool: Tool;
  color: string;
  size: number;
  background: Background;
  pencilOnly: boolean;
  viewport: Viewport;
  seq: number;
  nextSeq: () => number;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setSize: (n: number) => void;
  setBackground: (b: Background) => void;
  setPencilOnly: (v: boolean) => void;
  setViewport: (v: Viewport) => void;
  commitStroke: (s: Stroke) => void;
  removeLive: (ids: string[]) => void;
  commitErase: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  load: (s: Snapshot) => void;
}

let pendingRemoved: Stroke[] = [];

const bySeq = (a: Stroke, b: Stroke) => a.seq - b.seq;

export const useBoard = create<BoardState>((set, get) => ({
  strokes: [],
  undoStack: [],
  redoStack: [],
  tool: 'pen',
  color: COLORS[0],
  size: 3,
  background: 'grid',
  pencilOnly: false,
  viewport: { x: 0, y: 0, scale: 1 },
  seq: 0,
  nextSeq: () => {
    const n = get().seq + 1;
    set({ seq: n });
    return n;
  },
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color, tool: get().tool === 'eraser' ? 'pen' : get().tool }),
  setSize: (size) => set({ size }),
  setBackground: (background) => set({ background }),
  setPencilOnly: (pencilOnly) => set({ pencilOnly }),
  setViewport: (viewport) => set({ viewport }),
  commitStroke: (s) =>
    set((st) => ({
      strokes: [...st.strokes, s],
      undoStack: [...st.undoStack, { type: 'add', strokes: [s] }],
      redoStack: [],
    })),
  removeLive: (ids) => {
    if (ids.length === 0) return;
    const gone = new Set(ids);
    const st = get();
    pendingRemoved.push(...st.strokes.filter((s) => gone.has(s.id)));
    set({ strokes: st.strokes.filter((s) => !gone.has(s.id)) });
  },
  commitErase: () => {
    if (pendingRemoved.length === 0) return;
    const removed = pendingRemoved;
    pendingRemoved = [];
    set((st) => ({
      undoStack: [...st.undoStack, { type: 'remove', strokes: removed }],
      redoStack: [],
    }));
  },
  undo: () => {
    const st = get();
    const e = st.undoStack[st.undoStack.length - 1];
    if (!e) return;
    const ids = new Set(e.strokes.map((s) => s.id));
    const strokes =
      e.type === 'add'
        ? st.strokes.filter((s) => !ids.has(s.id))
        : [...st.strokes, ...e.strokes].sort(bySeq);
    set({ strokes, undoStack: st.undoStack.slice(0, -1), redoStack: [...st.redoStack, e] });
  },
  redo: () => {
    const st = get();
    const e = st.redoStack[st.redoStack.length - 1];
    if (!e) return;
    const ids = new Set(e.strokes.map((s) => s.id));
    const strokes =
      e.type === 'add'
        ? [...st.strokes, ...e.strokes].sort(bySeq)
        : st.strokes.filter((s) => !ids.has(s.id));
    set({ strokes, redoStack: st.redoStack.slice(0, -1), undoStack: [...st.undoStack, e] });
  },
  clear: () => {
    const st = get();
    if (st.strokes.length === 0) return;
    set({
      strokes: [],
      undoStack: [...st.undoStack, { type: 'remove', strokes: st.strokes }],
      redoStack: [],
    });
  },
  load: (s) => {
    pendingRemoved = [];
    set({
      strokes: s.strokes,
      background: s.background,
      viewport: s.viewport,
      seq: s.seq,
      undoStack: [],
      redoStack: [],
    });
  },
}));
