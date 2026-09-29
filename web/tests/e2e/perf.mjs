import { launch } from './helpers.mjs';
const { browser, page } = await launch({ width: 1180, height: 820 });
const N = Number(process.env.N ?? 5000);
const res = await page.evaluate(async (N) => {
  const items = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = 0; i < N; i++) {
    let x = rnd() * 6000 - 1500, y = rnd() * 4000 - 1000;
    const pts = [];
    for (let k = 0; k < 30; k++) { x += rnd() * 10 - 5; y += rnd() * 10 - 5; pts.push({ x, y, p: 0.3 + rnd() * 0.5 }); }
    items.push({ type: 'stroke', id: 's' + i, seq: i + 1, pts, color: '#111318', size: 3, kind: 'pen', pen: true });
  }
  const st = window.__board.getState();
  const t0 = performance.now();
  st.load({ items, background: 'grid', viewport: { x: 0, y: 0, scale: 0.4 }, seq: N });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const firstDraw = performance.now() - t0;
  // pan for 90 frames, one viewport change per frame
  const dts = [];
  let last = performance.now();
  for (let f = 0; f < 90; f++) {
    st.setViewport({ x: -f * 6, y: -f * 3, scale: 0.4 + f * 0.004 });
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    dts.push(now - last);
    last = now;
  }
  dts.sort((a, b) => a - b);
  return { firstDraw, avg: dts.reduce((a, b) => a + b, 0) / dts.length, p95: dts[Math.floor(dts.length * 0.95)], max: dts[dts.length - 1] };
}, N);
console.log(`N=${N} strokes: first draw ${res.firstDraw.toFixed(0)}ms | pan/zoom frame avg ${res.avg.toFixed(1)}ms p95 ${res.p95.toFixed(1)}ms max ${res.max.toFixed(1)}ms`);
await browser.close();
