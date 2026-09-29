// Runs every e2e suite against a temporary dev server (dev hooks) and the production preview.
import { spawn } from 'node:child_process';

const run = (cmd, args, env = {}) =>
  new Promise((res) => {
    const p = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('exit', (c) => res(c ?? 1));
  });
const waitFor = async (url) => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not start: ${url}`);
};

let failed = 0;
// The interaction suites run against the *shipping* bundle (Preact, minified) built with the test hooks enabled.
if ((await run('node', ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-e2e', '--emptyOutDir'], { VITE_E2E: '1' })) !== 0) process.exit(1);
const dev = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--outDir', 'dist-e2e', '--port', '5188', '--strictPort'], { stdio: 'ignore' });
try {
  await waitFor('http://localhost:5188/');
  for (const f of ['core', 'interact', 'lasso', 'palm', 'layout']) {
    console.log(`\n=== ${f} ===`);
    failed += (await run('node', [`tests/e2e/${f}.mjs`], { URL: 'http://localhost:5188/' })) ? 1 : 0;
  }
} finally {
  dev.kill();
}
if ((await run('npm', ['run', 'build'])) !== 0) process.exit(1);
const prev = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', '5189', '--strictPort'], { stdio: 'ignore' });
try {
  await waitFor('http://localhost:5189/');
  console.log('\n=== prod ===');
  failed += (await run('node', ['tests/e2e/prod.mjs'], { URL: 'http://localhost:5189/' })) ? 1 : 0;
} finally {
  prev.kill();
}
console.log(failed ? `\n${failed} e2e suite(s) FAILED` : '\nall e2e suites passed');
process.exit(failed ? 1 : 0);
