import { shallow } from 'zustand/shallow';
import { groupBounds } from '../canvas/objects';
import { useBoard } from '../canvas/store';
import { Icons } from './icons';

/** Floating action bar above the selection (Cut / Copy / Duplicate / Delete), and a Paste chip when nothing is selected. */
export function SelectionMenu() {
  const v = useBoard(
    (s) => ({
      active: s.tool === 'select' || s.tool === 'lasso',
      selection: s.selection,
      items: s.items,
      viewport: s.viewport,
      busy: s.busy,
      clip: s.clipboard.length,
    }),
    shallow,
  );
  const st = useBoard.getState();
  if (!v.active || v.busy) return null;
  const vw = window.innerWidth, vh = window.innerHeight;

  if (v.selection.length === 0) {
    if (!v.clip) return null;
    return (
      <div className="selmenu paste-chip glass" style={{ left: vw / 2, top: vh - 150 }} data-testid="paste-chip">
        <button onClick={st.paste} data-testid="paste">{Icons.paste}<span>Dán</span></button>
      </div>
    );
  }
  const ids = new Set(v.selection);
  const b = groupBounds(v.items.filter((i) => ids.has(i.id)));
  if (!b) return null;
  const { x, y, scale } = v.viewport;
  const cx = x + ((b.minX + b.maxX) / 2) * scale;
  const top = y + b.minY * scale;
  const bottom = y + b.maxY * scale;
  const left = Math.min(Math.max(cx, 140), vw - 140);
  // clear of the rotate handle (~45px above the box) and of the scale handle below it
  let ty = top - 112;
  if (ty < 76) ty = bottom + 30;
  ty = Math.max(76, Math.min(ty, vh - 130));
  return (
    <div className="selmenu glass" style={{ left, top: ty }} role="toolbar" aria-label="Thao tác với vùng chọn" data-testid="selmenu">
      <button onClick={st.cutSelected} data-testid="cut">{Icons.cut}<span>Cắt</span></button>
      <button onClick={st.copySelected} data-testid="copy">{Icons.copy}<span>Sao chép</span></button>
      {v.clip > 0 && <button onClick={st.paste} data-testid="paste">{Icons.paste}<span>Dán</span></button>}
      <button onClick={st.duplicateSelected} data-testid="menu-duplicate">{Icons.copy}<span>Nhân đôi</span></button>
      <button onClick={st.deleteSelected} className="del" data-testid="menu-delete">{Icons.trash}<span>Xoá</span></button>
    </div>
  );
}
