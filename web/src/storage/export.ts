import { groupBounds } from '../canvas/objects';
import { PAPER, renderBoardToCanvas, strokeOutline } from '../canvas/render';
import type { Background, Item, Obj, Prim, Stroke } from '../canvas/types';
import { GRID } from '../canvas/types';
import { plainText } from '../math/mathtext';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (x: number) => (Math.round(x * 100) / 100).toString();

function strokeSvg(s: Stroke): string {
  const o = strokeOutline(s);
  if (o.length < 2) return '';
  let d = `M${n(o[0][0])} ${n(o[0][1])}`;
  for (let i = 1; i < o.length; i++) {
    const [x0, y0] = o[i];
    const [x1, y1] = o[(i + 1) % o.length];
    d += `Q${n(x0)} ${n(y0)} ${n((x0 + x1) / 2)} ${n((y0 + y1) / 2)}`;
  }
  return `<path d="${d}Z" fill="${esc(s.color)}"${s.kind === 'highlighter' ? ' fill-opacity="0.35"' : ''}/>`;
}

export function primSvg(p: Prim, o: { color: string; lw: number; dash?: boolean }): string {
  const col = esc(p.c ?? o.color);
  const lw = o.lw * (p.w ?? 1);
  const dashed = p.dash || o.dash;
  const dash = dashed ? ` stroke-dasharray="${n(Math.max(4, o.lw * 3.2 + 3))} ${n(Math.max(3, o.lw * 2.2 + 3))}"` : '';
  const stroke = lw > 0 ? ` stroke="${col}" stroke-width="${n(lw)}" stroke-linecap="round" stroke-linejoin="round"${dash}` : ' stroke="none"';
  switch (p.t) {
    case 'line':
      return `<line x1="${n(p.a[0])}" y1="${n(p.a[1])}" x2="${n(p.b[0])}" y2="${n(p.b[1])}"${stroke}/>`;
    case 'arrow': {
      const ang = Math.atan2(p.b[1] - p.a[1], p.b[0] - p.a[0]);
      const head = 9 + lw * 2;
      const h = (a: number, k: number): string => `${n(p.b[0] - head * k * Math.cos(a))},${n(p.b[1] - head * k * Math.sin(a))}`;
      return (
        `<line x1="${n(p.a[0])}" y1="${n(p.a[1])}" x2="${n(p.b[0] - Math.cos(ang) * head * 0.6)}" y2="${n(p.b[1] - Math.sin(ang) * head * 0.6)}"${stroke}/>` +
        `<polygon points="${n(p.b[0])},${n(p.b[1])} ${h(ang - 0.42, 1)} ${h(ang, 0.7)} ${h(ang + 0.42, 1)}" fill="${col}"/>`
      );
    }
    case 'poly': {
      const pts = p.pts.map((q) => `${n(q[0])},${n(q[1])}`).join(' ');
      if (p.closed) return `<polygon points="${pts}" fill="${p.fill ? col : 'none'}"${p.fill ? ` fill-opacity="${p.fill}"` : ''}${stroke}/>`;
      return `<polyline points="${pts}" fill="none"${stroke}/>`;
    }
    case 'ellipse': {
      if (p.a0 === undefined) return `<ellipse cx="${n(p.o[0])}" cy="${n(p.o[1])}" rx="${n(p.rx)}" ry="${n(p.ry)}" fill="${p.fill ? col : 'none'}"${p.fill ? ` fill-opacity="${p.fill}"` : ''}${stroke}/>`;
      const a0 = p.a0, a1 = p.a1 ?? Math.PI * 2;
      const pt = (a: number) => `${n(p.o[0] + p.rx * Math.cos(a))} ${n(p.o[1] + p.ry * Math.sin(a))}`;
      return `<path d="M${pt(a0)}A${n(p.rx)} ${n(p.ry)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)}" fill="none"${stroke}/>`;
    }
    case 'dot':
      return `<circle cx="${n(p.o[0])}" cy="${n(p.o[1])}" r="${n(p.r ?? 3.2)}" fill="${col}"/>`;
    case 'text': {
      const anchor = p.anchor === 'start' ? 'start' : p.anchor === 'end' ? 'end' : 'middle';
      const s = p.math ? plainText(p.s) : p.s;
      const italic = p.math && /^[A-Za-z]$/.test(s) ? ' font-style="italic"' : '';
      return `<text x="${n(p.o[0])}" y="${n(p.o[1])}" font-size="${n(p.size ?? 16)}" text-anchor="${anchor}" dominant-baseline="central" font-family="${p.math ? 'Times New Roman,serif' : 'sans-serif'}"${italic} fill="${col}">${esc(s)}</text>`;
    }
  }
}

