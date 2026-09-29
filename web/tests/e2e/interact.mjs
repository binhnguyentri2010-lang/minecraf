import fs from 'node:fs';
import { launch, makeIO, reporter } from './helpers.mjs';

const SHOTS = process.env.SHOTS ?? '/tmp';
const { browser, page, cdp, errors } = await launch();
const io = makeIO(page, cdp);
const { check, summary } = reporter();
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
const inkNow = (t) => { const c = document.querySelector(`[data-testid="${t}"]`); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++; return n; };
// previews repaint on the next frame: wait until the ink count satisfies the condition (or time out and report the last value)
const ink = async (id, ok = () => true) => {
  const src = inkNow.toString();
  const okSrc = ok.toString();
  await page.waitForFunction(([id2, a, b]) => new Function(`return (${b})((${a})(${JSON.stringify(id2)}))`)(), [id, src, okSrc], { timeout: 2500 }).catch(() => {});
  return page.evaluate(([id2, a]) => new Function(`return (${a})(${JSON.stringify(id2)})`)(), [id, src]);
};
const clearBoard = () => page.evaluate(() => window.__board.getState().load({ items: [], background: 'grid', viewport: { x: 0, y: 0, scale: 1 }, seq: 0 }));
const lastItem = async () => { const s = await io.state(); return s.items[s.items.length - 1]; };

// ------------------------------------------------------------ A. library + inspector params
await page.getByTestId('open-library').click();
await page.getByTestId('library-search').fill('hinh chop');
check('library search ignores diacritics', (await page.getByTestId('shape-pyr4-square').count()) === 1 && (await page.getByTestId('shape-cube').count()) === 0);
await page.getByTestId('shape-pyr4-square').click();
let s = await io.state();
check('tapping a card inserts + selects the shape and switches to Select', s.items.length === 1 && s.items[0].gen.id === 'pyr4-square' && s.selection[0] === s.items[0].id && s.tool === 'select');
await page.getByTestId('open-library').click(); // close
check('inspector is shown for the selection', await page.getByTestId('inspector').isVisible());
const before = JSON.stringify(s.items[0].prims);
await page.getByTestId('param-az').fill('30');
s = await io.state();
check('slider regenerates the figure (az=30)', s.items[0].gen.params.az === 30 && JSON.stringify(s.items[0].prims) !== before);
await page.getByTestId('param-diag').check();
s = await io.state();
check('toggle adds diagonals + SO', s.items[0].gen.params.diag === 1 && s.items[0].prims.length > JSON.parse(before).length);
await page.getByTestId('undo').click();
s = await io.state();
check('undo reverts parameter edit but keeps the shape', s.items.length === 1 && s.items[0].gen.params.diag === 0);
await page.getByTestId('redo').click();

// ------------------------------------------------------------ B. move / rotate / scale
await clearBoard();
await page.evaluate(() => window.__app.insertShape(window.__app.SHAPES.find((x) => x.id === 'tri-scalene')));
s = await io.state();
let o = s.items[0];
const startX = o.x, startY = o.y;
const pt = await page.evaluate(() => {
  const st = window.__board.getState();
  const it = st.items[0];
  const l = it.prims.find((p) => p.t === 'line' || p.t === 'poly');
  const a = l.t === 'line' ? l.a : l.pts[0], b = l.t === 'line' ? l.b : l.pts[1];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const c = Math.cos(it.rot) * it.scale, sn = Math.sin(it.rot) * it.scale;
  const w = [it.x + c * m[0] - sn * m[1], it.y + sn * m[0] + c * m[1]];
  return [st.viewport.x + w[0] * st.viewport.scale, st.viewport.y + w[1] * st.viewport.scale];
});
await io.drag(io.line(pt, [pt[0] + 90, pt[1] + 60], 10));
s = await io.state();
o = s.items[0];
check('pen drag moves the object by the drag vector', near(o.x - startX, 90 / s.viewport.scale, 1.5) && near(o.y - startY, 60 / s.viewport.scale, 1.5), `dx=${(o.x - startX).toFixed(1)} dy=${(o.y - startY).toFixed(1)}`);
await page.getByTestId('undo').click();
s = await io.state();
check('undo of a move restores the position', near(s.items[0].x, startX, 0.01) && near(s.items[0].y, startY, 0.01));
await page.getByTestId('redo').click();

