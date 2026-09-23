---
title: "Mở rộng ZenFeed sang Threads web"
description: "Kế hoạch bổ sung lọc bài Threads trên trình duyệt, tái sử dụng bộ quyết định ZenFeed và giữ an toàn cho hội thoại, quyền riêng tư, Facebook."
status: pending
priority: P1
effort: "36-52h, chưa tính thời gian xác minh điều khoản hoặc chờ Meta"
tags: [feature, frontend, chrome-extension, privacy]
blockedBy: []
blocks: []
created: 2026-09-23
---

# ZenFeed cho Threads web

## Kết quả cần đạt

Người dùng mở Threads trên Chrome và có thể áp dụng bộ lọc ZenFeed cho **bài viết trong các vùng feed/danh sách đã xác minh**, với ba chế độ hiện có (thu gọn, làm mờ, bỏ khỏi trang), khả năng xem lại/đánh dấu ẩn nhầm, ngưỡng và ngoại lệ. Facebook tiếp tục hoạt động đúng như trước. Không đăng bài, tương tác tài khoản, đọc tin nhắn riêng, thu thập nền hay dùng Threads API để lấy feed. Bài nhìn thấy trong feed có thể không phải bài công khai; pha 1 phải xác định xử lý/bỏ qua trường hợp này trước khi gửi tới AI.

**Giả định sản phẩm cần chốt ở pha 1:** mỗi nền tảng có tiêu chí/ngoại lệ/bật tắt riêng; chế độ hiển thị, ngôn ngữ và API key dùng chung. Phạm vi dự kiến gồm Home (For You/Following), feed tùy chỉnh và cột feed, danh sách bài ở search/community/profile; chỉ mở rộng sang bề mặt có ranh giới post an toàn. Reply trong trang hội thoại không được lọc mặc định. Với bài từ tài khoản private/follower-only, mặc định **không gửi AI nếu không chứng minh được là public**; nếu muốn lọc mọi bài nhìn thấy, phải chốt lại phạm vi, disclosure, consent và provider retention trước pha 2.

## Căn cứ và quyết định kiến trúc

Chi tiết nguồn và giới hạn bằng chứng: [Nghiên cứu Threads](./research/threads-platform-findings.md).

