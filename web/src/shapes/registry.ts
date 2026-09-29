import type { Obj, Params, Prim } from '../canvas/types';
import { SHAPES_COORD } from './coord';
import { SHAPES_PLANE } from './plane';
import { SHAPES_SOLID } from './solids';
import { SHAPES_TRIG } from './trig';
import { SHAPES_MISC } from './misc';
import type { GroupId, ParamDef, ShapeDef } from './util';

export type { GroupId, ParamDef, ShapeDef };

export const GROUPS: { id: GroupId; name: string }[] = [
  { id: 'plane', name: 'Hình phẳng' },
  { id: 'solid', name: 'Hình không gian' },
  { id: 'coord', name: 'Toạ độ & đồ thị' },
  { id: 'trig', name: 'Lượng giác' },
  { id: 'misc', name: 'Khác' },
];

export const SHAPES: ShapeDef[] = [...SHAPES_PLANE, ...SHAPES_SOLID, ...SHAPES_COORD, ...SHAPES_TRIG, ...SHAPES_MISC];

const byId = new Map(SHAPES.map((s) => [s.id, s]));
export const shapeById = (id: string): ShapeDef | undefined => byId.get(id);

export function defaultParams(def: ShapeDef): Params {
  return Object.fromEntries(def.params.map((p) => [p.key, p.def]));
}

/** Fill missing keys with defaults and clamp numeric values into range. */
export function normalizeParams(def: ShapeDef, params: Params): Params {
  const out: Params = {};
  for (const p of def.params) {
    const v = params[p.key] ?? p.def;
    if (p.type === 'text') out[p.key] = String(v);
    else {
      let n = Number(v);
      if (!Number.isFinite(n)) n = Number(p.def);
      if (p.type === 'toggle') n = n ? 1 : 0;
      else n = Math.min(p.max ?? n, Math.max(p.min ?? n, n));
      out[p.key] = n;
    }
  }
  return out;
}

export function generate(def: ShapeDef, params: Params): Prim[] {
  return def.gen(normalizeParams(def, params));
}

export function buildShapeObj(
  def: ShapeDef,
  params: Params,
  base: { id: string; seq: number; x: number; y: number; scale: number; color: string; lw?: number },
): Obj {
  const ps = normalizeParams(def, params);
  return {
    type: 'obj',
    id: base.id,
    seq: base.seq,
    prims: def.gen(ps),
    x: def.atOrigin ? 0 : base.x,
    y: def.atOrigin ? 0 : base.y,
    rot: 0,
    scale: def.atOrigin ? 1 : base.scale,
    color: base.color,
    lw: base.lw ?? 2,
    gen: { id: def.id, params: ps },
  };
}
