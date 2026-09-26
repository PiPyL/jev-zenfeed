/**
 * Jev AI Filter - Background Service Worker (Manifest V3)
 * Handles Jev batch requests, decision caching (IndexedDB LRU),
 * request de-duplication, statistics, the toolbar badge and centralized
 * activity logging.
 */

import { evaluateWithJev, shouldHidePost, testApiKey } from './jev-client.js';
import * as decisionCache from './decision-cache.js';
import { addLog, getLogs, clearLogs } from '../utils/logger.js';
import '../utils/fast-hash.js'; // F12: side-effect import registers self.__jevFastHash
import '../utils/settings-defaults.js'; // F14: side-effect import registers self.__jevDefaults
import '../utils/providers.js'; // side-effect import registers self.__jevProviders
import '../utils/i18n.js'; // F18: side-effect import registers self.__jevI18n

const simpleHash = self.__jevFastHash;
const { DEFAULT_SETTINGS, filterTopics, criteriaFingerprint, resolvePlatformSettings } = self.__jevDefaults;
const { legacyEndpointMigration, decisionCacheSuffix } = self.__jevProviders;
const { t: i18nT } = self.__jevI18n;

// Which policy a content-script message obeys. Both platforms share this
// worker; the sender's tab URL picks the scope ("Chung · Facebook · Threads").
// Same content + same criteria still share one cache entry — the suffix only
// diverges because the criteria themselves do.
const THREADS_URL_RE = /^https?:\/\/([^/]+\.)?threads\.(com|net)\//i;
function platformOfSender(sender) {
  const url = sender && sender.tab && sender.tab.url ? String(sender.tab.url) : '';
  return THREADS_URL_RE.test(url) ? 'threads' : 'facebook';
}

// One-time cleanup: the cache and logs used to live in storage.local, where
// every write was broadcast to all Facebook tabs.
chrome.storage.local.remove(['cachedDecisions', 'jevLogs']).catch(() => {});

// ==================== SETTINGS (in-memory mirror) ====================
// Read once, then kept fresh via storage.onChanged — no storage I/O per batch.

