import type { Params, Prim, V } from '../canvas/types';
import { GRID } from '../canvas/types';
import { camera } from '../math/solid3d';
import { tryCompile } from '../math/expr';
import { COL, dotAt, fmt, label, num, on, txt, type ParamDef, type ShapeDef } from './util';

const U = GRID;

export function axesPrims(xr: number, yr: number): Prim[] {
  const prims: Prim[] = [
    { t: 'arrow', a: [-xr * U, 0], b: [xr * U + 18, 0], w: 0.7, c: '#28303d' },
    { t: 'arrow', a: [0, yr * U], b: [0, -yr * U - 18], w: 0.7, c: '#28303d' },
    label([-9, 12], 'O', 13),
    label([xr * U + 24, 12], 'x', 14),
    label([12, -yr * U - 20], 'y', 14),
  ];
  const step = xr > 8 ? 2 : 1;
  for (let i = -xr; i <= xr; i += 1) {
    if (i === 0) continue;
    prims.push({ t: 'line', a: [i * U, -3.5], b: [i * U, 3.5], w: 0.5, c: '#28303d' });
    if (i % step === 0) prims.push({ t: 'text', o: [i * U, 15], s: fmt(i), size: 11, c: COL.grey });
  }
  const ystep = yr > 8 ? 2 : 1;
  for (let i = -yr; i <= yr; i += 1) {
    if (i === 0) continue;
    prims.push({ t: 'line', a: [-3.5, -i * U], b: [3.5, -i * U], w: 0.5, c: '#28303d' });
    if (i % ystep === 0) prims.push({ t: 'text', o: [-13, -i * U], s: fmt(i), size: 11, c: COL.grey });
  }
  return prims;
}

/** Sampled polylines of y=f(x); breaks at NaN, out-of-range values and asymptote jumps. */
export function graphPolys(fn: (x: number) => number, xmin: number, xmax: number, ymax: number, N = 900): V[][] {
  const segs: V[][] = [];
  let cur: V[] = [];
  let prev: number | null = null;
  const flush = () => {
    if (cur.length > 1) segs.push(cur);
    cur = [];
    prev = null;
  };
  for (let i = 0; i <= N; i++) {
    const x = xmin + ((xmax - xmin) * i) / N;
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > ymax) {
      flush();
      continue;
    }
    if (prev !== null && Math.sign(y) !== Math.sign(prev) && Math.abs(y - prev) > ymax * 0.6) flush();
    cur.push([x * U, -y * U]);
    prev = y;
  }
  flush();
  return segs;
}

const curve = (pts: V[], c = COL.blue, dash = false): Prim => ({ t: 'poly', pts, closed: false, c, w: 1.6, dash });

const AX: ParamDef[] = [
  { key: 'axes', label: 'Vẽ hệ trục Oxy', type: 'toggle', def: 1 },
  { key: 'xr', label: 'Phạm vi x', type: 'range', min: 3, max: 12, step: 1, def: 6 },
  { key: 'yr', label: 'Phạm vi y', type: 'range', min: 3, max: 10, step: 1, def: 5 },
];

function frame(p: Params): Prim[] {
  return on(p, 'axes') ? axesPrims(num(p, 'xr'), num(p, 'yr')) : [];
}
const tag = (p: Params, s: string): Prim => label([(num(p, 'xr') - 0.3) * U, -(num(p, 'yr') - 0.5) * U], s, 16, { c: COL.blue, anchor: 'end' });

function signed(n: number, first: boolean, v: string): string {
  if (n === 0) return '';
  const a = Math.abs(n);
  const coef = a === 1 && v ? '' : fmt(a);
  const sign = n < 0 ? '−' : first ? '' : '+';
  return `${sign}${coef}${v}`;
}

function polyLabel(cs: [number, string][]): string {
  let s = '';
  for (const [c, v] of cs) s += signed(c, s === '', v);
  return s || '0';
}

function fnShape(id: string, name: string, extra: ParamDef[], f: (p: Params) => { fn: (x: number) => number; text: string }): ShapeDef {
  return {
    id,
    name,
    group: 'coord',
    atOrigin: true,
    params: [...extra, ...AX],
    gen: (p) => {
      const { fn, text } = f(p);
      const xr = num(p, 'xr');
      const yr = num(p, 'yr');
      return [...frame(p), ...graphPolys(fn, -xr, xr, yr + 1).map((s) => curve(s)), tag(p, text)];
    },
  };
}

const r = (key: string, label_: string, min: number, max: number, step: number, def: number): ParamDef => ({ key, label: label_, type: 'range', min, max, step, def });

export function oxyzPrims(az: number, el: number): Prim[] {
  const cam = camera(az, el);
  const L = 110;
  const ax = (v: [number, number, number], name: string): Prim[] => {
    const q = cam.proj(v);
    const end: V = [q[0] * L, q[1] * L];
    const len = Math.hypot(end[0], end[1]) || 1;
    return [{ t: 'arrow', a: [0, 0], b: end, w: 0.9 }, label([end[0] + (end[0] / len) * 14, end[1] + (end[1] / len) * 14], name, 16)];
  };
  return [...ax([1, 0, 0], 'x'), ...ax([0, 1, 0], 'y'), ...ax([0, 0, 1], 'z'), label([-11, 12], 'O', 15), dotAt([0, 0], COL.red, 2.8)];
}

