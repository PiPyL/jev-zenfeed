---
title: "Pha 4: Cài đặt, quyền truy cập và công bố dữ liệu"
status: todo
---

# Pha 4: Cài đặt, quyền truy cập và công bố dữ liệu

## Overview

Ưu tiên P1; 6–8 giờ. Cho người dùng chủ động bật Threads và hiểu rõ quyền đọc trang, dữ liệu gửi tới AI, phạm vi lọc. Không khiến bản cập nhật tự động có quyền Threads mới. Phụ thuộc adapter pha 3 và quyết định sản phẩm đã chốt.

## Quyết định quyền

Threads là tính năng thêm vào, nên dùng `chrome.permissions.request({origins:['https://www.threads.com/*']})` ngay trong click bật Threads. [Chrome Permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions) khuyên quyền tùy chọn cho feature tùy chọn; [Scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting) cho phép đăng ký content script động. `manifest.json` giữ Facebook static; Threads origin nằm trong `optional_host_permissions` (repo hiện có wildcard cho endpoint tùy chỉnh, nhưng lời gọi Threads phải xin origin cụ thể). Không dùng `activeTab` vì ZenFeed cần lọc liên tục khi cuộn/mở tab.

## Requirements

- [ ] Popup có chọn Facebook/Threads rõ ràng; chỉ lưu tiêu chí, ngoại lệ, ngưỡng và trạng thái của nền tảng đang chọn. Global master, API key, ngôn ngữ và hide mode vẫn có ý nghĩa rõ. Khi chưa ở tab hỗ trợ, hiển thị lựa chọn và trạng thái quyền, không suy ra platform từ tab trước.
- [ ] Bản nháp và trạng thái chưa áp dụng phải tách theo platform cho **cả tiêu chí lẫn ngoại lệ**. Chuyển Facebook ↔ Threads giữ bản nháp riêng hoặc yêu cầu Apply/Discard rõ ràng; nút Apply ghi theo platform gắn với bản nháp được hiển thị, không theo lựa chọn vừa đổi bất đồng bộ. Đóng/mở popup không làm bản nháp một nền tảng ghi sang nền tảng kia.
- [ ] Threads mặc định tắt; trước khi bật, giải thích quyền trên `threads.com`, loại nội dung cần đọc và việc snippet sẽ gửi đến endpoint AI do user cấu hình. Nếu người dùng từ chối, không inject, không lưu enabled=true; Facebook tiếp tục chạy.
- [ ] Không tự sao chép tiêu chí Facebook sang Threads; cung cấp hành động copy rõ ràng nếu người dùng muốn, rồi cho xem/chỉnh trước khi lưu. Ngưỡng Threads có default 70% nhưng chỉ có hiệu lực khi đã có tiêu chí.
- [ ] `permissions.contains` + `scripting.getRegisteredContentScripts` được reconcile lúc startup/install/update, khi cấp hoặc gỡ quyền, và khi bật/tắt. Đăng ký một bundle Threads duy nhất; inject ngay vào tab Threads đã mở sau khi bật (chỉ tab có quyền), tránh duplicate. Tắt/gỡ quyền phải ngừng observer, trả DOM gốc và xóa badge tab.
- [ ] Tắt Threads có protocol **content-side trước revoke**: đổi `threadsEnabled=false`/tăng generation, hủy queue/inflight/timers, ngừng observer, unhide và unregister mọi card, ACK về worker; mọi partial/final response cũ phải bị bỏ. Sau ACK mới unregister/revoke. Nếu user gỡ quyền từ Chrome UI trước, `permissions.onRemoved` phải kích hoạt cùng cleanup; test trạng thái không ACK và cách khôi phục khi tab còn mở.
- [ ] Thống kê/log thể hiện platform để người dùng hiểu hiệu quả/chi phí; tổng lịch sử cũ của Facebook vẫn chính xác. Schema giữ `stats` tổng hiện có và thêm `statsByPlatform` tương thích; lần đầu khởi tạo quy toàn bộ số liệu cũ cho Facebook vì bản trước chỉ chạy Facebook, tránh cộng đôi. Worker suy ra platform từ `sender.tab.url` cho `UX_METRIC`, `LOCAL_STATS`, `TAB_STATUS`, `LOG_EVENT`, batch và mark-safe; không tin nhãn client. Không ghi raw post, author, URL hoặc API key vào log/telemetry.
- [ ] Cập nhật bản tiếng Việt/Anh và mọi locale hiện có cho nhãn mới; thông báo tình trạng unsupported surface và API error không đổ lỗi cho Threads.
- [ ] Chính sách quyền riêng tư và Web Store listing nói đúng chuyện đọc website content và truyền snippet/author tới endpoint AI. Rà lại phát biểu hiện có về “public”, “cryptographic hash” và “không PII”: `fast-hash.js` là FNV, và `jev-client.js` gửi author; sửa claim sai có liên quan đến feature, không lặp lỗi sang Threads.

