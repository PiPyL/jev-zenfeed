/**
 * Facebook Post Text & Metadata Extractor
 * Extracts readable post text, cleans UI noise, and generates deterministic content hashes.
 */

window.JevFB = window.JevFB || {};

(function() {
  const JevFB = window.JevFB;

  // Words that indicate UI buttons rather than post body
  const UI_STOP_WORDS = new Set([
    'thích', 'bình luận', 'chia sẻ', 'like', 'comment', 'share',
    'xem thêm', 'see more', 'viết bình luận...', 'write a comment...',
    'công khai', 'public', 'bạn bè', 'friends', 'vừa xong', 'just now',
    'theo dõi', 'follow', 'tham gia', 'join'
  ]);

  // Explicit post-body markers Facebook puts on the message block
  const MESSAGE_SELECTOR = '[data-ad-preview="message"], [data-ad-comet-preview="message"], [data-ad-rendering-role="story_message"]';
  const ATTACHMENT_SELECTOR = '[data-ad-preview="title"], [data-ad-preview="subtitle"], [data-ad-rendering-role="title"], [data-ad-rendering-role="description"]';
  const TEXT_SELECTOR = 'div[dir="auto"], span[dir="auto"]';
  const AUTHOR_SELECTOR = '[data-ad-rendering-role="profile_name"], h2, h3, h4, strong, a[role="link"] span[dir="auto"]';
  const COMMENT_LABEL = /^(comment|reply|bình luận|phản hồi|trả lời)/i;
  const GENERIC_ALT = /^(có thể là|may be)\b/i;
  const OCR_TEXT_REGEX = /(?:văn bản cho biết|text that says|chữ hiển thị)\s*['"“]([^'"”]+)['"”]/i;

  // Length of body prefix used for the element identity (see below)
  const IDENTITY_PREFIX_CHARS = 120;

  // NOTE: JevFB.fastHash is provided by src/utils/fast-hash.js (F12 single source)

  /**
   * True if `node` must not contribute text: our own injected UI, the comment
   * composer, action bars/menus, or anything inside a comment thread.
   * @param {Element} node
   * @param {Element} postEl
   */
  function isExcluded(node, postEl) {
    if (node.closest('.jev-ui, form, [role="toolbar"], [role="menu"], [aria-hidden="true"]')) return true;

    // Comments are rendered as nested role="article" blocks (usually inside
    // ul/li). Native closest() keeps this O(depth) in C++ instead of a JS walk.
    const list = node.closest('ul, li');
    if (list && list !== postEl && postEl.contains(list)) return true;
    let art = node.closest('[role="article"]');
    while (art && art !== postEl && postEl.contains(art)) {
      if (COMMENT_LABEL.test(art.getAttribute('aria-label') || '')) return true;
      art = art.parentElement && art.parentElement.closest('[role="article"]');
    }
    return false;
  }

  /**
   * Rendering-independent text. innerText depends on layout: once we collapse a
   * post (display:none) it silently falls back to textContent, so the SAME post
   * produced a different hash/identity while hidden -> "recycled node" reset ->
   * blur -> re-evaluate -> hide loop. textContent + whitespace folding is stable
   * whether the post is visible, collapsed, blurred or revealed.
   */
  function readText(node) {
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function extractAuthor(postEl) {
    for (const el of postEl.querySelectorAll(AUTHOR_SELECTOR)) {
      if (el.closest('.jev-ui')) continue; // never read our own banner ("Đã ẩn bài viết")
      const text = (el.textContent || '').trim();
      if (text) return text.split('\n')[0].trim();
    }
    return 'Facebook User';
  }

  /**
   * Collect body text. Only the OUTERMOST matching node of each nested chain is
   * read (innerText already includes descendants), so paragraphs are never sent twice.
   */
  function extractBody(postEl) {
    const parts = [];
    const seen = new Set();
    const push = (text) => {
      if (text && !seen.has(text)) {
        seen.add(text);
        parts.push(text);
      }
    };

    const messageBlocks = [...postEl.querySelectorAll(MESSAGE_SELECTOR)].filter(n => !isExcluded(n, postEl));
    if (messageBlocks.length > 0) {
      messageBlocks.forEach(n => push(readText(n)));
    } else {
      let lastTaken = null;
      for (const node of postEl.querySelectorAll(TEXT_SELECTOR)) {
        if (lastTaken && lastTaken.contains(node)) continue; // already covered by an ancestor
        if (isExcluded(node, postEl)) continue;
        const text = readText(node);
        if (!text || UI_STOP_WORDS.has(text.toLowerCase())) continue;
        lastTaken = node;
        push(text);
      }
    }

    // Auxiliary text from meaningful image alt text or Facebook auto-OCR text (short/media posts)
    for (const img of postEl.querySelectorAll('img[alt]')) {
      const alt = (img.getAttribute('alt') || '').trim();
      if (!alt || alt.length < 4 || isExcluded(img, postEl)) continue;
      const ocrMatch = alt.match(OCR_TEXT_REGEX);
      if (ocrMatch && ocrMatch[1]) {
        const text = ocrMatch[1].trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          parts.push(`[Image text: ${text.slice(0, 150)}]`);
        }
      } else if (!GENERIC_ALT.test(alt)) {
        if (!seen.has(alt)) {
          seen.add(alt);
          parts.push(`[Image: ${alt.slice(0, 150)}]`);
        }
      }
    }

    // Link titles and shared-preview text sit outside the caption. Include them
    // even when a message block exists, or a harmless caption hides the ad.
    for (const node of postEl.querySelectorAll(ATTACHMENT_SELECTOR)) {
      if (isExcluded(node, postEl) || node.closest(MESSAGE_SELECTOR)) continue;
      const text = readText(node);
      if (!text || text.length < 2 || UI_STOP_WORDS.has(text.toLowerCase())) continue;
      push(text);
    }

    return parts.join('\n').trim();
  }

  /**
   * Extract clean text, author, and metadata from a Facebook post container
   * @param {HTMLElement} postEl
   * @returns {{text: string, author: string, hash: string, head: string, notReady?: boolean}|null}
   *   hash — fingerprint of the clipped text sent to the model (decision cache key)
   *   head — beginning of the body; with the author it identifies the post
   *          across "See more" expansion (see JevFB.isSamePost)
   */
  JevFB.extractPostData = function(postEl) {
    if (!postEl) return null;

    const author = extractAuthor(postEl);
    const fullText = extractBody(postEl);

    // Text-only stubs under 10 chars are usually still loading. A short hook
    // next to an image or a link preview is the whole ad, so score it.
    const hasMedia = !!postEl.querySelector('img, video, [data-ad-preview="title"]');
    const minChars = hasMedia ? 4 : 10;
    if (!fullText || fullText.length < minChars) {
      return { notReady: true };
    }

    // Hash the exact string the model will see. Head/tail-only fingerprints
    // reused a decision for posts that differed in the middle.
    const payload = JevFB.clipPostText ? JevFB.clipPostText(fullText) : fullText;
    const hash = JevFB.fastHash(`${author}:::${payload}`);
    const head = fullText.slice(0, IDENTITY_PREFIX_CHARS);

    return { author, text: fullText, hash, head };
  };

  /**
   * True if `next` is the same post as `prev` (possibly expanded or trimmed),
   * false if Facebook recycled the DOM node for a different post. Compared as
   * a prefix relation, so a short post that grows past the head length via
   * "See more" is still recognized as the same post.
   * @param {{author: string, head: string}} prev
   * @param {{author: string, head: string}} next
   */
  JevFB.isSamePost = function(prev, next) {
    if (prev.author !== next.author) return false;
    return next.head.startsWith(prev.head) || prev.head.startsWith(next.head);
  };
})();