let settings = { ...DEFAULT_SETTINGS };
const settingsReady = chrome.storage.local.get(['apiKey', 'apiUrl']).then(async (raw) => {
  const migrateTo = legacyEndpointMigration(raw);
  if (migrateTo) await chrome.storage.local.set({ apiUrl: migrateTo });
  settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
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

const hasKey = (config = settings) => !!(config.apiKey && config.apiKey.trim());
const hasCriteria = (config = settings) => filterTopics(config.filterCriteria).length > 0;

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
// Cumulative lifetime counters, written to BOTH storage areas:
//  - storage.session every second: session writes are NOT broadcast to
//    content scripts (unlike storage.local — see decision-cache.js's note),
//    so the popup gets live numbers without waking every Facebook tab;
//  - a snapshot folded into storage.local every 30s so the totals survive
//    browser restarts. After a snapshot the session counters reset, and the
//    popup displays local + session (past runs + current run).
// All writes go through ONE serialized chain, so a session flush and the
// local snapshot never interleave and lose deltas. MV3 may kill the worker
// before the 30s timer fires (e.g. browser closed): the counters accumulated
// in the last <=30s then live on only in storage.session until the next run.

const EMPTY_STATS = { scanned: 0, hidden: 0, cacheHits: 0, deferred: 0 };
const statsDelta = { ...EMPTY_STATS };
let sessionStatsTimer = null;
let localStatsTimer = null;
let statsChain = Promise.resolve();

function enqueueStats(fn) {
  statsChain = statsChain.then(fn).catch(console.error);
  return statsChain;
}

function recordStats(scanned, hidden, cacheHits, deferred = 0) {
  statsDelta.scanned += scanned;
  statsDelta.hidden += hidden;
  statsDelta.cacheHits += cacheHits;
  statsDelta.deferred += deferred;
  if (!sessionStatsTimer) sessionStatsTimer = setTimeout(flushSessionStats, 1000);
  if (!localStatsTimer) localStatsTimer = setTimeout(flushLocalStats, 30000);
}

/** Fold the pending delta into a stats object (mutates it). */
function takeDelta(stats) {
  stats.scanned += statsDelta.scanned;
  // A "not spam" click can reverse a hide whose +1 already went out with an
  // earlier flush — never persist a negative counter.
  stats.hidden = Math.max(0, stats.hidden + statsDelta.hidden);
  stats.cacheHits += statsDelta.cacheHits;
  stats.deferred = (stats.deferred || 0) + statsDelta.deferred;
  statsDelta.scanned = statsDelta.hidden = statsDelta.cacheHits = statsDelta.deferred = 0;
}

function writeSessionStats() {
  return enqueueStats(async () => {
    const data = await chrome.storage.session.get('stats');
    const stats = { ...EMPTY_STATS, ...(data.stats || {}) };
    takeDelta(stats);
    await chrome.storage.session.set({ stats });
  });
}

function snapshotLocalStats() {
  return enqueueStats(async () => {
    const [sess, loc] = await Promise.all([
      chrome.storage.session.get('stats'),
      chrome.storage.local.get('stats')
    ]);
    if (!sess.stats) return;
    const stats = { ...EMPTY_STATS, ...(loc.stats || {}) };
    stats.scanned += sess.stats.scanned || 0;
    stats.hidden += sess.stats.hidden || 0;
    stats.cacheHits += sess.stats.cacheHits || 0;
    stats.deferred = (stats.deferred || 0) + (sess.stats.deferred || 0);
    await chrome.storage.local.set({ stats });
    // Session restarts from zero: the popup sums local + session.
    await chrome.storage.session.set({ stats: { ...EMPTY_STATS } });
  });
}

function flushSessionStats() {
  sessionStatsTimer = null;
  writeSessionStats();
}

function flushLocalStats() {
  localStatsTimer = null;
  snapshotLocalStats();
}

/** Test hook: force the persistent snapshot through the same chain. */
export function __flushStatsForTest() {
  return snapshotLocalStats();
}

/**
 * UX_METRIC: how many times the content script delayed collapsing a
 * violating post while it was in the user's reading zone (see content.js
 * `applyHideDecision`). This is not a frame-rate or jank measurement. Folded
 * into the same debounced `stats` write as everything else, never written
 * directly from the content script (see decision-cache.js's own note on why
 * storage.local writes from a tab broadcast to every other Facebook tab).
 */
function recordDeferred(n) {
  if (Number.isInteger(n) && n > 0) recordStats(0, 0, 0, n);
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
// extension is installed/reloaded. Inject into tabs already open (Facebook,
// Threads, ...) so filtering starts without the user having to refresh.

/** Every supported URL pattern across all content_scripts entries. */
function allContentScriptMatches() {
  return [...new Set((chrome.runtime.getManifest().content_scripts || [])
    .flatMap(cs => cs.matches || []))];
}

chrome.runtime.onInstalled.addListener(async () => {
  // Query per entry and let Chrome apply its own match patterns — the
  // per-platform match sets are disjoint, so each tab gets exactly its
  // platform's selector/extractor pair injected.
  const entries = chrome.runtime.getManifest().content_scripts || [];
  for (const cs of entries) {
    if (!cs.matches?.length) continue;
    const tabs = await chrome.tabs.query({ url: cs.matches });
    for (const tab of tabs) {
      const target = { tabId: tab.id };
      try {
        if (cs.css?.length) await chrome.scripting.insertCSS({ target, files: cs.css });
        await chrome.scripting.executeScript({ target, files: cs.js });
      } catch (err) {
        console.warn('[Jev] Could not inject into tab', tab.id, err && err.message);
      }
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
          ? { level: 'success', tag: 'KEY', key: 'logKeyOk', params: { endpoint: String(message.apiUrl || 'TypeSafe AI') } }
          : { level: 'error', tag: 'KEY', key: 'logKeyFail', params: { error: String(res.error || 'Invalid') } });
        if (res.success) {
          apiCooldownUntil = 0; // connectivity confirmed — allow immediate retries
          apiFailing = false;
          updateHealth();
        }
        sendResponse(res);
      });
      return true;

    case 'EVALUATE_BATCH':
      handleBatchEvaluation(message.items, makePartialSender(sender), platformOfSender(sender)).then(sendResponse, (err) => {
        console.error('[Jev] handleBatchEvaluation failed:', err);
        sendResponse((message.items || []).map(it => ({ id: it.id, shouldHide: false, confidence: 0, error: true })));
      });
      return true;

    case 'MARK_SAFE':
      markSafe(message, sender).then(sendResponse, () => sendResponse({ success: false }));
      return true;

    case 'UX_METRIC':
      recordDeferred(message.deferred);
      return false;

    case 'TAB_STATUS':
      if (sender.tab && Number.isInteger(message.hidden) && message.hidden >= 0) {
        tabHidden.set(sender.tab.id, message.hidden);
        renderBadge(sender.tab.id);
      }
      return false;

    case 'CLEAR_CACHE':
      // Existing callers may finish, but new calls must not join them and
      // their results must not repopulate the cache after this clear.
      inflight.clear();
      decisionCache.clear().then(() => {
        // Tabs keep a local copy of hot decisions — drop those too
        chrome.tabs.query({ url: allContentScriptMatches() }).then((tabs) => {
          tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { action: 'CACHE_CLEARED' }).catch(() => {}));
        }).catch(() => {});
        addLog({ level: 'info', tag: 'CACHE', key: 'logCacheCleared' });
        sendResponse({ success: true });
      }, () => sendResponse({ success: false }));
      return true;

    case 'GET_LOGS':
      getLogs().then(sendResponse);
      return true;

    case 'CLEAR_LOGS':
      clearLogs().then(sendResponse);
      return true;

    case 'GET_HOT_DECISIONS':
      settingsReady.then(async () => {
        const config = resolvePlatformSettings(settings, platformOfSender(sender));
        const criteriaHash = criteriaKeyHash(config);
        const entries = await decisionCache.recent(decisionSuffix(config), 500);
        sendResponse({ criteriaHash, entries });
      }).catch(() => sendResponse({ criteriaHash: '', entries: [] }));
      return true;

    case 'LOCAL_STATS':
      // Decisions the content script resolved from its own local cache
      if (Number.isInteger(message.scanned) && message.scanned > 0) {
        recordStats(message.scanned, Math.max(0, message.hidden | 0), message.scanned);
      }
      return false;

    case 'LOG_EVENT':
      { // fire-and-forget; only i18n keys + params are accepted from content scripts
        const log = message.log || {};
        addLog({ level: log.level, tag: log.tag, key: log.key, params: log.params, details: log.details });
      }
      return false;
  }
});