## Implementation Steps

1. Thêm UI chọn nền tảng và badge quyền ở `src/popup/popup.html`, style trong `popup.css`, logic load/save ở `popup.js`. Thay `DRAFT_KEY`/`savedCriteria` chung hiện tại bằng trạng thái nháp theo platform gồm criteria+whitelist và platform snapshot cho Apply; giữ quy tắc khôi phục draft Facebook cũ. Dùng settings resolver pha 2; test mở popup ở Facebook, Threads, trang khác và khi quyền bị từ chối.
2. Trong `background.js`, đăng ký/huỷ đăng ký script Threads bằng ID ổn định; xử lý `permissions.onRemoved`; reconcile trạng thái khi service worker thức dậy. Dùng manifest entry/constant mô tả thứ tự file một lần để tránh drift giữa dynamic registration và immediate injection. Thực thi cleanup/ACK trước khi gỡ quyền do popup khởi tạo; với revocation ngoài popup, phát hiện, dừng script và khôi phục khi còn quyền message, kiểm tra fallback qua reload trang thử nghiệm. Không đưa access token/cookie vào workflow.
3. Trong `content.js`, fence `applyDecision`/partial/final bằng platform generation, không chỉ global master. Khi tắt hoặc revocation, dọn `candidateQueue`, `inFlight`, retry/timer/observer và unhide/unregister. Worker cũng không xử lý batch mới sau thời điểm tắt. Test cố ý trì hoãn cả partial và final response qua thời điểm gỡ quyền.
4. Trong `background.js` và `popup.js`, giữ tổng `stats` tương thích rồi thêm `statsByPlatform` ở local/session với serialized write chain hiện có. Migrate số cũ sang Facebook đúng một lần, tính tổng mới từ delta không cộng đôi; gắn platform cho logs/metrics từ sender. Test migration, nhiều tab và ẩn nhầm.
5. Cập nhật `src/utils/i18n.js` và `_locales/*/messages.json` nếu manifest string cần đổi. Soát logo/trademark/disclaimer, tính năng và permission rationale trong `README.md`, `README.vi.md`, `PRIVACY.md`, `CHROMEWEBSTORE.md`, cùng trang privacy/landing nếu đang công bố lại phạm vi Facebook-only.
6. Cập nhật unit/harness test cho từ chối quyền, cấp quyền, gỡ quyền, browser restart, tab đang mở, bật/tắt từng platform, đồng bộ nhiều tab và không rescan Facebook khi chỉ sửa tiêu chí Threads. Thử chuyển platform khi criteria và whitelist đều dirty, đóng/mở popup, Apply rồi kiểm tra không ghi chéo hoặc mất draft.

## Todo

- [ ] Có flow opt-in Threads cụ thể, popup không làm thay đổi nhầm Facebook.
- [ ] Quyền và dynamic script không tồn tại khi người dùng từ chối/gỡ quyền.
- [ ] Privacy, Store listing, README và UI cùng mô tả một hành vi thực.

## Success Criteria

Test chứng minh: nâng cấp từ Facebook-only không inject vào Threads; user từ chối quyền thì **0** scan/API call; cấp quyền thì tab Threads đang mở hoạt động một lần; tắt/gỡ quyền trả card về trạng thái gốc dù kết quả AI về muộn; draft/Apply criteria+whitelist không ghi chéo; migration stats không mất/cộng đôi, attribution đúng platform; Facebook setting/cache/stat không đổi; API key không xuất hiện trong content script, DOM hay log. Kiểm tra thủ công Chrome permission prompt và các locale chính.

## Rủi ro và rollback

- Chrome API ở các browser Chromium khác có khác biệt: xác minh trên Chrome mục tiêu, ghi giới hạn Edge/Brave/Cốc Cốc thay vì tuyên bố chung.
- `optional_host_permissions` hiện có wildcard vì custom AI endpoint; không mở rộng quyền này hơn mức cần thiết cho Threads. Rollback là unregister script Threads, tắt setting và cập nhật công bố nếu release rút lại.
