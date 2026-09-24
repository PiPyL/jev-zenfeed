/**
 * Threads (threads.com) DOM Selectors & Resilient Query Helpers
 *
 * Implements the SAME contract as fb-selectors.js so the platform-agnostic
 * engine (content.js) runs unchanged on threads.com / threads.net:
 *   JevFB.isNewsFeedRoute()      — whitelist of the home feed routes
 *   JevFB.isInFeedRegion(el)     — a feed post card, not a dialog/rail surface
 *   JevFB.getPostsWithin(root)   — feed post cards under `root`
 *   JevFB.getAllPosts()          — feed post cards on the page
 *
 * Threads web (Meta Barcelona stack, verified on logged-out threads.com and
 * logged-in single-column + multi-column layouts, 2026-09) renders every feed
 * post as a `div[data-pressable-container="true"]` that ALWAYS contains a post
 * permalink (`a[href="/@handle/post/ID"]`) and a `<time datetime>` element.
 * Anchoring on that pair survives Meta's obfuscated class churn the same way
 * the Facebook selectors rely on ad-rendering markers. `data-pagelet` values
 * differ between sessions ("threads_logged_out_feed_{n}" vs "threads_feed_{n}"
 * with a literal "{n}") and are deliberately NOT used.
 */

// Global namespace for content scripts (shared with the Facebook modules;
// each platform only ever loads its own selector/extractor pair — see the
// per-platform content_scripts entries in manifest.json).
window.JevFB = window.JevFB || {};

