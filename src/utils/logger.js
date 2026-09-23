/**
 * Centralized Logger for Jev AI Facebook Filter
 * Manages ring-buffer activity logs and broadcasts real-time log events to popup.
 *
 * Logs live in chrome.storage.session (survives the worker sleeping, cleared
 * when the browser restarts). Unlike storage.local, session writes are NOT
 * delivered to content scripts' storage.onChanged, so logging no longer costs
 * anything inside open Facebook tabs. The worker keeps an in-memory copy, so
 * each flush is a single write (no read-modify-write).
 */

const MAX_LOGS = 150;
const STORAGE_KEY = 'jevLogs';

const logArea = () => chrome.storage.session || chrome.storage.local;
let memLogs = null; // lazily loaded mirror of the stored logs

async function loadLogs() {
  if (!memLogs) {
    const data = await logArea().get(STORAGE_KEY);
    const stored = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    if (!memLogs) memLogs = stored;
  }
  return memLogs;
}

/**
 * Format date to HH:MM:SS
 * @param {Date} date 
 * @returns {string}
 */
export function formatTime(date = new Date()) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Append a log entry.
 * Entries are buffered and flushed in ONE storage read-modify-write per
 * FLUSH_DELAY_MS window. Flushes are serialized (F13) so concurrent calls never
 * drop entries, and callers never wait on storage I/O on the hot path — the
 * returned promise only resolves once the entry is persisted.
 * @param {Object} entry
 * @param {'info'|'success'|'warn'|'error'|'ai'} [entry.level='info']
 * @param {string} entry.tag - E.g. 'SCAN', 'JEV-AI', 'FILTER', 'CACHE', 'CONFIG', 'WARN', 'ERROR'
 * @param {string} entry.message
 * @param {any} [entry.details]
 * @returns {Promise<Object>} The added log item
 */
const FLUSH_DELAY_MS = 250;
let pending = [];
let flushTimer = null;
let flushChain = Promise.resolve();

export function addLog(entry) {
  const logItem = buildLogItem(entry || {});
  return new Promise((resolve) => {
    pending.push({ logItem, resolve });
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        const batch = pending;
        pending = [];
        flushChain = flushChain.then(() => flushLogs(batch)).catch(() => {});
      }, FLUSH_DELAY_MS);
    }
  });
}

const LEVELS = new Set(['info', 'success', 'warn', 'error', 'ai']);

function buildLogItem({ level = 'info', tag = 'INFO', message = '', details = null }) {
  const safeLevel = LEVELS.has(level) ? level : 'info';
  const logItem = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    time: formatTime(),
    timestamp: Date.now(),
    level: safeLevel,
    tag: String(tag).toUpperCase(),
    message: String(message),
    details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null
  };

  const prefix = `[Jev ${logItem.tag}]`;
  const out = safeLevel === 'error' ? console.error : safeLevel === 'warn' ? console.warn : console.log;
  out(prefix, logItem.message, details || '');
  return logItem;
}

async function flushLogs(batch) {
  // Newest first, matching the popup's display order
  const newItems = batch.map(b => b.logItem).reverse();
  try {
    const merged = newItems.concat(await loadLogs());
    if (merged.length > MAX_LOGS) merged.length = MAX_LOGS;
    memLogs = merged;
    await logArea().set({ [STORAGE_KEY]: merged });

    // Notify any open extension pages (e.g. Popup) in one message
    chrome.runtime.sendMessage({ action: 'NEW_LOG_ENTRIES', logs: newItems }).catch(() => {
      // Ignored: popup might be closed
    });
  } catch (err) {
    console.error('Failed to write log to storage:', err);
  }
  batch.forEach(b => b.resolve(b.logItem));
}

/**
 * Get all stored logs
 * @returns {Promise<Array<Object>>}
 */
export async function getLogs() {
  try {
    await flushChain; // include entries already on their way to storage
    return (await loadLogs()).slice();
  } catch (err) {
    console.error('Failed to read logs:', err);
    return [];
  }
}

/**
 * Clear all stored logs
 * @returns {Promise<boolean>}
 */
export async function clearLogs() {
  try {
    memLogs = [];
    await logArea().remove(STORAGE_KEY);
    // Broadcast clear event
    chrome.runtime.sendMessage({ action: 'LOGS_CLEARED' }).catch(() => {});
    return true;
  } catch (err) {
    console.error('Failed to clear logs:', err);
    return false;
  }
}