// ==================== USER FEEDBACK ====================

const criteriaKeyHash = (config = settings) => simpleHash(criteriaFingerprint(config.filterCriteria, config.whitelistCriteria));
const decisionSuffix = (config = settings) => decisionCacheSuffix(criteriaKeyHash(config), config.apiUrl);

/**
 * "Ẩn nhầm": the user says this content must not be hidden under the current
 * criteria. Stored as a user override in the decision cache — never re-sent
 * to the API, applies to every copy of the same content in every tab.
 */
async function markSafe(message, sender) {
  const hash = typeof message.hash === 'string' ? message.hash : '';
  if (!/^[0-9a-f]{1,16}$/.test(hash)) return { success: false };
  await settingsReady;
  // The override lands under the SENDING platform's criteria hash, so a
  // "not spam" click on a customized Threads never spares the post on Facebook.
  const config = resolvePlatformSettings(settings, platformOfSender(sender));
  decisionCache.set(`${hash}${decisionSuffix(config)}`, { violation: false, confidence: 0, user: true });
  const author = typeof message.author === 'string' ? message.author.slice(0, 80) : 'Unknown';
  addLog({ level: 'info', tag: 'FEEDBACK', key: 'logFeedback', params: { author } });
  if (sender.tab) recordStats(0, -1, 0);
  return { success: true };
}

// ==================== BATCH EVALUATION ====================

/**
 * Push cache-hit decisions to the requesting tab as soon as they are known,
 * so they never wait for the API call made for the other posts of the batch.
 * The final response still carries every item; the content script ignores
 * ids it already applied.
 */
