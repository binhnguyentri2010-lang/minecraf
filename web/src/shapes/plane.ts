import type { Params, Prim, V } from '../canvas/types';
import {
  angleArc, centroid, COL, dist2, dotAt, K, label, lineIntersect2, mid, num, on, polyPrim, pv, rightAngleMark, txt,
  unit, vertexLabels, type ShapeDef,
} from './util';

// ------------------------------------------------------------------ triangles

export type Tri = { A: V; B: V; C: V };

export const TRIANGLES: Record<string, Tri> = {
  scalene: { B: [0, 0], C: [6, 0], A: [2.5, 4.4] },
  isosceles: { B: [0, 0], C: [6, 0], A: [3, 4.5] },
  equilateral: { B: [0, 0], C: [6, 0], A: [3, 3 * Math.sqrt(3)] },
  right: { A: [0, 0], B: [4, 0], C: [0, 3] },
};

export function triangleCenters({ A, B, C }: Tri) {
  const a = dist2(B, C), b = dist2(A, C), c = dist2(A, B);
  const s = a + b + c;
  const incenter: V = [(a * A[0] + b * B[0] + c * C[0]) / s, (a * A[1] + b * B[1] + c * C[1]) / s];
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  const ux = ((A[0] ** 2 + A[1] ** 2) * (B[1] - C[1]) + (B[0] ** 2 + B[1] ** 2) * (C[1] - A[1]) + (C[0] ** 2 + C[1] ** 2) * (A[1] - B[1])) / d;
  const uy = ((A[0] ** 2 + A[1] ** 2) * (C[0] - B[0]) + (B[0] ** 2 + B[1] ** 2) * (A[0] - C[0]) + (C[0] ** 2 + C[1] ** 2) * (B[0] - A[0])) / d;
  const circumcenter: V = [ux, uy];
  const centroidG = centroid([A, B, C]);
  // orthocenter: H = A + B + C - 2 O
  const orthocenter: V = [A[0] + B[0] + C[0] - 2 * ux, A[1] + B[1] + C[1] - 2 * uy];
  return { a, b, c, incenter, inradius: (2 * area) / s, circumcenter, circumradius: dist2(circumcenter, A), centroid: centroidG, orthocenter, area };
}

export const footOnLine = (P: V, L1: V, L2: V): V => {
  const d = unit([L2[0] - L1[0], L2[1] - L1[1]]);
  const t = (P[0] - L1[0]) * d[0] + (P[1] - L1[1]) * d[1];
  return [L1[0] + d[0] * t, L1[1] + d[1] * t];
};

export function bisectorFoot({ A, B, C }: Tri): V {
  const ab = dist2(A, B), ac = dist2(A, C);
  const t = ab / (ab + ac);
  return [B[0] + (C[0] - B[0]) * t, B[1] + (C[1] - B[1]) * t];
}

type TriMode =
  | 'plain' | 'altitude' | 'median' | 'bisector' | 'perp' | 'incircle' | 'circumcircle' | 'centroid' | 'orthocenter';

