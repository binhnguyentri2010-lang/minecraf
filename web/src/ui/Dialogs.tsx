import { useEffect, useRef, useState } from 'react';
import { primBounds } from '../canvas/objects';
import { PAPER, drawObj } from '../canvas/render';
import type { Prim } from '../canvas/types';
import { defaultParams, generate, shapeById } from '../shapes/registry';
import { tryCompile } from '../math/expr';
import { insertGraph, insertText } from '../shapes/insert';
import { Icons } from './icons';
import { useUI } from './uiStore';

function Modal({ title, children, testid }: { title: string; children: React.ReactNode; testid: string }) {
  const setPanel = useUI((s) => s.setPanel);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [setPanel]);
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && setPanel(null)}>
      <div className="modal glass" role="dialog" aria-label={title} data-testid={testid}>
        <header>
          <h2>{title}</h2>
          <button onClick={() => setPanel(null)} aria-label="Đóng">{Icons.close}</button>
        </header>
        {children}
      </div>
    </div>
  );
}


/** Draws primitives fitted into a small paper-coloured box (live preview inside dialogs). */
function PrimPreview({ prims, height = 110, testid }: { prims: Prim[]; height?: number; testid: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = c.clientWidth, h = height;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, c.width, c.height);
    if (!prims.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of prims) {
      const b = primBounds(p);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    const pad = 14;
    const k = Math.min((w - pad * 2) / Math.max(maxX - minX, 1), (h - pad * 2) / Math.max(maxY - minY, 1), 3);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawObj(ctx, {
      type: 'obj', id: 'preview', seq: 0, prims, color: '#111318', lw: 2, rot: 0, scale: k,
      x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k,
    });
  }, [prims, height]);
  return <canvas ref={ref} className="preview" style={{ height }} data-testid={testid} aria-label="Xem trước" />;
}

const GRAPH_EXAMPLES: [string, string][] = [
  ['Parabol', 'x^2 - 2x - 3'], ['Đường thẳng', '2x + 1'], ['Sin', 'sin(x)'], ['Giá trị tuyệt đối', 'abs(x - 1)'], ['Phân thức', '1/(x-1)'],
  ['Căn thức', 'sqrt(x + 2)'], ['Bậc ba', 'x^3 - 3x'], ['Logarit', 'log2(x)'], ['Mũ', '2^x'], ['Tan', 'tan(x)'],
];

export function GraphDialog() {
  const setPanel = useUI((s) => s.setPanel);
  const [expr, setExpr] = useState('x^2 - 2x - 3');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const res = tryCompile(expr);
  const ok = 'fn' in res;
  const def = shapeById('fn-custom')!;
  const prims = generate(def, { ...defaultParams(def), expr, xr: 6, yr: 5 });
  const submit = () => {
    if (!ok) return;
    insertGraph(expr);
    setPanel(null);
  };
  return (
    <Modal title="Vẽ đồ thị hàm số" testid="graph-dialog">
      <PrimPreview prims={ok ? prims : []} height={170} testid="graph-preview" />
      <label className="field big">
        <span>y =</span>
        <input ref={ref} type="text" value={expr} spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder="ví dụ x^2 - 2x - 3" onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} data-testid="graph-expr" />
      </label>
      {!ok && <p className="err" data-testid="graph-error">{res.error}</p>}
      <h3 className="sub">Mẫu</h3>
      <div className="chips">
        {GRAPH_EXAMPLES.map(([name, e]) => (
          <button key={e} onClick={() => setExpr(e)} title={e}>{name}</button>
        ))}
      </div>
      <p className="hint">Gõ x, số, + − * / ^, ngoặc, pi, e và các hàm sin cos tan cot sqrt abs ln log log2 exp. Viết 2x hay x(x+1) đều được.</p>
      <footer>
        <button className="primary" disabled={!ok} onClick={submit} data-testid="graph-insert">Chèn đồ thị</button>
      </footer>
    </Modal>
  );
}

