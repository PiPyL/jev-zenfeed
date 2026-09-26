/**
 * Build a throwaway visual-test page from src/popup/popup.html:
 * injects a fake chrome.* API + auto-click helper so headless Chrome can
 * render the popup's three scope states (Chung / Threads following Chung /
 * Threads customized). Not part of the shipped extension.
 *
 * Usage: node scripts/gen-popup-visual.js  →  writes src/popup/popup-visual.html
 */
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.resolve('src/popup/popup.html'), 'utf8');

const STUB = `<script>
(function () {
  const state = new URLSearchParams(location.search).get('state') || 'shared';
  try { localStorage.setItem('jevActiveTab', 'settings'); } catch (_) {}
  const STORE = {
    language: 'vi',
    extensionEnabled: true,
    filterCriteria: 'Cá độ, cờ bạc, vay nợ nóng, spoiler phim, drama showbiz, coin lừa đảo',
    whitelistCriteria: 'tin chính thống',
    confidenceThreshold: 70,
    hideMode: 'banner',
    filterMode: 'smooth',
    blurPreset: 'classic',
    blurFlashcardTopic: 'ielts',
    blurCustomQuotes: '',
    blurRevealFriction: 'instant',
    blurClassicStrength: 18,
    blurClassicTint: '',
    apiUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-visual-test',
    platformProfiles: {}
  };
  if (state === 'threads-diverged') {
    STORE.platformProfiles = { threads: { filterCriteria: 'Chỉ ẩn spoiler phim', confidenceThreshold: 85, extensionEnabled: true } };
  }
  const listeners = [];
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const makeArea = () => ({
    get(keys, cb) {
      let out = {};
      if (keys == null) out = clone(STORE);
      else if (typeof keys === 'string') { if (keys in STORE) out[keys] = clone(STORE[keys]); }
      else if (Array.isArray(keys)) keys.forEach((k) => { if (k in STORE) out[k] = clone(STORE[k]); });
      else Object.entries(keys).forEach(([k, d]) => { out[k] = k in STORE ? clone(STORE[k]) : d; });
      const p = Promise.resolve(out);
      if (cb) p.then(cb); else return p;
    },
    set(obj, cb) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) { changes[k] = { oldValue: STORE[k], newValue: clone(v) }; STORE[k] = clone(v); }
      listeners.forEach((l) => l(changes, 'local'));
      const p = Promise.resolve();
      if (cb) p.then(cb); else return p;
    },
    remove() { return Promise.resolve(); }
  });
  window.chrome = {
    storage: {
      local: makeArea(),
      session: { get: (k, cb) => { if (cb) cb({}); } },
      onChanged: { addListener: (l) => listeners.push(l) }
    },
    runtime: {
      id: 'visual-test',
      sendMessage: async (m) => (m && m.action === 'GET_LOGS' ? [] : undefined),
      onMessage: { addListener() {} }
    },
    permissions: { request: async () => true, contains: async () => true }
  };
})();
</script>
`;

const AUTOCLICK = `<script>
window.addEventListener('load', () => {
  const state = new URLSearchParams(location.search).get('state') || 'shared';
  if (state === 'shared') return;
  const btn = document.querySelector('.scope-seg[data-scope="threads"]');
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const row = document.getElementById('scopeStatusRow');
    if (row && !row.hidden) { clearInterval(iv); return; }
    btn.click();
    if (tries > 40) clearInterval(iv);
  }, 50);
});
</script>
`;

const withStub = src.replace('<script src="../utils/settings-defaults.js"></script>', `${STUB}<script src="../utils/settings-defaults.js"></script>`);
const out = withStub.replace('</body>', `${AUTOCLICK}</body>`);
fs.writeFileSync(path.resolve('src/popup/popup-visual.html'), out);
console.log('wrote src/popup/popup-visual.html');
