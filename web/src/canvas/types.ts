export type V = [number, number];

export interface Pt {
  x: number;
  y: number;
  p: number;
}

export type StrokeKind = 'pen' | 'highlighter';

export interface Stroke {
  type: 'stroke';
  id: string;
  seq: number;
  pts: Pt[];
  color: string;
  size: number;
  kind: StrokeKind;
  pen: boolean;
}

interface PrimBase {
  /** colour override (defaults to the object colour) */
  c?: string;
  /** line-width multiplier (0 = no outline) */
  w?: number;
  dash?: boolean;
}

export type Prim =
  | (PrimBase & { t: 'line'; a: V; b: V })
  | (PrimBase & { t: 'arrow'; a: V; b: V })
  | (PrimBase & { t: 'poly'; pts: V[]; closed?: boolean; fill?: number })
  | (PrimBase & { t: 'ellipse'; o: V; rx: number; ry: number; a0?: number; a1?: number; fill?: number })
  | (PrimBase & { t: 'dot'; o: V; r?: number })
  | (PrimBase & {
      t: 'text';
      o: V;
      s: string;
      size?: number;
      anchor?: 'start' | 'middle' | 'end';
      math?: boolean;
    });

export type ParamValue = number | string;
export type Params = Record<string, ParamValue>;

export interface Obj {
  type: 'obj';
  id: string;
  seq: number;
  prims: Prim[];
  x: number;
  y: number;
  rot: number;
  scale: number;
  color: string;
  lw: number;
  dash?: boolean;
  gen?: { id: string; params: Params };
}

export type Item = Stroke | Obj;

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Aid {
  x: number;
  y: number;
  rot: number;
}

export type Tool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'circle'
  | 'rect';
export type Background = 'blank' | 'grid' | 'dots' | 'axes';

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
/** world units per grid cell / per "1" on the Oxy axes */
export const GRID = 40;
