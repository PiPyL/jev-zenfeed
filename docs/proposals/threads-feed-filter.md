# Nghiên cứu Threads phục vụ ZenFeed (23-09-2026)

## Threads vận hành như thế nào trên web

| Khả năng đã xác nhận | Nguồn Meta | Hệ quả kỹ thuật cho ZenFeed |
|---|---|---|
| Web chuyển từ `threads.net` sang `threads.com`; hỗ trợ feed một cột hoặc nhiều cột, custom feeds, tự cập nhật, cột search/profile/saved/liked/activity/insights và composer nổi. | [Threads web experience](https://about.fb.com/news/2025/04/new-features-threads-web-experience/) | Host chính là `www.threads.com`; chỉ đọc vùng bài trong cột feed phù hợp, xử lý SPA và card mới chèn; không quét toàn document như một feed duy nhất. |
| For You gồm bài người dùng theo dõi và đề xuất; Following là feed người theo dõi. | [Introducing Threads](https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/) | Test cả hai; tiêu chí cá nhân của ZenFeed áp dụng sau khi Threads đã chọn/rank bài. |
| Custom feeds có thể đặt làm mặc định và chia sẻ; Threads cũng có communities/topic discovery. | [Personalized experience](https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/), [Share custom feeds](https://about.fb.com/news/2025/02/share-custom-feeds-on-threads/), [Communities](https://about.fb.com/news/2025/10/introducing-threads-communities-find-your-people/) | Không cố đoán tên feed từ URL; post boundary/cột phải được chứng minh trên DOM. |
| Topic tags và kiểm soát reply/quote giúp tổ chức hội thoại; Threads có DM. | [Personalized experience](https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/), [Messaging](https://about.fb.com/news/2025/07/introducing-messaging-highlighted-perspectives-threads/) | Đưa topic tag của post vào text đánh giá; loại reply/composer/DM khỏi vùng quét mặc định. |
| Dear Algo cho người dùng yêu cầu thấy chủ đề nhiều/ít hơn trong ba ngày ở một số quốc gia. | [Dear Algo](https://about.fb.com/news/2026/02/threads-dear-algo/) | ZenFeed là lớp hiển thị cục bộ có tiêu chí riêng, không thay đổi recommendation engine của Meta hay phụ thuộc Dear Algo có sẵn tại Việt Nam. |

## API và giới hạn thiết kế

[Threads API overview](https://developers.facebook.com/docs/threads/overview/) mô tả đăng bài thay mặt người dùng và hiển thị bài của họ cho chính họ. [Tài liệu truy xuất](https://developers.facebook.com/docs/threads/retrieve-and-discover-posts/retrieve-posts/) nói về bài của app-scoped user, profile public và media cụ thể. **Suy luận:** các endpoint công bố không cung cấp Home For You/Following đã cá nhân hóa của người xem. Vì ZenFeed cần lọc feed đang hiện trong tab, không nên thêm Meta app, OAuth, app review hay server token chỉ để cố lấy feed. Không dùng endpoint nội bộ/cookie của trang để né giới hạn này.

## Điều khoản và quyền riêng tư

[Threads Terms of Use §3](https://help.instagram.com/769983657850450) hạn chế công cụ/quy trình tự động dùng để theo dõi, trích xuất, sao chép hoặc thu thập thông tin từ Threads. [Instagram Terms](https://help.instagram.com/581066165581870) áp dụng bổ sung. **Diễn giải rủi ro:** content script đọc DOM post để đánh giá AI có thể thuộc phạm vi cần được xem xét; tài liệu không nêu ngoại lệ riêng cho extension lọc trên máy người dùng. Không coi nghiên cứu này là kết luận pháp lý hoặc chứng nhận tương thích. Trước public release cần đánh giá/permission phù hợp; nếu không có, dừng feature Threads.

[Chrome Permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions) và [Scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting) cho phép xin host origin khi user bật feature và đăng ký content script động. [Chrome user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) yêu cầu khai báo xử lý website content kể cả khi xử lý cục bộ. ZenFeed còn gửi snippet+author tới AI endpoint do user cấu hình, nên disclosure cần nói đúng dữ liệu thực tế.

## Chưa được chứng minh

- Không có DOM selector/accessibility contract công khai ổn định cho post card Threads. Cần xem thực tế trong pha 1; không điền selector giả vào plan.
- Chưa kiểm tra tài khoản logged-in thật, sự khác biệt quốc gia/ngôn ngữ, khả năng nhận diện post từ tài khoản private hoặc luồng revocation quyền Chrome. Đây là validation gates, không phải tính năng đã sẵn sàng.
- `threads.net` có thể chuyển hướng; chỉ thêm quyền host đó nếu thử nghiệm chứng minh vẫn render nội dung cần lọc.
