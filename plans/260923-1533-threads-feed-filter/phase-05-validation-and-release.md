---
title: "Pha 5: Kiểm thử trực tiếp, canary và phát hành"
status: todo
---

# Pha 5: Kiểm thử trực tiếp, canary và phát hành

## Overview

Ưu tiên P1; 8–12 giờ. Phân biệt rõ test fixture, chạy trong trình duyệt thực và phát hành. Không gọi ZenFeed “đã hỗ trợ Threads” chỉ vì test xanh. Chỉ thực hiện canary/public release khi cổng điều khoản pha 1 cho phép.

## Requirements

- [ ] Ma trận test có ít nhất: FB Home/Groups/Profile/Messenger guard; Threads For You/Following/custom single/multi-column/auto-update và các danh sách bài đã cam kết; composer, DM, notification, saved/liked, replies, private/follower-only/unknown audience, media-only, quote, link, dark mode, zoom, ngôn ngữ, SPA navigation, cache clear, no-key/API outage.
- [ ] Kiểm thử bí mật/riêng tư: DevTools network chỉ có request tới endpoint AI đã chọn, payload chỉ gồm text/author của post hợp lệ và tiêu chí; không gửi URL/cookie/token/DM; khi thiếu quyền hoặc route unsupported không gửi request.
- [ ] So sánh chi phí và hiệu năng trên fixture lặp: mỗi bài/nội dung+criteria được đánh giá tối đa một lần khi không đổi; cache hit không gọi AI; mutation do timer/like không tạo batch mới; quan sát memory/observer sau khi xóa cột hoặc route change. Đặt ngân sách đo trước canary theo máy/phiên bản Chrome mục tiêu, không tự tạo claim “sub-200ms” cho Threads.
- [ ] Kiểm tra overlay bằng bàn phím/screen reader và mắt người: reveal, mark-safe, focus, inert/aria-hidden restore, không che menu/actions, không ẩn cả cột, không gây thay đổi chiều cao ngoài mode mà user chọn.
- [ ] Chrome Web Store package chứa đúng script và disclosure, host permission chỉ đúng nhu cầu; cập nhật version, README, privacy, listing và ảnh chụp từ build thực nếu phát hành.

## Implementation Steps

1. Thêm test Threads fixture và integration cho `manifest.json`, dynamic registration, storage migration, sender guard, cache namespace, post extraction, worker outage và undo. Dùng fixture đã ẩn danh từ pha 1, không hard-code DOM được suy đoán.
2. Chạy trong repo `jev-zenfeed`: `npm test`, `npm run lint`, `npm run harness:headless`, `npm run build:zip`. Kiểm tra zip thực có file Threads, không có secret, và manifest permissions đúng. Chạy test landing nếu đã sửa docs/site.
3. Live smoke thủ công trên profile thử nghiệm: mỗi bề mặt hỗ trợ ít nhất 20 post đa dạng (hoặc toàn bộ nếu ít hơn), đối chiếu card detection với nhìn thấy; 0 card protected bị scan/hide, 0 post/cột bị che nhầm do ranh giới; ghi false hide/miss có thể tái hiện. Thử private/follower-only và saved/liked theo contract dữ liệu đã chốt; thử cùng lúc Facebook+Threads, hai tab cùng post rồi `MARK_SAFE`, đổi settings giữa chừng, reload, offline/API lỗi, cấp/gỡ quyền khi partial/final response về muộn và browser restart.
4. Canary opt-in nội bộ trong vài ngày trên Chrome ổn định; ghi các chỉ số cục bộ/quan sát có sự đồng ý: tỷ lệ post phát hiện, cache hit, request/post, lỗi adapter, false hide được user đánh dấu, khả năng khôi phục và thời gian đến quyết định. Không thêm telemetry mạng chỉ để đo. Nếu một protected surface bị chạm hoặc post boundary làm ẩn cả cột thì tắt Threads ngay và sửa trước rollout.
5. Khi cổng điều khoản, test và canary đều đạt, đóng băng SHA/diff của checkout, review quyền/privacy/WIP, đóng gói và submit bản phát hành. Nếu một cổng không đạt, kết luận `NO-GO` cùng lỗi và đường sửa; không tuyên bố đã phát hành.

## Todo

- [ ] Bộ test và lệnh build xanh trên candidate cố định, có bản ghi kết quả.
- [ ] Live smoke chứng minh bề mặt cam kết và 0 protected content bị xử lý.
- [ ] Canary/điều khoản/Store review đều đạt trước thông báo public support.

## Success Criteria

**GO:** mọi test và privacy gate xanh; live smoke đạt 100% post detection trong fixture chuẩn và không bỏ sót có hệ thống ở các bề mặt cam kết; 0 protected surface bị quét/ẩn; 0 lỗi khôi phục DOM; không tăng request do mutation vô nghĩa; Facebook không hồi quy; người phụ trách điều khoản cho phép public release. **CAUTION:** còn lỗi nhỏ có giới hạn rõ và canary chỉ nội bộ. **NO-GO:** điều khoản chưa rõ/không cho phép, thiếu DOM proof, protected content bị xử lý, cache sai nền tảng hoặc test Facebook đỏ.

## Rollback

Tắt `threadsEnabled`, unregister dynamic content script, gỡ quyền Threads khi người dùng chọn, gửi message tới tab Threads để restore toàn bộ DOM; nếu lỗi bản phát hành, rollback extension package về bản trước. Không xóa settings/cache Facebook. Rà lại store listing/privacy nếu tính năng bị rút.
