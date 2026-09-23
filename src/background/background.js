/**
 * Jev AI Filter - Background Service Worker (Manifest V3)
 * Handles Jev batch requests, decision caching (IndexedDB LRU),
 * request de-duplication, statistics, the toolbar badge and centralized
 * activity logging.
 */

import { evaluateWithJev, testApiKey } from './jev-client.js';
import * as decisionCache from './decision-cache.js';
import { addLog, getLogs, clearLogs } from '../utils/logger.js';
import '../utils/fast-hash.js'; // F12: side-effect import registers self.__jevFastHash
import '../utils/settings-defaults.js'; // F14: side-effect import registers self.__jevDefaults
import '../utils/i18n.js'; // F18: side-effect import registers self.__jevI18n

const simpleHash = self.__jevFastHash;
const { DEFAULT_SETTINGS, criteriaTopics, criteriaFingerprint } = self.__jevDefaults;
const { t: i18nT } = self.__jevI18n;

// One-time cleanup: the cache and logs used to live in storage.local, where
// every write was broadcast to all Facebook tabs.
chrome.storage.local.remove(['cachedDecisions', 'jevLogs']).catch(() => {});

// ==================== SETTINGS (in-memory mirror) ====================
// Read once, then kept fresh via storage.onChanged — no storage I/O per batch.

let settings = { ...DEFAULT_SETTINGS };
const settingsReady = chrome.storage.local.get(DEFAULT_SETTINGS).then((s) => {
  settings = s;
  updateHealth();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  let changed = false;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key in changes) {
      settings[key] = changes[key].newValue ?? DEFAULT_SETTINGS[key];
      changed = true;
    }
  }
  if (!changed) return;
  if ('apiKey' in changes || 'apiUrl' in changes) apiFailing = false; // new endpoint: give it a chance
  updateHealth();
});

const hasKey = () => !!(settings.apiKey && settings.apiKey.trim());
const hasCriteria = () => criteriaTopics(settings.filterCriteria).length > 0;

// ==================== TOOLBAR BADGE ====================
// Per tab: number of posts hidden. Globally: OFF / "!" when the filter cannot
// work (no key or criteria, API failing) so the user notices without opening
// the popup.

/** @type {'ok'|'off'|'setup'|'error'} */
let health = 'ok';
let apiFailing = false;
const tabHidden = new Map(); // tabId -> hidden post count

const BADGE_KEYS = {
  off: { color: '#8a8d91', titleKey: 'badgeOffTitle' },
  setup: { color: '#e41e3f', titleKey: 'badgeSetupTitle' },
  error: { color: '#f59e0b', titleKey: 'badgeErrorTitle' }
};

function badgeFor(tabId) {
  const lang = settings.language || 'en';
  const known = BADGE_KEYS[health];
  if (known) return { text: health === 'off' ? 'OFF' : '!', color: known.color, title: i18nT(lang, known.titleKey) };
  const n = tabId == null ? 0 : (tabHidden.get(tabId) || 0);
  return {
    text: n > 0 ? (n > 999 ? '999+' : String(n)) : '',
    color: '#1877f2',
    title: n > 0 ? i18nT(lang, 'badgeHiddenTitle', { n }) : i18nT(lang, 'badgeFilteringTitle')
  };
}

function renderBadge(tabId) {
  const action = chrome.action;
  if (!action) return;
  const b = badgeFor(tabId);
  const target = tabId == null ? {} : { tabId };
  const ignore = () => {}; // tab may have closed meanwhile
  action.setBadgeText({ ...target, text: b.text }).catch(ignore);
  action.setBadgeBackgroundColor({ ...target, color: b.color }).catch(ignore);
  action.setTitle({ ...target, title: b.title }).catch(ignore);
}

function updateHealth() {
  const next = !settings.extensionEnabled ? 'off'
    : (!hasKey() || !hasCriteria()) ? 'setup'
    : apiFailing ? 'error' : 'ok';
  if (next === health) return;
  health = next;
  renderBadge();
  tabHidden.forEach((_, tabId) => renderBadge(tabId));
}

