// GoodNotes-style chrome: tabs, float bar, popovers, pills, document library.
import { launch, makeIO, reporter } from './helpers.mjs';

const { browser, page, cdp, errors } = await launch({ width: 1180, height: 820 });
const io = makeIO(page, cdp);
const { check, summary } = reporter();
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const vis = async (tid) => (await page.getByTestId(tid).count()) > 0 && (await page.getByTestId(tid).first().isVisible());
const boards = async () => (await io.state()).boards;
const waitBoards = (n) => page.waitForFunction((k) => window.__board.getState().boards.length === k, n);

// ---------------------------------------------------------------- header + tabs
check('header shows the home button, one tab (selected) and the tool row', (await vis('home')) && (await page.getByTestId('tab').count()) === 1 && (await page.locator('.gn-tabs .tab.on').innerText()).includes('Bảng 1'));
for (const t of ['tool-lasso', 'tool-select', 'tool-pen', 'tool-highlighter', 'tool-eraser', 'open-text', 'open-shapes', 'open-library', 'open-graph', 'ruler', 'protractor', 'pencil-only', 'open-export', 'open-more', 'open-boards'])
  if (!(await vis(t))) check(`toolbar has ${t}`, false);
check('the selected tool is highlighted (pen by default)', (await page.getByTestId('tool-pen').getAttribute('class') ?? '').includes('sel') && !(await page.getByTestId('tool-eraser').getAttribute('class') ?? '').includes('sel'));
await page.getByTestId('tool-eraser').click();
check('choosing another tool moves the highlight', (await page.getByTestId('tool-eraser').getAttribute('class') ?? '').includes('sel') && (await io.state()).tool === 'eraser');

// ---------------------------------------------------------------- float bar
check('float bar is hidden for the eraser and the selection tools', !(await vis('floatbar')));
await page.getByTestId('tool-lasso').click();
check('… and for the lasso', !(await vis('floatbar')));
await page.getByTestId('tool-pen').click();
check('float bar appears for the pen with 3 widths, helpers and 8+ colours', (await vis('floatbar')) && (await page.locator('.gn-float .swatch').count()) >= 8 && (await page.locator('.gn-float button.w').count()) === 3);
for (const [id, size] of [['thin', 2], ['thick', 8], ['medium', 4]]) {
  await page.getByTestId(`width-${id}`).click();
  check(`width preset "${id}" sets the pen size to ${size} and highlights it`, near((await page.evaluate(() => window.__board.getState().size)), size) && (await page.getByTestId(`width-${id}`).getAttribute('class') ?? '').includes('on'));
}
await page.getByRole('button', { name: 'Màu #1f6feb' }).click();
check('tapping a colour selects it (chevron marks the selected dot)', (await page.evaluate(() => window.__board.getState().color)) === '#1f6feb' && (await page.locator('.gn-float .swatch.on .chev').count()) === 1);
await page.getByTestId('add-color').fill('#ff00aa');
let pal = await page.evaluate(() => ({ c: window.__board.getState().color, p: window.__board.getState().palette }));
check('the "+" colour picker adds a custom colour to the palette and selects it', pal.c === '#ff00aa' && pal.p.includes('#ff00aa') && (await page.getByRole('button', { name: 'Màu #ff00aa' }).count()) === 1);
await io.drag(io.line([300, 320], [420, 340], 8));
check('a stroke drawn now uses the custom colour', (await io.state()).items.at(-1).color === '#ff00aa');
await page.getByTestId('add-color').fill('#ff00aa');
check('adding the same colour twice does not duplicate it', (await page.evaluate(() => window.__board.getState().palette.filter((c) => c === '#ff00aa').length)) === 1);

