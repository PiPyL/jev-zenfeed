---
title: "Pha 1: Xác minh điều khoản và DOM Threads"
status: todo
---

# Pha 1: Xác minh điều khoản và DOM Threads

## Overview

Ưu tiên P0; 4–6 giờ kỹ thuật, thời gian xác minh điều khoản tách riêng. Pha này quyết định có cơ sở để làm adapter DOM và bề mặt nào có thể lọc an toàn. **Chưa bật tính năng cho người dùng.**

## Căn cứ

- [Threads Terms of Use §3](https://help.instagram.com/769983657850450) hạn chế phần mềm/quy trình tự động theo dõi hoặc trích xuất dữ liệu; [Instagram Terms](https://help.instagram.com/581066165581870) áp dụng bổ sung. Không suy diễn việc lọc cục bộ đương nhiên được miễn trừ.
- [Meta công bố Threads web](https://about.fb.com/news/2025/04/new-features-threads-web-experience/): `threads.com`, single/multi-column, custom feeds, auto-update, các cột khác (search, profile, saved, activity, insights) và composer nổi.
- [API overview](https://developers.facebook.com/docs/threads/overview/) không có contract Home feed; không khảo sát private endpoint/cookie để thay thế.
- Repo chưa có `.codegraph/` hoặc zvec index; nguồn kiểm chứng hiện tại là mã và test trong checkout `jev-zenfeed`.

## Requirements

- [ ] Xác nhận với tư vấn phù hợp/Meta rằng use case extension đọc DOM post trong tab người dùng, gửi snippet tới endpoint AI do người dùng cấu hình và thay đổi hiển thị có đường phát hành chấp nhận được; ghi rõ điều kiện, ngày kiểm tra và căn cứ. Nếu không, kết luận `NO-GO` cho phát hành Threads.
- [ ] Khảo sát bằng tài khoản thử nghiệm hợp lệ trên Chrome phiên bản mục tiêu: Home For You/Following, custom feed, nhiều cột, feed công khai trong search/community/profile, post permalink/replies; riêng DM, composer, notification, saved/liked, activity, insights phải xác định guard rõ.
- [ ] Với từng bề mặt, ghi host/path/DOM semantic anchors, post boundary, author/body/topic/quote/link/media alt, dấu hiệu card recycle, các ngôn ngữ UI và trạng thái đăng nhập. Kiểm tra khả năng phân biệt bài của tài khoản private/follower-only; mặc định card không chứng minh được public phải fail-open và không gửi AI. Nếu muốn lọc mọi bài nhìn thấy, phải chốt lại disclosure/consent và điều khoản/provider retention. Chụp fixture đã thay tên/nội dung cá nhân; không lưu cookie, token, DM hay bài riêng tư.
- [ ] Kiểm tra `threads.com` (apex) và `threads.net` chuyển hướng như thế nào trong môi trường thử; chỉ thêm từng host nếu vẫn render nội dung cần lọc.

## Implementation Steps

1. Đọc lại điều khoản và hướng dẫn Meta hiện hành ngay ngày thực thi; ghi quyết định `GO / CONDITIONAL / NO-GO` cho prototype và cho phát hành, với người chịu trách nhiệm. Trường hợp `NO-GO` dừng pha 2–5, không tìm đường truy cập khác.
2. Mở Threads web thủ công trên profile thử nghiệm; lập bảng bề mặt theo cột: URL, vùng post, vùng cấm, selector/ARIA ổn định, sự kiện SPA, rủi ro card lồng và phương án fail-open. Không truy vấn API nội bộ, không crawl nhiều trang.
3. Kiểm tra thao tác nhạy cảm: mở composer, reply, DM, click profile, chuyển cột, auto-update, dark mode, thu/phóng, cuộn ảo. Đánh dấu nơi post boundary không chắc chắn là `unsupported` cho đến khi tìm được tiêu chí an toàn.
4. Tạo fixture DOM tối thiểu, đã ẩn danh, và ma trận coverage trong `plans/260923-1533-threads-feed-filter/research/threads-dom-matrix.md`; thêm báo cáo điều khoản `research/terms-assessment.md`, quyết định sản phẩm về tiêu chí/bề mặt/bài private và đường dẫn nguồn. Đây là bằng chứng của pha sau, không phải bằng chứng rằng Threads DOM có contract công khai ổn định.

## Todo

- [ ] Có kết luận điều khoản cho prototype và public release; blocker được đánh dấu rõ.
- [ ] Có ma trận DOM/route cho mọi bề mặt dự kiến cùng fixture đã ẩn danh.
- [ ] Có decision record phạm vi v1 theo câu trả lời sản phẩm của người dùng.

## Success Criteria

Pha này chỉ đạt khi có `GO`/`CONDITIONAL` đủ rõ cho công việc tiếp theo, **decision record sản phẩm đã chốt** (settings chung/riêng, bề mặt, dữ liệu private) và ít nhất Home For You/Following cùng custom feed single/multi-column có post boundary không lẫn composer/DM/reply. Nếu chọn public-only mà DOM không cho xác định public audience đủ để lọc các feed cam kết, đó là `NO-GO` hoặc một thay đổi phạm vi/consent phải được người dùng quyết định; không tuyên bố “hỗ trợ Threads” với coverage gần như bằng không. Không bắt đầu schema/settings pha 2 khi quyết định còn mở.

## Rủi ro và rollback

- Điều khoản có thể không cho phép cách đọc DOM dự kiến: dừng adapter, giữ Facebook nguyên trạng.
- Threads thay markup theo tài khoản/khu vực: fixture phải ghi điều kiện và dùng fail-open khi selector không chắc. Không dùng class obfuscated làm căn cứ duy nhất.
