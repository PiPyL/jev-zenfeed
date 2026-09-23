# 🛡️ ZenFeed

> ### **"Active Noise Cancellation for your eyes."** ⭐
> *(Tính năng chống ồn chủ động đầu tiên dành cho đôi mắt.)*

**ZenFeed** là Chrome Extension mã nguồn mở (Open Source) giúp tự động phát hiện và thu gọn các bài viết trên Facebook theo tiêu chí bạn tự định nghĩa bằng ngôn ngữ tự nhiên. Ứng dụng tích hợp mô hình **Jev (TypeSafe AI)** — kiến trúc "System One" siêu tốc với độ trễ sub-200ms, chi phí siêu rẻ ($0.042 / 1M tokens), bảo mật 100% BYOK và không qua máy chủ trung gian.

---

## ✨ Tính Năng Nổi Bật

* **🎧 Active Noise Cancellation cho Đôi Mắt:** Tương tự như tai nghe chống ồn loại bỏ tạp âm, ZenFeed dùng AI để loại bỏ "tạp âm thị giác" (cờ bạc, tin giật gân, bóc phốt, đa cấp, spoilers) ngay trên News Feed của bạn.
* **Mô hình BYOK (Bring Your Own Key):** Người dùng tự nhập API Key của mình, không qua server trung gian. API Key chỉ nằm trong background/popup, không bao giờ được đưa vào trang Facebook.
* **Quyền riêng tư:** Nội dung văn bản bài viết (kèm tên tác giả) được gửi tới endpoint Jev/TypeSafe AI bạn cấu hình để phân loại. Bình luận không được gửi đi.
* **Quyết định Siêu tốc (Sub-200ms):** Sử dụng kiến trúc System One của Jev, phản hồi dạng nhị phân (Bernoulli Boolean) kèm độ tin cậy được hiệu chuẩn.
* **Cơ chế Tiết kiệm Token Tối ưu:**
  * **IntersectionObserver:** Phân tích bài trước khoảng 1 màn hình để kịp ẩn trước khi bạn thấy; bài chưa cuộn tới không tốn token.
  * **Request gọn:** Nội dung bài và tiêu chí đều chỉ xuất hiện một lần trong request (rubric dùng chung, tham chiếu `state.criteria`); bài dài được cắt giữ phần đầu + cuối. Bài trùng nội dung (cùng quảng cáo, nhiều tab) chỉ được đánh giá một lần.
  * **LRU Cache bền vững (IndexedDB):** Lưu điểm phân loại theo nội dung, tiêu chí và ngoại lệ. Cuộn lại bài cũ hoặc đổi ngưỡng: áp dụng lại quyết định đã lưu, **0 token**. Đổi tiêu chí/ngoại lệ sẽ đánh giá lại; kết quả lỗi không được lưu cache. Bản nâng cấp sửa định dạng cache sẽ xóa cache cũ một lần để tránh dùng quyết định thiếu điểm ngoại lệ.
  * **"Xem thêm" không tốn thêm token:** Bài mở rộng chỉ được duyệt lại khi nội dung tăng đáng kể.
* **Trải nghiệm Không Gián Đoạn (Reading-zone aware, Anti-FOUC & Collapsed Banner):**
  * **Ưu tiên giữ ổn định vùng đọc:** nếu bài vi phạm còn trong khoảng 65% phía trên màn hình, ZenFeed gắn nhãn hoặc làm mờ tại chỗ, rồi mới thu gọn khi bạn cuộn qua. Chế độ banner và xóa bài có thể làm thay đổi chiều cao feed; chế độ làm mờ giữ nguyên khung bài.
  * **Bài mới, còn trong tầm mắt, bị phát hiện vi phạm:** làm mờ tại chỗ (không đổi chiều cao) kèm nhãn nêu rõ lý do.
  * **Bài bạn đã đọc hoặc đã tương tác (Thích/Bình luận/Xem thêm) trước khi có kết quả:** chỉ gắn một nhãn nhỏ ở góc, không che, không tự thu gọn — tôn trọng việc bạn đã chủ động xem.
  * **Hai chế độ chờ AI:** *Mượt* (mặc định) không bao giờ làm mờ bài đang hiển thị; *Nghiêm ngặt* làm mờ cả lúc đang chờ (kèm nút "Xem luôn"), hợp với tiêu chí spoiler.
  * Cho phép người dùng bấm **"Xem"** bất cứ lúc nào, hoặc **"Không phải spam"** để bài đó không bao giờ bị ẩn lại (không gọi API).
  * Thống kê **"Lần hoãn ẩn"** trong Popup: đếm số lần ZenFeed trì hoãn thu gọn khi bài còn trong vùng đọc; đây không phải phép đo FPS hay số lần giật khung hình.
