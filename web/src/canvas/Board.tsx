import { useEffect, useRef } from 'react';
import {
  RULER, aidHit, aidPivot, aidToWorld, drawProtractor, drawRuler, snapToRuler, type AidName,
} from './aids';
import { uid } from './id';
import { smoothPoints, smoothPasses, clampScale, screenToWorld, transformViewport } from './geometry';
import { itemBounds, itemHit, similarity, transformItem } from './objects';
import { itemsInLasso } from './lasso';
import { drawMarquee, drawSelection, rectsIntersect, selectionGeo, shapeFromDrag, type DragShape } from './overlay';
import { drawBackground, drawItem, drawStroke, drawVisibleItems, setViewTransform } from './render';
import { PalmGuard } from './palm';
import { recognize, snapLineEnd } from './snap';
import { useBoard } from './store';
import { useUI } from '../ui/uiStore';
import type { Aid, Pt, Stroke, V } from './types';

const ERASER_PX = 14;
const HOLD_MS = 450;
const ROT_SNAP = (15 * Math.PI) / 180;

type Live =
  | {
      kind: 'stroke';
      id: number;
      stroke: Stroke;
      predicted: Pt[];
      ruler: { p0: V; d: V } | null;
      lastScreen: V;
      timer: number;
      preview: Pt[] | null;
      /** the hold turned the open stroke into a straight line that now follows the pen */
      lineMode: boolean;
    }
  | { kind: 'erase'; id: number }
  | { kind: 'shape'; id: number; tool: DragShape; start: V; cur: V }
  | {
      kind: 'select';
      id: number;
      mode: 'move' | 'rotate' | 'scale' | 'marquee';
      start: V;
      cur: V;
      pivot: V;
      startAngle: number;
      startDist: number;
      moved: boolean;
    }
  | { kind: 'lasso'; id: number; pts: V[] }
  | { kind: 'aid'; id: number; which: AidName; mode: 'body' | 'rotate'; start: V; base: Aid; startAngle: number; pivot: V };

const toPts = (pts: { x: number; y: number }[]): Pt[] => pts.map((p) => ({ x: p.x, y: p.y, p: 0.5 }));