/** [label shown on the button, snippet inserted, caret position inside the snippet] */
const PALETTE: { group: string; items: [string, string, number, string][] }[] = [
  { group: 'Cấu trúc', items: [
    ['a⁄b', '\\frac{}{}', 6, 'Phân số'], ['√', '\\sqrt{}', 6, 'Căn bậc hai'], ['xⁿ', '^{}', 2, 'Số mũ'], ['xₙ', '_{}', 2, 'Chỉ số dưới'],
    ['→', '\\vec{}', 5, 'Vectơ'], ['x̄', '\\overline{}', 10, 'Gạch trên'], ['∠', '\\widehat{}', 9, 'Góc'],
  ] },
  { group: 'Chữ Hy Lạp', items: [
    ['π', '\\pi ', 4, 'pi'], ['α', '\\alpha ', 7, 'alpha'], ['β', '\\beta ', 6, 'beta'], ['γ', '\\gamma ', 7, 'gamma'], ['θ', '\\theta ', 7, 'theta'],
    ['φ', '\\varphi ', 8, 'phi'], ['λ', '\\lambda ', 8, 'lambda'], ['Δ', '\\Delta ', 7, 'Delta'],
  ] },
  { group: 'Phép toán và quan hệ', items: [
    ['±', '\\pm ', 4, 'cộng trừ'], ['·', '\\cdot ', 6, 'nhân'], ['×', '\\times ', 7, 'nhân chéo'], ['≤', '\\le ', 4, 'nhỏ hơn hoặc bằng'], ['≥', '\\ge ', 4, 'lớn hơn hoặc bằng'],
    ['≠', '\\ne ', 4, 'khác'], ['≈', '\\approx ', 8, 'xấp xỉ'], ['∞', '\\infty ', 7, 'vô cực'], ['°', '^\\circ ', 7, 'độ'],
  ] },
  { group: 'Tập hợp và hình học', items: [
    ['∈', '\\in ', 4, 'thuộc'], ['⊂', '\\subset ', 8, 'tập con'], ['∩', '\\cap ', 5, 'giao'], ['∪', '\\cup ', 5, 'hợp'], ['∅', '\\emptyset ', 10, 'tập rỗng'],
    ['⊥', '\\perp ', 6, 'vuông góc'], ['∥', '\\parallel ', 10, 'song song'], ['⇒', '\\Rightarrow ', 12, 'suy ra'], ['△', '\\triangle ', 10, 'tam giác'],
  ] },
];

const TEXT_EXAMPLES: [string, string][] = [
  ['Phân số', '\\frac{a}{b}'], ['Phương trình đường tròn', 'x^2+y^2=R^2'], ['Nghiệm phương trình bậc hai', 'x_{1,2}=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}'],
  ['Biệt thức', '\\Delta=b^2-4ac'], ['Tổng hai vectơ', '\\vec{AB}+\\vec{BC}=\\vec{AC}'], ['Công thức lượng giác', '\\sin^2 x+\\cos^2 x=1'],
  ['Góc vuông', '\\widehat{ABC}=90^\\circ'], ['Hai mặt phẳng song song', '(P)\\parallel(Q)'], ['Đường vuông góc mặt phẳng', 'd\\perp(P)'],
];

export function TextDialog() {
  const setPanel = useUI((s) => s.setPanel);
  const [src, setSrc] = useState('\\frac{a}{b}+\\sqrt{x}');
  const [size, setSize] = useState(26);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const prims: Prim[] = src.trim() ? [{ t: 'text', o: [0, 0], s: src, size, math: true, anchor: 'middle' }] : [];
  const submit = () => {
    if (!src.trim()) return;
    insertText(src, size);
    setPanel(null);
  };
  const insert = (snippet: string, caret: number) => {
    const el = ref.current;
    const a = el?.selectionStart ?? src.length;
    const b = el?.selectionEnd ?? src.length;
    // wrap the current selection when the snippet has an empty {} slot
    const sel = src.slice(a, b);
    const wrapped = sel && snippet.includes('{}') ? snippet.replace('{}', `{${sel}}`) : snippet;
    const next = src.slice(0, a) + wrapped + src.slice(b);
    const pos = a + (sel && snippet.includes('{}') ? snippet.indexOf('{}') + 1 + sel.length + 1 : caret);
    setSrc(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };
  return (
    <Modal title="Chèn công thức / chữ" testid="text-dialog">
      <PrimPreview prims={prims} height={120} testid="text-preview" />
      <label className="field big">
        <input ref={ref} type="text" value={src} spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder="Gõ nội dung, hoặc bấm ký hiệu bên dưới" onChange={(e) => setSrc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} aria-label="Nội dung" data-testid="text-src" />
      </label>
      <label className="field size">
        <span>Cỡ chữ</span>
        <input type="range" min={14} max={56} step={2} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Cỡ chữ" data-testid="text-size" />
        <output>{size}</output>
      </label>
      {PALETTE.map((g) => (
        <section key={g.group} className="palette-group">
          <h3 className="sub">{g.group}</h3>
          <div className="palette">
            {g.items.map(([label, snip, caret, name]) => (
              <button key={name} onClick={() => insert(snip, caret)} title={name} aria-label={name} data-testid={`sym-${name}`}>{label}</button>
            ))}
          </div>
        </section>
      ))}
      <h3 className="sub">Mẫu có sẵn</h3>
      <div className="chips">
        {TEXT_EXAMPLES.map(([name, e]) => (
          <button key={e} onClick={() => setSrc(e)} title={e}>{name}</button>
        ))}
      </div>
      <footer>
        <button className="primary" disabled={!src.trim()} onClick={submit} data-testid="text-insert">Chèn vào bảng</button>
      </footer>
    </Modal>
  );
}
