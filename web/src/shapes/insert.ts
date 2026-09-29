import { uid } from '../canvas/id';
import { useBoard } from '../canvas/store';
import type { Obj, Params } from '../canvas/types';
import { buildShapeObj, defaultParams, shapeById, type ShapeDef } from './registry';

export function boardCenter(): { x: number; y: number; scale: number } {
  const st = useBoard.getState();
  const el = document.querySelector('.board');
  const r = el?.getBoundingClientRect();
  const w = r?.width ?? window.innerWidth;
  const h = r?.height ?? window.innerHeight;
  const vp = st.viewport;
  return { x: (w / 2 - vp.x) / vp.scale, y: (h / 2 - vp.y) / vp.scale, scale: Math.min(4, Math.max(0.25, 1 / vp.scale)) };
}

function add(o: Obj) {
  const st = useBoard.getState();
  st.setTool('select');
  st.addItems([o], true);
}

/** successive insertions cascade so new figures never hide the previous one */
function freeSpot(c: { x: number; y: number; scale: number }) {
  const items = useBoard.getState().items;
  const step = 34 * c.scale;
  let { x, y } = c;
  while (items.some((i) => i.type === 'obj' && Math.abs(i.x - x) < 8 * c.scale && Math.abs(i.y - y) < 8 * c.scale)) {
    x += step;
    y += step;
  }
  return { ...c, x, y };
}

/** Origin-anchored figures (graphs, axes) must be visible after insertion: recentre the view on the origin if it is off-screen. */
function revealOrigin() {
  const st = useBoard.getState();
  const r = document.querySelector('.board')?.getBoundingClientRect();
  const w = r?.width ?? window.innerWidth;
  const h = r?.height ?? window.innerHeight;
  const { x, y } = st.viewport;
  if (x < w * 0.15 || x > w * 0.85 || y < h * 0.15 || y > h * 0.85) st.setViewport({ ...st.viewport, x: w / 2, y: h / 2 });
}

export function insertShape(def: ShapeDef, params?: Params): string {
  const st = useBoard.getState();
  if (def.atOrigin) revealOrigin();
  const c = def.atOrigin ? boardCenter() : freeSpot(boardCenter());
  const o = buildShapeObj(def, params ?? defaultParams(def), {
    id: uid(),
    seq: st.nextSeq(),
    x: c.x,
    y: c.y,
    scale: c.scale,
    color: st.color,
  });
  add(o);
  return o.id;
}

export function insertGraph(expr: string): string {
  const def = shapeById('fn-custom')!;
  return insertShape(def, { ...defaultParams(def), expr });
}

export function insertText(src: string, size = 22): string {
  const st = useBoard.getState();
  const c = freeSpot(boardCenter());
  const o: Obj = {
    type: 'obj',
    id: uid(),
    seq: st.nextSeq(),
    x: c.x,
    y: c.y,
    rot: 0,
    scale: c.scale,
    color: st.color,
    lw: 2,
    prims: [{ t: 'text', o: [0, 0], s: src, size, math: true, anchor: 'middle' }],
  };
  add(o);
  return o.id;
}
