import { launch, makeIO, reporter } from './helpers.mjs';

const SHOTS = process.env.SHOTS ?? '/tmp';
const { browser, page, cdp, errors } = await launch({ width: 1180, height: 820 });
const io = makeIO(page, cdp);
const { check, summary } = reporter();
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
const cx = (it) => it.pts.reduce((a, p) => a + p.x, 0) / it.pts.length;

await io.tool('pen');
await io.drag(io.line([250, 300], [330, 330], 10)); // A
await io.drag(io.line([400, 420], [470, 380], 10)); // B
await io.drag(io.line([800, 300], [900, 350], 10)); // C (far away)
let s = await io.state();
check('three strokes drawn', s.items.length === 3);

// ---- lasso around A and B
await io.tool('lasso');
const loop = (x, y, rx, ry, n = 24) => Array.from({ length: n + 1 }, (_, i) => [x + rx * Math.cos((i / n) * 2 * Math.PI), y + ry * Math.sin((i / n) * 2 * Math.PI)]);
await io.drag(loop(360, 360, 170, 110));
s = await io.state();
const [A, B, C] = s.items;
check('lasso selects exactly the strokes inside the loop', s.selection.length === 2 && s.selection.includes(A.id) && s.selection.includes(B.id) && !s.selection.includes(C.id), JSON.stringify(s.selection));
check('floating menu appears with Cut / Copy / Duplicate / Delete', (await page.getByTestId('selmenu').isVisible()) && (await page.getByTestId('cut').count()) === 1 && (await page.getByTestId('copy').count()) === 1 && (await page.getByTestId('menu-duplicate').count()) === 1 && (await page.getByTestId('menu-delete').count()) === 1);
const m = await page.getByTestId('selmenu').boundingBox();
check('menu sits above the selection, inside the screen', m.y >= 60 && m.y + m.height < 820 && m.x >= 0 && m.x + m.width <= 1180, JSON.stringify(m));
await page.screenshot({ path: `${SHOTS}/lasso-selected.png` });

// ---- move the selection by dragging it
const ax0 = cx(A), bx0 = cx(B), cx0 = cx(C);
await io.penDown(290, 315);
for (let i = 1; i <= 8; i++) await io.penMove(290 + i * 12, 315 + i * 6);
check('menu hides while dragging the selection', (await page.getByTestId('selmenu').count()) === 0);
await io.penUp(386, 363);
s = await io.state();
const [A2, B2, C2] = s.items;
check('dragging inside the selection moves every selected stroke together', near(cx(A2) - ax0, 96) && near(cx(B2) - bx0, 96) && near(cx(C2), cx0, 0.001), `${(cx(A2) - ax0).toFixed(1)}, ${(cx(B2) - bx0).toFixed(1)}`);
check('menu comes back after the drag', await page.getByTestId('selmenu').isVisible());
await page.getByTestId('undo').click();
s = await io.state();
check('one undo puts the whole selection back', near(cx(s.items[0]), ax0, 0.001) && near(cx(s.items[1]), bx0, 0.001));
await page.getByTestId('redo').click();

// ---- copy / paste through the menu
await page.getByTestId('copy').click();
await page.getByTestId('paste').click();
s = await io.state();
check('Copy then Paste adds offset copies and selects them', s.items.length === 5 && s.selection.length === 2 && !s.selection.includes(A.id));
await page.keyboard.press('Control+x');
s = await io.state();
check('Ctrl+X cuts the selection', s.items.length === 3 && s.selection.length === 0);
check('paste chip is offered when nothing is selected', await page.getByTestId('paste-chip').isVisible());
await page.getByTestId('paste-chip').getByTestId('paste').click();
s = await io.state();
check('paste chip pastes', s.items.length === 5);
await page.keyboard.press('Control+v');
s = await io.state();
check('Ctrl+V pastes again with a further offset', s.items.length === 7);
await page.getByTestId('menu-delete').click();
s = await io.state();
check('Delete in the menu removes the selection', s.items.length === 5 && s.selection.length === 0);

// ---- empty loop / tap deselects
await io.drag(loop(600, 650, 40, 30));
s = await io.state();
check('a loop around nothing selects nothing', s.selection.length === 0);
await io.drag(loop(360, 360, 200, 130));
await io.penDown(1000, 700);
await io.penUp(1000, 700);
s = await io.state();
check('tapping empty space clears the selection', s.selection.length === 0);

// ---- multi-finger taps (GoodNotes): 2 fingers = undo, 3 fingers = redo
await io.tool('pen');
const u0 = (await io.state()).undo;
await io.touch('touchStart', [[300, 600], [400, 600]]);
await io.touch('touchEnd', []);
s = await io.state();
check('two-finger tap undoes', s.undo === u0 - 1 && s.redo >= 1, `undo ${u0}→${s.undo}`);
await io.touch('touchStart', [[300, 600], [400, 600], [500, 600]]);
await io.touch('touchEnd', []);
s = await io.state();
check('three-finger tap redoes', s.undo === u0, `undo=${s.undo}`);
const before = (await io.state()).viewport;
await io.touch('touchStart', [[500, 500], [600, 500]]);
for (let i = 1; i <= 6; i++) await io.touch('touchMove', [[500 - i * 10, 500], [600 + i * 10, 500]]);
await io.touch('touchEnd', []);
s = await io.state();
check('a pinch is not mistaken for a tap', s.undo === u0 && s.viewport.scale > before.scale * 1.5);

// ---- lasso on a shape object
await page.evaluate(() => window.__app.insertShape(window.__app.SHAPES.find((x) => x.id === 'cube')));
await io.tool('lasso');
const box = await page.evaluate(() => { const st = window.__board.getState(); const b = window.__app.itemBounds(st.items[st.items.length - 1]); const v = st.viewport; return [v.x + b.minX * v.scale, v.y + b.minY * v.scale, v.x + b.maxX * v.scale, v.y + b.maxY * v.scale]; });
await page.evaluate(() => window.__board.getState().select([]));
await io.drag(loop((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, (box[2] - box[0]) * 0.75, (box[3] - box[1]) * 0.75));
s = await io.state();
await io.tool('lasso');
await page.evaluate(() => window.__board.getState().select([]));
const sp = await page.evaluate(() => { const st = window.__board.getState(); const it = st.items.find((i) => i.type === 'stroke'); const v = st.viewport; return [v.x + it.pts[0].x * v.scale, v.y + it.pts[0].y * v.scale, it.id]; });
await io.penDown(sp[0], sp[1]); await io.penUp(sp[0], sp[1]);
s = await io.state();
check('tapping a stroke with the lasso selects just that stroke', s.selection.length === 1 && s.selection[0] === sp[2]);
await page.evaluate(() => window.__board.getState().select([]));
await io.drag(loop((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, (box[2] - box[0]) * 0.75, (box[3] - box[1]) * 0.75));
s = await io.state();
check('lasso also selects figures from the library', s.selection.includes(s.items.find((i) => i.type === 'obj' && i.gen?.id === 'cube').id));
check('no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(summary() ? 0 : 1);
