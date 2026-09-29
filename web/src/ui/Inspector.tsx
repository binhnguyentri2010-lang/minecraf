import { COLORS, useBoard } from '../canvas/store';
import type { Item, Params } from '../canvas/types';
import { tryCompile } from '../math/expr';
import { generate, normalizeParams, shapeById, type ParamDef } from '../shapes/registry';
import { Icons } from './icons';

function withParam(it: Item, key: string, value: number | string): Item {
  if (it.type !== 'obj' || !it.gen) return it;
  const def = shapeById(it.gen.id);
  if (!def) return it;
  const params: Params = normalizeParams(def, { ...it.gen.params, [key]: value });
  return { ...it, prims: generate(def, params), gen: { id: it.gen.id, params } };
}

function ParamRow({ def, value, onChange }: { def: ParamDef; value: number | string; onChange: (v: number | string) => void }) {
  if (def.type === 'toggle')
    return (
      <label className="row">
        <span>{def.label}</span>
        <input type="checkbox" checked={Number(value) !== 0} onChange={(e) => onChange(e.target.checked ? 1 : 0)} data-testid={`param-${def.key}`} />
      </label>
    );
  if (def.type === 'text') {
    const err = def.key === 'expr' ? tryCompile(String(value)) : null;
    return (
      <label className="row col">
        <span>{def.label}</span>
        <input type="text" value={String(value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(e) => onChange(e.target.value)} data-testid={`param-${def.key}`} />
        {err && 'error' in err && <small className="err">{err.error}</small>}
      </label>
    );
  }
  return (
    <label className="row">
      <span>{def.label}</span>
      <input type="range" min={def.min} max={def.max} step={def.step} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} data-testid={`param-${def.key}`} />
      <output>{Number(value)}</output>
    </label>
  );
}

type View = { tool: string; sel: Item[]; size: number };
const sameView = (a: View, b: View) => a.tool === b.tool && a.size === b.size && a.sel.length === b.sel.length && a.sel.every((x, i) => x === b.sel[i]);

export function Inspector() {
  const { sel, tool, size } = useBoard((st): View => {
    if (st.tool !== 'select' || st.selection.length === 0) return { tool: st.tool, sel: [], size: st.size };
    const ids = new Set(st.selection);
    return { tool: st.tool, sel: st.items.filter((i) => ids.has(i.id)), size: st.size };
  }, sameView);
  const s = useBoard.getState();
  if (tool !== 'select' || sel.length === 0) return null;
  const one = sel.length === 1 ? sel[0] : null;
  const def = one?.type === 'obj' && one.gen ? shapeById(one.gen.id) : undefined;
  const hasObj = sel.some((i) => i.type === 'obj');
  return (
    <aside className="inspector glass" aria-label="Thuộc tính đối tượng" data-testid="inspector">
      <header>
        <strong>{def ? def.name : sel.length > 1 ? `${sel.length} đối tượng` : one?.type === 'stroke' ? 'Nét vẽ' : 'Đối tượng'}</strong>
        <div className="actions">
          <button onClick={s.duplicateSelected} aria-label="Nhân đôi" title="Nhân đôi (Ctrl+D)" data-testid="duplicate">{Icons.copy}</button>
          <button onClick={s.deleteSelected} aria-label="Xoá" title="Xoá (Delete)" data-testid="delete">{Icons.trash}</button>
        </div>
      </header>
      <div className="row swatches">
        {COLORS.map((c) => (
          <button key={c} className="swatch" aria-label={`Màu ${c}`} style={{ background: c }} onClick={() => s.setColor(c)} />
        ))}
      </div>
      {hasObj && (
        <>
          <label className="row">
            <span>Độ dày nét</span>
            <input type="range" min={1} max={12} step={0.5} value={one?.type === 'obj' ? one.lw : size} onChange={(e) => s.setSize(Number(e.target.value))} />
          </label>
          <label className="row">
            <span>Nét đứt</span>
            <input type="checkbox" checked={sel.every((i) => i.type === 'obj' && i.dash)} onChange={(e) => s.setDash(e.target.checked)} data-testid="inspector-dash" />
          </label>
        </>
      )}
      {def &&
        one?.type === 'obj' &&
        one.gen &&
        def.params.map((p) => (
          <ParamRow key={p.key} def={p} value={one.gen!.params[p.key] ?? p.def} onChange={(v) => s.patchSelected((it) => withParam(it, p.key, v), `param:${p.key}`)} />
        ))}
    </aside>
  );
}