renderBadge();
chrome.tabs?.onRemoved?.addListener((tabId) => tabHidden.delete(tabId));

// ==================== STATISTICS ====================
// Deltas accumulate in memory and are flushed through a serialized chain, so
// concurrent batches (multiple tabs) never lose counts.

const statsDelta = { scanned: 0, hidden: 0, cacheHits: 0 };
let statsTimer = null;
let statsChain = Promise.resolve();

function recordStats(scanned, hidden, cacheHits) {
  statsDelta.scanned += scanned;
  statsDelta.hidden += hidden;
  statsDelta.cacheHits += cacheHits;
  if (statsTimer) return;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    const delta = { ...statsDelta };
    statsDelta.scanned = statsDelta.hidden = statsDelta.cacheHits = 0;
    statsChain = statsChain.then(async () => {
      const data = await chrome.storage.local.get('stats');
      const stats = data.stats || { scanned: 0, hidden: 0, cacheHits: 0 };
      stats.scanned += delta.scanned;
      stats.hidden += delta.hidden;
      stats.cacheHits += delta.cacheHits;
      await chrome.storage.local.set({ stats });
    }).catch(console.error);
  }, 1000);
}

// ==================== THROTTLED WARNINGS ====================

const lastWarnAt = new Map();
function warnThrottled(key, entry, intervalMs = 60000) {
  const now = Date.now();
  if (now - (lastWarnAt.get(key) || 0) < intervalMs) return;
  lastWarnAt.set(key, now);
  addLog(entry);
}

// ==================== INJECT INTO OPEN TABS ====================
// Chrome only runs manifest content scripts on page loads that happen AFTER the
// extension is installed/reloaded. Inject into Facebook tabs already open so
// filtering starts without the user having to refresh.

chrome.runtime.onInstalled.addListener(async () => {
  const cs = chrome.runtime.getManifest().content_scripts?.[0];
  if (!cs) return;
  const tabs = await chrome.tabs.query({ url: cs.matches });
  for (const tab of tabs) {
    const target = { tabId: tab.id };
    try {
      if (cs.css?.length) await chrome.scripting.insertCSS({ target, files: cs.css });
      await chrome.scripting.executeScript({ target, files: cs.js });
    } catch (err) {
      console.warn('[Jev] Không inject được vào tab', tab.id, err && err.message);
    }
  }
});

// ==================== MESSAGE DISPATCHER ====================

// Actions only the extension's own pages (popup) may trigger — never content scripts.
const EXTENSION_PAGE_ONLY = new Set(['TEST_API_KEY', 'CLEAR_CACHE', 'GET_LOGS', 'CLEAR_LOGS']);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || sender.id !== chrome.runtime.id) return;
  if (EXTENSION_PAGE_ONLY.has(message.action) && sender.tab) return;

  switch (message.action) {
    case 'TEST_API_KEY':
      testApiKey(message.apiKey, message.apiUrl, message.lang || settings.language).then((res) => {
        addLog(res.success
          ? { level: 'success', tag: 'KEY', message: `Xác thực API Key thành công với ${message.apiUrl || 'TypeSafe AI'}` }
          : { level: 'error', tag: 'KEY', message: `Xác thực thất bại: ${res.error || 'Không hợp lệ'}` });
        if (res.success) {
          apiCooldownUntil = 0; // connectivity confirmed — allow immediate retries
          apiFailing = false;
          updateHealth();
        }
        sendResponse(res);
      });
      return true;

    case 'EVALUATE_BATCH':
      handleBatchEvaluation(message.items).then(sendResponse, (err) => {
        console.error('[Jev] handleBatchEvaluation failed:', err);
        sendResponse((message.items || []).map(it => ({ id: it.id, shouldHide: false, confidence: 0, error: true })));
      });
      return true;

    case 'MARK_SAFE':
      markSafe(message, sender).then(sendResponse, () => sendResponse({ success: false }));
      return true;

    case 'TAB_STATUS':
      if (sender.tab && Number.isInteger(message.hidden) && message.hidden >= 0) {
        tabHidden.set(sender.tab.id, message.hidden);
        renderBadge(sender.tab.id);
      }
      return false;

    case 'CLEAR_CACHE':
      decisionCache.clear().then(() => {
        addLog({ level: 'info', tag: 'CACHE', message: 'Đã xóa toàn bộ bộ nhớ đệm (Cache)!' });
        sendResponse({ success: true });
      }, () => sendResponse({ success: false }));
      return true;

    case 'GET_LOGS':
      getLogs().then(sendResponse);
      return true;

    case 'CLEAR_LOGS':
      clearLogs().then(sendResponse);
      return true;

    case 'LOG_EVENT':
      addLog(message.log || {}); // fire-and-forget, no response needed
      return false;
  }
});

