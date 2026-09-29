import { launch, reporter } from './helpers.mjs';

const SHOTS = process.env.SHOTS ?? '/tmp';
const { check, summary } = reporter();
const devices = [
  ['iPad-portrait', { width: 820, height: 1180 }],
  ['iPad-landscape', { width: 1180, height: 820 }],
  ['iPhone', { width: 390, height: 844 }],
  ['iPhone-small', { width: 320, height: 568 }],
  ['iPhone-landscape', { width: 844, height: 390 }],
  ['laptop', { width: 1440, height: 900 }],
];
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);
const inside = (r, vw, vh) => r && r.l >= -0.5 && r.t >= -0.5 && r.r <= vw + 0.5 && r.b <= vh + 0.5;
const overlap = (a, b) => a && b && a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;

for (const [name, vp] of devices) {
  const { browser, page, errors } = await launch(vp);
  const phone = vp.width <= 760;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${name}: no horizontal page overflow`, overflow <= 0, `overflow=${overflow}`);

  // ---- chrome at rest: header, float bar, pills
  const hdr = await rect(page, '.gn-header'), flt = await rect(page, '.gn-float'), und = await rect(page, '.undo-pill'), zm = await rect(page, '.zoom-pill');
  check(`${name}: header, float bar and pills fit the screen`, [hdr, flt, und, zm].every((r) => inside(r, vp.width, vp.height)), JSON.stringify({ hdr, flt, und, zm }));
  check(`${name}: chrome elements do not overlap each other`, !overlap(hdr, flt) && !overlap(hdr, und) && !overlap(hdr, zm) && !overlap(flt, und) && !overlap(flt, zm) && !overlap(und, zm), JSON.stringify({ hdr, flt, und, zm }));
  const small = await page.evaluate(() => [...document.querySelectorAll('.gn-header button, .gn-float button, .pill button')]
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.getAttribute('aria-label') || e.className, w: r.width, h: r.height, sw: e.classList.contains('swatch') }; })
    .filter((x) => x.w > 0 && (x.sw ? Math.min(x.w, x.h) < 36 : Math.min(x.w, x.h) < 40)));
  check(`${name}: touch targets big enough`, small.length === 0, JSON.stringify(small.slice(0, 3)));
  const reach = await page.evaluate(() => {
    const c = document.querySelector('.gn-toolbar .center'); c.scrollLeft = c.scrollWidth;
    const ok = (el, box) => { const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return r.right <= b.right + 1 && r.left >= b.left - 1; };
    const last = c.querySelector('[data-testid=protractor]');
    const f = document.querySelector('.gn-float'); f.scrollLeft = f.scrollWidth;
    const lastColor = f.querySelector('.addcolor');
    return ok(last, c) && ok(lastColor, f);
  });
  check(`${name}: every tool and the last colour are reachable by scrolling`, reach);
  const rightSide = await page.evaluate(() => ['pencil-only', 'open-export', 'open-more'].every((t) => { const r = document.querySelector(`[data-testid=${t}]`).getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= 0; }));
  check(`${name}: Pencil-only, export and more stay visible on screen`, rightSide);

  // ---- library panel (shape gallery)
  await page.getByTestId('open-library').click();
  const panel = await rect(page, '.panel');
  const hdr2 = await rect(page, '.gn-header'), zm2 = await rect(page, '.zoom-pill');
  check(`${name}: shape panel inside screen, clear of header and zoom pill`, inside(panel, vp.width, vp.height) && !overlap(panel, hdr2) && !overlap(panel, zm2), JSON.stringify(panel));
  check(`${name}: float bar steps aside while a panel is open`, (await page.locator('.gn-float').isHidden()));
  const cards = await page.evaluate(() => { const p = document.querySelector('.panel .grid'); const cs = [...p.querySelectorAll('.card')]; return { n: cs.length, first: cs[0].getBoundingClientRect().width }; });
  check(`${name}: shape grid lists shapes`, cards.n > 10 && cards.first > 60, JSON.stringify(cards));
  await page.screenshot({ path: `${SHOTS}/layout-${name}-library.png` });
  await page.getByTestId('shape-quad-parallelogram').click();
  const panelOpen = await page.getByTestId('library').count();
  check(`${name}: ${phone ? 'shape panel closes after insert on phones' : 'shape panel stays open on tablets'}`, phone ? panelOpen === 0 : panelOpen === 1);
  if (!phone) await page.getByTestId('open-library').click();

  // ---- inspector + selection menu with a parametric solid
  await page.getByTestId('open-library').click();
  await page.getByTestId('library-search').fill('hinh chop');
  await page.getByTestId('shape-pyr4-square').click();
  if (await page.getByTestId('library').count()) await page.getByTestId('open-library').click();
  const insp = await rect(page, '.inspector'), hdr3 = await rect(page, '.gn-header'), und3 = await rect(page, '.undo-pill'), zm3 = await rect(page, '.zoom-pill');
  check(`${name}: inspector inside screen, clear of header and pills`, inside(insp, vp.width, vp.height) && !overlap(insp, hdr3) && !overlap(insp, und3) && !overlap(insp, zm3), JSON.stringify({ insp, und3, zm3 }));
  check(`${name}: inspector content scrolls when tall`, await page.evaluate(() => { const e = document.querySelector('.inspector'); return e.scrollHeight <= e.clientHeight || getComputedStyle(e).overflowY === 'auto'; }));
  await page.screenshot({ path: `${SHOTS}/layout-${name}-inspector.png` });
  const menu = await rect(page, '.selmenu');
  check(`${name}: selection menu inside screen, clear of header and pills`, inside(menu, vp.width, vp.height) && !overlap(menu, hdr3) && !overlap(menu, zm3), JSON.stringify(menu));
  const handle = await page.evaluate(() => { const st = window.__board.getState(); const g = window.__app.selectionGeo(st.items.filter((i) => st.selection.includes(i.id)), st.viewport.scale); const v = st.viewport; return { x: v.x + g.rotate[0] * v.scale, y: v.y + g.rotate[1] * v.scale }; });
  check(`${name}: menu does not cover the rotate handle`, !(menu && handle.x > menu.l && handle.x < menu.r && handle.y > menu.t - 12 && handle.y < menu.b + 12), JSON.stringify({ handle, menu }));

  // ---- dialogs
  await page.getByTestId('open-graph').click();
  const modal = await rect(page, '.modal');
  check(`${name}: graph dialog fits`, inside(modal, vp.width, vp.height), JSON.stringify(modal));
  await page.screenshot({ path: `${SHOTS}/layout-${name}-graph.png` });
  await page.keyboard.press('Escape');
  await page.getByTestId('open-text').click();
  const tm = await rect(page, '.modal');
  check(`${name}: formula dialog fits and scrolls`, inside(tm, vp.width, vp.height) && (await page.evaluate(() => { const m = document.querySelector('.modal'); return m.scrollHeight <= m.clientHeight || getComputedStyle(m).overflowY === 'auto'; })), JSON.stringify(tm));
  const symSmall = await page.evaluate(() => [...document.querySelectorAll('.palette button')].filter((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height) < 44).length);
  check(`${name}: symbol buttons are touch-sized`, symSmall === 0, String(symSmall));
  await page.screenshot({ path: `${SHOTS}/layout-${name}-formula.png` });
  await page.keyboard.press('Escape');

  // ---- popovers stay on screen
  await page.getByTestId('open-shapes').click();
  const pop = await rect(page, '.popover');
  check(`${name}: quick-shapes popover on screen`, inside(pop, vp.width, vp.height), JSON.stringify(pop));
  await page.getByTestId('open-shapes').click();
  await page.getByTestId('open-more').click();
  const pop2 = await rect(page, '.popover');
  check(`${name}: "more" popover on screen`, inside(pop2, vp.width, vp.height), JSON.stringify(pop2));
  await page.screenshot({ path: `${SHOTS}/layout-${name}-more.png` });
  await page.getByTestId('open-more').click();

  // ---- document library screen
  await page.locator('[data-testid=home]:visible, [data-testid=home-compact]:visible').first().click(); // landscape phones fold the tab strip away
  await page.waitForSelector('[data-testid=library-screen]');
  const ls = await rect(page, '.lib-screen'), newBtn = await rect(page, '[data-testid=new-doc]');
  const docs = await page.evaluate(() => [...document.querySelectorAll('.doc .cover')].map((c) => { const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, r: r.right }; }));
  check(`${name}: document library fills the screen with a reachable "Mới" button`, inside(ls, vp.width, vp.height) && inside(newBtn, vp.width, vp.height) && Math.min(newBtn.b - newBtn.t, newBtn.r - newBtn.l) >= 44, JSON.stringify({ newBtn }));
  check(`${name}: document cards are readable and inside the screen`, docs.length >= 1 && docs.every((d) => d.w > 120 && d.l >= 0 && d.r <= vp.width + 1), JSON.stringify(docs));
  check(`${name}: library has no horizontal overflow`, (await page.evaluate(() => { const m = document.querySelector('.lib-main'); return m.scrollWidth - m.clientWidth; })) <= 1);
  await page.screenshot({ path: `${SHOTS}/layout-${name}-docs.png` });
  check(`${name}: no console errors`, errors.length === 0, errors.join('|'));
  await browser.close();
}
process.exit(summary() ? 0 : 1);
