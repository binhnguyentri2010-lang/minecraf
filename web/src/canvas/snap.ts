/** Shape recognition for "hold the pen at the end of a stroke" snapping. Pure functions. */

export interface XY {
  x: number;
  y: number;
}

export interface Recognized {
  kind: 'line' | 'circle' | 'ellipse' | 'polygon' | 'rectangle';
  pts: XY[];
}

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(pts: XY[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

function bbox(pts: XY[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, diag: Math.hypot(maxX - minX, maxY - minY) };
}

function distToSeg(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToPolygon(p: XY, poly: XY[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSeg(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

export function resample(pts: XY[], n: number, closed = false): XY[] {
  const src = closed ? [...pts, pts[0]] : pts;
  const total = pathLength(src);
  if (total === 0) return pts.slice(0, 1);
  const step = total / (closed ? n : n - 1);
  const out: XY[] = [src[0]];
  let acc = 0;
  let need = step;
  for (let i = 1; i < src.length && out.length < n; i++) {
    let a = src[i - 1];
    const b = src[i];
    let seg = dist(a, b);
    while (acc + seg >= need && out.length < n) {
      const t = (need - acc) / seg;
      const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(q);
      a = q;
      seg = dist(a, b);
      acc = 0;
      need = step;
    }
    acc += seg;
  }
  while (out.length < n) out.push(src[src.length - 1]);
  return out;
}

function douglasPeucker(pts: XY[], eps: number): XY[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let idx = -1, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i], a, b);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [a, b];
  const l = douglasPeucker(pts.slice(0, idx + 1), eps);
  const r = douglasPeucker(pts.slice(idx), eps);
  return [...l.slice(0, -1), ...r];
}

function angleAt(prev: XY, cur: XY, next: XY): number {
  const a1 = Math.atan2(prev.y - cur.y, prev.x - cur.x);
  const a2 = Math.atan2(next.y - cur.y, next.x - cur.x);
  let d = Math.abs(a1 - a2);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

function densify(poly: XY[], spacing: number, closed = true): XY[] {
  const out: XY[] = [];
  const n = closed ? poly.length : poly.length - 1;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const steps = Math.max(1, Math.ceil(dist(a, b) / spacing));
    for (let s = 0; s < steps; s++) out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
  }
  out.push(closed ? { ...poly[0] } : { ...poly[poly.length - 1] });
  return out;
}

function ellipsePts(c: XY, a: number, b: number, rot: number, n = 96): XY[] {
  const out: XY[] = [];
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const u = a * Math.cos(t), v = b * Math.sin(t);
    out.push({ x: c.x + u * cs - v * sn, y: c.y + u * sn + v * cs });
  }
  return out;
}

function rectify(c: [XY, XY, XY, XY]): XY[] | null {
  const e = [0, 1, 2, 3].map((i) => ({ x: c[(i + 1) % 4].x - c[i].x, y: c[(i + 1) % 4].y - c[i].y }));
  for (let i = 0; i < 4; i++) {
    const a = angleAt(c[(i + 3) % 4], c[i], c[(i + 1) % 4]);
    if (Math.abs(a - Math.PI / 2) > (18 * Math.PI) / 180) return null;
  }
  const centre = { x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4, y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4 };
  let ux = e[0].x - e[2].x, uy = e[0].y - e[2].y;
  let ul = Math.hypot(ux, uy);
  if (ul === 0) return null;
  ux /= ul;
  uy /= ul;
  // snap to axes when close
  const ang = Math.atan2(uy, ux);
  const q = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
  if (Math.abs(ang - q) < (8 * Math.PI) / 180) {
    ux = Math.cos(q);
    uy = Math.sin(q);
  }
  const vx = -uy, vy = ux;
  let hw = (Math.hypot(e[0].x, e[0].y) + Math.hypot(e[2].x, e[2].y)) / 4;
  let hh = (Math.hypot(e[1].x, e[1].y) + Math.hypot(e[3].x, e[3].y)) / 4;
  if (Math.abs(hw - hh) < 0.1 * Math.max(hw, hh)) hw = hh = (hw + hh) / 2;
  // orientation must follow the original vertex order (sign of e0 along u)
  const s0 = e[0].x * ux + e[0].y * uy >= 0 ? 1 : -1;
  const s1 = e[1].x * vx + e[1].y * vy >= 0 ? 1 : -1;
  const corner = (i: number): XY => {
    const sx = [-1, 1, 1, -1][i] * s0;
    const sy = [-1, -1, 1, 1][i] * s1;
    return { x: centre.x + sx * hw * ux + sy * hh * vx, y: centre.y + sx * hw * uy + sy * hh * vy };
  };
  ul = 0;
  return [corner(0), corner(1), corner(2), corner(3)];
}

/** Algebraic (Kåsa) least-squares circle fit — robust to overshoot at the loop closure. */
export function fitCircle(pts: XY[]): { c: XY; r: number } {
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (const p of pts) {
    const u = p.x - mx, v = p.y - my;
    Suu += u * u;
    Svv += v * v;
    Suv += u * v;
    Suuu += u * u * u;
    Svvv += v * v * v;
    Suvv += u * v * v;
    Svuu += v * u * u;
  }
  const det = 2 * (Suu * Svv - Suv * Suv);
  if (Math.abs(det) < 1e-9) return { c: { x: mx, y: my }, r: Math.sqrt((Suu + Svv) / n) };
  const uc = (Svv * (Suuu + Suvv) - Suv * (Svvv + Svuu)) / det;
  const vc = (Suu * (Svvv + Svuu) - Suv * (Suuu + Suvv)) / det;
  return { c: { x: mx + uc, y: my + vc }, r: Math.sqrt(uc * uc + vc * vc + (Suu + Svv) / n) };
}

export function recognize(raw: XY[]): Recognized | null {
  const pts = raw.filter((p, i) => i === 0 || dist(p, raw[i - 1]) > 0.01);
  if (pts.length < 8) return null;
  const bb = bbox(pts);
  const D = bb.diag;
  if (D < 24) return null;
  const L = pathLength(pts);
  const first = pts[0], last = pts[pts.length - 1];
  const gap = dist(first, last);
  const closed = gap < 0.22 * D && L > 1.8 * D;

  if (!closed) {
    const chord = gap;
    if (chord > 0.9 * L * 0.9 && chord > 24) {
      let dev = 0;
      for (const p of pts) dev = Math.max(dev, distToSeg(p, first, last));
      if (dev < 0.06 * chord && chord / L > 0.88) return { kind: 'line', pts: [{ ...first }, { ...last }] };
    }
    return null;
  }

  const rs = resample(pts, 96, true);
  const cx = rs.reduce((a, p) => a + p.x, 0) / rs.length;
  const cy = rs.reduce((a, p) => a + p.y, 0) / rs.length;
  const fc = fitCircle(rs);
  const radii = rs.map((p) => Math.hypot(p.x - fc.c.x, p.y - fc.c.y));
  const rMean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const rStd = Math.sqrt(radii.reduce((a, b) => a + (b - rMean) ** 2, 0) / radii.length);
  const aspect = bb.w / Math.max(bb.h, 1e-6);

  if (rStd / rMean < 0.075 && aspect > 0.8 && aspect < 1.25) {
    return { kind: 'circle', pts: ellipsePts(fc.c, fc.r, fc.r, 0) };
  }

  // polygon
  let simp = douglasPeucker([...pts.slice(0, -1), pts[0]], 0.05 * D);
  simp = simp.slice(0, -1);
  const merged: XY[] = [];
  for (const p of simp) if (!merged.length || dist(p, merged[merged.length - 1]) > 0.12 * D) merged.push(p);
  if (merged.length > 1 && dist(merged[0], merged[merged.length - 1]) <= 0.12 * D) merged.pop();
  let corners = merged;
  for (let changed = true; changed && corners.length > 3; ) {
    changed = false;
    for (let i = 0; i < corners.length; i++) {
      const a = angleAt(corners[(i + corners.length - 1) % corners.length], corners[i], corners[(i + 1) % corners.length]);
      if (a > (160 * Math.PI) / 180) {
        corners = corners.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  if (corners.length >= 3 && corners.length <= 6) {
    let worst = 0;
    for (const p of pts) worst = Math.max(worst, distToPolygon(p, corners));
    if (worst < 0.08 * D) {
      if (corners.length === 4) {
        const r = rectify(corners as [XY, XY, XY, XY]);
        if (r) return { kind: 'rectangle', pts: densify(r, D / 60) };
      }
      return { kind: 'polygon', pts: densify(corners, D / 60) };
    }
  }

  // ellipse via principal axes
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of rs) {
    sxx += (p.x - cx) ** 2;
    syy += (p.y - cy) ** 2;
    sxy += (p.x - cx) * (p.y - cy);
  }
  let th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const cs = Math.cos(th), sn = Math.sin(th);
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  const uv = rs.map((p) => {
    const u = (p.x - cx) * cs + (p.y - cy) * sn;
    const v = -(p.x - cx) * sn + (p.y - cy) * cs;
    umin = Math.min(umin, u);
    umax = Math.max(umax, u);
    vmin = Math.min(vmin, v);
    vmax = Math.max(vmax, v);
    return { u, v };
  });
  const a = (umax - umin) / 2, b = (vmax - vmin) / 2;
  const cu = (umax + umin) / 2, cv = (vmax + vmin) / 2;
  if (a > 8 && b > 8) {
    const re = uv.map((q) => Math.hypot((q.u - cu) / a, (q.v - cv) / b));
    const mean = re.reduce((s, x) => s + x, 0) / re.length;
    const std = Math.sqrt(re.reduce((s, x) => s + (x - mean) ** 2, 0) / re.length);
    if (Math.abs(mean - 1) < 0.07 && std < 0.09) {
      const q = Math.round(th / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(th - q) < (9 * Math.PI) / 180) th = q;
      const c = { x: cx + cu * Math.cos(th) - cv * Math.sin(th), y: cy + cu * Math.sin(th) + cv * Math.cos(th) };
      return { kind: 'ellipse', pts: ellipsePts(c, a, b, th) };
    }
  }
  return null;
}
