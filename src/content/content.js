/**
 * Jev AI Facebook Filter - Main Content Script
 * Observes feed changes, manages viewport intersection, coordinates batching,
 * and handles resilient lazy-load text extraction.
 *
 * Privacy: this script only reads PUBLIC settings (never the API key).
 */

(function() {
  const JevFB = window.JevFB;
  if (!JevFB || JevFB.__contentLoaded) return; // guard against double injection
  JevFB.__contentLoaded = true;

  const { DEFAULT_SETTINGS, PUBLIC_SETTING_KEYS } = JevFB;

  function pickPublic(source) {
    const out = {};
    PUBLIC_SETTING_KEYS.forEach(k => { out[k] = source[k] ?? DEFAULT_SETTINGS[k]; });
    return out;
  }

  // Active configuration state (public keys only)
  let config = pickPublic(DEFAULT_SETTINGS);

  let isEngineInitialized = false;
  let viewportObserver = null;
  let mutationObserver = null;
  let heartbeatTimer = null;

  const BATCH_INTERVAL_MS = 80;
  const MAX_BATCH_SIZE = 8;
  const RETRY_DELAY_MS = 450;
  const MAX_RETRIES = 3;
  const RESPONSE_TIMEOUT_MS = 12000; // never leave a post blurred if the worker dies
  const SCAN_THROTTLE_MS = 300;
  const VISIBLE_RECHECK_MS = 1000;
  // Safety net: Facebook often reveals post text through attribute/style changes
  // (hydration, lazy render) that emit no childList mutation. Without a periodic
  // re-scan, posts on the first screen stay unchecked until the user scrolls.
  const HEARTBEAT_MS = 2000;

  /**
   * Per-element state. Keyed by the DOM node, so ids stay unique even when two
   * posts have identical content (same ad twice).
   * @type {WeakMap<HTMLElement, {uid: string, identity?: string, hash?: string,
   *   decidedKey?: string, decision?: object, pending: boolean, seen: boolean, retries: number}>}
   */
  const postState = new WeakMap();
  const tracked = new Set();   // registered post containers (pruned when detached)
  const visible = new Set();   // containers currently near/in the viewport
  const candidateQueue = [];
  let batchTimer = null;
  let uidCounter = 0;

  function getState(el) {
    let st = postState.get(el);
    if (!st) {
      st = { uid: `p${++uidCounter}`, pending: false, seen: false, retries: 0 };
      postState.set(el, st);
    }
    return st;
  }

  /** Decisions are valid for a specific (criteria, threshold) pair. */
  function currentDecisionKey() {
    return `${JevFB.fastHash(config.filterCriteria || '')}|${config.confidenceThreshold}`;
  }

  /**
   * Send log event to Background Logger
   */
  JevFB.log = function(level, tag, message, details) {
    try {
      chrome.runtime.sendMessage({
        action: 'LOG_EVENT',
        log: { level, tag, message, details }
      }).catch(() => {});
    } catch (_) {}
  };

  // 1. Load initial configuration (public keys only)
  chrome.storage.local.get(pickPublic(DEFAULT_SETTINGS), (stored) => {
    config = pickPublic(stored);
    if (config.extensionEnabled) initEngine();
  });

  // 2. React to settings changes directly from storage (popup does not need
  //    to broadcast anything, and the API key never reaches this script).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    const prev = config;
    let publicChanged = false;
    const next = { ...config };
    PUBLIC_SETTING_KEYS.forEach(k => {
      if (k in changes) {
        next[k] = changes[k].newValue ?? DEFAULT_SETTINGS[k];
        publicChanged = true;
      }
    });
    // Only the PRESENCE of a key change matters (a new key/endpoint may make
    // previously skipped posts evaluable) — its value is never read here.
    const credentialsChanged = 'apiKey' in changes || 'apiUrl' in changes;

    if (publicChanged) {
      config = next;
      applyConfigChange(prev);
    } else if (credentialsChanged && config.extensionEnabled && isEngineInitialized) {
      refreshVisible();
    }
  });

  function applyConfigChange(prev) {
    if (!config.extensionEnabled) {
      if (prev.extensionEnabled) disableFiltering();
      return;
    }

    if (!isEngineInitialized) {
      initEngine();
      return;
    }

    if (!prev.extensionEnabled) {
      JevFB.log('info', 'CONFIG', 'Bộ lọc đã BẬT lại trên trang Facebook');
      refreshVisible();
      return;
    }

    if (prev.hideMode !== config.hideMode) {
      rerenderHiddenPosts();
    }

    if (prev.filterCriteria !== config.filterCriteria || prev.confidenceThreshold !== config.confidenceThreshold) {
      JevFB.log('info', 'CONFIG', 'Tiêu chí/ngưỡng lọc đã thay đổi — kiểm tra lại các bài đang hiển thị', {
        criteria: config.filterCriteria ? config.filterCriteria.slice(0, 50) : '(trống)',
        threshold: config.confidenceThreshold
      });
      // Posts on screen are re-checked now (usually 0-token cache hits for a
      // threshold change); off-screen ones are re-checked when they scroll in.
      refreshVisible();
    }
  }

  /** Turning the filter off restores every post immediately. */
  function disableFiltering() {
    candidateQueue.length = 0;
    tracked.forEach(el => {
      JevFB.unhidePost(el);
      delete el.dataset.jevStatus;
      delete el.dataset.jevHideMode;
      const st = postState.get(el);
      if (st) {
        st.decidedKey = undefined;
        st.decision = undefined;
      }
    });
    JevFB.log('info', 'CONFIG', 'Bộ lọc đã TẮT — đã hiển thị lại toàn bộ bài viết');
  }

  function rerenderHiddenPosts() {
    tracked.forEach(el => {
      const st = postState.get(el);
      if (el.dataset.jevStatus === 'hidden' && st && st.decision) {
        JevFB.hidePost(el, st.decision, { hideMode: config.hideMode, criteria: config.filterCriteria });
      }
    });
  }

  function refreshVisible() {
    visible.forEach(el => evaluatePost(el));
  }

  // 3. Viewport Intersection Observer
  function setupViewportObserver() {
    if (viewportObserver) return;

    viewportObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          visible.add(entry.target);
          if (config.extensionEnabled) evaluatePost(entry.target);
        } else {
          visible.delete(entry.target);
        }
      });
    }, {
      rootMargin: '150px 0px' // Decide slightly before the post scrolls into view
    });
  }

  /**
   * Decide whether a post needs (re-)evaluation and queue it.
   * Cheap when nothing changed: same content + same criteria/threshold => no-op.
   * @param {HTMLElement} postEl
   */
  function evaluatePost(postEl) {
    if (!postEl || !postEl.isConnected || !config.extensionEnabled) return;

    let st = getState(postEl);
    if (st.pending) return;

    const postData = JevFB.extractPostData(postEl);

    // Lazy rendering: text not ready yet — retry a few times while visible
    if (!postData || postData.notReady) {
      if (st.retries < MAX_RETRIES) {
        st.retries++;
        setTimeout(() => { if (visible.has(postEl)) evaluatePost(postEl); }, RETRY_DELAY_MS);
      } else if (!postEl.dataset.jevStatus) {
        postEl.dataset.jevStatus = 'skipped';
      }
      return;
    }
    st.retries = 0;

    // F10: Facebook recycled this DOM node for a DIFFERENT post (identity =
    // author + start of body, stable across "See more"/comment loading).
    if (st.identity && st.identity !== postData.identity) {
      JevFB.unhidePost(postEl);
      delete postEl.dataset.jevStatus;
      delete postEl.dataset.jevHideMode;
      postState.delete(postEl);
      st = getState(postEl);
    }
    st.identity = postData.identity;

    const key = currentDecisionKey();
    if (st.hash === postData.hash && st.decidedKey === key) {
      // Up to date — but FB may have re-rendered the post (virtualized scroll)
      // and dropped our banner: re-apply so a hidden post never stays blank.
      if (st.decision && st.decision.shouldHide && config.hideMode !== 'remove' &&
          !postEl.querySelector(':scope > .jev-ui')) {
        delete postEl.dataset.jevHideMode; // force a full re-render in hidePost
        JevFB.hidePost(postEl, st.decision, { hideMode: config.hideMode, criteria: config.filterCriteria });
      }
      return;
    }

    if (!config.filterCriteria || !config.filterCriteria.trim()) {
      postEl.dataset.jevStatus = 'pending_criteria';
      return;
    }

    // Anti-FOUC blur only for posts the user has never seen. Re-checks of
    // posts already on screen (expanded text, new criteria, retry) are silent.
    const firstLook = !st.seen && !st.decidedKey;
    st.pending = true;
    if (firstLook) JevFB.applyAnalyzingState(postEl, config.antiFoucBlur);

    candidateQueue.push({ element: postEl, state: st, data: postData, key });
    scheduleBatchFlush();
  }

  /**
   * Schedule batch dispatch
   */
  function scheduleBatchFlush() {
    if (batchTimer) return;
    batchTimer = setTimeout(flushBatch, BATCH_INTERVAL_MS);
  }

  function sendBatch(payload) {
    return Promise.race([
      chrome.runtime.sendMessage({ action: 'EVALUATE_BATCH', items: payload }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), RESPONSE_TIMEOUT_MS))
    ]);
  }

  /**
   * Flush pending candidates to Background Service Worker
   */
  async function flushBatch() {
    batchTimer = null;
    if (candidateQueue.length === 0) return;

    const currentBatch = candidateQueue.splice(0, MAX_BATCH_SIZE);
    if (candidateQueue.length > 0) scheduleBatchFlush(); // pipeline next batch now

    const payload = currentBatch.map(c => ({
      id: c.state.uid,
      hash: c.data.hash,
      text: c.data.text,
      author: c.data.author
    }));

    let decisions = [];
    try {
      const res = await sendBatch(payload);
      if (Array.isArray(res)) decisions = res;
    } catch (err) {
      console.warn('[JevFB] Lỗi gửi batch:', err && err.message);
    }
    const byId = new Map(decisions.map(d => [d.id, d]));

    currentBatch.forEach(c => applyDecision(c, byId.get(c.state.uid)));
  }

  function applyDecision(candidate, decision) {
    const { element: el, state: st, key } = candidate;
    st.pending = false;
    JevFB.clearAnalyzingState(el);

    // Element recycled/replaced while the request was in flight
    if (postState.get(el) !== st || !el.isConnected) return;

    if (!config.extensionEnabled) {
      if (el.dataset.jevStatus === 'analyzing') delete el.dataset.jevStatus;
      return;
    }

    // No usable decision (API error / not configured / worker gone): show the
    // post, keep it undecided so it is retried later (silently — already seen).
    if (!decision || decision.error || decision.skipped) {
      st.seen = true;
      if (el.dataset.jevStatus === 'analyzing') delete el.dataset.jevStatus;
      return;
    }

    // Settings changed while in flight — the refresh skipped this pending post, re-run it
    if (key !== currentDecisionKey()) {
      if (el.dataset.jevStatus === 'analyzing') delete el.dataset.jevStatus;
      st.seen = true;
      evaluatePost(el);
      return;
    }

    st.hash = candidate.data.hash;
    st.decidedKey = key;
    st.decision = decision;

    if (decision.shouldHide) {
      JevFB.hidePost(el, decision, { hideMode: config.hideMode, criteria: config.filterCriteria });
    } else {
      if (el.dataset.jevStatus === 'hidden') JevFB.unhidePost(el);
      delete el.dataset.jevHideMode;
      el.dataset.jevStatus = 'safe';
      st.seen = true;
    }
  }

  /**
   * Register an element with the IntersectionObserver (idempotent)
   * @param {HTMLElement} el
   */
  function registerPostElement(el) {
    if (!el || tracked.has(el)) return;
    tracked.add(el);
    viewportObserver.observe(el);
  }

  // 4. Page scanning — observes document.body so it keeps working across
  //    Facebook's SPA navigation (Home -> Group -> Profile) without reloads.
  let scanTimer = null;
  let lastVisibleRecheck = 0;
  let recheckTimer = null;

  /** Extension reloaded/updated: this copy is orphaned — stop all work. */
  function isContextAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; }
  }

  function shutdown() {
    if (mutationObserver) mutationObserver.disconnect();
    if (viewportObserver) viewportObserver.disconnect();
    clearInterval(heartbeatTimer);
    candidateQueue.length = 0;
  }

  function scanPage() {
    scanTimer = null;
    if (!isContextAlive()) { shutdown(); return; }
    if (!config.extensionEnabled) return;

    tracked.forEach(el => {
      if (!el.isConnected) {
        tracked.delete(el);
        visible.delete(el);
        viewportObserver.unobserve(el);
      }
    });

    JevFB.getAllPosts().forEach(registerPostElement);

    // Facebook may swap a visible post's content in place (no intersection
    // change) — re-check visible posts at a bounded rate.
    const now = Date.now();
    const sinceLast = now - lastVisibleRecheck;
    if (sinceLast >= VISIBLE_RECHECK_MS) {
      lastVisibleRecheck = now;
      refreshVisible();
    } else if (!recheckTimer) {
      // Trailing re-check so the last change in a burst is never missed
      recheckTimer = setTimeout(() => {
        recheckTimer = null;
        lastVisibleRecheck = Date.now();
        if (config.extensionEnabled) refreshVisible();
      }, VISIBLE_RECHECK_MS - sinceLast);
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(scanPage, SCAN_THROTTLE_MS);
  }

  /**
   * Initialize DOM Watcher
   */
  function initEngine() {
    if (isEngineInitialized) return;
    isEngineInitialized = true;
    JevFB.log('info', 'SCAN', 'Khởi động bộ lọc Jev AI trên trang Facebook', { path: window.location.pathname });

    setupViewportObserver();
    JevFB.getAllPosts().forEach(registerPostElement);

    mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          scheduleScan();
          return;
        }
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') scheduleScan();
    }, HEARTBEAT_MS);
    // Tab restored from background / bfcache: re-check what is on screen now
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleScan();
    });
    window.addEventListener('pageshow', scheduleScan);
  }
})();
