// Palm rejection, hold-to-straighten and stroke smoothing.
import { launch, makeIO, reporter } from './helpers.mjs';

const { browser, page, cdp, errors } = await launch({ width: 1180, height: 820 }, { initScript: 'try{if(localStorage.getItem("bt-pencilOnly")===null)localStorage.setItem("bt-pencilOnly","true")}catch(e){}' });
const io = makeIO(page, cdp);
const { check, summary } = reporter();
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const clear = () => page.evaluate(() => window.__board.getState().load({ items: [], background: 'grid', viewport: { x: 0, y: 0, scale: 1 }, seq: 0 }));
const vp = async () => (await io.state()).viewport;
const move = async (fn) => { const a = await vp(); await fn(); const b = await vp(); return Math.hypot(b.x - a.x, b.y - a.y) + Math.abs(b.scale - a.scale) * 1000; };
const fingerDrag = async (from, dx, dy, id0 = 0) => {
  await io.touch('touchStart', [from]);
  for (let i = 1; i <= 6; i++) await io.touch('touchMove', [[from[0] + (dx * i) / 6, from[1] + (dy * i) / 6]]);
  await io.touch('touchEnd', []);
};

check('touch-first defaults are remembered: Pencil-only starts on', (await io.state()).pencilOnly === true);

// 1. baseline: a finger pans when the pen has not been used
check('finger pans the board when the pen is idle', (await move(() => fingerDrag([500, 500], 60, 30))) > 50);
await page.waitForTimeout(700);

// 2. palm lands while the pen is writing
await io.penDown(300, 300, 0.5);
for (let i = 1; i <= 6; i++) await io.penMove(300 + i * 20, 300 + i * 5);
let dv = await move(async () => {
  await io.touch('touchStart', [[700, 600], [760, 610]]); // palm contacts next to the writing hand
  for (let i = 1; i <= 8; i++) await io.touch('touchMove', [[700 + i * 15, 600 + i * 6], [760 + i * 15, 610 + i * 6]]);
  await io.touch('touchEnd', []);
});
await io.penUp(420, 330);
let s = await io.state();
check('a palm touching while the pen writes does not pan or zoom the board', dv < 0.5, `moved ${dv.toFixed(2)}`);
check('… nor draw, nor trigger undo (only the one pen stroke exists)', s.items.length === 1 && s.undo === 1);

// 3. palm already resting before the pen arrives
await clear();
await io.touch('touchStart', [[800, 650]]); // resting palm, accepted as a (harmless) pan contact
await page.waitForTimeout(80);
await io.penDown(300, 300, 0.5);
dv = await move(async () => {
  for (let i = 1; i <= 10; i++) {
    await io.penMove(300 + i * 12, 300);
    await io.touch('touchMove', [[800 + i * 10, 650 + i * 4]]); // the palm slides while writing
  }
});
await io.penUp(420, 300);
await io.touch('touchEnd', []);
s = await io.state();
check('a palm already resting when the pen lands is dropped (no pan while writing)', dv < 0.5 && s.items.length === 1, `moved ${dv.toFixed(2)}`);

// 4. touch right after the pen lifts is ignored, later touch works
await page.waitForTimeout(700);
await io.penDown(300, 400); await io.penMove(340, 400); await io.penUp(340, 400);
let d1 = await move(() => fingerDrag([600, 500], 80, 0));
check('a contact within 0.5 s after the pen lifts is ignored', d1 < 0.5, `moved ${d1.toFixed(2)}`);
await page.waitForTimeout(700);
d1 = await move(() => fingerDrag([600, 500], 80, 0));
check('… a deliberate finger afterwards pans again', d1 > 60, `moved ${d1.toFixed(1)}`);

// 5. hovering pen (iPad Pro) protects too
await io.penMove(500, 500); // hover: buttons = 0
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 520, y: 520, buttons: 0, pointerType: 'pen' });
d1 = await move(() => fingerDrag([600, 500], 80, 0));
check('a hovering Pencil also blocks stray touches', d1 < 0.5, `moved ${d1.toFixed(2)}`);
await page.waitForTimeout(700);

// 6. two/three-finger tap gestures only when deliberate
await clear();
await io.tool('pen');
await io.drag(io.line([300, 300], [400, 300], 8));
await io.drag(io.line([300, 360], [400, 360], 8));
await page.waitForTimeout(700);
let u = (await io.state()).undo;
await io.touch('touchStart', [[300, 600], [325, 600]]); await io.touch('touchEnd', []); // 25 px apart: looks like a palm
check('two contacts closer than 40 px (a palm) do not undo', (await io.state()).undo === u);
await io.touch('touchStart', [[300, 600], [420, 600]]); await io.touch('touchEnd', []);
check('two deliberate fingers still undo', (await io.state()).undo === u - 1);
await io.touch('touchStart', [[300, 600], [420, 600], [540, 600]]); await io.touch('touchEnd', []);
check('three fingers redo', (await io.state()).undo === u);
await io.penDown(300, 450); await io.penUp(300, 450);
await io.touch('touchStart', [[300, 600], [420, 600]]); await io.touch('touchEnd', []);
check('a two-finger tap right after the pen does not undo', (await io.state()).undo === u + 1);