// ==================== USER FEEDBACK ====================

const criteriaKeyHash = () => simpleHash(criteriaFingerprint(settings.filterCriteria));

/**
 * "Ẩn nhầm": the user says this content must not be hidden under the current
 * criteria. Stored as a user override in the decision cache — never re-sent
 * to the API, applies to every copy of the same content in every tab.
 */
async function markSafe(message, sender) {
  const hash = typeof message.hash === 'string' ? message.hash : '';
  if (!/^[0-9a-f]{1,16}$/.test(hash)) return { success: false };
  await settingsReady;
  decisionCache.set(`${hash}_${criteriaKeyHash()}`, { violation: false, confidence: 0, user: true });
  const author = typeof message.author === 'string' ? message.author.slice(0, 80) : 'Người dùng';
  addLog({ level: 'info', tag: 'PHẢN HỒI', message: `Đã đánh dấu "ẩn nhầm" bài của "${author}" — sẽ không ẩn lại.` });
  if (sender.tab) recordStats(0, -1, 0);
  return { success: true };
}

// ==================== BATCH EVALUATION ====================

// Requests currently on the wire, keyed by cache key. A post that appears in
// several batches/tabs at once (same ad twice, two tabs) is only paid for once.
const inflight = new Map();

// After an API failure, fail fast for a short window instead of hammering a
// down/blocked endpoint on every scroll (posts are retried after it expires).
const API_COOLDOWN_MS = 10000;
let apiCooldownUntil = 0;

const author = (item) => item.author || 'Người dùng';

/**
 * Process a batch of post candidates from Content Script.
 * Item ids are unique per DOM element; `hash` identifies the content, so
 * duplicate content is evaluated once and fanned out to every element.
 *
 * Result flags: `error` = transient failure (retry later, never cached);
 * `skipped` = filter not configured/disabled (re-check once configured).
 * @param {Array<{id: string, hash: string, text: string, author?: string}>} items
 */
