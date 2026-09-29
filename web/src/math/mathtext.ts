/** Tiny LaTeX-like math layout for canvas: \frac \sqrt ^ _ \vec \overline \widehat greek symbols. */

export type MNode =
  | { k: 'txt'; s: string; italic?: boolean; op?: boolean }
  | { k: 'row'; c: MNode[] }
  | { k: 'script'; base: MNode; sup?: MNode; sub?: MNode }
  | { k: 'frac'; n: MNode; d: MNode }
  | { k: 'sqrt'; c: MNode }
  | { k: 'over'; c: MNode; kind: 'vec' | 'bar' | 'hat' };

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', theta: 'θ', lambda: 'λ',
  mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', omega: 'ω', varrho: 'ρ',
  Delta: 'Δ', Omega: 'Ω', Sigma: 'Σ', Pi: 'Π', Phi: 'Φ', Gamma: 'Γ', Lambda: 'Λ', Theta: 'Θ',
  infty: '∞', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', pm: '±', mp: '∓',
  cdot: '·', times: '×', div: '÷', to: '→', rightarrow: '→', Rightarrow: '⇒', Leftrightarrow: '⇔',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cap: '∩', cup: '∪', emptyset: '∅', perp: '⊥',
  parallel: '∥', circ: '°', degree: '°', angle: '∠', triangle: '△', forall: '∀', exists: '∃',
  sim: '∼', equiv: '≡', in_: '∈', ldots: '…', cdots: '⋯', prime: '′', neg: '¬', vee: '∨', wedge: '∧',
  lbrace: '{', rbrace: '}', mathbb_R: 'ℝ', R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ',
};
const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'cot', 'log', 'ln', 'lim', 'max', 'min', 'exp', 'arcsin', 'arccos', 'arctan']);
const REL = new Set(['=', '<', '>', '≤', '≥', '≠', '≈', '→', '⇒', '⇔', '∈', '∉', '⊂', '⊆', '≡', '∼']);
const BIN = new Set(['+', '−', '±', '∓', '×', '÷', '∩', '∪', '∨', '∧']);

class P {
  i = 0;
  constructor(private s: string) {}
  end() {
    return this.i >= this.s.length;
  }
  row(stopAtBrace: boolean): MNode {
    const items: MNode[] = [];
    while (!this.end()) {
      const c = this.s[this.i];
      if (c === '}' && stopAtBrace) break;
      if (c === '}') {
        this.i++;
        continue;
      }
      if (/\s/.test(c)) {
        this.i++;
        continue;
      }
      let a = this.atom();
      for (;;) {
        const n = this.s[this.i];
        if (n !== '^' && n !== '_') break;
        this.i++;
        const arg = this.scriptArg();
        a = a.k === 'script' ? { ...a, [n === '^' ? 'sup' : 'sub']: arg } : { k: 'script', base: a, [n === '^' ? 'sup' : 'sub']: arg };
      }
      items.push(a);
    }
    return { k: 'row', c: items };
  }
  scriptArg(): MNode {
    while (/\s/.test(this.s[this.i] ?? '')) this.i++;
    if (this.s[this.i] === '{') {
      this.i++;
      const r = this.row(true);
      if (this.s[this.i] === '}') this.i++;
      return r;
    }
    return this.atom();
  }
  group(): MNode {
    while (/\s/.test(this.s[this.i] ?? '')) this.i++;
    if (this.s[this.i] === '{') {
      this.i++;
      const r = this.row(true);
      if (this.s[this.i] === '}') this.i++;
      return r;
    }
    return this.atom();
  }
  atom(): MNode {
    if (this.end()) return { k: 'txt', s: '' };
    const c = this.s[this.i];
    if (c === '{') return this.group();
    if (c === '\\') {
      this.i++;
      let name = '';
      while (/[a-zA-Z]/.test(this.s[this.i] ?? '')) name += this.s[this.i++];
      if (!name) {
        const ch = this.s[this.i++] ?? '';
        return { k: 'txt', s: ch === ',' || ch === ' ' || ch === ';' ? ' ' : ch };
      }
      switch (name) {
        case 'frac':
        case 'dfrac': {
          const n = this.group();
          const d = this.group();
          return { k: 'frac', n, d };
        }
        case 'sqrt':
          return { k: 'sqrt', c: this.group() };
        case 'vec':
          return { k: 'over', c: this.group(), kind: 'vec' };
        case 'overrightarrow':
          return { k: 'over', c: this.group(), kind: 'vec' };
        case 'overline':
        case 'bar':
          return { k: 'over', c: this.group(), kind: 'bar' };
        case 'widehat':
        case 'hat':
          return { k: 'over', c: this.group(), kind: 'hat' };
        case 'left':
        case 'right':
        case 'displaystyle':
        case 'quad':
        case 'qquad':
          return { k: 'txt', s: name.startsWith('q') ? ' ' : '' };
        case 'text':
        case 'mathrm': {
          while (/\s/.test(this.s[this.i] ?? '')) this.i++;
          if (this.s[this.i] !== '{') return { k: 'txt', s: '' };
          this.i++;
          let t = '';
          while (!this.end() && this.s[this.i] !== '}') t += this.s[this.i++];
          this.i++;
          return { k: 'txt', s: t };
        }
        default:
          if (FUNC_NAMES.has(name)) return { k: 'txt', s: name + ' ' };
          if (name in SYMBOLS) {
            const s = SYMBOLS[name];
            return { k: 'txt', s, italic: /[α-ωΑ-Ω]/.test(s) && /[a-z]/.test(name), op: REL.has(s) || BIN.has(s) };
          }
          return { k: 'txt', s: name };
      }
    }
    if (/[0-9]/.test(c)) {
      let s = '';
      while (/[0-9.]/.test(this.s[this.i] ?? '')) s += this.s[this.i++];
      return { k: 'txt', s };
    }
    this.i++;
    if (c === "'") return { k: 'txt', s: '′' };
    if (/[A-Za-z]/.test(c)) return { k: 'txt', s: c, italic: true };
    if (c === '-') return { k: 'txt', s: '−', op: true };
    return { k: 'txt', s: c, op: REL.has(c) || BIN.has(c) };
  }
}

