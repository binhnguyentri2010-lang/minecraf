import { shallow } from 'zustand/shallow';
import { useBoard } from '../canvas/store';
import { Icons } from './icons';
import { useUI, type Panel } from './uiStore';

export function TopBar() {
  const s = useBoard(
    (st) => ({
      undoLen: st.undoStack.length, redoLen: st.redoStack.length, scale: st.viewport.scale, boards: st.boards,
      boardId: st.boardId, undo: st.undo, redo: st.redo, setViewport: st.setViewport,
    }),
    shallow,
  );
  const { panel, togglePanel } = useUI();
  const name = s.boards.find((b) => b.id === s.boardId)?.name ?? 'Bảng';
  const pbtn = (p: Exclude<Panel, null>, label: string, icon: keyof typeof Icons) => (
    <button className={panel === p ? 'on' : ''} onClick={() => togglePanel(p)} aria-label={label} title={label} data-testid={`open-${p}`}>
      {Icons[icon]}
      <span className="lbl">{label}</span>
    </button>
  );
  return (
    <div className="topbar glass" role="toolbar" aria-label="Thanh trên">
      <div className="group">{pbtn('boards', name, 'boards')}</div>
      <div className="group">
        {pbtn('library', 'Hình vẽ sẵn', 'library')}
        {pbtn('graph', 'Đồ thị', 'graph')}
        {pbtn('text', 'Công thức', 'text')}
      </div>
      <div className="group">
        <button disabled={!s.undoLen} onClick={s.undo} aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)" data-testid="undo">{Icons.undo}</button>
        <button disabled={!s.redoLen} onClick={s.redo} aria-label="Làm lại" title="Làm lại (Ctrl+Shift+Z)" data-testid="redo">{Icons.redo}</button>
        <button onClick={() => s.setViewport({ x: 0, y: 0, scale: 1 })} aria-label="Đặt lại thu phóng" title="Về 100%" data-testid="zoom">{Math.round(s.scale * 100)}%</button>
      </div>
      <div className="group">{pbtn('export', 'Xuất', 'export')}</div>
    </div>
  );
}
