/**
 * Default settings — SINGLE SOURCE OF TRUTH (F14)
 *
 * Dual-mode (same pattern as fast-hash.js):
 *   1. Classic script (content script / popup): registers JevFB.DEFAULT_SETTINGS
 *   2. Service worker (ES module): side-effect import registers self.__jevDefaults
 *
 * PUBLIC_SETTING_KEYS lists what the content script may read — never the API key.
 */
(function registerDefaults(root) {
  const DEFAULT_SETTINGS = Object.freeze({
    extensionEnabled: true,
    apiKey: '',
    apiUrl: 'https://api.typesafe.ai/v1',
    filterCriteria: 'Quảng cáo cờ bạc, cá độ, vay nợ tài chính, tin tức giật gân sai sự thật, spoiler nội dung phim, bán nhà, cho thuê nhà hoặc tương tự',
    confidenceThreshold: 70,
    hideMode: 'banner',
    antiFoucBlur: true
  });

  const PUBLIC_SETTING_KEYS = Object.freeze([
    'extensionEnabled', 'filterCriteria', 'confidenceThreshold', 'hideMode', 'antiFoucBlur'
  ]);

  if (root) {
    root.JevFB = root.JevFB || {};
    root.JevFB.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    root.JevFB.PUBLIC_SETTING_KEYS = PUBLIC_SETTING_KEYS;
    root.__jevDefaults = { DEFAULT_SETTINGS, PUBLIC_SETTING_KEYS };
  }
})(typeof self !== 'undefined' ? self : globalThis);
