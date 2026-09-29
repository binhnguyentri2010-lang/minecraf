import { shallow } from 'zustand/shallow';
import { COLORS, useBoard } from '../canvas/store';
import { Icons } from './icons';

const WIDTHS: [string, number, number][] = [['thin', 2, 2], ['medium', 4, 4], ['thick', 8, 7]];
const DRAWING = new Set(['pen', 'highlighter', 'line', 'arrow', 'circle', 'rect']);

/** GoodNotes-style floating options for the active drawing tool: helpers, stroke width, colours. */
export function FloatBar() {
  const s = useBoard(
    (st) => ({
      tool: st.tool, color: st.color, size: st.size, dash: st.dash, snap: st.snap, smooth: st.smooth, palette: st.palette,
      setColor: st.setColor, setSize: st.setSize, setDash: st.setDash, setSnap: st.setSnap, setSmooth: st.setSmooth, addColor: st.addColor,
    }),
    shallow,
  );
  if (!DRAWING.has(s.tool)) return null;
  const extra = s.palette.filter((c) => !COLORS.includes(c));
  return (
    <div className="gn-float" role="toolbar" aria-label="Tuỳ chọn nét vẽ" data-testid="floatbar">
      <div className="grp">
        <button className={s.snap ? 'on' : ''} onClick={() => s.setSnap(!s.snap)} aria-label="Nắn nét" aria-pressed={s.snap} title="Giữ bút yên khi vẽ để nắn nét thành đường thẳng, tròn, elip, đa giác" data-testid="snap">
          {Icons.snap}<span className="lbl">Nắn nét</span>
        </button>
        <button className={s.smooth > 0 ? 'on' : ''} onClick={() => s.setSmooth(s.smooth === 0 ? 0.5 : s.smooth < 1 ? 1 : 0)} aria-label="Làm mượt nét" title="Làm mượt nét: tắt, vừa, mạnh" data-testid="smooth">
          {Icons.smooth}<span className="lbl">Mượt: {s.smooth === 0 ? 'tắt' : s.smooth < 1 ? 'vừa' : 'mạnh'}</span>
        </button>
        <button className={s.dash ? 'on' : ''} onClick={() => s.setDash(!s.dash)} aria-label="Nét đứt" aria-pressed={s.dash} title="Nét đứt (đoạn thẳng, hình vẽ sẵn)" data-testid="dash">
          {Icons.dash}<span className="lbl">Nét đứt</span>
        </button>
      </div>
      <div className="grp">
        {WIDTHS.map(([id, size, px]) => (
          <button key={id} className={`w ${Math.abs(s.size - size) < 1.2 ? 'on' : ''}`} onClick={() => s.setSize(size)} aria-label={`Nét ${id === 'thin' ? 'mảnh' : id === 'medium' ? 'vừa' : 'dày'}`} data-testid={`width-${id}`}>
            <i style={{ height: px }} />
          </button>
        ))}
      </div>
      <div className="grp colors">
        {[...COLORS, ...extra].map((c) => (
          <button key={c} aria-label={`Màu ${c}`} className={`swatch ${s.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => s.setColor(c)}>
            {s.color === c && <span className="chev">{Icons.chevron}</span>}
          </button>
        ))}
        <label className="addcolor" title="Thêm màu" aria-label="Thêm màu">
          {Icons.add}
          <input type="color" value={s.color} onChange={(e) => s.addColor(e.target.value)} data-testid="add-color" aria-label="Chọn màu tuỳ ý" />
        </label>
      </div>
    </div>
  );
}
