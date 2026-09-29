import type { Params, Prim, V } from '../canvas/types';
import { primBounds } from '../canvas/objects';
import {
  box, lerp3, lineIntersection, prism3, pyramid3, pyramid4, regularTetrahedron, solidPrims, tetrahedron,
  type Base, type ExtraLine, type Solid, type SolidOpts, type V3,
} from '../math/solid3d';
import { COL, dotAt, label, num, on, type ParamDef, type ShapeDef } from './util';

const view = (az: number, el: number): ParamDef[] => [
  { key: 'az', label: 'Xoay ngang', type: 'range', min: -180, max: 180, step: 2, def: az },
  { key: 'el', label: 'Nhìn từ trên xuống', type: 'range', min: -60, max: 80, step: 2, def: el },
  { key: 'labels', label: 'Tên đỉnh', type: 'toggle', def: 1 },
];

const opts = (p: Params, extra: Partial<SolidOpts> = {}): SolidOpts => ({
  az: num(p, 'az'),
  el: num(p, 'el'),
  labels: on(p, 'labels'),
  ...extra,
});

const bottomOf = (prims: Prim[]) => Math.max(...prims.map((q) => primBounds(q).maxY));

function plain(solid: Solid, az: number, el: number): ShapeDef['gen'] {
  void az;
  void el;
  return (p) => solidPrims(solid, opts(p));
}

// ------------------------------------------------------------------ Bài 2: giao tuyến trong tứ diện

export function bai2Points() {
  const S = tetrahedron();
  const { A, B, C, D } = S.verts;
  const M = lerp3(A, B, 0.45);
  const N = lerp3(C, D, 0.45);
  const P = lerp3(A, D, 0.55);
  const I = lineIntersection(A, N, C, P);
  const J = lineIntersection(D, M, B, P);
  return { S, A, B, C, D, M, N, P, I, J };
}

function bai2(cau: 'a' | 'b' | 'c'): ShapeDef['gen'] {
  return (p) => {
    const { S, M, N, P, I, J } = bai2Points();
    const aux = { c: COL.teal, dash: true, w: 0.7 };
    let o: Partial<SolidOpts>;
    let concl: string;
    if (cau === 'a') {
      o = {
        extraPts: { M, N },
        planes: [{ pts: ['A', 'B', 'N'], c: COL.blue }, { pts: ['C', 'D', 'M'], c: COL.orange }],
        extraLines: [{ a: 'M', b: 'N', c: COL.red, w: 2.2 }],
        labelColors: { M: COL.red, N: COL.red },
        texts: [{ pts: ['A', 'B', 'N'], s: '(ABN)', c: COL.blue }, { pts: ['C', 'D', 'M'], s: '(CDM)', c: COL.orange }],
      };
      concl = '(ABN)\\cap(CDM)=MN';
    } else if (cau === 'b') {
      o = {
        extraPts: { N, P, I },
        planes: [{ pts: ['A', 'B', 'N'], c: COL.blue }, { pts: ['B', 'C', 'P'], c: COL.orange }],
        extraLines: [{ a: 'A', b: 'N', ...aux }, { a: 'C', b: 'P', ...aux }, { a: 'B', b: 'I', c: COL.red, w: 2.2, ext: 1.12 } as ExtraLine],
        labelColors: { I: COL.red, B: COL.red },
        texts: [{ pts: ['A', 'B', 'N'], s: '(ABN)', c: COL.blue }, { pts: ['B', 'C', 'P'], s: '(BCP)', c: COL.orange }],
      };
      concl = 'I=AN\\cap CP\\Rightarrow(ABN)\\cap(BCP)=BI';
    } else {
      o = {
        extraPts: { M, P, J },
        planes: [{ pts: ['C', 'D', 'M'], c: COL.blue }, { pts: ['B', 'C', 'P'], c: COL.orange }],
        extraLines: [{ a: 'D', b: 'M', ...aux }, { a: 'B', b: 'P', ...aux }, { a: 'C', b: 'J', c: COL.red, w: 2.2, ext: 1.22 } as ExtraLine],
        labelColors: { J: COL.red, C: COL.red },
        texts: [{ pts: ['C', 'D', 'M'], s: '(CDM)', c: COL.blue }, { pts: ['B', 'C', 'P'], s: '(BCP)', c: COL.orange }],
      };
      concl = 'J=DM\\cap BP\\Rightarrow(CDM)\\cap(BCP)=CJ';
    }
    const prims = solidPrims(S, opts(p, o));
    prims.push(label([0, bottomOf(prims) + 26], concl, 16, { c: COL.red }));
    return prims;
  };
}

