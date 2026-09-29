import { del, get, set } from 'idb-keyval';
import { uid as makeId } from '../canvas/id';
import { useBoard } from '../canvas/store';
import type { BoardMeta, Snapshot } from '../canvas/store';
import type { Background, Item, Viewport } from '../canvas/types';

const META_KEY = 'boards-meta';
const LEGACY_KEY = 'board-v1';
const boardKey = (id: string) => `board:${id}`;
const uid = () => makeId().slice(0, 8);
const viewKey = (id: string) => `view:${id}`;

interface Meta {
  list: BoardMeta[];
  current: string;
}

const EMPTY_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

export function normalizeSnapshot(raw: unknown): Snapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { items?: Item[]; strokes?: Item[]; background?: Background; viewport?: Viewport; seq?: number };
  const src = Array.isArray(r.items) ? r.items : Array.isArray(r.strokes) ? r.strokes : null;
  if (!src) return null;
  const items = src
    .filter((i) => i && typeof i === 'object')
    .map((i) => ((i as Item).type ? (i as Item) : ({ ...(i as object), type: 'stroke' } as Item)));
  const seq = items.reduce((m, i) => Math.max(m, i.seq || 0), Number(r.seq) || 0);
  return { items, background: r.background ?? 'grid', viewport: r.viewport ?? EMPTY_VIEWPORT, seq };
}

type Persisted = Omit<Snapshot, 'viewport'>;

export function snapshotOf(): Snapshot {
  const { items, background, viewport, seq } = useBoard.getState();
  return { items, background, viewport, seq };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function saveMeta() {
  const { boards, boardId } = useBoard.getState();
  await safe(() => set(META_KEY, { list: boards, current: boardId } satisfies Meta), undefined);
}

export async function saveCurrent() {
  const st = useBoard.getState();
  if (!st.boardId) return;
  const now = Date.now();
  const boards = st.boards.map((b) => (b.id === st.boardId ? { ...b, updated: now } : b));
  useBoard.setState({ boards });
  const { viewport, ...content } = snapshotOf();
  await safe(() => set(boardKey(st.boardId), content satisfies Persisted), undefined);
  await safe(() => set(viewKey(st.boardId), viewport), undefined);
  await saveMeta();
}

async function saveViewport() {
  const { boardId, viewport } = useBoard.getState();
  if (boardId) await safe(() => set(viewKey(boardId), viewport), undefined);
}

async function readSnapshot(id: string): Promise<Snapshot | null> {
  const snap = normalizeSnapshot(await safe(() => get(boardKey(id)), undefined));
  if (!snap) return null;
  const vp = await safe(() => get<Viewport>(viewKey(id)), undefined);
  return vp && Number.isFinite(vp.scale) ? { ...snap, viewport: vp } : snap;
}

export async function loadSnapshot(id: string): Promise<Snapshot | null> {
  if (id === useBoard.getState().boardId) return snapshotOf();
  return readSnapshot(id);
}

export async function restore() {
  const meta = await safe(() => get<Meta>(META_KEY), undefined);
  const st = useBoard.getState();
  if (meta && Array.isArray(meta.list) && meta.list.length) {
    const cur = meta.list.find((b) => b.id === meta.current) ?? meta.list[0];
    const snap = await readSnapshot(cur.id);
    st.setBoards(meta.list, cur.id);
    if (snap) st.load(snap);
    return;
  }
  const legacy = normalizeSnapshot(await safe(() => get(LEGACY_KEY), undefined));
  const id = uid();
  st.setBoards([{ id, name: 'Bảng 1', updated: Date.now() }], id);
  if (legacy) st.load(legacy);
  await saveCurrent();
}

let timer: number | undefined;

export async function flush() {
  window.clearTimeout(timer);
  timer = undefined;
  await saveCurrent();
}

export function autosave() {
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => void flush());
  let vtimer: number | undefined;
  return useBoard.subscribe((s, p) => {
    if (s.items !== p.items || s.background !== p.background || s.seq !== p.seq) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void saveCurrent(), 400);
    } else if (s.viewport !== p.viewport) {
      // panning/zooming only rewrites a tiny record, never the whole board
      window.clearTimeout(vtimer);
      vtimer = window.setTimeout(() => void saveViewport(), 500);
    }
  });
}

export async function newBoard(name?: string) {
  await flush();
  const st = useBoard.getState(); // read AFTER flush: it refreshes the boards list
  const id = uid();
  const n = name?.trim() || `Bảng ${st.boards.length + 1}`;
  st.setBoards([...st.boards, { id, name: n, updated: Date.now() }], id);
  st.load({ items: [], background: st.background, viewport: EMPTY_VIEWPORT, seq: 0 });
  await saveCurrent();
}

export async function openBoard(id: string) {
  if (id === useBoard.getState().boardId || !useBoard.getState().boards.some((b) => b.id === id)) return;
  const snap = (await readSnapshot(id)) ?? { items: [], background: 'grid' as Background, viewport: EMPTY_VIEWPORT, seq: 0 };
  await flush(); // last await before switching: nothing can be drawn between the save and the load
  const st = useBoard.getState();
  st.setBoards(st.boards, id);
  st.load(snap);
  await saveMeta();
}

export async function renameBoard(id: string, name: string) {
  const st = useBoard.getState();
  const n = name.trim();
  if (!n) return;
  st.setBoards(st.boards.map((b) => (b.id === id ? { ...b, name: n } : b)), st.boardId);
  await saveMeta();
}

export async function deleteBoard(id: string) {
  const st = useBoard.getState();
  if (st.boards.length <= 1) {
    st.load({ items: [], background: st.background, viewport: EMPTY_VIEWPORT, seq: 0 });
    return;
  }
  const rest = st.boards.filter((b) => b.id !== id);
  await safe(() => del(boardKey(id)), undefined);
  await safe(() => del(viewKey(id)), undefined);
  if (id === st.boardId) {
    const next = rest[0];
    const snap = (await readSnapshot(next.id)) ?? { items: [], background: 'grid' as Background, viewport: EMPTY_VIEWPORT, seq: 0 };
    const cur = useBoard.getState();
    cur.setBoards(rest, next.id);
    cur.load(snap);
  } else {
    const cur = useBoard.getState();
    cur.setBoards(cur.boards.filter((b) => b.id !== id), cur.boardId);
  }
  await saveMeta();
}
