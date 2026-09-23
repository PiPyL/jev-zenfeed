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
  const TEXT_SELECTOR = 'div[dir="auto"], span[dir="auto"]';
  const AUTHOR_SELECTOR = '[data-ad-rendering-role="profile_name"], h2, h3, h4, strong, a[role="link"] span[dir="auto"]';
  const COMMENT_LABEL = /^(comment|reply|bình luận|phản hồi|trả lời)/i;
  const GENERIC_ALT = /^(có thể là|may be)\b/i;

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

    // Comments are rendered as nested role="article" blocks (usually inside ul/li)
    let el = node.parentElement;
    while (el && el !== postEl) {
      if (el.tagName === 'UL' || el.tagName === 'LI') return true;
      if (el.getAttribute('role') === 'article' && COMMENT_LABEL.test(el.getAttribute('aria-label') || '')) return true;
      el = el.parentElement;
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
    return 'Người dùng Facebook';
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

    // Auxiliary text from meaningful image alt text (short/media posts)
    for (const img of postEl.querySelectorAll('img[alt]')) {
      const alt = (img.getAttribute('alt') || '').trim();
      if (!alt || alt.length < 4 || GENERIC_ALT.test(alt) || isExcluded(img, postEl)) continue;
      if (!seen.has(alt)) {
        seen.add(alt);
        parts.push(`[Hình ảnh: ${alt.slice(0, 150)}]`);
      }
    }

    return parts.join('\n').trim();
  }

  /**
   * Extract clean text, author, and metadata from a Facebook post container
   * @param {HTMLElement} postEl
   * @returns {{text: string, author: string, hash: string, head: string, notReady?: boolean}|null}
   *   hash — fingerprint of the full content (decision cache key)
   *   head — beginning of the body; with the author it identifies the post
   *          across "See more" expansion (see JevFB.isSamePost)
   */
  JevFB.extractPostData = function(postEl) {
    if (!postEl) return null;

    const author = extractAuthor(postEl);
    const fullText = extractBody(postEl);

    // Too short => lazy content not rendered yet (caller retries)
    if (!fullText || fullText.length < 10) {
      return { notReady: true };
    }

    // Combine author, length, head (500 chars), and tail (300 chars) to prevent collision on boilerplate intros
    const textFingerprint = fullText.length <= 800
      ? fullText
      : `${fullText.slice(0, 500)}:::len_${fullText.length}:::${fullText.slice(-300)}`;
    const hash = JevFB.fastHash(`${author}:::${textFingerprint}`);
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
