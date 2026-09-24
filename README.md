# 🛡️ ZenFeed

<p align="center">
  <img src="icons/icon128.png" alt="ZenFeed Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Active Noise Cancellation for your eyes.</strong><br>
  <em>The first AI-powered active noise cancellation for your social feed.</em>
</p>

<p align="center">
  <a href="https://github.com/PiPyL/jev-zenfeed/releases"><img src="https://img.shields.io/github/v/release/PiPyL/jev-zenfeed?color=2F5D50&label=Release&style=flat-square" alt="GitHub Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-2F5D50.svg?style=flat-square" alt="License: MIT"></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/intro/"><img src="https://img.shields.io/badge/Chrome-MV3-blue.svg?style=flat-square" alt="Manifest V3"></a>
  <a href="https://github.com/PiPyL/jev-zenfeed/stargazers"><img src="https://img.shields.io/github/stars/PiPyL/jev-zenfeed?style=flat-square&color=D9A05B" alt="GitHub Stars"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome"></a>
</p>

<p align="center">
  <a href="#-quick-install-guide">Quick Install</a> •
  <a href="#-features">Features</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-development--testing">Testing</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="PRIVACY.md">Privacy Policy</a> •
  <a href="README.vi.md">🇻🇳 Bản Tiếng Việt</a>
</p>

---

**ZenFeed** is an open-source Chrome Extension that brings **Active Noise Cancellation to your eyes**. Just like noise-canceling headphones filter out background chatter, ZenFeed automatically identifies and collapses visual noise (gambling ads, toxic drama, movie spoilers, predatory loans, pyramid schemes) on your **Facebook News Feed** and your **Threads home feeds** in real time using natural language criteria you define.

Powered by the **Jev (TypeSafe AI)** System One architecture, ZenFeed delivers sub-200ms evaluation latency, ultra-low cost ($0.042 / 1M tokens), zero layout shift (Zero-CLS), and 100% BYOK privacy with no intermediate proxy servers.

---

## ✨ Features

- 🎧 **Active Noise Cancellation for Eyes:** Automatically collapses or softly blurs posts matching your personal criteria before they interrupt your attention.
- ⚡ **Sub-200ms Decision Speed:** Ultra-fast Bernoulli Boolean classification via Jev System One with calibrated confidence scoring.
- 🔒 **100% BYOK (Bring Your Own Key) & Privacy First:** Direct client-to-AI communication over TLS 1.3. No intermediate tracking servers, no telemetry, no cookies captured, never touches private messages or credentials.
- 🎯 **Atomic Questions & Whitelist Guard:** Evaluates violation criteria and whitelist exceptions independently. A whitelist exemption needs its own 70% bar and must be at least as strong as the violation, so lowering or raising the hide threshold cannot silently keep or drop those posts. For example: block unwanted job spam while safely preserving IT & AI developer job opportunities!
- 👁️ **Reading-Zone Aware & Zero-CLS:**
  - Preserves layout height when blurring posts to prevent disruptive page jumping (CLS = 0).
  - Delay collapse if a post is currently in the active reading viewport (top 65%).
  - Provides a discreet badge instead of collapsing posts you have already interacted with (liked, commented, expanded).
- 💾 **Two-Tier Smart Caching (IndexedDB LRU):** Evaluates identical content (repeated ads, multi-tab browsing, re-scrolling) exactly once. Re-scrolling old posts costs **0 tokens**.
- 🛠️ **1-Click Filter Presets:** Built-in presets for Anti-Gambling, Anti-Spoiler, Anti-Celebrity Drama, and Anti-Crypto Scams.

---

## 🚀 Quick Install Guide

### Method 1: Install from Release ZIP (Recommended)

