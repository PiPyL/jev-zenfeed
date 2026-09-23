/**
 * UI Overlay & DOM Hiding Controls
 * Injects non-intrusive Collapsed Banners or Blur overlays without breaking Facebook's feed layout.
 * Every injected node carries the `jev-ui` class so the text extractor ignores it.
 *
 * UX review (2026-09): a post that is still inside the user's "reading zone"
 * (content.js) is never yanked away — it gets a quiet corner label or an
 * in-place blur (no height change) instead of an instant collapse. The three
 * visual surfaces here (banner, blur tag, corner label) all describe the SAME
 * decision the same way (category/reason, no raw confidence number — that's
 * only ever a tooltip now, see `reasonText`/`formatConfidence`).
 */

window.JevFB = window.JevFB || {};

(function() {
  const JevFB = window.JevFB;

  /**
   * Escape HTML special chars before injecting into innerHTML (F6)
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatConfidence(decision) {
    const conf = Number(decision && decision.confidence);
    return Number.isFinite(conf) ? Math.max(0, Math.min(100, Math.round(conf))) : 0;
  }

  function truncate(str, max) {
    const s = String(str || '').trim();
    return s.length > max ? `${s.slice(0, max)}…` : s;
  }

  /**
   * Human description of WHY a post was hidden — shared by the banner, the
   * blur tag and the corner label so all three read the same way. Prefers the
   * model's own reason; otherwise names the criteria. No raw confidence
   * number here on purpose (it means little to most people) — that lives
   * only in a `title` tooltip (see callers of `formatConfidence`).
   * @param {{reason?: string}} decision
   * @param {{criteria?: string}} options
   */
  function reasonText(decision, options, lang, t) {
    const reason = decision && decision.reason ? truncate(decision.reason, 90) : '';
    if (reason) return reason;
    const criteria = options.criteria || '';
    return criteria ? t(lang, 'bannerMatchCriteria', { criteria: truncate(criteria, 70) }) : t(lang, 'bannerDefaultDesc');
  }

  /** Topic list from criteria */
  function getCriteriaTopics(criteria) {
    return typeof JevFB.criteriaTopics === 'function' ? JevFB.criteriaTopics(criteria) : [];
  }

  /** First topic of the criteria, for backward compatibility. */
  function firstTopic(criteria) {
    const topics = getCriteriaTopics(criteria);
    return truncate(topics[0] || criteria || '', 40);
  }

  /**
   * Deprecated: scanning is now 100% silent and background-only to guarantee
   * zero visual noise and native Facebook feed performance. Kept as no-op for API safety.
   */
  JevFB.applyAnalyzingState = function(_postEl, _shouldBlur, _options = {}) {};

  /** Remove the pre-decision waiting visual, if any (does not touch a decided hide). */
  JevFB.clearAnalyzingState = function(postEl) {
    if (!postEl) return;
    const tag = postEl.querySelector(':scope > .jev-blur-tag.jev-blur-tag-pending');
    if (tag) {
      tag.remove();
      postEl.classList.remove('jev-blurred-post');
    }
  };

  /**
   * Remove every hiding/labeling effect (banner/blur/remove/corner label) so
   * the post shows exactly as Facebook rendered it.
   * @param {HTMLElement} postEl
   */
  JevFB.unhidePost = function(postEl) {
    if (!postEl) return;
    postEl.classList.remove(
      'jev-post-collapsed', 'jev-revealed', 'jev-blurred-post', 'jev-blur-classic', 'jev-relative-anchor', 'jev-banner-slim'
    );
    if (postEl.dataset.jevRemoved) {
      postEl.style.display = '';
      delete postEl.dataset.jevRemoved;
    }
    postEl.querySelectorAll(':scope > .jev-ui').forEach(n => n.remove());
  };

  /**
   * Hide or collapse post based on Jev decision — this is the FINAL, visible
   * form (banner/blur/remove per the user's setting). Callers in content.js
   * only reach this once a post has left the reading zone (or the user asked
   * for it explicitly via "Collapse now" / "Not spam"); a post still being
   * read gets `applySoftLabel` or the in-place reading-blur instead.
   * @param {HTMLElement} postEl
   * @param {{confidence: number, reason?: string}} decision
   * @param {{hideMode: string, criteria?: string}} options
   */
  JevFB.hidePost = function(postEl, decision, options = {}) {
    if (!postEl) return;
    const mode = options.hideMode || 'banner';

    const lang = options.lang || 'en';
    const t = JevFB.t || ((_l, _k, _p) => _k);

    // Already rendered in this mode (e.g. re-check confirmed it) — keep the
    // user's reveal state untouched.
    if (postEl.dataset.jevStatus === 'hidden' && postEl.dataset.jevHideMode === mode) {
      const desc = postEl.querySelector(':scope > .jev-ui .jev-banner-desc');
      if (desc) {
        const text = reasonText(decision, options, lang, t);
        desc.textContent = text;
        desc.title = options.criteria || '';
      }
      return;
    }

    JevFB.unhidePost(postEl);
    postEl.dataset.jevStatus = 'hidden';
    postEl.dataset.jevHideMode = mode;

    // Mode 1: Remove entirely
    if (mode === 'remove') {
      postEl.dataset.jevRemoved = 'true';
      postEl.style.display = 'none';
      return;
    }

    // Mode 2: Blur overlay
    if (mode === 'blur') {
      postEl.classList.add('jev-blurred-post');
      JevFB.injectBlurControls(postEl, decision, options);
      return;
    }

    // Mode 3: Collapsed Banner (Default & Recommended)
    JevFB.injectCollapsedBanner(postEl, decision, options);
  };

  const ICON_SHIELD = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12 2 4 5v6.1c0 5 3.4 9.7 8 10.9 4.6-1.2 8-5.9 8-10.9V5l-8-3Zm-1.2 13.6-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z"/></svg>';
  const ICON_EYE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7Zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>';
  const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M2.3 3.7 3.7 2.3l18 18-1.4 1.4-3.3-3.3A11.8 11.8 0 0 1 12 19c-5 0-9.3-3.1-11-7a12.4 12.4 0 0 1 4-4.9L2.3 3.7Zm5.5 5.5a4.5 4.5 0 0 0 6.1 6.1l-1.6-1.6a2 2 0 0 1-2.9-2.9L7.8 9.2ZM12 5c5 0 9.3 3.1 11 7a12.3 12.3 0 0 1-3.2 4.4l-3.4-3.4A4.5 4.5 0 0 0 11 7.6L8.9 5.5C9.9 5.2 10.9 5 12 5Z"/></svg>';

  /** "Không phải spam" — handled by content.js (it owns the post state). */
  function bindMarkSafe(button, postEl) {
    if (!button) return;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof JevFB.onMarkSafe === 'function') JevFB.onMarkSafe(postEl);
    });
  }

  // Session-wide: after the first N collapsed banners, switch to a slim
  // one-line style. The first few stay full-size so a new user can actually
  // read what got hidden and trust the filter before it gets out of the way.
  const SLIM_AFTER = 20;
  let bannersShown = 0;

  /**
   * Inject the collapsed banner. It stands in for the whole post card (same
   * surface, radius and colors as a Facebook card, taken from Facebook's own
   * CSS variables so light/dark mode always match). Neutral gray, not an
   * accent color — a filtered post is routine, not an alert.
   */
  JevFB.injectCollapsedBanner = function(postEl, decision, options) {
    if (postEl.querySelector(':scope > .jev-banner')) return;

    postEl.classList.add('jev-post-collapsed');

    const lang = options.lang || 'en';
    const t = JevFB.t || ((_l, _k, _p) => _k);
    const slim = bannersShown >= SLIM_AFTER;
    bannersShown++;

    const banner = document.createElement('div');
    banner.className = 'jev-ui jev-banner' + (slim ? ' jev-banner-slim' : '');
    banner.setAttribute('role', 'note');
    banner.dataset.jevLang = lang;

    const detail = reasonText(decision, options, lang, t);
    const pctTitle = t(lang, 'bannerConfidence', { pct: formatConfidence(decision) });

    banner.innerHTML = `
      <span class="jev-banner-icon" title="${escapeHtml(pctTitle)}">${ICON_SHIELD}</span>
      <div class="jev-banner-info">
        <div class="jev-banner-title">
          <span class="jev-banner-heading">${escapeHtml(t(lang, 'bannerTitle'))}</span>
        </div>
        <div class="jev-banner-desc" title="${escapeHtml(options.criteria || '')}">${escapeHtml(detail)}</div>
      </div>
      <div class="jev-banner-actions">
        <button type="button" class="jev-btn-safe" title="${escapeHtml(t(lang, 'btnMarkSafeTitle'))}">${escapeHtml(t(lang, 'btnMarkSafe'))}</button>
        <button type="button" class="jev-btn-reveal" aria-expanded="false">
          ${ICON_EYE}<span class="jev-btn-label">${escapeHtml(t(lang, 'btnReveal'))}</span>
        </button>
      </div>
    `;

    const btnReveal = banner.querySelector('.jev-btn-reveal');
    btnReveal.addEventListener('click', (e) => {
      e.stopPropagation();
      JevFB.toggleReveal(postEl, banner);
    });
    bindMarkSafe(banner.querySelector('.jev-btn-safe'), postEl);

    postEl.prepend(banner);
  };

  /**
   * Toggle post visibility when user clicks 'View' / 'Hide again'
   */
  JevFB.toggleReveal = function(postEl, banner) {
    const isRevealed = postEl.classList.contains('jev-revealed');
    const btn = banner.querySelector('.jev-btn-reveal');
    const lang = banner.dataset.jevLang || 'en';
    const t = JevFB.t || ((_l, _k, _p) => _k);

    postEl.classList.toggle('jev-post-collapsed', isRevealed);
    postEl.classList.toggle('jev-revealed', !isRevealed);
    btn.innerHTML = isRevealed
      ? `${ICON_EYE}<span class="jev-btn-label">${escapeHtml(t(lang, 'btnReveal'))}</span>`
      : `${ICON_EYE_OFF}<span class="jev-btn-label">${escapeHtml(t(lang, 'btnHideAgain'))}</span>`;
    btn.classList.toggle('active', !isRevealed);
    btn.setAttribute('aria-expanded', String(!isRevealed));
  };

  /**
   * Concise reason for the floating blur tag — prefers AI reason, falls back
   * to the single topic if unambiguous, or generic criteria match if multiple topics.
   */
  function blurTagText(decision, options, lang, t) {
    if (decision && decision.reason) return truncate(decision.reason, 60);
    const topics = getCriteriaTopics(options && options.criteria);
    if (topics.length === 1) {
      return t(lang, 'blurTagTopic', { cat: truncate(topics[0], 40) }) || `${t(lang, 'bannerTitle')}: ${topics[0]}`;
    }
    return t(lang, 'blurTagGeneric') || t(lang, 'bannerTitle');
  }

  /**
   * Helper to attach reveal listener (Instant click or 1.5s Hold-to-reveal)
   */
  function bindRevealAction(btn, postEl, canvasOrTag, friction) {
    if (!btn) return;
    const reveal = () => {
      postEl.classList.remove('jev-blurred-post', 'jev-blur-classic');
      postEl.classList.add('jev-revealed');
      canvasOrTag.remove();
    };

    if (friction === 'hold') {
      let holdTimer = null;
      const HOLD_DURATION = 1500;
      const fill = btn.querySelector('.jev-hold-fill');

      const startHold = (e) => {
        e.stopPropagation();
        if (fill) {
          fill.style.transition = `width ${HOLD_DURATION}ms linear`;
          fill.style.width = '100%';
        }
        holdTimer = setTimeout(() => {
          reveal();
        }, HOLD_DURATION);
      };

      const cancelHold = (e) => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
          if (fill) {
            fill.style.transition = 'width 0.15s ease-out';
            fill.style.width = '0%';
          }
        }
      };

      btn.addEventListener('mousedown', startHold);
      btn.addEventListener('mouseup', cancelHold);
      btn.addEventListener('mouseleave', cancelHold);
      btn.addEventListener('touchstart', startHold, { passive: true });
      btn.addEventListener('touchend', cancelHold);
      btn.addEventListener('touchcancel', cancelHold);
    } else {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        reveal();
      });
    }
  }

  /**
   * Inject Canvas overlay (Zero-CLS Digital Sanctuary) or classic blur tag.
   * Preserves natural post dimensions (no height change) to prevent layout shifts.
   */
  JevFB.injectBlurControls = function(postEl, decision, options = {}) {
    if (postEl.querySelector(':scope > .jev-blur-canvas') || postEl.querySelector(':scope > .jev-blur-tag')) return;

    const lang = options.lang || 'en';
    const t = JevFB.t || ((_l, _k, _p) => _k);
    const preset = options.blurPreset || 'zen';
    const friction = options.blurRevealFriction || 'instant';

    postEl.classList.add('jev-relative-anchor');

    // 1. Classic Mode Fallback (for users who prefer the legacy pill)
    if (preset === 'classic') {
      postEl.classList.add('jev-blur-classic');
      const tag = document.createElement('div');
      tag.className = 'jev-ui jev-blur-tag';

      const labelText = blurTagText(decision, options, lang, t);
      const showLabel = t(lang, 'btnShowContent');
      const safeLabel = t(lang, 'btnMarkSafeShort') || t(lang, 'btnMarkSafe');

      tag.innerHTML = `
        <span class="jev-blur-icon" aria-hidden="true">${ICON_SHIELD}</span>
        <span class="jev-blur-text">${escapeHtml(labelText)}</span>
        <div class="jev-blur-actions">
          <button type="button" class="jev-btn-show">${escapeHtml(showLabel)}</button>
          <button type="button" class="jev-btn-safe" title="${escapeHtml(t(lang, 'btnMarkSafeTitle'))}">${escapeHtml(safeLabel)}</button>
        </div>
      `;
      if (options && options.criteria) tag.title = options.criteria;
      bindMarkSafe(tag.querySelector('.jev-btn-safe'), postEl);
      bindRevealAction(tag.querySelector('.jev-btn-show'), postEl, tag, friction);
      postEl.prepend(tag);
      return;
    }

    // 2. Zero-CLS Canvas Overlay (Zen Oasis, AI X-Ray, Flashcard)
    const canvas = document.createElement('div');
    const isCompact = postEl.offsetHeight > 0 && postEl.offsetHeight < 220;
    canvas.className = 'jev-ui jev-blur-canvas jev-blur-tag' + (isCompact ? ' jev-canvas-compact' : '');
    canvas.setAttribute('role', 'region');
    canvas.setAttribute('aria-label', t(lang, 'zenProtectedTag') || 'ZenFeed Protected');

    // Floating Zen Card Container (centered, frosted glass, zero layout shift)
    const card = document.createElement('div');
    card.className = 'jev-floating-card';

    // 1. Top Badge Header
    const tagTopic = firstTopic(options.criteria) || t(lang, 'bannerTitle');
    const safeLabel = t(lang, 'btnMarkSafeShort') || t(lang, 'btnMarkSafe');
    const revealLabel = friction === 'hold' ? t(lang, 'zenHoldToReveal') : t(lang, 'btnReveal');

    const cardHeader = document.createElement('div');
    cardHeader.className = 'jev-card-header';
    cardHeader.innerHTML = `
      <div class="jev-canvas-badge">
        ${ICON_SHIELD}
        <span>${escapeHtml(t(lang, 'zenProtectedTag'))}: ${escapeHtml(tagTopic)}</span>
      </div>
    `;
    card.appendChild(cardHeader);

    // 2. Center Body based on Preset
    const cardBody = document.createElement('div');
    cardBody.className = 'jev-card-body';

    if (preset === 'xray') {
      // AI X-Ray Widget
      const xrayWidget = document.createElement('div');
      xrayWidget.className = 'jev-xray-widget';
      const detail = reasonText(decision, options, lang, t);
      xrayWidget.innerHTML = `
        <span class="jev-xray-tag">⚡ ${escapeHtml(t(lang, 'blurPresetXray'))}</span>
        <div class="jev-xray-reason">${escapeHtml(detail)}</div>
      `;
      cardBody.appendChild(xrayWidget);
    } else if (preset === 'flashcard' && JevFB.flashcardsData) {
      // Knowledge Swap Flashcard Widget
      const flashcardWidget = document.createElement('div');
      flashcardWidget.className = 'jev-flashcard-widget';

      const renderCard = () => {
        const cardData = JevFB.flashcardsData.getRandomFlashcard(options.blurFlashcardTopic || 'ielts', lang);
        flashcardWidget.innerHTML = `
          <div class="jev-flashcard-term">${escapeHtml(cardData.term)}</div>
          <div class="jev-flashcard-phonetic">${escapeHtml(cardData.phonetic)} · ${escapeHtml(cardData.type)}</div>
          <div class="jev-flashcard-meaning">${escapeHtml(cardData.meaning)}</div>
          <div class="jev-flashcard-example">"${escapeHtml(cardData.example)}"</div>
          <button type="button" class="jev-btn-next-card">🔄 ${escapeHtml(t(lang, 'btnNextCard'))}</button>
        `;
        const nextBtn = flashcardWidget.querySelector('.jev-btn-next-card');
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          renderCard();
        });
      };
      renderCard();
      cardBody.appendChild(flashcardWidget);
    } else {
      // Default: Zen Oasis Widget (Breathing Circle + Mindfulness Quote)
      const zenWidget = document.createElement('div');
      zenWidget.className = 'jev-zen-widget';

      const breatheRing = document.createElement('div');
      breatheRing.className = 'jev-zen-breathing-ring';
      breatheRing.setAttribute('title', 'Box Breathing (4-4-4-4)');
      breatheRing.innerHTML = `<span>${escapeHtml(t(lang, 'zenBreatheIn') || 'Thở')}</span>`;

      const quoteContainer = document.createElement('div');
      quoteContainer.className = 'jev-zen-quote-container';

      const quoteObj = (JevFB.zenData && typeof JevFB.zenData.getRandomQuote === 'function')
        ? JevFB.zenData.getRandomQuote(lang, options.blurCustomQuotes)
        : { text: "Take a deep breath. This space is reserved for your peace of mind.", author: "ZenFeed" };

      const quoteText = document.createElement('div');
      quoteText.className = 'jev-zen-quote-text';
      // Anti-XSS: textContent ensures arbitrary user custom quotes cannot execute script
      quoteText.textContent = `"${quoteObj.text}"`;

      const quoteAuthor = document.createElement('div');
      quoteAuthor.className = 'jev-zen-quote-author';
      quoteAuthor.textContent = quoteObj.author ? `— ${quoteObj.author}` : '';

      quoteContainer.appendChild(quoteText);
      if (quoteObj.author) quoteContainer.appendChild(quoteAuthor);

      zenWidget.appendChild(breatheRing);
      zenWidget.appendChild(quoteContainer);
      cardBody.appendChild(zenWidget);
    }
    card.appendChild(cardBody);

    // 3. Card Footer Actions (Clean, accessible, directly under quote)
    const cardFooter = document.createElement('div');
    cardFooter.className = 'jev-card-footer';
    cardFooter.innerHTML = `
      <button type="button" class="jev-canvas-btn jev-canvas-btn-safe jev-btn-safe" title="${escapeHtml(t(lang, 'btnMarkSafeTitle'))}">${escapeHtml(safeLabel)}</button>
      <button type="button" class="jev-canvas-btn jev-canvas-btn-reveal jev-btn-show ${friction === 'hold' ? 'jev-canvas-btn-hold' : ''}">
        ${friction === 'hold' ? '<div class="jev-hold-fill"></div>' : ''}
        ${ICON_EYE}<span class="jev-btn-label">${escapeHtml(revealLabel)}</span>
      </button>
    `;
    bindMarkSafe(cardFooter.querySelector('.jev-btn-safe'), postEl);
    bindRevealAction(cardFooter.querySelector('.jev-btn-show'), postEl, canvas, friction);
    card.appendChild(cardFooter);

    canvas.appendChild(card);
    postEl.prepend(canvas);
  };

  /**
   * Quiet corner badge for a post the user has ALREADY read (or interacted
   * with) by the time a violation verdict arrives. Does not hide, blur or
   * resize anything — content.js collapses it for real only once it scrolls
   * out of the reading zone (or the user taps "Collapse").
   * @param {HTMLElement} postEl
   * @param {{reason?: string}} decision
   * @param {{criteria?: string, lang?: string}} [options]
   */
  JevFB.applySoftLabel = function(postEl, decision, options = {}) {
    if (!postEl) return;
    if (postEl.dataset.jevHideMode !== 'soft') JevFB.unhidePost(postEl);
    postEl.dataset.jevStatus = 'hidden';
    postEl.dataset.jevHideMode = 'soft';

    const lang = options.lang || 'en';
    const t = JevFB.t || ((_l, _k, _p) => _k);

    let text = '';
    if (decision && decision.reason) {
      text = truncate(decision.reason, 60);
    } else {
      const topics = getCriteriaTopics(options.criteria);
      if (topics.length === 1) {
        text = t(lang, 'cornerLabel', { cat: truncate(topics[0], 40) });
      } else {
        text = t(lang, 'cornerLabelGeneric') || t(lang, 'bannerTitle');
      }
    }

    let label = postEl.querySelector(':scope > .jev-corner-label');
    if (label) {
      const span = label.querySelector('.jev-corner-text');
      if (span) span.textContent = text;
      return;
    }

    postEl.classList.add('jev-relative-anchor');
    label = document.createElement('div');
    label.className = 'jev-ui jev-corner-label';
    label.innerHTML = `
      <span class="jev-corner-text">${escapeHtml(text)}</span>
      <button type="button" class="jev-corner-btn jev-btn-collapse">${escapeHtml(t(lang, 'btnCollapseNow'))}</button>
      <button type="button" class="jev-corner-btn jev-btn-safe">${escapeHtml(t(lang, 'btnMarkSafe'))}</button>
    `;
    bindMarkSafe(label.querySelector('.jev-btn-safe'), postEl);
    label.querySelector('.jev-btn-collapse').addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof JevFB.onForceCollapse === 'function') JevFB.onForceCollapse(postEl);
    });

    postEl.appendChild(label);
  };

  /** Remove the corner label only (used when a post is about to become a real banner/blur/remove). */
  JevFB.removeSoftLabel = function(postEl) {
    if (!postEl) return;
    postEl.querySelectorAll(':scope > .jev-corner-label').forEach(n => n.remove());
    if (!postEl.querySelector(':scope > .jev-ui')) postEl.classList.remove('jev-relative-anchor');
  };
})();