| Quan sát | Hệ quả cho plan |
|---|---|
| Meta chuyển web từ `threads.net` sang `threads.com`; web có feed tùy chỉnh, nhiều cột và tự cập nhật. [Meta](https://about.fb.com/news/2025/04/new-features-threads-web-experience/) | Phải kiểm thử host chính, điều hướng SPA, nhiều cột, nội dung mới chèn vào mà không reload. `threads.net` chỉ thêm match nếu thực nghiệm chứng minh cần. |
| Threads có For You/Following và feed tùy chỉnh. [Meta](https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/), [Meta](https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/) | Phạm vi được chọn theo **vùng bài viết**, không dùng một selector toàn trang. |
| Threads có kiểm soát thuật toán riêng như Dear Algo, điều chỉnh chủ đề tạm thời trong ba ngày ở các thị trường được hỗ trợ. [Meta](https://about.fb.com/news/2026/02/threads-dear-algo/) | ZenFeed bổ sung bộ lọc hiển thị cục bộ theo tiêu chí của người dùng; không giả định có thể thay đổi thuật toán Threads. |
| [Threads API overview](https://developers.facebook.com/docs/threads/overview/) tập trung vào đăng/hiển thị bài của chủ tài khoản; tài liệu không mô tả endpoint đọc Home For You/Following của người xem. | Không xây OAuth/Graph API cho tác vụ lọc feed; content script chỉ xem DOM đã render trong tab của người dùng. Đây là suy luận từ phạm vi API đã công bố, không phải khẳng định mọi endpoint tương lai. |
| [Threads Terms of Use §3](https://help.instagram.com/769983657850450) hạn chế truy cập/trích xuất tự động; chưa có ngoại lệ rõ cho tiện ích lọc DOM. | Cổng đánh giá điều khoản/khả năng xin phép Meta trước phát hành công khai; chưa kết luận pháp lý rằng thiết kế được phép. |
| [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) và [match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) cho phép inject theo host và chạy `document_start`. | Khai báo host hẹp, nội dung được phân tích chỉ trong vùng hỗ trợ; xác minh quyền và thông báo dữ liệu gửi tới AI. |

**Phương án chọn:** một bộ điều phối đánh giá, cache, overlay dùng chung; adapter Facebook và Threads chịu trách nhiệm tìm post, trích nội dung, nhận diện route và post đã tương tác. Sao chép toàn bộ pipeline sẽ nhân đôi lỗi lifecycle/chi phí; Threads API không cung cấp feed cá nhân được tài liệu hóa để lọc.

## Các cổng bắt buộc

1. **Điều khoản và quyết định sản phẩm:** ghi nhận đánh giá có thẩm quyền về cách extension đọc DOM và gửi snippet tới AI; chốt tiêu chí dùng chung/riêng, bề mặt, ranh giới bài private. Nếu không có cơ sở phù hợp/permission cần thiết thì dừng phát hành Threads, không lách bằng endpoint nội bộ hoặc scraping nền.
2. **DOM thực tế:** dùng tài khoản thử nghiệm hợp lệ để xác minh cấu trúc hiện hành; không giả định selector từ Facebook hay từ tài liệu API.
3. **Quyền riêng tư:** không quét DM, composer, notification, draft, modal nhạy cảm; không chuyển API key vào content script; chỉ gửi snippet của post hợp lệ tới endpoint đã cấu hình.
4. **Chất lượng:** Facebook regression, Threads fixtures và live smoke có cùng hợp đồng hành vi; đo số bài phát hiện/ẩn nhầm, CLS, latency và số yêu cầu AI, có tiêu chí dừng.

## Phases

| Pha | Mục tiêu | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 1 | [Khảo sát DOM và cổng điều khoản](./phase-01-start.md) | — | Chưa làm |
| 2 | [Hợp đồng nền tảng và bộ điều phối chung](./phase-02-shared-engine-platform-contract.md) | 1 | Chưa làm |
| 3 | [Adapter Threads và bảo vệ giao diện](./phase-03-threads-dom-adapter.md) | 2 | Chưa làm |
| 4 | [Cài đặt, quyền, công bố dữ liệu](./phase-04-settings-and-permissions.md) | 2–3 | Chưa làm |
| 5 | [Kiểm thử, canary, phát hành](./phase-05-validation-and-release.md) | 1–4 | Chưa làm |

## Success Criteria

- [ ] Phạm vi và cổng điều khoản được giải quyết, có tài liệu kết luận để phát hành hoặc dừng.
- [ ] Threads chỉ lọc post thuộc bề mặt đã hỗ trợ; DM/composer/notification không bị đọc, gửi AI hoặc ẩn.
- [ ] Mọi trạng thái xem lại, ẩn nhầm, vô hiệu hóa, cache và nhiều tab hoạt động trên cả hai nền tảng; không trộn quyết định khi ngữ cảnh khác nhau.
- [ ] Test hiện có của Facebook, test Threads và kiểm thử trực tiếp trên Threads web đạt ngưỡng pha 5; quyền riêng tư, README và Chrome Web Store listing khớp sản phẩm thực.

## Nguồn mã hiện tại

`manifest.json`, `src/content/content.js`, `src/content/fb-selectors.js`, `src/content/text-extractor.js`, `src/content/ui-overlay.js`, `src/content/content.css`, `src/background/background.js`, `src/background/decision-cache.js`, `src/background/jev-client.js`, `src/utils/settings-defaults.js`, `src/popup/*`, `test/*`, `PRIVACY.md`, `CHROMEWEBSTORE.md`, `README.md` và `README.vi.md` trong repository này. Các file đang có thay đổi chưa commit; khi thực thi chỉ chỉnh đúng phần liên quan và không ghi đè WIP.

## Red Team Review

Ba lượt review độc lập ghi nhận 6 vấn đề P1, 0 P0; đã đưa vào pha liên quan: draft popup theo platform, gate quyết định sản phẩm, cleanup/fence khi thu hồi quyền, schema stats, đồng bộ `MARK_SAFE` nhiều tab, và ranh giới private/saved/liked. Không có quyết định người dùng nào bị đảo. **Whole-plan consistency sweep:** các yêu cầu này có bước thực hiện và test ở pha 1–5; giả định privacy mặc định là fail-open cho audience chưa chứng minh public cho tới khi quyết định sản phẩm được chốt.

## Validation Log

CLI `ak plan validate` hợp lệ; link tương đối của plan/pha/research tồn tại; các file source được đối chiếu với checkout hiện tại. Chưa xác minh DOM logged-in hoặc permission/revocation trên Threads thật; các điều này là gate pha 1/5, không phải bằng chứng hoàn thành. Các lựa chọn cần chốt ở pha 1: settings riêng/chung, phạm vi bài/reply, và xử lý bài private.

## Trình tự thực hiện

Chạy `/ak:cook /Users/mac/Desktop/AutoWork-Project/ZenFeed/jev-zenfeed/plans/260923-1533-threads-feed-filter/plan.md` sau khi cổng pha 1 cho phép. Plan này chỉ là thiết kế; chưa có tính năng Threads được triển khai.

<!-- slug: threads-feed-filter -->
