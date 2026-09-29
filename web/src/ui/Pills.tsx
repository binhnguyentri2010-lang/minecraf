import { shallow } from 'zustand/shallow';
import { groupBounds } from '../canvas/objects';
import { useBoard } from '../canvas/store';
import { Icons } from './icons';

/** Undo/redo pill (top left) and zoom pill (bottom left), as in GoodNotes. */
export function Pills() {
  const s = useBoard(
    (st) => ({ undoLen: st.undoStack.length, redoLen: st.redoStack.length, scale: st.viewport.scale, undo: st.undo, redo: st.redo, setViewport: st.setViewport }),
    shallow,
  );
  const fit = () => {
    const st = useBoard.getState();
    const b = groupBounds(st.items);
    const r = document.querySelector('.board')?.getBoundingClientRect();
    const w = r?.width ?? window.innerWidth, h = r?.height ?? window.innerHeight;
    if (!b) return st.setViewport({ x: 0, y: 0, scale: 1 });
    const top = 150, pad = 40;
    const k = Math.max(0.1, Math.min(8, Math.min((w - pad * 2) / Math.max(b.maxX - b.minX, 1), (h - top - pad) / Math.max(b.maxY - b.minY, 1))));
    st.setViewport({ scale: k, x: w / 2 - ((b.minX + b.maxX) / 2) * k, y: top + (h - top - pad) / 2 - ((b.minY + b.maxY) / 2) * k });
  };
  return (
    <>
      <div className="pill undo-pill">
        <button disabled={!s.undoLen} onClick={s.undo} aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)" data-testid="undo">{Icons.undo}</button>
        <button disabled={!s.redoLen} onClick={s.redo} aria-label="Làm lại" title="Làm lại (Ctrl+Shift+Z)" data-testid="redo">{Icons.redo}</button>
      </div>
      <div className="pill zoom-pill">
        <button className="pct" onClick={() => s.setViewport({ x: 0, y: 0, scale: 1 })} aria-label="Đặt lại thu phóng" title="Về 100%" data-testid="zoom">{Math.round(s.scale * 100)}%</button>
        <button onClick={fit} aria-label="Vừa nội dung" title="Vừa toàn bộ nội dung" data-testid="fit">{Icons.fit}</button>
      </div>
    </>
  );
}
