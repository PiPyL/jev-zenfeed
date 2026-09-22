# 🛡️ Jev AI Facebook Filter (Chrome Extension)

Extension thông minh giúp tự động phát hiện và ẩn các bài viết trên Facebook theo tiêu chí bạn tự định nghĩa, sử dụng model **Jev (TypeSafe AI)** — mô hình "System One" siêu tốc với chi phí siêu rẻ ($0.042 / 1M tokens) và độ trễ tính bằng mili-giây.

---

## ✨ Tính Năng Nổi Bật

* **Mô hình BYOK (Bring Your Own Key):** Người dùng tự nhập API Key của mình, không qua server trung gian. API Key chỉ nằm trong background/popup, không bao giờ được đưa vào trang Facebook.
* **Quyền riêng tư:** Nội dung văn bản bài viết (kèm tên tác giả) được gửi tới endpoint Jev/TypeSafe AI bạn cấu hình để phân loại. Bình luận không được gửi đi.
* **Quyết định Siêu tốc (Sub-200ms):** Sử dụng kiến trúc System One của Jev, phản hồi dạng nhị phân (Bernoulli Boolean) kèm độ tin cậy được hiệu chuẩn.
* **Cơ chế Tiết kiệm Token Tối ưu:**
  * **IntersectionObserver:** Chỉ phân tích bài viết khi sắp cuộn vào tầm nhìn (trước ~150px để kịp ẩn trước khi bạn thấy); bài chưa cuộn tới không tốn token.
  * **Gửi mỗi nội dung đúng 1 lần:** Nội dung bài chỉ xuất hiện một lần trong request; bài trùng nội dung (cùng quảng cáo hiện nhiều lần, nhiều tab) chỉ được đánh giá một lần.
  * **LRU Cache bền vững:** Lưu kết quả duyệt bài theo mã băm FNV-1a. Cuộn lại bài cũ hoặc đổi ngưỡng tin cậy: kết quả có ngay, **0 token**. Kết quả lỗi không bao giờ được lưu cache.
* **Trải nghiệm Không Gián Đoạn (Anti-FOUC & Collapsed Banner):**
  * Làm mờ bài viết tức thì trong tích tắc chờ AI duyệt.
  * Khi phát hiện bài vi phạm, thu gọn thành **Thanh thông báo** (không làm giật trang/nhảy khung hình).
  * Cho phép người dùng bấm **"Xem nội dung"** bất cứ lúc nào nếu muốn.
* **Preset Mẫu 1-Click:** Tích hợp sẵn các bộ lọc thông dụng: Chống cờ bạc/cá độ, Chống spoiler phim, Chống drama showbiz câu view, Chống rác tiền ảo.

---

## 🚀 Hướng Dẫn Cài Đặt (Trong 1 Phút)

### Bước 1: Nạp Extension vào Trình Duyệt Chrome / Edge / Brave
1. Mở trình duyệt Chrome và truy cập đường dẫn: `chrome://extensions`
2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
3. Bấm vào nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
4. Chọn thư mục dự án:
   ```
   /Users/mac/Desktop/jev-facebook-filter
   ```
5. Icon của **Jev AI Filter** sẽ xuất hiện trên thanh công cụ của trình duyệt. Bạn nên ghim (pin) icon này để dễ truy cập.

---

### Bước 2: Cấu hình API Key & Tiêu Chí Lọc
1. Bấm vào icon **Jev AI Filter** trên thanh công cụ để mở Popup.
2. Nhập API Key TypeSafe Jev của bạn vào ô **API Key**. *(Nếu dùng proxy hoặc Vercel AI Gateway, bấm "Tùy chỉnh Endpoint" để đổi URL — Chrome sẽ hỏi cấp quyền truy cập domain đó).*
3. Bấm nút **⚡ Kiểm tra kết nối** để xác nhận API Key hoạt động bình thường.
4. Chọn một Preset có sẵn hoặc tự gõ tiêu chí bạn muốn ẩn vào ô text.
   * *Ví dụ: "Bài viết về cá độ bóng đá, quảng cáo game bài, cho vay nặng lãi, tin giật gân bóc phốt showbiz"*
5. Điều chỉnh ngưỡng độ tin cậy (mặc định: **70%**).
6. Bấm **Lưu cài đặt**. Thay đổi áp dụng ngay trên các tab Facebook đang mở (không cần tải lại trang). Công tắc Bật/Tắt có hiệu lực ngay khi gạt.

---

### Bước 3: Trải Nghiệm Trên Facebook
1. Truy cập [facebook.com](https://www.facebook.com) và lướt News Feed như bình thường.
2. Khi gặp bài viết có nội dung vi phạm tiêu chí bạn đặt ra:
   * Bài viết sẽ được tự động thu gọn thành thanh thông báo:  
     `🛡️ Đã ẩn bài viết [Độ tin cậy 88%] - Tiêu chí: "..."`
   * Bấm nút **"Xem nội dung"** nếu bạn muốn mở lại bài viết đó.

---

## 📂 Cấu Trúc Mã Nguồn

```
jev-facebook-filter/
├── manifest.json              # Khai báo chuẩn Chrome Manifest V3
├── package.json               # Cấu hình dự án & scripts test
├── icons/                     # Bộ icon 16x16, 48x48, 128x128
├── src/
│   ├── background/
│   │   ├── background.js      # Service Worker: Quản lý cache, xử lý tin nhắn
│   │   └── jev-client.js      # Module gọi API TypeSafe Jev (Parallel batching)
│   ├── content/
│   │   ├── content.js         # Mutation & Intersection Observer trên Facebook
│   │   ├── content.css        # Giao diện thanh Banner và hiệu ứng làm mờ
│   │   ├── fb-selectors.js    # Bộ chọn DOM linh hoạt chống đổi class của FB
│   │   ├── text-extractor.js  # Trích xuất và làm sạch văn bản bài viết, tính hash
│   │   └── ui-overlay.js      # Tạo Banner thu gọn và xử lý nút xem lại bài
│   ├── utils/
│   │   ├── settings-defaults.js # Cài đặt mặc định dùng chung (single source)
│   │   ├── fast-hash.js       # FNV-1a hash dùng chung
│   │   └── logger.js          # Nhật ký hoạt động (ghi theo lô)
│   └── popup/
│       ├── popup.html         # Giao diện cài đặt tiện ích
│       ├── popup.css          # Tùy biến giao diện popup hiện đại
│       └── popup.js           # Xử lý sự kiện lưu cài đặt & test API key
└── test/
    ├── test-jev-mock.js       # Kiểm thử tự động (Node)
    ├── content-harness.html   # Kiểm thử content script trên DOM giả lập (trình duyệt)
    ├── mock-jev-server.js     # Mock Server Jev cục bộ
    └── static-server.js       # Server tĩnh cho harness
```

---

## 🛠️ Kiểm Thử Tự Động
Kiểm thử background, API client, logger (dùng Mock Server thật + chrome API giả lập):
```bash
npm test
```
Kiểm thử content script trên DOM Facebook giả lập (chạy trong trình duyệt):
```bash
npm run harness
```
Sau đó mở `http://localhost:8765/test/content-harness.html` — trang hiển thị danh sách PASS/FAIL.