(function() {
  const JevFB = window.JevFB;

  const POST_CONTAINER_SELECTOR = 'div[data-pressable-container="true"]';
  const PERMALINK_SELECTOR = 'a[href*="/post/"]';

  // ZenFeed only filters the home feeds (For You / Following, chronological
  // /latest, and the multi-column home which lives on one of these routes).
  // Everything else — /search, profile pages, /@user/post/ID thread views,
  // /insights, /saved, custom feeds — is out of scope, mirroring the Facebook
  // whitelist of News Feed paths. `/` covers the logged-out landing feed and
  // the logged-in default home.
  const NEWS_FEED_PATHS = new Set(['/', '/for_you', '/following', '/latest']);

  /** Home feed route — not search, profiles, thread pages, settings... */
  JevFB.isNewsFeedRoute = function() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return NEWS_FEED_PATHS.has(path);
  };

  /**
   * A pressable container is a feed post card only while it carries its own
   * permalink and timestamp; the composer, "Add a column", people-to-follow
   * cells and other pressable surfaces never do. Post detail modals and
   * floating composer dialogs are excluded explicitly (the route whitelist
   * already keeps the modal's /@user/post/ID history state out, but the modal
   * can render before the history entry swaps).
   */
  function isInFeedRegion(el) {
    const card = el.closest && el.closest(POST_CONTAINER_SELECTOR);
    if (!card) return false;
    if (!card.querySelector(PERMALINK_SELECTOR) || !card.querySelector('time')) return false;
    if (card.closest('[role="dialog"], [aria-modal="true"]')) return false;
    return true;
  }
  JevFB.isInFeedRegion = isInFeedRegion;

  /**
   * The pressable container IS the post card (header, text, media, action
   * bar all live inside it), so there is no climb step like Facebook's
   * virtualization-wrapper resolution. Quoted posts embedded inside a card
   * are nested pressable containers — the outermost-wins filter in
   * getPostsWithin keeps them from being processed as separate feed posts.
   */
  function cardFor(pressable) {
    return pressable;
  }

  /**
   * Query all feed post cards currently under `root`.
   * @returns {HTMLElement[]}
   */
  JevFB.getPostsWithin = function(root = document) {
    if (!JevFB.isNewsFeedRoute()) return [];
    const found = new Set();
    const queryAll = (selector) => {
      const matches = [];
      if (root.nodeType === 1 && root.matches && root.matches(selector)) matches.push(root);
      root.querySelectorAll(selector).forEach(el => matches.push(el));
      return matches;
    };

    queryAll(POST_CONTAINER_SELECTOR).forEach(pressable => {
      if (pressable.closest('.jev-ui')) return;
      if (!isInFeedRegion(pressable)) return;
      found.add(cardFor(pressable));
    });

    // Drop containers nested in another one: a quoted post inside its parent's
    // card must never be processed twice (same rule as Facebook's shared
    // previews and X's quoted tweets).
    return [...found].filter(c => {
      for (let p = c.parentElement; p; p = p.parentElement) {
        if (found.has(p)) return false;
      }
      return true;
    });
  };

  JevFB.getAllPosts = function() {
    return JevFB.getPostsWithin(document);
  };

  /**
   * Parity helper with fb-selectors.js (legacy markup path). The pressable
   * container is the outermost post card on Threads, so this resolves to the
   * enclosing card when `el` sits inside one, else `el` itself.
   */
  JevFB.getTopPostContainer = function(el) {
    if (!el || !el.closest) return el;
    const pressable = el.closest(POST_CONTAINER_SELECTOR);
    return pressable || el;
  };

  /**
   * Determine if an element represents a feed boundary (e.g. column, feed root, body)
   * beyond which we must not look for grouped thread replies.
   */
  function isFeedBoundary(el) {
    if (!el || el === document.body || el === document.documentElement) return true;
    if (el.id === 'feedColumn') return true;
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'region' || role === 'feed' || role === 'main') return true;
    if (el.tagName === 'MAIN') return true;
    const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
    if (ariaLabel === 'Column body') return true;
    return false;
  }
  JevFB.isFeedBoundary = isFeedBoundary;

  /**
   * Return valid top-level post cards under `root` (excluding quoted posts nested inside cards).
   */
  function getFeedCardsUnder(root) {
    if (!root || !root.querySelectorAll) return [];
    const matches = root.querySelectorAll(POST_CONTAINER_SELECTOR);
    const valid = [];
    matches.forEach(p => {
      if (p.closest && p.closest('.jev-ui')) return;
      if (!isInFeedRegion(p)) return;
      valid.push(p);
    });
    const set = new Set(valid);
    return valid.filter(c => {
      for (let p = c.parentElement; p && p !== root; p = p.parentElement) {
        if (set.has(p)) return false;
      }
      return true;
    });
  }

  /**
   * Find the enclosing container for a single thread item (root post + its replies).
   */
  function getThreadContainer(postEl) {
    if (!postEl || !postEl.parentElement) return null;

    // 1. In production Threads web, each feed item is enclosed in a data-pagelet
    const pagelet = postEl.closest && postEl.closest('[data-pagelet]');
    if (pagelet && !isFeedBoundary(pagelet)) {
      const cards = getFeedCardsUnder(pagelet);
      if (cards.length > 0 && cards.length <= 8) return pagelet;
    }

    // 2. Otherwise walk up ancestors looking for the thread item container
    let curr = postEl.parentElement;
    while (curr && !isFeedBoundary(curr)) {
      const cards = getFeedCardsUnder(curr);
      if (cards.length > 1) {
        if (cards.length <= 8) return curr;
        return null;
      }
      if (!curr.parentElement || isFeedBoundary(curr.parentElement)) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }
  JevFB.getThreadContainer = getThreadContainer;

  /**
   * Get all reply post cards belonging to this root post in the feed.
   * If postEl is not the root of a multi-post thread item, returns [].
   */
  function getThreadReplies(postEl) {
    if (!postEl) return [];
    const container = getThreadContainer(postEl);
    if (!container) return [];
    const cards = getFeedCardsUnder(container);
    if (cards.length > 1 && cards[0] === postEl) {
      return cards.slice(1);
    }
    return [];
  }
  JevFB.getThreadReplies = getThreadReplies;

  /**
   * Get the root post card for a given reply card, or null if postEl is itself root/standalone.
   */
  function getRootPost(postEl) {
    if (!postEl) return null;
    const container = getThreadContainer(postEl);
    if (!container) return null;
    const cards = getFeedCardsUnder(container);
    if (cards.length > 1 && cards[0] !== postEl && cards.includes(postEl)) {
      return cards[0];
    }
    return null;
  }
  JevFB.getRootPost = getRootPost;

  /**
   * Check if postEl is a reply whose parent root post is currently hidden.
   */
  function isReplyOfHiddenPost(postEl) {
    const root = getRootPost(postEl);
    if (!root) return false;
    return root.dataset.jevStatus === 'hidden' && !root.classList.contains('jev-revealed');
  }
  JevFB.isReplyOfHiddenPost = isReplyOfHiddenPost;

  // Mark the platform for the shared stylesheet: Threads toggles dark mode
  // with the same `__fb-dark-mode` class Facebook uses on <html>, so the CSS
  // needs a platform marker to theme Threads dark without touching Facebook's
  // own dark palette (see the Threads section at the end of content.css).
  // Cheap idempotent write here also proves this platform's selectors loaded.
  // Guarded so the module stays importable outside a browser (node test).
  if (typeof document !== 'undefined') {
    if (document.documentElement) {
      document.documentElement.classList.add('jev-platform-threads');
    } else {
      document.addEventListener('DOMContentLoaded', () =>
        document.documentElement.classList.add('jev-platform-threads'), { once: true });
    }
  }
})();
