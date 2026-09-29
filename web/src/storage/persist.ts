import { get, set } from 'idb-keyval';
import { useBoard } from '../canvas/store';
import type { Snapshot } from '../canvas/store';

const KEY = 'board-v1';

export async function restore() {
  try {
    const snap = await get<Snapshot>(KEY);
    if (snap && Array.isArray(snap.strokes)) useBoard.getState().load(snap);
  } catch {
    /* storage unavailable: start empty */
  }
}

export function autosave() {
  let timer: number | undefined;
  return useBoard.subscribe((s, p) => {
    if (s.strokes === p.strokes && s.background === p.background && s.viewport === p.viewport) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const { strokes, background, viewport, seq } = useBoard.getState();
      set(KEY, { strokes, background, viewport, seq } satisfies Snapshot).catch(() => {});
    }, 400);
  });
}
