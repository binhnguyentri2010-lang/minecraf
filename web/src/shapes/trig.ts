import type { Prim, V } from '../canvas/types';
import { angleArc, COL, dotAt, fmt, label, num, on, polyPrim, pv, rightAngleMark, type ShapeDef } from './util';

const R = 110;

export const KEY_ANGLES: [number, [number, number]][] = [
  [0, [0, 1]], [30, [1, 6]], [45, [1, 4]], [60, [1, 3]], [90, [1, 2]], [120, [2, 3]], [135, [3, 4]], [150, [5, 6]],
  [180, [1, 1]], [210, [7, 6]], [225, [5, 4]], [240, [4, 3]], [270, [3, 2]], [300, [5, 3]], [315, [7, 4]], [330, [11, 6]],
];

export function radianTex([n, d]: [number, number]): string {
  if (n === 0) return '0';
  const top = n === 1 ? '\\pi' : `${n}\\pi`;
  return d === 1 ? top : `\\frac{${top}}{${d}}`;
}

export function unitCirclePrims(deg: number, labels: boolean): Prim[] {
  const a = (deg * Math.PI) / 180;
  const M: V = [R * Math.cos(a), -R * Math.sin(a)];
  const H: V = [M[0], 0];
  const prims: Prim[] = [
    { t: 'ellipse', o: [0, 0], rx: R, ry: R, fill: 0.04 },
    { t: 'arrow', a: [-R - 34, 0], b: [R + 40, 0], w: 0.6, c: '#28303d' },
    { t: 'arrow', a: [0, R + 34], b: [0, -R - 40], w: 0.6, c: '#28303d' },
    label([R + 46, 12], 'x', 14),
    label([12, -R - 44], 'y', 14),
    label([-10, 12], 'O', 14),
  ];
  for (const [d, frac] of KEY_ANGLES) {
    const t = (d * Math.PI) / 180;
    const c = Math.cos(t), s = Math.sin(t);
    prims.push(dotAt([R * c, -R * s], COL.grey, 2.2));
    if (labels) {
      const off = d % 90 === 0 ? 25 : 22;
      prims.push({ t: 'text', o: [(R + off) * c + (d === 0 ? 4 : 0), -(R + off) * s + (d === 90 ? -2 : 0)], s: radianTex(frac), math: true, size: 12, c: COL.grey });
      if (d % 90 !== 0) prims.push({ t: 'text', o: [R * 0.7 * c, -R * 0.7 * s], s: `${d}^\\circ`, math: true, size: 10, c: '#8a93a3' });
    }
  }
  prims.push(label([R + 12, -12], 'A', 14));
  if (deg > 0 && deg <= 360) prims.push({ t: 'ellipse', o: [0, 0], rx: 26, ry: 26, a0: -a, a1: 0, c: COL.red, w: 0.8 });
  prims.push({ t: 'line', a: [0, 0], b: M, c: COL.red, w: 1.3 });
  prims.push({ t: 'line', a: [0, 0], b: H, c: COL.teal, w: 1.7 });
  prims.push({ t: 'line', a: H, b: M, c: COL.blue, w: 1.7 });
  const cosA = Math.cos(a);
  if (Math.abs(cosA) > 0.02) {
    const T: V = [R, -R * Math.tan(a)];
    prims.push({ t: 'line', a: [R, 0], b: T, c: COL.orange, w: 1.4 });
    prims.push({ t: 'line', a: M, b: T, c: COL.red, w: 0.7, dash: true });
    prims.push(dotAt(T, COL.orange), label([T[0] + 14, T[1]], 'T', 14, { c: COL.orange }));
  }
  prims.push(dotAt(M, COL.red, 4), label([M[0] + Math.cos(a) * 14, M[1] - Math.sin(a) * 14], 'M', 15, { c: COL.red }));
  prims.push(dotAt(H, COL.teal, 2.8), label([H[0], H[1] + (Math.sin(a) >= 0 ? 14 : -14)], 'H', 14, { c: COL.teal }));
  const s = Math.sin(a);
  const tan = Math.abs(cosA) > 0.02 ? fmt(Math.tan(a)) : '\\text{không xác định}';
  const cot = Math.abs(s) > 0.02 ? fmt(cosA / s) : '\\text{không xác định}';
  const y0 = R + 78;
  prims.push(
    label([0, y0], `\\alpha=${Math.round(deg)}^\\circ`, 15, { c: COL.red }),
    label([0, y0 + 24], `\\sin\\alpha=${fmt(s)}\\quad\\cos\\alpha=${fmt(cosA)}`, 15),
    label([0, y0 + 48], `\\tan\\alpha=${tan}\\quad\\cot\\alpha=${cot}`, 15),
  );
  return prims;
}