const geo = () => page.evaluate(() => {
  const st = window.__board.getState();
  const g = window.__app.selectionGeo(st.items.filter((i) => st.selection.includes(i.id)), st.viewport.scale);
  const vp = st.viewport;
  const S = (p) => [vp.x + p[0] * vp.scale, vp.y + p[1] * vp.scale];
  return { rotate: S(g.rotate), scale: S(g.scale), center: S(g.center) };
});
let g = await geo();
const R = Math.hypot(g.rotate[0] - g.center[0], g.rotate[1] - g.center[1]);
// rotate handle is above the box: move it to the right of the centre → +90° (clockwise)
const rotPath = [];
for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * (Math.PI / 2); rotPath.push([g.center[0] + R * Math.cos(a), g.center[1] + R * Math.sin(a)]); }
await io.drag(rotPath);
s = await io.state();
check('rotate handle rotates by ~90° (snaps to 15° steps)', near(s.items[0].rot, Math.PI / 2, 0.03), `rot=${s.items[0].rot.toFixed(3)}`);
g = await geo();
const sc0 = s.items[0].scale;
const d = [g.scale[0] - g.center[0], g.scale[1] - g.center[1]];
await io.drag(io.line(g.scale, [g.center[0] + 2 * d[0], g.center[1] + 2 * d[1]], 10));
s = await io.state();
check('scale handle doubles the size', near(s.items[0].scale / sc0, 2, 0.08), `k=${(s.items[0].scale / sc0).toFixed(3)}`);
await page.keyboard.press('Delete');
s = await io.state();
check('Delete key removes the selection', s.items.length === 0);
await page.keyboard.press('Control+z');
s = await io.state();
check('undo restores the deleted object', s.items.length === 1);

// ------------------------------------------------------------ C. strokes, marquee, click-select, eraser
await clearBoard();
await io.tool('pen');
await io.drag(io.line([260, 300], [420, 340], 14));
await io.drag(io.line([700, 480], [860, 430], 14));
s = await io.state();
check('two pen strokes drawn (pen tool)', s.items.length === 2 && s.items.every((i) => i.type === 'stroke'));
await io.tool('select');
await io.drag(io.line([200, 250], [920, 560], 8));
s = await io.state();
check('marquee selects everything it touches', s.selection.length === 2);
await page.keyboard.press('Escape');
await io.penDown(340, 320); await io.penUp(340, 320);
s = await io.state();
check('tap selects the single stroke under the pen', s.selection.length === 1 && s.selection[0] === s.items[0].id);
await page.evaluate(() => window.__board.getState().select([]));
await io.tool('eraser');
await io.drag(io.line([300, 200], [300, 420], 12));
s = await io.state();
check('eraser removes only what it touches; undo brings it back', s.items.length === 1);
await page.getByTestId('undo').click();
s = await io.state();
check('undo of erase', s.items.length === 2);

