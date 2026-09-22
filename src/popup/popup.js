document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const extensionEnabled = document.getElementById('extensionEnabled');
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
  const btnTestKey = document.getElementById('btnTestKey');
  const apiStatusBadge = document.getElementById('apiStatusBadge');
  const apiKeyWarning = document.getElementById('apiKeyWarning');
  const btnQuickMock = document.getElementById('btnQuickMock');
  const btnToggleAdvanced = document.getElementById('btnToggleAdvanced');
  const advancedSettings = document.getElementById('advancedSettings');
  const apiUrlInput = document.getElementById('apiUrl');
  const filterCriteriaInput = document.getElementById('filterCriteria');
  const confidenceSlider = document.getElementById('confidenceThreshold');
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  const hideModeSelect = document.getElementById('hideMode');
  const antiFoucBlurCheckbox = document.getElementById('antiFoucBlur');
  const statScanned = document.getElementById('statScanned');
  const statHidden = document.getElementById('statHidden');
  const statCacheHit = document.getElementById('statCacheHit');
  const btnSave = document.getElementById('btnSave');
  const saveToast = document.getElementById('saveToast');
  const presetChips = document.querySelectorAll('.chip');
  const apiErrorNotice = document.getElementById('apiErrorNotice');

  // Logs Elements
  const logCountBadge = document.getElementById('logCountBadge');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const logsContainer = document.getElementById('logsContainer');
  const filterPills = document.querySelectorAll('.log-filter-pills .pill');

  let activeLogFilter = 'all';
  let cachedLogs = [];

  // Load existing settings
  // F14: single source of defaults (src/utils/settings-defaults.js)
  const DEFAULT_SETTINGS = window.JevFB.DEFAULT_SETTINGS;
  const defaults = {
    ...DEFAULT_SETTINGS,
    stats: { scanned: 0, hidden: 0, cacheHits: 0 }
  };

  chrome.storage.local.get(defaults, (data) => {
    extensionEnabled.checked = data.extensionEnabled;
    apiKeyInput.value = data.apiKey || '';
    apiUrlInput.value = data.apiUrl || DEFAULT_SETTINGS.apiUrl;
    filterCriteriaInput.value = data.filterCriteria;
    confidenceSlider.value = data.confidenceThreshold;
    thresholdDisplay.textContent = `${data.confidenceThreshold}%`;
    hideModeSelect.value = data.hideMode;
    antiFoucBlurCheckbox.checked = data.antiFoucBlur;

    updateKeyWarningState();

    // Render stats
    updateStatsDisplay(data.stats);

    if (data.apiKey) {
      apiStatusBadge.textContent = 'Đã lưu key';
      apiStatusBadge.className = 'badge badge-success';
    } else {
      apiStatusBadge.textContent = 'Chưa nhập key';
      apiStatusBadge.className = 'badge badge-error';
    }
  });

  function updateKeyWarningState() {
    const key = apiKeyInput.value.trim();
    if (!key) {
      apiKeyWarning.classList.remove('hidden');
    } else {
      apiKeyWarning.classList.add('hidden');
    }
  }

  apiKeyInput.addEventListener('input', () => {
    updateKeyWarningState();
  });

  function updateStatsDisplay(stats = {}) {
    const scanned = stats.scanned || 0;
    const hidden = stats.hidden || 0;
    const cacheHits = stats.cacheHits || 0;
    statScanned.textContent = scanned.toLocaleString();
    statHidden.textContent = hidden.toLocaleString();
    const hitRate = scanned > 0 ? Math.round((cacheHits / scanned) * 100) : 0;
    statCacheHit.textContent = `${hitRate}%`;
  }

  // Slider change
  confidenceSlider.addEventListener('input', (e) => {
    thresholdDisplay.textContent = `${e.target.value}%`;
  });

  // Toggle API key visibility
  toggleKeyVisibility.addEventListener('click', () => {
    const isPass = apiKeyInput.type === 'password';
    apiKeyInput.type = isPass ? 'text' : 'password';
    toggleKeyVisibility.textContent = isPass ? '🙈' : '👁️';
  });

  // Toggle advanced settings
  btnToggleAdvanced.addEventListener('click', () => {
    advancedSettings.classList.toggle('hidden');
    btnToggleAdvanced.textContent = advancedSettings.classList.contains('hidden') 
      ? 'Tùy chỉnh Endpoint ▾' 
      : 'Ẩn Endpoint ▴';
  });

  // Quick 1-click Mock Server Setup
  btnQuickMock.addEventListener('click', async () => {
    apiKeyInput.value = 'mock_jev_test_key_local';
    apiUrlInput.value = 'http://localhost:3000';
    advancedSettings.classList.remove('hidden');
    btnToggleAdvanced.textContent = 'Ẩn Endpoint ▴';
    updateKeyWarningState();

    // Save first, then test the connection automatically
    await saveSettings();
    btnTestKey.click();
  });

  // Preset chips click
  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = chip.dataset.preset;
      const current = filterCriteriaInput.value.trim();
      if (!current) {
        filterCriteriaInput.value = preset;
      } else if (!current.includes(preset)) {
        filterCriteriaInput.value = `${current}\n${preset}`;
      }
      filterCriteriaInput.focus();
    });
  });

  // ==================== CUSTOM ENDPOINT PERMISSION ====================
  // Endpoints outside the manifest's host_permissions need an optional host
  // permission, otherwise requests depend on the server's CORS setup.
  const BUILTIN_HOSTS = new Set(['api.typesafe.ai', 'localhost', '127.0.0.1']);

  function parseApiUrl(raw) {
    try {
      const u = new URL(raw);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * MUST be called synchronously at the start of a click handler (the
   * permission prompt requires a user gesture, which an earlier await would lose).
   * @returns {Promise<boolean>}
   */
  function ensureHostPermission(rawUrl) {
    const u = parseApiUrl(rawUrl);
    if (!u) return Promise.resolve(false);
    if (BUILTIN_HOSTS.has(u.hostname)) return Promise.resolve(true);
    return chrome.permissions.request({ origins: [`${u.protocol}//${u.hostname}/*`] }).catch(() => false);
  }

  function showApiError(message) {
    if (!apiErrorNotice) return;
    apiErrorNotice.textContent = `⚠️ ${message}`;
    apiErrorNotice.classList.remove('hidden');
  }

  // Test connection
  btnTestKey.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const url = apiUrlInput.value.trim() || DEFAULT_SETTINGS.apiUrl;
    const permissionPromise = ensureHostPermission(url); // keep user gesture

    if (apiErrorNotice) {
      apiErrorNotice.classList.add('hidden');
      apiErrorNotice.textContent = '';
    }

    if (!parseApiUrl(url)) {
      apiStatusBadge.textContent = 'URL không hợp lệ';
      apiStatusBadge.className = 'badge badge-error';
      showApiError('API Base URL phải bắt đầu bằng http:// hoặc https://');
      return;
    }

    if (!key) {
      apiStatusBadge.textContent = 'Chưa nhập key';
      apiStatusBadge.className = 'badge badge-error';
      apiKeyInput.focus();
      return;
    }

    apiStatusBadge.textContent = 'Đang kiểm tra...';
    apiStatusBadge.className = 'badge badge-testing';
    btnTestKey.disabled = true;

    try {
      if (!(await permissionPromise)) {
        throw new Error(`Chưa cấp quyền truy cập ${parseApiUrl(url).hostname}`);
      }
      const response = await chrome.runtime.sendMessage({
        action: 'TEST_API_KEY',
        apiKey: key,
        apiUrl: url
      });

      if (response && response.success) {
        apiStatusBadge.textContent = 'Kết nối tốt (Jev OK)';
        apiStatusBadge.className = 'badge badge-success';
        apiKeyWarning.classList.add('hidden');
        if (apiErrorNotice) apiErrorNotice.classList.add('hidden');
      } else {
        const errMsg = response?.error || 'Lỗi xác thực';
        apiStatusBadge.textContent = 'Lỗi kết nối';
        apiStatusBadge.className = 'badge badge-error';
        if (apiErrorNotice) {
          apiErrorNotice.textContent = `⚠️ ${errMsg}`;
          apiErrorNotice.classList.remove('hidden');
        }
      }
    } catch (err) {
      apiStatusBadge.textContent = 'Lỗi gọi API';
      apiStatusBadge.className = 'badge badge-error';
      if (apiErrorNotice) {
        apiErrorNotice.textContent = `⚠️ ${err.message}`;
        apiErrorNotice.classList.remove('hidden');
      }
    } finally {
      btnTestKey.disabled = false;
      loadLiveLogs(); // Refresh logs after test
    }
  });

  /**
   * Save all settings. Content scripts pick changes up via storage.onChanged,
   * so nothing (in particular the API key) is broadcast to Facebook tabs.
   */
  function saveSettings() {
    const apiUrl = apiUrlInput.value.trim() || DEFAULT_SETTINGS.apiUrl;
    const permissionPromise = ensureHostPermission(apiUrl); // keep user gesture

    if (!parseApiUrl(apiUrl)) {
      showApiError('API Base URL phải bắt đầu bằng http:// hoặc https://');
      advancedSettings.classList.remove('hidden');
      apiUrlInput.focus();
      return Promise.resolve(false);
    }

    const settings = {
      extensionEnabled: extensionEnabled.checked,
      apiKey: apiKeyInput.value.trim(),
      apiUrl,
      filterCriteria: filterCriteriaInput.value.trim(),
      confidenceThreshold: parseInt(confidenceSlider.value, 10),
      hideMode: hideModeSelect.value,
      antiFoucBlur: antiFoucBlurCheckbox.checked
    };

    return chrome.storage.local.set(settings).then(async () => {
      saveToast.classList.remove('hidden');
      setTimeout(() => saveToast.classList.add('hidden'), 2500);
      updateKeyWarningState();

      if (!(await permissionPromise)) {
        showApiError(`Chưa cấp quyền truy cập ${parseApiUrl(apiUrl).hostname} — bộ lọc có thể không gọi được endpoint này.`);
      }
      return true;
    });
  }

  // On/off switch takes effect immediately (no need to press Save)
  extensionEnabled.addEventListener('change', () => {
    chrome.storage.local.set({ extensionEnabled: extensionEnabled.checked });
  });

  // Save settings on button click
  btnSave.addEventListener('click', saveSettings);

  // ==================== LIVE LOGS LOGIC ====================

  async function loadLiveLogs() {
    try {
      const logs = await chrome.runtime.sendMessage({ action: 'GET_LOGS' });
      if (Array.isArray(logs)) {
        cachedLogs = logs;
        renderLogs();
      }
    } catch (err) {
      console.warn('Không thể tải logs:', err);
    }
  }

  const LOG_LEVELS = new Set(['info', 'success', 'warn', 'error', 'ai']);
  const MAX_LOGS = 150;

  function renderLogs() {
    logCountBadge.textContent = `${cachedLogs.length} logs`;

    const filtered = cachedLogs.filter(item => {
      if (activeLogFilter === 'all') return true;
      if (activeLogFilter === 'hide') return item.tag === 'ẨN BÀI' || item.level === 'success';
      if (activeLogFilter === 'ai') return item.tag === 'JEV-AI' || item.level === 'ai';
      if (activeLogFilter === 'warn') return item.level === 'warn' || item.level === 'error' || item.tag === 'WARN' || item.tag === 'ERROR';
      return true;
    });

    if (filtered.length === 0) {
      logsContainer.innerHTML = `<div class="logs-empty">${cachedLogs.length === 0 ? 'Chưa có nhật ký hoạt động nào. Hãy lướt Facebook để bắt đầu tracking.' : 'Không có log phù hợp với bộ lọc hiện tại.'}</div>`;
      return;
    }

    logsContainer.innerHTML = filtered.map(log => {
      const levelClass = `level-${LOG_LEVELS.has(log.level) ? log.level : 'info'}`;
      return `
        <div class="log-entry ${levelClass}">
          <div class="log-entry-header">
            <span class="log-time">${escapeHtml(log.time || '')}</span>
            <span class="log-tag-badge">${escapeHtml(log.tag || 'INFO')}</span>
          </div>
          <div class="log-text">${escapeHtml(log.message || '')}</div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Filter pills click
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeLogFilter = pill.dataset.filter;
      renderLogs();
    });
  });

  // Clear logs
  btnClearLogs.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' });
    cachedLogs = [];
    renderLogs();
  });

  // Copy logs
  btnCopyLogs.addEventListener('click', async () => {
    if (cachedLogs.length === 0) return;
    const text = cachedLogs.map(l => `[${l.time}] [${l.tag}] ${l.message}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      const originalText = btnCopyLogs.textContent;
      btnCopyLogs.textContent = '✅ Đã chép!';
      setTimeout(() => { btnCopyLogs.textContent = originalText; }, 1800);
    } catch (_) {
      console.warn('Clipboard write failed');
    }
  });

  // Listen for real-time logs from background (batched)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'NEW_LOG_ENTRIES' && Array.isArray(message.logs)) {
      cachedLogs = message.logs.concat(cachedLogs);
      if (cachedLogs.length > MAX_LOGS) cachedLogs.length = MAX_LOGS;
      renderLogs();
    }

    if (message.action === 'LOGS_CLEARED') {
      cachedLogs = [];
      renderLogs();
    }
  });

  // Live statistics
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.stats && changes.stats.newValue) {
      updateStatsDisplay(changes.stats.newValue);
    }
  });

  // Initial logs load
  loadLiveLogs();
});