function pyramidSection(): ShapeDef['gen'] {
  return (p) => {
    const S = pyramid4('square');
    const { A, B, C, D } = S.verts;
    const O = lineIntersection(A, C, B, D);
    const baseHidden = num(p, 'el') > 0;
    const prims = solidPrims(S, opts(p, {
      extraPts: { O },
      planes: [{ pts: ['S', 'A', 'C'], c: COL.blue }, { pts: ['S', 'B', 'D'], c: COL.orange }],
      extraLines: [
        { a: 'A', b: 'C', c: COL.teal, dash: baseHidden, w: 0.8 },
        { a: 'B', b: 'D', c: COL.teal, dash: baseHidden, w: 0.8 },
        { a: 'S', b: 'O', c: COL.red, w: 2.2 },
      ],
      labelColors: { O: COL.red, S: COL.red },
      texts: [{ pts: ['S', 'A', 'C'], s: '(SAC)', c: COL.blue }, { pts: ['S', 'B', 'D'], s: '(SBD)', c: COL.orange }],
    }));
    prims.push(label([0, bottomOf(prims) + 26], 'O=AC\\cap BD\\Rightarrow(SAC)\\cap(SBD)=SO', 16, { c: COL.red }));
    return prims;
  };
}

function pyramidWithDiagonals(kind: Base): ShapeDef['gen'] {
  return (p) => {
    const S = pyramid4(kind);
    if (!on(p, 'diag')) return solidPrims(S, opts(p));
    const { A, B, C, D } = S.verts;
    const O = lineIntersection(A, C, B, D);
    const hid = num(p, 'el') > 0;
    return solidPrims(S, opts(p, {
      extraPts: { O },
      extraLines: [
        { a: 'A', b: 'C', dash: hid, w: 0.8 },
        { a: 'B', b: 'D', dash: hid, w: 0.8 },
        { a: 'S', b: 'O', c: COL.red, w: 1.3 },
      ],
      labelColors: { O: COL.red },
    }));
  };
}

// ------------------------------------------------------------------ analytic solids

const R0 = 70;
const H0 = 170;
const frontArc = (el: number): [number, number] => (el >= 0 ? [0, Math.PI] : [Math.PI, 2 * Math.PI]);
const backArc = (el: number): [number, number] => (el >= 0 ? [Math.PI, 2 * Math.PI] : [0, Math.PI]);

export function cylinderPrims(el: number, showLabels: boolean): Prim[] {
  const ry = R0 * Math.abs(Math.sin((el * Math.PI) / 180));
  const top: V = [0, -H0 / 2];
  const bot: V = [0, H0 / 2];
  const [f0, f1] = frontArc(el);
  const [b0, b1] = backArc(el);
  const prims: Prim[] = [
    { t: 'ellipse', o: top, rx: R0, ry, fill: 0.05 },
    { t: 'ellipse', o: bot, rx: R0, ry, a0: f0, a1: f1 },
    { t: 'ellipse', o: bot, rx: R0, ry, a0: b0, a1: b1, dash: true },
    { t: 'line', a: [-R0, top[1]], b: [-R0, bot[1]] },
    { t: 'line', a: [R0, top[1]], b: [R0, bot[1]] },
    { t: 'line', a: top, b: bot, dash: true, w: 0.7 },
    dotAt(top),
    dotAt(bot),
  ];
  if (showLabels) prims.push(label([12, top[1] - 12], 'O', 16), label([12, bot[1] + 14], 'O′', 16));
  return prims;
}

export function conePrims(el: number, showLabels: boolean): Prim[] {
  const ry = R0 * Math.abs(Math.sin((el * Math.PI) / 180));
  const apex: V = [0, -H0 / 2];
  const bot: V = [0, H0 / 2];
  const [f0, f1] = frontArc(el);
  const [b0, b1] = backArc(el);
  const xt = R0 * Math.sqrt(Math.max(0, 1 - (ry / H0) ** 2));
  const yt = bot[1] + (el >= 0 ? -1 : 1) * ((ry * ry) / H0);
  const prims: Prim[] = [
    { t: 'ellipse', o: bot, rx: R0, ry, a0: f0, a1: f1 },
    { t: 'ellipse', o: bot, rx: R0, ry, a0: b0, a1: b1, dash: true },
    { t: 'line', a: apex, b: [-xt, yt] },
    { t: 'line', a: apex, b: [xt, yt] },
    { t: 'line', a: apex, b: bot, dash: true, w: 0.7 },
    dotAt(apex),
    dotAt(bot),
  ];
  if (showLabels) prims.push(label([0, apex[1] - 14], 'S', 16), label([12, bot[1] + 14], 'O', 16));
  return prims;
}

