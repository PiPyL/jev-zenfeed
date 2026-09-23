# Chrome Web Store Listing — ZenFeed

> Last Updated: 2026-09-23
> Version: 1.0.0
> Extension ID: Pending Chrome Web Store upload

---

## 1. Store Listing Metadata

**Extension Name** [REQUIRED]
```
ZenFeed - AI Content Filter for Social Feeds
```
*(Số ký tự: 44/75. Không dùng trực diện tên thương hiệu Facebook để tránh vi phạm Trademark Policy).*

**Short Description** [REQUIRED]
```
Active Noise Cancellation for your eyes. Intelligently filters unwanted content and declutters your social feed with AI.
```
*(Số ký tự: 120/132. Ngắn gọn, nêu bật giá trị cốt lõi, không chứa từ khóa bị cấm).*

**Detailed Description** [REQUIRED]
```
Active Noise Cancellation for your eyes.

ZenFeed brings peace of mind back to your social browsing. Just like noise-canceling headphones filter out ambient distractions, ZenFeed uses advanced AI to intelligently identify and hide unwanted posts, sponsored spam, low-quality clickbait, and toxic drama in real-time.

KEY FEATURES
• Real-time AI Content Filtering: Automatically screens posts on your feed against your personalized criteria.
• Customizable Filter Topics: Specify whatever you want to avoid—gambling ads, predatory financial loans, spoilers, showbiz rumors, or junk coins.
• Intelligent Whitelist: Ensure important content (such as tech news, AI developments, or job postings) is never hidden even if it touches filtered keywords.
• Flexible Concealment Modes: Choose between a clean collapsed banner, gentle content blurring, or total removal.
• Zen Oasis & Learning Mode: Replace distracting posts with peaceful breathing exercises, inspiring quotes, or educational flashcards.
• Anti-Distraction Friction: Optional tap-and-hold delay before revealing hidden content prevents impulsive doomscrolling.
• Local Privacy First: All filtering decisions and preferences are saved locally on your device. Your personal API keys remain secure and are never shared.

HOW TO USE
1. Click the ZenFeed icon in your Chrome toolbar.
2. Select or enter your preferred filter criteria (or choose from quick presets).
3. (Optional) Enter your TypeSafe AI API Key or connect your preferred endpoint.
4. Browse your feed peacefully without visual clutter!

PRIVACY & DATA PROTECTION
ZenFeed is built with a privacy-first mindset:
• The extension does not collect, sell, or monetize your personal information or browsing history.
• Post text snippets are analyzed transiently solely to determine whether they match your filter rules.
• User preferences, activity counters, and caching remain strictly local in your browser storage.

PERMISSIONS NOTICE
• "Storage": Used exclusively to save your local filter preferences, sensitivity threshold, and offline decision cache on your device.
• "Scripting": Used only upon installation to enable filtering on existing social feed tabs without requiring a page refresh.
• "Host Permissions": Required to read post text elements on supported social feed domains and connect to your chosen AI analysis endpoint.

DISCLAIMER & TRADEMARK
Facebook™ is a trademark of Meta Platforms, Inc. ZenFeed is an independent open-source tool and is not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc.

SUPPORT & COMMUNITY
• Open Source: https://github.com/PiPyL/jev-zenfeed
• Report bugs or feature requests: https://github.com/PiPyL/jev-zenfeed/issues
• Website: https://zenfeed.app
```

**Category** [REQUIRED]
`Productivity` (hoặc `Social & Communication`)

**Single Purpose Statement** [REQUIRED]
```
Filters out unwanted posts, spam, and distractions on social feeds using real-time AI content evaluation based on user-defined criteria.
```
*(Chính xác, hẹp, đúng 1 câu, đáp ứng 100% chính sách Single Purpose của CWS).*

**Primary Language** [REQUIRED]
`English` (Hỗ trợ đa ngôn ngữ trong UI qua file i18n).

---

## 2. Graphics & Asset Requirements

