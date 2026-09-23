---
title: "Pha 3: Adapter DOM Threads và hiển thị an toàn"
status: todo
---

# Pha 3: Adapter DOM Threads và hiển thị an toàn

## Overview

Ưu tiên P1; 12–16 giờ. Chỉ bắt đầu sau khi pha 1 đã ghi nhận DOM thực tế và pha 2 ổn định. Không lấy selector từ suy đoán hoặc từ endpoint nội bộ. Mỗi bề mặt được thêm dựa trên ma trận đã xác minh.

## Bề mặt và nội dung

| Nhóm | Hợp đồng mục tiêu |
|---|---|
| Home For You/Following, custom feed, multi-column và auto-update | Tìm từng post top-level trong **đúng cột feed**; mutation của cột A không làm quét lại cả trang/cột B. |
| Search/community/profile public post list | Chỉ lọc những danh sách mà pha 1 chứng minh post boundary rõ; không lọc ô tìm kiếm, profile header, feed navigation hoặc recommendations không phải post. |
| Permalink/conversation | Giữ root post và replies nguyên trạng mặc định; nếu sau này user yêu cầu lọc reply, lập contract và UI riêng. |
| Composer, DM/group chat, notification, activity, insights, saved/liked, draft, modal | Luôn loại trừ, kể cả khi có text/ảnh giống một post. |
| Quote/repost | Tính quyết định trên nội dung **post ngoài** cộng phần quote/preview có ý nghĩa, không đăng ký quote lồng thành post độc lập. |
| Media-only | Nếu không có caption/alt text hữu ích, fail-open và không gửi yêu cầu AI; không giả định OCR/nhận diện hình ảnh đã tồn tại. |

## Requirements

- [ ] Adapter nhận diện card bằng semantic/ARIA/link structure đã ghi ở pha 1, kết hợp nhiều tín hiệu độc lập; không dùng vị trí DOM hoặc tên class băm làm căn cứ duy nhất. Kiểm tra card không bao nhiều post, cột hoặc protected surface.
- [ ] Extractor chỉ lấy author, caption, topic tag, link title/description và alt text **có nghĩa** nằm trong card; loại nút tương tác, số lượt, timestamp, user bio, replies, composer, quote lặp. Giữ text ổn định trước/sau blur/collapse, có giới hạn độ dài trước AI.
- [ ] Trước khi extract/sent, áp quyết định visibility của pha 1: mặc định card không chứng minh được public audience (private/follower-only/unknown) phải fail-open, không `EVALUATE_BATCH`; nếu user chốt mô hình “mọi bài đang thấy”, phải có consent/disclosure/provider retention tương ứng. Fixture và live smoke bao gồm cả hai loại.
- [ ] Post identity ưu tiên permalink/post id nếu có trong DOM; fallback author+head+payload ổn định. Khi card bị tái sử dụng, unhide/re-evaluate. Khi caption mở rộng hoặc alt đến muộn, đánh giá lại; không đánh giá lại do like count/time update.
- [ ] Overlay hiện có hoạt động ở cả cột hẹp, light/dark, zoom 125–200%, bàn phím/screen reader; click xem lại và ẩn nhầm không kích hoạt tác vụ Threads. CSS Threads dùng token phù hợp/namespace, không dựa vào biến màu Facebook.
- [ ] Nếu mất selector, route thay đổi hoặc DOM không còn chắc, ngừng lọc bề mặt đó và khôi phục bài đã che; không để bài kẹt ở trạng thái blur/ẩn sau lỗi API, navigation hoặc extension reload.

## Implementation Steps

1. Tạo `src/content/threads-adapter.js` từ fixture pha 1. Hàm `getPostsWithin(root)` chỉ đi từ feed root/cột được hỗ trợ, loại post lồng/quote/reply và protected ancestor. Hàm `isSupportedRoute` kiểm tra cả path và vùng DOM thực tế; route không xác minh trả false.
2. Tạo `src/content/threads-text-extractor.js` nếu adapter một file trở nên khó đọc; trích text/author/identity, hash có prefix platform và quote/link context. Kiểm thử tiếng Việt, tiếng Anh, emoji, text ngắn, text nối tiếp, translate/see-more, link preview, ảnh có/không alt.
3. Chuẩn bị bundle Threads riêng với `https://www.threads.com/*` và host phụ chỉ khi pha 1 chứng minh cần. Nạp `settings-defaults`, i18n, hash/clip, data/overlay chung, adapter Threads, `content.js` theo thứ tự; pha 4 sẽ đăng ký động sau khi người dùng cấp quyền host tùy chọn. Dùng `document_start` nếu thực nghiệm giữ lợi ích prepaint mà không quét sai, nếu không thì chọn thời điểm an toàn đã đo.
4. Bổ sung CSS scope Threads trong `src/content/content.css` hoặc stylesheet Threads riêng khi khác biệt đáng kể. Test banner/blur/remove trên card tối thiểu, không ẩn cả cột và không bẻ layout. Giữ nút reveal có vùng nhấn, focus và mô tả dễ hiểu.
5. Tích hợp route change/multi-column lifecycle: thêm cột, xóa cột, chuyển feed, auto-update, tab restore, infinite scroll, card recycle, mở/đóng popup composer; không để observer/timer của card đã rời DOM giữ tài nguyên.

## Todo

- [ ] Post detection/extraction khớp ma trận pha 1, không động tới vùng cấm.
- [ ] Tất cả ba hide mode và reveal/mark-safe chạy với Threads card.
- [ ] Điều hướng SPA và multi-column không gây double-count/extra AI request.

## Success Criteria

Fixture tests phải chứng minh: mỗi post hiển thị được xử lý tối đa một lần trên cùng nội dung+config; quote lồng không thành card riêng; DM/composer/notification/saved/liked và media-only thiếu text gửi **0** `EVALUATE_BATCH`; private/unknown cũng gửi 0 theo mặc định public-only; route unsupported trả lại DOM gốc; dark/light và layout hẹp không che điều khiển. Đối chiếu trực tiếp trên Threads web ở pha 5 trước khi gọi là hỗ trợ thực tế.

## File và rủi ro

- Tạo: `src/content/threads-adapter.js`, có thể `src/content/threads-text-extractor.js`, fixture đã ẩn danh trong `test/`.
- Sửa: `manifest.json`, `src/content/content.js`, `src/content/content.css`, `src/content/ui-overlay.js`, `test/content-harness.html` hoặc harness Threads riêng.
- Rủi ro lớn nhất là DOM Threads đổi thường xuyên và card lồng; ưu tiên fail-open và báo trạng thái “không hỗ trợ bề mặt này” thay vì selector rộng. Không dùng network interception/cookie/private GraphQL làm fallback.
