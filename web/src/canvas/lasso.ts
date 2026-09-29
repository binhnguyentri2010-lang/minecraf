import { itemBounds, pointInPoly } from './objects';
import type { Item, V } from './types';

/** Ids of the items GoodNotes-style "inside the loop": strokes with at least half of their points inside, objects with at least 5 of 9 sample points of their box inside. */
export function itemsInLasso(items: Item[], poly: V[]): string[] {
  if (poly.length < 3) return [];
  const out: string[] = [];
  for (const it of items) {
    if (it.type === 'stroke') {
      let n = 0;
      for (const p of it.pts) if (pointInPoly(p.x, p.y, poly)) n++;
      if (it.pts.length && n >= it.pts.length * 0.5) out.push(it.id);
      continue;
    }
    const b = itemBounds(it);
    if (!b) continue;
    let n = 0;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) if (pointInPoly(b.minX + ((b.maxX - b.minX) * i) / 2, b.minY + ((b.maxY - b.minY) * j) / 2, poly)) n++;
    if (n >= 5) out.push(it.id);
  }
  return out;
}