// ------------------------------------------------------------ D. drag tools (line / arrow / compass / rect / dash)
await clearBoard();
await io.tool('line');
await io.drag(io.line([300, 400], [600, 410], 10)); // ~1.9° → snaps to horizontal
let it = await lastItem();
check('line tool snaps near-horizontal to exactly horizontal', it.prims[0].t === 'line' && it.prims[0].b[1] === 0 && near(it.prims[0].b[0], 300, 1), JSON.stringify(it.prims[0].b));
await io.tool('circle');
await io.drag(io.line([700, 400], [760, 400], 6));
it = await lastItem();
check('compass tool makes a circle of the dragged radius', it.prims[0].t === 'ellipse' && near(it.prims[0].rx, 60, 0.5), `r=${it.prims[0].rx}`);
await io.tool('rect');
await io.drag(io.line([300, 500], [420, 580], 6));
it = await lastItem();
check('rectangle tool', it.prims[0].t === 'poly' && it.prims[0].closed && near(it.prims[0].pts[2][0], 120, 0.5) && near(it.prims[0].pts[2][1], 80, 0.5));
await page.getByTestId('dash').click();
await io.tool('arrow');
await io.drag(io.line([700, 550], [860, 520], 6));
it = await lastItem();
check('dash toggle + arrow tool → dashed arrow object', it.prims[0].t === 'arrow' && it.dash === true);
await page.getByTestId('dash').click();
await page.screenshot({ path: `${SHOTS}/e2e-drag-tools.png` });

// ------------------------------------------------------------ E. ruler snapping
await clearBoard();
await page.getByTestId('ruler').click();
s = await io.state();
check('ruler toggled on and placed in view', !!s.ruler && s.ruler.x > 0 && s.ruler.y > 0, JSON.stringify(s.ruler));
const ruler = s.ruler;
const topY = ruler.y; // rot = 0 → top edge y
const sx0 = ruler.x + 60;
await io.tool('pen');
await io.drag([[sx0, topY + 4], [sx0 + 40, topY + 30], [sx0 + 120, topY + 80], [sx0 + 200, topY + 55]]);
it = await lastItem();
check('pen starting at the ruler edge draws a perfectly straight line along it', it.type === 'stroke' && it.pts.length === 2 && near(it.pts[0].y, topY, 1e-6) && near(it.pts[1].y, topY, 1e-6) && near(it.pts[1].x, sx0 + 200, 0.5), JSON.stringify(it.pts.map((p) => [p.x, p.y])));
// rotate ruler via handle
const handle = [ruler.x + 480 + 6, ruler.y + 32];
const pivot = [ruler.x + 240, ruler.y + 32];
const rp = [];
for (let i = 0; i <= 10; i++) { const a = (i / 10) * (Math.PI / 6); const r = Math.hypot(handle[0] - pivot[0], handle[1] - pivot[1]); rp.push([pivot[0] + r * Math.cos(a), pivot[1] + r * Math.sin(a)]); }
await io.drag(rp);
s = await io.state();
check('ruler rotates about its centre via the handle', near(s.ruler.rot, Math.PI / 6, 0.03) && near(s.ruler.x + (240 * Math.cos(s.ruler.rot) - 32 * Math.sin(s.ruler.rot)), pivot[0], 0.5), `rot=${s.ruler.rot.toFixed(3)}`);
const rr = s.ruler;
const e0 = [rr.x, rr.y];
const dir = [Math.cos(rr.rot), Math.sin(rr.rot)];
const p0 = [e0[0] + dir[0] * 100 - Math.sin(rr.rot) * 3, e0[1] + dir[1] * 100 + Math.cos(rr.rot) * 3];
await io.drag(io.line(p0, [p0[0] + dir[0] * 150 + 5, p0[1] + dir[1] * 150 + 40], 8));
it = await lastItem();
const ang = Math.atan2(it.pts[1].y - it.pts[0].y, it.pts[1].x - it.pts[0].x);
check('line drawn along the rotated ruler follows its angle', it.pts.length === 2 && near(ang, rr.rot, 0.005), `ang=${ang.toFixed(4)} rot=${rr.rot.toFixed(4)}`);
// finger drags the ruler (does not pan the board); wait out the palm window after the last pen stroke
await page.waitForTimeout(650);
const vp0 = (await io.state()).viewport;
const body = [rr.x + dir[0] * 200 - Math.sin(rr.rot) * 32, rr.y + dir[1] * 200 + Math.cos(rr.rot) * 32];
await io.touch('touchStart', [body]);
for (let i = 1; i <= 6; i++) await io.touch('touchMove', [[body[0] + i * 10, body[1] + i * 5]]);
await io.touch('touchEnd', []);
s = await io.state();
check('finger drag on the ruler moves the ruler, not the view', near(s.ruler.x - rr.x, 60, 1) && near(s.ruler.y - rr.y, 30, 1) && s.viewport.x === vp0.x, `dx=${(s.ruler.x - rr.x).toFixed(1)}`);
await page.getByTestId('protractor').click();
s = await io.state();
check('protractor toggled on', !!s.protractor);
await page.screenshot({ path: `${SHOTS}/e2e-aids.png` });
await page.getByTestId('ruler').click();
await page.getByTestId('protractor').click();