// 7. hold to straighten
await clear();
await page.waitForTimeout(700);
await io.tool('pen');
const curve = Array.from({ length: 30 }, (_, i) => [300 + i * 14, 400 + Math.sin(i / 3) * 50]);
await io.drag(curve, 700);
let it = (await io.state()).items[0];
check('holding at the end of a curvy stroke turns it into a straight line from where it began', it.pts.length === 2 && near(it.pts[0].x, curve[0][0]) && near(it.pts[0].y, curve[0][1]) && near(it.pts[1].x, curve.at(-1)[0], 0.5), JSON.stringify(it.pts.map((p) => [Math.round(p.x), Math.round(p.y)])));
await clear();
await io.drag([[300, 500], [400, 480], [500, 520], [600, 503]], 700);
it = (await io.state()).items[0];
check('a line within 3° of horizontal snaps exactly horizontal', it.pts.length === 2 && near(it.pts[0].y, it.pts[1].y, 1e-6), JSON.stringify(it.pts.map((p) => [Math.round(p.x), Math.round(p.y)])));
await clear();
await io.penDown(300, 300);
for (let i = 1; i <= 15; i++) await io.penMove(300 + i * 12, 300 + Math.sin(i / 2) * 30);
await page.waitForTimeout(700);
for (let i = 1; i <= 8; i++) await io.penMove(480 + i * 10, 300 + i * 20); // keep moving after the line appeared
await io.penUp(560, 460);
it = (await io.state()).items[0];
check('after straightening, the line keeps following the pen until it lifts', it.pts.length === 2 && near(it.pts[1].x, 560, 0.5) && near(it.pts[1].y, 460, 0.5), JSON.stringify(it.pts.map((p) => [Math.round(p.x), Math.round(p.y)])));
await clear();
await io.drag([[300, 300], [305, 306], [310, 300], [306, 296]], 700);
it = (await io.state()).items[0];
check('a tiny squiggle held in place is left alone', it.pts.length >= 3);
await page.getByTestId('snap').click();
await io.drag(curve, 700);
it = (await io.state()).items[1];
check('with "Nắn nét" off, holding does nothing', it.pts.length > 10);
await page.getByTestId('snap').click();

// 8. smoothing
await clear();
const jitter = Array.from({ length: 50 }, (_, i) => [200 + i * 12, 400 + (((i * 7919) % 17) - 8) * 1.5]);
const rough = (pts) => pts.slice(2).reduce((sum, p, i) => sum + (p.y - 2 * pts[i + 1].y + pts[i].y) ** 2, 0);
const label = () => page.getByTestId('smooth').innerText();
check('smoothing defaults to "vừa"', (await label()).includes('vừa'));
await page.getByTestId('smooth').click();
check('tap cycles to "mạnh"', (await label()).includes('mạnh') && (await io.state()).items.length === 0);
await io.drag(jitter);
await page.getByTestId('smooth').click();
check('… then "tắt"', (await label()).includes('tắt'));
await io.drag(jitter.map(([x, y]) => [x, y + 100]));
s = await io.state();
const [strong, off] = s.items;
check('strokes remember the setting they were drawn with', strong.smooth === 1 && off.smooth === 0);
check('"mạnh" gives a visibly smoother stroke than "tắt" for the same hand jitter', rough(strong.pts) < rough(off.pts) * 0.5, `${rough(strong.pts).toFixed(0)} vs ${rough(off.pts).toFixed(0)}`);
check('endpoints are where the pen started and ended', near(strong.pts[0].x, jitter[0][0], 0.6) && near(strong.pts.at(-1).x, jitter.at(-1)[0], 0.6));
await page.getByTestId('smooth').click();
await page.reload();
await page.waitForFunction(() => window.__app);
check('the smoothing choice survives a reload', (await page.getByTestId('smooth').innerText()).includes('vừa'));

// 9. Pencil-only preference is remembered
await page.getByTestId('pencil-only').click();
await page.reload();
await page.waitForFunction(() => window.__app);
check('turning Pencil-only off is remembered after reload', (await io.state()).pencilOnly === false);
check('no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();

// 10. first-time hint for finger users in Pencil-only mode
const fresh = await launch({ width: 1180, height: 820 }, { initScript: 'try{if(localStorage.getItem("bt-pencilOnly")===null)localStorage.setItem("bt-pencilOnly","true")}catch(e){}' });
const io2 = makeIO(fresh.page, fresh.cdp);
await io2.touch('touchStart', [[500, 500]]);
await io2.touch('touchMove', [[520, 510]]);
await io2.touch('touchEnd', []);
check('a finger in Pencil-only mode explains why it does not draw (one-time hint)', (await fresh.page.getByRole('status').innerText().catch(() => '')).includes('Chỉ Pencil'));
check('the hint never blocks touches beneath it (click-through)', (await fresh.page.evaluate(() => getComputedStyle(document.querySelector('.toast')).pointerEvents)) === 'none');
await fresh.browser.close();
process.exit(summary() ? 0 : 1);
