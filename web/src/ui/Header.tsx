import { shallow } from 'zustand/shallow';
import { useBoard } from '../canvas/store';
import type { Tool } from '../canvas/types';
import { Icons } from './icons';
import { addBoard, closeTab, openInTab, showLibrary } from './tabs';
import { useUI, type Panel } from './uiStore';

const SHAPE_TOOLS: { id: Tool; label: string; icon: keyof typeof Icons }[] = [
  { id: 'line', label: 'Đoạn thẳng', icon: 'line' },
  { id: 'arrow', label: 'Mũi tên', icon: 'arrow' },
  { id: 'circle', label: 'Compa (đường tròn)', icon: 'circle' },
  { id: 'rect', label: 'Hình chữ nhật', icon: 'rect' },
];

export function Header() {
  const s = useBoard(
    (st) => ({
      tool: st.tool, setTool: st.setTool, ruler: st.ruler, protractor: st.protractor, setRuler: st.setRuler,
      setProtractor: st.setProtractor, pencilOnly: st.pencilOnly, setPencilOnly: st.setPencilOnly, boards: st.boards,
      boardId: st.boardId, background: st.background, setBackground: st.setBackground, viewport: st.viewport,
      setViewport: st.setViewport, clear: st.clear, hasItems: st.items.length > 0,
    }),
    shallow,
  );
  const { panel, popover, tabs, togglePanel, togglePopover, setPopover } = useUI();
  const boardName = (id: string) => s.boards.find((b) => b.id === id)?.name ?? 'Bảng';
  const shapeActive = SHAPE_TOOLS.some((t) => t.id === s.tool);

  const tool = (id: Tool, label: string, icon: keyof typeof Icons) => (
    <button key={id} className={s.tool === id ? 'sel' : ''} onClick={() => s.setTool(id)} aria-label={label} title={label} data-testid={`tool-${id}`}>
      {Icons[icon]}
    </button>
  );
  const open = (p: Exclude<Panel, null>, label: string, icon: keyof typeof Icons) => (
    <button className={panel === p ? 'sel' : ''} onClick={() => togglePanel(p)} aria-label={label} title={label} data-testid={`open-${p}`}>
      {Icons[icon]}
    </button>
  );

  return (
    <header className="gn-header">
      <div className="gn-tabs" role="tablist" aria-label="Các bảng đang mở">
        <button className="home" onClick={() => void showLibrary()} aria-label="Tài liệu" title="Thư viện tài liệu" data-testid="home">
          {Icons.home}
        </button>
        {tabs.map((id) => (
          <div key={id} className={`tab ${id === s.boardId ? 'on' : ''}`} role="tab" aria-selected={id === s.boardId} data-testid="tab">
            <button className="name" onClick={() => void openInTab(id)}>{boardName(id)}</button>
            <button className="x" onClick={() => void closeTab(id)} aria-label={`Đóng ${boardName(id)}`} data-testid="tab-close">{Icons.close}</button>
          </div>
        ))}
        <button className="newtab" onClick={() => void addBoard()} aria-label="Bảng mới" title="Bảng mới" data-testid="add-board">{Icons.add}</button>
      </div>

      <div className="gn-toolbar" role="toolbar" aria-label="Công cụ">
        <div className="side left">
          <button className="home2" onClick={() => void showLibrary()} aria-label="Tài liệu" title="Thư viện tài liệu" data-testid="home-compact">{Icons.home}</button>
          {open('boards', 'Các bảng', 'sidebar')}
        </div>
        <div className="center">
          {tool('lasso', 'Khoanh vùng', 'lasso')}
          {tool('select', 'Chọn', 'select')}
          <i className="sep" />
          {tool('pen', 'Bút', 'pen')}
          {tool('highlighter', 'Bút dạ quang', 'highlighter')}
          {tool('eraser', 'Tẩy', 'eraser')}
          <i className="sep" />
          {open('text', 'Công thức', 'text')}
          <span className="pop-anchor">
            <button className={shapeActive || popover === 'shapes' ? 'sel' : ''} onClick={() => togglePopover('shapes')} aria-label="Hình vẽ nhanh" title="Đoạn thẳng, mũi tên, compa, hình chữ nhật" data-testid="open-shapes">
              {Icons.shapes}
            </button>
            {popover === 'shapes' && (
              <div className="popover" role="menu">
                {SHAPE_TOOLS.map((t) => (
                  <button key={t.id} className={s.tool === t.id ? 'sel' : ''} onClick={() => { s.setTool(t.id); setPopover(null); }} data-testid={`tool-${t.id}`}>
                    {Icons[t.icon]}<span>{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </span>
          {open('library', 'Hình vẽ sẵn', 'library')}
          {open('graph', 'Đồ thị', 'graph')}
          <i className="sep" />
          <button className={s.ruler ? 'sel' : ''} onClick={() => s.setRuler(s.ruler ? null : { x: boardCenterX() - 240, y: boardCenterY() - 32, rot: 0 })} aria-label="Thước kẻ" title="Thước kẻ: bút tựa cạnh thước sẽ kẻ đường thẳng" data-testid="ruler">
            {Icons.ruler}
          </button>
          <button className={s.protractor ? 'sel' : ''} onClick={() => s.setProtractor(s.protractor ? null : { x: boardCenterX(), y: boardCenterY() + 60, rot: 0 })} aria-label="Thước đo góc" title="Thước đo góc" data-testid="protractor">
            {Icons.protractor}
          </button>
        </div>
        <div className="side right">
          <button className={s.pencilOnly ? 'sel' : ''} onClick={() => s.setPencilOnly(!s.pencilOnly)} aria-label="Chỉ Pencil" aria-pressed={s.pencilOnly} title="Chỉ Apple Pencil vẽ; ngón tay để kéo/thu phóng" data-testid="pencil-only">
            {Icons.hand}
          </button>
          {open('export', 'Xuất', 'share')}
          <span className="pop-anchor right">
            <button className={popover === 'more' ? 'sel' : ''} onClick={() => togglePopover('more')} aria-label="Thêm" title="Nền giấy, xoá bảng" data-testid="open-more">{Icons.more}</button>
            {popover === 'more' && (
              <div className="popover wide" role="menu">
                <h4>Nền giấy</h4>
                <div className="bgs">
                  {([['blank', 'Trắng'], ['grid', 'Ô li'], ['dots', 'Chấm'], ['axes', 'Oxy']] as const).map(([id, label]) => (
                    <button key={id} className={s.background === id ? 'sel' : ''} onClick={() => s.setBackground(id)} data-testid={`bg-${id}`}>{label}</button>
                  ))}
                </div>
                <button className="row" onClick={() => { s.setViewport({ x: 0, y: 0, scale: 1 }); setPopover(null); }}>Thu phóng 100%</button>
                <button className="row danger" disabled={!s.hasItems} onClick={() => { s.clear(); setPopover(null); }} data-testid="clear-board">Xoá toàn bộ bảng</button>
              </div>
            )}
          </span>
        </div>
      </div>
    </header>
  );
}

function boardRect() {
  const r = document.querySelector('.board')?.getBoundingClientRect();
  const vp = useBoard.getState().viewport;
  return { w: r?.width ?? window.innerWidth, h: r?.height ?? window.innerHeight, vp };
}
const boardCenterX = () => { const { w, vp } = boardRect(); return (w / 2 - vp.x) / vp.scale; };
const boardCenterY = () => { const { h, vp } = boardRect(); return (h / 2 - vp.y) / vp.scale; };