// ------------------------------------------------------------ F. hold-to-snap shapes
await clearBoard();
await io.tool('pen');
const circle = (cx, cy, r, n = 40) => Array.from({ length: n + 2 }, (_, i) => { const a = (i / n) * Math.PI * 2 + 0.7; const j = 1 + 0.03 * Math.sin(i * 1.7); return [cx + r * j * Math.cos(a), cy + r * j * Math.sin(a)]; });
await io.drag(circle(300, 380, 90));
it = await lastItem();
check('without holding, the stroke stays freehand', it.pts.length < 60, `pts=${it.pts.length}`);
await io.drag(circle(700, 380, 90), 700);
it = await lastItem();
const ring = it.pts.slice(0, -1); // last point repeats the first
const ccx = ring.reduce((a, p) => a + p.x, 0) / ring.length, ccy = ring.reduce((a, p) => a + p.y, 0) / ring.length;
const rad = it.pts.map((p) => Math.hypot(p.x - ccx, p.y - ccy));
const mean = rad.reduce((a, b) => a + b, 0) / rad.length;
const spread = Math.max(...rad) - Math.min(...rad);
check('holding the pen at the end snaps a wobbly loop into a perfect circle', it.pts.length > 80 && spread / mean < 0.01 && near(mean, 90, 4) && near(ccx, 700, 4) && near(ccy, 380, 4), `n=${it.pts.length} spread=${(spread / mean).toFixed(4)} r=${mean.toFixed(1)} c=(${ccx.toFixed(1)},${ccy.toFixed(1)})`);
const rectPath = [...io.line([300, 520], [520, 526], 8), ...io.line([520, 526], [514, 640], 8).slice(1), ...io.line([514, 640], [296, 634], 8).slice(1), ...io.line([296, 634], [300, 522], 8).slice(1)];
await io.drag(rectPath, 700);
it = await lastItem();
const xs = it.pts.map((p) => p.x), ys = it.pts.map((p) => p.y);
const [bx0, bx1, by0, by1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
check('held rectangle becomes an exact axis-aligned rectangle', it.pts.every((p) => near(p.x, bx0, 1e-6) || near(p.x, bx1, 1e-6) || near(p.y, by0, 1e-6) || near(p.y, by1, 1e-6)) && bx1 - bx0 > 180, `w=${(bx1 - bx0).toFixed(1)}`);
await io.drag(io.line([700, 560], [900, 640], 30).map(([x, y], i) => [x, y + (i % 2) * 3]), 700);
it = await lastItem();
check('held wobbly line becomes a 2-point line', it.pts.length === 2);
await page.getByTestId('snap').click();
await io.drag(circle(900, 250, 60), 700);
it = await lastItem();
check('with "Nắn nét" off nothing is snapped', it.pts.length < 60);
await page.getByTestId('snap').click();

// ------------------------------------------------------------ G. graph + formula dialogs
await clearBoard();
await page.getByTestId('open-graph').click();
await page.getByRole('button', { name: 'Sin' }).click();
check('graph example fills the expression and the preview draws the curve', (await page.getByTestId('graph-expr').inputValue()) === 'sin(x)' && (await ink('graph-preview', (n) => n > 300)) > 300);
await page.getByTestId('graph-expr').fill('x^^2');
check('invalid expression clears the graph preview', (await ink('graph-preview', (n) => n === 0)) === 0);
check('invalid expression shows an error and blocks insertion', (await page.getByTestId('graph-error').isVisible()) && (await page.getByTestId('graph-insert').isDisabled()));
await page.getByTestId('graph-expr').fill('x^2 - 4');
check('valid expression enables insertion', await page.getByTestId('graph-insert').isEnabled());
await page.getByTestId('graph-insert').click();
s = await io.state();
it = s.items[0];
const lowest = Math.max(...it.prims.filter((p) => p.t === 'poly' && p.c === '#2563eb').flatMap((p) => p.pts.map((q) => q[1])));
const lowestX = it.prims.filter((p) => p.t === 'poly' && p.c === '#2563eb').flatMap((p) => p.pts).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
check('graph y=x²−4 is aligned to the Oxy scale (vertex at (0,−4))', it.gen.id === 'fn-custom' && near(lowest, 160, 1) && near(lowestX, 0, 2) && it.x === 0 && it.y === 0 && it.scale === 1, `vertex=(${lowestX.toFixed(1)},${(-lowest / 40).toFixed(2)})`);
const orig = await page.evaluate(() => { const v = window.__board.getState().viewport; return [v.x, v.y]; });
check('inserting a graph recentres the view so the axes are visible', orig[0] > 100 && orig[0] < 1080 && orig[1] > 100 && orig[1] < 720, JSON.stringify(orig));
check('dialog closed after inserting', (await page.getByTestId('graph-dialog').count()) === 0);
await page.getByTestId('param-expr').fill('sin(x)');
s = await io.state();
check('inspector edits the expression live', s.items[0].gen.params.expr === 'sin(x)');
await page.getByTestId('open-text').click();
check('formula dialog shows a live preview of the default formula', (await ink('text-preview', (n) => n > 200)) > 200);
await page.getByTestId('text-src').fill('');
check('empty input → empty preview and disabled insert', (await ink('text-preview', (n) => n === 0)) === 0 && (await page.getByTestId('text-insert').isDisabled()));
await page.getByTestId('sym-Phân số').click();
await page.waitForFunction(() => document.activeElement?.selectionStart === 6, null, { timeout: 2000 }).catch(() => {});
check('palette button inserts a fraction and puts the caret inside the first braces', (await page.getByTestId('text-src').inputValue()) === '\\frac{}{}' && (await page.evaluate(() => document.activeElement.selectionStart)) === 6);
await page.keyboard.type('a');
await page.getByTestId('text-src').press('End');
await page.getByTestId('sym-pi').click();
await page.getByTestId('sym-Căn bậc hai').click();
await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT' && document.activeElement.value.endsWith('\\sqrt{}') && document.activeElement.selectionStart === document.activeElement.value.length - 1, null, { timeout: 2000 });
await page.keyboard.type('x');
check('typing continues inside the inserted template', (await page.getByTestId('text-src').inputValue()) === '\\frac{a}{}\\pi \\sqrt{x}', await page.getByTestId('text-src').inputValue());
check('preview updates after palette input', (await ink('text-preview', (n) => n > 200)) > 200);
await page.getByTestId('text-src').fill('x+1');
await page.getByTestId('text-src').selectText();
await page.getByTestId('sym-Căn bậc hai').click();
check('a selection is wrapped by the chosen template', (await page.getByTestId('text-src').inputValue()) === '\\sqrt{x+1}');
await page.getByRole('button', { name: 'Nghiệm phương trình bậc hai' }).click();
check('named example fills the formula', (await page.getByTestId('text-src').inputValue()).includes('\\Delta'));
await page.getByTestId('text-src').fill('\\frac{a}{b}+\\sqrt{x}');
await page.getByTestId('text-size').fill('40');
await page.getByTestId('text-insert').click();
it = await lastItem();
check('formula inserted as a text object with the chosen size', it.prims[0].t === 'text' && it.prims[0].math && it.prims[0].s === '\\frac{a}{b}+\\sqrt{x}' && it.prims[0].size === 40);
await page.screenshot({ path: `${SHOTS}/e2e-graph.png` });

// ------------------------------------------------------------ H. multiple boards + persistence
await clearBoard();
await io.tool('pen');
await io.drag(io.line([300, 300], [500, 340], 10));
await page.getByTestId('open-boards').click();
await page.getByTestId('new-board').click();
await page.waitForFunction(() => window.__board.getState().boards.length === 2);
s = await io.state();
check('new board is empty and becomes current', s.boards.length === 2 && s.items.length === 0 && s.boardId === s.boards[1].id);
await io.drag(io.line([300, 400], [600, 420], 10));
await io.drag(io.line([300, 500], [600, 520], 10));
await page.locator('.boards li .open').nth(0).click();
await page.waitForFunction(() => window.__board.getState().items.length === 1);
s = await io.state();
check('switching boards restores each board’s own content', s.items.length === 1 && s.boardId === s.boards[0].id);
await page.getByTestId('rename-board').nth(0).click();
await page.getByTestId('rename-input').fill('Hình học 11');
await page.keyboard.press('Enter');
s = await io.state();
check('rename board', s.boards[0].name === 'Hình học 11');
await page.waitForTimeout(700);
await page.reload();
await page.waitForFunction(() => window.__app && window.__board.getState().boards.length === 2);
await page.waitForFunction(() => window.__board.getState().items.length > 0, null, { timeout: 4000 }).catch(() => {});
s = await io.state();
check('boards, names and content survive a reload', s.boards.length === 2 && s.boards[0].name === 'Hình học 11' && s.items.length === 1 && s.boardId === s.boards[0].id);
await page.getByTestId('open-boards').click();
await page.getByTestId('delete-board').nth(1).click();
await page.getByTestId('delete-board').nth(1).click();
await page.waitForFunction(() => window.__board.getState().boards.length === 1);
s = await io.state();
check('delete board needs a confirming second tap', s.boards.length === 1);
await page.getByTestId('open-boards').click();

// ------------------------------------------------------------ I. export
await page.evaluate(() => { const { insertShape, SHAPES } = window.__app; insertShape(SHAPES.find((x) => x.id === 'bai2-b')); });
await page.getByTestId('open-boards').click();
await page.getByTestId('new-board').click();
await io.tool('pen');
await io.drag(io.line([300, 300], [500, 340], 10));
await page.getByTestId('open-boards').click();
const download = async (id) => {
  await page.getByTestId('open-export').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(id).click()]);
  const path = `${SHOTS}/dl-${dl.suggestedFilename()}`;
  await dl.saveAs(path);
  await page.getByTestId('open-export').click().catch(() => {});
  return { name: dl.suggestedFilename(), buf: fs.readFileSync(path) };
};
const png = await download('export-png');
check('PNG export is a real PNG', png.name === 'Hinh-hoc-11.png' || png.name.endsWith('.png') && png.buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && png.buf.length > 2000, `${png.name} ${png.buf.length}B`);
const svg = await download('export-svg');
const svgText = svg.buf.toString('utf8');
check('SVG export contains the drawing', svg.name.endsWith('.svg') && svgText.includes('<svg') && (svgText.match(/<path d="M/g) ?? []).length >= 1, `${svg.name} ${svg.buf.length}B`);
const pdf = await download('export-pdf');
const pdfText = pdf.buf.toString('latin1');
check('PDF export (this board) is valid', pdf.buf.subarray(0, 5).toString() === '%PDF-' && pdfText.trimEnd().endsWith('%%EOF') && /\/Count 1/.test(pdfText) && pdfText.includes('/DCTDecode'), `${pdf.name} ${pdf.buf.length}B`);
const pdfAll = await download('export-pdf-all');
check('PDF export (all boards) has one page per board', /\/Count 2/.test(pdfAll.buf.toString('latin1')), pdfAll.name);

check('no console or page errors during the whole run', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(summary() ? 0 : 1);