// ---------------------------------------------------------------- popovers
await page.getByTestId('open-shapes').click();
check('quick-shapes popover lists line, arrow, compass and rectangle', (await page.locator('.popover [data-testid^=tool-]').count()) === 4);
await page.getByTestId('tool-circle').click();
check('choosing a quick shape selects the tool and closes the popover', (await io.state()).tool === 'circle' && (await page.locator('.popover').count()) === 0 && (await page.getByTestId('open-shapes').getAttribute('class') ?? '').includes('sel'));
await page.getByTestId('open-shapes').click();
await page.mouse.click(700, 500);
check('tapping the canvas closes an open popover without drawing', (await page.locator('.popover').count()) === 0 && (await io.state()).items.length === 1);
await page.getByTestId('open-more').click();
await page.getByTestId('bg-grid').click();
check('"more" menu switches the paper', (await io.state()) && (await page.evaluate(() => window.__board.getState().background)) === 'grid');
await page.getByTestId('bg-axes').click();
check('… including the Oxy plane', (await page.evaluate(() => window.__board.getState().background)) === 'axes');
await page.getByTestId('bg-dots').click();
await page.getByTestId('clear-board').click();
check('"Xoá toàn bộ bảng" empties the board and can be undone', (await io.state()).items.length === 0 && (await page.getByTestId('undo').isEnabled()));
await page.getByTestId('undo').click();
check('… undo restores it', (await io.state()).items.length === 1);

// ---------------------------------------------------------------- pills
await page.getByTestId('tool-pen').click();
await io.drag(io.line([1000, 700], [1100, 760], 8));
await page.evaluate(() => window.__board.getState().setViewport({ x: -900, y: -500, scale: 0.4 }));
await page.getByTestId('fit').click();
const fit = await page.evaluate(() => { const st = window.__board.getState(); const v = st.viewport; return st.items.map((i) => { const b = window.__app.itemBounds(i); return [v.x + b.minX * v.scale, v.y + b.minY * v.scale, v.x + b.maxX * v.scale, v.y + b.maxY * v.scale]; }); });
check('the fit button brings all content on screen, below the header', fit.every(([x0, y0, x1, y1]) => x0 >= 0 && y1 <= 820 && x1 <= 1180 && y0 >= 100), JSON.stringify(fit.map((r) => r.map(Math.round))));
await page.getByTestId('zoom').click();
check('the percentage pill resets to 100 %', near((await io.state()).viewport.scale, 1));
check('undo/redo pill reflects history', (await page.getByTestId('undo').isEnabled()) && !(await page.getByTestId('redo').isEnabled()));

// ---------------------------------------------------------------- tabs
await page.getByTestId('add-board').click();
await waitBoards(2);
let s = await io.state();
check('"+" in the tab strip creates a board, opens it in a new selected tab', s.boards.length === 2 && (await page.getByTestId('tab').count()) === 2 && s.items.length === 0 && (await page.locator('.gn-tabs .tab.on').innerText()).includes('Bảng 2'));
await io.drag(io.line([300, 400], [500, 420], 8));
await page.getByTestId('tab').first().locator('.name').click();
await page.waitForFunction(() => window.__board.getState().items.length === 2 && window.__board.getState().boardId === window.__board.getState().boards[0].id);
check('clicking the first tab switches boards and keeps each board’s content', (await io.state()).items[0].color === '#ff00aa');
await page.getByTestId('tab').nth(1).locator('.name').click();
await page.waitForFunction(() => window.__board.getState().boardId === window.__board.getState().boards[1].id);
check('… second tab shows its own stroke', (await io.state()).items.length === 1);
await page.getByTestId('tab-close').nth(1).click();
await page.waitForFunction(() => window.__board.getState().boardId === window.__board.getState().boards[0].id);
check('closing the open tab activates its neighbour; the board itself is kept', (await page.getByTestId('tab').count()) === 1 && (await boards()).length === 2);

