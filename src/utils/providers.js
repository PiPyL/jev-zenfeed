/**
 * Decision providers — single source for URL, model, probe, and key link.
 *
 * To add a provider:
 * 1. Append one record to PROVIDERS.
 * 2. Add labelKey, hintKey, and placeholderKey in every language in i18n.js.
 * 3. permission 'required' must also be listed in manifest host_permissions.
 *    permission 'optional' is requested on the click that selects or tests it
 *    (optional_host_permissions already allows that prompt).
 * Do not add a second HTTP client. Tests lock steps 2 and 3.
 *
 * Dual-mode: classic popup script and the service-worker module.
 */
(function registerProviders(root) {
  const PROVIDERS = Object.freeze([
    // Array order = chip order in the popup. Nothing keys off the index:
    // lookups go by id/host, requiredHosts() filters by permission.
    Object.freeze({
      id: 'typesafe',
      apiUrl: 'https://api.typesafe.ai/v1',
      hosts: Object.freeze(['api.typesafe.ai']),
      model: 'jev-latest',
      probe: 'models',
      keyUrl: 'https://console.typesafe.ai/',
      permission: 'required',
      labelKey: 'providerTypeSafe',
      hintKey: 'providerTypeSafeHint',
      placeholderKey: 'apiKeyPlaceholderTypeSafe'
    }),
    Object.freeze({
      id: 'openrouter',
      apiUrl: 'https://openrouter.ai/api/v1',
      hosts: Object.freeze(['openrouter.ai']),
      model: 'typesafe/jev-1.13',
      // OpenRouter serves Jev decisions under /api/alpha/decisions; it has no
      // /v1/systemone route. Empty for providers that append /systemone.
      decisionsUrl: 'https://openrouter.ai/api/alpha/decisions',
      probe: 'systemone',
      keyUrl: 'https://openrouter.ai/settings/keys',
      // Optional so an update does not disable the extension for current users.
      permission: 'optional',
      labelKey: 'providerOpenRouter',
      hintKey: 'providerOpenRouterHint',
      placeholderKey: 'apiKeyPlaceholderOpenRouter',
      keyShapePrefix: 'sk-or-',
      keyShapeHintKey: 'keyShapeOpenRouter'
    })
  ]);

  const CUSTOM_MODEL = 'jev-latest';

  function hostnameOf(apiUrl) {
    try {
      return new URL(String(apiUrl || '').trim()).hostname;
    } catch (_) {
      return '';
    }
  }

  function resolveProvider(apiUrl) {
    const host = hostnameOf(apiUrl);
    const match = PROVIDERS.find((provider) => provider.hosts.includes(host));
    if (match) return match;
    return {
      id: 'custom',
      apiUrl: String(apiUrl || '').trim(),
      hosts: [],
      model: CUSTOM_MODEL,
      probe: 'models',
      keyUrl: '',
      permission: 'optional',
      labelKey: '',
      hintKey: 'providerCustomHint',
      placeholderKey: 'apiKeyPlaceholderCustom'
    };
  }

  /** Hosts already granted at install. Optional providers are not included. */
  function requiredHosts() {
    const hosts = [];
    PROVIDERS.forEach((provider) => {
      if (provider.permission === 'required') hosts.push(...provider.hosts);
    });
    return hosts;
  }

  /**
   * A saved key with no saved URL belongs to the old TypeSafe-only default.
   * A fresh install has neither, and should pick up the OpenRouter default.
   * @param {{apiKey?: unknown, apiUrl?: unknown}} raw
   * @returns {string|null}
   */
  function legacyEndpointMigration(raw) {
    const key = raw && typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
    const url = raw && typeof raw.apiUrl === 'string' ? raw.apiUrl.trim() : '';
    if (key && !url) return PROVIDERS.find((provider) => provider.id === 'typesafe').apiUrl;
    return null;
  }

  /** IndexedDB / hot-cache suffix. Same criteria under two models must not collide. */
  function decisionCacheSuffix(criteriaHash, apiUrl) {
    return `_${criteriaHash}_${resolveProvider(apiUrl).model}`;
  }

  /** OpenRouter and TypeSafe keep separate keys. Every other host shares `custom`. */
  function keySlot(apiUrl) {
    const id = resolveProvider(apiUrl).id;
    return id === 'openrouter' || id === 'typesafe' ? id : 'custom';
  }

  /**
   * A single legacy `apiKey` belongs to the endpoint it was saved with.
   * An explicit empty slot stays empty, so an OpenRouter key is not copied
   * into TypeSafe.
   * @param {unknown} storedMap
   * @param {unknown} apiKey
   * @param {unknown} apiUrl
   * @returns {{openrouter: string, typesafe: string, custom: string}}
   */
  function normalizeKeyMap(storedMap, apiKey, apiUrl) {
    const map = { openrouter: '', typesafe: '', custom: '' };
    if (storedMap && typeof storedMap === 'object') {
      Object.keys(map).forEach((slot) => {
        if (typeof storedMap[slot] === 'string') map[slot] = storedMap[slot].trim();
      });
    }
    const legacy = typeof apiKey === 'string' ? apiKey.trim() : '';
    const slot = keySlot(apiUrl);
    const mapWasStored = !!(storedMap && typeof storedMap === 'object' && typeof storedMap[slot] === 'string');
    if (legacy && !mapWasStored && !map[slot]) map[slot] = legacy;
    return map;
  }

  if (root) {
    root.JevFB = root.JevFB || {};
    root.JevFB.resolveProvider = resolveProvider;
    root.JevFB.legacyEndpointMigration = legacyEndpointMigration;
    root.__jevProviders = {
      PROVIDERS,
      resolveProvider,
      requiredHosts,
      legacyEndpointMigration,
      decisionCacheSuffix,
      keySlot,
      normalizeKeyMap,
      CUSTOM_MODEL
    };
  }
})(typeof self !== 'undefined' ? self : globalThis);
