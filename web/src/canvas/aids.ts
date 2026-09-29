import type { Aid, V } from './types';

export const RULER = { len: 480, w: 64 };
export const PROT = { R: 170, base: 24 };

export type AidName = 'ruler' | 'protractor';

export function aidToWorld(a: Aid, lx: number, ly: number): V {
  const c = Math.cos(a.rot), s = Math.sin(a.rot);
  return [a.x + c * lx - s * ly, a.y + s * lx + c * ly];
}

export function worldToAid(a: Aid, wx: number, wy: number): V {
  const dx = wx - a.x, dy = wy - a.y;
  const c = Math.cos(-a.rot), s = Math.sin(-a.rot);
  return [c * dx - s * dy, s * dx + c * dy];
}

/** point about which an aid rotates */
export function aidPivot(which: AidName, a: Aid): V {
  return which === 'ruler' ? aidToWorld(a, RULER.len / 2, RULER.w / 2) : [a.x, a.y];
}

export function handleLocal(which: AidName): V {
  return which === 'ruler' ? [RULER.len + 6, RULER.w / 2] : [PROT.R + 26, PROT.base / 2];
}

export function aidHit(which: AidName, a: Aid, wx: number, wy: number, scale: number, allowBody: boolean): 'rotate' | 'body' | null {
  const [lx, ly] = worldToAid(a, wx, wy);
  const h = handleLocal(which);
  if (Math.hypot(lx - h[0], ly - h[1]) <= 20 / scale) return 'rotate';
  if (!allowBody) return null;
  if (which === 'ruler') return lx >= 0 && lx <= RULER.len && ly >= 0 && ly <= RULER.w ? 'body' : null;
  const inside = ly < 0 ? Math.hypot(lx, ly) <= PROT.R : Math.abs(lx) <= PROT.R && ly <= PROT.base;
  return inside ? 'body' : null;
}

export function rulerEdges(a: Aid): [V, V][] {
  return [
    [aidToWorld(a, 0, 0), aidToWorld(a, RULER.len, 0)],
    [aidToWorld(a, 0, RULER.w), aidToWorld(a, RULER.len, RULER.w)],
  ];
}

/** If (wx, wy) is within `tol` of a ruler edge, return that edge's origin and unit direction (start projected onto the edge). */
export function snapToRuler(a: Aid, wx: number, wy: number, tol: number): { p0: V; d: V } | null {
  for (const [p, q] of rulerEdges(a)) {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    const d: V = [dx / len, dy / len];
    const t = (wx - p[0]) * d[0] + (wy - p[1]) * d[1];
    const px = p[0] + d[0] * t, py = p[1] + d[1] * t;
    if (t >= -tol && t <= len + tol && Math.hypot(wx - px, wy - py) <= tol) return { p0: [px, py], d };
  }
  return null;
}

export function drawRuler(ctx: CanvasRenderingContext2D, a: Aid, scale: number) {
  const { len, w } = RULER;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rot);
  const px = 1 / scale;
  ctx.fillStyle = 'rgba(255, 214, 102, 0.55)';
  ctx.strokeStyle = 'rgba(122, 88, 12, 0.85)';
  ctx.lineWidth = 1.2 * px;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, len, w, 5);
  else ctx.rect(0, 0, len, w);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70, 50, 5, 0.9)';
  ctx.fillStyle = 'rgba(70, 50, 5, 0.9)';
  ctx.lineWidth = px;
  ctx.font = `${11}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.beginPath();
  const cm = 40;
  for (let x = 0; x <= len + 0.01; x += cm / 10) {
    const i = Math.round(x / (cm / 10));
    const tick = i % 10 === 0 ? 15 : i % 5 === 0 ? 10 : 5.5;
    if (i % 10 !== 0 && (cm / 10) * scale < 3) continue;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, tick);
  }
  ctx.stroke();
  for (let x = 0; x <= len + 0.01; x += cm) if (x > 0) ctx.fillText(String(Math.round(x / cm)), x, 18);
  ctx.fillText('cm', 20, 32);
  // rotate handle
  const [hx, hy] = handleLocal('ruler');
  ctx.beginPath();
  ctx.arc(hx, hy, 12 * px, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(122, 88, 12, 0.9)';
  ctx.lineWidth = 1.5 * px;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx, hy, 5 * px, -2.4, 1.2);
  ctx.stroke();
  ctx.restore();
}

export function drawProtractor(ctx: CanvasRenderingContext2D, a: Aid, scale: number) {
  const { R, base } = PROT;
  const px = 1 / scale;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rot);
  ctx.fillStyle = 'rgba(120, 190, 255, 0.28)';
  ctx.strokeStyle = 'rgba(20, 70, 130, 0.85)';
  ctx.lineWidth = 1.2 * px;
  ctx.beginPath();
  ctx.moveTo(-R, base);
  ctx.lineTo(-R, 0);
  ctx.arc(0, 0, R, Math.PI, 2 * Math.PI);
  ctx.lineTo(R, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-R, 0);
  ctx.lineTo(R, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(10, 40, 90, 0.9)';
  ctx.fillStyle = 'rgba(10, 40, 90, 0.9)';
  ctx.lineWidth = px;
  ctx.font = '10px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fine = R * scale * ((Math.PI / 180) as number) >= 2.4;
  ctx.beginPath();
  for (let d = 0; d <= 180; d++) {
    if (!fine && d % 5 !== 0) continue;
    const t = (d * Math.PI) / 180;
    const len = d % 10 === 0 ? 14 : d % 5 === 0 ? 10 : 6;
    const cx = Math.cos(t), sy = -Math.sin(t);
    ctx.moveTo(R * cx, R * sy);
    ctx.lineTo((R - len) * cx, (R - len) * sy);
  }
  ctx.stroke();
  for (let d = 0; d <= 180; d += 10) {
    const t = (d * Math.PI) / 180;
    const cx = Math.cos(t), sy = -Math.sin(t);
    ctx.fillText(String(d), (R - 25) * cx, (R - 25) * sy);
    ctx.fillText(String(180 - d), (R - 42) * cx * 1, (R - 42) * sy * 1);
  }
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.stroke();
  const [hx, hy] = handleLocal('protractor');
  ctx.beginPath();
  ctx.arc(hx, hy, 12 * px, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 70, 130, 0.9)';
  ctx.lineWidth = 1.5 * px;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx, hy, 5 * px, -2.4, 1.2);
  ctx.stroke();
  ctx.restore();
}
