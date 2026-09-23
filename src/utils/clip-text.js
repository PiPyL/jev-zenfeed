/**
 * Post-text clipping — SINGLE SOURCE OF TRUTH
 *
 * A binary classifier needs the gist, not the whole essay: keep the head
 * (where the hook/offer usually is) and the tail (where links/contacts
 * usually are). Shared by the content script (clips BEFORE the message
 * crosses the runtime-messaging bridge, so full text and in-batch
 * duplicates are never serialized) and the service worker (clips what it
 * sends to the API).
 *
 * Dual-mode module (same pattern as fast-hash.js):
 *   1. Content script (classic): registers window.JevFB.clipPostText
 *   2. Service worker (ES module): side-effect import registers self.__jevClipText
 */
(function registerClipText(root) {
  const CLIP_HEAD_CHARS = 800;
  const CLIP_TAIL_CHARS = 200;

  function clipPostText(text) {
    const t = text || '';
    if (t.length <= CLIP_HEAD_CHARS + CLIP_TAIL_CHARS) return t;
    return `${t.slice(0, CLIP_HEAD_CHARS)} … ${t.slice(-CLIP_TAIL_CHARS)}`;
  }

  if (root) {
    root.JevFB = root.JevFB || {};
    root.JevFB.clipPostText = clipPostText;
    root.__jevClipText = clipPostText;
  }
})(typeof self !== 'undefined' ? self : globalThis);
