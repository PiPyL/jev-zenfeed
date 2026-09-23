/**
 * Persistent decision cache (service worker).
 *
 * Why IndexedDB instead of chrome.storage.local:
 *  - storage.local had to rewrite the WHOLE cache (~300 KB for 3000 entries)
 *    on every flush, and every write fired storage.onChanged — with old AND
 *    new values — inside the content script of every open Facebook tab.
 *  - After the worker slept (~30 s idle) the first batch had to wait for the
 *    whole blob to be read back. Here a batch reads only the keys it needs.
 *
 * Records are compact: { v: 0|1, c: confidence%, w?: whitelist confidence%,
 * r?: reason, u?: 1 (user override), t: last-used ms }. Threshold gating is
 * applied by the caller.
 * Falls back to an in-memory store where IndexedDB does not exist (Node tests).
 */

const DB_NAME = 'jev-filter';
const STORE = 'decisions';
const MAX_ENTRIES = 5000;
const MEM_MAX = 1000;              // hot in-memory LRU in front of the DB
const FLUSH_DELAY_MS = 1000;
const TOUCH_AFTER_MS = 60 * 60 * 1000; // refresh LRU time at most hourly per entry

const hasIDB = typeof indexedDB !== 'undefined';
const fallbackStore = new Map();   // used only when IndexedDB is unavailable

const mem = new Map();             // key -> record (insertion order = recency)
const dirty = new Map();           // key -> record waiting to be written
let flushTimer = null;
let dbPromise = null;
let cacheGeneration = 0;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE).createIndex('t', 't');
        } else {
          // Version 1 did not preserve the separate whitelist score. Its
          // cached combined boolean cannot be re-gated safely, so discard it.
          req.transaction.objectStore(STORE).clear();
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((err) => {
      console.error('[Jev] IndexedDB unavailable, cache is memory-only:', err);
      dbPromise = null;
      return null;
    });
  }
  return dbPromise;
}

const txDone = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = tx.onabort = () => reject(tx.error);
});

function memPut(key, record) {
  mem.delete(key);
  mem.set(key, record);
  if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value);
}

function toDecision(record) {
  const d = { violation: record.v === 1, confidence: record.c };
  if (Number.isFinite(record.w)) d.whitelistConfidence = record.w;
  if (record.r) d.reason = record.r;
  if (record.u) d.user = true;
  return d;
}

function scheduleFlush() {
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

/**
 * Look up several keys at once (one read transaction for all misses).
 * @param {string[]} keys
 * @returns {Promise<Map<string, {violation: boolean, confidence: number, reason?: string, user?: boolean}>>}
 */
export async function getMany(keys) {
  const found = new Map();
  const misses = [];
  const now = Date.now();
  const generationAtStart = cacheGeneration;

  for (const key of keys) {
    const rec = mem.get(key);
    if (rec) {
      memPut(key, rec);
      if (now - (rec.t || 0) > TOUCH_AFTER_MS) {
        const touched = { ...rec, t: now };
        memPut(key, touched);
        dirty.set(key, touched);
        scheduleFlush();
      }
      found.set(key, toDecision(rec));
    } else {
      misses.push(key);
    }
  }
  if (misses.length === 0) return found;

  let records = [];
  if (!hasIDB) {
    records = misses.map(k => fallbackStore.get(k));
  } else {
    const db = await openDb();
    if (db) {
      try {
        const store = db.transaction(STORE, 'readonly').objectStore(STORE);
        records = await Promise.all(misses.map(k => new Promise((resolve) => {
          const req = store.get(k);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        })));
      } catch (err) {
        console.error('[Jev] Cache read failed:', err);
      }
    }
  }

  // A cache clear can race the IndexedDB read. Do not repopulate memory or
  // return pre-clear records after the user explicitly cleared the cache.
  if (generationAtStart !== cacheGeneration) return new Map();

  misses.forEach((key, i) => {
    const rec = records[i];
    if (!rec) return;
    memPut(key, rec);
    found.set(key, toDecision(rec));
    if (now - (rec.t || 0) > TOUCH_AFTER_MS) {
      dirty.set(key, { ...rec, t: now });
      scheduleFlush();
    }
  });
  return found;
}

/**
 * Store a real decision (never call this for error results).
 * @param {string} key
 * @param {{violation: boolean, confidence: number, reason?: string, user?: boolean}} decision
 */
export function set(key, decision, expectedGeneration = cacheGeneration) {
  if (expectedGeneration !== cacheGeneration) return false;
  const record = { v: decision.violation ? 1 : 0, c: decision.confidence, t: Date.now() };
  if (Number.isFinite(decision.whitelistConfidence)) record.w = decision.whitelistConfidence;
  if (decision.reason) record.r = decision.reason;
  if (decision.user) record.u = 1;
  memPut(key, record);
  dirty.set(key, record);
  scheduleFlush();
  return true;
}

export function getGeneration() {
  return cacheGeneration;
}

/** Write pending records in ONE transaction, then prune the oldest if over capacity. */
export async function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;
  if (dirty.size === 0) return;
  const generationAtStart = cacheGeneration;
  const batch = [...dirty];
  dirty.clear();

  if (!hasIDB) {
    batch.forEach(([k, r]) => fallbackStore.set(k, r));
    while (fallbackStore.size > MAX_ENTRIES) fallbackStore.delete(fallbackStore.keys().next().value);
    return;
  }

  const db = await openDb();
  if (!db || generationAtStart !== cacheGeneration) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    batch.forEach(([k, r]) => store.put(r, k));
    const countReq = store.count();
    await txDone(tx);
    if (countReq.result > MAX_ENTRIES) await prune(db, countReq.result - Math.floor(MAX_ENTRIES * 0.9));
  } catch (err) {
    console.error('[Jev] Cache write failed:', err);
  }
}

/** Delete the `n` least-recently-used records. */
function prune(db, n) {
  const tx = db.transaction(STORE, 'readwrite');
  const cursorReq = tx.objectStore(STORE).index('t').openCursor();
  let left = n;
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (!cursor || left <= 0) return;
    mem.delete(cursor.primaryKey);
    cursor.delete();
    left--;
    cursor.continue();
  };
  return txDone(tx);
}

export async function clear() {
  cacheGeneration++;
  clearTimeout(flushTimer);
  flushTimer = null;
  mem.clear();
  dirty.clear();
  if (!hasIDB) {
    fallbackStore.clear();
    return;
  }
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await txDone(tx);
}

/** Test hook: keys persisted by the fallback (non-IndexedDB) store. */
export function persistedKeysForTest() {
  return [...fallbackStore.keys()];
}
