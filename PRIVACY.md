# Privacy Policy for ZenFeed

**Last Updated: September 26, 2026**

ZenFeed ("we", "our", or "the extension") is an open-source browser extension designed to provide active noise cancellation for your social feeds by filtering unwanted content using AI. We respect your privacy and are committed to protecting it. This Privacy Policy explains our practices regarding data collection, usage, and storage.

---

## 1. What Data We Process

### A. Post Snippets (Website Content)
- **What is processed:** When you browse supported social media platforms (specifically the Facebook™ web feed and the Threads™ home feeds), the extension extracts short text snippets of visible posts on your feed.
- **Why it is processed:** These snippets are evaluated against your configured filter criteria (e.g., hiding gambling ads, spoilers, or low-quality clickbait) to determine whether the post should be concealed.
- **How it is transmitted:** Snippets are sent via secure HTTPS to the evaluation endpoint you select. A new install that has not saved an endpoint uses OpenRouter at `https://openrouter.ai` (System One, model `jev-1.13`). OpenRouter forwards that request to TypeSafe. Choosing TypeSafe sends snippets to `https://api.typesafe.ai`. A custom URL or local mock sends them only to that host. The extension asks permission to contact OpenRouter or a custom host when you select or test that endpoint. An install that already saved a key before this choice existed keeps the TypeSafe endpoint.
- **Data retention:** The backend API evaluates the snippet transiently in memory to return a classification score. ZenFeed does not persistently store your feed content on remote servers, nor do we build user browsing profiles.

### B. User Settings & API Keys (Local Storage Only)
- **What is stored:** Your customized filter topics, whitelisted keywords, confidence threshold, chosen UI theme/blur mode, and your personal API key (if provided).
- **Where it is stored:** All user configurations are stored strictly locally in your browser's private storage (`chrome.storage.local`).
- **Security:** Your API key is never exposed to content scripts injected into third-party web pages. It is accessed only by the extension's local background service worker and settings popup.

### C. Decision Cache (IndexedDB)
- **What is stored:** An anonymous cryptographic hash of evaluated post text and the resulting filter decision (violation status and confidence score).
- **Where it is stored:** Stored locally on your machine in IndexedDB to avoid repeated network calls and reduce AI token consumption. You can clear this cache at any time using the "Clear cache" button in the extension popup.

---

## 2. What We Do NOT Collect

ZenFeed strictly adheres to the Chrome Web Store Limited Use requirements:
- **No Personal Identifiable Information (PII):** We do not collect your name, email address, phone number, physical address, or account credentials.
- **No Social Media Credentials:** ZenFeed never reads, asks for, or accesses your social media account logins, session cookies, private messages, or friend lists.
- **No Browsing History or Telemetry Tracking:** We do not track websites you visit outside of the intended feed filtering scope, and we do not use third-party tracking scripts, analytics cookies, or behavioral advertising SDKs.
- **No Sale of Data:** We do NOT sell, lease, or monetize user data under any circumstances.

---

## 3. Third-Party Services

- **OpenRouter (default for a new install):** Post snippets and your filter criteria are sent to `https://openrouter.ai`, which routes the decision request to TypeSafe. Retention of that request is governed by [OpenRouter's privacy policy](https://openrouter.ai/privacy). ZenFeed does not operate that service and does not store the snippet on a server of its own.
- **TypeSafe AI (optional, for a key you already have):** If you select TypeSafe, snippets are sent to `https://api.typesafe.ai`. See the [TypeSafe AI Console](https://console.typesafe.ai/) for that provider's policy.
- **Bring Your Own Key / Custom Endpoints (BYOK):** If you configure a custom proxy or self-hosted endpoint (such as a local mock server), data transmission occurs directly between your browser and your specified host.

---

## 4. User Controls and Data Deletion

You have complete control over your data:
- **Clear Decision Cache:** Click "Clear cache" in the ZenFeed popup activity panel at any time to wipe all cached evaluation history.
- **Remove API Key:** You can edit or delete your API key directly in the Settings tab.
- **Uninstall:** Removing the ZenFeed extension immediately purges all local storage and cached data managed by Chrome.

---

## 5. Trademark Disclaimer

Facebook™ and Threads™ are trademarks of Meta Platforms, Inc. ZenFeed is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Meta Platforms, Inc.

---

## 6. Open Source Transparency

ZenFeed is free and open-source software under the MIT License. You can review our full source code, inspect all network operations, and audit our security practices on GitHub:
👉 [https://github.com/PiPyL/jev-zenfeed](https://github.com/PiPyL/jev-zenfeed)

---

## 7. Contact Us

If you have any questions or feedback regarding this Privacy Policy or data security in ZenFeed, please contact us:
- **GitHub Issues:** [https://github.com/PiPyL/jev-zenfeed/issues](https://github.com/PiPyL/jev-zenfeed/issues)
- **Project Repository:** [https://github.com/PiPyL/jev-zenfeed](https://github.com/PiPyL/jev-zenfeed)
- **Website:** [https://zenfeed.app](https://zenfeed.app)
