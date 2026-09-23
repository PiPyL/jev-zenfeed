---
title: "Pha 2: Hợp đồng nền tảng và bộ điều phối chung"
status: todo
---

# Pha 2: Hợp đồng nền tảng và bộ điều phối chung

## Overview

Ưu tiên P1; 6–10 giờ. Điều kiện đầu vào: pha 1 cho phép tiếp tục. Tách phần phụ thuộc Facebook ra khỏi vòng đời quét/đánh giá mà không viết lại bộ lọc. Facebook là regression baseline. Thực thi trên checkout có WIP: ghi diff ban đầu và chỉ thay phần cần thiết.

## Kiến trúc

`manifest content script theo host → platform adapter → content.js (Mutation/Intersection/batch/reading zone) → background.js (Jev/cache/stats) → ui-overlay.js`. Adapter là đối tượng nhỏ trong namespace hiện có, không tạo framework plugin mới. Hợp đồng tối thiểu: `id`, `isSupportedRoute()`, `isProtectedSurface(node)`, `getPostsWithin(root)`, `extractPostData(card)`, `isSamePost(old, next)`; thêm `signatureOf(card)` chỉ khi fixture chứng minh signature chung không an toàn. Mỗi adapter phải trả **đúng một card độc lập**; nếu không chắc, trả rỗng/fail-open.

**Bất biến:** content script chỉ có public settings; background giữ API key. `extensionEnabled` vẫn là global master. Facebook storage keys và cache cũ giữ nguyên. Với Threads, cả hash quyết định và key của user override cần namespace/đầu vào gồm `threads` + author + nội dung đã cắt + quote/link context để không mượn verdict Facebook; không đổi key Facebook. Phải thống nhất cùng một fingerprint và config snapshot giữa tab, worker, hot-cache và `MARK_SAFE`.

## Requirements

- [ ] Chuyển các lệnh gọi `JevFB.getPostsWithin/getAllPosts/extractPostData/isSamePost/isInChat` và guard `/messages` trong `content.js` sang adapter, giữ timing/observer/hide/reveal đang có.
- [ ] Xử lý route đổi từ supported sang protected: hủy queue/inflight phù hợp, unhide/unregister card cũ và không gửi snippet mới; khi quay lại, quét lại. Không dựa duy nhất vào reload.
- [ ] Worker xác nhận message `EVALUATE_BATCH`, `MARK_SAFE`, `GET_HOT_DECISIONS`, `TAB_STATUS` đến từ tab host được khai báo, dùng platform từ `sender.tab.url` thay vì tin nhãn platform trong message. Nếu message mâu thuẫn, bỏ qua/fail-open.
- [ ] `MARK_SAFE` ghi override vào cache rồi broadcast `{platform, hash, criteriaFingerprint, generation}` tới tab cùng host; content script kiểm tra config/generation hiện tại, cập nhật local cache, unhide mọi bản sao và badge. Tab khác nền tảng/tiêu chí không được áp override.
- [ ] Khi cài/cập nhật và xóa cache, xử lý mọi entry content script/host được hỗ trợ; không còn giả định `content_scripts[0]` là toàn bộ. Không inject trùng hoặc báo lỗi cho tab không có quyền.
- [ ] Giữ chia sẻ AI client, threshold, whitelist, cache generation, stats và overlay; sửa fallback author `'Facebook User'` thành nhãn trung tính mà không đổi ý nghĩa prompt.

## Implementation Steps

1. Tạo `src/content/fb-adapter.js` bọc `fb-selectors.js` và `text-extractor.js` hiện tại; nạp trước `content.js`. Ghi test hợp đồng để Facebook vẫn tìm đúng post và bỏ comment/Messenger.
2. Trong `src/content/content.js`, dùng adapter của host hiện tại cho scan, extract, identity và route guard. Di chuyển text log Facebook cứng sang nhãn platform. Bảo toàn logic retry/reading zone, cancel request và restore DOM.
3. Trong `src/background/background.js`, chuẩn hóa `platformForSender`, chọn settings snapshot và cache key theo platform; kiểm tra schema/kích thước batch, sender, route host. Không đổi logic Jev và định dạng quyết định đã có.
4. Trong `src/utils/settings-defaults.js`, thêm hàm resolve public settings và fingerprint theo platform. Nếu chọn tiêu chí riêng: giữ flat keys Facebook làm nguồn cũ, thêm keys Threads rõ tên (`threadsEnabled`, `threadsFilterCriteria`, `threadsWhitelistCriteria`, `threadsConfidenceThreshold`), với default Threads **tắt** cho tới khi user chọn và cấu hình; popup phase 4 quản lý thao tác này. Không sao chép API key vào public keys.
5. Cập nhật `GET_HOT_DECISIONS`, `MARK_SAFE`, cache clear broadcast và báo badge để hai host cùng một contract, không trộn verdict do tiêu chí khác. Test hai tab cùng platform cùng một post: ẩn nhầm ở tab A phải hiện ở tab B; tab khác platform không đổi.

## Todo

- [ ] Contract adapter và test Facebook baseline được viết trước thay đổi lớn.
- [ ] Shared engine chạy Facebook như cũ và nhận adapter giả lập Threads trong test.
- [ ] Worker khóa platform theo sender, cache/override/clear-cache đúng namespace và broadcast `MARK_SAFE` đúng tab.

## Success Criteria

`npm test`, `npm run lint`, `npm run harness:headless` của Facebook xanh trên candidate; test mới chứng minh route protected không tạo `EVALUATE_BATCH`, Facebook cache cũ còn hit, Threads không nhận cache/override của Facebook, clear cache tới tất cả tab có quyền. Chưa kết luận Threads hoạt động live ở pha này.

## File và rủi ro

- Sửa: `src/content/content.js`, `src/background/background.js`, `src/background/jev-client.js`, `src/utils/settings-defaults.js`, `manifest.json`, `test/test-jev-mock.js`, `test/content-harness.html`.
- Tạo: `src/content/fb-adapter.js`; các adapter Threads ở pha 3.
- Rủi ro: worker đánh giá bằng settings đã đổi giữa chừng hoặc tab nhận kết quả cũ; fence bằng config/platform key đang dùng và generation hiện có. Rollback bằng bỏ đăng ký Threads và giữ adapter Facebook tương thích, không xóa cache người dùng.