function triangleGen(kind: keyof typeof TRIANGLES, mode: TriMode) {
  return (p: Params): Prim[] => {
    const t = TRIANGLES[kind];
    const names = txt(p, 'labels') || 'ABC';
    const P = (v: V) => pv(v[0], v[1]);
    const pts: V[] = [P(t.A), P(t.B), P(t.C)];
    const prims: Prim[] = [polyPrim(pts, { fill: 0.06 })];
    const cen = triangleCenters(t);
    const L = (v: V, s: string, dx = 0, dy = 14) => {
      const q = P(v);
      prims.push(dotAt(q, COL.red), label([q[0] + dx, q[1] + dy], s, 16, { c: COL.red }));
    };
    switch (mode) {
      case 'altitude': {
        const H = footOnLine(t.A, t.B, t.C);
        prims.push({ t: 'line', a: P(t.A), b: P(H), c: COL.red, w: 1.3 });
        prims.push(rightAngleMark(P(H), P(t.A), P(t.C)));
        L(H, 'H');
        break;
      }
      case 'median': {
        const M = mid(t.B, t.C);
        prims.push({ t: 'line', a: P(t.A), b: P(M), c: COL.red, w: 1.3 });
        L(M, 'M');
        break;
      }
      case 'bisector': {
        const D = bisectorFoot(t);
        prims.push({ t: 'line', a: P(t.A), b: P(D), c: COL.red, w: 1.3 });
        prims.push(angleArc(P(t.A), P(t.B), P(D), 22, COL.red), angleArc(P(t.A), P(D), P(t.C), 27, COL.red));
        L(D, 'D');
        break;
      }
      case 'perp': {
        const M = mid(t.B, t.C);
        const dir = unit([-(t.C[1] - t.B[1]), t.C[0] - t.B[0]]);
        const top: V = [M[0] + dir[0] * 4.6, M[1] + dir[1] * 4.6];
        const bottom: V = [M[0] - dir[0] * 1.0, M[1] - dir[1] * 1.0];
        prims.push({ t: 'line', a: P(bottom), b: P(top), c: COL.red, w: 1.3 });
        prims.push(rightAngleMark(P(M), P(t.C), P(top)));
        L(M, 'M');
        break;
      }
      case 'incircle': {
        const I = cen.incenter;
        prims.push({ t: 'ellipse', o: P(I), rx: cen.inradius * K, ry: cen.inradius * K, c: COL.blue });
        L(I, 'I', 0, 14);
        break;
      }
      case 'circumcircle': {
        const O = cen.circumcenter;
        prims.push({ t: 'ellipse', o: P(O), rx: cen.circumradius * K, ry: cen.circumradius * K, c: COL.blue });
        L(O, 'O', 0, 14);
        break;
      }
      case 'centroid': {
        const ms: V[] = [mid(t.B, t.C), mid(t.A, t.C), mid(t.A, t.B)];
        [t.A, t.B, t.C].forEach((v, i) => prims.push({ t: 'line', a: P(v), b: P(ms[i]), c: COL.red, w: 1.1 }));
        ms.forEach((m, i) => prims.push(dotAt(P(m), COL.grey, 2.6), label(vecAdd(P(m), outward(pts, P(m), 13)), ['M', 'N', 'P'][i], 14, { c: COL.grey })));
        L(cen.centroid, 'G');
        break;
      }
      case 'orthocenter': {
        const feet: V[] = [footOnLine(t.A, t.B, t.C), footOnLine(t.B, t.A, t.C), footOnLine(t.C, t.A, t.B)];
        [t.A, t.B, t.C].forEach((v, i) => prims.push({ t: 'line', a: P(v), b: P(feet[i]), c: COL.red, w: 1.1 }));
        L(cen.orthocenter, 'H');
        break;
      }
      default:
    }
    if (kind === 'right') prims.push(rightAngleMark(pts[0], pts[1], pts[2]));
    prims.push(...vertexLabels(pts, names));
    return prims;
  };
}

const vecAdd = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const outward = (poly: V[], p: V, d: number): V => {
  const c = centroid(poly);
  const u = unit([p[0] - c[0], p[1] - c[1]]);
  return [u[0] * d, u[1] * d];
};

const LAB = (def: string) => ({ key: 'labels', label: 'Tên đỉnh', type: 'text' as const, def });

// ------------------------------------------------------------------ quadrilaterals

export const QUADS: Record<string, V[]> = {
  square: [[0, 0], [4, 0], [4, 4], [0, 4]],
  rectangle: [[0, 0], [6, 0], [6, 4], [0, 4]],
  parallelogram: [[0, 0], [5, 0], [6.5, 3.5], [1.5, 3.5]],
  rhombus: [[0, 2], [3, 0], [6, 2], [3, 4]],
  trapezoid: [[0, 0], [6, 0], [4.6, 3.5], [0.8, 3.5]],
  isoTrapezoid: [[0, 0], [6, 0], [4.5, 3.5], [1.5, 3.5]],
};

function quadGen(kind: keyof typeof QUADS) {
  return (p: Params): Prim[] => {
    const pts = QUADS[kind].map((v) => pv(v[0], v[1]));
    const prims: Prim[] = [polyPrim(pts, { fill: 0.06 })];
    if (on(p, 'diag')) {
      prims.push({ t: 'line', a: pts[0], b: pts[2], w: 0.8 }, { t: 'line', a: pts[1], b: pts[3], w: 0.8 });
      const O = lineIntersect2(pts[0], pts[2], pts[1], pts[3]);
      prims.push(dotAt(O, COL.red), label([O[0] + 2, O[1] + 14], 'O', 15, { c: COL.red }));
    }
    if (kind === 'square' || kind === 'rectangle') {
      for (let i = 0; i < 4; i++) prims.push(rightAngleMark(pts[i], pts[(i + 1) % 4], pts[(i + 3) % 4], 10));
    }
    prims.push(...vertexLabels(pts, txt(p, 'labels') || 'ABCD'));
    return prims;
  };
}

const QP = [LAB('ABCD'), { key: 'diag', label: 'Hai đường chéo', type: 'toggle' as const, def: 0 }];

// ------------------------------------------------------------------ others

export function regularPolygon(n: number, R = 3.2): V[] {
  return Array.from({ length: n }, (_, k) => {
    const a = Math.PI / 2 + (2 * Math.PI * k) / n;
    return [R * Math.cos(a), R * Math.sin(a)] as V;
  });
}