const TABLE_COLS = [0, 30, 45, 60, 90];
const TABLE_VALUES: Record<string, string[]> = {
  '\\sin': ['0', '\\frac{1}{2}', '\\frac{\\sqrt{2}}{2}', '\\frac{\\sqrt{3}}{2}', '1'],
  '\\cos': ['1', '\\frac{\\sqrt{3}}{2}', '\\frac{\\sqrt{2}}{2}', '\\frac{1}{2}', '0'],
  '\\tan': ['0', '\\frac{\\sqrt{3}}{3}', '1', '\\sqrt{3}', '\\text{—}'],
  '\\cot': ['\\text{—}', '\\sqrt{3}', '1', '\\frac{\\sqrt{3}}{3}', '0'],
};

export function trigTablePrims(): Prim[] {
  const cw = 74, ch = 44, lw = 64;
  const rows = ['', ...Object.keys(TABLE_VALUES)];
  const w = lw + cw * TABLE_COLS.length;
  const h = ch * rows.length;
  const x0 = -w / 2, y0 = -h / 2;
  const prims: Prim[] = [polyPrim([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], { fill: 0.03 })];
  for (let i = 1; i < rows.length; i++) prims.push({ t: 'line', a: [x0, y0 + i * ch], b: [x0 + w, y0 + i * ch], w: 0.5 });
  for (let j = 0; j < TABLE_COLS.length; j++) prims.push({ t: 'line', a: [x0 + lw + j * cw, y0], b: [x0 + lw + j * cw, y0 + h], w: 0.5 });
  prims.push(label([x0 + lw / 2, y0 + ch / 2], '\\alpha', 16, { c: COL.blue }));
  TABLE_COLS.forEach((d, j) => prims.push(label([x0 + lw + cw * (j + 0.5), y0 + ch / 2], `${d}^\\circ`, 15, { c: COL.blue })));
  Object.entries(TABLE_VALUES).forEach(([fn, vals], i) => {
    prims.push(label([x0 + lw / 2, y0 + ch * (i + 1.5)], `${fn}\\alpha`, 15, { c: COL.blue }));
    vals.forEach((v, j) => prims.push(label([x0 + lw + cw * (j + 0.5), y0 + ch * (i + 1.5)], v, 15)));
  });
  return prims;
}

export const SHAPES_TRIG: ShapeDef[] = [
  {
    id: 'unit-circle',
    name: 'Đường tròn lượng giác',
    group: 'trig',
    params: [
      { key: 'angle', label: 'Góc α (độ)', type: 'range', min: 0, max: 360, step: 5, def: 50 },
      { key: 'labels', label: 'Các góc đặc biệt', type: 'toggle', def: 1 },
    ],
    gen: (p) => unitCirclePrims(num(p, 'angle'), on(p, 'labels')),
  },
  { id: 'trig-table', name: 'Bảng giá trị lượng giác', group: 'trig', params: [], gen: () => trigTablePrims() },
  {
    id: 'right-triangle-trig',
    name: 'Tỉ số lượng giác trong tam giác vuông',
    group: 'trig',
    params: [],
    gen: () => {
      const A = pv(0, 0), C = pv(4.6, 0), B = pv(4.6, 3.2);
      return [
        polyPrim([A, C, B], { fill: 0.06 }),
        rightAngleMark(C, A, B),
        angleArc(A, C, B, 30, COL.red),
        label([46, -8], '\\alpha', 15, { c: COL.red }),
        label([A[0] - 12, A[1] + 12], 'A', 17),
        label([C[0] + 12, C[1] + 12], 'C', 17),
        label([B[0] + 12, B[1] - 12], 'B', 17),
        label([(A[0] + C[0]) / 2, 16], 'b\\ (\\text{kề})', 14, { c: COL.teal }),
        label([C[0] + 40, (C[1] + B[1]) / 2], 'a\\ (\\text{đối})', 14, { c: COL.blue }),
        label([(A[0] + B[0]) / 2 - 42, (A[1] + B[1]) / 2 - 14], 'c\\ (\\text{huyền})', 14, { c: COL.orange }),
        label([0, 46], '\\sin\\alpha=\\frac{a}{c}\\quad\\cos\\alpha=\\frac{b}{c}', 15),
        label([0, 84], '\\tan\\alpha=\\frac{a}{b}\\quad\\cot\\alpha=\\frac{b}{a}', 15),
      ];
    },
  },
];
