import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROME } from './helpers.mjs';

const svg = fs.readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: CHROME });
for (const [size, name] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;background:#0b0d12}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `public/${name}` });
  await page.close();
}
await browser.close();
console.log('icons written');
