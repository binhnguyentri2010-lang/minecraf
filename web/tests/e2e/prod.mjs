// Smoke test of the *production build* (served by `vite preview`): renders, draws, works offline.
import { launch, makeIO, reporter, URL as BASE } from './helpers.mjs';

const { browser, ctx, page, cdp, errors } = await launch({ width: 1180, height: 820 }, { prod: true });
const io = makeIO(page, cdp);
const { check, summary } = reporter();
await page.waitForSelector('.gn-toolbar');
check('production build renders the header, tools and float bar', (await page.locator('.gn-toolbar button').count()) > 8 && (await page.locator('.gn-float button').count()) > 8 && (await page.locator('.gn-tabs .tab').count()) === 1);
check('dev-only hooks are absent in production', (await page.evaluate(() => typeof window.__board)) === 'undefined');
await io.penDown(300, 300, 0.4);
for (let i = 1; i <= 20; i++) await io.penMove(300 + i * 10, 300 + Math.sin(i / 3) * 40, 0.4 + i / 50);
await io.penUp(500, 300);
const inked = await page.evaluate(() => {
  const c = document.querySelectorAll('canvas')[2];
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  const c1 = document.querySelectorAll('canvas')[1];
  const d1 = c1.getContext('2d').getImageData(0, 0, c1.width, c1.height).data;
  for (let i = 3; i < d1.length; i += 4) if (d1[i] > 0) n++;
  return n;
});
check('a pen stroke paints pixels in the production build', inked > 500, `${inked}px`);
await page.getByTestId('open-library').click();
await page.getByTestId('group-solid').click();
await page.getByTestId('shape-tetra').click();
await page.getByTestId('open-library').click().catch(() => {});
check('inserting a solid from the library works', (await page.getByTestId('inspector').count()) === 1);
// service worker → offline
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await page.waitForFunction(async () => (await caches.keys()).length > 0, null, { timeout: 8000 }).catch(() => {});
const cached = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0] ?? 'x'); return (await c.keys()).map((r) => new URL(r.url).pathname); });
check('service worker precached the app shell and hashed assets', cached.some((p) => /assets\/.*\.js$/.test(p)) && cached.some((p) => /assets\/.*\.css$/.test(p)), cached.join(','));
await page.waitForTimeout(600);
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.gn-toolbar', { timeout: 8000 }).catch(() => {});
check('app loads offline after the first visit', (await page.locator('.gn-toolbar').count()) === 1);
await ctx.setOffline(false);
check('no console/page errors', errors.length === 0, errors.join(' | '));
await ctx.close();
await browser.close();
console.log('base:', BASE);
process.exit(summary() ? 0 : 1);