export function spherePrims(el: number, showLabels: boolean): Prim[] {
  const ry = R0 * Math.abs(Math.sin((el * Math.PI) / 180));
  const [f0, f1] = frontArc(el);
  const [b0, b1] = backArc(el);
  const prims: Prim[] = [
    { t: 'ellipse', o: [0, 0], rx: R0 * 1.15, ry: R0 * 1.15, fill: 0.04 },
    { t: 'ellipse', o: [0, 0], rx: R0 * 1.15, ry: ry * 1.15, a0: f0, a1: f1 },
    { t: 'ellipse', o: [0, 0], rx: R0 * 1.15, ry: ry * 1.15, a0: b0, a1: b1, dash: true },
    { t: 'line', a: [0, 0], b: [R0 * 1.15, 0], dash: true, w: 0.8 },
    dotAt([0, 0], COL.red),
  ];
  if (showLabels) prims.push(label([-4, -14], 'O', 16, { c: COL.red }), label([R0 * 0.6, -13], 'R', 15));
  return prims;
}

const elOnly = (el: number): ParamDef[] => [
  { key: 'el', label: 'Nhìn từ trên xuống', type: 'range', min: 8, max: 80, step: 2, def: el },
  { key: 'labels', label: 'Tên điểm', type: 'toggle', def: 1 },
];

const withDiag: ParamDef = { key: 'diag', label: 'Đường chéo đáy & SO', type: 'toggle', def: 0 };

export const SHAPES_SOLID: ShapeDef[] = [
  { id: 'tetra', name: 'Tứ diện ABCD', group: 'solid', params: view(-62, 16), gen: plain(tetrahedron(), -62, 16) },
  { id: 'tetra-regular', name: 'Tứ diện đều', group: 'solid', params: view(-62, 16), gen: plain(regularTetrahedron(), -62, 16) },
  { id: 'pyr3', name: 'Hình chóp tam giác S.ABC', group: 'solid', params: view(-62, 16), gen: plain(pyramid3(), -62, 16) },
  { id: 'pyr4-square', name: 'Hình chóp S.ABCD (đáy vuông)', group: 'solid', params: [...view(-62, 20), withDiag], gen: pyramidWithDiagonals('square') },
  { id: 'pyr4-para', name: 'Hình chóp S.ABCD (đáy bình hành)', group: 'solid', params: [...view(-62, 20), withDiag], gen: pyramidWithDiagonals('parallelogram') },
  { id: 'pyr4-trap', name: 'Hình chóp S.ABCD (đáy hình thang)', group: 'solid', params: [...view(-62, 20), withDiag], gen: pyramidWithDiagonals('trapezoid') },
  { id: 'box', name: 'Hình hộp chữ nhật', group: 'solid', params: view(-62, 20), gen: plain(box(4, 3, 3), -62, 20) },
  { id: 'cube', name: 'Hình lập phương', group: 'solid', params: view(-62, 20), gen: plain(box(3.4, 3.4, 3.4), -62, 20) },
  { id: 'parallelepiped', name: 'Hình hộp ABCD.A′B′C′D′', group: 'solid', params: view(-62, 20), gen: plain(box(4, 3, 3, 1.2, 0.8), -62, 20) },
  { id: 'prism3', name: 'Lăng trụ tam giác', group: 'solid', params: view(-62, 20), gen: plain(prism3(), -62, 20) },
  { id: 'cylinder', name: 'Hình trụ', group: 'solid', params: elOnly(22), gen: (p) => cylinderPrims(num(p, 'el'), on(p, 'labels')) },
  { id: 'cone', name: 'Hình nón', group: 'solid', params: elOnly(22), gen: (p) => conePrims(num(p, 'el'), on(p, 'labels')) },
  { id: 'sphere', name: 'Hình cầu', group: 'solid', params: elOnly(22), gen: (p) => spherePrims(num(p, 'el'), on(p, 'labels')) },
  { id: 'bai2-a', name: 'Giao tuyến: (ABN) ∩ (CDM) = MN', group: 'solid', params: view(-62, 16), gen: bai2('a') },
  { id: 'bai2-b', name: 'Giao tuyến: (ABN) ∩ (BCP) = BI', group: 'solid', params: view(-62, 16), gen: bai2('b') },
  { id: 'bai2-c', name: 'Giao tuyến: (CDM) ∩ (BCP) = CJ', group: 'solid', params: view(-62, 16), gen: bai2('c') },
  { id: 'pyr-section', name: 'Giao tuyến: (SAC) ∩ (SBD) = SO', group: 'solid', params: view(-62, 22), gen: pyramidSection() },
];

export type { V3 };