// ---------------------------------------------------------------- document library
await page.getByTestId('home').click();
await page.waitForSelector('[data-testid=library-screen]');
check('home opens the document library titled "Tài liệu" listing every board', (await page.locator('.lib-main h1').innerText()) === 'Tài liệu' && (await page.getByTestId('doc').count()) === 2);
await page.waitForFunction(() => document.querySelectorAll('.doc .paper img').length === 2, null, { timeout: 4000 }).catch(() => {});
const thumbs = await page.evaluate(() => [...document.querySelectorAll('.doc .paper img')].map((i) => i.src.slice(0, 22)));
check('every card shows a JPEG thumbnail of its board (also for a board that was just left)', thumbs.length === 2 && thumbs.every((t) => t === 'data:image/jpeg;base64'), JSON.stringify(thumbs));
check('the open board’s card is marked', (await page.locator('.doc.cur').count()) === 1);
await page.getByTestId('doc-fav').nth(1).click();
check('the star marks a favourite', (await page.getByTestId('doc-fav').nth(1).getAttribute('aria-pressed')) === 'true');
await page.getByTestId('nav-fav').click();
check('"Yêu thích" lists only favourites', (await page.getByTestId('doc').count()) === 1 && (await page.locator('.lib-main h1').innerText()) === 'Yêu thích');
await page.getByTestId('doc-fav').click();
check('unstarring the last favourite shows the empty message', (await page.getByTestId('doc').count()) === 0 && (await page.locator('.lib-empty').innerText()).includes('yêu thích'));
await page.getByTestId('nav-all').click();
await page.getByTestId('doc-menu').first().click();
await page.getByTestId('doc-rename').click();
await page.getByTestId('doc-rename-input').fill('Hình học 11');
await page.keyboard.press('Enter');
check('rename from the card menu updates the card and the tab', (await boards())[0].name === 'Hình học 11' && (await page.getByTestId('doc-menu').first().innerText()).includes('Hình học 11'));
await page.getByTestId('doc-menu').first().click();
await page.getByTestId('doc-duplicate').click();
await waitBoards(3);
check('duplicate inserts a "(bản sao)" right after the original, with its thumbnail', (await boards())[1].name === 'Hình học 11 (bản sao)' && (await page.locator('.doc .paper img').count()) === 3);
await page.getByTestId('doc-open').nth(1).click();
await page.waitForFunction(() => window.__board.getState().boardId === window.__board.getState().boards[1].id && window.__board.getState().items.length === 2);
check('opening the copy returns to the editor with a new tab and the copied strokes', (await vis('tool-pen')) && (await page.getByTestId('tab').count()) === 2 && (await io.state()).items[0].color === '#ff00aa', JSON.stringify({ tabs: await page.getByTestId('tab').count(), stateTabs: await page.evaluate(() => JSON.stringify([window.__ui.getState().tabs, window.__board.getState().boards.map((b) => b.id), window.__board.getState().boardId])), view: await page.evaluate(() => window.__ui.getState().view), items: (await io.state()).items.map((i) => i.color), pen: await vis('tool-pen') }));
await page.getByTestId('home').click();
await page.getByTestId('new-doc').click();
await waitBoards(4);
check('"Mới" creates a board and opens it in the editor', (await vis('floatbar')) && (await page.getByTestId('tab').count()) === 3 && (await io.state()).items.length === 0);
await page.getByTestId('home').click();
await page.getByTestId('doc-menu').nth(3).click();
await page.getByTestId('doc-delete').click();
check('deleting asks for a second tap', (await boards()).length === 4);
await page.getByTestId('doc-delete').click();
await waitBoards(3);
check('second tap deletes the board and its tab', (await page.getByTestId('doc').count()) === 3 && (await page.getByTestId('tab').count()) <= 2);
await page.getByTestId('back-to-editor').click();
check('the sidebar button returns to the editor', await vis('tool-pen'));

// ---------------------------------------------------------------- persistence
await page.waitForTimeout(900);
await page.reload();
await page.waitForFunction(() => window.__app && window.__board.getState().boards.length === 3);
s = await io.state();
check('boards, names and favourites survive a reload', s.boards.length === 3 && s.boards[0].name === 'Hình học 11');
check('open tabs are restored', (await page.getByTestId('tab').count()) >= 1);
await page.getByTestId('home').click();
await page.waitForFunction(() => document.querySelectorAll('.doc .paper img').length >= 2, null, { timeout: 5000 }).catch(() => {});
check('thumbnails survive a reload', (await page.locator('.doc .paper img').count()) >= 2);

check('no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(summary() ? 0 : 1);
