import fs from 'node:fs';
import { chromium } from 'playwright-core';

export const URL = process.env.URL ?? 'http://localhost:5173/';
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const r of roots) {
    try {
      for (const d of fs.readdirSync(r).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
        const p = `${r}/${d}/chrome-linux/chrome`;
        if (fs.existsSync(p)) return p;
      }
    } catch { /* ignore */ }
  }
  return undefined; // fall back to playwright's own download location
}
export const CHROME = findChrome();

export async function launch(viewport = { width: 1180, height: 820 }, opts = {}) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const { prod, initScript, ...ctxOpts } = opts;
  const ctx = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true, ...ctxOpts });
  if (initScript) await ctx.addInitScript(initScript);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  if (!prod) await page.waitForFunction(() => window.__app);
  await page.waitForSelector('.board canvas');
  const cdp = await ctx.newCDPSession(page);
  return { browser, ctx, page, cdp, errors };
}

export function makeIO(page, cdp) {
  const state = () => page.evaluate(() => {
    const s = window.__board.getState();
    return { items: s.items, selection: s.selection, viewport: s.viewport, tool: s.tool, undo: s.undoStack.length, redo: s.redoStack.length, boards: s.boards, boardId: s.boardId, ruler: s.ruler, protractor: s.protractor, pencilOnly: s.pencilOnly };
  });
  const mouse = (type, x, y, extra = {}) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, pointerType: 'pen', ...extra });
  const penDown = (x, y, force = 0.5) => mouse('mousePressed', x, y, { clickCount: 1, force });
  const penMove = (x, y, force = 0.5) => mouse('mouseMoved', x, y, { force });
  const penUp = (x, y) => mouse('mouseReleased', x, y, { clickCount: 1 });
  const drag = async (pts, holdMs = 0) => {
    await penDown(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) await penMove(x, y);
    if (holdMs) await page.waitForTimeout(holdMs);
    const last = pts[pts.length - 1];
    await penUp(last[0], last[1]);
  };
  const line = (a, b, n = 12) => Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const tool = (name) => page.getByTestId(`tool-${name}`).click();
  const w2s = (vp, x, y) => [vp.x + x * vp.scale, vp.y + y * vp.scale];
  return { state, mouse, penDown, penMove, penUp, drag, line, touch, tool, w2s };
}

export function reporter() {
  const results = [];
  const check = (name, ok, info = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  };
  const summary = () => {
    const bad = results.filter((r) => !r.ok);
    console.log(`\n${results.length - bad.length}/${results.length} passed`);
    return bad.length === 0;
  };
  return { check, summary };
}
