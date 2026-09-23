---
title: Lập kế hoạch hỗ trợ Threads cho ZenFeed
date: 2026-09-23
summary: "Nghiên cứu Threads và lập plan 5 pha cho extension ZenFeed; chặn triển khai tại cổng chính sách, DOM và quyền riêng tư."
---

# Lập kế hoạch hỗ trợ Threads cho ZenFeed

## What happened
- Đọc luồng lọc Facebook hiện tại của extension `jev-zenfeed`, cấu trúc popup, background, content script, cache và thống kê. Chỉ thêm tài liệu plan, không sửa mã nguồn.
- Đối chiếu tài liệu chính thức của Meta về Threads web, API và điều khoản; đối chiếu tài liệu Chrome về optional host permissions, dynamic content scripts và disclosure dữ liệu.
- Tạo `plans/260923-1533-threads-feed-filter/` gồm index, 5 pha và tài liệu nghiên cứu; 3 lượt review đã đưa 6 vấn đề P1 vào bước thực hiện và kiểm thử.
- `ak plan validate` trả valid=true; plan gồm 45 đầu việc và đang pending.

## Decision
- Hướng kiến trúc dự kiến: adapter DOM Threads trên `threads.com`, dùng chung engine hiện tại và bật quyền host theo opt-in. Không giả định Threads API cung cấp personalized Home feed.
- Pha 1 phải xác minh DOM đăng nhập, phạm vi sản phẩm, cách xử lý bài private và cổng điều khoản trước khi triển khai.
- Mặc định bảo vệ dữ liệu: bài chưa chứng minh public không gửi AI; nếu ranh giới audience không nhận diện tin cậy thì đây là cổng NO-GO cho chế độ lọc AI.

## Next steps
- Chốt ba lựa chọn sản phẩm về settings, bề mặt và bài private; xác minh trực tiếp trên Threads web với tài khoản thử nghiệm.
- Sau khi qua cổng pha 1, thực hiện các pha theo thứ tự và kiểm chứng canary trước phát hành.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