function makePartialSender(sender) {
  if (!sender.tab || !chrome.tabs || !chrome.tabs.sendMessage) return null;
  const opts = Number.isInteger(sender.frameId) ? { frameId: sender.frameId } : undefined;
  return (decisions) => {
    if (decisions.length === 0) return;
    try {
      const p = chrome.tabs.sendMessage(sender.tab.id, { action: 'PARTIAL_DECISIONS', decisions }, opts);
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  };
}

// Requests currently on the wire, keyed by cache key. A post that appears in
// several batches/tabs at once (same ad twice, two tabs) is only paid for once.
const inflight = new Map();
const MAX_CONCURRENT_API_REQUESTS = 2;
let activeApiRequests = 0;
const apiRequestQueue = [];
const MAX_QUEUE_WAIT_MS = 9000; // content script times out at 12s

function drainApiRequestQueue() {
  while (activeApiRequests < MAX_CONCURRENT_API_REQUESTS && apiRequestQueue.length > 0) {
    const job = apiRequestQueue.shift();
    // The content script gave up on this request long ago — don't spend an
    // API call (and a slot) on results nobody is waiting for.
    if (Date.now() - job.queuedAt > MAX_QUEUE_WAIT_MS) { job.resolve(job.expire()); continue; }
    activeApiRequests++;
    Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => {
      activeApiRequests--;
      drainApiRequestQueue();
    });
  }
}

function queueApiRequest(run, expire) {
  return new Promise((resolve, reject) => {
    apiRequestQueue.push({ run, expire, resolve, reject, queuedAt: Date.now() });
    drainApiRequestQueue();
  });
}

// After an API failure, fail fast for a short window instead of hammering a
// down/blocked endpoint on every scroll (posts are retried after it expires).
const API_COOLDOWN_MS = 10000;
let apiCooldownUntil = 0;

const author = (item) => item.author || 'Unknown';

/**
 * Process a batch of post candidates from Content Script.
 * Item ids are unique per DOM element; `hash` identifies the content, so
 * duplicate content is evaluated once and fanned out to every element.
 *
 * Result flags: `error` = transient failure (retry later, never cached);
 * `skipped` = filter not configured/disabled (re-check once configured).
 * @param {Array<{id: string, hash: string, text: string, author?: string}>} items
 * @param {((decisions: object[]) => void)|null} onPartial
 * @param {string} [platform='facebook'] sender's platform — picks Chung or its own profile
 */