* **Badge trên icon:** Hiện số bài đã ẩn trong tab; `!` khi thiếu API key/tiêu chí hoặc API đang lỗi; `OFF` khi tắt.
* **Preset Mẫu 1-Click:** Tích hợp sẵn các bộ lọc thông dụng: Chống cờ bạc/cá độ, Chống spoiler phim, Chống drama showbiz câu view, Chống rác tiền ảo.

---

## 🚀 Hướng Dẫn Cài Đặt (Trong 1 Phút)

### Bước 1: Nạp Extension vào Trình Duyệt Chrome / Edge / Brave
1. Mở trình duyệt Chrome và truy cập đường dẫn: `chrome://extensions`
2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
3. Bấm vào nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
4. Chọn thư mục dự án `zenfeed`:
   ```
   /Users/mac/Desktop/jev-facebook-filter
   ```
5. Icon của **ZenFeed** sẽ xuất hiện trên thanh công cụ của trình duyệt. Bạn nên ghim (pin) icon này để dễ truy cập.

---

### Bước 2: Cấu hình API Key & Tiêu Chí Lọc
1. Bấm vào icon **ZenFeed** trên thanh công cụ để mở Popup.
2. Nhập API Key TypeSafe Jev của bạn vào ô **API Key**. *(Nếu dùng proxy hoặc Vercel AI Gateway, bấm "Tùy chỉnh Endpoint" để đổi URL — Chrome sẽ hỏi cấp quyền truy cập domain đó).*
3. Bấm nút **⚡ Kiểm tra kết nối** để xác nhận API Key hoạt động bình thường.
4. Chọn một Preset có sẵn hoặc tự gõ tiêu chí bạn muốn ẩn vào ô text.
   * *Ví dụ tiêu chí ẩn: "quảng cáo, bất động sản, spam, lừa đảo, tuyển dụng việc làm"*
   * *Ngoại lệ / Whitelist (Tùy chọn):* Nhập các chủ đề bạn **luôn muốn giữ lại** (ví dụ: `IT, AI, Lập trình viên, Việc làm công nghệ`). Nhờ kiến trúc **Atomic Questions** của Jev System One, bài viết tuyển dụng IT/AI sẽ được giữ lại an toàn mà không bao giờ bị ẩn nhầm!
5. Điều chỉnh ngưỡng độ tin cậy (mặc định: **70%**).
6. Cài đặt **tự lưu** và áp dụng ngay trên các tab Facebook đang mở. Riêng tiêu chí lọc và ngoại lệ cần bấm **Áp dụng** (hoặc Ctrl/⌘ + Enter) — để tiêu chí gõ dở không làm tốn token; bản nháp được giữ lại nếu bạn đóng popup.

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
├── icons/                     # Bộ icon 16x16, 32x32, 48x48, 128x128
├── src/
│   ├── background/
│   │   ├── background.js      # Service Worker: xử lý batch, badge, tin nhắn
│   │   ├── decision-cache.js  # Cache quyết định (IndexedDB, LRU)
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
│   │   ├── clip-text.js       # Cắt giữ đầu + đuôi bài dài (dùng chung content/worker)
│   │   └── logger.js          # Nhật ký hoạt động (ghi theo lô, storage.session)
│   └── popup/
│       ├── popup.html         # Giao diện cài đặt tiện ích
│       ├── popup.css          # Tùy biến giao diện popup hiện đại
│       └── popup.js           # Xử lý sự kiện lưu cài đặt & test API key
└── test/
    ├── test-jev-mock.js       # Kiểm thử tự động (Node)
    ├── content-harness.html   # Kiểm thử content script trên DOM giả lập (trình duyệt)
    ├── run-harness-headless.js # Chạy harness bằng Chrome headless
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
Hoặc chạy tự động bằng Chrome headless (đặt `CHROME_PATH` nếu Chrome không ở vị trí mặc định của macOS):
```bash
npm run harness:headless
```
