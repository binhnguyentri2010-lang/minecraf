import { useMemo, useState } from 'react';
import { primBounds } from '../canvas/objects';
import { GROUPS, SHAPES, defaultParams, generate, type GroupId, type ShapeDef } from '../shapes/registry';
import { insertShape } from '../shapes/insert';
import { primSvg } from '../storage/export';
import { Icons } from './icons';
import { useUI } from './uiStore';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

function thumb(def: ShapeDef): string {
  const prims = generate(def, defaultParams(def));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of prims) {
    const b = primBounds(p);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  const pad = 10;
  const w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
  const inner = prims.map((p) => primSvg(p, { color: '#22262e', lw: 2.6 })).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - pad} ${minY - pad} ${w} ${h}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

export function Library() {
  const setPanel = useUI((s) => s.setPanel);
  const [group, setGroup] = useState<GroupId>('plane');
  const [q, setQ] = useState('');
  const thumbs = useMemo(() => new Map<string, string>(), []);
  const list = useMemo(() => {
    const f = fold(q.trim());
    return SHAPES.filter((s) => (f ? fold(s.name).includes(f) : s.group === group));
  }, [group, q]);
  const svgOf = (s: ShapeDef) => {
    let t = thumbs.get(s.id);
    if (!t) {
      t = thumb(s);
      thumbs.set(s.id, t);
    }
    return t;
  };
  return (
    <aside className="panel glass library" aria-label="Hình vẽ sẵn" data-testid="library">
      <header>
        <h2>Hình vẽ sẵn</h2>
        <button onClick={() => setPanel(null)} aria-label="Đóng">{Icons.close}</button>
      </header>
      <input className="search" type="search" placeholder="Tìm hình (không cần gõ dấu)…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="library-search" />
      {!q && (
        <nav className="tabs">
          {GROUPS.map((g) => (
            <button key={g.id} className={group === g.id ? 'on' : ''} onClick={() => setGroup(g.id)} data-testid={`group-${g.id}`}>
              {g.name}
            </button>
          ))}
        </nav>
      )}
      <div className="grid">
        {list.map((s) => (
          <button key={s.id} className="card" onClick={() => {
              insertShape(s);
              if (window.matchMedia('(max-width: 760px)').matches) setPanel(null);
            }} data-testid={`shape-${s.id}`} title={s.name}>
            <span className="thumb" dangerouslySetInnerHTML={{ __html: svgOf(s) }} />
            <span className="name">{s.name}</span>
          </button>
        ))}
        {list.length === 0 && <p className="empty">Không tìm thấy hình nào.</p>}
      </div>
    </aside>
  );
}
