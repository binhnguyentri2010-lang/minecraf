import type { Prim, V } from '../canvas/types';
import { COL, dotAt, fmt, K, label, num, on, polyPrim, type ShapeDef } from './util';

const PAPER = '#fbfbf8';

function numberLine(a: number, b: number, ca: boolean, cb: boolean): Prim[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const prims: Prim[] = [{ t: 'arrow', a: [-7 * K, 0], b: [7.2 * K, 0], w: 0.7, c: '#28303d' }];
  for (let i = -6; i <= 6; i++) {
    prims.push({ t: 'line', a: [i * K, -4], b: [i * K, 4], w: 0.5, c: '#28303d' });
    prims.push({ t: 'text', o: [i * K, 18], s: fmt(i), size: 12, c: COL.grey });
  }
  prims.push({ t: 'line', a: [lo * K, 0], b: [hi * K, 0], c: COL.blue, w: 2.6 });
  const end = (v: number, closed: boolean) => {
    if (closed) prims.push(dotAt([v * K, 0], COL.blue, 5));
    else prims.push({ t: 'ellipse', o: [v * K, 0], rx: 5, ry: 5, c: PAPER, fill: 1, w: 0 }, { t: 'ellipse', o: [v * K, 0], rx: 5, ry: 5, c: COL.blue, w: 1.2 });
  };
  end(lo, a <= b ? ca : cb);
  end(hi, a <= b ? cb : ca);
  const lc = a <= b ? ca : cb, hc = a <= b ? cb : ca;
  prims.push(label([0, -32], `${lc ? '[' : '('}${fmt(lo)};\\ ${fmt(hi)}${hc ? ']' : ')'}`, 17, { c: COL.blue }));
  return prims;
}

function venn(n: 2 | 3): Prim[] {
  const R = 2 * K;
  const prims: Prim[] = [polyPrim([[-4.4 * K, -3.4 * K], [4.4 * K, -3.4 * K], [4.4 * K, 3.4 * K], [-4.4 * K, 3.4 * K]], { w: 0.8, c: COL.grey }), label([-3.9 * K, -2.9 * K], 'E', 16, { c: COL.grey })];
  const cs: [V, string, string][] =
    n === 2
      ? [[[-1.1 * K, 0], 'A', COL.blue], [[1.1 * K, 0], 'B', COL.orange]]
      : [[[-1.2 * K, -0.7 * K], 'A', COL.blue], [[1.2 * K, -0.7 * K], 'B', COL.orange], [[0, 1.3 * K], 'C', COL.teal]];
  for (const [o, name, c] of cs) {
    prims.push({ t: 'ellipse', o, rx: R, ry: R, fill: 0.12, c });
    prims.push(label([o[0] + (o[0] === 0 ? 0 : Math.sign(o[0]) * 1.1 * K), o[1] - (o[1] > 0 ? -1.2 * K : 1.2 * K)], name, 18, { c }));
  }
  return prims;
}

function probTree(): Prim[] {
  const root: V = [-4 * K, 0];
  const l1: V[] = [[0, -1.7 * K], [0, 1.7 * K]];
  const l2: V[] = [[4 * K, -2.5 * K], [4 * K, -0.9 * K], [4 * K, 0.9 * K], [4 * K, 2.5 * K]];
  const prims: Prim[] = [dotAt(root)];
  l1.forEach((p, i) => {
    prims.push({ t: 'line', a: root, b: p }, dotAt(p));
    prims.push(label([(root[0] + p[0]) / 2 - 8, (root[1] + p[1]) / 2 + (i === 0 ? -16 : 16)], i === 0 ? 'P(A)' : 'P(\\overline{A})', 14, { c: COL.blue }));
    prims.push(label([p[0] - 6, p[1] + (i === 0 ? -16 : 16)], i === 0 ? 'A' : '\\overline{A}', 15));
  });
  l2.forEach((p, i) => {
    const parent = l1[Math.floor(i / 2)];
    prims.push({ t: 'line', a: parent, b: p }, dotAt(p));
    prims.push(label([(parent[0] + p[0]) / 2 + 4, (parent[1] + p[1]) / 2 + (i % 2 === 0 ? -14 : 14)], i % 2 === 0 ? 'P(B|A)' : 'P(\\overline{B}|A)', 13, { c: COL.orange }));
    prims.push(label([p[0] + 34, p[1]], `${Math.floor(i / 2) === 0 ? 'A' : '\\overline{A}'}\\cap ${i % 2 === 0 ? 'B' : '\\overline{B}'}`, 15));
  });
  return prims;
}

function variationTable(): Prim[] {
  const lw = 64, cw = 84, rh = 44;
  const w = lw + 3 * cw, h = rh * 3;
  const x0 = -w / 2, y0 = -h / 2;
  const prims: Prim[] = [polyPrim([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], { fill: 0.03 })];
  for (let i = 1; i < 3; i++) prims.push({ t: 'line', a: [x0, y0 + i * rh], b: [x0 + w, y0 + i * rh], w: 0.6 });
  prims.push({ t: 'line', a: [x0 + lw, y0], b: [x0 + lw, y0 + h], w: 0.6 });
  prims.push(label([x0 + lw / 2, y0 + rh / 2], 'x', 16), label([x0 + lw / 2, y0 + rh * 1.5], 'y′', 16), label([x0 + lw / 2, y0 + rh * 2.5], 'y', 16));
  const xs = [x0 + lw + 14, x0 + lw + 1.5 * cw, x0 + w - 14];
  prims.push(label([xs[0] + 8, y0 + rh / 2], '-\\infty', 14), label([xs[1], y0 + rh / 2], 'x_0', 14), label([xs[2] - 10, y0 + rh / 2], '+\\infty', 14));
  prims.push(label([x0 + lw + 0.75 * cw, y0 + rh * 1.5], '+', 16, { c: COL.teal }), label([xs[1], y0 + rh * 1.5], '0', 14), label([x0 + lw + 2.25 * cw, y0 + rh * 1.5], '−', 16, { c: COL.red }));
  const yTop = y0 + rh * 2 + 12, yBot = y0 + rh * 3 - 12;
  prims.push({ t: 'arrow', a: [xs[0] + 6, yBot], b: [xs[1] - 14, yTop + 6], c: COL.teal }, { t: 'arrow', a: [xs[1] + 14, yTop + 6], b: [xs[2] - 6, yBot], c: COL.red });
  prims.push(label([xs[1], yTop - 2], 'y_{\\max}', 13), label([xs[0] + 6, yBot + 2], '', 12));
  return prims;
}