1. **Download the latest release ZIP:**
   👉 [**Download zenfeed-v1.0.1.zip (Direct 1-Click)**](https://github.com/PiPyL/jev-zenfeed/releases/latest/download/zenfeed-v1.0.1.zip) or browse all versions at [**ZenFeed Releases**](https://github.com/PiPyL/jev-zenfeed/releases/latest).
2. **Extract the ZIP file:**
   Unzip `zenfeed-v1.0.1.zip` to a folder on your computer (e.g. `Downloads/zenfeed-v1.0.1`).
   > 💡 **Important:** Make sure to extract the archive fully (on Windows: right-click `zenfeed-v1.0.1.zip` → **Extract All...**). When loading the extension, choose the directory that directly contains `manifest.json`.
3. **Open Chrome Extensions Manager:**
   In Chrome, Edge, Brave, or Cốc Cốc, navigate to:
   ```text
   chrome://extensions
   ```
4. **Enable Developer Mode:**
   Turn on the **Developer mode** toggle in the top-right corner.
5. **Load Unpacked Extension:**
   Click the **Load unpacked** button in the top-left corner and select the extracted folder (the folder containing `manifest.json`).
6. **Pin to Toolbar:**
   Click the puzzle piece icon on your browser toolbar and pin **ZenFeed** for easy access.

---

### Method 2: Install from Source (For Developers)

```bash
# Clone the repository
git clone https://github.com/PiPyL/jev-zenfeed.git
cd jev-zenfeed

# Run test suite to verify everything is passing
npm test

# Run syntax and lint checks
npm run lint
```

Then follow steps 3–6 above, selecting the cloned `jev-zenfeed` directory.

---

## ⚙️ Configuration

1. Click the **ZenFeed** icon in your browser toolbar to open the settings popup.
2. Enter your **TypeSafe Jev API Key** in the API Key field.
   *(Optional: If using a custom proxy or Vercel AI Gateway, click "Custom Endpoint" to set your URL).*
3. Click **⚡ Test Connection** to verify your API key works.
4. Select a pre-configured Preset or type your custom filter criteria in plain natural language:
   - *Example Criteria:* `"online gambling, casino ads, loan sharks, gossip drama, cryptocurrency scams"`
   - *Optional Whitelist:* `"tech news, AI, software engineering, scientific discoveries"`
5. Set your confidence threshold (default: **70%**).
6. Click **Apply** (or press `Ctrl` / `Cmd` + `Enter`). The settings immediately apply to all open Facebook and Threads tabs!

---

## 📂 Architecture

```
jev-zenfeed/
├── manifest.json              # Chrome Manifest V3 declaration
├── package.json               # Project scripts & repository metadata
├── LICENSE                    # MIT Open Source License
├── CONTRIBUTING.md            # Guidelines for open-source contributors
├── icons/                     # Vector-based brand icons (16, 32, 48, 128px)
├── src/
│   ├── background/
│   │   ├── background.js      # Service Worker: batch queue, badges, lifecycle
│   │   ├── decision-cache.js  # Two-tier cache (session + IndexedDB LRU)
│   │   └── jev-client.js      # TypeSafe Jev API client (Atomic prompt construction)
│   ├── content/
│   │   ├── content.js         # MutationObserver & IntersectionObserver engine (platform-agnostic)
│   │   ├── fb-selectors.js    # Resilient Facebook DOM selectors (News Feed post cards)
│   │   ├── text-extractor.js  # Facebook post body extraction, sanitization, and FNV-1a hash
│   │   ├── th-selectors.js    # Resilient Threads DOM selectors (home feed post cards)
│   │   ├── th-text-extractor.js # Threads post body extraction, sanitization, and FNV-1a hash
│   │   ├── content.css        # Zero-CLS blur overlay and collapsed banner styles
│   │   ├── fb-selectors.js    # Resilient DOM selectors adapting to FB layout changes
│   │   ├── text-extractor.js  # Post body extraction, sanitization, and FNV-1a hash
│   │   └── ui-overlay.js      # Banner creation, blur overlay, and "show anyway" button
│   ├── utils/
│   │   ├── settings-defaults.js # Canonical settings schema & normalization
│   │   ├── fast-hash.js       # Fast FNV-1a non-cryptographic content hashing
│   │   ├── clip-text.js       # Token-saving head+tail clipping for long posts
│   │   ├── logger.js          # Batched non-intrusive logging to storage.session
│   │   ├── i18n.js            # Internationalization (English / Vietnamese)
│   │   ├── zen-data.js        # Calming quotes & statistics for blurred overlays
│   │   └── flashcards-data.js # Micro-learning cards during gentle blur
│   └── popup/
│       ├── popup.html         # Calm Tech settings popup interface
│       ├── popup.css          # Styled with Fraunces, Be Vietnam Pro & warm paper palette
│       └── popup.js           # Settings persistence, validation & API connectivity test
├── scripts/
│   └── build-zip.js           # Automated packaging script for GitHub Releases
└── test/
    ├── test-jev-mock.js       # Automated Node.js integration tests (30 test suites)
    ├── content-harness.html   # DOM content-script test harness on simulated Facebook feed
    ├── threads-content-harness.html # DOM content-script test harness on simulated Threads feed
    ├── run-harness-headless.js# Headless Chrome runner for content harness
    ├── mock-jev-server.js     # Standalone local mock server for Jev API
    └── static-server.js       # Local static HTTP server for test harness
```

---

## 🛠️ Development & Testing

ZenFeed includes a comprehensive automated test suite verifying manifest validity, atomic question prompt safety, cache consistency, network resilience, and UI behavior.

```bash
# Run unit & integration tests (runs against local mock server)
npm test

# Run syntax lint checks across all scripts
npm run lint

# Package release ZIP archive (outputs to dist/zenfeed-v1.0.1.zip)
npm run build:zip

# Start browser-based DOM test harness
npm run harness
# Then open http://localhost:8765/test/content-harness.html

# Or run headless DOM harness via Chrome
npm run harness:headless
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are very welcome! Please check [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

1. Fork the Project: `https://github.com/PiPyL/jev-zenfeed`
2. Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
3. Run tests to ensure everything passes (`npm test && npm run lint`)
4. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
5. Push to the Branch (`git push origin feat/AmazingFeature`)
6. Open a Pull Request

---

## ⭐ Star the Project

If ZenFeed helps protect your mental peace while browsing Facebook or Threads, please consider giving this repository a **Star ⭐**! It motivates continued development and helps more people find quietude for their eyes.

[![Star on GitHub](https://img.shields.io/badge/Star%20on%20GitHub-⭐%20PiPyL%2Fjev--zenfeed-2F5D50?style=for-the-badge)](https://github.com/PiPyL/jev-zenfeed)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