async function handleBatchEvaluation(items, onPartial = null, platform = 'facebook') {
  if (!Array.isArray(items) || items.length === 0) return [];
  await settingsReady;
  const config = { ...resolvePlatformSettings(settings, platform) };

  const skippedAll = () => items.map(it => ({ id: it.id, shouldHide: false, confidence: 0, skipped: true }));

  if (!config.extensionEnabled) return skippedAll();

  if (!hasKey(config)) {
    warnThrottled('no-key', {
      level: 'warn',
      tag: 'WARN',
      key: 'logNoKey'
    });
    return skippedAll();
  }

  if (!hasCriteria(config)) {
    warnThrottled('no-criteria', {
      level: 'warn',
      tag: 'WARN',
      key: 'logNoCriteria'
    });
    return skippedAll();
  }

  const threshold = config.confidenceThreshold;
  // Fence the whole operation from the start. If the cache is cleared while
  // getMany is waiting on IndexedDB, this batch must not repopulate it.
  const generationAtStart = decisionCache.getGeneration();
  const suffix = decisionSuffix(config);
  const keyOf = (item) => `${item.hash}${suffix}`;

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

  if (onPartial && cacheHits > 0) {
    const early = [];
    for (const item of items) {
      const hit = cached.get(keyOf(item));
      if (hit) early.push(buildResult(item.id, { ...hit, fromCache: true }, threshold));
    }
    onPartial(early);
  }

  if (toFetch.size > 0) {
    const sending = [...toFetch.values()];
    const apiPromise = queueApiRequest(() => {
      if (generationAtStart !== decisionCache.getGeneration()) {
        return sending.map(it => ({ id: it.id, error: true }));
      }
      if (Date.now() < apiCooldownUntil) {
        return sending.map(it => ({ id: it.id, error: true }));
      }
      const startedAt = Date.now();
      return evaluateWithJev(config.apiKey, config.apiUrl, sending, config.filterCriteria, threshold, config.whitelistCriteria)
        .then((results) => {
          logApiBatch(results, sending, threshold, Date.now() - startedAt);
          // Cooldown only for a whole-call failure (network/HTTP). A single
          // unparsable answer must not stall filtering of every other post.
          if (results.length > 0 && results.every(r => r.error) && Date.now() >= apiCooldownUntil) {
            apiCooldownUntil = Date.now() + API_COOLDOWN_MS;
            if (!apiFailing) { apiFailing = true; updateHealth(); }
          }
          return results;
        });
    }, () => sending.map(it => ({ id: it.id, error: true })));

    const byId = apiPromise.then((results) => new Map(results.map(r => [r.id, r])));

    for (const [key, rep] of toFetch) {
      const p = byId.then((map) => {
        const res = map.get(rep.id) || { error: true };
        if (res.error) return { error: true };
        // F1: only real decisions are cached; F3: cache RAW values
        const raw = { violation: res.violation === true, confidence: res.confidence };
        if (Number.isFinite(res.whitelistConfidence)) raw.whitelistConfidence = res.whitelistConfidence;
        if (res.reason) raw.reason = res.reason;
        decisionCache.set(key, raw, generationAtStart);
        return raw;
      });
      inflight.set(key, p);
      const clearInflight = () => { if (inflight.get(key) === p) inflight.delete(key); };
      p.then(clearInflight, clearInflight);
      pendingByKey.set(key, p);
    }
  }

  // Resolve every item (duplicates share their representative's decision)
  const results = await Promise.all(items.map(async (item) => {
    return buildResult(item.id, await pendingByKey.get(keyOf(item)), threshold);
  }));

  if (generationAtStart !== decisionCache.getGeneration()) {
    return items.map(item => ({ id: item.id, shouldHide: false, confidence: 0, error: true }));
  }

  // Logging never blocks the response
  const errorCount = results.filter(r => r.error).length;
  if (errorCount > 0) {
    warnThrottled('eval-error', {
      level: 'error',
      tag: 'ERROR',
      key: 'logEvalError',
      params: { n: errorCount }
    }, API_COOLDOWN_MS);
  }

  const decided = results.filter(r => !r.error);
  const cacheHidden = decided.filter(r => r.shouldHide && r.fromCache).length;
  if (cacheHidden > 0) {
    addLog({ level: 'success', tag: 'CACHE', key: 'logCacheHidden', params: { n: cacheHidden } });
  }
  recordStats(decided.length, decided.filter(r => r.shouldHide).length, cacheHits);

  return results;
}

function buildResult(id, raw, threshold) {
  if (raw.error) return { id, shouldHide: false, confidence: 0, error: true };
  const result = {
    id,
    shouldHide: shouldHidePost(raw.violation === true, raw.confidence, threshold, raw.whitelistConfidence),
    confidence: raw.confidence,
    // raw verdict: lets the content script re-gate it locally (threshold/whitelist)
    violation: raw.violation === true,
    fromCache: raw.fromCache === true
  };
  if (Number.isFinite(raw.whitelistConfidence)) result.whitelistConfidence = raw.whitelistConfidence;
  if (raw.reason) result.reason = raw.reason;
  if (raw.user) result.user = true;
  return result;
}

/**
 * One log line per API call (instead of one per post): the popup log stays
 * readable and the logger writes far less.
 */
function logApiBatch(results, sent, threshold, ms) {
  const byId = new Map(sent.map(it => [it.id, it]));
  const ok = results.filter(r => !r.error);
  if (ok.length > 0 && apiFailing) { apiFailing = false; updateHealth(); }

  const hidden = ok.filter(r => shouldHidePost(r.violation === true, r.confidence, threshold, r.whitelistConfidence));
  hidden.forEach((r) => {
    addLog({
      level: 'success',
      tag: 'HIDDEN',
      key: r.reason ? 'logHiddenReason' : 'logHidden',
      params: { author: author(byId.get(r.id) || {}), reason: r.reason || '', pct: r.confidence }
    });
  });
  if (ok.length > 0) {
    addLog({
      level: 'ai',
      tag: 'JEV-AI',
      key: 'logBatch',
      params: { n: ok.length, ms, hidden: hidden.length, safe: ok.length - hidden.length }
    });
  }
}
