---
title: Chuẩn hóa UX Copy 3 chế độ làm mờ bài viết
date: 2026-09-23
summary: "Chuẩn hóa tên gọi và microcopy 3 chế độ làm mờ (Zen Oasis, AI X-Ray, Knowledge Swap) theo tiêu chuẩn Business Analysis và Marketing UX."
---

# Chuẩn hóa UX Copy 3 chế độ làm mờ bài viết

## What happened
Đánh giá nội dung menu cấu hình làm mờ bài viết ("Blur Canvas Style") cho thấy sự bất đối xứng trong cấu trúc song ngữ (hai chế độ đầu dùng tên tiếng Anh + giải thích tiếng Việt, chế độ thứ ba đảo ngược thành tên tiếng Việt + từ mượn tiếng Anh). Từ ngữ cũ ("Vòng thở", "Tóm tắt nhanh lý do", "Thẻ Tri Thức") mang tính mô tả tĩnh, chưa truyền tải được hành động và giá trị cốt lõi của tính năng.

## Decision
Áp dụng Phương án Chuẩn Hóa Hiện Đại (Phương án A) và triển khai 4 nâng cấp trải nghiệm người dùng từ phiên bản Predict:
1. **Zen Oasis**: Cập nhật thành `🌿 Zen Oasis (Nhịp thở & Tĩnh tâm)`. Bổ sung nút tương tác `🔄 Đổi câu khác` (Next quote) cho phép người dùng đổi sang câu nói khác ngay tức thì.
2. **AI X-Ray**: Cập nhật thành `🔍 AI X-Ray (Soi nhanh lý do ẩn)`. Thêm key `blurPresetXrayTag: 'AI X-Ray'` để badge thẻ hiển thị gọn gàng, tinh tế.
3. **Knowledge Swap**: Cập nhật thành `🎓 Knowledge Swap (Flashcards học nhanh)`. Đồng bộ tên concept quốc tế, giữ nguyên bản sắc "Hoán đổi rác lấy kiến thức".
4. **Mở rộng kho tri thức & châm ngôn chống nhàm chán**:
   - Nhân đôi kho danh ngôn Zen lên 30 câu tiếng Việt và 30 câu tiếng Anh (Naval Ravikant, Marcus Aurelius, Seneca, Thích Nhất Hạnh, Lao Tzu, Carl Jung, Buddha). Tăng bộ đệm LRU chống lặp lên 12 items.
   - Mở rộng kho Flashcards: 16 từ vựng IELTS học thuật (C1/C2), 12 phím tắt và kỹ năng công nghệ thực chiến, 10 nguyên lý triết học Stoic/Đạo gia sâu sắc.
5. **Tối ưu hóa hiệu năng**: Cơ chế `IntersectionObserver` ngắt động cơ thở (`animation-play-state: paused`) khi bài viết ra khỏi tầm nhìn, tiết kiệm 100% tài nguyên CPU khi cuộn feed.

## Verification
- Cập nhật từ điển đa ngôn ngữ trong `src/utils/i18n.js` (bổ sung `btnNextQuote` cho Vi, En và fallback).
- Điều chỉnh hiển thị tag thẻ X-Ray và render động `renderQuote()` trong `src/content/ui-overlay.js`.
- Bổ sung định dạng CSS cho `.jev-btn-next-quote` trong `src/content/content.css`.
- Mở rộng bài kiểm thử Test 25 & Test 29 trong `test/test-jev-mock.js`.
- Chạy `npm test` thành công 32/32 tests; `npm run lint` toàn bộ tệp đạt 100%.
- Tái đóng gói thành công `dist/zenfeed-v1.0.0.zip` với script `npm run build:zip` (154.2 KB).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
