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
      },
      {
        term: "Juxtaposition",
        phonetic: "/ˌdʒʌk.stə.pəˈzɪʃ.ən/",
        type: "Noun (C2)",
        meaningVi: "Sự đặt hai sự vật cạnh nhau để so sánh, đối chiếu sự khác biệt",
        meaningEn: "The fact of two things being seen or placed close together with contrasting effect",
        example: "The juxtaposition of chaotic news and serene breathing creates instant peace."
      },
      {
        term: "Paradigm",
        phonetic: "/ˈpær.ə.daɪm/",
        type: "Noun (C1)",
        meaningVi: "Mô hình, chuẩn mực mẫu, hệ tư tưởng điển hình",
        meaningEn: "A typical example or pattern of something; a model or standard",
        example: "Active Noise Cancellation for eyes represents a new paradigm in digital wellbeing."
      },
      {
        term: "Quintessential",
        phonetic: "/ˌkwɪn.təˈsen.ʃəl/",
        type: "Adjective (C2)",
        meaningVi: "Tinh túy, hoàn hảo nhất, đại diện tiêu biểu nhất cho một phẩm chất",
        meaningEn: "Representing the most perfect or typical example of a quality or class",
        example: "Calmness amidst chaos is the quintessential trait of a mindful thinker."
      },
      {
        term: "Superfluous",
        phonetic: "/suːˈpɝː.flu.əs/",
        type: "Adjective (C2)",
        meaningVi: "Dư thừa, không cần thiết, vượt quá mức cần dùng",
        meaningEn: "Unnecessary, especially through being more than enough",
        example: "Filtering cuts away superfluous drama, saving hours of productive time."
      },
      {
        term: "Introspection",
        phonetic: "/ˌɪn.trəˈspek.ʃən/",
        type: "Noun (C1)",
        meaningVi: "Sự nội quan, tự nhìn nhận và thấu suốt cảm xúc, suy nghĩ bên trong",
        meaningEn: "The examination or observation of one's own mental and emotional processes",
        example: "A quiet moment of introspection restores mental clarity."
      },
      {
        term: "Diligence",
        phonetic: "/ˈdɪl.ə.dʒəns/",
        type: "Noun (C1)",
        meaningVi: "Sự cần cù, siêng năng, chuyên tâm cẩn trọng",
        meaningEn: "Careful and persistent work or effort",
        example: "Protecting your daily schedule requires constant diligence."
      },
      {
        term: "Pernicious",
        phonetic: "/pɚˈnɪʃ.əs/",
        type: "Adjective (C2)",
        meaningVi: "Độc hại ngấm ngầm, gây tổn hại dần theo thời gian",
        meaningEn: "Having a harmful effect, especially in a gradual or subtle way",
        example: "Doomscrolling is a pernicious habit that slowly erodes focus."
      },
      {
        term: "Catharsis",
        phonetic: "/kəˈθɑːr.sɪs/",
        type: "Noun (C2)",
        meaningVi: "Sự giải tỏa cảm xúc dồn nén, thanh lọc tâm hồn",
        meaningEn: "The process of releasing and thereby providing relief from strong emotions",
        example: "Closing toxic comment threads brings immediate mental catharsis."
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
        term: "Cmd/Ctrl + Shift + V",
        phonetic: "Universal Paste",
        type: "Productivity",
        meaningVi: "Dán văn bản thuần túy (loại bỏ toàn bộ định dạng font, màu, liên kết)",
        meaningEn: "Paste as plain text without any formatting, styles, or links",
        example: "Tuyệt chiêu khi sao chép từ web vào Google Docs, Notion hoặc email."
      },
      {
        term: "Cmd/Ctrl + D",
        phonetic: "Multi-select",
        type: "Code / Text Editor",
        meaningVi: "Chọn từ tiếp theo trùng khớp để sửa nhanh cùng một lúc (VS Code, Sublime)",
        meaningEn: "Select the next matching word occurrence for quick simultaneous editing",
        example: "Đổi tên biến hoặc sửa lỗi chính tả lặp lại chỉ trong 2 giây."
      },
      {
        term: "Cmd/Ctrl + L",
        phonetic: "Browser Navigation",
        type: "Browser Shortcut",
        meaningVi: "Nhảy con trỏ ngay vào thanh địa chỉ URL của trình duyệt",
        meaningEn: "Focus the browser address / URL bar instantly",
        example: "Tìm kiếm hoặc gõ web mới tức thì mà không cần với tay chạm chuột."
      },
      {
        term: "Win + V / Mac Clipboard",
        phonetic: "Clipboard History",
        type: "System Shortcut",
        meaningVi: "Mở lịch sử khay nhớ tạm để chọn dán lại các đoạn đã sao chép trước đó",
        meaningEn: "Access clipboard history to paste previously copied snippets",
        example: "Không sợ bị mất đoạn văn bản vừa copy khi lỡ sao chép thứ khác đè lên."
      },
      {
        term: "Cmd/Ctrl + Backspace",
        phonetic: "Fast Deletion",
        type: "Text Editing",
        meaningVi: "Xóa toàn bộ từ hoặc cả dòng phía trước con trỏ",
        meaningEn: "Delete the entire word or line to the left of the cursor",
        example: "Viết lại câu nhanh hơn gấp 5 lần so với việc bấm xóa từng ký tự."
      },
      {
        term: "Cmd + Option + I / F12",
        phonetic: "Web Inspector",
        type: "Developer Tools",
        meaningVi: "Mở ngay Chrome DevTools để soi mã HTML/CSS và console",
        meaningEn: "Open browser Developer Tools to inspect elements and console logs",
        example: "Công cụ không thể thiếu của mọi lập trình viên và nhà thiết kế web."
      },
      {
        term: "Option/Alt + Drag",
        phonetic: "Column Selection",
        type: "Editor Feature",
        meaningVi: "Chọn văn bản dạng khối dọc / cột trong code editor",
        meaningEn: "Rectangular / box selection across multiple vertical lines",
        example: "Cực kỳ tiện khi cần copy hay xóa một cột danh sách dữ liệu."
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
      },
      {
        term: "Dichotomy of Control",
        phonetic: "Stoic Core Principle",
        type: "Life Philosophy",
        meaningVi: "Phân biệt rạch ròi giữa điều ta kiểm soát được và điều không thể kiểm soát",
        meaningEn: "Distinguishing between what is within our control and what is not",
        example: "You control your attention and reactions; you cannot control what others post online."
      },
      {
        term: "Premeditatio Malorum",
        phonetic: "Latin Exercise",
        type: "Mental Resilience",
        meaningVi: "Hình dung trước khó khăn để chuẩn bị tâm lý điềm tĩnh, không bị bất ngờ",
        meaningEn: "Visualizing potential setbacks in advance to cultivate resilience and peace",
        example: "When you wake up, reflect that you may meet challenging people, but remain calm."
      },
      {
        term: "Eudaimonia",
        phonetic: "/juːdaɪˈmoʊniə/",
        type: "Ancient Greek",
        meaningVi: "Hạnh phúc đích thực đến từ việc sống có phẩm hạnh và phát triển nội tâm trọn vẹn",
        meaningEn: "Human flourishing; the state of living well through wisdom and virtue",
        example: "True eudaimonia is found in quiet mastery over one's own desires."
      },
      {
        term: "Sympatheia",
        phonetic: "Greek Stoic Concept",
        type: "Universal Harmony",
        meaningVi: "Sự gắn kết tương hỗ sâu sắc giữa con người và cộng đồng xung quanh",
        meaningEn: "The mutual interdependence of all people in society",
        example: "Treating others with kindness is natural when you understand our common humanity."
      },
      {
        term: "Voluntary Discomfort",
        phonetic: "Stoic Practice",
        type: "Mindset Training",
        meaningVi: "Chủ động thực hành vượt khó để rèn luyện ý chí và biết trân trọng cuộc sống",
        meaningEn: "Practicing hardship periodically so you never fear losing comfort",
        example: "Detaching from constant digital stimulation strengthens your mental autonomy."
      },
      {
        term: "Wu Wei (Vô Vi)",
        phonetic: "Taoist Philosophy",
        type: "Flow State",
        meaningVi: "Hành động thuận theo tự nhiên, không gượng ép, tâm trí tĩnh tại như dòng nước",
        meaningEn: "Effortless action; being in harmony with the natural flow of life",
        example: "Water yields to everything yet overcomes stone through patient persistence."
      },
      {
        term: "Kaizen",
        phonetic: "改善 (Japanese)",
        type: "Productivity",
        meaningVi: "Cải tiến liên tục mỗi ngày từng bước nhỏ nhưng mang lại chuyển biến vĩ đại",
        meaningEn: "Continuous improvement through small, incremental daily habits",
        example: "Learning one new concept each day creates exponential wisdom over time."
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
    if (history.length > 6) history.shift();

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
