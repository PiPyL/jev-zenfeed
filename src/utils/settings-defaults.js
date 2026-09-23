/**
 * Default settings — SINGLE SOURCE OF TRUTH (F14)
 *
 * Dual-mode (same pattern as fast-hash.js):
 *   1. Classic script (content script / popup): registers JevFB.DEFAULT_SETTINGS
 *   2. Service worker (ES module): side-effect import registers self.__jevDefaults
 *
 * PUBLIC_SETTING_KEYS lists what the content script may read — never the API key.
 * criteriaTopics / criteriaFingerprint are shared so the content script and the
 * service worker derive the SAME decision key from the criteria text.
 */
(function registerDefaults(root) {
  const DEFAULT_SETTINGS = Object.freeze({
    extensionEnabled: true,
    apiKey: '',
    apiUrl: 'https://api.typesafe.ai/v1',
    filterCriteria: 'Gambling and betting ads, predatory high-interest loans, sensationalized fake news, movie/show spoilers, real estate for sale or rent',
    whitelistCriteria: '',
    confidenceThreshold: 70,
    hideMode: 'banner',
    // UX review (2026-09): replaces the old boolean `antiFoucBlur`. This no
    // longer just toggles a pre-decision blur — it picks which side of a
    // trade-off the whole content script leans on:
    //   'smooth' (default) — never blur a post the user can currently see;
    //     a violation is only ever collapsed once it scrolls out of the
    //     "reading zone" (see content.js). A little spam is briefly visible
    //     while the AI decides, but the feed itself never jumps or freezes.
    //   'strict' — blur on screen while the AI is still deciding (with a
    //     visible "Checking..." tag + a "Show now" escape hatch). Costs some
    //     smoothness; use for criteria where even a glimpse matters (spoilers).
    filterMode: 'smooth',
    // F18: UI language — English default, then Vietnamese, then other popular
    // languages (src/utils/i18n.js). Public so the content script can
    // localize the on-page banner to match the popup.
    language: 'en',
    // Blur Mode Customization (Zero-CLS Canvas & Digital Sanctuary)
    blurPreset: 'zen', // 'zen' | 'xray' | 'flashcard' | 'classic'
    blurFlashcardTopic: 'ielts', // 'ielts' | 'tech' | 'quotes'
    blurCustomQuotes: '', // custom newline-separated quotes
    blurRevealFriction: 'instant' // 'instant' | 'hold'
  });

  const PUBLIC_SETTING_KEYS = Object.freeze([
    'extensionEnabled', 'filterCriteria', 'whitelistCriteria', 'confidenceThreshold', 'hideMode', 'filterMode', 'language',
    'blurPreset', 'blurFlashcardTopic', 'blurCustomQuotes', 'blurRevealFriction'
  ]);

  /**
   * Split criteria into distinct topics (comma / semicolon / newline separated),
   * folding whitespace and dropping case-insensitive duplicates. Original case
   * and order are kept — this is what gets sent to the model.
   * Completely language-agnostic: no regex guessing, no language-specific keywords.
   *
   * @param {string} criteria
   * @returns {string[]}
   */
  function criteriaTopics(criteria) {
    const seen = new Set();
    const topics = [];
    String(criteria || '').normalize('NFC').split(/[\n,;]+/).forEach((raw) => {
      const topic = raw.replace(/\s+/g, ' ').trim();
      const key = topic.toLowerCase();
      if (topic && !seen.has(key)) {
        seen.add(key);
        topics.push(topic);
      }
    });
    return topics;
  }

  /**
   * Order/case/whitespace-insensitive identity of the criteria, used in cache
   * keys: re-ordering presets or fixing a stray space no longer throws away
   * every cached decision (and re-pays for them).
   * Incorporates whitelistCriteria so cache is strictly sound.
   * @param {string} criteria
   * @param {string} [whitelist='']
   * @returns {string}
   */
  function criteriaFingerprint(criteria, whitelist = '') {
    const critFp = criteriaTopics(criteria).map(t => t.toLowerCase()).sort().join('|');
    const wlFp = criteriaTopics(whitelist).map(t => t.toLowerCase()).sort().join('|');
    return wlFp ? `${critFp}#wl:${wlFp}` : critFp;
  }

  if (root) {
    root.JevFB = root.JevFB || {};
    root.JevFB.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    root.JevFB.PUBLIC_SETTING_KEYS = PUBLIC_SETTING_KEYS;
    root.JevFB.criteriaTopics = criteriaTopics;
    root.JevFB.criteriaFingerprint = criteriaFingerprint;
    root.__jevDefaults = { DEFAULT_SETTINGS, PUBLIC_SETTING_KEYS, criteriaTopics, criteriaFingerprint };
  }
})(typeof self !== 'undefined' ? self : globalThis);
