import { describe, expect, it } from 'vitest';
import { parseMath, plainText } from '../src/math/mathtext';

describe('mathtext parser', () => {
  it('plain text and symbols', () => {
    expect(plainText('A B C')).toBe('ABC');
    expect(plainText('\\alpha+\\beta')).toBe('α+β');
    expect(plainText('\\pi')).toBe('π');
    expect(plainText("A'")).toBe('A′');
    expect(plainText('90^\\circ')).toBe('90^°');
    expect(plainText('\\sin\\alpha=\\frac{1}{2}')).toBe('sin\u2009α=1/2');
  });
  it('fractions, roots, scripts', () => {
    expect(plainText('\\frac{\\sqrt{3}}{2}')).toBe('(√3)/2');
    expect(plainText('x^2')).toBe('x^2');
    expect(plainText('a_n^{2k}')).toBe('a_n^(2k)');
    const n = parseMath('x^2_1');
    expect(n.k).toBe('row');
    if (n.k === 'row') {
      const s = n.c[0];
      expect(s.k).toBe('script');
      if (s.k === 'script') expect(s.sup && s.sub).toBeTruthy();
    }
  });
  it('vectors, overlines and groups', () => {
    expect(plainText('\\vec{AB}')).toBe('AB');
    expect(plainText('\\overline{x}+\\widehat{ABC}')).toBe('x+ABC');
    expect(plainText('{ab}^2')).toBe('ab^2');
  });
  it('never throws on malformed input', () => {
    for (const s of ['\\frac{1', '{', '}', '^', '_2', '\\', '\\unknown', 'x^', '\\sqrt', '\\text{abc', '\\frac{a}']) {
      expect(() => plainText(s), s).not.toThrow();
    }
  });
});