function objSvg(o: Obj): string {
  const t = `translate(${n(o.x)} ${n(o.y)}) rotate(${n((o.rot * 180) / Math.PI)}) scale(${n(o.scale)})`;
  return `<g transform="${t}">${o.prims.map((p) => primSvg(p, o)).join('')}</g>`;
}

function backgroundSvg(bg: Background, x0: number, y0: number, w: number, h: number): string {
  let s = `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" fill="${PAPER}"/>`;
  if (bg === 'blank') return s;
  if (bg === 'dots') {
    s += `<defs><pattern id="pd" width="${GRID}" height="${GRID}" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1.3" fill="rgba(60,70,90,0.45)"/></pattern></defs>`;
    return s + `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" fill="url(#pd)"/>`;
  }
  s += `<defs><pattern id="pg" width="${GRID}" height="${GRID}" patternUnits="userSpaceOnUse"><path d="M${GRID} 0V${GRID}M0 ${GRID}H${GRID}" fill="none" stroke="rgba(70,110,170,0.22)" stroke-width="1"/></pattern></defs>`;
  s += `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" fill="url(#pg)"/>`;
  if (bg === 'axes') {
    s += `<path d="M${n(x0)} 0H${n(x0 + w)}M0 ${n(y0)}V${n(y0 + h)}" stroke="rgba(20,30,50,0.85)" stroke-width="1.6" fill="none"/>`;
    const lab = (i: number, x: number, y: number, anchor: string) => `<text x="${n(x)}" y="${n(y)}" font-size="12" text-anchor="${anchor}" dominant-baseline="central" font-family="sans-serif" fill="rgba(20,30,50,0.85)">${i}</text>`;
    for (let i = Math.ceil(x0 / GRID); i <= (x0 + w) / GRID; i++) if (i) s += lab(i, i * GRID, 12, 'middle');
    for (let i = Math.ceil(y0 / GRID); i <= (y0 + h) / GRID; i++) if (i) s += lab(-i, -8, i * GRID, 'end');
    s += lab(0, -8, 12, 'end').replace('>0<', '>O<');
  }
  return s;
}

export function itemsToSvg(items: Item[], bg: Background): string {
  const b = groupBounds(items) ?? { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  const pad = 40;
  const x0 = Math.floor(b.minX - pad), y0 = Math.floor(b.minY - pad);
  const w = Math.ceil(b.maxX - b.minX + pad * 2), h = Math.ceil(b.maxY - b.minY + pad * 2);
  const body = items.map((i) => (i.type === 'stroke' ? strokeSvg(i) : objSvg(i))).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">${backgroundSvg(bg, x0, y0, w, h)}${body}</svg>\n`;
}

// ------------------------------------------------------------------ PDF (one JPEG per page, no dependencies)

export interface PdfPage {
  jpeg: Uint8Array;
  w: number;
  h: number;
}

export function makePdf(pages: PdfPage[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (c: Uint8Array | string) => {
    const b = typeof c === 'string' ? enc.encode(c) : c;
    chunks.push(b);
    pos += b.length;
  };
  const obj = (id: number, body: () => void) => {
    offsets[id] = pos;
    push(`${id} 0 obj\n`);
    body();
    push('\nendobj\n');
  };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`));
  pages.forEach((pg, i) => {
    const page = 3 + i * 3, content = page + 1, img = page + 2;
    const W = Math.round(pg.w * 0.375 * 100) / 100, H = Math.round(pg.h * 0.375 * 100) / 100;
    obj(page, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(content, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(img, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`);
      push(pg.jpeg);
      push('\nendstream');
    });
  });
  const count = 3 + pages.length * 3;
  const xref = pos;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

async function canvasJpeg(c: HTMLCanvasElement): Promise<PdfPage> {
  const blob: Blob | null = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Không tạo được ảnh');
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
}

export async function exportPdf(boards: { items: Item[]; background: Background }[]): Promise<Blob> {
  const pages: PdfPage[] = [];
  for (const b of boards) pages.push(await canvasJpeg(renderBoardToCanvas(b.items, b.background, 3000, 2)));
  return new Blob([makePdf(pages) as BlobPart], { type: 'application/pdf' });
}

// ------------------------------------------------------------------ delivery

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function shareBlob(blob: Blob, name: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try {
    await nav.share({ files: [file], title: name });
    return true;
  } catch {
    return false;
  }
}

/** ASCII-only file names: Vietnamese diacritics are removed so every browser/OS keeps the name. */
export const safeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bang-toan';