const ARROW_DEF = (def: number) => ({ key: 'deg', label: 'Hướng (độ)', type: 'range' as const, min: 0, max: 360, step: 5, def });

export const SHAPES_MISC: ShapeDef[] = [
  {
    id: 'vector',
    name: 'Vectơ',
    group: 'misc',
    params: [ARROW_DEF(30), { key: 'len', label: 'Độ dài', type: 'range', min: 1, max: 6, step: 0.5, def: 3.5 }, { key: 'name', label: 'Tên', type: 'text', def: '\\vec{u}' }],
    gen: (p) => {
      const t = (num(p, 'deg') * Math.PI) / 180;
      const L = num(p, 'len') * K;
      const b: V = [L * Math.cos(t), -L * Math.sin(t)];
      return [{ t: 'arrow', a: [0, 0], b, c: COL.blue, w: 1.3 }, label([b[0] / 2 - Math.sin(t) * 16, b[1] / 2 - Math.cos(t) * 16], String(p.name), 17, { c: COL.blue })];
    },
  },
  {
    id: 'vector-parallelogram',
    name: 'Tổng hai vectơ (hình bình hành)',
    group: 'misc',
    params: [],
    gen: () => {
      const O: V = [-2.4 * K, 1.4 * K], A: V = [O[0] + 3.8 * K, O[1] - 0.4 * K], B: V = [O[0] + 1.4 * K, O[1] - 2.6 * K];
      const C: V = [A[0] + B[0] - O[0], A[1] + B[1] - O[1]];
      return [
        { t: 'line', a: A, b: C, dash: true, w: 0.8, c: COL.grey },
        { t: 'line', a: B, b: C, dash: true, w: 0.8, c: COL.grey },
        { t: 'arrow', a: O, b: A, c: COL.blue, w: 1.3 },
        { t: 'arrow', a: O, b: B, c: COL.orange, w: 1.3 },
        { t: 'arrow', a: O, b: C, c: COL.red, w: 1.6 },
        dotAt(O), dotAt(A), dotAt(B), dotAt(C),
        label([O[0] - 12, O[1] + 12], 'O', 16), label([A[0] + 12, A[1] + 10], 'A', 16), label([B[0] - 12, B[1] - 8], 'B', 16), label([C[0] + 12, C[1] - 8], 'C', 16),
        label([0, O[1] + 46], '\\vec{OA}+\\vec{OB}=\\vec{OC}', 17, { c: COL.red }),
      ];
    },
  },
  {
    id: 'vector-triangle',
    name: 'Quy tắc ba điểm (Chasles)',
    group: 'misc',
    params: [],
    gen: () => {
      const A: V = [-3 * K, 1.2 * K], B: V = [0.4 * K, 1.9 * K], C: V = [1.6 * K, -1.8 * K];
      return [
        { t: 'arrow', a: A, b: B, c: COL.blue, w: 1.3 },
        { t: 'arrow', a: B, b: C, c: COL.orange, w: 1.3 },
        { t: 'arrow', a: A, b: C, c: COL.red, w: 1.6 },
        dotAt(A), dotAt(B), dotAt(C),
        label([A[0] - 12, A[1] + 10], 'A', 16), label([B[0] + 4, B[1] + 16], 'B', 16), label([C[0] + 12, C[1] - 8], 'C', 16),
        label([0, 3.6 * K], '\\vec{AB}+\\vec{BC}=\\vec{AC}', 17, { c: COL.red }),
      ];
    },
  },
  {
    id: 'numberline',
    name: 'Trục số – khoảng, đoạn',
    group: 'misc',
    params: [
      { key: 'a', label: 'Đầu trái a', type: 'range', min: -6, max: 6, step: 1, def: -2 },
      { key: 'b', label: 'Đầu phải b', type: 'range', min: -6, max: 6, step: 1, def: 3 },
      { key: 'ca', label: 'Lấy đầu a', type: 'toggle', def: 1 },
      { key: 'cb', label: 'Lấy đầu b', type: 'toggle', def: 0 },
    ],
    gen: (p) => numberLine(num(p, 'a'), num(p, 'b'), on(p, 'ca'), on(p, 'cb')),
  },
  { id: 'venn2', name: 'Biểu đồ Venn (2 tập)', group: 'misc', params: [], gen: () => venn(2) },
  { id: 'venn3', name: 'Biểu đồ Venn (3 tập)', group: 'misc', params: [], gen: () => venn(3) },
  { id: 'prob-tree', name: 'Sơ đồ cây xác suất', group: 'misc', params: [], gen: probTree },
  { id: 'variation-table', name: 'Bảng biến thiên', group: 'misc', params: [], gen: variationTable },
];
