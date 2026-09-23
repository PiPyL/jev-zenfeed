# 🛡️ ZenFeed

<p align="center">
  <img src="icons/icon128.png" alt="ZenFeed Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Tính năng chống ồn chủ động đầu tiên dành cho đôi mắt.</strong><br>
  <em>Lọc Facebook thông minh bằng AI — Trả lại sự tĩnh lặng cho tâm trí bạn.</em>
</p>

<p align="center">
  <a href="https://github.com/PiPyL/jev-zenfeed/releases"><img src="https://img.shields.io/github/v/release/PiPyL/jev-zenfeed?color=2F5D50&label=Bản%20phát%20hành&style=flat-square" alt="Bản phát hành"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Giấy%20phép-MIT-2F5D50.svg?style=flat-square" alt="Giấy phép MIT"></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/intro/"><img src="https://img.shields.io/badge/Chrome-MV3-blue.svg?style=flat-square" alt="Manifest V3"></a>
  <a href="https://github.com/PiPyL/jev-zenfeed/stargazers"><img src="https://img.shields.io/github/stars/PiPyL/jev-zenfeed?style=flat-square&color=D9A05B" alt="GitHub Stars"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/Đóng%20góp-Hoan%20nghênh-brightgreen.svg?style=flat-square" alt="Đóng góp hoan nghênh"></a>
</p>

<p align="center">
  <a href="#-hướng-dẫn-cài-đặt-nhanh">Cài Đặt Nhanh</a> •
  <a href="#-tính-năng-nổi-bật">Tính Năng</a> •
  <a href="#-cấu-hình--sử-dụng">Cấu Hình</a> •
  <a href="#-cấu-trúc-mã-nguồn">Cấu Trúc</a> •
  <a href="#-kiểm-thử-tự-động">Kiểm Thử</a> •
  <a href="#-đóng-góp-phát-triển">Đóng Góp</a> •
  <a href="PRIVACY.md">Chính Sách Bảo Mật</a> •
  <a href="README.md">🇬🇧 English Version</a>
</p>

---

**ZenFeed** là Chrome Extension mã nguồn mở (Open Source) mang lại tính năng **Chống Ồn Chủ Động Cho Đôi Mắt**. Tương tự như tai nghe chống ồn (ANC) loại bỏ tạp âm của môi trường xung quanh, ZenFeed tự động phát hiện và thu gọn hoặc làm mờ nhẹ nhàng các bài viết "tạp âm thị giác" (cờ bạc, cá độ, tin giật gân, bóc phốt, spoilers, đa cấp, lừa đảo) ngay trên News Feed Facebook theo tiêu chí bạn tự định nghĩa bằng ngôn ngữ tự nhiên.

Ứng dụng tích hợp mô hình **Jev (TypeSafe AI)** — kiến trúc "System One" với độ trễ phản hồi sub-200ms, chi phí siêu rẻ ($0.042 / 1 triệu tokens), giao diện mượt mà không giật khung hình (Zero-CLS), bảo mật 100% BYOK và tuyệt đối không qua máy chủ trung gian.

---

## ✨ Tính Năng Nổi Bật

- 🎧 **Chống Ồn Cho Mắt:** Thu gọn hoặc làm mờ nhẹ nhàng các bài viết vi phạm tiêu chí trước khi chúng kịp làm phiền tâm trí bạn.
- ⚡ **Quyết Định Siêu Tốc (Sub-200ms):** Sử dụng kiến trúc System One của Jev, phản hồi dạng nhị phân (Bernoulli Boolean) kèm độ tin cậy được hiệu chuẩn.
- 🔒 **Mô hình BYOK (Bring Your Own Key) & Bảo Mật Tuyệt Đối:** Kết nối trực tiếp giữa máy bạn và AI qua giao thức TLS 1.3 mã hóa. Không máy chủ trung gian, không theo dõi ngầm, không telemetry, không chạm vào mật khẩu hay tin nhắn riêng tư.
- 🎯 **Kiến Trúc Atomic Questions & Whitelist An Toàn:** Tách biệt câu hỏi vi phạm và câu hỏi ngoại lệ. Ngoại lệ chỉ được tha khi đạt ngưỡng riêng 70% và không yếu hơn điểm vi phạm, nên kéo thanh độ tin cậy không làm đổi các bài đang được giữ. Ví dụ: lọc tin tuyển dụng rác nhưng vẫn giữ tin tuyển dụng IT/AI.
- 👁️ **Bảo Vệ Vùng Đọc & Tránh Giật Khung Hình (Zero-CLS):**
  - Chế độ làm mờ giữ nguyên chiều cao khung bài, không làm nhảy trang (Cumulative Layout Shift = 0).
  - Trì hoãn thu gọn nếu bài viết đang nằm trong tầm mắt đọc (65% phía trên màn hình).
  - Bài bạn đã chủ động tương tác (Thích, Bình luận, Xem thêm) chỉ gắn nhãn nhỏ ở góc, không tự ý che hay thu gọn.
