/**
 * Runs test/content-harness.html in headless Chrome (no manual browser step).
 * Usage: npm run harness:headless   (CHROME_PATH overrides the browser binary)
 * Exit code 0 = all harness checks passed.
 */
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTTP_PORT = 8766;
const CDP_PORT = 9333;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, ['test/static-server.js'], { env: { ...process.env, PORT: String(HTTP_PORT) }, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${path.join(os.tmpdir(), 'jev-harness-profile')}`, 'about:blank'
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

  await send('Page.navigate', { url: `http://localhost:${HTTP_PORT}/test/content-harness.html` });
  const expression = 'JSON.stringify(window.__harnessResult?.done ? { ...window.__harnessResult, ' +
    'lines: [...document.querySelectorAll("#log div")].map(d => d.textContent) } : null)';
  let result = null;
  for (let i = 0; i < 120 && !result; i++) {
    await sleep(500);
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    result = JSON.parse(r.result?.result?.value || 'null');
  }
  console.log(result ? result.lines.join('\n') : 'TIMEOUT: harness did not finish');
  exitCode = result && result.failed === 0 ? 0 : 1;
  ws.close();
} finally {
  chrome.kill();
  server.kill();
}
process.exit(exitCode);
