/**
 * Runs the content-script harnesses in headless Chrome (no manual browser step):
 *   - test/content-harness.html            (Facebook platform)
 *   - test/threads-content-harness.html    (Threads platform)
 * Usage: npm run harness:headless   (CHROME_PATH overrides the browser binary)
 * Exit code 0 = all harness checks passed on both platforms.
 */
import { spawn } from 'child_process';
import { rm } from 'fs/promises';
import os from 'os';
import path from 'path';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTTP_PORT = 8766;
const CDP_PORT = 9333;
const HARNESS_PAGES = ['content-harness.html', 'threads-content-harness.html'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// A FRESH profile dir every run, not a reused one: killing Chrome (below)
// marks the profile as "crashed", so a reused profile can trigger Chrome's
// own session/scroll restoration on the next launch — racing with the
// harness's own scroll-based reading-zone checks in surprising ways.
const profileDir = path.join(os.tmpdir(), `jev-harness-profile-${process.pid}-${Date.now()}`);

const server = spawn(process.execPath, ['test/static-server.js'], { env: { ...process.env, PORT: String(HTTP_PORT) }, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--no-first-run', '--no-default-browser-check',
  // Fixed size: the harnesses scroll specific posts into/out of the "reading
  // zone" (top ~65% of the viewport, see content.js) and need a known
  // viewport height for those checks to be deterministic.
  '--window-size=1024,900',
  `--user-data-dir=${profileDir}`, 'about:blank'
], { stdio: 'ignore' });

let exitCode = 1;
try {
  let targets;
  for (let i = 0; i < 40 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json(); } catch { await sleep(250); }
  }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  const expression = 'JSON.stringify({ done: !!window.__harnessResult?.done, failed: window.__harnessResult?.failed || 0, ' +
    'lines: [...document.querySelectorAll("#log div")].map(d => d.textContent) })';

  let anyFailed = false;
  for (const page of HARNESS_PAGES) {
    await send('Page.navigate', { url: `http://localhost:${HTTP_PORT}/test/${page}` });
    let result = null;
    let lastLineCount = 0;
    for (let i = 0; i < 150 && !(result && result.done); i++) {
      await sleep(500);
      const r = await send('Runtime.evaluate', { expression, returnByValue: true });
      result = JSON.parse(r.result?.result?.value || 'null');
      if (result && result.lines.length > lastLineCount) {
        for (let j = lastLineCount; j < result.lines.length; j++) {
          console.log(result.lines[j]);
        }
        lastLineCount = result.lines.length;
      }
    }
    if (!result || !result.done) {
      console.log(`TIMEOUT: ${page} did not finish. Last state:`);
      if (result && result.lines) console.log(result.lines.join('\n'));
    }
    if (!result || !result.done || result.failed > 0) anyFailed = true;
  }
  exitCode = anyFailed ? 1 : 0;
  ws.close();
} finally {
  chrome.kill();
  server.kill();
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
process.exit(exitCode);