export function Board() {
  const tool = useBoard((s) => s.tool);
  const wrap = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number; sx: number; sy: number; type: string }>());
  const live = useRef<Live | null>(null);
  const gesture = useRef<{ cx: number; cy: number; d: number } | null>(null);
  const raf = useRef({ base: 0, live: 0 });

  const drawBase = () => {
    raf.current.base = 0;
    const bg = bgRef.current;
    const ink = inkRef.current;
    if (!bg || !ink) return;
    const { w, h, dpr } = size.current;
    const st = useBoard.getState();
    drawBackground(bg.getContext('2d')!, st.background, st.viewport, w, h, dpr);
    const ctx = ink.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ink.width, ink.height);
    setViewTransform(ctx, st.viewport, dpr);
    drawVisibleItems(ctx, st.items, st.viewport, w, h);
  };

  const drawLive = () => {
    raf.current.live = 0;
    const c = liveRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const st = useBoard.getState();
    const vp = st.viewport;
    setViewTransform(ctx, vp, size.current.dpr);
    if (st.protractor) drawProtractor(ctx, st.protractor, vp.scale);
    if (st.ruler) drawRuler(ctx, st.ruler, vp.scale);
    const l = live.current;
    if (l?.kind === 'stroke') {
      // the live line is smoothed exactly like the committed one, so nothing jumps when the pen lifts
      const shaped = smoothPasses(l.stroke.smooth) && l.stroke.pts.length > 3 ? smoothPoints(l.stroke.pts, smoothPasses(l.stroke.smooth)) : l.stroke.pts;
      const pts = l.preview ?? [...shaped, ...l.predicted];
      drawStroke(ctx, { ...l.stroke, pts, pen: l.preview ? true : l.stroke.pen }, false);
    } else if (l?.kind === 'shape') {
      const o = shapeFromDrag(l.tool, l.start, l.cur, { id: 'preview', seq: 0, color: st.color, lw: st.size, dash: st.dash });
      drawItem(ctx, o, false);
    }
    if ((st.tool === 'select' || st.tool === 'lasso') && st.selection.length) {
      const sel = st.items.filter((i) => st.selection.includes(i.id));
      const geo = selectionGeo(sel, vp.scale);
      if (geo) drawSelection(ctx, geo, vp.scale);
    }
    if (l?.kind === 'select' && l.mode === 'marquee') drawMarquee(ctx, l.start, l.cur, vp.scale);
    if (l?.kind === 'lasso' && l.pts.length > 1) {
      const px = 1 / vp.scale;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(l.pts[0][0], l.pts[0][1]);
      for (const q of l.pts) ctx.lineTo(q[0], q[1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.fill();
      ctx.setLineDash([7 * px, 5 * px]);
      ctx.lineWidth = 1.6 * px;
      ctx.strokeStyle = '#2563eb';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
  };

  const scheduleBase = () => {
    if (!raf.current.base) raf.current.base = requestAnimationFrame(drawBase);
  };
  const scheduleLive = () => {
    if (!raf.current.live) raf.current.live = requestAnimationFrame(drawLive);
  };

  useEffect(() => {
    const el = wrap.current!;
    const resize = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.current = { w: r.width, h: r.height, dpr };
      for (const c of [bgRef.current!, inkRef.current!, liveRef.current!]) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      scheduleBase();
      scheduleLive();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const unsub = useBoard.subscribe((s, p) => {
      if (s.items !== p.items || s.viewport !== p.viewport || s.background !== p.background) scheduleBase();
      if (s.items !== p.items || s.viewport !== p.viewport || s.selection !== p.selection || s.ruler !== p.ruler || s.protractor !== p.protractor || s.tool !== p.tool)
        scheduleLive();
    });

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useBoard.getState();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const ratio = Math.exp(-e.deltaY * 0.01);
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;
        st.setViewport(transformViewport(st.viewport, sx, sy, sx, sy, ratio));
      } else {
        st.setViewport({ ...st.viewport, x: st.viewport.x - e.deltaX, y: st.viewport.y - e.deltaY });
      }
    };
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', stopGesture);
    el.addEventListener('gesturechange', stopGesture);
    el.addEventListener('gestureend', stopGesture);

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const st = useBoard.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        st.copySelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        st.cutSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        st.paste();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        st.duplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection.length) {
          e.preventDefault();
          st.deleteSelected();
        }
      } else if (e.key === 'Escape') {
        st.select([]);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      ro.disconnect();
      unsub();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', stopGesture);
      el.removeEventListener('gesturechange', stopGesture);
      el.removeEventListener('gestureend', stopGesture);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const world = (sx: number, sy: number): V => {
    const w = screenToWorld(useBoard.getState().viewport, sx, sy);
    return [w.x, w.y];
  };

  const touchPoints = () => [...pointers.current.values()].filter((p) => p.type === 'touch');

  // GoodNotes-style: tap with two fingers = undo, three fingers = redo
  const tap = useRef({ t0: 0, max: 0, moved: false, spread: Infinity });
  const guard = useRef(new PalmGuard());
  const hinted = useRef(false);

  const resetGesture = () => {
    const t = touchPoints();
    if (t.length === 0) {
      gesture.current = null;
      return;
    }
    const cx = t.reduce((a, p) => a + p.x, 0) / t.length;
    const cy = t.reduce((a, p) => a + p.y, 0) / t.length;
    const d = t.length >= 2 ? Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y) : 0;
    gesture.current = { cx, cy, d };
  };

  const eraseAt = (sx: number, sy: number) => {
    const st = useBoard.getState();
    const w = screenToWorld(st.viewport, sx, sy);
    const r = ERASER_PX / st.viewport.scale;
    const ids = st.items.filter((s) => itemHit(s, w.x, w.y, r)).map((s) => s.id);
    st.removeLive(ids);
  };

  const cancelLive = () => {
    const l = live.current;
    if (!l) return;
    const st = useBoard.getState();
    if (l.kind === 'erase') st.commitErase();
    if (l.kind === 'select' && l.mode !== 'marquee') st.endEdit();
    if (l.kind === 'stroke') window.clearTimeout(l.timer);
    live.current = null;
    scheduleLive();
  };

  const aidAt = (w: V, pointerType: string) => {
    const st = useBoard.getState();
    const allowBody = pointerType === 'touch' || st.tool === 'select' || st.tool === 'lasso';
    for (const which of ['ruler', 'protractor'] as AidName[]) {
      const a = st[which];
      if (!a) continue;
      const hit = aidHit(which, a, w[0], w[1], st.viewport.scale, false);
      if (hit) return { which, mode: hit };
    }
    for (const which of ['ruler', 'protractor'] as AidName[]) {
      const a = st[which];
      if (!a) continue;
      const hit = aidHit(which, a, w[0], w[1], st.viewport.scale, allowBody);
      if (hit) return { which, mode: hit };
    }
    return null;
  };

  const startAid = (id: number, which: AidName, mode: 'body' | 'rotate', w: V) => {
    const base = useBoard.getState()[which]!;
    const pivot = aidPivot(which, base);
    live.current = { kind: 'aid', id, which, mode, start: w, base, pivot, startAngle: Math.atan2(w[1] - pivot[1], w[0] - pivot[0]) };
  };

  const startSelect = (id: number, w: V, e: React.PointerEvent) => {
    const st = useBoard.getState();
    const vp = st.viewport;
    const sel = st.items.filter((i) => st.selection.includes(i.id));
    const geo = selectionGeo(sel, vp.scale);
    const hitR = 18 / vp.scale;
    if (geo) {
      const pivot = geo.center;
      if (Math.hypot(w[0] - geo.rotate[0], w[1] - geo.rotate[1]) <= hitR) {
        st.beginEdit();
        live.current = { kind: 'select', id, mode: 'rotate', start: w, cur: w, pivot, startAngle: Math.atan2(w[1] - pivot[1], w[0] - pivot[0]), startDist: 1, moved: false };
        return;
      }
      if (Math.hypot(w[0] - geo.scale[0], w[1] - geo.scale[1]) <= hitR) {
        st.beginEdit();
        live.current = { kind: 'select', id, mode: 'scale', start: w, cur: w, pivot, startAngle: 0, startDist: Math.max(1, Math.hypot(w[0] - pivot[0], w[1] - pivot[1])), moved: false };
        return;
      }
    }
    let hit = null as (typeof st.items)[number] | null;
    for (let i = st.items.length - 1; i >= 0; i--) {
      if (itemHit(st.items[i], w[0], w[1], 8 / vp.scale)) {
        hit = st.items[i];
        break;
      }
    }
    // Lasso tool: only an already-selected item can be dragged; starting on anything else draws the loop (like GoodNotes)
    if (hit && st.tool === 'lasso' && !st.selection.includes(hit.id)) hit = null;
    if (hit) {
      if (!st.selection.includes(hit.id)) st.select(e.shiftKey ? [...st.selection, hit.id] : [hit.id]);
      st.beginEdit();
      live.current = { kind: 'select', id, mode: 'move', start: w, cur: w, pivot: w, startAngle: 0, startDist: 1, moved: false };
    } else {
      if (!e.shiftKey) st.select([]);
      if (st.tool === 'lasso') live.current = { kind: 'lasso', id, pts: [w] };
      else live.current = { kind: 'select', id, mode: 'marquee', start: w, cur: w, pivot: w, startAngle: 0, startDist: 1, moved: false };
    }
    scheduleLive();
  };

  const armHold = (l: Extract<Live, { kind: 'stroke' }>) => {
    window.clearTimeout(l.timer);
    l.timer = window.setTimeout(() => {
      if (live.current !== l || l.ruler || !useBoard.getState().snap) return;
      const rec = recognize(l.stroke.pts);
      if (rec && rec.kind !== 'line') {
        l.preview = toPts(rec.pts);
        scheduleLive();
        return;
      }
      // anything else drawn as an open stroke and held still becomes a straight line from where it started;
      // it keeps following the pen until the pen is lifted
      const pts = l.stroke.pts;
      const a = pts[0], b = pts[pts.length - 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) * useBoard.getState().viewport.scale < 24) return;
      const end = snapLineEnd(a, b);
      l.lineMode = true;
      l.preview = [{ x: a.x, y: a.y, p: 0.5 }, { x: end.x, y: end.y, p: 0.5 }];
      scheduleLive();
    }, HOLD_MS);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const st = useBoard.getState();
    if (e.pointerType === 'pen') {
      if (!st.pencilOnly) st.setPencilOnly(true);
      // a palm/finger already resting on the glass when the pen lands is dropped for good
      const dropped = guard.current.pen('down', e.pointerId);
      if (dropped.length) {
        for (const id of dropped) pointers.current.delete(id);
        if (live.current && dropped.includes(live.current.id)) cancelLive();
        gesture.current = null;
        tap.current = { t0: 0, max: 0, moved: false, spread: Infinity };
      }
    } else if (e.pointerType === 'touch' && !guard.current.touchDown(e.pointerId)) {
      return; // palm or finger next to the pen: not a gesture, not a stroke
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, sx: p.x, sy: p.y, type: e.pointerType });
    const w = world(p.x, p.y);

    if (e.pointerType === 'touch') {
      if (touchPoints().length === 1) tap.current = { t0: performance.now(), max: 1, moved: false, spread: Infinity };
      else tap.current.max = Math.max(tap.current.max, touchPoints().length);
      const tp = touchPoints();
      for (let i = 0; i < tp.length; i++)
        for (let j = i + 1; j < tp.length; j++) tap.current.spread = Math.min(tap.current.spread, Math.hypot(tp[i].x - tp[j].x, tp[i].y - tp[j].y));
      const multi = touchPoints().length >= 2;
      if (multi) cancelLive();
      if (!multi && !live.current) {
        const a = aidAt(w, 'touch');
        if (a) {
          startAid(e.pointerId, a.which, a.mode, w);
          return;
        }
      }
      if (multi || st.pencilOnly) {
        if (!multi && st.pencilOnly && !hinted.current) {
          hinted.current = true;
          useUI.getState().showToast('Đang bật "Chỉ Pencil": ngón tay chỉ kéo và thu phóng. Bấm "Chỉ Pencil" để vẽ bằng ngón tay.');
        }
        resetGesture();
        return;
      }
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (live.current) return;

    const a = aidAt(w, e.pointerType);
    if (a) {
      startAid(e.pointerId, a.which, a.mode, w);
      return;
    }

    if (st.tool === 'select' || st.tool === 'lasso') {
      startSelect(e.pointerId, w, e);
      return;
    }
    if (st.tool === 'eraser' || (e.buttons & 32) !== 0) {
      live.current = { kind: 'erase', id: e.pointerId };
      eraseAt(p.x, p.y);
      return;
    }
    if (st.tool === 'line' || st.tool === 'arrow' || st.tool === 'circle' || st.tool === 'rect') {
      live.current = { kind: 'shape', id: e.pointerId, tool: st.tool, start: w, cur: w };
      return;
    }
    const isPen = e.pointerType === 'pen';
    const stroke: Stroke = {
      type: 'stroke',
      id: uid(),
      seq: st.nextSeq(),
      color: st.color,
      kind: st.tool === 'highlighter' ? 'highlighter' : 'pen',
      size: st.tool === 'highlighter' ? Math.max(st.size * 5, 14) : st.size,
      pen: isPen,
      smooth: st.smooth,
      pts: [{ x: w[0], y: w[1], p: isPen ? e.pressure || 0.5 : 0.5 }],
    };
    let ruler: { p0: V; d: V } | null = null;
    if (st.ruler) {
      ruler = snapToRuler(st.ruler, w[0], w[1], 14 / st.viewport.scale);
      if (ruler) stroke.pts = [{ x: ruler.p0[0], y: ruler.p0[1], p: 0.5 }];
    }
    const l: Live = { kind: 'stroke', id: e.pointerId, stroke, predicted: [], ruler, lastScreen: [p.x, p.y], timer: 0, preview: null, lineMode: false };
    live.current = l;
    armHold(l);
    scheduleLive();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') guard.current.pen(e.buttons ? 'move' : 'hover', e.pointerId);
    else if (e.pointerType === 'touch' && guard.current.isIgnored(e.pointerId)) return;
    const known = pointers.current.get(e.pointerId);
    const p = local(e);
    if (known) {
      known.x = p.x;
      known.y = p.y;
    }
    const st = useBoard.getState();
    if (e.pointerType === 'touch' && known && Math.hypot(p.x - known.sx, p.y - known.sy) > 12) tap.current.moved = true;

    const l = live.current;
    const t = touchPoints();
    if (e.pointerType === 'touch' && gesture.current && !(l && l.id === e.pointerId) && (st.pencilOnly || t.length >= 2)) {
      const g = gesture.current;
      const cx = t.reduce((a, q) => a + q.x, 0) / t.length;
      const cy = t.reduce((a, q) => a + q.y, 0) / t.length;
      const d = t.length >= 2 ? Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y) : 0;
      const ratio = g.d > 0 && d > 0 ? d / g.d : 1;
      const next = clampScale(st.viewport.scale * ratio) / st.viewport.scale;
      st.setViewport(transformViewport(st.viewport, g.cx, g.cy, cx, cy, next));
      gesture.current = { cx, cy, d };
      return;
    }

    if (!l || l.id !== e.pointerId) return;
    const native = e.nativeEvent;
    const evs = native.getCoalescedEvents?.() ?? [];
    const list = evs.length ? evs : [native];
    const w = world(p.x, p.y);

    switch (l.kind) {
      case 'erase':
        for (const ev of list) {
          const q = local(ev);
          eraseAt(q.x, q.y);
        }
        return;
      case 'shape':
        l.cur = w;
        scheduleLive();
        return;
      case 'aid': {
        const dx = w[0] - l.start[0], dy = w[1] - l.start[1];
        if (l.mode === 'body') {
          const next = { ...l.base, x: l.base.x + dx, y: l.base.y + dy };
          l.which === 'ruler' ? st.setRuler(next) : st.setProtractor(next);
        } else {
          const rot = l.base.rot + (Math.atan2(w[1] - l.pivot[1], w[0] - l.pivot[0]) - l.startAngle);
          let next: Aid = { ...l.base, rot };
          if (l.which === 'ruler') {
            const [ox, oy] = aidToWorld({ x: 0, y: 0, rot }, RULER.len / 2, RULER.w / 2);
            next = { x: l.pivot[0] - ox, y: l.pivot[1] - oy, rot };
          }
          l.which === 'ruler' ? st.setRuler(next) : st.setProtractor(next);
        }
        return;
      }
      case 'lasso': {
        const last = l.pts[l.pts.length - 1];
        if (Math.hypot(w[0] - last[0], w[1] - last[1]) * st.viewport.scale > 2) {
          l.pts.push(w);
          scheduleLive();
        }
        return;
      }
      case 'select': {
        l.cur = w;
        if (l.mode === 'marquee') {
          scheduleLive();
          return;
        }
        if (!l.moved) {
          if (Math.hypot(w[0] - l.start[0], w[1] - l.start[1]) * st.viewport.scale < 3) return;
          l.moved = true;
        }
        let m;
        if (l.mode === 'move') m = similarity(l.pivot, w[0] - l.start[0], w[1] - l.start[1], 0, 1);
        else if (l.mode === 'rotate') {
          let ang = Math.atan2(w[1] - l.pivot[1], w[0] - l.pivot[0]) - l.startAngle;
          const snapped = Math.round(ang / ROT_SNAP) * ROT_SNAP;
          if (Math.abs(ang - snapped) < (3 * Math.PI) / 180) ang = snapped;
          m = similarity(l.pivot, 0, 0, ang, 1);
        } else {
          const k = Math.min(20, Math.max(0.1, Math.hypot(w[0] - l.pivot[0], w[1] - l.pivot[1]) / l.startDist));
          m = similarity(l.pivot, 0, 0, 0, k);
        }
        st.applyEdit((it) => transformItem(it, m));
        return;
      }
      case 'stroke': {
        const stroke = l.stroke;
        const isPen = e.pointerType === 'pen';
        if (l.ruler) {
          const s = (w[0] - l.ruler.p0[0]) * l.ruler.d[0] + (w[1] - l.ruler.p0[1]) * l.ruler.d[1];
          stroke.pts = [stroke.pts[0], { x: l.ruler.p0[0] + l.ruler.d[0] * s, y: l.ruler.p0[1] + l.ruler.d[1] * s, p: 0.5 }];
          scheduleLive();
          return;
        }
        if (l.lineMode) {
          const a = stroke.pts[0];
          const end = snapLineEnd(a, { x: w[0], y: w[1] });
          l.preview = [{ x: a.x, y: a.y, p: 0.5 }, { x: end.x, y: end.y, p: 0.5 }];
          scheduleLive();
          return;
        }
        const vp = st.viewport;
        for (const ev of list) {
          const q = local(ev);
          const ww = screenToWorld(vp, q.x, q.y);
          stroke.pts.push({ x: ww.x, y: ww.y, p: isPen ? ev.pressure || 0.5 : 0.5 });
        }
        const pred = native.getPredictedEvents?.() ?? [];
        l.predicted = pred.map((ev) => {
          const q = local(ev);
          const ww = screenToWorld(vp, q.x, q.y);
          return { x: ww.x, y: ww.y, p: isPen ? ev.pressure || 0.5 : 0.5 };
        });
        if (Math.hypot(p.x - l.lastScreen[0], p.y - l.lastScreen[1]) > 3) {
          l.lastScreen = [p.x, p.y];
          l.preview = null;
          armHold(l);
        }
        scheduleLive();
      }
    }
  };

  const finish = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && guard.current.isIgnored(e.pointerId)) {
      guard.current.touchEnd(e.pointerId);
      return;
    }
    if (e.pointerType === 'pen') guard.current.pen('up', e.pointerId);
    else if (e.pointerType === 'touch') guard.current.touchEnd(e.pointerId);
    pointers.current.delete(e.pointerId);
    const l = live.current;
    const st = useBoard.getState();
    if (l && l.id === e.pointerId) {
      switch (l.kind) {
        case 'erase':
          st.commitErase();
          break;
        case 'stroke': {
          window.clearTimeout(l.timer);
          if (l.preview) {
            l.stroke.pts = l.preview;
            l.stroke.pen = true;
          } else if ((l.stroke.smooth ?? 0) > 0 && l.stroke.pts.length > 3) {
            l.stroke.pts = smoothPoints(l.stroke.pts, smoothPasses(l.stroke.smooth));
          }
          st.addItems([l.stroke]);
          break;
        }
        case 'shape': {
          if (Math.hypot(l.cur[0] - l.start[0], l.cur[1] - l.start[1]) * st.viewport.scale > 4) {
            const o = shapeFromDrag(l.tool, l.start, l.cur, { id: uid(), seq: st.nextSeq(), color: st.color, lw: st.size, dash: st.dash });
            st.addItems([o]);
          }
          break;
        }
        case 'lasso': {
          const xs = l.pts.map((q) => q[0]), ys = l.pts.map((q) => q[1]);
          const tiny = (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) * st.viewport.scale < 8;
          if (tiny) {
            // a tap with the lasso selects the item under the pen
            const top = [...st.items].reverse().find((i) => itemHit(i, l.pts[0][0], l.pts[0][1], 8 / st.viewport.scale));
            st.select(top ? (e.shiftKey ? [...new Set([...st.selection, top.id])] : [top.id]) : []);
            break;
          }
          const ids = itemsInLasso(st.items, l.pts);
          st.select(e.shiftKey ? [...new Set([...st.selection, ...ids])] : ids);
          break;
        }
        case 'select':
          if (l.mode === 'marquee') {
            const rect = { minX: Math.min(l.start[0], l.cur[0]), maxX: Math.max(l.start[0], l.cur[0]), minY: Math.min(l.start[1], l.cur[1]), maxY: Math.max(l.start[1], l.cur[1]) };
            if ((rect.maxX - rect.minX) * st.viewport.scale > 3 || (rect.maxY - rect.minY) * st.viewport.scale > 3) {
              const ids = st.items.filter((i) => {
                const b = itemBounds(i);
                return b && rectsIntersect(b, rect);
              }).map((i) => i.id);
              st.select(e.shiftKey ? [...new Set([...st.selection, ...ids])] : ids);
            }
          } else st.endEdit();
          break;
        default:
      }
      live.current = null;
      scheduleLive();
    }
    if (e.pointerType === 'touch') {
      resetGesture();
      const t = tap.current;
      const deliberate = t.spread >= 40 && !guard.current.penActive; // two/three fingers set apart, pen not around
      if (touchPoints().length === 0 && !t.moved && t.max >= 2 && deliberate && performance.now() - t.t0 < 350) {
        if (t.max === 2) st.undo();
        else st.redo();
      }
      if (touchPoints().length === 0) tap.current = { t0: 0, max: 0, moved: false, spread: Infinity };
    }
  };

  return (
    <div
      ref={wrap}
      className="board"
      data-tool={tool}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={bgRef} />
      <canvas ref={inkRef} />
      <canvas ref={liveRef} />
    </div>
  );
}

