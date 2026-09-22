/**
 * FNV-1a 32-bit Fast Hash — SINGLE SOURCE OF TRUTH (F12)
 *
 * Dual-mode module:
 *   1. Content script (classic): registers window.JevFB.fastHash
 *   2. Service worker (ES module): side-effect import registers self.__jevFastHash
 *
 * NOTE: 32-bit FNV-1a is a fast fingerprint, NOT a cryptographic hash.
 * Combined with author + length + head/tail sampling in text-extractor.js,
 * collision risk at cache scale (<=3000 entries) is negligible.
 */
(function registerFastHash(root) {
  function fastHash(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16);
  }

  if (root) {
    root.JevFB = root.JevFB || {};
    root.JevFB.fastHash = fastHash;
    root.__jevFastHash = fastHash;
  }
})(typeof self !== 'undefined' ? self : globalThis);
