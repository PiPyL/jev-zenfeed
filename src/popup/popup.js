document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const extensionEnabled = document.getElementById('extensionEnabled');
  const toggleFilterLabel = document.getElementById('toggleFilterLabel');
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
  const whitelistCriteriaInput = document.getElementById('whitelistCriteria');
  const criteriaStatus = document.getElementById('criteriaStatus');
  const btnApplyCriteria = document.getElementById('btnApplyCriteria');
  const confidenceSlider = document.getElementById('confidenceThreshold');
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  const hideModeSelect = document.getElementById('hideMode');
  const blurCustomizationGroup = document.getElementById('blurCustomizationGroup');
  const blurPresetSelect = document.getElementById('blurPreset');
  const blurClassicLook = document.getElementById('blurClassicLook');
  const blurClassicStrength = document.getElementById('blurClassicStrength');
  const blurStrengthHint = document.getElementById('blurStrengthHint');
  const blurClassicPreview = document.getElementById('blurClassicPreview');
  const blurClassicSwatches = document.getElementById('blurClassicSwatches');
  const blurClassicColor = document.getElementById('blurClassicColor');
  const blurClassicCustom = document.getElementById('blurClassicCustom');
  const blurClassicReset = document.getElementById('blurClassicReset');
  const blurFlashcardTopicRow = document.getElementById('blurFlashcardTopicRow');
  const blurFlashcardTopicSelect = document.getElementById('blurFlashcardTopic');
  const blurRevealFrictionSelect = document.getElementById('blurRevealFriction');
  const blurCustomQuotesRow = document.getElementById('blurCustomQuotesRow');
  const blurCustomQuotesInput = document.getElementById('blurCustomQuotes');
  const filterModeSelect = document.getElementById('filterMode');
  const statScanned = document.getElementById('statScanned');
  const statHidden = document.getElementById('statHidden');
  const statCacheHit = document.getElementById('statCacheHit');
  const statDeferred = document.getElementById('statDeferred');
  const btnClearCache = document.getElementById('btnClearCache');
  const saveToast = document.getElementById('saveToast');
  const presetChips = document.querySelectorAll('.chip');
  const apiErrorNotice = document.getElementById('apiErrorNotice');
  const languageSelect = document.getElementById('languageSelect');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = { activity: document.getElementById('panelActivity'), settings: document.getElementById('panelSettings') };

  // Logs Elements
  const logCountBadge = document.getElementById('logCountBadge');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const logsContainer = document.getElementById('logsContainer');
  const filterPills = document.querySelectorAll('.log-filter-pills .pill');

  let activeLogFilter = 'all';
  let cachedLogs = [];

  // F14: single source of defaults (src/utils/settings-defaults.js)
  const { DEFAULT_SETTINGS, criteriaFingerprint } = window.JevFB;
  // F18: single source of translated strings (src/utils/i18n.js)
  const { SUPPORTED_LANGUAGES, t: translate, normalizeLanguage } = window.JevFB;
  const defaults = {
    ...DEFAULT_SETTINGS,
    stats: { scanned: 0, hidden: 0, cacheHits: 0, deferred: 0 }
  };

  let currentLang = DEFAULT_SETTINGS.language;
  const t = (key, params) => translate(currentLang, key, params);

  // ==================== i18n ====================

  SUPPORTED_LANGUAGES.forEach(({ code, name }) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    languageSelect.appendChild(opt);
  });

  const PRESET_IDS = ['gambling', 'spoiler', 'drama', 'crypto', 'realestate'];

  const PRESET_ICONS = {
    gambling: `<svg class="ui-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/></svg>`,
    spoiler: `<svg class="ui-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/></svg>`,
    drama: `<svg class="ui-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
    crypto: `<svg class="ui-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 8h4.5a2 2 0 1 1 0 4H9m0 0h5a2 2 0 1 1 0 4H9m0-8v8m2-10v2m2-2v2m-2 16v2m2-2v2"/></svg>`,
    realestate: `<svg class="ui-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>`
  };

  const ICON_EYE = `<svg class="ui-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const ICON_EYE_OFF = `<svg class="ui-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

  function updateToggleKeyIcon() {
    toggleKeyVisibility.innerHTML = apiKeyInput.type === 'password' ? ICON_EYE : ICON_EYE_OFF;
  }

  function applyPresetChips() {
    presetChips.forEach((chip) => {
      const id = chip.dataset.presetId;
      const icon = PRESET_ICONS[id] || '';
      const text = t(`preset_${id}_label`);
      chip.innerHTML = `${icon}<span>${text}</span>`;
      chip.dataset.preset = t(`preset_${id}_text`);
    });
  }

  function applyI18n() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    toggleFilterLabel.title = t('toggleFilterTitle');
    btnClearCacheTitleRefresh();
    btnCopyLogs.title = t('btnCopyLogsTitle');
    btnCopyLogs.setAttribute('aria-label', t('btnCopyLogsTitle'));
    btnClearLogs.title = t('btnClearLogsTitle');
    btnClearLogs.setAttribute('aria-label', t('btnClearLogsTitle'));
    updateToggleKeyIcon();
    if (blurClassicColor) blurClassicColor.setAttribute('aria-label', t('blurTintCustom'));
    refreshClassicLookLabels();
    btnToggleAdvanced.textContent = advancedSettings.classList.contains('hidden') ? t('btnToggleAdvancedShow') : t('btnToggleAdvancedHide');
    applyPresetChips();
    updateChips();
    updateCriteriaStatusText();
    apiStatusBadge.textContent = t(apiBadgeKey);
    renderLogs();
  }

  function btnClearCacheTitleRefresh() {
    if (!btnClearCache.classList.contains('confirm')) btnClearCache.title = t('btnClearCacheTitle');
  }

  // The API badge's text depends on runtime state (saved/untested/testing/error...),
  // not just the current language — data-i18n would blindly overwrite it on every
  // language switch, so its key is tracked separately and re-applied here.
  let apiBadgeKey = 'badgeUntested';
  function setApiBadge(key, className) {
    apiBadgeKey = key;
    apiStatusBadge.textContent = t(key);
    apiStatusBadge.className = className;
  }

  // ==================== TABS ====================

  const TAB_KEY = 'jevActiveTab';
  function setActiveTab(tabName) {
    tabButtons.forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
    Object.entries(tabPanels).forEach(([name, panel]) => {
      const hidden = name !== tabName;
      panel.classList.toggle('hidden', hidden);
      panel.hidden = hidden;
    });
    try { localStorage.setItem(TAB_KEY, tabName); } catch (_) {}
  }

  tabButtons.forEach((btn) => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));
  document.querySelector('.tabs').addEventListener('keydown', (e) => {
    const current = [...tabButtons].indexOf(document.activeElement);
    if (current < 0) return;
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % tabButtons.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + tabButtons.length) % tabButtons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabButtons.length - 1;
    else return;
    e.preventDefault();
    const button = tabButtons[next];
    setActiveTab(button.dataset.tab);
    button.focus();
  });

  let initialTab = 'activity';
  try { initialTab = localStorage.getItem(TAB_KEY) || 'activity'; } catch (_) {}
  if (!tabPanels[initialTab]) initialTab = 'activity';
  setActiveTab(initialTab);

  // Unsaved criteria survive closing the popup (per-browser convenience only)
  const DRAFT_KEY = 'jevCriteriaDraft';
  const readDraft = () => { try { return localStorage.getItem(DRAFT_KEY); } catch (_) { return null; } };
  const writeDraft = (v) => {
    try { v == null ? localStorage.removeItem(DRAFT_KEY) : localStorage.setItem(DRAFT_KEY, v); } catch (_) {}
  };

  let classicTint = '';
  const CLASSIC_PRESET_TINTS = new Set(['', '#1c1e21', '#f5f6f7', '#1877f2', '#7fa894']);
  let savedCriteria = DEFAULT_SETTINGS.filterCriteria;
  let savedWhitelist = DEFAULT_SETTINGS.whitelistCriteria || '';
  let savedApiKey = '';
  let savedApiUrl = DEFAULT_SETTINGS.apiUrl;

  chrome.storage.local.get(defaults, (data) => {
    currentLang = normalizeLanguage(data.language);
    languageSelect.value = currentLang;

    extensionEnabled.checked = data.extensionEnabled;
    apiKeyInput.value = data.apiKey || '';
    apiUrlInput.value = data.apiUrl || DEFAULT_SETTINGS.apiUrl;
    confidenceSlider.value = data.confidenceThreshold;
    thresholdDisplay.textContent = `${confidenceSlider.value}%`;
    hideModeSelect.value = data.hideMode;
    if (filterModeSelect) filterModeSelect.value = data.filterMode;
    if (blurPresetSelect) blurPresetSelect.value = data.blurPreset || DEFAULT_SETTINGS.blurPreset || 'classic';
    renderClassicLook(data.blurClassicStrength, data.blurClassicTint);
    if (blurFlashcardTopicSelect) blurFlashcardTopicSelect.value = data.blurFlashcardTopic || DEFAULT_SETTINGS.blurFlashcardTopic || 'ielts';
    if (blurRevealFrictionSelect) blurRevealFrictionSelect.value = data.blurRevealFriction || DEFAULT_SETTINGS.blurRevealFriction || 'instant';
    if (blurCustomQuotesInput) blurCustomQuotesInput.value = data.blurCustomQuotes || '';
    updateBlurCustomizationVisibility();

    savedCriteria = data.filterCriteria;
    savedWhitelist = data.whitelistCriteria || '';
    savedApiKey = apiKeyInput.value.trim();
    savedApiUrl = apiUrlInput.value.trim();
    const draft = readDraft();
    filterCriteriaInput.value = draft != null ? draft : data.filterCriteria;
    if (whitelistCriteriaInput) whitelistCriteriaInput.value = data.whitelistCriteria || '';

    applyI18n();
    updateCriteriaState();
    updateKeyWarningState();
    updateStatsDisplay(data.stats);
    mergeSessionStats();

    if (data.apiKey) {
      setApiBadge('badgeSaved', 'badge badge-success');
    } else {
      setApiBadge('badgeNotEntered', 'badge badge-error');
    }
  });

  languageSelect.addEventListener('change', () => {
    currentLang = normalizeLanguage(languageSelect.value);
    applyI18n();
    chrome.storage.local.set({ language: currentLang });
  });

  // ==================== SAVING ====================
  // Every setting saves itself; content scripts pick changes up through
  // storage.onChanged (the API key is never broadcast to Facebook tabs).

  let toastTimer = null;
  function showToast(message, isError = false) {
    saveToast.textContent = message || t('saveToastDefault');
    saveToast.classList.toggle('toast-error', isError);
    saveToast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => saveToast.classList.add('hidden'), 1600);
  }

  function save(partial, message) {
    return chrome.storage.local.set(partial).then(
      () => { showToast(message); return true; },
      () => { showToast(t('saveToastError'), true); return false; }
    );
  }

  function updateKeyWarningState() {
    apiKeyWarning.classList.toggle('hidden', !!apiKeyInput.value.trim());
  }

  function updateStatsDisplay(stats = {}) {
    const scanned = stats.scanned || 0;
    const hidden = Math.max(0, stats.hidden || 0);
    const cacheHits = stats.cacheHits || 0;
    const deferred = Math.max(0, stats.deferred || 0);
    statScanned.textContent = scanned.toLocaleString();
    statHidden.textContent = hidden.toLocaleString();
    const hitRate = scanned > 0 ? Math.round((cacheHits / scanned) * 100) : 0;
    statCacheHit.textContent = `${hitRate}%`;
    statDeferred.textContent = deferred.toLocaleString();
  }

  // Stats live in TWO layers (see background.js): storage.session holds the
  // current run's counters (session writes never broadcast to Facebook tabs)
  // and storage.local a snapshot folded in every 30s so totals survive
  // restarts. The displayed lifetime value = local + session.
  function mergeSessionStats() {
    chrome.storage.session.get('stats', (sess) => {
      const s = (sess && sess.stats) || {};
      chrome.storage.local.get('stats', (loc) => updateStatsDisplay({
        scanned: (s.scanned || 0) + ((loc.stats && loc.stats.scanned) || 0),
        hidden: (s.hidden || 0) + ((loc.stats && loc.stats.hidden) || 0),
        cacheHits: (s.cacheHits || 0) + ((loc.stats && loc.stats.cacheHits) || 0),
        deferred: (s.deferred || 0) + ((loc.stats && loc.stats.deferred) || 0)
      }));
    });
  }

  // On/off switch, threshold, display mode, blur: take effect immediately
  extensionEnabled.addEventListener('change', () => {
    save({ extensionEnabled: extensionEnabled.checked }, extensionEnabled.checked ? t('toastEnabled') : t('toastDisabled'));
  });

  confidenceSlider.addEventListener('input', () => {
    thresholdDisplay.textContent = `${confidenceSlider.value}%`;
  });
  // `change` fires on release: one save (and one 0-token re-gate) per adjustment
  confidenceSlider.addEventListener('change', () => {
    save({ confidenceThreshold: parseInt(confidenceSlider.value, 10) });
  });

  function strengthHintKey(px) {
    if (px <= 10) return 'blurStrengthLight';
    if (px <= 22) return 'blurStrengthMedium';
    return 'blurStrengthStrong';
  }

  function renderClassicLook(strength, tint) {
    if (typeof window.JevFB.classicBlurLook !== 'function') return;
    const look = window.JevFB.classicBlurLook(strength, tint);
    classicTint = look.tint;
    if (blurClassicStrength) {
      blurClassicStrength.value = String(look.px);
      blurClassicStrength.setAttribute('aria-valuetext', t(strengthHintKey(look.px)));
    }
    if (blurClassicColor && look.tint) blurClassicColor.value = look.tint;
    if (blurClassicSwatches) {
      blurClassicSwatches.querySelectorAll('.swatch[data-tint]').forEach((btn) => {
        const on = btn.dataset.tint === look.tint;
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-pressed', String(on));
      });
    }
    if (blurClassicCustom) {
      blurClassicCustom.classList.toggle('is-selected', look.tint !== '' && !CLASSIC_PRESET_TINTS.has(look.tint));
    }
    if (blurClassicPreview) {
      blurClassicPreview.style.setProperty('--preview-blur', `${look.px}px`);
      blurClassicPreview.style.setProperty('--preview-opacity', String(look.opacity));
      blurClassicPreview.style.setProperty('--preview-wash', look.wash);
    }
    refreshClassicLookLabels();
  }

  function refreshClassicLookLabels() {
    if (!blurClassicStrength || !blurStrengthHint) return;
    const px = parseInt(blurClassicStrength.value, 10);
    blurStrengthHint.textContent = t(strengthHintKey(px));
    blurClassicStrength.setAttribute('aria-valuetext', blurStrengthHint.textContent);
  }

  function saveClassicLook() {
    if (!blurClassicStrength) return;
    const look = window.JevFB.classicBlurLook(blurClassicStrength.value, classicTint);
    renderClassicLook(look.px, look.tint);
    save({ blurClassicStrength: look.px, blurClassicTint: look.tint });
  }

  function updateBlurCustomizationVisibility() {
    const isBlur = hideModeSelect.value === 'blur';
    if (blurCustomizationGroup) {
      blurCustomizationGroup.classList.toggle('hidden', !isBlur);
    }
    const preset = blurPresetSelect ? blurPresetSelect.value : '';
    if (blurClassicLook) blurClassicLook.classList.toggle('hidden', !isBlur || preset !== 'classic');
    if (isBlur && blurPresetSelect) {
      if (blurFlashcardTopicRow) {
        blurFlashcardTopicRow.classList.toggle('hidden', preset !== 'flashcard');
      }
      if (blurCustomQuotesRow) {
        blurCustomQuotesRow.classList.toggle('hidden', preset !== 'zen');
      }
    }
  }

  hideModeSelect.addEventListener('change', () => {
    save({ hideMode: hideModeSelect.value });
    updateBlurCustomizationVisibility();
  });

  if (blurPresetSelect) {
    blurPresetSelect.addEventListener('change', () => {
      save({ blurPreset: blurPresetSelect.value });
      updateBlurCustomizationVisibility();
    });
  }

  if (blurClassicStrength) {
    blurClassicStrength.addEventListener('input', () => {
      renderClassicLook(blurClassicStrength.value, classicTint);
    });
    blurClassicStrength.addEventListener('change', saveClassicLook);
  }

  if (blurClassicSwatches) {
    blurClassicSwatches.addEventListener('click', (event) => {
      const btn = event.target.closest('.swatch[data-tint]');
      if (!btn || !blurClassicSwatches.contains(btn)) return;
      classicTint = btn.dataset.tint || '';
      saveClassicLook();
    });
  }

  if (blurClassicColor) {
    let tintTimer = null;
    const pickCustomTint = () => {
      classicTint = blurClassicColor.value;
      renderClassicLook(blurClassicStrength ? blurClassicStrength.value : 18, classicTint);
      clearTimeout(tintTimer);
      tintTimer = setTimeout(saveClassicLook, 200);
    };
    blurClassicColor.addEventListener('input', pickCustomTint);
    blurClassicColor.addEventListener('change', () => {
      clearTimeout(tintTimer);
      classicTint = blurClassicColor.value;
      saveClassicLook();
    });
  }

  if (blurClassicReset) {
    blurClassicReset.addEventListener('click', () => {
      classicTint = DEFAULT_SETTINGS.blurClassicTint;
      if (blurClassicStrength) blurClassicStrength.value = String(DEFAULT_SETTINGS.blurClassicStrength);
      saveClassicLook();
    });
  }

  if (blurFlashcardTopicSelect) {
    blurFlashcardTopicSelect.addEventListener('change', () => {
      save({ blurFlashcardTopic: blurFlashcardTopicSelect.value });
    });
  }

  if (blurRevealFrictionSelect) {
    blurRevealFrictionSelect.addEventListener('change', () => {
      save({ blurRevealFriction: blurRevealFrictionSelect.value });
    });
  }

  if (blurCustomQuotesInput) {
    let customQuotesTimeout = null;
    blurCustomQuotesInput.addEventListener('input', () => {
      clearTimeout(customQuotesTimeout);
      customQuotesTimeout = setTimeout(() => {
        save({ blurCustomQuotes: blurCustomQuotesInput.value.trim() });
      }, 400);
    });
    blurCustomQuotesInput.addEventListener('change', () => {
      clearTimeout(customQuotesTimeout);
      save({ blurCustomQuotes: blurCustomQuotesInput.value.trim() });
    });
  }

  if (filterModeSelect) filterModeSelect.addEventListener('change', () => save({ filterMode: filterModeSelect.value }));

  // ==================== CRITERIA ====================
  // NOT saved on every keystroke: each saved criteria re-evaluates the posts
  // on screen, so half-typed criteria would cost tokens. The user applies
  // explicitly (button / Ctrl+Enter); the draft is kept if the popup closes.

  function isCriteriaDirty() {
    const critVal = filterCriteriaInput.value;
    const wlVal = whitelistCriteriaInput ? whitelistCriteriaInput.value : '';
    return criteriaFingerprint(critVal, wlVal) !== criteriaFingerprint(savedCriteria, savedWhitelist);
  }

  function updateCriteriaStatusText() {
    const dirty = isCriteriaDirty();
    criteriaStatus.textContent = dirty ? t('criteriaDirty') : t('criteriaApplied');
    criteriaStatus.classList.toggle('dirty', dirty);
    btnApplyCriteria.disabled = !dirty;
  }

  function updateCriteriaState() {
    writeDraft(isCriteriaDirty() ? filterCriteriaInput.value : null);
    updateCriteriaStatusText();
    updateChips();
  }

  async function applyCriteria() {
    if (!isCriteriaDirty()) return;
    const value = filterCriteriaInput.value.trim();
    const wlValue = whitelistCriteriaInput ? whitelistCriteriaInput.value.trim() : '';
    if (await save({ filterCriteria: value, whitelistCriteria: wlValue }, t('toastCriteriaApplied'))) {
      savedCriteria = value;
      savedWhitelist = wlValue;
      updateCriteriaState();
    }
  }

  filterCriteriaInput.addEventListener('input', updateCriteriaState);
  filterCriteriaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      applyCriteria();
    }
  });
  if (whitelistCriteriaInput) {
    whitelistCriteriaInput.addEventListener('input', updateCriteriaState);
    whitelistCriteriaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        applyCriteria();
      }
    });
  }
  btnApplyCriteria.addEventListener('click', applyCriteria);

  // Preset chips toggle: click adds the preset, click again removes it
  const normalize = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

  function updateChips() {
    const current = normalize(filterCriteriaInput.value);
    presetChips.forEach(chip => {
      const active = !!chip.dataset.preset && current.includes(normalize(chip.dataset.preset));
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = chip.dataset.preset;
      const current = filterCriteriaInput.value.trim();
      if (chip.classList.contains('active')) {
        filterCriteriaInput.value = current
          .split('\n')
          .filter(line => normalize(line) !== normalize(preset))
          .join('\n')
          .trim();
      } else {
        filterCriteriaInput.value = current ? `${current}\n${preset}` : preset;
      }
      updateCriteriaState();
      filterCriteriaInput.focus();
    });
  });

  // ==================== API KEY / ENDPOINT ====================

  apiKeyInput.addEventListener('input', updateKeyWarningState);

  // Saved when the field is committed (blur / Enter), not per keystroke
  apiKeyInput.addEventListener('change', () => {
    const key = apiKeyInput.value.trim();
    if (key === savedApiKey) return;
    save({ apiKey: key }, key ? t('toastApiKeySaved') : t('toastApiKeyDeleted')).then((ok) => {
      if (ok) savedApiKey = key;
    });
    setApiBadge(key ? 'badgeUntested' : 'badgeNotEntered', key ? 'badge badge-untested' : 'badge badge-error');
  });

  toggleKeyVisibility.addEventListener('click', () => {
    const isPass = apiKeyInput.type === 'password';
    apiKeyInput.type = isPass ? 'text' : 'password';
    updateToggleKeyIcon();
  });

  btnToggleAdvanced.addEventListener('click', () => {
    advancedSettings.classList.toggle('hidden');
    btnToggleAdvanced.textContent = advancedSettings.classList.contains('hidden')
      ? t('btnToggleAdvancedShow')
      : t('btnToggleAdvancedHide');
  });

  // Endpoints outside the manifest's host_permissions need an optional host
  // permission, otherwise requests depend on the server's CORS setup.
  const BUILTIN_HOSTS = new Set(['api.typesafe.ai']);
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

  function parseApiUrl(raw) {
    try {
      const u = new URL(raw);
      // Plain http is only allowed for a local server: the API key and post
      // text must not travel unencrypted over the network.
      if (u.protocol === 'https:') return u;
      return (u.protocol === 'http:' && LOCAL_HOSTS.has(u.hostname)) ? u : null;
    } catch (_) {
      return null;
    }
  }

  const originOf = (u) => `${u.protocol}//${u.hostname}/*`;

  /**
   * MUST be called synchronously at the start of a click handler (the
   * permission prompt requires a user gesture, which an earlier await would lose).
   * @returns {Promise<boolean>}
   */
  function ensureHostPermission(rawUrl) {
    const u = parseApiUrl(rawUrl);
    if (!u) return Promise.resolve(false);
    if (BUILTIN_HOSTS.has(u.hostname)) return Promise.resolve(true);
    return chrome.permissions.request({ origins: [originOf(u)] }).catch(() => false);
  }

  function hideApiError() {
    apiErrorNotice.classList.add('hidden');
    apiErrorNotice.textContent = '';
  }

  function showApiError(message) {
    apiErrorNotice.textContent = `⚠️ ${message}`;
    apiErrorNotice.classList.remove('hidden');
  }

  // A committed endpoint saves itself when no permission prompt is needed;
  // otherwise "Test Connection" (a click, which may show the prompt) saves it.
  apiUrlInput.addEventListener('change', async () => {
    const url = apiUrlInput.value.trim() || DEFAULT_SETTINGS.apiUrl;
    if (url === savedApiUrl) return;
    const u = parseApiUrl(url);
    if (!u) {
      showApiError(t('errApiUrlProtocol'));
      return;
    }
    hideApiError();
    const granted = BUILTIN_HOSTS.has(u.hostname) ||
      await chrome.permissions.contains({ origins: [originOf(u)] }).catch(() => false);
    if (!granted) {
      showApiError(t('errPermissionNeeded', { host: u.hostname }));
      return;
    }
    if (await save({ apiUrl: url }, t('toastEndpointSaved'))) savedApiUrl = url;
  });

  /** Save key + endpoint, then test them. Call synchronously from a click. */
  async function saveAndTestConnection() {
    const key = apiKeyInput.value.trim();
    const url = apiUrlInput.value.trim() || DEFAULT_SETTINGS.apiUrl;
    const permissionPromise = ensureHostPermission(url); // keep user gesture
    hideApiError();

    if (!parseApiUrl(url)) {
      setApiBadge('badgeInvalidUrl', 'badge badge-error');
      advancedSettings.classList.remove('hidden');
      showApiError(t('errApiUrlProtocol'));
      return;
    }

    if (!key) {
      setApiBadge('badgeNotEntered', 'badge badge-error');
      apiKeyInput.focus();
      return;
    }

    setApiBadge('badgeTesting', 'badge badge-testing');
    btnTestKey.disabled = true;

    try {
      if (!(await permissionPromise)) {
        throw new Error(t('errPermissionMissing', { host: parseApiUrl(url).hostname }));
      }
      if (key !== savedApiKey || url !== savedApiUrl) {
        await chrome.storage.local.set({ apiKey: key, apiUrl: url });
        savedApiKey = key;
        savedApiUrl = url;
      }
      const response = await chrome.runtime.sendMessage({ action: 'TEST_API_KEY', apiKey: key, apiUrl: url, lang: currentLang });

      if (response && response.success) {
        setApiBadge('badgeConnGood', 'badge badge-success');
        apiKeyWarning.classList.add('hidden');
      } else {
        setApiBadge('badgeConnError', 'badge badge-error');
        showApiError(response?.error || t('errInvalidOrUnapproved'));
      }
    } catch (err) {
      setApiBadge('badgeApiCallError', 'badge badge-error');
      showApiError(err.message);
    } finally {
      btnTestKey.disabled = false;
    }
  }

  btnTestKey.addEventListener('click', saveAndTestConnection);

  // Quick 1-click Mock Server Setup
  btnQuickMock.addEventListener('click', () => {
    apiKeyInput.value = 'mock_jev_test_key_local';
    apiUrlInput.value = 'http://localhost:3000';
    advancedSettings.classList.remove('hidden');
    btnToggleAdvanced.textContent = t('btnToggleAdvancedHide');
    updateKeyWarningState();
    saveAndTestConnection();
  });

  // ==================== CACHE ====================
  // Two-step confirm: clearing makes every post cost tokens again.
  let clearConfirmTimer = null;
  btnClearCache.addEventListener('click', async () => {
    const textEl = btnClearCache.querySelector('.btn-text') || btnClearCache;
    if (!btnClearCache.classList.contains('confirm')) {
      btnClearCache.classList.add('confirm');
      textEl.textContent = t('btnClearCacheConfirm');
      clearConfirmTimer = setTimeout(resetClearCache, 3000);
      return;
    }
    resetClearCache();
    const res = await chrome.runtime.sendMessage({ action: 'CLEAR_CACHE' }).catch(() => null);
    showToast(res && res.success ? t('toastCacheCleared') : t('toastCacheClearFail'), !(res && res.success));
  });

  function resetClearCache() {
    clearTimeout(clearConfirmTimer);
    btnClearCache.classList.remove('confirm');
    const textEl = btnClearCache.querySelector('.btn-text') || btnClearCache;
    textEl.textContent = t('btnClearCache');
  }

  // ==================== LIVE LOGS ====================

  async function loadLiveLogs() {
    try {
      const logs = await chrome.runtime.sendMessage({ action: 'GET_LOGS' });
      if (Array.isArray(logs)) {
        cachedLogs = logs;
        renderLogs();
      }
    } catch (err) {
      console.warn('Could not load logs:', err);
    }
  }

  const LOG_LEVELS = new Set(['info', 'success', 'warn', 'error', 'ai']);
  const MAX_LOGS = 150;

  function matchesFilter(item) {
    switch (activeLogFilter) {
      case 'hide': return item.tag === 'HIDDEN' || item.level === 'success';
      case 'ai': return item.tag === 'JEV-AI' || item.level === 'ai';
      case 'warn': return item.level === 'warn' || item.level === 'error' || item.tag === 'WARN' || item.tag === 'ERROR';
      default: return true;
    }
  }

  // Entries with an i18n key follow the current UI language; older/plain ones keep their text.
  const logText = (log) => (log.key ? translate(currentLang, log.key, log.params || {}) : log.message || '');

  function logEntryHtml(log) {
    const levelClass = `level-${LOG_LEVELS.has(log.level) ? log.level : 'info'}`;
    return `
      <div class="log-entry ${levelClass}">
        <div class="log-entry-header">
          <span class="log-time">${escapeHtml(log.time || '')}</span>
          <span class="log-tag-badge">${escapeHtml(log.tag || 'INFO')}</span>
        </div>
        <div class="log-text">${escapeHtml(logText(log))}</div>
      </div>
    `;
  }

  function renderEmpty() {
    logsContainer.innerHTML = `<div class="logs-empty">${escapeHtml(cachedLogs.length === 0 ? t('logsEmptyNoLogs') : t('logsEmptyFiltered'))}</div>`;
  }

  /** Full render — only on open, filter change and clear. */
  function renderLogs() {
    logCountBadge.textContent = t('logCountLabel', { count: cachedLogs.length });
    const filtered = cachedLogs.filter(matchesFilter);
    if (filtered.length === 0) {
      renderEmpty();
      return;
    }
    logsContainer.innerHTML = filtered.map(logEntryHtml).join('');
  }

  /** Live updates: prepend only the new entries instead of rebuilding the list. */
  function prependLogs(newLogs) {
    logCountBadge.textContent = t('logCountLabel', { count: cachedLogs.length });
    const visibleNew = newLogs.filter(matchesFilter);
    if (visibleNew.length === 0) return;
    logsContainer.querySelector('.logs-empty')?.remove();
    logsContainer.insertAdjacentHTML('afterbegin', visibleNew.map(logEntryHtml).join(''));
    while (logsContainer.children.length > MAX_LOGS) logsContainer.lastElementChild.remove();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeLogFilter = pill.dataset.filter;
      renderLogs();
    });
  });

  btnClearLogs.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' });
    cachedLogs = [];
    renderLogs();
  });

  btnCopyLogs.addEventListener('click', async () => {
    if (cachedLogs.length === 0) return;
    const text = cachedLogs.map(l => `[${l.time}] [${l.tag}] ${logText(l)}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      btnCopyLogs.classList.add('copied');
      showToast(t('toastCopied'));
      setTimeout(() => { btnCopyLogs.classList.remove('copied'); }, 1500);
    } catch (_) {
      console.warn('Clipboard write failed');
    }
  });

  // Real-time logs from background (batched)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'NEW_LOG_ENTRIES' && Array.isArray(message.logs)) {
      cachedLogs = message.logs.concat(cachedLogs);
      if (cachedLogs.length > MAX_LOGS) cachedLogs.length = MAX_LOGS;
      prependLogs(message.logs);
    }

    if (message.action === 'LOGS_CLEARED') {
      cachedLogs = [];
      renderLogs();
    }
  });

  // Live statistics: a change in either layer re-merges the sum
  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === 'local' || area === 'session') && changes.stats) {
      mergeSessionStats();
    }
  });

  loadLiveLogs();
});
