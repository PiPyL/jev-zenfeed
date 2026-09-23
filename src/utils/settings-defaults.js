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
    filterCriteria: 'Gambling ads, sports betting, card games for money, fast cash loans, plot spoilers for movies and series, celebrity gossip and toxic clickbait, crypto investment pitches, junk meme coins, get-rich-quick schemes, houses for sale, rentals, apartments for rent',
    whitelistCriteria: '',
    confidenceThreshold: 70,
    hideMode: 'banner',
    // UX review (2026-09): replaces the old boolean `antiFoucBlur`. This no
    // longer just toggles a pre-decision blur — it picks which side of a
    // trade-off the whole content script leans on:
    //   'smooth' (default) — never blur a post the user can currently see;
    //     a violation is only ever collapsed once it scrolls out of the
    //     "reading zone" (see content.js). A violating post may stay visible
    //     while the AI decides; banner/remove modes can still change feed height.
    //   'strict' — blur on screen while the AI is still deciding (with a
    //     visible "Checking..." tag + a "Show now" escape hatch). Costs some
    //     smoothness; use for criteria where even a glimpse matters (spoilers).
    filterMode: 'smooth',
    // F18: UI language — English default, then Vietnamese, then other popular
    // languages (src/utils/i18n.js). Public so the content script can
    // localize the on-page banner to match the popup.
    language: 'en',
    // Blur Mode Customization (Canvas & Digital Sanctuary)
    blurPreset: 'zen', // 'zen' | 'xray' | 'flashcard' | 'classic'
    blurFlashcardTopic: 'ielts', // 'ielts' | 'tech' | 'quotes'
    blurCustomQuotes: '', // custom newline-separated quotes
    blurRevealFriction: 'instant' // 'instant' | 'hold'
  });

  const PUBLIC_SETTING_KEYS = Object.freeze([
    'extensionEnabled', 'filterCriteria', 'whitelistCriteria', 'confidenceThreshold', 'hideMode', 'filterMode', 'language',
    'blurPreset', 'blurFlashcardTopic', 'blurCustomQuotes', 'blurRevealFriction'
  ]);

  // ASCII comma/semicolon plus the ideographic list marks used by zh/ja presets.
  const TOPIC_SPLIT = /[\n,;、，；]+/;
  // A leading or inline exception is a keep-topic, not another thing to hide.
  const EXCEPTION_SPLIT = /\s+(?:trừ|ngoại trừ|ngoại lệ|không ẩn|đừng ẩn|except|unless|but not|other than)\s+/i;
  const EXCEPTION_PREFIX = /^(?:trừ|ngoại trừ|ngoại lệ|không ẩn|đừng ẩn|except|unless|but not|other than)\s+(.+)$/i;

  /**
   * Split criteria into distinct topics (comma / semicolon / newline / ideographic
   * comma), folding whitespace and dropping case-insensitive duplicates.
   * Original case and order are kept. This is the raw list used for cache
   * identity. The model receives filterTopics(), which drops exception phrases.
   *
   * @param {string} criteria
   * @returns {string[]}
   */
  function criteriaTopics(criteria) {
    const seen = new Set();
    const topics = [];
    String(criteria || '').normalize('NFC').split(TOPIC_SPLIT).forEach((raw) => {
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
   * Hide-topics stay in state.criteria. Exception phrases ("trừ X", "except X")
   * become keep-topics so they are not classified as something to hide.
   * @param {string} criteria
   * @returns {{hide: string[], except: string[]}}
   */
  function partitionCriteria(criteria) {
    const hide = [];
    const except = [];
    const seenHide = new Set();
    const seenExcept = new Set();
    const push = (list, seen, topic) => {
      const text = String(topic || '').replace(/\s+/g, ' ').trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      list.push(text);
    };
    criteriaTopics(criteria).forEach((segment) => {
      segment.split(EXCEPTION_SPLIT).forEach((piece, index) => {
        const prefixed = piece.match(EXCEPTION_PREFIX);
        if (index === 0 && !prefixed) push(hide, seenHide, piece);
        else push(except, seenExcept, prefixed ? prefixed[1] : piece);
      });
    });
    return { hide, except };
  }

  function filterTopics(criteria) {
    return partitionCriteria(criteria).hide;
  }

  function exceptionTopics(criteria) {
    return partitionCriteria(criteria).except;
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
    root.JevFB.filterTopics = filterTopics;
    root.JevFB.exceptionTopics = exceptionTopics;
    root.JevFB.criteriaFingerprint = criteriaFingerprint;
    root.__jevDefaults = {
      DEFAULT_SETTINGS, PUBLIC_SETTING_KEYS, criteriaTopics, filterTopics, exceptionTopics, criteriaFingerprint
    };
  }
})(typeof self !== 'undefined' ? self : globalThis);
