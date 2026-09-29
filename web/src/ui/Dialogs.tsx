import { useEffect, useRef, useState } from 'react';
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

const GRAPH_EXAMPLES = ['x^2 - 2x - 3', '2x + 1', 'sin(x)', 'abs(x - 1)', '1/(x-1)', 'sqrt(x + 2)', 'x^3 - 3x', 'log2(x)', '2^x', 'tan(x)'];

export function GraphDialog() {
  const setPanel = useUI((s) => s.setPanel);
  const [expr, setExpr] = useState('x^2 - 2x - 3');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const res = tryCompile(expr);
  const ok = 'fn' in res;
  const submit = () => {
    if (!ok) return;
    insertGraph(expr);
    setPanel(null);
  };
  return (
    <Modal title="Vẽ đồ thị hàm số" testid="graph-dialog">
      <label className="field">
        <span>y =</span>
        <input ref={ref} type="text" value={expr} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} data-testid="graph-expr" />
      </label>
      {!ok && <p className="err" data-testid="graph-error">{res.error}</p>}
      <p className="hint">Dùng x, số, + − * / ^, ngoặc, pi, e và các hàm sin cos tan cot sqrt abs ln log log2 exp. Có thể viết 2x, x(x+1).</p>
      <div className="chips">
        {GRAPH_EXAMPLES.map((e) => (
          <button key={e} onClick={() => setExpr(e)}>{e}</button>
        ))}
      </div>
      <footer>
        <button className="primary" disabled={!ok} onClick={submit} data-testid="graph-insert">Chèn đồ thị</button>
      </footer>
    </Modal>
  );
}

const TEXT_EXAMPLES = [
  '\\frac{a}{b}', '\\sqrt{x^2+1}', 'x^2+y^2=R^2', '\\vec{AB}+\\vec{BC}=\\vec{AC}', '\\sin^2 x+\\cos^2 x=1', '\\Delta=b^2-4ac', 'x_{1,2}=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}', '\\widehat{ABC}=90^\\circ', '(P)\\parallel(Q)', 'd\\perp(P)',
];

export function TextDialog() {
  const setPanel = useUI((s) => s.setPanel);
  const [src, setSrc] = useState('\\frac{a}{b}');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const submit = () => {
    if (!src.trim()) return;
    insertText(src);
    setPanel(null);
  };
  return (
    <Modal title="Chèn công thức / chữ" testid="text-dialog">
      <label className="field">
        <span>Nội dung</span>
        <input ref={ref} type="text" value={src} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(e) => setSrc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} data-testid="text-src" />
      </label>
      <p className="hint">Cú pháp giống LaTeX: \frac{'{a}{b}'}, \sqrt{'{x}'}, x^2, x_1, \vec{'{AB}'}, \alpha \pi \infty \le \ge \ne \cap \cup \in \perp \parallel.</p>
      <div className="chips">
        {TEXT_EXAMPLES.map((e) => (
          <button key={e} onClick={() => setSrc(e)}>{e}</button>
        ))}
      </div>
      <footer>
        <button className="primary" disabled={!src.trim()} onClick={submit} data-testid="text-insert">Chèn</button>
      </footer>
    </Modal>
  );
}
