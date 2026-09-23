# Contributing to ZenFeed 🛡️

First off, thank you for considering contributing to ZenFeed! Projects like this thrive because of community members like you.

[Tiếng Việt bên dưới / Vietnamese version below](#hướng-dẫn-đóng-góp-tiếng-việt)

---

## English

### Code of Conduct
We are committed to providing a welcoming, inclusive, and harassment-free experience for everyone. Please be respectful and constructive in issues, discussions, and pull requests.

### How Can I Contribute?

1. **Reporting Bugs:**
   - Search existing issues to ensure the bug hasn't already been reported.
   - If not, open a new issue with a clear title, reproduction steps, Chrome version, OS, and screenshots or console logs if applicable.

2. **Suggesting Enhancements:**
   - Open an issue describing the feature, why it is valuable, and how it could work.
   - For UI changes, keep in mind the Calm Tech design philosophy (no visual clutter, clean serif/sans typography, warm palettes).

3. **Submitting Pull Requests:**
   - Fork the repository: `https://github.com/PiPyL/jev-zenfeed`
   - Create a topic branch: `git checkout -b feature/my-new-feature` or `git checkout -b fix/issue-description`
   - Run tests and lint before committing:
     ```bash
     npm test
     npm run lint
     ```
   - Commit with clear, descriptive commit messages.
   - Push to your fork and submit a Pull Request to `main`.

### Development Guidelines
- ZenFeed uses Chrome Manifest V3 with ES Modules.
- Content scripts run inside Facebook feeds; keep DOM operations lightweight and non-blocking.
- Never hardcode API keys or secret credentials.
- All network calls must respect user privacy (no intermediate tracking servers).

---

<a id="hướng-dẫn-đóng-góp-tiếng-việt"></a>
## Hướng Dẫn Đóng Góp (Tiếng Việt)

Cảm ơn bạn đã quan tâm và muốn đóng góp cho ZenFeed! Dự án mã nguồn mở phát triển mạnh mẽ là nhờ sự chung tay của cộng đồng.

### Các Cách Bạn Có Thể Đóng Góp

1. **Báo cáo lỗi (Bug Reports):**
   - Kiểm tra tab [Issues](https://github.com/PiPyL/jev-zenfeed/issues) xem lỗi đã được báo chưa.
   - Nếu chưa, hãy tạo issue mới nêu rõ: các bước tái hiện, phiên bản Chrome/trình duyệt, hệ điều hành và ảnh chụp màn hình hoặc log console.

2. **Đề xuất tính năng mới (Feature Requests):**
   - Tạo issue mô tả tính năng mong muốn, lý do hữu ích và cách thức hoạt động.
   - Luôn tôn trọng triết lý thiết kế Calm Tech (tĩnh lặng, nhẹ nhàng, không giật lag).

3. **Gửi Pull Request (PR):**
   - Fork repository: `https://github.com/PiPyL/jev-zenfeed`
   - Tạo branch nhánh: `git checkout -b feat/ten-tinh-nang` hoặc `git checkout -b fix/ten-loi`
   - Chạy kiểm thử trước khi commit:
     ```bash
     npm test
     npm run lint
     ```
   - Đẩy code lên fork và tạo Pull Request tới nhánh `main`.

ZenFeed chân thành cảm ơn mọi đóng góp của bạn! ⭐