| Asset | Dimensions | Định dạng | Trạng thái | Ghi chú |
|---|---|---|---|---|
| **Store Icon** [REQUIRED] | 128×128 | PNG (32-bit, không bo góc) | ✅ Sẵn sàng | `icons/icon128.png` |
| **Screenshot 1** [REQUIRED] | 1280×800 hoặc 640×400 | PNG / JPG | ⚠️ Cần tạo | Ảnh chụp Feed thực tế khi bài viết vi phạm bị thu gọn (Banner mode) |
| **Screenshot 2** [RECOMMENDED] | 1280×800 hoặc 640×400 | PNG / JPG | ⚠️ Cần tạo | Chế độ Zen Oasis / Làm mờ / Tráo kiến thức Flashcards |
| **Screenshot 3** [RECOMMENDED] | 1280×800 hoặc 640×400 | PNG / JPG | ⚠️ Cần tạo | Popup Settings: Nhập tiêu chí lọc, Whitelist, chỉnh độ tin cậy |
| **Screenshot 4** [RECOMMENDED] | 1280×800 hoặc 640×400 | PNG / JPG | ⚠️ Cần tạo | Popup Activity: Thống kê số bài đã ẩn và nhật ký thời gian thực |
| **Small Promo Tile** [RECOMMENDED] | 440×280 | PNG / JPG | ⚠️ Khuyến nghị | Dùng cho hiển thị trên trang chủ Web Store |
| **Marquee Promo Tile** | 1400×560 | PNG / JPG | ⬜ Tùy chọn | Dùng nếu được Chrome Web Store Feature |

---

## 3. Permissions Justification (Giải trình quyền cho Google Review Team)

Khi submit trên Developer Dashboard, Google yêu cầu giải trình cho từng quyền và host_permission. Hãy copy chính xác các đoạn dưới đây:

### Permissions

| Permission | Justification (Copy vào form CWS) |
|---|---|
| `storage` | Required to persist user settings (such as filter criteria, confidence threshold, UI language, and hide mode) and to store the offline LRU decision cache so that repeated posts do not require redundant network calls. |
| `scripting` | Required to programmatically inject the content script and styles into already open Facebook tabs upon extension installation or update, enabling immediate filtering without requiring the user to manually refresh their open tabs. |

### Host Permissions

| Host Pattern | Justification (Copy vào form CWS) |
|---|---|
| `*://*.facebook.com/*` | Essential for the core functionality: allows the extension content script to detect feed post elements, extract public post text for filtering against user-defined criteria, and apply visual hiding/blur overlays. |
| `https://api.typesafe.ai/*` | Required to communicate with the default TypeSafe AI Jev decision API to evaluate post snippets against the user's content filter criteria. |
| `http://localhost/*` & `http://127.0.0.1/*` | Used exclusively for developers and advanced users who choose to run a local mock evaluation server or self-hosted local model endpoint (e.g., Ollama or custom test mock). |

### Optional Host Permissions

| Host Pattern | Justification (Copy vào form CWS) |
|---|---|
| `https://*/*` & `http://*/*` | Enables power users to configure custom AI proxy gateways or self-hosted API endpoints in the Advanced Settings tab. Access to a specific custom origin is only requested dynamically with an explicit user gesture (clicking 'Test Connection'). |

---

## 4. Privacy & Data Use Disclosure (Khai báo sử dụng dữ liệu)

Bắt buộc tích chọn chính xác trên CWS Dashboard:

- **Does the extension collect user data?** -> **Yes** (Xử lý dữ liệu nội dung web - Website Content).
- **Data Categories:**
  - `Website Content`: **YES** (Được thu thập từ bài viết công khai trên feed để gửi đến AI phân tích).
    - *Purpose:* Functionality (Cung cấp chức năng lọc nội dung cốt lõi của tiện ích).
    - *Transmitted off-device:* **YES** (Gửi đến API AI phân tích).
  - Tất cả các danh mục khác (`Personally identifiable info`, `Health info`, `Financial info`, `Authentication info`, `Personal communications`, `Location`, `Web history`, `User activity`): Chọn **NO**.
- **Data Use Certification (Tất cả đều chọn YES):**
  - [x] Data is NOT sold to third parties.
  - [x] Data is NOT used or transferred for purposes unrelated to the item's core functionality.
  - [x] Data is NOT used or transferred to determine creditworthiness or for lending purposes.

---

## 5. Privacy Policy Requirements

- **Privacy Policy URL [BẮT BUỘC]:** Phải là một URL công khai, có thể truy cập được không cần đăng nhập.
- **Đề xuất hosting:**
  - `https://zenfeed.app/privacy` (Đăng lên website landing page Astro hiện có).
  - Hoặc GitHub Pages: `https://pipyl.github.io/jev-zenfeed/privacy`.

---

## 6. Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0.0 | 2026-09-23 | Initial Chrome Web Store release candidate with Manifest V3, multi-language support, Zen blur modes, and zero-CLS feed handling. | In Preparation |