export const SHAPES_COORD: ShapeDef[] = [
  {
    id: 'oxy',
    name: 'Hệ trục toạ độ Oxy',
    group: 'coord',
    atOrigin: true,
    params: AX.slice(1),
    gen: (p) => axesPrims(num(p, 'xr'), num(p, 'yr')),
  },
  {
    id: 'oxyz',
    name: 'Hệ trục toạ độ Oxyz',
    group: 'coord',
    params: [r('az', 'Xoay ngang', -180, 180, 2, -35), r('el', 'Nhìn từ trên xuống', -60, 80, 2, 22)],
    gen: (p) => oxyzPrims(num(p, 'az'), num(p, 'el')),
  },
  fnShape('fn-linear', 'Hàm bậc nhất y = ax + b', [r('a', 'a', -4, 4, 0.5, 1), r('b', 'b', -5, 5, 0.5, 1)], (p) => ({
    fn: (x) => num(p, 'a') * x + num(p, 'b'),
    text: `y=${polyLabel([[num(p, 'a'), 'x'], [num(p, 'b'), '']])}`,
  })),
  fnShape('fn-quadratic', 'Hàm bậc hai y = ax² + bx + c', [r('a', 'a', -3, 3, 0.25, 1), r('b', 'b', -6, 6, 0.5, -2), r('c', 'c', -5, 5, 0.5, -1)], (p) => ({
    fn: (x) => num(p, 'a') * x * x + num(p, 'b') * x + num(p, 'c'),
    text: `y=${polyLabel([[num(p, 'a'), 'x^2'], [num(p, 'b'), 'x'], [num(p, 'c'), '']])}`,
  })),
  fnShape('fn-cubic', 'Hàm bậc ba y = x³ − 3x', [], () => ({ fn: (x) => x ** 3 - 3 * x, text: 'y=x^3-3x' })),
  fnShape('fn-sqrt', 'Hàm căn y = √x', [], () => ({ fn: Math.sqrt, text: 'y=\\sqrt{x}' })),
  fnShape('fn-recip', 'Hàm y = 1/x', [], () => ({ fn: (x) => 1 / x, text: 'y=\\frac{1}{x}' })),
  fnShape('fn-abs', 'Hàm y = |x|', [], () => ({ fn: Math.abs, text: 'y=|x|' })),
  fnShape('fn-exp', 'Hàm mũ y = aˣ', [r('a', 'Cơ số a', 0.2, 4, 0.1, 2)], (p) => ({
    fn: (x) => Math.pow(num(p, 'a'), x),
    text: `y=${fmt(num(p, 'a'))}^{x}`,
  })),
  fnShape('fn-log', 'Hàm logarit y = logₐx', [r('a', 'Cơ số a', 0.2, 8, 0.1, 2)], (p) => {
    const a = Math.abs(num(p, 'a') - 1) < 0.05 ? 1.05 : num(p, 'a');
    return { fn: (x) => Math.log(x) / Math.log(a), text: `y=\\log_{${fmt(a)}}x` };
  }),
  fnShape('fn-sin', 'y = sin x', [], () => ({ fn: Math.sin, text: 'y=\\sin x' })),
  fnShape('fn-cos', 'y = cos x', [], () => ({ fn: Math.cos, text: 'y=\\cos x' })),
  fnShape('fn-tan', 'y = tan x', [], () => ({ fn: Math.tan, text: 'y=\\tan x' })),
  fnShape('fn-cot', 'y = cot x', [], () => ({ fn: (x) => 1 / Math.tan(x), text: 'y=\\cot x' })),
  {
    id: 'fn-custom',
    name: 'Đồ thị y = f(x) tuỳ ý',
    group: 'coord',
    atOrigin: true,
    params: [{ key: 'expr', label: 'y =', type: 'text', def: 'x^2 - 2x' }, ...AX],
    gen: (p) => {
      const c = tryCompile(txt(p, 'expr'));
      const xr = num(p, 'xr');
      const yr = num(p, 'yr');
      if ('error' in c) return [...frame(p), label([0, 0], c.error, 15, { c: COL.red })];
      return [
        ...frame(p),
        ...graphPolys(c.fn, -xr, xr, yr + 1).map((s) => curve(s)),
        { t: 'text', o: [(xr - 0.3) * U, -(yr - 0.5) * U], s: `y=${txt(p, 'expr').replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, '')}`, size: 15, anchor: 'end', c: COL.blue },
      ];
    },
  },
  {
    id: 'conic-parabola',
    name: 'Parabol y² = 2px',
    group: 'coord',
    atOrigin: true,
    params: [r('p', 'p', 0.5, 4, 0.25, 1.5), ...AX],
    gen: (p) => {
      const pp = num(p, 'p');
      const yr = num(p, 'yr');
      const xr = num(p, 'xr');
      const pts: V[] = [];
      for (let i = 0; i <= 200; i++) {
        const y = -yr + (2 * yr * i) / 200;
        const x = (y * y) / (2 * pp);
        if (x <= xr) pts.push([x * U, -y * U]);
      }
      return [
        ...frame(p),
        curve(pts),
        { t: 'line', a: [(-pp / 2) * U, yr * U], b: [(-pp / 2) * U, -yr * U], dash: true, c: COL.grey, w: 0.8 },
        dotAt([(pp / 2) * U, 0], COL.red),
        label([(pp / 2) * U + 4, 16], 'F', 15, { c: COL.red }),
        label([(-pp / 2) * U - 10, -yr * U + 10], 'd', 15, { c: COL.grey }),
        tag(p, `y^2=${fmt(2 * pp)}x`),
      ];
    },
  },
  {
    id: 'conic-ellipse',
    name: 'Elip x²/a² + y²/b² = 1',
    group: 'coord',
    atOrigin: true,
    params: [r('a', 'a', 1, 6, 0.5, 4), r('b', 'b', 1, 6, 0.5, 2.5), ...AX],
    gen: (p) => {
      const a = num(p, 'a');
      const b = num(p, 'b');
      const c = Math.sqrt(Math.abs(a * a - b * b));
      const horiz = a >= b;
      const f1: V = horiz ? [-c * U, 0] : [0, c * U];
      const f2: V = horiz ? [c * U, 0] : [0, -c * U];
      return [
        ...frame(p),
        { t: 'ellipse', o: [0, 0], rx: a * U, ry: b * U, c: COL.blue, w: 1.6 },
        dotAt(f1, COL.red),
        dotAt(f2, COL.red),
        label([f1[0], f1[1] + 15], 'F_1', 14, { c: COL.red }),
        label([f2[0], f2[1] + 15], 'F_2', 14, { c: COL.red }),
        tag(p, `\\frac{x^2}{${fmt(a * a)}}+\\frac{y^2}{${fmt(b * b)}}=1`),
      ];
    },
  },
  {
    id: 'conic-hyperbola',
    name: 'Hypebol x²/a² − y²/b² = 1',
    group: 'coord',
    atOrigin: true,
    params: [r('a', 'a', 1, 4, 0.5, 2), r('b', 'b', 1, 4, 0.5, 1.5), ...AX],
    gen: (p) => {
      const a = num(p, 'a');
      const b = num(p, 'b');
      const xr = num(p, 'xr');
      const yr = num(p, 'yr');
      const c = Math.sqrt(a * a + b * b);
      const branch = (sgn: number): V[] => {
        const pts: V[] = [];
        for (let i = -120; i <= 120; i++) {
          const t = i / 40;
          const x = sgn * a * Math.cosh(t);
          const y = b * Math.sinh(t);
          if (Math.abs(x) <= xr && Math.abs(y) <= yr + 1) pts.push([x * U, -y * U]);
        }
        return pts;
      };
      const k = b / a;
      const ex = Math.min(xr, (yr + 1) / k);
      return [
        ...frame(p),
        curve(branch(1)),
        curve(branch(-1)),
        { t: 'line', a: [-ex * U, k * ex * U], b: [ex * U, -k * ex * U], dash: true, c: COL.grey, w: 0.8 },
        { t: 'line', a: [-ex * U, -k * ex * U], b: [ex * U, k * ex * U], dash: true, c: COL.grey, w: 0.8 },
        dotAt([-c * U, 0], COL.red),
        dotAt([c * U, 0], COL.red),
        label([-c * U, 15], 'F_1', 14, { c: COL.red }),
        label([c * U, 15], 'F_2', 14, { c: COL.red }),
        tag(p, `\\frac{x^2}{${fmt(a * a)}}-\\frac{y^2}{${fmt(b * b)}}=1`),
      ];
    },
  },
  {
    id: 'conic-circle',
    name: 'Đường tròn (x−a)² + (y−b)² = R²',
    group: 'coord',
    atOrigin: true,
    params: [r('a', 'a', -4, 4, 0.5, 1), r('b', 'b', -4, 4, 0.5, 1), r('R', 'R', 0.5, 5, 0.5, 2.5), ...AX],
    gen: (p) => {
      const a = num(p, 'a');
      const b = num(p, 'b');
      const R = num(p, 'R');
      return [
        ...frame(p),
        { t: 'ellipse', o: [a * U, -b * U], rx: R * U, ry: R * U, c: COL.blue, w: 1.6 },
        dotAt([a * U, -b * U], COL.red),
        label([a * U + 3, -b * U + 15], 'I', 15, { c: COL.red }),
        tag(p, `(x${a === 0 ? '' : a > 0 ? '−' + fmt(a) : '+' + fmt(-a)})^2+(y${b === 0 ? '' : b > 0 ? '−' + fmt(b) : '+' + fmt(-b)})^2=${fmt(R * R)}`),
      ];
    },
  },
];
