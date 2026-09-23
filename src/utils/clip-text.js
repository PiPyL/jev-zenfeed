/**
 * Post-text clipping — SINGLE SOURCE OF TRUTH
 *
 * A binary classifier needs the hook, the middle (where the reveal or the
 * pitch usually sits), and the tail (links and contacts). Shared by the
 * content script (clips BEFORE the message crosses the runtime-messaging
 * bridge) and the service worker (clips what it sends to the API). The
 * decision hash is this same clipped string, so two posts share a cache
 * entry only when the model would see the same text.
 *
 * Dual-mode module (same pattern as fast-hash.js):
 *   1. Content script (classic): registers window.JevFB.clipPostText
 *   2. Service worker (ES module): side-effect import registers self.__jevClipText
 */
(function registerClipText(root) {
  const CLIP_HEAD_CHARS = 600;
  const CLIP_MID_CHARS = 200;
  const CLIP_TAIL_CHARS = 200;

  function clipPostText(text) {
    const t = text || '';
    const limit = CLIP_HEAD_CHARS + CLIP_MID_CHARS + CLIP_TAIL_CHARS;
    if (t.length <= limit) return t;
    const tailStart = t.length - CLIP_TAIL_CHARS;
    const midStart = Math.min(
      Math.max(CLIP_HEAD_CHARS, Math.floor((t.length - CLIP_MID_CHARS) / 2)),
      tailStart - CLIP_MID_CHARS
    );
    const mid = t.slice(midStart, midStart + CLIP_MID_CHARS);
    return `${t.slice(0, CLIP_HEAD_CHARS)} … ${mid} … ${t.slice(-CLIP_TAIL_CHARS)}`;
  }

  if (root) {
    root.JevFB = root.JevFB || {};
    root.JevFB.clipPostText = clipPostText;
    root.__jevClipText = clipPostText;
  }
})(typeof self !== 'undefined' ? self : globalThis);
