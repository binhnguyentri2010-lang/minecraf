import { shallow } from 'zustand/shallow';
import { COLORS, useBoard } from '../canvas/store';
import type { Tool } from '../canvas/types';
import { boardCenter } from '../shapes/insert';
import { Icons } from './icons';

const TOOLS: { id: Tool; label: string; icon: keyof typeof Icons }[] = [
  { id: 'select', label: 'Chọn', icon: 'select' },
  { id: 'pen', label: 'Bút', icon: 'pen' },
  { id: 'highlighter', label: 'Dạ quang', icon: 'highlighter' },
  { id: 'eraser', label: 'Tẩy', icon: 'eraser' },
];
const SHAPE_TOOLS: { id: Tool; label: string; icon: keyof typeof Icons }[] = [
  { id: 'line', label: 'Đoạn thẳng', icon: 'line' },
  { id: 'arrow', label: 'Mũi tên', icon: 'arrow' },
  { id: 'circle', label: 'Compa (đường tròn)', icon: 'circle' },
  { id: 'rect', label: 'Hình chữ nhật', icon: 'rect' },
];

export function Dock() {
  const s = useBoard(
    (st) => ({
      tool: st.tool, color: st.color, size: st.size, dash: st.dash, snap: st.snap, pencilOnly: st.pencilOnly,
      ruler: st.ruler, protractor: st.protractor, setTool: st.setTool, setColor: st.setColor, setSize: st.setSize,
      setDash: st.setDash, setSnap: st.setSnap, setPencilOnly: st.setPencilOnly, setRuler: st.setRuler, setProtractor: st.setProtractor,
    }),
    shallow,
  );
  const btn = (id: Tool, label: string, icon: keyof typeof Icons) => (
    <button key={id} className={s.tool === id ? 'on' : ''} onClick={() => s.setTool(id)} aria-label={label} title={label} data-testid={`tool-${id}`}>
      {Icons[icon]}
      <span className="lbl">{label.split(' ')[0]}</span>
    </button>
  );
  return (
    <div className="dock glass" role="toolbar" aria-label="Công cụ vẽ">
      <div className="group">{TOOLS.map((t) => btn(t.id, t.label, t.icon))}</div>
      <div className="group">{SHAPE_TOOLS.map((t) => btn(t.id, t.label, t.icon))}</div>
      <div className="group colors">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Màu ${c}`}
            className={`swatch ${s.color === c ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => s.setColor(c)}
          />
        ))}
        <input type="range" min={1} max={12} step={0.5} value={s.size} aria-label="Độ dày nét" onChange={(e) => s.setSize(Number(e.target.value))} />
      </div>
      <div className="group">
        <button className={s.dash ? 'on' : ''} onClick={() => s.setDash(!s.dash)} aria-label="Nét đứt" title="Nét đứt (cho đoạn thẳng, hình vẽ sẵn)" data-testid="dash">
          {Icons.dash}
          <span className="lbl">Nét đứt</span>
        </button>
        <button className={s.ruler ? 'on' : ''} onClick={() => s.setRuler(s.ruler ? null : { x: boardCenter().x - 240, y: boardCenter().y - 32, rot: 0 })} aria-label="Thước kẻ" title="Thước kẻ: bút tựa cạnh thước sẽ kẻ đường thẳng" data-testid="ruler">
          {Icons.ruler}
          <span className="lbl">Thước</span>
        </button>
        <button className={s.protractor ? 'on' : ''} onClick={() => s.setProtractor(s.protractor ? null : { x: boardCenter().x, y: boardCenter().y + 60, rot: 0 })} aria-label="Thước đo góc" title="Thước đo góc" data-testid="protractor">
          {Icons.protractor}
          <span className="lbl">Đo góc</span>
        </button>
        <button className={s.snap ? 'on' : ''} onClick={() => s.setSnap(!s.snap)} aria-label="Nắn nét" title="Giữ bút yên cuối nét để nắn thành đường thẳng, tròn, elip, đa giác" data-testid="snap">
          {Icons.snap}
          <span className="lbl">Nắn nét</span>
        </button>
        <button className={s.pencilOnly ? 'on' : ''} onClick={() => s.setPencilOnly(!s.pencilOnly)} aria-label="Chỉ Pencil" title="Chỉ Apple Pencil vẽ; ngón tay để kéo/thu phóng" data-testid="pencil-only">
          {Icons.hand}
          <span className="lbl">Chỉ Pencil</span>
        </button>
      </div>
    </div>
  );
}
