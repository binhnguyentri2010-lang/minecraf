import { describe, expect, it } from 'vitest';
import { compile, tryCompile } from '../src/math/expr';

const f = (s: string, x = 0) => compile(s)(x);

describe('expression parser', () => {
  it('arithmetic and precedence', () => {
    expect(f('1+2*3')).toBe(7);
    expect(f('(1+2)*3')).toBe(9);
    expect(f('10-4-3')).toBe(3);
    expect(f('2^3^2')).toBe(512); // right associative
    expect(f('-2^2')).toBe(-4);
    expect(f('8/4/2')).toBe(1);
  });
  it('variable, constants and functions', () => {
    expect(f('x^2 - 3x + 2', 3)).toBe(2);
    expect(f('sin(pi/2)')).toBeCloseTo(1);
    expect(f('cos(π)')).toBeCloseTo(-1);
    expect(f('sqrt(x)', 9)).toBe(3);
    expect(f('√x', 16)).toBe(4);
    expect(f('ln(e)')).toBeCloseTo(1);
    expect(f('log(1000)')).toBeCloseTo(3);
    expect(f('abs(x)', -5)).toBe(5);
    expect(f('cot(x)', Math.PI / 4)).toBeCloseTo(1);
    expect(f('2^x', 10)).toBe(1024);
    expect(f('log2(8)')).toBeCloseTo(3);
    expect(f('xsin(x)', Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });
  it('implicit multiplication and prefixes', () => {
    expect(f('2x', 4)).toBe(8);
    expect(f('2(x+1)', 2)).toBe(6);
    expect(f('x(x+1)', 3)).toBe(12);
    expect(f('y = 3x + 1', 2)).toBe(7);
    expect(f('f(x) = x^2', 3)).toBe(9);
    expect(f('x²', 5)).toBe(25);
    expect(f('sin x', Math.PI / 2)).toBeCloseTo(1);
    expect(f('x^-2', 2)).toBe(0.25);
  });
  it('domain errors give NaN, not exceptions', () => {
    expect(Number.isNaN(f('sqrt(x)', -1))).toBe(true);
    expect(Number.isNaN(f('ln(x)', -1))).toBe(true);
    expect(f('1/x', 0)).toBe(Infinity);
    expect(f('x^(1/3)', -8)).toBeCloseTo(-2);
  });
  it('rejects invalid and unsafe input', () => {
    for (const bad of ['', '1+', '(1+2', '1+2)', 'foo(x)', 'x y z q', '2**', 'alert(1)', 'constructor', '1;2', 'x=', '`1`']) {
      expect('error' in tryCompile(bad), bad).toBe(true);
    }
    expect('fn' in tryCompile('sin(x)/x')).toBe(true);
  });
});
