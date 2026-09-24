/**
 * Threads (threads.com) Post Text & Metadata Extractor
 *
 * Implements the SAME contract as text-extractor.js (Facebook) so the
 * platform-agnostic engine and decision cache work unchanged:
 *   JevFB.extractPostData(postEl) -> {text, author, hash, head, notReady?}
 *   JevFB.isSamePost(prev, next)  — DOM-recycling identity check
 *
 * The hash pipeline (author:::clipped text -> FNV-1a) is deliberately the
 * same as Facebook's: the same content seen on both platforms shares one
 * decision-cache entry.
 *
 * Threads structure (verified on logged-out + logged-in DOM, 2026-09): text
 * lives in leaf `div/span[dir="auto"]` nodes scattered through the card, and
 * the action bar counts ("2", "9.2K"), the relative time ("6h", inside the
 * permalink <a>) and the author name (inside the profile link) are ALSO
 * dir="auto" leaves. Body collection therefore keeps only leaves that are
 * none of those, and strips nested control subtrees (the in-body "Translate"
 * button) the way the Facebook extractor strips comment blocks.
 */

window.JevFB = window.JevFB || {};

(function() {
  const JevFB = window.JevFB;

  // Whole-node UI labels that must never read as post body (exact match,
  // lowercase). Covers the card header/footer chrome rendered as text:
  // "More" menu, "Follow", the "First thread" badge, in-body "Translate".
  const UI_STOP_WORDS = new Set([
    'more', 'see more', 'translate', 'follow', 'following', 'unfollow',
    'like', 'reply', 'repost', 'quote', 'share', 'first thread', 'pinned',
    'view', 'hide', 'report', 'block', 'copy link', 'not interested',
    'save', 'pin to profile', 'view activity', 'done', 'cancel', 'post',
    'reposted', 'quoted', 'suggested for you'
  ]);

  const LEAF_TEXT_SELECTOR = 'div[dir="auto"], span[dir="auto"]';
  const PERMALINK_SELECTOR = 'a[href*="/post/"]';
  const PROFILE_LINK_SELECTOR = 'a[href^="/@"]';
  const AUTHOR_NAME_SELECTOR = 'span[dir="auto"][translate="no"]';
  // Threads profile/media images carry "<handle>'s profile picture" alts;
  // real post media alts describe the image content instead.
  const AVATAR_ALT = /['’]s profile picture$/i;
  // Pure engagement counters ("2", "9.2K", "1,234", "999+"). They are the
  // only dir="auto" leaves inside action-bar buttons.
  const NUMERIC_ONLY = /^[\d.,\s]*[\dKkMmBb+]\s*$/;
  // Relative timestamps ("6h", "30m", "Mar 5", "Sep 1") that slip past the
  // permalink-link exclusion when Threads renders the time outside it.
  const TIME_LIKE = /^(now|\d+\s*(s|m|h|d|w)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\d+\s+(giây|phút|giờ|ngày|tuần|tuần trước|năm))/i;

  // Length of body prefix used for the element identity (same as Facebook)
  const IDENTITY_PREFIX_CHARS = 120;

  /**
   * Rendering-independent text (same rationale as the Facebook extractor):
   * textContent + whitespace folding stays stable across collapse, blur and
   * Threads' virtualized re-renders. Skips control subtrees that sit INSIDE a
   * text block — most importantly the in-body "Translate" button, whose label
   * would otherwise be appended to the post text the model sees.
   */
  function collectText(node) {
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.nodeValue || '';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.closest('.jev-ui, svg, time, [role="button"], [aria-hidden="true"]')) continue;
        out += collectText(child);
      }
    }
    return out;
  }

  function readText(node) {
    return collectText(node).replace(/\s+/g, ' ').trim();
  }

  /**
   * Author identity. The permalink href "/@handle/post/ID" is the only fully
   * stable source (class names churn, the display-name link sometimes has no
   * text). The display name from `span[translate="no"]` is appended when it
   * differs from the handle, so two accounts with the same display name never
   * share one cache identity.
   */
  function extractAuthor(postEl) {
    const permalink = postEl.querySelector(PERMALINK_SELECTOR);
    const handleMatch = permalink && (permalink.getAttribute('href') || '').match(/^\/@([^/?#]+)/);
    const handle = handleMatch ? handleMatch[1] : '';

    let name = '';
    if (handle) {
      const authorLink = postEl.querySelector(`a[href="/@${handle}"]`);
      if (authorLink) {
        const nameEl = authorLink.querySelector(AUTHOR_NAME_SELECTOR) || authorLink.querySelector('span[dir="auto"]');
        if (nameEl) name = readText(nameEl);
        if (!name) {
          const label = authorLink.getAttribute('aria-label');
          if (label) name = label;
        }
      }
    }

    if (!name) {
      const nameEl = postEl.querySelector(AUTHOR_NAME_SELECTOR);
      if (nameEl) name = readText(nameEl);
    }

    if (!name) {
      for (const link of postEl.querySelectorAll(PROFILE_LINK_SELECTOR)) {
        if (link.getAttribute('href')?.includes('/post/')) continue;
        const label = link.getAttribute('aria-label');
        if (label) { name = label; break; }
      }
    }

    if (!handle && !name) return 'Threads User';
    if (!name || name === handle) return handle || name;
    return `${name} (@${handle})`;
  }

  /** True while `node` belongs to the post itself, not an embedded quoted post. */
  function isOwnNode(postEl, node) {
    const inner = node.closest('div[data-pressable-container="true"]');
    return !inner || inner === postEl;
  }

  /**
   * Collect body text. Only the OUTERMOST dir="auto" node of each nested chain
   * is read (so paragraphs are never sent twice), then filtered:
   *   - inside the permalink link  -> relative time ("6h"), never body
   *   - inside the profile link    -> author display name
   *   - text equal to the handle   -> author name rendered without a link
   *   - numeric-only leaves        -> Like/Reply/Repost counts
   *   - topic tags                 -> KEPT (they describe the post)
   * Embedded quoted posts (nested pressable containers) are appended with a
   * [Quoted:] prefix — a harmless caption must not hide what a quote carries
   * (same rule as the Facebook extractor's attachment pass).
   */
  function extractBody(postEl, handle) {
    const parts = [];
    const seen = new Set();
    const push = (prefix, text) => {
      if (!text) return;
      const line = prefix ? `${prefix} ${text}` : text;
      if (!seen.has(line)) {
        seen.add(line);
        parts.push(line);
      }
    };

    const leaves = [...postEl.querySelectorAll(LEAF_TEXT_SELECTOR)]
      .filter(n => !n.querySelector(LEAF_TEXT_SELECTOR)); // outermost of each chain only

    for (const node of leaves) {
      if (node.closest('.jev-ui')) continue;
      if (node.closest(PERMALINK_SELECTOR)) continue; // relative time ("6h")
      const profileLink = node.closest(PROFILE_LINK_SELECTOR);
      if (profileLink) {
        if (!handle || profileLink.getAttribute('href') === `/@${handle}` || profileLink.querySelector(AUTHOR_NAME_SELECTOR)) {
          continue;
        }
      }

      const text = readText(node);
      if (!text || text.length < 2) continue;
      if (handle && (text === handle || text === `@${handle}`)) continue;
      if (UI_STOP_WORDS.has(text.toLowerCase())) continue;
      // Repost context line ("Bạn Lan reposted") — the reposter name is a
      // skipped profile link but the trailing label can share the leaf.
      if (/(reposted|quoted)$/i.test(text) && text.length <= 60) continue;
      if (NUMERIC_ONLY.test(text)) continue;
      if (TIME_LIKE.test(text) && text.length <= 12) continue;
      if (isOwnNode(postEl, node)) {
        push('', text);
      } else {
        push('[Quoted:]', text);
      }
    }

    // Auxiliary text from meaningful image alt text (media-only posts)
    for (const img of postEl.querySelectorAll('img[alt]')) {
      const alt = (img.getAttribute('alt') || '').trim();
      if (!alt || alt.length < 4 || AVATAR_ALT.test(alt)) continue;
      if (img.closest('.jev-ui, [aria-hidden="true"]')) continue;
      push('[Image:]', alt.slice(0, 150));
    }

    return parts.join('\n').trim();
  }

  /**
   * Extract clean text, author, and metadata from a Threads post container
   * @param {HTMLElement} postEl
   * @returns {{text: string, author: string, hash: string, head: string, notReady?: boolean}|null}
   *   hash — fingerprint of the clipped text sent to the model (decision cache key)
   *   head — beginning of the body; with the author it identifies the post
   *          across "More" expansion (see JevFB.isSamePost)
   */
  JevFB.extractPostData = function(postEl) {
    if (!postEl) return null;

    const author = extractAuthor(postEl);
    const handleMatch = author.match(/@([^)]+)/);
    const handle = handleMatch ? handleMatch[1] : (author === 'Threads User' ? '' : author);
    const fullText = extractBody(postEl, handle);

    // Stub with almost no text is usually still rendering. A short hook next
    // to media or a link preview can be the whole ad, so score it.
    const hasMedia = [...postEl.querySelectorAll('img, video')]
      .some(m => !AVATAR_ALT.test(m.getAttribute('alt') || ''));
    const minChars = hasMedia ? 4 : 5;
    if (!fullText || fullText.length < minChars) {
      return { notReady: true };
    }

    // Hash the exact string the model will see (same pipeline as Facebook).
    const payload = JevFB.clipPostText ? JevFB.clipPostText(fullText) : fullText;
    const hash = JevFB.fastHash(`${author}:::${payload}`);
    const head = fullText.slice(0, IDENTITY_PREFIX_CHARS);

    return { author, text: fullText, hash, head };
  };

  /**
   * True if `next` is the same post as `prev` (possibly expanded or trimmed),
   * false if Threads recycled the DOM node for a different post. Compared as
   * a prefix relation, so a short post that grows past the head length via
   * "More" is still recognized as the same post.
   * @param {{author: string, head: string}} prev
   * @param {{author: string, head: string}} next
   */
  JevFB.isSamePost = function(prev, next) {
    if (prev.author !== next.author) return false;
    return next.head.startsWith(prev.head) || prev.head.startsWith(next.head);
  };
})();
