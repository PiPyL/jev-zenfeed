/**
 * Jev AI Filter - Background Service Worker (Manifest V3)
 * Handles Jev batch requests, decision caching (LRU, persisted),
 * request de-duplication, statistics and centralized activity logging.
 */

import { evaluateWithJev, testApiKey } from './jev-client.js';
import { addLog, getLogs, clearLogs } from '../utils/logger.js';
import '../utils/fast-hash.js'; // F12: side-effect import registers self.__jevFastHash
import '../utils/settings-defaults.js'; // F14: side-effect import registers self.__jevDefaults

const simpleHash = self.__jevFastHash;
const { DEFAULT_SETTINGS } = self.__jevDefaults;

// ==================== SETTINGS (in-memory mirror) ====================
// Read once, then kept fresh via storage.onChanged — no storage I/O per batch.

let settings = { ...DEFAULT_SETTINGS };
const settingsReady = chrome.storage.local.get(DEFAULT_SETTINGS).then((s) => { settings = s; });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key in changes) {
      settings[key] = changes[key].newValue ?? DEFAULT_SETTINGS[key];
    }
  }
});

// ==================== DECISION CACHE (LRU) ====================
// Stores RAW { violation, confidence, reason } per `${contentHash}_${criteriaHash}`;
// threshold gating is applied at read time (F3). Map insertion order = recency.

const decisionCache = new Map();
const MAX_CACHE_SIZE = 3000;

// Every cache access awaits this, so entries written after wake-up can never be
// overwritten/evicted by the late-arriving persisted snapshot.
const cacheReady = chrome.storage.local.get('cachedDecisions').then((data) => {
  const stored = data.cachedDecisions || {};
  for (const [k, v] of Object.entries(stored)) decisionCache.set(k, v);
  while (decisionCache.size > MAX_CACHE_SIZE) {
    decisionCache.delete(decisionCache.keys().next().value);
  }
}).catch(console.error);

function cacheGet(key) {
  const value = decisionCache.get(key);
  if (value !== undefined) {
    // Touch: move to most-recent position
    decisionCache.delete(key);
    decisionCache.set(key, value);
  }
  return value;
}

function cacheSet(key, value) {
  decisionCache.delete(key);
  decisionCache.set(key, value);
  while (decisionCache.size > MAX_CACHE_SIZE) {
    decisionCache.delete(decisionCache.keys().next().value);
  }
  persistCache();
}

