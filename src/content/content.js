/**
 * Jev AI Facebook Filter - Main Content Script
 * Observes feed changes, manages viewport intersection, coordinates batching,
 * and handles resilient lazy-load text extraction.
 *
 * Privacy: this script only reads PUBLIC settings (never the API key).
 *
 * UX review (2026-09): a post confirmed while it is in the reading area stays
 * in place until it leaves. Two independent IntersectionObservers do the work:
 *  - `viewportObserver` — the existing look-ahead/prefetch signal (adaptive
 *    margin, grows with scroll speed) that decides WHEN to ask the AI.
 *  - `readingZoneObserver` — a tighter signal (top ~65% of the viewport,
 *    where the eye actually reads) used only to decide HOW to show a
 *    violation: collapse immediately if the post isn't there, otherwise blur
 *    in place / label quietly and defer the real collapse until it leaves.
 * See `applyHideDecision` for the full decision matrix.
 */

(function() {
  const JevFB = window.JevFB;
  if (!JevFB || JevFB.__contentLoaded) return; // guard against double injection
  JevFB.__contentLoaded = true;

  const { DEFAULT_SETTINGS, PUBLIC_SETTING_KEYS, criteriaTopics, criteriaFingerprint } = JevFB;

  function pickPublic(source) {
    const out = {};
    PUBLIC_SETTING_KEYS.forEach(k => { out[k] = source[k] ?? DEFAULT_SETTINGS[k]; });
    return out;
  }

  // Active configuration state (public keys only)
  let config = pickPublic(DEFAULT_SETTINGS);

  let isEngineInitialized = false;
  let viewportObserver = null;
  let readingZoneObserver = null;
  let mutationObserver = null;
  let heartbeatTimer = null;

  const BATCH_INTERVAL_MS = 80;
  const MAX_BATCH_SIZE = 12;
  const RETRY_DELAY_MS = 450;
  const MAX_RETRIES = 3;
  const RESPONSE_TIMEOUT_MS = 12000; // never leave a post blurred if the worker dies
  const SCAN_THROTTLE_MS = 300;
  const VISIBLE_RECHECK_MS = 4000;
  const HEARTBEAT_MS = 2000;
  const BADGE_REPORT_MS = 400;
  // Belt-and-braces full rescan cadence. Routine insertions are resolved from
  // their added subtree; this catches route or in-place swaps with no useful
  // mutation root.
  const FULL_RESCAN_MS = 30000;
  // "See more" / late alt text: re-evaluate only if the text grew materially.
  const EXPAND_MIN_CHARS = 80;
  const EXPAND_MIN_RATIO = 0.2;

  // Look-ahead/look-behind margin for the AI call, adaptive to scroll speed
  // (index into PREFETCH_MARGINS below): decide about a screen or more ahead
  // so posts are usually resolved before the user reaches them, without
  // over-prefetching (and over-spending tokens/CPU) while reading slowly. The
  // TOP margin stays fixed at 100% regardless of speed — a post the user just
  // scrolled past must stay in `visible` for a while, or a criteria/threshold
  // change made right after scrolling would never reach it (refreshVisible()
  // only re-checks the current `visible` set).
  const PREFETCH_MARGINS = ['100% 0px 100% 0px', '100% 0px 200% 0px', '100% 0px 350% 0px'];
  const SCROLL_SPEED_FAST = 2500;   // px/s
  const SCROLL_SPEED_MEDIUM = 600;  // px/s

  // "Reading zone": the top portion of the viewport where the eye actually
  // reads while scrolling down. A post only peeking in at the bottom edge, or
  // already scrolled above, is NOT in it — collapsing those never disturbs
  // what the user is looking at.
  const READING_ZONE_TOP_FRACTION = 0.65;
  const READING_ZONE_MARGIN = '0px 0px -35% 0px';
  // How long a post must have sat continuously in the reading zone before we
  // consider it "already read" — at that point hiding it is more disruptive
  // than useful, so we switch from blur-in-place to a quiet label.
  const CLEAR_SEEN_MS = 700;

  /**
   * Per-element state. Keyed by the DOM node, so ids stay unique even when two
   * posts have identical content (same ad twice).
   * @type {WeakMap<HTMLElement, {uid: string, identity?: {author: string, head: string}, hash?: string, textLen?: number,
   *   sig?: string, decidedKey?: string, decision?: object, pending: boolean, retries: number,
   *   inReadingZone?: boolean, readingZoneSince: number, interacted: boolean, pendingCollapse: boolean}>}
   */
  const postState = new WeakMap();
  const tracked = new Set();   // registered post containers (pruned when detached)
  const visible = new Set();   // containers currently within the prefetch margin
  const candidateQueue = [];
  let batchTimer = null;
  let immediateBatchFlushScheduled = false;
  let uidCounter = 0;

  function getState(el) {
    let st = postState.get(el);
    if (!st) {
      st = {
        uid: `p${++uidCounter}`, pending: false, retries: 0,
        inReadingZone: undefined, readingZoneSince: 0, interacted: false, pendingCollapse: false
      };
      postState.set(el, st);
    }
    return st;
  }

  /**
   * Decisions are valid for a specific (criteria, threshold) pair.
   * Memoized: recomputed only when `config` is reassigned (storage load /
   * onChanged), not on every evaluatePost — this sits on the hottest path
   * (per post, per intersection event and per visible re-check).
   */
  let decisionKeyCache = null;
  function currentDecisionKey() {
    if (decisionKeyCache === null) {
      decisionKeyCache = `${JevFB.fastHash(criteriaFingerprint(config.filterCriteria, config.whitelistCriteria))}|${config.confidenceThreshold}`;
    }
    return decisionKeyCache;
  }

  /**
   * Cheap change detector for a post card: while it is unchanged, periodic
   * re-checks skip text extraction + hashing entirely.
   */
  function signatureOf(el) {
    const text = el.textContent;
    return `${text.length}:${el.getElementsByTagName('img').length}:${text.slice(0, 80)}`;
  }

  function clearSeenMs(st) {
    if (!st.inReadingZone || !st.readingZoneSince) return 0;
    return performance.now() - st.readingZoneSince;
  }

  /**
   * A brand-new (or just-recycled) post has no reading-zone reading yet — the
   * observer's next crossing event might be seconds away if the post already
   * sits still inside the zone. Derive it once, synchronously, so the very
   * first decision for this element isn't wrongly treated as "off screen".
   */
  function syncZoneStateNow(el, st) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const inZone = r.bottom > 0 && r.top < vh * READING_ZONE_TOP_FRACTION;
    st.inReadingZone = inZone;
    st.readingZoneSince = inZone ? performance.now() : 0;
  }

  // ---- Toolbar badge: number of hidden posts in this tab ----
  let badgeTimer = null;
  let lastReportedHidden = -1;

  function reportHiddenCount() {
    if (badgeTimer) return;
    badgeTimer = setTimeout(() => {
      badgeTimer = null;
      let hidden = 0;
      if (config.extensionEnabled) {
        tracked.forEach(el => { if (el.isConnected && el.dataset.jevStatus === 'hidden') hidden++; });
      }
      if (hidden === lastReportedHidden) return;
      lastReportedHidden = hidden;
      try {
        chrome.runtime.sendMessage({ action: 'TAB_STATUS', hidden }).catch(() => {});
      } catch (_) {}
    }, BADGE_REPORT_MS);
  }

  // ---- Deferred-hide metric: how many times a violation stayed in place
  // while on screen (batched to background, like the badge above, so we
  // never write chrome.storage.local directly from a content script — see
  // decision-cache.js's own note on why that broadcasts to every FB tab). ----
  let deferredSinceReport = 0;
  let deferredTimer = null;
  function reportDeferred() {
    deferredSinceReport++;
    if (deferredTimer) return;
    deferredTimer = setTimeout(() => {
      deferredTimer = null;
      const n = deferredSinceReport;
      deferredSinceReport = 0;
      try {
        chrome.runtime.sendMessage({ action: 'UX_METRIC', deferred: n }).catch(() => {});
      } catch (_) {}
    }, BADGE_REPORT_MS);
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
    decisionKeyCache = null;
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
      decisionKeyCache = null;
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
      // Posts added while the filter was OFF were never registered (the
      // observer early-returns when disabled) — force a registration walk.
      fullScanRequested = true;
      scheduleScan();
      refreshVisible();
      return;
    }

    if (prev.hideMode !== config.hideMode) {
      rerenderHiddenPosts();
    }

    if (criteriaFingerprint(prev.filterCriteria, prev.whitelistCriteria) !==
        criteriaFingerprint(config.filterCriteria, config.whitelistCriteria) ||
        prev.confidenceThreshold !== config.confidenceThreshold) {
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
        st.sig = undefined;
        st.pendingCollapse = false;
        st.interacted = false;
      }
    });
    reportHiddenCount();
    JevFB.log('info', 'CONFIG', 'Bộ lọc đã TẮT — đã hiển thị lại toàn bộ bài viết');
  }

  function rerenderHiddenPosts() {
    tracked.forEach(el => {
      const st = postState.get(el);
      const deferredMode = el.dataset.jevHideMode === 'soft' || el.dataset.jevHideMode === 'reading-blur';
      if (el.dataset.jevStatus === 'hidden' && !deferredMode && st && st.decision) {
        JevFB.hidePost(el, st.decision, hideOpts());
      }
    });
  }

  function refreshVisible() {
    visible.forEach(el => evaluatePost(el));
  }

  // 3. Viewport intersection: WHEN to ask the AI (adaptive look-ahead) and
  //    WHERE the reading zone currently is (for the hide decision).
  function onViewportEntries(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        visible.add(entry.target);
        if (typeof JevFB.resumeBlurEffects === 'function') JevFB.resumeBlurEffects(entry.target);
        if (config.extensionEnabled) evaluatePost(entry.target);
      } else {
        visible.delete(entry.target);
        if (!entry.target.isConnected && tracked.delete(entry.target)) {
          unregisterPostElement(entry.target);
          reportHiddenCount();
        }
      }
    });
  }

  function onReadingZoneEntries(entries) {
    entries.forEach(entry => {
      const el = entry.target;
      const st = getState(el);
      if (entry.isIntersecting) {
        if (!st.inReadingZone) st.readingZoneSince = performance.now();
        st.inReadingZone = true;
      } else {
        st.inReadingZone = false;
        st.readingZoneSince = 0;
        if (st.pendingCollapse) finalizeDeferredCollapse(el, st);
      }
    });
  }

  function recreateViewportObserver(margin) {
    if (viewportObserver) viewportObserver.disconnect();
    visible.clear();
    viewportObserver = new IntersectionObserver(onViewportEntries, { rootMargin: margin });
    tracked.forEach(el => { if (el.isConnected) viewportObserver.observe(el); });
  }

  // Adaptive look-ahead: use separate enter/exit thresholds so noisy scroll
  // samples near a boundary do not repeatedly recreate the observer.
  let scrollMarginBucket = 0;
  let lastScrollY = 0;
  let lastScrollT = 0;
  let scrollSpeedEma = 0;

  function onScroll() {
    const now = performance.now();
    if (lastScrollT === 0) { lastScrollT = now; lastScrollY = window.scrollY; return; }
    const dt = now - lastScrollT;
    if (dt < 120) return; // sample at a bounded rate, not every scroll event
    const dy = Math.abs(window.scrollY - lastScrollY);
    scrollSpeedEma = scrollSpeedEma * 0.6 + (dy / (dt / 1000)) * 0.4;
    lastScrollY = window.scrollY;
    lastScrollT = now;

    let bucket = scrollMarginBucket;
    if (scrollMarginBucket === 0 && scrollSpeedEma > SCROLL_SPEED_MEDIUM + 100) bucket = 1;
    else if (scrollMarginBucket === 1) {
      if (scrollSpeedEma > SCROLL_SPEED_FAST + 300) bucket = 2;
      else if (scrollSpeedEma < SCROLL_SPEED_MEDIUM - 150) bucket = 0;
    } else if (scrollMarginBucket === 2 && scrollSpeedEma < SCROLL_SPEED_FAST - 500) {
      bucket = scrollSpeedEma < SCROLL_SPEED_MEDIUM - 150 ? 0 : 1;
    }
    if (bucket !== scrollMarginBucket) {
      scrollMarginBucket = bucket;
      recreateViewportObserver(PREFETCH_MARGINS[bucket]);
    }
  }

  /** When the user stops scrolling, don't make a post that's already on
   *  screen wait out the normal micro-batch delay for nothing. */
  function onScrollEnd() {
    if (batchTimer) { clearTimeout(batchTimer); flushBatch(); }
  }

  function setupViewportObserver() {
    if (viewportObserver) return;
    viewportObserver = new IntersectionObserver(onViewportEntries, { rootMargin: PREFETCH_MARGINS[0] });
    readingZoneObserver = new IntersectionObserver(onReadingZoneEntries, { rootMargin: READING_ZONE_MARGIN });
    window.addEventListener('scroll', onScroll, { passive: true });
    if ('onscrollend' in window) window.addEventListener('scrollend', onScrollEnd);
  }

  /** Any click on the post's own content (Like, Comment, See more, opening
   *  media...) counts as the user actively engaging with it — from then on we
   *  never auto-collapse this post out from under them, only label it. Clicks
   *  on our own controls don't count (they're handled by their own buttons). */
  function onPostInteraction(e) {
    if (e.target && e.target.closest && e.target.closest('.jev-ui')) return;
    const st = postState.get(e.currentTarget);
    if (st) st.interacted = true;
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

    const key = currentDecisionKey();
    const domChanged = st.domDirty === true;
    const sig = domChanged || st.sig === undefined || st.decidedKey !== key ? signatureOf(postEl) : st.sig;
    st.domDirty = false;
    // Fast path: decided for the current settings and the card is unchanged
    if (!domChanged && st.decidedKey === key && st.sig === sig) return;

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

    // F10: Facebook recycled this DOM node for a DIFFERENT post (same author
    // and a body prefix relation = same post, even across "See more").
    if (st.identity && !JevFB.isSamePost(st.identity, postData)) {
      JevFB.unhidePost(postEl);
      delete postEl.dataset.jevStatus;
      delete postEl.dataset.jevHideMode;
      postState.delete(postEl);
      st = getState(postEl);
    }
    st.identity = { author: postData.author, head: postData.head };

    // Brand-new state (first look, or just reset above): derive the reading
    // zone synchronously instead of waiting for the next crossing event,
    // which may never come if the recycled node didn't move.
    if (st.inReadingZone === undefined) syncZoneStateNow(postEl, st);

    if (st.decidedKey === key && (st.hash === postData.hash || keepsDecision(st, postData))) {
      st.hash = postData.hash;
      st.textLen = postData.text.length;
      // Up to date — but FB may have re-rendered the post (virtualized scroll)
      // and dropped our banner/label: re-apply through the same decision
      // matrix so a hidden post never silently reverts to plain.
      if (st.decision && st.decision.shouldHide && hideArtifactMissing(postEl)) {
        applyHideDecision(postEl, st);
        st.sig = signatureOf(postEl); // the repair injected DOM — refresh the signature
      } else {
        st.sig = sig; // unchanged since the fast-path check above (no await between)
      }
      return;
    }

    if (criteriaTopics(config.filterCriteria).length === 0) {
      postEl.dataset.jevStatus = 'pending_criteria';
      return;
    }

    st.pending = true;
    postEl.dataset.jevStatus = 'analyzing';

    candidateQueue.push({ element: postEl, state: st, data: postData, key });
    // A post already inside the reading zone shouldn't wait out the normal
    // micro-batch window behind posts still off-screen.
    scheduleBatchFlush(st.inReadingZone === true);
  }

  /**
   * Same post (identity unchanged) whose text changed — typically "See more"
   * expanding it, or comments/alt text loading. Keep the decision instead of
   * paying for the post again, unless the text grew materially (the expanded
   * part could change the verdict). Hidden posts and user overrides stick.
   */
  function keepsDecision(st, postData) {
    const d = st.decision;
    if (!d || !st.textLen) return false;
    if (d.shouldHide || d.user) return true;
    const grown = postData.text.length - st.textLen;
    return grown < Math.max(EXPAND_MIN_CHARS, st.textLen * EXPAND_MIN_RATIO);
  }

  /** Whether the mode-appropriate hidden artifact is still present in the DOM. */
  function hideArtifactMissing(el) {
    if (el.dataset.jevHideMode === 'soft') return !el.querySelector(':scope > .jev-corner-label');
    if (el.dataset.jevHideMode === 'reading-blur') {
      return !el.querySelector(':scope > .jev-blur-canvas, :scope > .jev-blur-tag');
    }
    if (config.hideMode === 'remove') return el.dataset.jevRemoved !== 'true';
    return !el.querySelector(':scope > .jev-ui');
  }

  function hideOpts() {
    return {
      hideMode: config.hideMode,
      criteria: config.filterCriteria,
      lang: config.language,
      blurPreset: config.blurPreset,
      blurFlashcardTopic: config.blurFlashcardTopic,
      blurCustomQuotes: config.blurCustomQuotes,
      blurRevealFriction: config.blurRevealFriction
    };
  }

  function collapseNow(el, decision) {
    JevFB.removeSoftLabel(el);
    JevFB.hidePost(el, decision, hideOpts());
  }

  /** Fresh in the reading zone, not yet decided-hidden: blur in place (no
   *  height change) with the REAL reason, distinct from the pre-decision
   *  "Checking..." tag. Reuses the confirmed hide's own bookkeeping mode
   *  ('reading-blur') so a later hideMode change or repair pass can tell it
   *  apart from the user's permanent blur-mode setting. */
  function applyReadingBlur(el, decision) {
    if (el.dataset.jevHideMode === 'reading-blur' &&
        el.querySelector(':scope > .jev-blur-canvas, :scope > .jev-blur-tag')) return;
    JevFB.unhidePost(el);
    el.dataset.jevStatus = 'hidden';
    el.dataset.jevHideMode = 'reading-blur';
    el.classList.add('jev-blurred-post');
    JevFB.injectBlurControls(el, decision, hideOpts());
  }

  /**
   * THE decision matrix for a confirmed violation. Never called until
   * `st.decision.shouldHide` is true.
   *   not in the reading zone         -> collapse for real, right now
   *   interacted, or already read     -> quiet corner label, defer collapse
   *   fresh in the reading zone       -> blur in place, defer collapse
   * "Defer" means: finalize into the user's real hideMode once the post
   * leaves the reading zone (`finalizeDeferredCollapse`), or immediately if
   * the user taps "Collapse" (`JevFB.onForceCollapse`).
   */
  function applyHideDecision(el, st) {
    const decision = st.decision;
    if (!decision || !decision.shouldHide) return;

    // An explicit user reveal ("Xem nội dung") outranks every automatic
    // re-application. A revealed post reaches here via the repair/re-check
    // pass: in blur mode revealing removed the control tag — the only
    // .jev-ui artifact — so once Facebook mutates timestamps/counts the
    // artifact looks "missing" and the verdict would be re-applied, yanking
    // the content back from under the reader. The reveal is still cleared
    // by the intentional paths, which all reset the class first: hideMode
    // change (rerenderHiddenPosts -> hidePost), "Không phải spam",
    // disabling the filter, or FB recycling the node (unhidePost).
    if (el.classList.contains('jev-revealed')) return;

    if (!st.inReadingZone) {
      st.pendingCollapse = false;
      collapseNow(el, decision);
      return;
    }

    if (!st.pendingCollapse) reportDeferred();
    st.pendingCollapse = true;

    if (st.interacted || clearSeenMs(st) >= CLEAR_SEEN_MS) {
      JevFB.applySoftLabel(el, decision, { criteria: config.filterCriteria, lang: config.language });
    } else {
      applyReadingBlur(el, decision);
    }
  }

  /** The post left the reading zone while a collapse was deferred: apply it
   *  for real now, unless the user engaged with it in the meantime or the
   *  settings changed underneath it. */
  function finalizeDeferredCollapse(el, st) {
    st.pendingCollapse = false;
    if (!config.extensionEnabled || !el.isConnected) return;
    if (st.interacted) return; // the user engaged with it — leave the label, never yank it
    if (st.decidedKey !== currentDecisionKey()) { evaluatePost(el); return; }
    if (!st.decision || !st.decision.shouldHide) return;
    collapseNow(el, st.decision);
  }

  /**
   * Schedule batch dispatch. `immediate` skips the micro-batch delay for a
   * post already in the reading zone — nothing to gain by making the AI call
   * for something the user can see right now wait behind the normal window.
   */
  function scheduleBatchFlush(immediate) {
    // Coalesce all posts reported in the same IntersectionObserver callback
    // before dispatch, while still avoiding the normal batching delay for a
    // post already in the reading zone.
    if (immediate) {
      if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
      if (!immediateBatchFlushScheduled) {
        immediateBatchFlushScheduled = true;
        queueMicrotask(() => {
          immediateBatchFlushScheduled = false;
          flushBatch();
        });
      }
      return;
    }
    if (candidateQueue.length >= MAX_BATCH_SIZE) {
      if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
      flushBatch();
      return;
    }
    if (batchTimer) return;
    batchTimer = setTimeout(flushBatch, BATCH_INTERVAL_MS);
  }

  function sendBatch(payload) {
    // Explicit timer cleanup: inside Promise.race the losing timer would keep
    // firing (and pin its timeout handle) long after a successful response.
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), RESPONSE_TIMEOUT_MS);
      chrome.runtime.sendMessage({ action: 'EVALUATE_BATCH', items: payload }).then(
        (res) => { clearTimeout(timer); resolve(res); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  /**
   * Flush pending candidates to Background Service Worker
   */
  async function flushBatch() {
    batchTimer = null;
    // Orphaned after an extension reload/update: stop silently instead of
    // throwing "Extension context invalidated" for every queued batch.
    if (!isContextAlive()) { shutdown(); return; }
    if (candidateQueue.length === 0) return;

    // Reading-zone candidates go out first when a batch has to be split —
    // what the user can see right now outranks look-ahead prefetch.
    if (candidateQueue.length > MAX_BATCH_SIZE) {
      candidateQueue.sort((a, b) => (b.state.inReadingZone ? 1 : 0) - (a.state.inReadingZone ? 1 : 0));
    }

    const currentBatch = candidateQueue.splice(0, MAX_BATCH_SIZE);
    if (candidateQueue.length > 0) scheduleBatchFlush(); // pipeline next batch now

    // Clip BEFORE the bridge: the decision hash was computed from the full
    // text, so the cache key is unaffected, but long posts (and duplicate
    // copies of the same content within one batch) are no longer serialized
    // in full across the messaging boundary.
    const payload = currentBatch.map(c => ({
      id: c.state.uid,
      hash: c.data.hash,
      text: JevFB.clipPostText(c.data.text),
      author: c.data.author
    }));

    let decisions = [];
    try {
      const res = await sendBatch(payload);
      if (Array.isArray(res)) decisions = res;
    } catch (err) {
      // Context died mid-flight (reload between the guard above and the
      // response): an expected lifecycle event, not an error worth logging.
      if (!isContextAlive()) { shutdown(); return; }
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
      if (el.dataset.jevStatus === 'analyzing') delete el.dataset.jevStatus;
      return;
    }

    // Settings changed while in flight — the refresh skipped this pending post, re-run it
    if (key !== currentDecisionKey()) {
      if (el.dataset.jevStatus === 'analyzing') delete el.dataset.jevStatus;
      evaluatePost(el);
      return;
    }

    st.hash = candidate.data.hash;
    st.textLen = candidate.data.text.length;
    st.decidedKey = key;
    st.decision = decision;

    if (decision.shouldHide) {
      applyHideDecision(el, st);
    } else {
      markSafeInDom(el);
    }
    st.sig = signatureOf(el);
    reportHiddenCount();
  }

  function markSafeInDom(el) {
    // Not `dataset.jevStatus === 'hidden'`: a re-check of an already-hidden
    // post sets 'analyzing' while its new verdict is pending (see
    // evaluatePost), so by the time a "safe" verdict lands here the status
    // may no longer read 'hidden' even though the banner/blur is still on
    // screen. Check for the actual leftover artifact instead.
    if (el.dataset.jevRemoved || el.querySelector(':scope > .jev-ui')) JevFB.unhidePost(el);
    delete el.dataset.jevHideMode;
    el.dataset.jevStatus = 'safe';
  }

  /**
   * "Không phải spam" clicked: show the post (and every copy of the same
   * content in this tab) and tell the worker to never hide it again.
   */
  JevFB.onMarkSafe = function(postEl) {
    const st = postState.get(postEl);
    if (!st || !st.hash) return;
    const hash = st.hash;
    const override = { shouldHide: false, confidence: 0, user: true };
    tracked.forEach(el => {
      const other = postState.get(el);
      if (!other || other.hash !== hash) return;
      other.decision = override;
      other.pendingCollapse = false;
      markSafeInDom(el);
      other.sig = signatureOf(el);
    });
    reportHiddenCount();
    try {
      chrome.runtime.sendMessage({ action: 'MARK_SAFE', hash, author: JevFB.extractPostData(postEl).author }).catch(() => {});
    } catch (_) {}
  };

  /** The user tapped "Collapse" on a soft-labeled post: finalize right away
   *  instead of waiting for it to scroll out of the reading zone. */
  JevFB.onForceCollapse = function(postEl) {
    const st = postState.get(postEl);
    if (!st || !st.decision || !st.decision.shouldHide) return;
    st.pendingCollapse = false;
    collapseNow(postEl, st.decision);
  };

  /** The user tapped "Show now" on the pre-decision waiting blur (strict
   *  mode): stop waiting, and treat it like any other interaction — this
   *  post never gets auto-collapsed out from under them for this view. */
  JevFB.onSkipWait = function(postEl) {
    const st = postState.get(postEl);
    if (st) st.interacted = true;
    JevFB.clearAnalyzingState(postEl);
  };

  /**
   * Register an element with the IntersectionObservers (idempotent)
   * @param {HTMLElement} el
   */
  function registerPostElement(el) {
    // Belt: getAllPosts() already skips Messenger surfaces, but never track a
    // chat element no matter which caller resolved it.
    if (!el || tracked.has(el) || !viewportObserver || JevFB.isInChat(el)) return;
    tracked.add(el);
    viewportObserver.observe(el);
    readingZoneObserver.observe(el);
    if (typeof JevFB.resumeBlurEffects === 'function') JevFB.resumeBlurEffects(el);
    el.addEventListener('click', onPostInteraction, { capture: true, passive: true });
    el.addEventListener('focusin', onPostInteraction, true);
  }

  function unregisterPostElement(el) {
    tracked.delete(el);
    visible.delete(el);
    if (typeof JevFB.suspendBlurEffects === 'function') JevFB.suspendBlurEffects(el);
    viewportObserver.unobserve(el);
    readingZoneObserver.unobserve(el);
    el.removeEventListener('click', onPostInteraction, true);
    el.removeEventListener('focusin', onPostInteraction, true);
  }

  // 4. Page scanning — observes document.body so it keeps working across
  //    Facebook's SPA navigation (Home -> Group -> Profile) without reloads.
  let scanTimer = null;
  let idleScanHandle = null;
  let lastVisibleRecheck = 0;
  let recheckTimer = null;
  let fullScanRequested = true;
  const pendingScanRoots = new Set();
  let lastFullScanAt = 0;

  /** Extension reloaded/updated: this copy is orphaned — stop all work. */
  function isContextAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; }
  }

  /** Messenger full-page route (/messages/t/...) — no feed posts live here. */
  function isMessengerRoute() {
    return window.location.pathname.startsWith('/messages');
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') { fullScanRequested = true; scheduleScan(); }
  }

  function onPageShow() {
    fullScanRequested = true;
    scheduleScan();
  }

  function shutdown() {
    if (mutationObserver) mutationObserver.disconnect();
    tracked.forEach(unregisterPostElement);
    if (viewportObserver) viewportObserver.disconnect();
    if (readingZoneObserver) readingZoneObserver.disconnect();
    window.removeEventListener('scroll', onScroll);
    if ('onscrollend' in window) window.removeEventListener('scrollend', onScrollEnd);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pageshow', onPageShow);
    clearInterval(heartbeatTimer);
    clearTimeout(scanTimer);
    clearTimeout(recheckTimer);
    clearTimeout(batchTimer);
    clearTimeout(badgeTimer);
    clearTimeout(deferredTimer);
    if (idleScanHandle !== null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleScanHandle);
      idleScanHandle = null;
    }
    candidateQueue.length = 0;
  }

  function addScanRoot(root) {
    if (!root || root.nodeType !== 1 || root.closest('.jev-ui')) return;
    for (const existing of pendingScanRoots) {
      if (existing === root || existing.contains(root)) return;
    }
    for (const existing of pendingScanRoots) {
      if (root.contains(existing)) pendingScanRoots.delete(existing);
    }
    pendingScanRoots.add(root);
  }

  function pruneDetachedPosts() {
    let pruned = false;
    tracked.forEach(el => {
      if (!el.isConnected) {
        unregisterPostElement(el);
        pruned = true;
      }
    });
    if (pruned) reportHiddenCount();
  }

  function scanPendingRoots() {
    const roots = [...pendingScanRoots];
    pendingScanRoots.clear();
    if (isMessengerRoute()) return;
    roots.forEach(root => {
      if (root.isConnected) JevFB.getPostsWithin(root).forEach(registerPostElement);
    });
  }

  function scanPage() {
    if (!isContextAlive()) { shutdown(); return; }
    if (!config.extensionEnabled) return;

    const now = Date.now();
    if (fullScanRequested || now - lastFullScanAt >= FULL_RESCAN_MS) {
      pruneDetachedPosts();
      fullScanRequested = false;
      lastFullScanAt = now;
      pendingScanRoots.clear();
      if (!isMessengerRoute()) JevFB.getAllPosts().forEach(registerPostElement);
    } else if (pendingScanRoots.size > 0) {
      scanPendingRoots();
    }

    // Mutation records mark affected visible cards dirty. This slower safety
    // pass also catches DOM changes Facebook performs outside observed nodes.
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
    scanTimer = setTimeout(() => {
      scanTimer = null;
      if (typeof window.requestIdleCallback === 'function') {
        if (idleScanHandle !== null) return;
        idleScanHandle = window.requestIdleCallback(() => {
          idleScanHandle = null;
          scanPage();
        }, { timeout: 500 });
      } else {
        scanPage();
      }
    }, SCAN_THROTTLE_MS);
  }

  function trackedPostFor(node) {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    while (el && el !== document.body) {
      if (tracked.has(el)) return el;
      el = el.parentElement;
    }
    return null;
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
    fullScanRequested = false;
    lastFullScanAt = Date.now();

    mutationObserver = new MutationObserver((mutations) => {
      if (!config.extensionEnabled) return;
      let shouldScan = false;
      for (const m of mutations) {
        const mutationTarget = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        const fromOurUi = !!(mutationTarget && mutationTarget.closest('.jev-ui'));
        const existingPost = fromOurUi ? null : trackedPostFor(m.target);
        if (existingPost) {
          getState(existingPost).domDirty = true;
          if (typeof JevFB.syncBlurAccessibility === 'function') JevFB.syncBlurAccessibility(existingPost);
          shouldScan = true;
        }

        if (m.addedNodes) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1 || node.closest('.jev-ui')) continue;
            addScanRoot(node);
            shouldScan = true;
          }
        }
      }
      if (shouldScan) scheduleScan();
    });
    mutationObserver.observe(document.body, {
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['alt'],
      subtree: true
    });

    heartbeatTimer = setInterval(() => {
      if (config.extensionEnabled && document.visibilityState === 'visible') scheduleScan();
    }, HEARTBEAT_MS);
    // Tab restored from background / bfcache: re-check what is on screen now
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
  }
})();
