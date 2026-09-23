/**
 * Zen Data — Curated Mindfulness Quotes & Affirmations
 * Dual-mode module (same pattern as fast-hash.js / settings-defaults.js):
 *   1. Content script (classic): registers window.JevFB.zenData
 *   2. Service worker / Node: registers self.__jevZenData
 */
(function registerZenData(root) {
  const ZEN_QUOTES = {
    vi: [
      { text: "Hít một hơi thật sâu. Không gian này dành cho sự bình yên của bạn.", author: "ZenFeed Sanctuary" },
      { text: "Bình yên không phải là nơi không có tiếng ồn, mà là tĩnh lặng giữa những ồn ào.", author: "Khuyết danh" },
      { text: "Bạn không thể kiểm soát những gì xuất hiện trên mạng, nhưng bạn kiểm soát được sự chú ý của mình.", author: "Marcus Aurelius" },
      { text: "Tâm trí giống như mặt nước. Khi tĩnh lặng, mọi thứ trở nên sáng rõ.", author: "Lão Tử" },
      { text: "Dành 3 giây này để thở chậm lại. Bạn đang làm chủ không gian số của mình.", author: "ZenFeed" },
      { text: "Những gì bạn từ chối tiếp nhận cũng quan trọng như những gì bạn đón nhận.", author: "Seneca" },
      { text: "Mỗi nhịp thở là một cơ hội để buông bỏ những xao nhãng không cần thiết.", author: "Thích Nhất Hạnh" },
      { text: "Tập trung là nghệ thuật của việc biết từ chối hàng ngàn điều thừa thãi.", author: "Steve Jobs" },
      { text: "Giữ tâm thanh thản giữa dòng thông tin cuộn xoáy.", author: "Triết lý Stoic" },
      { text: "Một khoảng lặng nhỏ giữa các bài viết là món quà cho đôi mắt của bạn.", author: "ZenFeed" },
      { text: "Đừng để tâm trí bạn trở thành bãi rác cho những giật gân của người khác.", author: "Epictetus" },
      { text: "Sự hiện diện trong giây phút này là báu vật quý giá nhất.", author: "Eckhart Tolle" },
      { text: "Thả lỏng vai, thả lỏng trán, mỉm cười nhẹ và tiếp tục ngày tuyệt vời của bạn.", author: "Mindful Living" },
      { text: "Thế giới sẽ không ngừng huyên náo, việc của bạn là giữ cho mình sự an yên.", author: "Khuyết danh" },
      { text: "Bảo vệ sự tập trung của bạn như bảo vệ tài sản quý giá nhất.", author: "Cal Newport" }
    ],
    en: [
      { text: "Take a deep breath. This space is reserved for your peace of mind.", author: "ZenFeed Sanctuary" },
      { text: "Peace is not the absence of noise, but calm within the chaos.", author: "Unknown" },
      { text: "You cannot control the feed, but you can control your attention.", author: "Marcus Aurelius" },
      { text: "The mind is like water. When calm, everything becomes clear.", author: "Lao Tzu" },
      { text: "Take 3 seconds to pause. You are in control of your digital sanctuary.", author: "ZenFeed" },
      { text: "What you choose to ignore is as important as what you focus on.", author: "Seneca" },
      { text: "Smile, breathe, and go slowly.", author: "Thich Nhat Hanh" },
      { text: "Focus is about saying no to a thousand things.", author: "Steve Jobs" },
      { text: "Keep a calm mind amidst the rushing stream of noise.", author: "Stoic Wisdom" },
      { text: "A mindful pause between posts is a gift to your eyes and mind.", author: "ZenFeed" },
      { text: "Do not let other people's chaos invade your mental sanctuary.", author: "Epictetus" },
      { text: "Realize deeply that the present moment is all you have.", author: "Eckhart Tolle" },
      { text: "Drop your shoulders, soften your gaze, and breathe deeply.", author: "Mindful Living" },
      { text: "Protect your focus as your most precious currency.", author: "Cal Newport" }
    ]
  };

  // LRU ring buffer to avoid repeating recent quotes
  const recentIndices = [];
  const MAX_RECENT = 5;

  function getRandomQuote(lang, customQuotes) {
    // If user provided custom quotes (newline separated string or array)
    if (customQuotes) {
      const list = Array.isArray(customQuotes)
        ? customQuotes
        : String(customQuotes).split('\n').map(s => s.trim()).filter(Boolean);
      if (list.length > 0) {
        const idx = Math.floor(Math.random() * list.length);
        return { text: list[idx], author: 'Custom' };
      }
    }

    const quotes = ZEN_QUOTES[lang] || ZEN_QUOTES.vi;
    let available = quotes.map((_, i) => i).filter(i => !recentIndices.includes(i));
    if (available.length === 0) {
      recentIndices.length = 0;
      available = quotes.map((_, i) => i);
    }

    const chosenIdx = available[Math.floor(Math.random() * available.length)];
    recentIndices.push(chosenIdx);
    if (recentIndices.length > MAX_RECENT) recentIndices.shift();

    return quotes[chosenIdx];
  }

  const zenData = {
    quotes: ZEN_QUOTES,
    getRandomQuote: getRandomQuote
  };

  if (root) {
    root.JevFB = root.JevFB || {};
    root.JevFB.zenData = zenData;
    root.__jevZenData = zenData;
  }
})(typeof self !== 'undefined' ? self : globalThis);
