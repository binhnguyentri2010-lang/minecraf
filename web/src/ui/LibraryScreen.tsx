import { useEffect, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useBoard } from '../canvas/store';
import { duplicateBoard, loadThumbs, renameBoard, toggleFavorite, useThumbs } from '../storage/persist';
import { Icons } from './icons';
import { addBoard, openInTab, removeBoard } from './tabs';
import { useUI } from './uiStore';

/** Document library (GoodNotes "Tài liệu"): sidebar, grid of boards with thumbnails. */
export function LibraryScreen() {
  const boards = useBoard((s) => s.boards, shallow);
  const boardId = useBoard((s) => s.boardId);
  const thumbs = useThumbs((s) => s.map);
  const setView = useUI((s) => s.setView);
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [grid, setGrid] = useState(true);
  useEffect(() => void loadThumbs(), [boards.length]);
  const list = boards.filter((b) => filter === 'all' || b.fav);
  const fmt = (t: number) => {
    const d = new Date(t);
    const today = new Date();
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === today.toDateString() ? `${time} Hôm nay` : `${d.toLocaleDateString('vi-VN')} ${time}`;
  };
  return (
    <div className="lib-screen" data-testid="library-screen">
      <aside className="lib-side">
        <button className="side-toggle" onClick={() => setView('editor')} aria-label="Quay lại bảng vẽ" title="Quay lại bảng vẽ" data-testid="back-to-editor">{Icons.sidebar}</button>
        <nav>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')} data-testid="nav-all"><span className="ic folder" />Tài liệu</button>
          <button className={filter === 'fav' ? 'on' : ''} onClick={() => setFilter('fav')} data-testid="nav-fav">{Icons.star}Yêu thích</button>
        </nav>
      </aside>
      <main className="lib-main">
        <h1>{filter === 'fav' ? 'Yêu thích' : 'Tài liệu'}</h1>
        <div className="lib-bar">
          <span className="sortlabel">{list.length} bảng</span>
          <div className="lib-actions">
            <button className="new" onClick={() => void addBoard()} data-testid="new-doc">{Icons.add}<span>Mới</span></button>
            <button className="view" onClick={() => setGrid(!grid)} aria-label={grid ? 'Xem dạng danh sách' : 'Xem dạng lưới'}>{Icons.boards}</button>
          </div>
        </div>
        <div className={`docs ${grid ? 'grid' : 'rows'}`}>
          {list.map((b) => (
            <article key={b.id} className={`doc ${b.id === boardId ? 'cur' : ''}`} data-testid="doc">
              <button className="cover" onClick={() => void openInTab(b.id)} aria-label={`Mở ${b.name}`} data-testid="doc-open">
                <span className="paper">
                  {thumbs[b.id] ? <img src={thumbs[b.id]} alt="" draggable={false} /> : <span className="blank" />}
                </span>
                <span className="clip" />
              </button>
              <button className={`star ${b.fav ? 'on' : ''}`} onClick={() => void toggleFavorite(b.id)} aria-label={b.fav ? 'Bỏ yêu thích' : 'Yêu thích'} aria-pressed={!!b.fav} data-testid="doc-fav">{Icons.star}</button>
              {editing === b.id ? (
                <form className="rename" onSubmit={(e) => { e.preventDefault(); void renameBoard(b.id, name); setEditing(null); }}>
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setEditing(null)} data-testid="doc-rename-input" />
                </form>
              ) : (
                <div className="meta">
                  <button className="title" onClick={() => setMenu(menu === b.id ? null : b.id)} aria-haspopup="menu" data-testid="doc-menu">
                    <span>{b.name}</span>{Icons.chevron}
                  </button>
                  <small>{fmt(b.updated)}</small>
                </div>
              )}
              {menu === b.id && (
                <div className="doc-menu" role="menu">
                  <button onClick={() => { setEditing(b.id); setName(b.name); setMenu(null); }} data-testid="doc-rename">Đổi tên</button>
                  <button onClick={() => { void duplicateBoard(b.id); setMenu(null); }} data-testid="doc-duplicate">Nhân bản</button>
                  <button className={confirm === b.id ? 'danger' : 'del'} onClick={() => { if (confirm === b.id) { setConfirm(null); setMenu(null); void removeBoard(b.id); } else setConfirm(b.id); }} data-testid="doc-delete">
                    {confirm === b.id ? 'Bấm lần nữa để xoá' : 'Xoá'}
                  </button>
                </div>
              )}
            </article>
          ))}
          {list.length === 0 && <p className="lib-empty">{filter === 'fav' ? 'Chưa có bảng yêu thích. Bấm ngôi sao trên một bảng để thêm.' : 'Chưa có bảng nào. Bấm “Mới” để bắt đầu.'}</p>}
        </div>
      </main>
    </div>
  );
}
