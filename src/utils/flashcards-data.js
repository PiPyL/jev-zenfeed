/**
 * Flashcards Data — Knowledge Swap Cards (IELTS, Tech Shortcuts, Stoic Wisdom)
 * Dual-mode module (same pattern as fast-hash.js / zen-data.js):
 *   1. Content script (classic): registers window.JevFB.flashcardsData
 *   2. Service worker / Node: registers self.__jevFlashcardsData
 */
(function registerFlashcards(root) {
  const FLASHCARDS = {
    ielts: [
      {
        term: "Serendipity",
        phonetic: "/ˌser.ənˈdɪp.ə.t̬i/",
        type: "Noun (C2)",
        meaningVi: "Sự tình cờ may mắn tìm thấy điều tốt đẹp một cách ngẫu nhiên",
        meaningEn: "The occurrence of events by chance in a happy or beneficial way",
        example: "Finding ZenFeed was pure serendipity for my daily focus."
      },
      {
        term: "Ubiquitous",
        phonetic: "/juːˈbɪk.wə.t̬əs/",
        type: "Adjective (C1)",
        meaningVi: "Có mặt ở khắp mọi nơi, nhan nhản",
        meaningEn: "Present, appearing, or found everywhere",
        example: "Online ads have become ubiquitous across modern social feeds."
      },
      {
        term: "Ephemeral",
        phonetic: "/əˈfem.ər.əl/",
        type: "Adjective (C2)",
        meaningVi: "Phù du, chóng tàn, chỉ tồn tại trong thoáng chốc",
        meaningEn: "Lasting for a very short time",
        example: "Most viral social media drama is purely ephemeral."
      },
      {
        term: "Cognitive",
        phonetic: "/ˈkɑːɡ.nə.t̬ɪv/",
        type: "Adjective (B2)",
        meaningVi: "Thuộc về nhận thức, tư duy",
        meaningEn: "Connected with thinking or conscious mental processes",
        example: "Filtering social noise helps preserve your cognitive energy."
      },
      {
        term: "Resilience",
        phonetic: "/rɪˈzɪl.jəns/",
        type: "Noun (C1)",
        meaningVi: "Khả năng phục hồi, kiên cường vượt qua khó khăn",
        meaningEn: "The capacity to recover quickly from difficulties; toughness",
        example: "Mindful habits build strong mental resilience against doomscrolling."
      },
      {
        term: "Pragmatic",
        phonetic: "/præɡˈmæt̬.ɪk/",
        type: "Adjective (C1)",
        meaningVi: "Thực tế, thực dụng, giải quyết vấn đề dựa trên hiệu quả",
        meaningEn: "Dealing with things sensibly and realistically based on practical conditions",
        example: "Taking a pragmatic approach to screen time improves quality of life."
      },
      {
        term: "Equanimity",
        phonetic: "/ˌek.wəˈnɪm.ə.t̬i/",
        type: "Noun (C2)",
        meaningVi: "Sự điềm tĩnh, thanh thản ngay cả trong nghịch cảnh",
        meaningEn: "Mental calmness, composure, and evenness of temper, especially in a difficult situation",
        example: "He navigated the turbulent online debates with remarkable equanimity."
      },
      {
        term: "Mitigate",
        phonetic: "/ˈmɪt̬.ə.ɡeɪt/",
        type: "Verb (C1)",
        meaningVi: "Làm dịu bớt, giảm thiểu tác hại",
        meaningEn: "Make less severe, serious, or painful",
        example: "ZenFeed mitigates information overload on your daily feeds."
      }
    ],
    tech: [
      {
        term: "Cmd/Ctrl + Shift + T",
        phonetic: "Browser Shortcut",
        type: "Quick Action",
        meaningVi: "Mở lại tab vừa đóng gần nhất",
        meaningEn: "Reopen the most recently closed browser tab",
        example: "Cứu cánh khi vô tình bấm nhầm đóng mất trang quan trọng!"
      },
      {
        term: "Cmd/Ctrl + K",
        phonetic: "Universal Palette",
        type: "Productivity",
        meaningVi: "Mở Command Palette / Tìm kiếm nhanh trong hầu hết công cụ hiện đại",
        meaningEn: "Open Command Palette / Fast search in modern apps (Slack, Notion, VSCode)",
        example: "Giúp bạn điều hướng tức thì mà không cần chạm vào chuột."
      },
      {
        term: "Option/Alt + Click",
        phonetic: "Multi-cursor",
        type: "Code / Editor",
        meaningVi: "Tạo nhiều con trỏ soạn thảo cùng lúc (VS Code, Sublime, Chrome DevTools)",
        meaningEn: "Place multiple cursors simultaneously for fast bulk editing",
        example: "Chỉnh sửa nhiều dòng giống nhau trong tích tắc."
      },
      {
        term: "Cumulative Layout Shift (CLS)",
        phonetic: "Core Web Vitals",
        type: "Performance Concept",
        meaningVi: "Chỉ số đo mức độ thay đổi bố cục bất ngờ khi trang đang hiển thị",
        meaningEn: "A metric for unexpected layout movement during page use",
        example: "Giữ nguyên kích thước bài khi làm mờ giúp lớp phủ không làm đổi bố cục."
      }
    ],
    quotes: [
      {
        term: "Amor Fati",
        phonetic: "Latin Maxim",
        type: "Stoic Philosophy",
        meaningVi: "Yêu lấy định mệnh — đón nhận mọi việc xảy ra như một phần tất yếu của cuộc đời",
        meaningEn: "Love of one's fate; seeing whatever happens as necessary and good",
        example: "Do not seek for things to happen the way you want them to; wish that what happens happens the way it happens."
      },
      {
        term: "Memento Mori",
        phonetic: "Latin Maxim",
        type: "Mindfulness",
        meaningVi: "Hãy nhớ rằng bạn rồi sẽ phải chết — sống trọn vẹn và đừng lãng phí thời gian",
        meaningEn: "Remember that you must die; keep perspective on what truly matters",
        example: "You could leave life right now. Let that determine what you do and say and think."
      },
      {
        term: "Ataraxia",
        phonetic: "/ˌæt.əˈræk.si.ə/",
        type: "Ancient Greek",
        meaningVi: "Trạng thái tâm trí hoàn toàn thanh thản, không bị phiền muộn quấy nhiễu",
        meaningEn: "A state of serene calmness and untroubled mind",
        example: "Protect your inner ataraxia from the fleeting storms of social media."
      }
    ]
  };

  const recentIndices = { ielts: [], tech: [], quotes: [] };

  function getRandomFlashcard(topic = 'ielts', lang = 'vi') {
    const list = FLASHCARDS[topic] || FLASHCARDS.ielts;
    const history = recentIndices[topic] || (recentIndices[topic] = []);

    let available = list.map((_, i) => i).filter(i => !history.includes(i));
    if (available.length === 0) {
      history.length = 0;
      available = list.map((_, i) => i);
    }

    const chosenIdx = available[Math.floor(Math.random() * available.length)];
    history.push(chosenIdx);
    if (history.length > 4) history.shift();

    const item = list[chosenIdx];
    return {
      term: item.term,
      phonetic: item.phonetic,
      type: item.type,
      meaning: lang === 'en' ? item.meaningEn : item.meaningVi,
      example: item.example,
      topic: topic
    };
  }

  const flashcardsData = {
    data: FLASHCARDS,
    getRandomFlashcard: getRandomFlashcard
  };

  if (root) {
    root.JevFB = root.JevFB || {};
    root.JevFB.flashcardsData = flashcardsData;
    root.__jevFlashcardsData = flashcardsData;
  }
})(typeof self !== 'undefined' ? self : globalThis);
