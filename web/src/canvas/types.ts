export interface Pt {
  x: number;
  y: number;
  p: number;
}

export type StrokeKind = 'pen' | 'highlighter';

export interface Stroke {
  id: string;
  seq: number;
  pts: Pt[];
  color: string;
  size: number;
  kind: StrokeKind;
  pen: boolean;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export type Tool = 'pen' | 'highlighter' | 'eraser';
export type Background = 'blank' | 'grid' | 'dots' | 'axes';

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
export const GRID = 40;
