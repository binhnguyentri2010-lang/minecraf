import { useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useBoard } from '../canvas/store';
import { deleteBoard, newBoard, openBoard, renameBoard } from '../storage/persist';
import { Icons } from './icons';
import { useUI } from './uiStore';

export function BoardsPanel() {
  const { boards, boardId } = useBoard((st) => ({ boards: st.boards, boardId: st.boardId }), shallow);
  const setPanel = useUI((s) => s.setPanel);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const fmt = (t: number) => new Date(t).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <aside className="panel glass left" aria-label="Các bảng" data-testid="boards-panel">
      <header>
        <h2>Các bảng</h2>
        <button onClick={() => setPanel(null)} aria-label="Đóng">{Icons.close}</button>
      </header>
      <button className="primary wide" onClick={() => void newBoard()} data-testid="new-board">{Icons.plus} Bảng mới</button>
      <ul className="boards">
        {boards.map((b) => (
          <li key={b.id} className={b.id === boardId ? 'cur' : ''} data-testid="board-item">
            {editing === b.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void renameBoard(b.id, name);
                  setEditing(null);
                }}
              >
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setEditing(null)} data-testid="rename-input" />
              </form>
            ) : (
              <button className="open" onClick={() => void openBoard(b.id)}>
                <strong>{b.name}</strong>
                <small>{fmt(b.updated)}</small>
              </button>
            )}
            <button
              onClick={() => {
                setEditing(b.id);
                setName(b.name);
              }}
              data-testid="rename-board"
            >
              Đổi tên
            </button>
            <button
              className={confirm === b.id ? 'danger' : ''}
              onClick={() => {
                if (confirm === b.id) {
                  setConfirm(null);
                  void deleteBoard(b.id);
                } else setConfirm(b.id);
              }}
              onBlur={() => setConfirm(null)}
              data-testid="delete-board"
            >
              {confirm === b.id ? 'Chắc chắn?' : 'Xoá'}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
