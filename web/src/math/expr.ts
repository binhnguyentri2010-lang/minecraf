/** Safe expression parser/evaluator for y = f(x). No eval / Function. */

export class ExprError extends Error {}

type Node =
  | { k: 'num'; v: number }
  | { k: 'var' }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; l: Node; r: Node }
  | { k: 'neg'; e: Node }
  | { k: 'fn'; name: string; e: Node };

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (x) => 1 / Math.tan(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  lg: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  sign: Math.sign,
};

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const KNOWN = [...Object.keys(FUNCS), ...Object.keys(CONSTS), 'x'].sort((a, b) => b.length - a.length);

const SUPERS: Record<string, string> = { '²': '2', '³': '3', '⁴': '4' };

type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; s: string }
  | { t: 'op'; s: string };

function tokenize(src: string): Tok[] {
  const s = src
    .replace(/\s+/g, '')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/[×·]/g, '*')
    .replace(/[−–]/g, '-')
    .replace(/[²³⁴]/g, (c) => '^' + SUPERS[c]);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new ExprError('Số không hợp lệ');
      // "2e" followed by letters (e.g. 2exp) must not eat the e
      let txt = m[0];
      if (m[2] && /[a-zA-Z]/.test(s[i + txt.length] ?? '')) txt = m[1];
      out.push({ t: 'num', v: Number(txt) });
      i += txt.length;
    } else if (/[a-zA-Z]/.test(c)) {
      const run = /^[a-zA-Z]+/.exec(s.slice(i))![0].toLowerCase();
      // split a glued run such as "sinx" or "2xsin" using the longest known name at each position
      let pos = 0;
      while (pos < run.length) {
        const rest = run.slice(pos);
        let name = KNOWN.find((k) => rest.startsWith(k));
        if (!name) throw new ExprError(`Không hiểu "${rest}"`);
        if (name === 'log' && pos + 3 === run.length && s.startsWith('2(', i + pos + 3)) {
          name = 'log2';
          i += 1;
        }
        out.push({ t: 'id', s: name });
        pos += name.length === 4 && name === 'log2' ? 3 : name.length;
      }
      i += run.length;
    } else if ('+-*/^(),'.includes(c)) {
      out.push({ t: 'op', s: c });
      i++;
    } else {
      throw new ExprError(`Ký tự không hợp lệ: "${c}"`);
    }
  }
  return out;
}

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.p];
  }
  private isOp(s: string) {
    const t = this.peek();
    return t?.t === 'op' && t.s === s;
  }

  parse(): Node {
    if (this.toks.length === 0) throw new ExprError('Chưa nhập biểu thức');
    const n = this.sum();
    if (this.p < this.toks.length) throw new ExprError('Biểu thức thừa hoặc thiếu dấu');
    return n;
  }

  private sum(): Node {
    let l = this.prod();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.p++] as { s: '+' | '-' }).s;
      l = { k: 'bin', op, l, r: this.prod() };
    }
    return l;
  }

  private startsFactor(): boolean {
    const t = this.peek();
    if (!t) return false;
    return t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.s === '(');
  }

  private prod(): Node {
    let l = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.p++] as { s: '*' | '/' }).s;
        l = { k: 'bin', op, l, r: this.unary() };
      } else if (this.startsFactor()) {
        l = { k: 'bin', op: '*', l, r: this.unary() }; // implicit multiplication: 2x, 2(x+1)
      } else return l;
    }
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.p++;
      return { k: 'neg', e: this.unary() };
    }
    if (this.isOp('+')) {
      this.p++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.atom();
    if (this.isOp('^')) {
      this.p++;
      // right-associative; exponent may carry a sign: x^-2
      const e = this.isOp('-') ? (this.p++, { k: 'neg', e: this.power() } as Node) : this.power();
      return { k: 'bin', op: '^', l: base, r: e };
    }
    return base;
  }

  private atom(): Node {
    const t = this.toks[this.p++];
    if (!t) throw new ExprError('Biểu thức chưa đầy đủ');
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'op' && t.s === '(') {
      const n = this.sum();
      if (!this.isOp(')')) throw new ExprError('Thiếu dấu )');
      this.p++;
      return n;
    }
    if (t.t === 'id') {
      if (t.s === 'x') return { k: 'var' };
      if (has(CONSTS, t.s)) return { k: 'num', v: CONSTS[t.s] };
      if (has(FUNCS, t.s)) {
        if (!this.isOp('(')) {
          // allow "sin x", "sqrt2" style: argument is the following power-level factor
          if (!this.startsFactor()) throw new ExprError(`Hàm ${t.s} cần đối số`);
          return { k: 'fn', name: t.s, e: this.power() };
        }
        this.p++;
        const e = this.sum();
        if (!this.isOp(')')) throw new ExprError('Thiếu dấu )');
        this.p++;
        return { k: 'fn', name: t.s, e };
      }
      throw new ExprError(`Không hiểu "${t.s}"`);
    }
    throw new ExprError(`Dấu "${t.s}" đặt sai chỗ`);
  }
}

function evalNode(n: Node, x: number): number {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'var':
      return x;
    case 'neg':
      return -evalNode(n.e, x);
    case 'fn':
      return FUNCS[n.name](evalNode(n.e, x));
    case 'bin': {
      const a = evalNode(n.l, x);
      const b = evalNode(n.r, x);
      switch (n.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          // real cube-root style powers of negatives: (-8)^(1/3) = -2
          if (a < 0 && Number.isFinite(b) && !Number.isInteger(b)) {
            const inv = 1 / b;
            if (Number.isInteger(inv) && Math.abs(inv) % 2 === 1) return -Math.pow(-a, b);
          }
          return Math.pow(a, b);
      }
    }
  }
}

/** Strip "y=" / "f(x)=" prefixes. */
export function stripLhs(src: string): string {
  return src.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
}

export function compile(src: string): (x: number) => number {
  const ast = new Parser(tokenize(stripLhs(src))).parse();
  return (x) => evalNode(ast, x);
}

export function tryCompile(src: string): { fn: (x: number) => number } | { error: string } {
  try {
    const fn = compile(src);
    fn(1);
    return { fn };
  } catch (e) {
    return { error: e instanceof ExprError ? e.message : 'Biểu thức không hợp lệ' };
  }
}
