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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${name}: no horizontal page overflow`, overflow <= 0, `overflow=${overflow}`);
  let top = await rect(page, '.topbar'), dock = await rect(page, '.dock');
  check(`${name}: top bar and dock fit the screen`, inside(top, vp.width, vp.height) && inside(dock, vp.width, vp.height), JSON.stringify({ top, dock }));
  check(`${name}: bars do not overlap`, !overlap(top, dock));

  // touch-target sizes (Apple HIG: 44pt; we accept ≥ 34 for colour dots, ≥ 40 for the rest)
  const small = await page.evaluate(() => [...document.querySelectorAll('.topbar button, .dock button, .dock input[type=range]')]
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.getAttribute('aria-label') || e.className, w: r.width, h: r.height, sw: e.classList.contains('swatch'), range: e.tagName === 'INPUT' }; })
        .filter((x) => x.w > 0 && !x.range && (x.sw ? Math.min(x.w, x.h) < 34 : Math.min(x.w, x.h) < 40)));
  check(`${name}: touch targets big enough`, small.length === 0, JSON.stringify(small.slice(0, 3)));

  // dock is scrollable so every tool is reachable
  const reach = await page.evaluate(() => { const d = document.querySelector('.dock'); const last = d.querySelector('[data-testid=pencil-only]'); d.scrollLeft = d.scrollWidth; const r = last.getBoundingClientRect(); const dr = d.getBoundingClientRect(); return r.right <= dr.right + 1 && r.left >= dr.left - 1; });
  check(`${name}: last dock tool reachable by scrolling`, reach);

  // library panel
  await page.getByTestId('open-library').click();
  const panel = await rect(page, '.panel');
  const dock2 = await rect(page, '.dock'), top2 = await rect(page, '.topbar');
  check(`${name}: library panel inside screen, clear of bars`, inside(panel, vp.width, vp.height) && !overlap(panel, dock2) && !overlap(panel, top2), JSON.stringify(panel));
  const cards = await page.evaluate(() => { const p = document.querySelector('.panel .grid'); const cs = [...p.querySelectorAll('.card')]; const pr = p.getBoundingClientRect(); return { n: cs.length, scrollable: p.scrollHeight > p.clientHeight, w: pr.width, first: cs[0].getBoundingClientRect().width }; });
  check(`${name}: library grid lists shapes and scrolls`, cards.n > 10 && cards.first > 60, JSON.stringify(cards));
  await page.screenshot({ path: `${SHOTS}/layout-${name}-library.png` });
  await page.getByTestId('shape-quad-parallelogram').click();
  const phone = vp.width <= 760;
  const panelOpen = await page.getByTestId('library').count();
  check(`${name}: ${phone ? 'library closes after insert on phones' : 'library stays open on tablets'}`, phone ? panelOpen === 0 : panelOpen === 1);
  if (!phone) await page.getByTestId('open-library').click();

  // inspector with a parametric solid
  await page.getByTestId('open-library').click();
  await page.getByTestId('library-search').fill('hinh chop');
  await page.getByTestId('shape-pyr4-square').click();
  if (await page.getByTestId('library').count()) await page.getByTestId('open-library').click();
  const insp = await rect(page, '.inspector');
  const dock3 = await rect(page, '.dock'), top3 = await rect(page, '.topbar');
  check(`${name}: inspector inside screen, clear of bars`, inside(insp, vp.width, vp.height) && !overlap(insp, dock3) && !overlap(insp, top3), JSON.stringify(insp));
  const scrollOk = await page.evaluate(() => { const e = document.querySelector('.inspector'); return e.scrollHeight <= e.clientHeight || getComputedStyle(e).overflowY === 'auto'; });
  check(`${name}: inspector content scrolls when tall`, scrollOk);
  await page.screenshot({ path: `${SHOTS}/layout-${name}-inspector.png` });
  const menu = await rect(page, '.selmenu');
  const dockM = await rect(page, '.dock'), topM = await rect(page, '.topbar');
  check(`${name}: selection menu inside screen, clear of bars`, inside(menu, vp.width, vp.height) && !overlap(menu, dockM) && !overlap(menu, topM), JSON.stringify(menu));
  const handle = await page.evaluate(() => { const st = window.__board.getState(); const g = window.__app.selectionGeo(st.items.filter((i) => st.selection.includes(i.id)), st.viewport.scale); const v = st.viewport; return { x: v.x + g.rotate[0] * v.scale, y: v.y + g.rotate[1] * v.scale }; });
  check(`${name}: menu does not cover the rotate handle`, !(menu && handle.x > menu.l && handle.x < menu.r && handle.y > menu.t - 12 && handle.y < menu.b + 12), JSON.stringify({ handle, menu }));

  // modal fits
  await page.getByTestId('open-graph').click();
  const modal = await rect(page, '.modal');
  check(`${name}: graph dialog fits`, inside(modal, vp.width, vp.height), JSON.stringify(modal));
  await page.screenshot({ path: `${SHOTS}/layout-${name}-graph.png` });
  check(`${name}: no console errors`, errors.length === 0, errors.join('|'));
  await browser.close();
}
process.exit(summary() ? 0 : 1);
