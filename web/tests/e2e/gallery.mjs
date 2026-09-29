import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? '/tmp';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__app);
const groups = ['plane', 'solid', 'coord', 'trig', 'misc'];
for (const g of groups) {
  const n = await page.evaluate((g) => {
    const { useBoard, SHAPES, buildShapeObj, defaultParams } = window.__app;
    const st = useBoard.getState();
    st.load({ items: [], background: 'blank', viewport: { x: 0, y: 0, scale: 1 }, seq: 0 });
    const list = SHAPES.filter((s) => s.group === g);
    const cols = 4, cw = 400, ch = 330;
    const items = list.map((s, i) => {
      const o = buildShapeObj(s, defaultParams(s), { id: 'g' + i, seq: i + 1, x: 0, y: 0, scale: 0.8, color: '#111318' });
      const col = i % cols, row = Math.floor(i / cols);
      // graphs are anchored at origin: just move them into the cell
      o.x = col * cw + cw / 2; o.y = row * ch + ch / 2; o.scale = s.atOrigin ? 0.6 : 0.8;
      return o;
    });
    useBoard.getState().addItems(items);
    const rows = Math.ceil(list.length / cols);
    const sc = Math.min(1600 / (cols * cw), 1100 / (rows * ch));
    useBoard.getState().setViewport({ x: 0, y: 0, scale: sc });
    return list.length;
  }, g);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/gallery-${g}.png` });
  console.log(g, n);
}
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
