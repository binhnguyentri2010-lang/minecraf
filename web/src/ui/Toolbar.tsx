import { exportPng } from '../canvas/render';
import { COLORS, useBoard } from '../canvas/store';
import type { Background, Tool } from '../canvas/types';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'pen', label: 'Bút' },
  { id: 'highlighter', label: 'Dạ quang' },
  { id: 'eraser', label: 'Tẩy' },
];
const BGS: { id: Background; label: string }[] = [
  { id: 'blank', label: 'Trắng' },
  { id: 'grid', label: 'Ô li' },
  { id: 'dots', label: 'Chấm' },
  { id: 'axes', label: 'Oxy' },
];

export function Toolbar() {
  const s = useBoard();
  const download = async () => {
    const blob = await exportPng(s.strokes, s.background);
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bang-toan.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="toolbar glass" role="toolbar" aria-label="Công cụ vẽ">
      <div className="group">
        {TOOLS.map((t) => (
          <button key={t.id} className={s.tool === t.id ? 'on' : ''} onClick={() => s.setTool(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="group">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Màu ${c}`}
            className={`swatch ${s.color === c && s.tool !== 'eraser' ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => s.setColor(c)}
          />
        ))}
        <input
          type="range"
          min={1}
          max={12}
          step={0.5}
          value={s.size}
          aria-label="Độ dày nét"
          onChange={(e) => s.setSize(Number(e.target.value))}
        />
      </div>
      <div className="group">
        <button disabled={!s.undoStack.length} onClick={s.undo} aria-label="Hoàn tác">↶</button>
        <button disabled={!s.redoStack.length} onClick={s.redo} aria-label="Làm lại">↷</button>
        <button disabled={!s.strokes.length} onClick={s.clear}>Xoá hết</button>
      </div>
      <div className="group">
        <select value={s.background} onChange={(e) => s.setBackground(e.target.value as Background)} aria-label="Nền">
          {BGS.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        <button
          className={s.pencilOnly ? 'on' : ''}
          onClick={() => s.setPencilOnly(!s.pencilOnly)}
          title="Chỉ Pencil vẽ; ngón tay để kéo/thu phóng"
        >
          Chỉ Pencil
        </button>
        <button onClick={() => s.setViewport({ x: 0, y: 0, scale: 1 })}>{Math.round(s.viewport.scale * 100)}%</button>
        <button onClick={download}>PNG</button>
      </div>
    </div>
  );
}