export function parseMath(src: string): MNode {
  return new P(src).row(false);
}

export function mathPlain(n: MNode): string {
  switch (n.k) {
    case 'txt':
      return n.s;
    case 'row':
      return n.c.map(mathPlain).join('');
    case 'script': {
      const b = mathPlain(n.base);
      const sup = n.sup ? '^' + wrap(mathPlain(n.sup)) : '';
      const sub = n.sub ? '_' + wrap(mathPlain(n.sub)) : '';
      return b + sub + sup;
    }
    case 'frac':
      return `${wrap(mathPlain(n.n))}/${wrap(mathPlain(n.d))}`;
    case 'sqrt':
      return `√${wrap(mathPlain(n.c))}`;
    case 'over':
      return mathPlain(n.c);
  }
}
const wrap = (s: string) => (s.length > 1 ? `(${s})` : s);

const plainCache = new Map<string, string>();

export function plainText(src: string): string {
  let p = plainCache.get(src);
  if (p === undefined) {
    p = mathPlain(parseMath(src));
    if (plainCache.size > 3000) plainCache.clear();
    plainCache.set(src, p);
  }
  return p;
}

// ---------------------------------------------------------------- layout / draw

export interface Box {
  w: number;
  asc: number;
  desc: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, base: number) => void;
}

const FAMILY = '"STIX Two Text","Times New Roman",Times,serif';

