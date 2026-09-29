// Core pen / palm-rejection / persistence behaviour (regression of Phase 1).
import { launch, makeIO, reporter } from './helpers.mjs';

const SHOTS = process.env.SHOTS ?? '/tmp';
const { browser, ctx, page, cdp, errors } = await launch({ width: 1180, height: 820 });
const io = makeIO(page, cdp);
const { check, summary } = reporter();

// 1. pen stroke with varying pressure
await io.penDown(200, 300, 0.2);
for (let i = 1; i <= 30; i++) await io.penMove(200 + i * 12, 300 + Math.sin(i / 4) * 60, 0.2 + i / 40);
await io.penUp(560, 300);
let s = await io.state();
const st = s.items[0];
check('pen stroke committed with coalesced points', s.items.length === 1 && st.pts.length >= 30, `pts=${st.pts.length}`);
check('pressure captured and varies along the stroke', new Set(st.pts.map((p) => p.p.toFixed(2))).size > 10 && st.pen === true);
check('Pencil-only turns on automatically after first pen use (palm rejection)', s.pencilOnly === true);

// 2. undo / redo (keyboard)
await page.keyboard.press('Control+z');
s = await io.state();
check('Ctrl+Z undoes', s.items.length === 0 && s.redo === 1);
await page.keyboard.press('Control+Shift+z');
s = await io.state();
check('Ctrl+Shift+Z redoes', s.items.length === 1 && s.undo === 1);

// 3. highlighter and colour
await page.getByRole('button', { name: 'Màu #d1242f' }).click();
await io.tool('highlighter');
await io.drag(io.line([200, 500], [600, 500], 20));
const hl = (await io.state()).items[1];
check('highlighter stroke is wide and coloured', hl.kind === 'highlighter' && hl.size >= 14 && hl.color === '#d1242f');

// 4. touch navigates, never draws (a deliberate finger comes >0.5 s after the pen: otherwise it is treated as a palm)
await io.tool('pen');
await page.waitForTimeout(650);
const before = (await io.state()).viewport;
await io.touch('touchStart', [[400, 650]]);
for (let i = 1; i <= 6; i++) await io.touch('touchMove', [[400 + i * 10, 650 + i * 5]]);
await io.touch('touchEnd', []);
s = await io.state();
check('1-finger touch pans and does not draw', s.items.length === 2 && near(s.viewport.x - before.x, 60) && near(s.viewport.y - before.y, 30));
const z0 = s.viewport.scale;
await io.touch('touchStart', [[500, 400], [600, 400]]);
for (let i = 1; i <= 6; i++) await io.touch('touchMove', [[500 - i * 10, 400], [600 + i * 10, 400]]);
await io.touch('touchEnd', []);
s = await io.state();
check('2-finger pinch zooms about the fingers', s.viewport.scale > z0 * 1.5 && s.items.length === 2, `scale ${z0} → ${s.viewport.scale.toFixed(2)}`);
function near(a, b, t = 2) { return Math.abs(a - b) <= t; }

// 5. mouse wheel: ctrl+wheel zooms, wheel pans
const v1 = (await io.state()).viewport;
await page.mouse.move(600, 400);
await page.mouse.wheel(0, 100);
s = await io.state();
check('wheel scrolls the board', s.viewport.y < v1.y);

// 6. "Chỉ Pencil" off lets a finger draw
await page.getByTestId('open-more').click();
await page.getByTestId('pencil-only').click();
await page.getByTestId('zoom').click();
await io.touch('touchStart', [[300, 700]]);
for (let i = 1; i <= 8; i++) await io.touch('touchMove', [[300 + i * 20, 700 + i * 3]]);
await io.touch('touchEnd', []);
s = await io.state();
check('with Pencil-only off, a finger draws', s.items.length === 3 && s.items[2].pen === false, JSON.stringify({ n: s.items.length, po: s.pencilOnly, last: s.items.at(-1)?.pen, tool: s.tool }));

// 7. persistence (viewport + strokes)
await page.mouse.move(600, 400);
await page.mouse.wheel(0, 137);
const vpBefore = (await io.state()).viewport;
await page.waitForTimeout(1100);
await page.reload();
await page.waitForFunction(() => window.__app && window.__board.getState().items.length === 3, null, { timeout: 5000 }).catch(() => {});
s = await io.state();
check('strokes restored after reload', s.items.length === 3);
check('view position restored after reload (saved separately from the strokes)', near(s.viewport.y, vpBefore.y, 0.01) && near(s.viewport.x, vpBefore.x, 0.01) && near(s.viewport.scale, vpBefore.scale, 0.0001), JSON.stringify([vpBefore, s.viewport]));

// 8. ink layer actually painted (pixel check)
const countInk = () => {
  const c = document.querySelectorAll('canvas')[1];
  if (!c) return 0;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
};
await page.waitForFunction((f) => new Function(`return (${f})()`)() > 1000, countInk.toString(), { timeout: 5000 }).catch(() => {});
const inked = await page.evaluate(countInk);
check('ink layer has painted pixels', inked > 1000, `${inked}px`);
await page.screenshot({ path: `${SHOTS}/core.png` });
check('no console/page errors', errors.length === 0, errors.join(' | '));
await ctx.close();
await browser.close();

// 9. plain-http situations must never blank the page
{
  const insecure = await launch({ width: 1180, height: 820 }, { initScript: 'Object.defineProperty(Crypto.prototype, "randomUUID", { value: undefined, configurable: true });' });
  const io2 = makeIO(insecure.page, insecure.cdp);
  check('without crypto.randomUUID (http on iPad) crypto.randomUUID really is missing', (await insecure.page.evaluate(() => typeof crypto.randomUUID)) === 'undefined');
  await io2.drag(io2.line([300, 300], [500, 340], 10));
  await insecure.page.getByTestId('open-library').click();
  await insecure.page.getByTestId('shape-tri-scalene').click();
  await insecure.page.getByTestId('open-boards').click();
  await insecure.page.getByTestId('new-board').click();
  await insecure.page.waitForFunction(() => window.__board.getState().boards.length === 2);
  const t = await io2.state();
  check('app fully works without crypto.randomUUID', t.items.length === 0 && t.boards.length === 2 && new Set(t.boards.map((b) => b.id)).size === 2, insecure.errors.join('|'));
  check('… and reports no errors', insecure.errors.length === 0, insecure.errors.join('|'));
  await insecure.browser.close();

  const blocked = await launch({ width: 1180, height: 820 }, { initScript: 'indexedDB.open = function () { throw new Error("storage blocked"); };' });
  const io3 = makeIO(blocked.page, blocked.cdp);
  await io3.drag(io3.line([300, 300], [500, 340], 10));
  const u = await io3.state();
  check('with storage unavailable the app still renders and draws (no blank page)', u.items.length === 1 && u.boards.length === 1);
  await blocked.browser.close();
}
process.exit(summary() ? 0 : 1);