// Save cache to storage — throttled to at most 1 write per 2s (F15)
let persistTimer = null;
function persistCache() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    chrome.storage.local.set({ cachedDecisions: Object.fromEntries(decisionCache) });
  }, 2000);
}

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
      testApiKey(message.apiKey, message.apiUrl).then((res) => {
        addLog(res.success
          ? { level: 'success', tag: 'KEY', message: `Xác thực API Key thành công với ${message.apiUrl || 'TypeSafe AI'}` }
          : { level: 'error', tag: 'KEY', message: `Xác thực thất bại: ${res.error || 'Không hợp lệ'}` });
        if (res.success) apiCooldownUntil = 0; // connectivity confirmed — allow immediate retries
        sendResponse(res);
      });
      return true;

    case 'EVALUATE_BATCH':
      handleBatchEvaluation(message.items).then(sendResponse, (err) => {
        console.error('[Jev] handleBatchEvaluation failed:', err);
        sendResponse((message.items || []).map(it => ({ id: it.id, shouldHide: false, confidence: 0, error: true })));
      });
      return true;

    case 'CLEAR_CACHE':
      cacheReady.then(() => {
        decisionCache.clear();
        chrome.storage.local.remove('cachedDecisions', () => {
          addLog({ level: 'info', tag: 'CACHE', message: 'Đã xóa toàn bộ bộ nhớ đệm (Cache)!' });
          sendResponse({ success: true });
        });
      });
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
  await Promise.all([settingsReady, cacheReady]);
  const config = settings;

  const skippedAll = () => items.map(it => ({ id: it.id, shouldHide: false, confidence: 0, skipped: true }));

  if (!config.extensionEnabled) return skippedAll();

  if (!config.apiKey || !config.apiKey.trim()) {
    warnThrottled('no-key', {
      level: 'warn',
      tag: 'WARN',
      message: '⚠️ CHƯA CÓ API KEY: Chưa thể lọc bài viết. Vui lòng nhập TypeSafe Jev API Key hoặc bật Mock Server trong Popup.'
    });
    return skippedAll();
  }

  if (!config.filterCriteria || !config.filterCriteria.trim()) {
    warnThrottled('no-criteria', {
      level: 'warn',
      tag: 'WARN',
      message: 'Chưa có tiêu chí lọc bài viết. Vui lòng thiết lập trong Popup.'
    });
    return skippedAll();
  }

  const threshold = config.confidenceThreshold;
  const criteriaHash = simpleHash(config.filterCriteria);
  const keyOf = (item) => `${item.hash}_${criteriaHash}`;

  /** @type {Map<string, Promise<object>>} cacheKey -> promise of RAW decision */
  const pendingByKey = new Map();
  /** @type {Map<string, object>} cacheKey -> representative item to send */
  const toFetch = new Map();
  let cacheHits = 0;

  for (const item of items) {
    const key = keyOf(item);
    if (pendingByKey.has(key) || toFetch.has(key)) continue; // duplicate content in this batch

    const cached = cacheGet(key);
    if (cached) {
      cacheHits++;
      pendingByKey.set(key, Promise.resolve({ ...cached, fromCache: true }));
    } else if (inflight.has(key)) {
      pendingByKey.set(key, inflight.get(key));
    } else {
      toFetch.set(key, item);
    }
  }

  if (toFetch.size > 0) {
    const reps = [...toFetch.values()];
    let apiPromise;

    if (Date.now() < apiCooldownUntil) {
      apiPromise = Promise.resolve(reps.map(it => ({ id: it.id, error: true })));
    } else {
      addLog({
        level: 'ai',
        tag: 'JEV-AI',
        message: `Đang gửi ${reps.length} bài viết đến Jev System One (${config.apiUrl})...`
      });
      apiPromise = evaluateWithJev(config.apiKey, config.apiUrl, reps, config.filterCriteria, threshold);
    }

    const byId = apiPromise.then((results) => new Map(results.map(r => [r.id, r])));

    for (const [key, rep] of toFetch) {
      const p = byId.then((map) => {
        const res = map.get(rep.id) || { error: true };
        if (res.error) return { error: true };
        // F1: only real decisions are cached; F3: cache RAW values
        const raw = { violation: res.violation === true, confidence: res.confidence, reason: res.reason };
        cacheSet(key, raw);
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
    const shouldHide = raw.violation === true && raw.confidence >= threshold;
    return {
      id: item.id,
      shouldHide,
      confidence: raw.confidence,
      reason: raw.reason,
      fromCache: raw.fromCache === true
    };
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
  }
  results.forEach((res, i) => {
    if (res.error) return;
    const item = items[i];
    if (res.shouldHide) {
      addLog(res.fromCache
        ? { level: 'success', tag: 'CACHE', message: `⚡ [Cache Hit] Đã ẩn bài của "${author(item)}": Khớp tiêu chí (${res.confidence}%)` }
        : { level: 'success', tag: 'ẨN BÀI', message: `🛡️ [ĐÃ ẨN] "${author(item)}": ${res.reason || 'Trùng tiêu chí'} (Độ tin cậy ${res.confidence}%)` });
    } else if (!res.fromCache) {
      addLog({ level: 'info', tag: 'AN TOÀN', message: `Bài viết của "${author(item)}": An toàn (${res.confidence}% vi phạm)` });
    }
  });

  const decided = results.filter(r => !r.error);
  recordStats(decided.length, decided.filter(r => r.shouldHide).length, cacheHits);

  return results;
}