function layout(ctx: CanvasRenderingContext2D, n: MNode, size: number, color: string, prev?: MNode): Box {
  switch (n.k) {
    case 'txt': {
      const font = `${n.italic ? 'italic ' : ''}${size}px ${FAMILY}`;
      ctx.font = font;
      const tw = ctx.measureText(n.s).width;
      const pad = n.op && prev && !(prev.k === 'txt' && (prev.op || '([{;,'.includes(prev.s))) ? size * 0.22 : 0;
      const padR = n.op && prev ? pad : 0;
      return {
        w: tw + pad + padR,
        asc: size * 0.78,
        desc: size * 0.22,
        draw: (c, x, b) => {
          c.font = font;
          c.fillStyle = color;
          c.textBaseline = 'alphabetic';
          c.textAlign = 'left';
          c.fillText(n.s, x + pad, b);
        },
      };
    }
    case 'row': {
      const boxes: Box[] = [];
      n.c.forEach((c, i) => boxes.push(layout(ctx, c, size, color, n.c[i - 1])));
      const w = boxes.reduce((a, b) => a + b.w, 0);
      return {
        w,
        asc: Math.max(size * 0.78, ...boxes.map((b) => b.asc)),
        desc: Math.max(size * 0.22, ...boxes.map((b) => b.desc)),
        draw: (c, x, b) => {
          let cx = x;
          for (const bx of boxes) {
            bx.draw(c, cx, b);
            cx += bx.w;
          }
        },
      };
    }
    case 'script': {
      const base = layout(ctx, n.base, size, color);
      const sup = n.sup ? layout(ctx, n.sup, size * 0.7, color) : null;
      const sub = n.sub ? layout(ctx, n.sub, size * 0.7, color) : null;
      const supUp = base.asc * 0.62;
      const subDown = size * 0.24;
      const gap = size * 0.04;
      const w = base.w + gap + Math.max(sup?.w ?? 0, sub?.w ?? 0);
      return {
        w,
        asc: Math.max(base.asc, sup ? supUp + sup.asc : 0),
        desc: Math.max(base.desc, sub ? subDown + sub.desc : 0),
        draw: (c, x, b) => {
          base.draw(c, x, b);
          sup?.draw(c, x + base.w + gap, b - supUp);
          sub?.draw(c, x + base.w + gap, b + subDown);
        },
      };
    }
    case 'frac': {
      const s2 = size * 0.86;
      const nu = layout(ctx, n.n, s2, color);
      const de = layout(ctx, n.d, s2, color);
      const pad = size * 0.12;
      const w = Math.max(nu.w, de.w) + pad * 2;
      const axis = size * 0.28;
      const gap = size * 0.14;
      return {
        w,
        asc: axis + gap + nu.desc + nu.asc,
        desc: gap + de.asc + de.desc - axis,
        draw: (c, x, b) => {
          const ay = b - axis;
          c.strokeStyle = color;
          c.lineWidth = Math.max(1, size * 0.055);
          c.setLineDash([]);
          c.beginPath();
          c.moveTo(x + pad * 0.5, ay);
          c.lineTo(x + w - pad * 0.5, ay);
          c.stroke();
          nu.draw(c, x + (w - nu.w) / 2, ay - gap - nu.desc);
          de.draw(c, x + (w - de.w) / 2, ay + gap + de.asc);
        },
      };
    }
    case 'sqrt': {
      const inner = layout(ctx, n.c, size, color);
      const tick = size * 0.55;
      const gap = size * 0.12;
      return {
        w: inner.w + tick + size * 0.1,
        asc: inner.asc + gap + size * 0.06,
        desc: inner.desc,
        draw: (c, x, b) => {
          const top = b - inner.asc - gap;
          c.strokeStyle = color;
          c.lineWidth = Math.max(1, size * 0.06);
          c.lineJoin = 'round';
          c.setLineDash([]);
          c.beginPath();
          c.moveTo(x + tick * 0.05, b - size * 0.3);
          c.lineTo(x + tick * 0.35, b + inner.desc);
          c.lineTo(x + tick * 0.85, top);
          c.lineTo(x + tick + inner.w + size * 0.05, top);
          c.stroke();
          inner.draw(c, x + tick, b);
        },
      };
    }
    case 'over': {
      const inner = layout(ctx, n.c, size, color);
      const up = size * 0.16;
      return {
        w: inner.w,
        asc: inner.asc + up + size * 0.1,
        desc: inner.desc,
        draw: (c, x, b) => {
          inner.draw(c, x, b);
          const y = b - inner.asc - up * 0.4;
          c.strokeStyle = color;
          c.lineWidth = Math.max(1, size * 0.055);
          c.setLineDash([]);
          c.beginPath();
          if (n.kind === 'hat') {
            c.moveTo(x + inner.w * 0.2, y + up * 0.6);
            c.lineTo(x + inner.w / 2, y - up * 0.5);
            c.lineTo(x + inner.w * 0.8, y + up * 0.6);
          } else {
            c.moveTo(x, y);
            c.lineTo(x + inner.w, y);
            if (n.kind === 'vec') {
              const h = size * 0.14;
              c.moveTo(x + inner.w - h, y - h * 0.7);
              c.lineTo(x + inner.w, y);
              c.lineTo(x + inner.w - h, y + h * 0.7);
            }
          }
          c.stroke();
        },
      };
    }
  }
}

export function measureMath(ctx: CanvasRenderingContext2D, src: string, size: number) {
  const b = layout(ctx, parseMath(src), size, '#000');
  return { w: b.w, asc: b.asc, desc: b.desc };
}

/** Parsed + measured formulas, so panning a board full of labels does not re-layout them every frame. */
const boxCache = new Map<string, Box>();

/** Draws with (x, y) at the vertical centre of the formula. */
export function drawMath(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  size: number,
  color: string,
  anchor: 'start' | 'middle' | 'end' = 'middle',
  halo?: string,
) {
  const key = `${size}|${color}|${src}`;
  let box = boxCache.get(key);
  if (!box) {
    box = layout(ctx, parseMath(src), size, color);
    if (boxCache.size > 1500) boxCache.clear();
    boxCache.set(key, box);
  }
  const left = anchor === 'start' ? x : anchor === 'middle' ? x - box.w / 2 : x - box.w;
  const base = y + (box.asc - box.desc) / 2;
  ctx.save();
  ctx.setLineDash([]);
  if (halo) {
    ctx.fillStyle = halo;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(left - 2, base - box.asc - 1, box.w + 4, box.asc + box.desc + 2);
    ctx.globalAlpha = 1;
  }
  box.draw(ctx, left, base);
  ctx.restore();
}
