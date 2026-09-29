import { describe, expect, it } from 'vitest';
import type { Item, Obj, Stroke } from '../src/canvas/types';
import { itemsToSvg, makePdf, safeName } from '../src/storage/export';
import { buildShapeObj, defaultParams, shapeById } from '../src/shapes/registry';

const stroke: Stroke = {
  type: 'stroke', id: 's1', seq: 1, color: '#d1242f', size: 3, kind: 'pen', pen: true,
  pts: Array.from({ length: 20 }, (_, i) => ({ x: 10 + i * 5, y: 20 + Math.sin(i / 3) * 10, p: 0.5 })),
};
const shape = (id: string): Obj => buildShapeObj(shapeById(id)!, defaultParams(shapeById(id)!), { id, seq: 2, x: 200, y: 150, scale: 1, color: '#111318' });

describe('SVG export', () => {
  const items: Item[] = [stroke, shape('bai2-a'), shape('fn-quadratic'), shape('unit-circle')];
  const svg = itemsToSvg(items, 'axes');

  it('is well-formed XML with a viewBox', () => {
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toMatch(/<svg [^>]*viewBox="-?\d+ -?\d+ \d+ \d+"/);
    // crude well-formedness: balanced tags, no raw "&" or "<" inside attribute text
    const opens = (svg.match(/<(?!\/|\?|!)[a-zA-Z]+/g) ?? []).length;
    const selfClosing = (svg.match(/\/>/g) ?? []).length;
    const closes = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
    expect(opens).toBe(selfClosing + closes);
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
  });
  it('contains the stroke, dashed hidden edges, ellipse arcs and text', () => {
    expect(svg).toMatch(/<path d="M[^"]+Z" fill="#d1242f"/);
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toMatch(/<g transform="translate\(200 150\)/);
    expect(svg).toContain('<text');
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  });
  it('supports every background and an empty board', () => {
    for (const bg of ['blank', 'grid', 'dots', 'axes'] as const) expect(itemsToSvg([], bg)).toContain('<svg');
  });
  it('escapes user text', () => {
    const o = shape('fn-custom');
    o.prims.push({ t: 'text', o: [0, 0], s: '<b>&"x"</b>', size: 12 });
    const out = itemsToSvg([o], 'blank');
    expect(out).toContain('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
  });
});

describe('PDF writer', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 0xff, 0xd9]);
  it('produces a structurally valid PDF (xref offsets point at objects)', () => {
    const bytes = makePdf([{ jpeg, w: 400, h: 300 }, { jpeg, w: 800, h: 600 }]);
    const txt = new TextDecoder('latin1').decode(bytes);
    expect(txt.startsWith('%PDF-1.4')).toBe(true);
    expect(txt.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(txt).toMatch(/\/Count 2/);
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(txt)![1]);
    expect(txt.slice(start, start + 4)).toBe('xref');
    const size = Number(/\/Size (\d+)/.exec(txt)![1]);
    expect(size).toBe(3 + 2 * 3);
    const entries = [...txt.slice(start).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(size - 1);
    entries.forEach((off, i) => expect(txt.slice(off, off + `${i + 1} 0 obj`.length), `object ${i + 1}`).toBe(`${i + 1} 0 obj`));
    // the embedded JPEG bytes are intact and /Length matches
    const idx = bytes.findIndex((b, i) => b === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff && bytes[i + 3] === 0xe0);
    expect([...bytes.slice(idx, idx + jpeg.length)]).toEqual([...jpeg]);
    expect(txt).toContain(`/Length ${jpeg.length}`);
  });
  it('page size follows the image', () => {
    const txt = new TextDecoder('latin1').decode(makePdf([{ jpeg, w: 800, h: 400 }]));
    expect(txt).toContain('/MediaBox [0 0 300 150]');
  });
});

describe('file names', () => {
  it('strips Vietnamese diacritics and unsafe characters', () => {
    expect(safeName('Hình học 11 / Bài 2?')).toBe('Hinh-hoc-11-Bai-2');
    expect(safeName('Đường tròn')).toBe('Duong-tron');
    expect(safeName('///')).toBe('bang-toan');
  });
});
