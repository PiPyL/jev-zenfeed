/**
 * UI Overlay & DOM Hiding Controls
 * Injects non-intrusive Collapsed Banners or Blur overlays without breaking Facebook's feed layout.
 * Every injected node carries the `jev-ui` class so the text extractor ignores it.
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

  /**
   * Set subtle analyzing blur while AI evaluates the post
   * @param {HTMLElement} postEl
   * @param {boolean} enableBlur
   */
  JevFB.applyAnalyzingState = function(postEl, enableBlur = true) {
    if (!postEl) return;
    postEl.dataset.jevStatus = 'analyzing';
    if (enableBlur) {
      postEl.classList.add('jev-analyzing');
    }
  };

  /**
   * Remove the analyzing blur (does not change the post's status)
   * @param {HTMLElement} postEl
   */
  JevFB.clearAnalyzingState = function(postEl) {
    if (!postEl) return;
    postEl.classList.remove('jev-analyzing');
  };

  /**
   * Remove every hiding effect (banner/blur/remove) so the post shows normally.
   * @param {HTMLElement} postEl
   */
  JevFB.unhidePost = function(postEl) {
    if (!postEl) return;
    postEl.classList.remove('jev-analyzing', 'jev-post-collapsed', 'jev-revealed', 'jev-blurred-post');
    if (postEl.dataset.jevRemoved) {
      postEl.style.display = '';
      delete postEl.dataset.jevRemoved;
    }
    postEl.querySelectorAll(':scope > .jev-ui').forEach(n => n.remove());
  };

  /**
   * Hide or collapse post based on Jev decision
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
      postEl.classList.remove('jev-analyzing');
      const badge = postEl.querySelector(':scope > .jev-ui .jev-badge-conf');
      if (badge) badge.textContent = t(lang, 'bannerConfidence', { pct: formatConfidence(decision) });
      const desc = postEl.querySelector(':scope > .jev-ui .jev-banner-desc');
      if (desc) {
        const criteria = options.criteria || '';
        desc.textContent = decision && decision.reason
          ? truncate(decision.reason, 90)
          : (criteria ? t(lang, 'bannerMatchCriteria', { criteria: truncate(criteria, 70) }) : t(lang, 'bannerDefaultDesc'));
        desc.title = criteria;
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

  const ICON_SHIELD = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12 2 4 5v6.1c0 5 3.4 9.7 8 10.9 4.6-1.2 8-5.9 8-10.9V5l-8-3Zm-1.2 13.6-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z"/></svg>';
  const ICON_EYE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7Zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>';
  const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M2.3 3.7 3.7 2.3l18 18-1.4 1.4-3.3-3.3A11.8 11.8 0 0 1 12 19c-5 0-9.3-3.1-11-7a12.4 12.4 0 0 1 4-4.9L2.3 3.7Zm5.5 5.5a4.5 4.5 0 0 0 6.1 6.1l-1.6-1.6a2 2 0 0 1-2.9-2.9L7.8 9.2ZM12 5c5 0 9.3 3.1 11 7a12.3 12.3 0 0 1-3.2 4.4l-3.4-3.4A4.5 4.5 0 0 0 11 7.6L8.9 5.5C9.9 5.2 10.9 5 12 5Z"/></svg>';

  /** "Ẩn nhầm" — handled by content.js (it owns the post state). */
  function bindMarkSafe(button, postEl) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof JevFB.onMarkSafe === 'function') JevFB.onMarkSafe(postEl);
    });
  }

  function truncate(str, max) {
    const s = String(str || '').trim();
    return s.length > max ? `${s.slice(0, max)}…` : s;
  }

  /**
   * Inject the collapsed banner. It stands in for the whole post card (same
   * surface, radius and colors as a Facebook card, taken from Facebook's own
   * CSS variables so light/dark mode always match).
   */
  JevFB.injectCollapsedBanner = function(postEl, decision, options) {
    if (postEl.querySelector(':scope > .jev-banner')) return;

    postEl.classList.add('jev-post-collapsed');

    const lang = options.lang || 'en';
    const t = JevFB.t || ((_l, _k, _p) => _k);
    const banner = document.createElement('div');
    banner.className = 'jev-ui jev-banner';
    banner.setAttribute('role', 'note');
    banner.dataset.jevLang = lang;

    const criteria = options.criteria || '';
    const reason = decision && decision.reason ? truncate(decision.reason, 90) : '';
    const detail = reason || (criteria ? t(lang, 'bannerMatchCriteria', { criteria: truncate(criteria, 70) }) : t(lang, 'bannerDefaultDesc'));

    banner.innerHTML = `
      <span class="jev-banner-icon">${ICON_SHIELD}</span>
      <div class="jev-banner-info">
        <div class="jev-banner-title">
          <span class="jev-banner-heading">${escapeHtml(t(lang, 'bannerTitle'))}</span>
          <span class="jev-badge-conf">${escapeHtml(t(lang, 'bannerConfidence', { pct: formatConfidence(decision) }))}</span>
        </div>
        <div class="jev-banner-desc" title="${escapeHtml(criteria)}">${escapeHtml(detail)}</div>
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
   * Inject quick button for blur mode. The tag is NOT blurred (CSS blurs the
   * post's other children only), so it stays readable and clickable.
   */
  JevFB.injectBlurControls = function(postEl, decision, options = {}) {
    if (postEl.querySelector(':scope > .jev-blur-tag')) return;

    const lang = options.lang || 'en';
    const t = JevFB.t || ((_l, _k, _p) => _k);
    const tag = document.createElement('div');
    tag.className = 'jev-ui jev-blur-tag';
    tag.innerHTML = `
      <span>${escapeHtml(t(lang, 'blurTagLabel', { pct: formatConfidence(decision) }))}</span>
      <button type="button" class="jev-btn-show">${escapeHtml(t(lang, 'btnShowContent'))}</button>
      <button type="button" class="jev-btn-safe" title="${escapeHtml(t(lang, 'btnMarkSafeTitle'))}">${escapeHtml(t(lang, 'btnMarkSafe'))}</button>
    `;
    bindMarkSafe(tag.querySelector('.jev-btn-safe'), postEl);

    tag.querySelector('.jev-btn-show').addEventListener('click', (e) => {
      e.stopPropagation();
      postEl.classList.remove('jev-blurred-post');
      postEl.classList.add('jev-revealed');
      tag.remove();
    });

    postEl.prepend(tag);
  };
})();