- 💾 **Bộ Nhớ Đệm Thông Minh 2 Tầng (IndexedDB LRU Cache):** Ghi nhớ các bài đã đánh giá (bài trùng lặp, quảng cáo lặp lại, mở nhiều tab). Cuộn lại bài cũ tiêu tốn **0 token**.
- 🛠️ **Preset Mẫu 1-Click:** Tích hợp sẵn bộ lọc phổ biến: Chống cờ bạc/tài xỉu, Chống spoiler phim ảnh, Chống drama showbiz câu view, Chống rác tiền ảo.

---

## 🚀 Hướng Dẫn Cài Đặt Nhanh

### Cách 1: Cài bằng File ZIP từ GitHub Releases (Khuyên Dùng)

Đây là cách nhanh nhất và tiện lợi nhất cho mọi người dùng:

1. **Tải file ZIP phát hành mới nhất:**
   👉 [**Tải trực tiếp zenfeed-v1.0.0.zip (1-Click)**](https://github.com/PiPyL/jev-zenfeed/releases/latest/download/zenfeed-v1.0.0.zip) hoặc xem các bản phát hành tại [**ZenFeed Releases**](https://github.com/PiPyL/jev-zenfeed/releases/latest).
2. **Giải nén file ZIP:**
   Giải nén file `zenfeed-v1.0.0.zip` vào một thư mục trên máy tính của bạn (ví dụ: `Downloads/zenfeed-v1.0.0`).
   > 💡 **Lưu ý quan trọng:** Hãy giải nén toàn bộ thư mục (trên Windows: click chuột phải vào file `zenfeed-v1.0.0.zip` → chọn **Extract All...**). Khi tải tiện ích, chọn đúng thư mục chứa trực tiếp file `manifest.json`.
3. **Mở trang quản lý tiện ích trình duyệt:**
   Trên Chrome, Edge, Cốc Cốc hoặc Brave, nhập vào thanh địa chỉ:
   ```text
   chrome://extensions
   ```
4. **Bật chế độ dành cho nhà phát triển:**
   Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải màn hình.
5. **Tải tiện ích đã giải nén:**
   Bấm vào nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái, sau đó chọn thư mục vừa giải nén (thư mục chứa file `manifest.json`).
6. **Ghim tiện ích:**
   Bấm vào biểu tượng mảnh ghép trên thanh công cụ và ghim **ZenFeed** để dễ dàng truy cập và tùy chỉnh.

---

### Cách 2: Cài Đặt Từ Mã Nguồn (Dành Cho Lập Trình Viên)

```bash
# Clone repository về máy
git clone https://github.com/PiPyL/jev-zenfeed.git
cd jev-zenfeed

# Chạy kiểm thử tự động để xác nhận mọi thành phần hoạt động hoàn hảo
npm test

# Kiểm tra cú pháp và chất lượng mã nguồn
npm run lint
```

Sau đó làm theo các bước 3–6 ở trên, chọn thư mục dự án `jev-zenfeed`.

---

## ⚙️ Cấu Hình & Sử Dụng

1. Bấm vào biểu tượng **ZenFeed** trên thanh công cụ để mở Popup cài đặt.
2. Nhập **TypeSafe Jev API Key** của bạn vào ô API Key.
   *(Tùy chọn: Nếu dùng proxy riêng hoặc Vercel AI Gateway, bấm "Tùy chỉnh Endpoint" để thay đổi URL).*
3. Bấm nút **⚡ Kiểm tra kết nối** để xác nhận API hoạt động bình thường.
4. Chọn một Preset có sẵn hoặc tự gõ tiêu chí bằng ngôn ngữ tự nhiên:
   - *Ví dụ tiêu chí lọc:* `"cờ bạc trực tuyến, cá độ bóng đá, tài xỉu, vay tiền online, bóc phốt showbiz"`
   - *Ngoại lệ Whitelist (nếu muốn giữ lại):* `"tin tức công nghệ, lập trình viên, trí tuệ nhân tạo, tuyển dụng IT"`
5. Điều chỉnh ngưỡng độ tin cậy mong muốn (mặc định: **70%**).
6. Bấm **Áp dụng** (hoặc nhấn tổ hợp phím `Ctrl` / `Cmd` + `Enter`). Cài đặt sẽ được áp dụng ngay lập tức trên các tab Facebook đang mở!

---

## 📂 Cấu Trúc Mã Nguồn

```
jev-zenfeed/
├── manifest.json              # Khai báo chuẩn Chrome Extension Manifest V3
├── package.json               # Cấu hình kịch bản & thông tin dự án
├── LICENSE                    # Giấy phép mã nguồn mở MIT
├── CONTRIBUTING.md            # Hướng dẫn đóng góp cộng đồng
├── icons/                     # Bộ icon nhận diện (16, 32, 48, 128px)
├── src/
│   ├── background/
│   │   ├── background.js      # Service Worker: hàng đợi batch, badge icon, quản lý vòng đời
│   │   ├── decision-cache.js  # Bộ nhớ cache 2 tầng (session memory + IndexedDB LRU)
│   │   └── jev-client.js      # Client giao tiếp TypeSafe Jev (xây dựng prompt nguyên tử)
│   ├── content/
│   │   ├── content.js         # Lắng nghe thay đổi DOM & IntersectionObserver trên Facebook
│   │   ├── content.css        # Hiệu ứng làm mờ Zero-CLS và thanh banner thu gọn
│   │   ├── fb-selectors.js    # Bộ chọn DOM linh hoạt chống đổi class của Facebook
│   │   ├── text-extractor.js  # Trích xuất, làm sạch nội dung bài viết và tính hash FNV-1a
│   │   └── ui-overlay.js      # Tạo banner, khung mờ và nút "Xem nội dung"
│   ├── utils/
│   │   ├── settings-defaults.js # Chuẩn hóa cài đặt và giá trị mặc định
│   │   ├── fast-hash.js       # Thuật toán hash FNV-1a siêu tốc
│   │   ├── clip-text.js       # Cắt giữ phần đầu + đuôi bài dài để tiết kiệm token
│   │   ├── logger.js          # Ghi log theo lô vào storage.session
│   │   ├── i18n.js            # Đa ngôn ngữ (Tiếng Anh / Tiếng Việt)
│   │   ├── zen-data.js        # Câu nói tĩnh tâm & thống kê thư giãn trên bài bị mờ
│   │   └── flashcards-data.js # Thẻ học kiến thức vi mô khi bài viết bị làm mờ
│   └── popup/
│       ├── popup.html         # Giao diện cài đặt tiện ích
│       ├── popup.css          # Tùy biến Calm Tech phong cách sang trọng, dịu mắt
│       └── popup.js           # Xử lý lưu cấu hình & kiểm tra API key
├── scripts/
│   └── build-zip.js           # Script tự động đóng gói file ZIP cho GitHub Releases
└── test/
    ├── test-jev-mock.js       # Bộ 30 bài kiểm thử tích hợp tự động với Node.js
    ├── content-harness.html   # Môi trường kiểm thử content script trên DOM Facebook giả lập
    ├── run-harness-headless.js# Trình chạy kiểm thử tự động với Chrome không đầu (headless)
    ├── mock-jev-server.js     # Mock Server cục bộ giả lập API TypeSafe Jev
    └── static-server.js       # Máy chủ HTTP phục vụ kiểm thử DOM
```

---

## 🛠️ Kiểm Thử Tự Động

ZenFeed xây dựng sẵn bộ kiểm thử nghiêm ngặt bao quát từ manifest, cấu trúc prompt chống injection, bộ nhớ cache tới DOM overlay:

```bash
# Chạy bộ 30 kiểm thử tự động (sử dụng Mock Server nội bộ)
npm test

# Kiểm tra cú pháp toàn bộ file nguồn
npm run lint

# Đóng gói tiện ích thành file zip sẵn sàng cài đặt (xuất ra dist/zenfeed-v1.0.0.zip)
npm run build:zip

# Khởi chạy server kiểm thử giao diện DOM trên trình duyệt
npm run harness
# Sau đó mở link http://localhost:8765/test/content-harness.html

# Hoặc chạy kiểm thử tự động qua Chrome Headless
npm run harness:headless
```

---

## 🤝 Đóng Góp Phát Triển

Dự án ZenFeed luôn trân trọng mọi sự đóng góp từ cộng đồng! Hãy xem tài liệu chi tiết tại [CONTRIBUTING.md](CONTRIBUTING.md).

1. Fork dự án: `https://github.com/PiPyL/jev-zenfeed`
2. Tạo nhánh tính năng (`git checkout -b feat/tinh-nang-moi`)
3. Chạy `npm test && npm run lint` để đảm bảo code vượt qua kiểm thử
4. Commit thay đổi (`git commit -m 'feat: Thêm tính năng mới'`)
5. Push nhánh lên GitHub (`git push origin feat/tinh-nang-moi`)
6. Tạo một Pull Request tới nhánh `main`

---

## ⭐ Ủng Hộ Dự Án 1 Sao

Nếu ZenFeed giúp trả lại sự bình yên cho đôi mắt và trải nghiệm lướt web mỗi ngày của bạn, hãy dành tặng dự án **1 sao ⭐** trên GitHub! Sự ủng hộ của bạn là động lực rất lớn để dự án tiếp tục phát triển và lan tỏa đến nhiều người hơn.

[![Ủng hộ 1 sao trên GitHub](https://img.shields.io/badge/Ủng%20hộ%201%20sao%20trên%20GitHub-⭐%20PiPyL%2Fjev--zenfeed-2F5D50?style=for-the-badge)](https://github.com/PiPyL/jev-zenfeed)

---

## 📄 Giấy Phép (License)

Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License** — xem file [LICENSE](LICENSE) để biết thêm chi tiết.
