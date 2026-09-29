import { chromium } from 'playwright-core';

const URL = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL);
await page.waitForFunction(() => window.__board);
const cdp = await ctx.newCDPSession(page);
const S = () => page.evaluate(() => {
  const s = window.__board.getState();
  return { n: s.strokes.length, pencilOnly: s.pencilOnly, vp: s.viewport, undo: s.undoStack.length, redo: s.redoStack.length,
           pts: s.strokes[0]?.pts.length ?? 0, pressures: [...new Set((s.strokes[0]?.pts ?? []).map((p) => p.p.toFixed(2)))] };
});
const mouse = (type, x, y, extra = {}) =>
  cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, pointerType: 'pen', ...extra });
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`); };

// 1. pen stroke with varying pressure
await mouse('mousePressed', 200, 300, { clickCount: 1, force: 0.2 });
for (let i = 1; i <= 30; i++) await mouse('mouseMoved', 200 + i * 12, 300 + Math.sin(i / 4) * 60, { force: 0.2 + i / 40 });
await mouse('mouseReleased', 560, 300, { clickCount: 1 });
let s = await S();
check('pen stroke committed', s.n === 1 && s.pts > 20, JSON.stringify({ n: s.n, pts: s.pts }));
check('pressure captured (varies)', s.pressures.length > 3, s.pressures.join(','));
check('auto Pencil-only after first pen use', s.pencilOnly === true);

// 2. undo / redo
await page.keyboard.press('Control+z'); s = await S(); check('undo removes stroke', s.n === 0 && s.redo === 1);
await page.keyboard.press('Control+Shift+z'); s = await S(); check('redo restores stroke', s.n === 1 && s.undo === 1);

// 3. eraser
await page.getByRole('button', { name: 'Tẩy' }).click();
await mouse('mousePressed', 260, 300, { clickCount: 1 });
for (let i = 0; i < 20; i++) await mouse('mouseMoved', 260 + i * 12, 300 + Math.sin((i + 5) / 4) * 60);
await mouse('mouseReleased', 500, 300, { clickCount: 1 });
s = await S(); check('eraser removes stroke', s.n === 0);
await page.keyboard.press('Control+z'); s = await S(); check('undo erase restores stroke', s.n === 1);

// 4. touch = pan/zoom only (palm rejection)
await page.getByRole('button', { name: 'Bút', exact: true }).click();
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const before = (await S()).vp;
await touch('touchStart', [[400, 500]]);
for (let i = 1; i <= 6; i++) await touch('touchMove', [[400 + i * 10, 500 + i * 5]]);
await touch('touchEnd', []);
s = await S();
check('1-finger touch pans, does not draw', s.n === 1 && Math.abs(s.vp.x - before.x - 60) < 2 && Math.abs(s.vp.y - before.y - 30) < 2, JSON.stringify(s.vp));
const z0 = (await S()).vp.scale;
await touch('touchStart', [[500, 400], [600, 400]]);
for (let i = 1; i <= 6; i++) await touch('touchMove', [[500 - i * 10, 400], [600 + i * 10, 400]]);
await touch('touchEnd', []);
s = await S(); check('2-finger pinch zooms in', s.vp.scale > z0 * 1.5 && s.n === 1, `scale ${z0} -> ${s.vp.scale.toFixed(2)}`);

// 5. persistence
await page.waitForTimeout(700);
await page.reload(); await page.waitForFunction(() => window.__board);
await page.waitForFunction(() => window.__board.getState().strokes.length > 0, null, { timeout: 3000 }).catch(() => {});
s = await S(); check('state restored after reload', s.n === 1 && s.vp.scale > 1.5);

// 6. rendering actually painted ink
await page.getByRole('button', { name: /%$/ }).click();
await page.waitForTimeout(200);
const inked = await page.evaluate(() => {
  const c = document.querySelectorAll('canvas')[1]; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n;
});
check('ink layer has painted pixels', inked > 500, `${inked}px`);
await page.screenshot({ path: process.env.SHOT ?? 'e2e-shot.png' });
check('no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
