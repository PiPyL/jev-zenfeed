/**
 * Facebook DOM Selectors & Resilient Query Helpers
 * Designed to survive Facebook's frequent obfuscation updates by relying on semantic attributes.
 */

// Global namespace for content scripts
window.JevFB = window.JevFB || {};

(function() {
  const JevFB = window.JevFB;

  // Facebook (2025+) no longer marks News Feed posts with role="feed"/"article"
  // (role="article" is now used for COMMENTS). Posts are found through the
  // ad-rendering markers instead, then resolved up to the whole post card.
  const ANCHOR_SELECTOR = '[data-ad-rendering-role="profile_name"], [data-ad-rendering-role="story_message"]';
  const LEGACY_SELECTOR = 'div[role="article"], div[aria-posinset], div[data-pagelet^="FeedUnit"], ' +
    'div[data-pagelet^="TimelineStory"], div[role="feed"] > div';
  // Post action bar buttons (Like / Comment) — present on the card, not on the text block
  const ACTION_SELECTOR = '[aria-label="Thích"], [aria-label="Like"], [aria-label="Bình luận"], ' +
    '[aria-label="Comment"], [aria-label="Viết bình luận"], [aria-label="Leave a comment"]';
  const COMMENT_LABEL = /^(comment|reply|bình luận|phản hồi|trả lời)/i;
  const MAX_CARD_DEPTH = 25;
  const MAX_EXCLUSIVE_CLIMB = 6;

  function isInComment(el) {
    const article = el.closest('[role="article"]');
    return !!article && COMMENT_LABEL.test(article.getAttribute('aria-label') || '');
  }

  function isPageRoot(el) {
    return !el || el === document.body || el === document.documentElement || el.getAttribute('role') === 'main';
  }

  /** True if `el` contains an anchor/action that belongs outside `own` (i.e. another post). */
  function hasForeignAnchor(el, own) {
    for (const a of el.querySelectorAll(ANCHOR_SELECTOR)) {
      if (!own.contains(a) && !isInComment(a)) return true;
    }
    return false;
  }

  /**
   * Resolve a post marker (author name / message block) to the whole post card.
   * Fallback when there is no data-virtualized wrapper (groups, profiles...):
   *  1. smallest ancestor that also holds the post's action bar (Like/Comment) —
   *     this also merges the inner author of a SHARED post into the same card;
   *  2. then climb while the parent holds nothing from another post, so the
   *     card frame (header, media, footer) is included.
   */
  function resolveCardFromAnchor(anchor) {
    // Current News Feed: every post sits in its own virtualization wrapper
    // (<div data-virtualized="false|true">). It survives FB swapping the post's
    // content in/out while scrolling, so it is the most stable container.
    const virt = anchor.closest('[data-virtualized]');
    if (virt && !isPageRoot(virt)) return virt;

    let card = null;
    let el = anchor.parentElement;
    for (let d = 0; el && !isPageRoot(el) && d < MAX_CARD_DEPTH; d++, el = el.parentElement) {
      if (hasForeignAnchor(el, anchor)) break; // reached the feed list — no action bar of our own
      const action = [...el.querySelectorAll(ACTION_SELECTOR)].some(b => !isInComment(b));
      if (action) { card = el; break; }
    }
    if (!card) card = anchor;

    for (let i = 0; i < MAX_EXCLUSIVE_CLIMB; i++) {
      const parent = card.parentElement;
      if (isPageRoot(parent) || hasForeignAnchor(parent, card)) break;
      // Only climb through pure wrappers: never absorb visible siblings
      // (composer, stories, "People you may know"...)
      const cur = card;
      if ([...parent.children].some(c => c !== cur && c.offsetHeight > 0)) break;
      card = parent;
    }
    return card;
  }

  /** anchor -> resolved card, reused while the card still wraps the anchor */
  const cardCache = new WeakMap();

  function cardFor(anchor) {
    const cached = cardCache.get(anchor);
    if (cached && cached.isConnected && cached.contains(anchor)) return cached;
    const card = resolveCardFromAnchor(anchor);
    cardCache.set(anchor, card);
    return card;
  }

  /**
   * Query all existing post units currently on page
   * @returns {HTMLElement[]}
   */
  JevFB.getAllPosts = function() {
    const found = new Set();

    document.querySelectorAll(ANCHOR_SELECTOR).forEach(anchor => {
      if (anchor.closest('.jev-ui') || isInComment(anchor)) return;
      if (!cardCache.has(anchor)) {
        // New anchor already inside a resolved card (e.g. its message block):
        // adopt that card instead of walking the DOM, and remember it.
        for (const c of found) {
          if (c.contains(anchor)) { cardCache.set(anchor, c); return; }
        }
      }
      // Set de-duplicates; cardFor is a cached lookup after the first scan.
      found.add(cardFor(anchor));
    });

    document.querySelectorAll(LEGACY_SELECTOR).forEach(el => {
      if (isInComment(el) || el.getAttribute('role') === 'article' && el.closest('[role="article"]') !== el) return;
      if (!el.querySelector('div[dir="auto"], span[dir="auto"]')) return;
      const container = JevFB.getTopPostContainer(el);
      if (container && container !== document.body) found.add(container);
    });

    // Drop containers nested in another one (never double-process a post).
    // Ancestor walk + Set lookup: O(n · depth) instead of O(n²) contains().
    return [...found].filter(c => {
      for (let p = c.parentElement; p; p = p.parentElement) {
        if (found.has(p)) return false;
      }
      return true;
    });
  };

  /**
   * Resolve to the outermost container of the post (legacy markup)
   * Avoids selecting comments or inner media
   * @param {HTMLElement} el
   * @returns {HTMLElement}
   */
  JevFB.getTopPostContainer = function(el) {
    if (!el) return null;

    // F8 fast path: the direct child of the feed IS the post container.
    const feedChild = el.closest && el.closest('div[role="feed"] > div');
    if (feedChild) return feedChild;

    const feedUnit = el.closest && el.closest('div[aria-posinset]');
    if (feedUnit) return feedUnit;

    let current = el;
    let depth = 0;
    const MAX_DEPTH = 20; // F8: raised from 10 — FB nests comments/articles deeply

    while (current && current.parentElement && depth < MAX_DEPTH) {
      depth++;
      const parent = current.parentElement;

      if (parent.getAttribute('role') === 'feed' || parent.getAttribute('data-pagelet') === 'ProfileTimeline') {
        return current;
      }

      if (current.getAttribute('role') === 'article' && !parent.closest('div[role="article"]')) {
        return current;
      }

      current = parent;
    }

    return el;
  };
})();
