import { useEffect, useRef } from 'react';
import { clampScale, screenToWorld, strokeHit, transformViewport } from './geometry';
import { drawBackground, drawStroke, setViewTransform } from './render';
import { useBoard } from './store';
import type { Stroke } from './types';

const ERASER_PX = 14;

interface Live {
  id: number;
  erase: boolean;
  stroke: Stroke | null;
  predicted: { x: number; y: number; p: number }[];
}

export function Board() {
  const wrap = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
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
    for (const s of st.strokes) drawStroke(ctx, s);
  };

  const drawLive = () => {
    raf.current.live = 0;
    const c = liveRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const l = live.current;
    if (!l?.stroke) return;
    setViewTransform(ctx, useBoard.getState().viewport, size.current.dpr);
    drawStroke(ctx, { ...l.stroke, pts: [...l.stroke.pts, ...l.predicted] }, false);
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
      if (s.strokes !== p.strokes || s.viewport !== p.viewport || s.background !== p.background)
        scheduleBase();
      if (s.viewport !== p.viewport) scheduleLive();
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
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      const st = useBoard.getState();
      if (e.shiftKey) st.redo();
      else st.undo();
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

  const touchPoints = () => [...pointers.current.values()].filter((p) => p.type === 'touch');

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
    const ids = st.strokes.filter((s) => strokeHit(s, w.x, w.y, r)).map((s) => s.id);
    st.removeLive(ids);
  };

  const cancelLive = () => {
    const l = live.current;
    if (!l) return;
    if (l.erase) useBoard.getState().commitErase();
    live.current = null;
    scheduleLive();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const st = useBoard.getState();
    if (e.pointerType === 'pen' && !st.pencilOnly) st.setPencilOnly(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: e.pointerType });

    if (e.pointerType === 'touch') {
      const multi = touchPoints().length >= 2;
      if (multi) cancelLive();
      if (multi || useBoard.getState().pencilOnly) {
        resetGesture();
        return;
      }
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (live.current) return;

    const erase = st.tool === 'eraser' || (e.buttons & 32) !== 0;
    if (erase) {
      live.current = { id: e.pointerId, erase: true, stroke: null, predicted: [] };
      eraseAt(p.x, p.y);
      return;
    }
    const w = screenToWorld(st.viewport, p.x, p.y);
    const isPen = e.pointerType === 'pen';
    live.current = {
      id: e.pointerId,
      erase: false,
      predicted: [],
      stroke: {
        id: crypto.randomUUID(),
        seq: st.nextSeq(),
        color: st.color,
        kind: st.tool === 'highlighter' ? 'highlighter' : 'pen',
        size: st.tool === 'highlighter' ? Math.max(st.size * 5, 14) : st.size,
        pen: isPen,
        pts: [{ x: w.x, y: w.y, p: isPen ? e.pressure || 0.5 : 0.5 }],
      },
    };
    scheduleLive();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const known = pointers.current.get(e.pointerId);
    const p = local(e);
    if (known) {
      known.x = p.x;
      known.y = p.y;
    }
    const st = useBoard.getState();

    const t = touchPoints();
    if (e.pointerType === 'touch' && gesture.current && (st.pencilOnly || t.length >= 2)) {
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

    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    const native = e.nativeEvent;
    const evs = native.getCoalescedEvents?.() ?? [];
    const list = evs.length ? evs : [native];
    if (l.erase) {
      for (const ev of list) {
        const q = local(ev);
        eraseAt(q.x, q.y);
      }
      return;
    }
    const stroke = l.stroke!;
    const vp = st.viewport;
    const isPen = e.pointerType === 'pen';
    for (const ev of list) {
      const q = local(ev);
      const w = screenToWorld(vp, q.x, q.y);
      stroke.pts.push({ x: w.x, y: w.y, p: isPen ? ev.pressure || 0.5 : 0.5 });
    }
    const pred = native.getPredictedEvents?.() ?? [];
    l.predicted = pred.map((ev) => {
      const q = local(ev);
      const w = screenToWorld(vp, q.x, q.y);
      return { x: w.x, y: w.y, p: isPen ? ev.pressure || 0.5 : 0.5 };
    });
    scheduleLive();
  };

  const finish = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const l = live.current;
    if (l && l.id === e.pointerId) {
      if (l.erase) useBoard.getState().commitErase();
      else if (l.stroke) useBoard.getState().commitStroke(l.stroke);
      live.current = null;
      scheduleLive();
    }
    if (e.pointerType === 'touch') resetGesture();
  };

  return (
    <div
      ref={wrap}
      className="board"
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