export const SHAPES_PLANE: ShapeDef[] = [
  { id: 'tri-scalene', name: 'Tam giác thường', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'plain') },
  { id: 'tri-isosceles', name: 'Tam giác cân', group: 'plane', params: [LAB('ABC')], gen: triangleGen('isosceles', 'plain') },
  { id: 'tri-equilateral', name: 'Tam giác đều', group: 'plane', params: [LAB('ABC')], gen: triangleGen('equilateral', 'plain') },
  { id: 'tri-right', name: 'Tam giác vuông', group: 'plane', params: [LAB('ABC')], gen: triangleGen('right', 'plain') },
  { id: 'tri-altitude', name: 'Đường cao AH', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'altitude') },
  { id: 'tri-median', name: 'Trung tuyến AM', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'median') },
  { id: 'tri-bisector', name: 'Phân giác AD', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'bisector') },
  { id: 'tri-perp', name: 'Trung trực của BC', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'perp') },
  { id: 'tri-centroid', name: 'Trọng tâm G', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'centroid') },
  { id: 'tri-orthocenter', name: 'Trực tâm H', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'orthocenter') },
  { id: 'tri-incircle', name: 'Đường tròn nội tiếp', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'incircle') },
  { id: 'tri-circumcircle', name: 'Đường tròn ngoại tiếp', group: 'plane', params: [LAB('ABC')], gen: triangleGen('scalene', 'circumcircle') },
  { id: 'quad-square', name: 'Hình vuông', group: 'plane', params: QP, gen: quadGen('square') },
  { id: 'quad-rectangle', name: 'Hình chữ nhật', group: 'plane', params: QP, gen: quadGen('rectangle') },
  { id: 'quad-parallelogram', name: 'Hình bình hành', group: 'plane', params: QP, gen: quadGen('parallelogram') },
  { id: 'quad-rhombus', name: 'Hình thoi', group: 'plane', params: QP, gen: quadGen('rhombus') },
  { id: 'quad-trapezoid', name: 'Hình thang', group: 'plane', params: QP, gen: quadGen('trapezoid') },
  { id: 'quad-iso-trapezoid', name: 'Hình thang cân', group: 'plane', params: QP, gen: quadGen('isoTrapezoid') },
  {
    id: 'polygon-regular',
    name: 'Đa giác đều',
    group: 'plane',
    params: [
      { key: 'n', label: 'Số cạnh', type: 'range', min: 3, max: 12, step: 1, def: 5 },
      { key: 'center', label: 'Tâm O', type: 'toggle', def: 0 },
      LAB('ABCDEFGHIJKL'),
    ],
    gen: (p) => {
      const n = Math.round(num(p, 'n'));
      const pts = regularPolygon(n).map((v) => pv(v[0], v[1]));
      const prims: Prim[] = [polyPrim(pts, { fill: 0.06 })];
      if (on(p, 'center')) prims.push(dotAt([0, 0], COL.red), label([2, 14], 'O', 15, { c: COL.red }), { t: 'line', a: [0, 0], b: pts[0], dash: true, w: 0.7 });
      prims.push(...vertexLabels(pts, txt(p, 'labels'), 15, [0, 0]));
      return prims;
    },
  },
  {
    id: 'circle',
    name: 'Đường tròn',
    group: 'plane',
    params: [
      { key: 'radius', label: 'Bán kính OA', type: 'toggle', def: 1 },
      { key: 'diameter', label: 'Đường kính', type: 'toggle', def: 0 },
    ],
    gen: (p) => {
      const R = 3.2 * K;
      const prims: Prim[] = [{ t: 'ellipse', o: [0, 0], rx: R, ry: R, fill: 0.05 }, dotAt([0, 0], COL.red), label([-2, 14], 'O', 16, { c: COL.red })];
      if (on(p, 'radius')) prims.push({ t: 'line', a: [0, 0], b: [R * 0.866, -R * 0.5], w: 0.9 }, dotAt([R * 0.866, -R * 0.5]), label([R * 0.866 + 12, -R * 0.5 - 8], 'A', 16));
      if (on(p, 'diameter')) prims.push({ t: 'line', a: [-R, 0], b: [R, 0], w: 0.9 }, label([-R - 13, 0], 'B', 16), label([R + 13, 0], 'C', 16), dotAt([-R, 0]), dotAt([R, 0]));
      return prims;
    },
  },
  {
    id: 'ellipse',
    name: 'Elip',
    group: 'plane',
    params: [
      { key: 'a', label: 'Bán trục lớn a', type: 'range', min: 1.5, max: 5, step: 0.1, def: 3.6 },
      { key: 'b', label: 'Bán trục nhỏ b', type: 'range', min: 0.8, max: 5, step: 0.1, def: 2.2 },
    ],
    gen: (p) => [{ t: 'ellipse', o: [0, 0], rx: num(p, 'a') * K, ry: num(p, 'b') * K, fill: 0.05 }, dotAt([0, 0], COL.red), label([-2, 14], 'O', 16, { c: COL.red })],
  },
  {
    id: 'sector',
    name: 'Hình quạt tròn',
    group: 'plane',
    params: [{ key: 'angle', label: 'Góc ở tâm (độ)', type: 'range', min: 20, max: 340, step: 5, def: 120 }],
    gen: (p) => {
      const R = 3.2 * K;
      const ang = (num(p, 'angle') * Math.PI) / 180;
      const pts: V[] = [[0, 0]];
      const N = Math.max(8, Math.round(ang * 14));
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * ang;
        pts.push([R * Math.cos(-t), R * Math.sin(-t)]);
      }
      const end = pts[pts.length - 1];
      return [
        polyPrim(pts, { fill: 0.1 }),
        angleArc([0, 0], pts[1], end, 24, COL.red),
        label([36 * Math.cos(-ang / 2), 36 * Math.sin(-ang / 2)], '\\alpha', 15, { c: COL.red }),
        dotAt([0, 0], COL.red),
        label([-4, 14], 'O', 16),
        label([R + 14, 0], 'A', 16),
        label([end[0] + 14 * Math.cos(-ang), end[1] + 14 * Math.sin(-ang)], 'B', 16),
      ];
    },
  },
  {
    id: 'angle',
    name: 'Góc có số đo',
    group: 'plane',
    params: [{ key: 'deg', label: 'Số đo góc (độ)', type: 'range', min: 5, max: 175, step: 5, def: 60 }],
    gen: (p) => {
      const deg = num(p, 'deg');
      const t = (deg * Math.PI) / 180;
      const L = 4.2 * K;
      const A: V = [L, 0];
      const B: V = [L * Math.cos(t), -L * Math.sin(t)];
      const prims: Prim[] = [
        { t: 'line', a: [0, 0], b: A },
        { t: 'line', a: [0, 0], b: B },
        angleArc([0, 0], A, B, 34, COL.red),
        label([56 * Math.cos(t / 2), -56 * Math.sin(t / 2)], `${Math.round(deg)}^\\circ`, 15, { c: COL.red }),
        dotAt([0, 0]),
        label([-6, 14], 'O', 16),
        label([A[0] + 12, 0], 'x', 16),
        label([B[0] + 12 * Math.cos(t), B[1] - 12 * Math.sin(t)], 'y', 16),
      ];
      if (Math.abs(deg - 90) < 1) prims.push(rightAngleMark([0, 0], A, B, 12));
      return prims;
    },
  },
  {
    id: 'segment',
    name: 'Đoạn thẳng AB',
    group: 'plane',
    params: [LAB('AB')],
    gen: (p) => {
      const a: V = [-3 * K, 0], b: V = [3 * K, 0];
      return [{ t: 'line', a, b }, dotAt(a), dotAt(b), ...vertexLabels([a, b], txt(p, 'labels') || 'AB', 16, [0, 14])];
    },
  },
  {
    id: 'ray',
    name: 'Tia Ax',
    group: 'plane',
    params: [],
    gen: () => [{ t: 'arrow', a: [-3 * K, 0], b: [3.6 * K, 0] }, dotAt([-3 * K, 0]), label([-3 * K, 16], 'A', 16), label([3.6 * K + 4, 16], 'x', 16)],
  },
  {
    id: 'line',
    name: 'Đường thẳng d',
    group: 'plane',
    params: [],
    gen: () => [{ t: 'line', a: [-3.6 * K, 0], b: [3.6 * K, 0] }, label([3.4 * K, -16], 'd', 16)],
  },
  {
    id: 'parallel-lines',
    name: 'Hai đường thẳng song song và cát tuyến',
    group: 'plane',
    params: [],
    gen: () => {
      const y1 = -0.9 * K, y2 = 1.1 * K;
      const x = (y: number) => y * 0.55;
      return [
        { t: 'line', a: [-3.4 * K, y1], b: [3.4 * K, y1] },
        { t: 'line', a: [-3.4 * K, y2], b: [3.4 * K, y2] },
        { t: 'line', a: [x(-3.2 * K) - 20, -3.2 * K], b: [x(3.2 * K) - 20, 3.2 * K] },
        label([3.2 * K, y1 - 14], 'a', 16),
        label([3.2 * K, y2 - 14], 'b', 16),
        label([x(-3.2 * K) - 8, -3.2 * K - 12], 'c', 16),
      ];
    },
  },
];
