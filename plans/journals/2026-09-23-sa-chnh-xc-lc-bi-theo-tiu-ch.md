---
title: Sửa độ chính xác lọc bài theo tiêu chí
date: 2026-09-23
summary: "Rubric, ngoại lệ, ngưỡng whitelist và đoạn giữa bài được chỉnh để quyết định ẩn khớp tiêu chí người dùng."
---

# Sửa độ chính xác lọc bài theo tiêu chí

## What happened
Review của luồng lọc ZenFeed cho thấy sáu lỗi làm bài bị ẩn sai hoặc lọt: rubric coi tin thảo luận là không vi phạm, cụm "trừ/except" bị gửi thành chủ đề cần ẩn, thanh ngưỡng ẩn cũng là ngưỡng whitelist, bài dài bị cắt mất đoạn giữa và hash không khớp phần model đọc, caption làm mất tiêu đề link, tiêu chí mặc định quá rộng.

## Decision
Sửa tại nguồn quyết định. Rubric trỏ `state.criteria` / `state.whitelist` và tính cả tên trang. Cụm ngoại lệ tiếng Việt và tiếng Anh được tách sang whitelist. Whitelist chỉ tha khi đạt 70% và không yếu hơn điểm vi phạm. Bài dài giữ đầu, giữa và cuối; hash dùng đúng chuỗi đã cắt. Tiêu đề preview được ghép vào nội dung; bài ngắn có ảnh không bị bỏ qua. Preset bất động sản bỏ cụm "hoặc tương tự".

## Verification
`npm test` 32/32. `npm run lint` đạt. Harness headless: 3 ca mới (preview, bài ngắn có ảnh, hash đoạn giữa) đạt. Hai ca cũ fail (CSS blur classic và recycle node) nằm ở content.js/CSS không thuộc diff này.

## Next steps
Ngoại lệ mới nhận "trừ/except" và các biến thể tiếng Anh, tiếng Việt. Ảnh chỉ có chữ trong file ảnh vẫn chưa có OCR.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
