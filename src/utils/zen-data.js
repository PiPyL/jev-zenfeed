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
      { text: "Bảo vệ sự tập trung của bạn như bảo vệ tài sản quý giá nhất.", author: "Cal Newport" },
      { text: "Hạnh phúc không nằm ở việc có nhiều thứ để xem, mà ở việc biết điều gì đáng để nhìn.", author: "Naval Ravikant" },
      { text: "Kho báu lớn nhất của đời người là một tâm trí không bị xáo trộn.", author: "Khuyết danh" },
      { text: "Khi bạn không phản ứng với những điều khiêu khích, bạn nắm quyền làm chủ chính mình.", author: "Epictetus" },
      { text: "Bớt một mối bận tâm, lòng thêm một phần thong dong.", author: "Thiền ngữ" },
      { text: "Đừng vội vã. Cây sồi mất cả trăm năm để lớn lên trong tĩnh lặng.", author: "Ralph Waldo Emerson" },
      { text: "Sự bình thản bên trong là lá chắn vững chắc nhất trước sóng gió bên ngoài.", author: "Khuyết danh" },
      { text: "Biết đủ là giàu có, biết dừng là khôn ngoan.", author: "Lão Tử" },
      { text: "Tâm không vướng bận việc trần gian, ấy là mùa xuân đẹp nhất đời người.", author: "Vô Môn Huệ Khai" },
      { text: "Hít vào tĩnh lặng, thở ra buông bỏ. Hiện tại là tất cả những gì bạn cần.", author: "Thích Nhất Hạnh" },
      { text: "Cuộc đời ngắn ngủi, đừng phí hoài từng phút giây quý giá vào những tranh cãi vô thưởng vô phạt.", author: "Marcus Aurelius" },
      { text: "Bạn không thể tìm thấy bình yên bằng cách trốn tránh cuộc đời, mà bằng cách tĩnh lặng trong tâm hồn.", author: "Virginia Woolf" },
      { text: "Năng lượng của bạn chảy về nơi sự chú ý của bạn hướng tới.", author: "Tony Robbins" },
      { text: "Tắt bớt những tiếng ồn bên ngoài để lắng nghe tiếng nói thông tuệ bên trong.", author: "Carl Jung" },
      { text: "Không gian này là dành riêng cho bạn — để nghỉ ngơi, nạp lại năng lượng và mỉm cười.", author: "ZenFeed Sanctuary" },
      { text: "Mỗi ngày là một khởi đầu mới. Hãy thở sâu và bắt đầu lại với tâm thế an nhiên.", author: "Khuyết danh" }
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
      { text: "Protect your focus as your most precious currency.", author: "Cal Newport" },
      { text: "The greatest wealth is a quiet mind that desires nothing from the crowd.", author: "Naval Ravikant" },
      { text: "To be calm is the highest achievement of the self.", author: "Zen Proverb" },
      { text: "When you do not react to provocations, you retain full mastery over yourself.", author: "Epictetus" },
      { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
      { text: "Adopt the pace of nature: her secret is patience.", author: "Ralph Waldo Emerson" },
      { text: "Tranquility is nothing else than the good ordering of the mind.", author: "Marcus Aurelius" },
      { text: "He who knows he has enough is rich.", author: "Lao Tzu" },
      { text: "Breathing in, I calm body and mind. Breathing out, I smile.", author: "Thich Nhat Hanh" },
      { text: "Life is short, and we have never too much time for gladdening the hearts of those around us.", author: "Henri-Frédéric Amiel" },
      { text: "You cannot find peace by avoiding life, but by centering your thoughts within it.", author: "Virginia Woolf" },
      { text: "Where attention goes, energy flows. Choose your focus with intention.", author: "Tony Robbins" },
      { text: "Who looks outside, dreams; who looks inside, awakes.", author: "Carl Jung" },
      { text: "This calm pocket of space belongs to you — pause, breathe, and recharge.", author: "ZenFeed Sanctuary" },
      { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
      { text: "The quieter you become, the more you are able to hear.", author: "Rumi" },
      { text: "Peace comes from within. Do not seek it without.", author: "Buddha" }
    ]
  };

  // LRU ring buffer to avoid repeating recent quotes
  const recentIndices = [];
  const MAX_RECENT = 12;

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