async function handleBatchEvaluation(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  await settingsReady;
  const config = settings;

  const skippedAll = () => items.map(it => ({ id: it.id, shouldHide: false, confidence: 0, skipped: true }));

  if (!config.extensionEnabled) return skippedAll();

  if (!hasKey()) {
    warnThrottled('no-key', {
      level: 'warn',
      tag: 'WARN',
      message: '⚠️ CHƯA CÓ API KEY: Chưa thể lọc bài viết. Vui lòng nhập TypeSafe Jev API Key hoặc bật Mock Server trong Popup.'
    });
    return skippedAll();
  }

  if (!hasCriteria()) {
    warnThrottled('no-criteria', {
      level: 'warn',
      tag: 'WARN',
      message: 'Chưa có tiêu chí lọc bài viết. Vui lòng thiết lập trong Popup.'
    });
    return skippedAll();
  }

  const threshold = config.confidenceThreshold;
  const criteriaHash = criteriaKeyHash();
  const keyOf = (item) => `${item.hash}_${criteriaHash}`;

  /** @type {Map<string, Promise<object>>} cacheKey -> promise of RAW decision */
  const pendingByKey = new Map();
  /** @type {Map<string, object>} cacheKey -> representative item */
  const reps = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!reps.has(key)) reps.set(key, item); // duplicate content in this batch
  }

  // One cache transaction for the whole batch
  const cached = await decisionCache.getMany([...reps.keys()].filter(k => !inflight.has(k)));
  let cacheHits = 0;
  /** @type {Map<string, object>} cacheKey -> item to send */
  const toFetch = new Map();

  for (const [key, item] of reps) {
    const hit = cached.get(key);
    if (hit) {
      cacheHits++;
      pendingByKey.set(key, Promise.resolve({ ...hit, fromCache: true }));
    } else if (inflight.has(key)) {
      pendingByKey.set(key, inflight.get(key));
    } else {
      toFetch.set(key, item);
    }
  }

  if (toFetch.size > 0) {
    const sending = [...toFetch.values()];
    const startedAt = Date.now();
    const apiPromise = Date.now() < apiCooldownUntil
      ? Promise.resolve(sending.map(it => ({ id: it.id, error: true })))
      : evaluateWithJev(config.apiKey, config.apiUrl, sending, config.filterCriteria, threshold)
        .then((results) => {
          logApiBatch(results, sending, threshold, Date.now() - startedAt);
          return results;
        });

    const byId = apiPromise.then((results) => new Map(results.map(r => [r.id, r])));

    for (const [key, rep] of toFetch) {
      const p = byId.then((map) => {
        const res = map.get(rep.id) || { error: true };
        if (res.error) return { error: true };
        // F1: only real decisions are cached; F3: cache RAW values
        const raw = { violation: res.violation === true, confidence: res.confidence };
        if (res.reason) raw.reason = res.reason;
        decisionCache.set(key, raw);
        return raw;
      });
      inflight.set(key, p);
      p.finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
      pendingByKey.set(key, p);
    }
  }

  // Resolve every item (duplicates share their representative's decision)
  const results = await Promise.all(items.map(async (item) => {
    const raw = await pendingByKey.get(keyOf(item));
    if (raw.error) return { id: item.id, shouldHide: false, confidence: 0, error: true };
    const result = {
      id: item.id,
      shouldHide: raw.violation === true && raw.confidence >= threshold,
      confidence: raw.confidence,
      fromCache: raw.fromCache === true
    };
    if (raw.reason) result.reason = raw.reason;
    if (raw.user) result.user = true;
    return result;
  }));

  // Logging never blocks the response
  const errorCount = results.filter(r => r.error).length;
  if (errorCount > 0) {
    if (Date.now() >= apiCooldownUntil) {
      apiCooldownUntil = Date.now() + API_COOLDOWN_MS;
      addLog({
        level: 'error',
        tag: 'ERROR',
        message: `⚠️ Không đánh giá được ${errorCount} bài viết (lỗi kết nối/API) — KHÔNG lưu cache, sẽ thử lại sau ${API_COOLDOWN_MS / 1000}s.`
      });
    }
    if (!apiFailing) { apiFailing = true; updateHealth(); }
  }

  const decided = results.filter(r => !r.error);
  const cacheHidden = decided.filter(r => r.shouldHide && r.fromCache).length;
  if (cacheHidden > 0) {
    addLog({ level: 'success', tag: 'CACHE', message: `⚡ Ẩn ${cacheHidden} bài từ cache (0 token)` });
  }
  recordStats(decided.length, decided.filter(r => r.shouldHide).length, cacheHits);

  return results;
}

/**
 * One log line per API call (instead of one per post): the popup log stays
 * readable and the logger writes far less.
 */
function logApiBatch(results, sent, threshold, ms) {
  const byId = new Map(sent.map(it => [it.id, it]));
  const ok = results.filter(r => !r.error);
  if (ok.length > 0 && apiFailing) { apiFailing = false; updateHealth(); }

  const hidden = ok.filter(r => r.violation && r.confidence >= threshold);
  hidden.forEach((r) => {
    addLog({
      level: 'success',
      tag: 'ẨN BÀI',
      message: `🛡️ [ĐÃ ẨN] "${author(byId.get(r.id) || {})}"${r.reason ? `: ${r.reason}` : ''} (Độ tin cậy ${r.confidence}%)`
    });
  });
  if (ok.length > 0) {
    addLog({
      level: 'ai',
      tag: 'JEV-AI',
      message: `Jev đã duyệt ${ok.length} bài trong ${ms}ms: ${hidden.length} ẩn, ${ok.length - hidden.length} an toàn`
    });
  }
}
