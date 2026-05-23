/* global mergeSecurityFromStorage, mergeNetworkFromStorage, mergeDsBlockFromStorage, mergePrivacyPackFromStorage, mergePrivacyIsolationFromStorage, SECURITY_STORAGE_KEYS, NETWORK_STORAGE_KEYS, DS_BLOCK_STORAGE_KEYS, THREAT_SHIELD_STORAGE_KEYS, PRIVACY_PACK_STORAGE_KEYS, PRIVACY_ISOLATION_STORAGE_KEYS, PRIVACY_PACK_BUILTIN_BLOCK_DOMAINS, DS_BLOCK_BUILTIN_BLOCK_DOMAINS, normalizeExcludedDomainsForDnrHostList, normalizeExcludedDomainsListFromStorage, normalizeExcludedDomainStorageEntry, patternMatchesHost */
// MV3: UA / UA-CH headers + Network blocks (DNR) + WebRTC leak policy from options.
importScripts("security-defaults.js");

const DNR_UA_RULE_ID = 990001;
const DNR_ACCEPT_LANGUAGE_RULE_ID = 990002;
const DNR_UA_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other",
];

/** Omits navigations/subframes — top-level LAN/router pages must still load. */
const DNR_NETWORK_RESOURCE_TYPES = [
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other",
];

const NETWORK_RULE_SLOT_START = 990020;
const NETWORK_RULE_SLOTS = 12;

const DNR_DS_RESOURCE_TYPES = ["script", "xmlhttprequest", "ping", "image", "sub_frame", "csp_report", "other"];
const DS_RULE_SLOT_START = 990060;
const DS_RULE_SLOTS = 18;
const DS_DOMAINS_PER_RULE = 40;

/** Privacy pack (tracker DNR block) — first slot after DS Block (990060 + 18 − 1 = 990077). */
const PP_RULE_SLOT_START = 990078;
const PP_RULE_SLOTS = 20;
const PP_DOMAINS_PER_RULE = 40;

const DNR_PP_RESOURCE_TYPES_NARROW = ["script", "xmlhttprequest", "ping"];

/** Session map `{ [tabId]: true }` — вкладка «на паузе» до смены URL или закрытия. */
const SESSION_PAUSE_KEY = "focusBlockerPausedTabIds";
/** Session map `{ [tabId]: string }` — last injected DS cosmetic CSS per tab. */
const SESSION_DS_COSMETIC_KEY = "focusBlockerDsCosmeticCssByTabId";

/** Session map `{ [tabId]: StatsBucket }` — per-tab counters for toolbar badge. */
const SESSION_TAB_STATS_KEY = "focusBlockerTabStat";

/** Persisted aggregates by top-level hostname (options «Статистика»). */
const LOCAL_STATS_BY_HOST_KEY = "focusBlockerStatsByHost";

const STATS_MAX_HOSTS = 200;

const STATS_TAB_FIELDS = ["focus", "fpSpoof", "netJs", "device", "ds", "dnrBlock", "dnrModify"];

/** @typedef {Record<string, number>} StatsBucket */

function getStorageArea() {
  // `sync` can be unavailable/limited in some Chromium forks; use `local` as the canonical store.
  return (chrome.storage && chrome.storage.local) || chrome.storage.sync;
}

function maybeMigrateSyncToLocal(keys, done) {
  try {
    if (!chrome.storage || !chrome.storage.sync || !chrome.storage.local) return done();
    chrome.storage.local.get(keys, (localResult) => {
      const localHasAny = localResult && Object.keys(localResult).length > 0;
      if (localHasAny) return done();
      chrome.storage.sync.get(keys, (syncResult) => {
        const syncHasAny = syncResult && Object.keys(syncResult).length > 0;
        if (!syncHasAny) return done();
        chrome.storage.local.set(syncResult, () => done());
      });
    });
  } catch (_e) {
    done();
  }
}

function allNetworkDynamicRuleRemoveIds() {
  const ids = [];
  for (let i = 0; i < NETWORK_RULE_SLOTS; i++) ids.push(NETWORK_RULE_SLOT_START + i);
  return ids;
}

function allDsDynamicRuleRemoveIds() {
  const ids = [];
  for (let i = 0; i < DS_RULE_SLOTS; i++) ids.push(DS_RULE_SLOT_START + i);
  return ids;
}

function allPrivacyPackDynamicRuleRemoveIds() {
  const ids = [];
  for (let i = 0; i < PP_RULE_SLOTS; i++) ids.push(PP_RULE_SLOT_START + i);
  return ids;
}

function escapeChUaToken(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function buildSecChUa(brands) {
  if (!Array.isArray(brands) || !brands.length) return "";
  return brands
    .map((b) => {
      const brand = escapeChUaToken((b && b.brand) || "");
      const ver = escapeChUaToken((b && b.version) || "");
      return `"${brand}";v="${ver}"`;
    })
    .join(", ");
}

function buildRequestHeadersFromNavigator(nav) {
  if (!nav || typeof nav !== "object") return [];

  const headers = [];

  if (typeof nav.userAgent === "string" && nav.userAgent.trim()) {
    headers.push({ header: "User-Agent", operation: "set", value: nav.userAgent.trim() });
  }

  const secChUa = buildSecChUa(nav.uaDataBrands);
  if (secChUa) {
    headers.push({ header: "Sec-CH-UA", operation: "set", value: secChUa });
  }

  headers.push({
    header: "Sec-CH-UA-Mobile",
    operation: "set",
    value: nav.uaDataMobile ? "?1" : "?0",
  });

  const plat = String(nav.uaDataPlatform || "Windows").trim() || "Windows";
  headers.push({
    header: "Sec-CH-UA-Platform",
    operation: "set",
    value: `"${escapeChUaToken(plat)}"`,
  });

  const high = nav.uaDataHighEntropy && typeof nav.uaDataHighEntropy === "object" ? nav.uaDataHighEntropy : {};
  const fvl = buildSecChUa(high.fullVersionList);
  if (fvl) {
    headers.push({ header: "Sec-CH-UA-Full-Version-List", operation: "set", value: fvl });
  }
  if (high.uaFullVersion != null && String(high.uaFullVersion).trim()) {
    headers.push({
      header: "Sec-CH-UA-Full-Version",
      operation: "set",
      value: `"${escapeChUaToken(high.uaFullVersion)}"`,
    });
  }
  if (high.platformVersion != null && String(high.platformVersion).trim()) {
    headers.push({
      header: "Sec-CH-UA-Platform-Version",
      operation: "set",
      value: `"${escapeChUaToken(high.platformVersion)}"`,
    });
  }
  if (high.architecture != null && String(high.architecture).trim()) {
    headers.push({
      header: "Sec-CH-UA-Arch",
      operation: "set",
      value: `"${escapeChUaToken(high.architecture)}"`,
    });
  }
  if (high.bitness != null && String(high.bitness).trim()) {
    headers.push({
      header: "Sec-CH-UA-Bitness",
      operation: "set",
      value: `"${escapeChUaToken(high.bitness)}"`,
    });
  }
  if (high.model != null && String(high.model).trim()) {
    headers.push({
      header: "Sec-CH-UA-Model",
      operation: "set",
      value: `"${escapeChUaToken(high.model)}"`,
    });
  }

  return headers;
}

function buildAcceptLanguageValue(locales) {
  const list = Array.isArray(locales) ? locales : [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const raw = String(list[i] || "").trim();
    if (!raw) continue;
    if (!/^[A-Za-z0-9-]+$/.test(raw)) continue;
    const k = raw.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(raw);
    if (out.length >= 10) break;
  }
  if (!out.length) return "";

  const parts = [];
  for (let i = 0; i < out.length; i++) {
    const tag = out[i];
    if (i === 0) {
      parts.push(tag);
      continue;
    }
    const q = Math.max(0.1, 1 - i * 0.1);
    parts.push(`${tag};q=${q.toFixed(1)}`);
  }
  return parts.join(", ");
}

/**
 * Regex patterns matched against normalized request URLs by declarativeNetRequest.
 * ASCII-only regexFilter strings required by Chromium.
 *
 * @param {ReturnType<typeof mergeNetworkFromStorage>} networkMerged
 * @returns {string[]}
 */
function collectNetworkBlockRegexPatterns(networkMerged) {
  /** @type {string[]} */
  const patterns = [];
  if (!networkMerged.networkSecurityEnabled) return patterns;

  if (networkMerged.networkBlockLocalhost) {
    patterns.push("^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?localhost(?::\\d+)?([\\/\?#\]|$)");
    patterns.push("^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(?::|\\/|[\\?\#]|$)");
    patterns.push("^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?\\[::1\\](?::\\d+)?([\\/\?#\]|$)");
  }

  if (networkMerged.networkBlockPrivateIp) {
    patterns.push("^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(?::|\\/|[\\?\#]|$)");
    patterns.push("^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?192\\.168\\.\\d{1,3}\\.\\d{1,3}(?::|\\/|[\\?\#]|$)");
    patterns.push("^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?172\\.(?:1[6-9]|2[0-9]|3[0-1])\\.\\d{1,3}\\.\\d{1,3}(?::|\\/|[\\?\#]|$)");
    patterns.push("^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?169\\.254\\.\\d{1,3}\\.\\d{1,3}(?::|\\/|[\\?\#]|$)");
    patterns.push(
      "^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?\\[(?:FE80:|fe80:)[^\]]+\\](?::\\d+)?([\\/\?#\]|$)"
    );
    patterns.push(
      "^(?:https?|wss?):\\/\\/([^\\/?]*\\@)?\\[[fF][cCdD][0-9a-fA-F:%\\.]{3,}\\](?::\\d+)?([\\/\?#\]|$)"
    );
  }

  return patterns.slice(0, NETWORK_RULE_SLOTS);
}

/**
 * @param {ReturnType<typeof mergeNetworkFromStorage>} networkMerged
 * @param {string[]} excludedDnr
 * @returns {unknown[]}
 */
function buildDynamicNetworkRules(networkMerged, excludedDnr) {
  const patterns = collectNetworkBlockRegexPatterns(networkMerged);

  /** @type {unknown[]} */
  const rules = [];

  patterns.forEach((regexFilter, idx) => {
    if (idx >= NETWORK_RULE_SLOTS) return;

    const id = NETWORK_RULE_SLOT_START + idx;

    const condition = /** @type {Record<string, unknown>} */ ({
      regexFilter,
      resourceTypes: DNR_NETWORK_RESOURCE_TYPES,
    });
    if (excludedDnr.length) {
      condition.excludedInitiatorDomains = excludedDnr;
      condition.excludedRequestDomains = excludedDnr;
    }

    rules.push({
      id,
      priority: 3,
      action: { type: "block" },
      condition,
    });
  });

  return rules;
}

/**
 * @param {unknown} excluded
 */
function applyUaRulesFromFullResult(fullResult, excludedRaw) {
  const excluded = Array.isArray(excludedRaw) ? excludedRaw : [];
  const mergedSec = mergeSecurityFromStorage(fullResult || {});
  const globalOn = fullResult && fullResult.extensionGloballyEnabled === false ? false : true;
  const shouldSpoof = !!(globalOn && mergedSec.securityEnabled && mergedSec.securitySpoofNavigatorEnabled);

  if (!shouldSpoof) {
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [DNR_UA_RULE_ID] }, () => {
      void chrome.runtime.lastError;
    });
    return;
  }

  const requestHeaders = buildRequestHeadersFromNavigator(mergedSec.securityNavigator);
  if (!requestHeaders.length) {
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [DNR_UA_RULE_ID] }, () => {
      void chrome.runtime.lastError;
    });
    return;
  }

  const uaOnlyHeaders = requestHeaders.filter((h) => h && h.header === "User-Agent");
  const coreHeaderNames = new Set(["User-Agent", "Sec-CH-UA", "Sec-CH-UA-Mobile", "Sec-CH-UA-Platform"]);
  const coreHeaders = requestHeaders.filter((h) => h && coreHeaderNames.has(h.header));

  const excludedDnr = normalizeExcludedDomainsForDnrHostList(excluded);
  const condition = {
    urlFilter: "*://*/*",
    resourceTypes: DNR_UA_RESOURCE_TYPES,
  };
  if (excludedDnr.length) {
    condition.excludedInitiatorDomains = excludedDnr;
    condition.excludedRequestDomains = excludedDnr;
  }

  const rule = {
    id: DNR_UA_RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders,
    },
    condition,
  };

  function tryApplyHeaders(headers, label, next) {
    const hdrs = Array.isArray(headers) ? headers.filter(Boolean) : [];
    if (!hdrs.length) return next ? next() : undefined;
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: [DNR_UA_RULE_ID],
        addRules: [
          {
            ...rule,
            action: {
              ...rule.action,
              requestHeaders: hdrs,
            },
          },
        ],
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err) {
          console.warn(`[focus-blocker] DNR UA rule (${label}) failed:`, err.message);
          return next ? next() : undefined;
        }
        // Best-effort verification: ensure rule is present (some forks can silently drop it).
        try {
          chrome.declarativeNetRequest.getDynamicRules((rules) => {
            void chrome.runtime.lastError;
            const list = Array.isArray(rules) ? rules : [];
            if (!list.some((r) => r && r.id === DNR_UA_RULE_ID)) {
              console.warn("[focus-blocker] DNR UA rule missing after apply; will retry on next refresh.");
            }
          });
        } catch (_e) {}
      }
    );
  }

  // Step-down strategy: FULL → CORE → UA-only.
  tryApplyHeaders(requestHeaders, "full", () => {
    if (coreHeaders.length && coreHeaders.length < requestHeaders.length) {
      return tryApplyHeaders(coreHeaders, "core", () => {
        if (uaOnlyHeaders.length) return tryApplyHeaders(uaOnlyHeaders, "ua-only");
      });
    }
    if (uaOnlyHeaders.length && uaOnlyHeaders.length < requestHeaders.length) {
      return tryApplyHeaders(uaOnlyHeaders, "ua-only");
    }
  });
}

function applyAcceptLanguageRulesFromFullResult(fullResult, excludedRaw) {
  const excluded = Array.isArray(excludedRaw) ? excludedRaw : [];
  const mergedSec = mergeSecurityFromStorage(fullResult || {});
  const globalOn = fullResult && fullResult.extensionGloballyEnabled === false ? false : true;
  const shouldSpoof = !!(globalOn && mergedSec.securityEnabled && mergedSec.securitySpoofLanguagesEnabled);

  if (!shouldSpoof) {
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [DNR_ACCEPT_LANGUAGE_RULE_ID] }, () => {
      void chrome.runtime.lastError;
    });
    return;
  }

  const nav = mergedSec.securityNavigator || {};
  const acceptLanguage = buildAcceptLanguageValue(nav.languages || []);
  if (!acceptLanguage) {
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [DNR_ACCEPT_LANGUAGE_RULE_ID] }, () => {
      void chrome.runtime.lastError;
    });
    return;
  }

  const excludedDnr = normalizeExcludedDomainsForDnrHostList(excluded);
  const condition = {
    urlFilter: "*://*/*",
    resourceTypes: DNR_UA_RESOURCE_TYPES,
  };
  if (excludedDnr.length) {
    condition.excludedInitiatorDomains = excludedDnr;
    condition.excludedRequestDomains = excludedDnr;
  }

  const rule = {
    id: DNR_ACCEPT_LANGUAGE_RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{ header: "Accept-Language", operation: "set", value: acceptLanguage }],
    },
    condition,
  };

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: [DNR_ACCEPT_LANGUAGE_RULE_ID],
      addRules: [rule],
    },
    () => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.warn("[focus-blocker] Accept-Language DNR rule failed:", err.message);
      }
    }
  );
}

function applyNetworkBlockRulesFromFullResult(fullResult, excludedRaw) {
  const excluded = Array.isArray(excludedRaw) ? excludedRaw : [];
  const globalOn = fullResult && fullResult.extensionGloballyEnabled === false ? false : true;
  const nw = mergeNetworkFromStorage(fullResult || {});
  if (!globalOn) {
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: allNetworkDynamicRuleRemoveIds(),
        addRules: [],
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
    return;
  }
  const excludedDnr = normalizeExcludedDomainsForDnrHostList(excluded);
  const addRules = buildDynamicNetworkRules(nw, excludedDnr);

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: allNetworkDynamicRuleRemoveIds(),
      addRules: /** @type {chrome.declarativeNetRequest.Rule[]} */ (addRules),
    },
    () => {
      const err = chrome.runtime.lastError;
      if (err) console.warn("[focus-blocker] network dynamic rules failed:", err.message);
    }
  );
}

function collectDsBlockDomainsForDnr(dsMerged) {
  const builtins = Array.isArray(DS_BLOCK_BUILTIN_BLOCK_DOMAINS) ? DS_BLOCK_BUILTIN_BLOCK_DOMAINS : [];
  const extra = Array.isArray(dsMerged && dsMerged.dsBlockExtraBlockedDomains) ? dsMerged.dsBlockExtraBlockedDomains : [];
  const set = new Set();
  builtins.forEach((d) => {
    const v = typeof d === "string" ? d.trim().toLowerCase() : "";
    if (v) set.add(v);
  });
  extra.forEach((d) => {
    const v = typeof d === "string" ? d.trim().toLowerCase() : "";
    if (v) set.add(v);
  });
  return Array.from(set);
}

function buildDynamicDsBlockRules(dsMerged, excludedDnr) {
  /** @type {unknown[]} */
  const rules = [];
  if (!dsMerged || !dsMerged.dsBlockEnabled || !dsMerged.dsBlockTelemetryEnabled) return rules;

  const domains = collectDsBlockDomainsForDnr(dsMerged);
  if (!domains.length) return rules;

  const chunks = [];
  for (let i = 0; i < domains.length; i += DS_DOMAINS_PER_RULE) {
    chunks.push(domains.slice(i, i + DS_DOMAINS_PER_RULE));
    if (chunks.length >= DS_RULE_SLOTS) break;
  }

  chunks.forEach((requestDomains, idx) => {
    const id = DS_RULE_SLOT_START + idx;
    const condition = /** @type {Record<string, unknown>} */ ({
      requestDomains,
      resourceTypes: DNR_DS_RESOURCE_TYPES,
    });
    if (excludedDnr.length) {
      condition.excludedInitiatorDomains = excludedDnr;
      condition.excludedRequestDomains = excludedDnr;
    }
    rules.push({
      id,
      priority: 4,
      action: { type: "block" },
      condition,
    });
  });

  return rules;
}

function applyDsBlockRulesFromFullResult(fullResult, excludedRaw) {
  const excluded = Array.isArray(excludedRaw) ? excludedRaw : [];
  const globalOn = fullResult && fullResult.extensionGloballyEnabled === false ? false : true;
  const ds = mergeDsBlockFromStorage(fullResult || {});

  if (!globalOn || !ds.dsBlockEnabled || !ds.dsBlockTelemetryEnabled) {
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: allDsDynamicRuleRemoveIds(),
        addRules: [],
      },
      () => void chrome.runtime.lastError
    );
    return;
  }

  const excludedDnr = normalizeExcludedDomainsForDnrHostList(excluded);
  const addRules = buildDynamicDsBlockRules(ds, excludedDnr);

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: allDsDynamicRuleRemoveIds(),
      addRules: /** @type {chrome.declarativeNetRequest.Rule[]} */ (addRules),
    },
    () => {
      const err = chrome.runtime.lastError;
      if (err) console.warn("[focus-blocker] ds-block dynamic rules failed:", err.message);
    }
  );
}

function collectPrivacyPackDomainsForDnr(ppMerged) {
  const builtins = Array.isArray(PRIVACY_PACK_BUILTIN_BLOCK_DOMAINS) ? PRIVACY_PACK_BUILTIN_BLOCK_DOMAINS : [];
  const extra = Array.isArray(ppMerged && ppMerged.privacyPackExtraBlockedDomains)
    ? ppMerged.privacyPackExtraBlockedDomains
    : [];
  const set = new Set();
  builtins.forEach((d) => {
    const v = typeof d === "string" ? d.trim().toLowerCase() : "";
    if (v) set.add(v);
  });
  extra.forEach((d) => {
    const v = typeof d === "string" ? d.trim().toLowerCase() : "";
    if (v) set.add(v);
  });
  return Array.from(set);
}

function buildPrivacyPackRules(ppMerged, excludedDnr) {
  /** @type {unknown[]} */
  const rules = [];
  if (!ppMerged || !ppMerged.privacyPackEnabled) return rules;

  const domains = collectPrivacyPackDomainsForDnr(ppMerged);
  if (!domains.length) return rules;

  const resourceTypes = ppMerged.privacyPackWideResourceTypes ? DNR_DS_RESOURCE_TYPES : DNR_PP_RESOURCE_TYPES_NARROW;

  const chunks = [];
  for (let i = 0; i < domains.length; i += PP_DOMAINS_PER_RULE) {
    chunks.push(domains.slice(i, i + PP_DOMAINS_PER_RULE));
    if (chunks.length >= PP_RULE_SLOTS) break;
  }

  chunks.forEach((requestDomains, idx) => {
    const id = PP_RULE_SLOT_START + idx;
    const condition = /** @type {Record<string, unknown>} */ ({
      requestDomains,
      resourceTypes,
    });
    if (excludedDnr.length) {
      condition.excludedInitiatorDomains = excludedDnr;
      condition.excludedRequestDomains = excludedDnr;
    }
    rules.push({
      id,
      priority: 5,
      action: { type: "block" },
      condition,
    });
  });

  return rules;
}

function applyPrivacyPackRulesFromFullResult(fullResult, excludedRaw) {
  const excluded = Array.isArray(excludedRaw) ? excludedRaw : [];
  const globalOn = fullResult && fullResult.extensionGloballyEnabled === false ? false : true;
  const pp = mergePrivacyPackFromStorage(fullResult || {});

  if (!globalOn || !pp.privacyPackEnabled) {
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: allPrivacyPackDynamicRuleRemoveIds(),
        addRules: [],
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err) console.warn("[focus-blocker] privacy-pack clear dynamic rules failed:", err.message);
      }
    );
    return;
  }

  const excludedDnr = normalizeExcludedDomainsForDnrHostList(excluded);
  const addRules = buildPrivacyPackRules(pp, excludedDnr);

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: allPrivacyPackDynamicRuleRemoveIds(),
      addRules: /** @type {chrome.declarativeNetRequest.Rule[]} */ (addRules),
    },
    () => {
      const err = chrome.runtime.lastError;
      if (err) console.warn("[focus-blocker] privacy-pack dynamic rules failed:", err.message);
    }
  );
}

function applyWebRtcPolicyFromFullResult(fullResult) {
  const globalOn = fullResult && fullResult.extensionGloballyEnabled === false ? false : true;
  const nw = mergeNetworkFromStorage(fullResult || {});
  try {
    if (!chrome.privacy || !chrome.privacy.network || !chrome.privacy.network.webRTCIPHandlingPolicy) {
      return;
    }
    /** @type {chrome.types.ChromeSetting} */
    const setObj = chrome.privacy.network.webRTCIPHandlingPolicy;
    const wantStrict = !!(globalOn && nw.networkSecurityEnabled && nw.networkWebRtcProtectionEnabled);
    const value = nw.networkWebRtcPolicy;
    function done() {
      void chrome.runtime.lastError;
    }

    if (wantStrict) {
      /** @suppress {missingProperties} */
      setObj.set({ value }, done);
      return;
    }

    /** @suppress {missingProperties} */
    if (typeof setObj.clear === "function") {
      setObj.clear({}, () => {
        if (chrome.runtime.lastError) setObj.set({ value: "default" }, done);
      });
    } else {
      setObj.set({ value: "default" }, done);
    }
  } catch (e) {
    console.warn("[focus-blocker] applyWebRtcPolicyFromFullResult:", e && e.message ? e.message : e);
  }
}

/**
 * Brave / Chromium forks may omit subsets of chrome.privacy; guard each setting.
 */
function applyPrivacyIsolationFromFullResult(fullResult) {
  const globalOn = fullResult && fullResult.extensionGloballyEnabled === false ? false : true;
  const iso = mergePrivacyIsolationFromStorage(fullResult || {});

  function done(label) {
    const err = chrome.runtime.lastError;
    if (err && err.message && label) console.warn("[focus-blocker]", label, err.message);
  }

  /** @param {chrome.types.ChromeSetting | undefined | null} setObj */
  function clearPrivacySetting(setObj, label) {
    if (!setObj) return;
    try {
      if (typeof setObj.clear === "function") {
        setObj.clear({}, () => done(label));
      }
    } catch (e) {
      console.warn("[focus-blocker] privacy isolation clear:", e && e.message ? e.message : e);
    }
  }

  /** @param {chrome.types.ChromeSetting | undefined | null} setObj @param {boolean} wantOff */
  function applyPrivacyBool(setObj, wantOff, label) {
    if (!setObj) return;
    try {
      if (!globalOn || !wantOff) {
        clearPrivacySetting(setObj, label);
        return;
      }
      setObj.set({ value: false }, () => done(label));
    } catch (e) {
      console.warn("[focus-blocker] privacy isolation set:", e && e.message ? e.message : e);
    }
  }

  try {
    const sites = chrome.privacy && chrome.privacy.websites;
    const net = chrome.privacy && chrome.privacy.network;

    if (!globalOn) {
      if (sites && sites.referrersEnabled) clearPrivacySetting(sites.referrersEnabled, "referrersEnabled");
      if (sites && sites.hyperlinkAuditingEnabled) clearPrivacySetting(sites.hyperlinkAuditingEnabled, "hyperlinkAuditingEnabled");
      if (net && net.networkPredictionEnabled) clearPrivacySetting(net.networkPredictionEnabled, "networkPredictionEnabled");
      return;
    }

    applyPrivacyBool(sites && sites.referrersEnabled, iso.privacyIsolationReferrersOff, "referrersEnabled");
    applyPrivacyBool(sites && sites.hyperlinkAuditingEnabled, iso.privacyIsolationHyperlinkAuditingOff, "hyperlinkAuditingEnabled");
    applyPrivacyBool(net && net.networkPredictionEnabled, iso.privacyIsolationNetworkPredictionOff, "networkPredictionEnabled");
  } catch (e) {
    console.warn("[focus-blocker] applyPrivacyIsolationFromFullResult:", e && e.message ? e.message : e);
  }
}

function reloadFromStorageSnapshot() {
  const keys = [
    "excludedDomains",
    "extensionGloballyEnabled",
    "focusBlockingEnabled",
    ...SECURITY_STORAGE_KEYS,
    ...NETWORK_STORAGE_KEYS,
    ...DS_BLOCK_STORAGE_KEYS,
    ...THREAT_SHIELD_STORAGE_KEYS,
    ...PRIVACY_PACK_STORAGE_KEYS,
    ...PRIVACY_ISOLATION_STORAGE_KEYS,
  ];

  maybeMigrateSyncToLocal(keys, () => {
    const storage = getStorageArea();
    storage.get(keys, (result) => {
      const excludedDomains = normalizeExcludedDomainsListFromStorage(
        Array.isArray(result.excludedDomains) ? result.excludedDomains : []
      );

      applyUaRulesFromFullResult(result, excludedDomains);
      applyAcceptLanguageRulesFromFullResult(result, excludedDomains);
      applyNetworkBlockRulesFromFullResult(result, excludedDomains);
      applyDsBlockRulesFromFullResult(result, excludedDomains);
      applyPrivacyPackRulesFromFullResult(result, excludedDomains);
      applyWebRtcPolicyFromFullResult(result);
      applyPrivacyIsolationFromFullResult(result);
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  reloadFromStorageSnapshot();
});

chrome.runtime.onStartup.addListener(() => {
  reloadFromStorageSnapshot();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== "local" && namespace !== "sync") return;
  const keys = Object.keys(changes || {});
  if (
    keys.some(
      (k) =>
        k === "excludedDomains" ||
        k === "extensionGloballyEnabled" ||
        k === "focusBlockingEnabled" ||
        (SECURITY_STORAGE_KEYS && SECURITY_STORAGE_KEYS.includes(k)) ||
        (NETWORK_STORAGE_KEYS && NETWORK_STORAGE_KEYS.includes(k)) ||
        (DS_BLOCK_STORAGE_KEYS && DS_BLOCK_STORAGE_KEYS.includes(k)) ||
        (THREAT_SHIELD_STORAGE_KEYS && THREAT_SHIELD_STORAGE_KEYS.includes(k)) ||
        (PRIVACY_PACK_STORAGE_KEYS && PRIVACY_PACK_STORAGE_KEYS.includes(k)) ||
        (PRIVACY_ISOLATION_STORAGE_KEYS && PRIVACY_ISOLATION_STORAGE_KEYS.includes(k))
    )
  ) {
    reloadFromStorageSnapshot();
  }
});

function readPausedTabMap(cb) {
  try {
    if (!chrome.storage.session) return cb({});
    chrome.storage.session.get(SESSION_PAUSE_KEY, (data) => {
      void chrome.runtime.lastError;
      const raw = data && data[SESSION_PAUSE_KEY];
      cb(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {});
    });
  } catch (e) {
    cb({});
  }
}

function writePausedTabMap(map, cb) {
  try {
    if (!chrome.storage.session) return cb && cb();
    chrome.storage.session.set({ [SESSION_PAUSE_KEY]: map }, () => {
      void chrome.runtime.lastError;
      if (cb) cb();
    });
  } catch (e) {
    if (cb) cb();
  }
}

/** In-memory fallback for forks without chrome.storage.session. */
let dsCosmeticMapFallback = {};

function readDsCosmeticCssMap(cb) {
  try {
    if (!chrome.storage || !chrome.storage.session) return cb(dsCosmeticMapFallback || {});
    chrome.storage.session.get(SESSION_DS_COSMETIC_KEY, (data) => {
      void chrome.runtime.lastError;
      const raw = data && data[SESSION_DS_COSMETIC_KEY];
      const map = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      cb(map);
    });
  } catch (e) {
    cb(dsCosmeticMapFallback || {});
  }
}

function writeDsCosmeticCssMap(map, cb) {
  try {
    if (!chrome.storage || !chrome.storage.session) {
      dsCosmeticMapFallback = map && typeof map === "object" ? map : {};
      if (cb) cb();
      return;
    }
    chrome.storage.session.set({ [SESSION_DS_COSMETIC_KEY]: map }, () => {
      void chrome.runtime.lastError;
      if (cb) cb();
    });
  } catch (e) {
    dsCosmeticMapFallback = map && typeof map === "object" ? map : {};
    if (cb) cb();
  }
}

function removeCosmeticCssFromTab(tabId, cssText, done) {
  try {
    if (!chrome.scripting || typeof chrome.scripting.removeCSS !== "function") return done && done(false);
    if (!cssText) return done && done(true);
    chrome.scripting.removeCSS(
      {
        target: { tabId, allFrames: true },
        css: cssText,
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err && err.message) console.warn("[focus-blocker] removeCSS:", err.message);
        if (done) done(true);
      }
    );
  } catch (_e) {
    if (done) done(false);
  }
}

function insertCosmeticCssIntoTab(tabId, cssText, done) {
  try {
    if (!chrome.scripting || typeof chrome.scripting.insertCSS !== "function") return done && done(false);
    if (!cssText) return done && done(true);
    chrome.scripting.insertCSS(
      {
        target: { tabId, allFrames: true },
        css: cssText,
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err && err.message) console.warn("[focus-blocker] insertCSS:", err.message);
        if (done) done(true);
      }
    );
  } catch (_e) {
    if (done) done(false);
  }
}

/** In-memory fallback when `chrome.storage.session` is unavailable. */
let tabStatMapFallback = {};

function normalizeStatHost(raw) {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s || s.length > 253) return "";
  return s;
}

function sanitizeContentDeltas(obj) {
  const keys = ["focus", "fpSpoof", "netJs", "device", "ds"];
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const n = Number(obj[k]);
    if (Number.isFinite(n) && n > 0) out[k] = Math.min(Math.floor(n), 100000);
  }
  return out;
}

const BREAKDOWN_TOP_KEYS = new Set(["focus", "fpSpoof", "netJs", "device", "ds", "dnrBlock", "dnrModify"]);

/**
 * @param {unknown} raw
 * @returns {Record<string, Record<string, number>>}
 */
function sanitizeBreakdown(raw) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const cats = Object.keys(raw);
  for (let ci = 0; ci < cats.length; ci++) {
    const cat = cats[ci];
    if (!BREAKDOWN_TOP_KEYS.has(cat)) continue;
    const subObj = raw[cat];
    if (!subObj || typeof subObj !== "object" || Array.isArray(subObj)) continue;
    /** @type {Record<string, number>} */
    const inner = {};
    const sks = Object.keys(subObj);
    const limit = Math.min(sks.length, 100);
    for (let si = 0; si < limit; si++) {
      const skRaw = sks[si];
      const safeSk = String(skRaw || "")
        .trim()
        .slice(0, 96)
        .replace(/[^\w.\-]/g, "_");
      if (!safeSk) continue;
      const n = Number(subObj[skRaw]);
      if (!Number.isFinite(n) || n <= 0) continue;
      inner[safeSk] = Math.min(Math.floor(n), 100000);
    }
    if (Object.keys(inner).length) out[cat] = inner;
  }
  return out;
}

/**
 * @param {Record<string, Record<string, number>> | null | undefined} prev
 * @param {Record<string, Record<string, number>> | null | undefined} inc
 */
function mergeBreakdown(prev, inc) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {};
  const cats = new Set([...Object.keys(prev || {}), ...Object.keys(inc || {})]);
  cats.forEach((cat) => {
    const pSub = prev && prev[cat] && typeof prev[cat] === "object" ? prev[cat] : {};
    const iSub = inc && inc[cat] && typeof inc[cat] === "object" ? inc[cat] : {};
    const subs = new Set([...Object.keys(pSub), ...Object.keys(iSub)]);
    /** @type {Record<string, number>} */
    const mergedSub = {};
    subs.forEach((sk) => {
      const base = typeof pSub[sk] === "number" ? pSub[sk] : 0;
      const add = typeof iSub[sk] === "number" ? iSub[sk] : 0;
      const sum = base + (Number.isFinite(add) && add > 0 ? Math.floor(add) : 0);
      if (sum > 0) mergedSub[sk] = Math.min(sum, 100000000);
    });
    if (Object.keys(mergedSub).length) out[cat] = mergedSub;
  });
  return out;
}

/** @param {StatsBucket | null | undefined} prev */
/** @param {Record<string, number>} deltas */
function mergeIntoBucket(prev, deltas) {
  /** @type {StatsBucket} */
  const out = {};
  for (let i = 0; i < STATS_TAB_FIELDS.length; i++) {
    const k = STATS_TAB_FIELDS[i];
    const base = prev && typeof prev[k] === "number" ? prev[k] : 0;
    const add = deltas && typeof deltas[k] === "number" ? deltas[k] : 0;
    const sum = base + (Number.isFinite(add) && add > 0 ? Math.floor(add) : 0);
    if (sum > 0) out[k] = sum;
  }
  return out;
}

/** @param {StatsBucket | null | undefined} b */
function bucketTotal(b) {
  if (!b || typeof b !== "object") return 0;
  let t = 0;
  for (let i = 0; i < STATS_TAB_FIELDS.length; i++) {
    t += b[STATS_TAB_FIELDS[i]] || 0;
  }
  return t;
}

function readTabStatMap(cb) {
  try {
    if (!chrome.storage || !chrome.storage.session) return cb(tabStatMapFallback || {});
    chrome.storage.session.get(SESSION_TAB_STATS_KEY, (data) => {
      void chrome.runtime.lastError;
      const raw = data && data[SESSION_TAB_STATS_KEY];
      const map = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      cb(map);
    });
  } catch (e) {
    cb(tabStatMapFallback || {});
  }
}

function writeTabStatMap(map, cb) {
  try {
    if (!chrome.storage || !chrome.storage.session) {
      tabStatMapFallback = map && typeof map === "object" ? map : {};
      if (cb) cb();
      return;
    }
    chrome.storage.session.set({ [SESSION_TAB_STATS_KEY]: map }, () => {
      void chrome.runtime.lastError;
      if (cb) cb();
    });
  } catch (e) {
    tabStatMapFallback = map && typeof map === "object" ? map : {};
    if (cb) cb();
  }
}

/** @param {Record<string, unknown>} byHost */
function trimStatsByHost(byHost) {
  const keys = Object.keys(byHost);
  if (keys.length <= STATS_MAX_HOSTS) return byHost;
  const sorted = keys
    .map((k) => {
      const row = byHost[k];
      const t = row && typeof row === "object" && typeof row.updatedAt === "number" ? row.updatedAt : 0;
      return { k, t };
    })
    .sort((a, b) => a.t - b.t);
  /** @type {Record<string, unknown>} */
  const next = { ...byHost };
  let excess = keys.length - STATS_MAX_HOSTS;
  for (let i = 0; i < sorted.length && excess > 0; i++) {
    delete next[sorted[i].k];
    excess--;
  }
  return next;
}

function persistHostStats(hostRaw, deltas, breakdownInc, done) {
  const host = normalizeStatHost(hostRaw);
  const hasDeltas = deltas && typeof deltas === "object" && Object.keys(deltas).length > 0;
  const hasBk = breakdownInc && typeof breakdownInc === "object" && Object.keys(breakdownInc).length > 0;
  if (!host || (!hasDeltas && !hasBk)) {
    if (done) done();
    return;
  }
  const storage = getStorageArea();
  storage.get([LOCAL_STATS_BY_HOST_KEY], (r) => {
    void chrome.runtime.lastError;
    const raw = r && r[LOCAL_STATS_BY_HOST_KEY];
    const byHost = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
    const prevRowFull = byHost[host] && typeof byHost[host] === "object" ? /** @type {Record<string, unknown>} */ (byHost[host]) : {};
    const prevBreakdown =
      prevRowFull.breakdown && typeof prevRowFull.breakdown === "object" && !Array.isArray(prevRowFull.breakdown)
        ? /** @type {Record<string, Record<string, number>>} */ (prevRowFull.breakdown)
        : {};
    const prevRaw = { ...prevRowFull };
    delete prevRaw.updatedAt;
    delete prevRaw.breakdown;
    const merged = mergeIntoBucket(prevRaw, hasDeltas ? deltas : {});
    merged.updatedAt = Date.now();
    merged.breakdown = mergeBreakdown(prevBreakdown, hasBk ? breakdownInc : {});
    byHost[host] = merged;
    const trimmed = trimStatsByHost(byHost);
    storage.set({ [LOCAL_STATS_BY_HOST_KEY]: trimmed }, () => {
      void chrome.runtime.lastError;
      if (done) done();
    });
  });
}

function updateBadgeForActiveTab() {
  try {
    if (!chrome.tabs || !chrome.tabs.query || !chrome.action) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      void chrome.runtime.lastError;
      const tid = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      if (tid == null) {
        chrome.action.setBadgeText({ text: "" });
        return;
      }
      readTabStatMap((map) => {
        const b = map[String(tid)] || map[tid];
        const total = bucketTotal(b && typeof b === "object" ? b : {});
        try {
          chrome.action.setBadgeBackgroundColor({ color: "#3949ab" });
        } catch (_e) {}
        if (!total) chrome.action.setBadgeText({ text: "" });
        else if (total >= 100) chrome.action.setBadgeText({ text: "99+" });
        else chrome.action.setBadgeText({ text: String(total) });
      });
    });
  } catch (_e) {}
}

/** @returns {"dnrBlock" | "dnrModify" | null} */
function classifyDnrRuleId(ruleId) {
  const id = typeof ruleId === "number" ? ruleId : Number(ruleId);
  if (!Number.isFinite(id)) return null;
  if (id === DNR_UA_RULE_ID || id === DNR_ACCEPT_LANGUAGE_RULE_ID) return "dnrModify";
  if (id >= NETWORK_RULE_SLOT_START && id < NETWORK_RULE_SLOT_START + NETWORK_RULE_SLOTS) return "dnrBlock";
  if (id >= DS_RULE_SLOT_START && id < DS_RULE_SLOT_START + DS_RULE_SLOTS) return "dnrBlock";
  if (id >= PP_RULE_SLOT_START && id < PP_RULE_SLOT_START + PP_RULE_SLOTS) return "dnrBlock";
  return null;
}

/** @param {number | null} ruleId */
/** @param {"dnrBlock" | "dnrModify"} cat */
function dnrBreakdownSubKey(ruleId, cat) {
  const id = typeof ruleId === "number" ? ruleId : Number(ruleId);
  if (!Number.isFinite(id)) return "unknown_rule";
  if (id === DNR_UA_RULE_ID) return "headers_user_agent_sec_ch";
  if (id === DNR_ACCEPT_LANGUAGE_RULE_ID) return "headers_accept_language";
  if (cat === "dnrBlock" && id >= NETWORK_RULE_SLOT_START && id < NETWORK_RULE_SLOT_START + NETWORK_RULE_SLOTS) {
    return `network_regex_slot_${id - NETWORK_RULE_SLOT_START}`;
  }
  if (cat === "dnrBlock" && id >= DS_RULE_SLOT_START && id < DS_RULE_SLOT_START + DS_RULE_SLOTS) {
    return `ds_telemetry_slot_${id - DS_RULE_SLOT_START}`;
  }
  if (cat === "dnrBlock" && id >= PP_RULE_SLOT_START && id < PP_RULE_SLOT_START + PP_RULE_SLOTS) {
    return `privacy_pack_slot_${id - PP_RULE_SLOT_START}`;
  }
  return `rule_${id}`;
}

function applyTabStatDelta(tabId, deltas, hostRaw, breakdownInc, done) {
  readTabStatMap((map) => {
    const key = String(tabId);
    const prev = map[key] || {};
    const deltaObj = deltas && typeof deltas === "object" && Object.keys(deltas).length ? deltas : {};
    const merged = mergeIntoBucket(prev, deltaObj);
    const next = { ...map, [key]: merged };
    writeTabStatMap(next, () => {
      const bk = breakdownInc && typeof breakdownInc === "object" ? breakdownInc : {};
      persistHostStats(hostRaw, deltaObj, bk, () => {
        updateBadgeForActiveTab();
        if (done) done();
      });
    });
  });
}

try {
  if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
      try {
        const ruleId = info && info.rule && typeof info.rule.id === "number" ? info.rule.id : null;
        const tabId = info && info.request && typeof info.request.tabId === "number" ? info.request.tabId : null;
        const cat = classifyDnrRuleId(ruleId);
        if (!cat || tabId == null || tabId < 0 || ruleId == null) return;
        const deltas = /** @type {Record<string, number>} */ ({ [cat]: 1 });
        const subKey = dnrBreakdownSubKey(ruleId, cat);
        const breakdownInc = /** @type {Record<string, Record<string, number>>} */ ({ [cat]: { [subKey]: 1 } });
        chrome.tabs.get(tabId, (tab) => {
          void chrome.runtime.lastError;
          let host = "";
          try {
            if (tab && tab.url) host = new URL(tab.url).hostname || "";
          } catch (_e) {}
          applyTabStatDelta(tabId, deltas, host, breakdownInc, undefined);
        });
      } catch (_e) {}
    });
  }
} catch (_e) {}

chrome.tabs.onRemoved.addListener((tabId) => {
  readPausedTabMap((map) => {
    const next = { ...map };
    delete next[String(tabId)];
    delete next[tabId];
    if (Object.keys(next).length === Object.keys(map).length) return;
    writePausedTabMap(next);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  readDsCosmeticCssMap((map) => {
    const next = { ...map };
    delete next[String(tabId)];
    delete next[tabId];
    if (Object.keys(next).length === Object.keys(map).length) return;
    writeDsCosmeticCssMap(next);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  readTabStatMap((map) => {
    const next = { ...map };
    delete next[String(tabId)];
    delete next[tabId];
    if (Object.keys(next).length === Object.keys(map).length) return;
    writeTabStatMap(next, updateBadgeForActiveTab);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    readDsCosmeticCssMap((map) => {
      if (!map[String(tabId)] && !map[tabId]) return;
      const next = { ...map };
      delete next[String(tabId)];
      delete next[tabId];
      writeDsCosmeticCssMap(next);
    });
  }

  if (changeInfo.url === undefined) return;
  readTabStatMap((map) => {
    const next = { ...map };
    delete next[String(tabId)];
    delete next[tabId];
    if (Object.keys(next).length !== Object.keys(map).length) {
      writeTabStatMap(next, updateBadgeForActiveTab);
    }
  });
  readPausedTabMap((map) => {
    if (!map[String(tabId)] && !map[tabId]) return;
    const next = { ...map };
    delete next[String(tabId)];
    delete next[tabId];
    writePausedTabMap(next);
  });
});

chrome.tabs.onActivated.addListener(() => updateBadgeForActiveTab());

chrome.windows.onFocusChanged.addListener(() => updateBadgeForActiveTab());

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "FB_STATS_REPORT") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) {
      sendResponse({ ok: false });
      return;
    }
    const deltas = sanitizeContentDeltas(msg.deltas);
    const breakdown = sanitizeBreakdown(msg.breakdown);
    if (!Object.keys(deltas).length && !Object.keys(breakdown).length) {
      sendResponse({ ok: true });
      return;
    }
    const topHost = normalizeStatHost(typeof msg.topHost === "string" ? msg.topHost : "");
    applyTabStatDelta(tabId, deltas, topHost, breakdown, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "FB_DS_BLOCK_SET_COSMETIC_CSS") {
    const tabId = sender.tab && sender.tab.id;
    const frameId = sender && typeof sender.frameId === "number" ? sender.frameId : 0;
    if (tabId == null || frameId !== 0) {
      sendResponse({ ok: false });
      return;
    }

    const enabled = !!msg.enabled;
    const cssText = typeof msg.cssText === "string" ? msg.cssText : "";

    readDsCosmeticCssMap((map) => {
      const keyA = String(tabId);
      const prevCss = typeof map[keyA] === "string" ? map[keyA] : typeof map[tabId] === "string" ? map[tabId] : "";

      function finish(nextCss) {
        const next = { ...map };
        if (nextCss) next[keyA] = nextCss;
        else {
          delete next[keyA];
          delete next[tabId];
        }
        writeDsCosmeticCssMap(next, () => sendResponse({ ok: true }));
      }

      if (!enabled || !cssText) {
        if (!prevCss) return finish("");
        return removeCosmeticCssFromTab(tabId, prevCss, () => finish(""));
      }

      if (prevCss && prevCss !== cssText) {
        return removeCosmeticCssFromTab(tabId, prevCss, () => {
          insertCosmeticCssIntoTab(tabId, cssText, () => finish(cssText));
        });
      }

      if (!prevCss) {
        return insertCosmeticCssIntoTab(tabId, cssText, () => finish(cssText));
      }

      // insertCSS does not survive navigations; prevCss may match but the document is new.
      return removeCosmeticCssFromTab(tabId, prevCss, () => {
        insertCosmeticCssIntoTab(tabId, cssText, () => finish(cssText));
      });
    });

    return true;
  }

  if (msg.type === "FB_IS_TAB_PAUSED") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) {
      sendResponse({ paused: false });
      return;
    }
    readPausedTabMap((map) => {
      sendResponse({ paused: !!(map[String(tabId)] || map[tabId]) });
    });
    return true;
  }

  if (msg.type === "FB_POPUP_GET_STATE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      let hostname = "";
      let tabUrl = "";
      let injectable = false;
      if (tab && tab.url) {
        tabUrl = tab.url;
        try {
          const u = new URL(tab.url);
          hostname = u.hostname || "";
          injectable = u.protocol === "http:" || u.protocol === "https:";
        } catch (e) {
          hostname = "";
        }
      }
      const tabId = tab && tab.id != null ? tab.id : null;
      readPausedTabMap((pauseMap) => {
        const paused = tabId != null && !!(pauseMap[String(tabId)] || pauseMap[tabId]);
        const keys = [
          "excludedDomains",
          "extensionGloballyEnabled",
          "focusBlockingEnabled",
          "optionsReduceAnimations",
          ...SECURITY_STORAGE_KEYS,
          ...NETWORK_STORAGE_KEYS,
        ];
        const storage = (chrome.storage && chrome.storage.local) || chrome.storage.sync;
        storage.get(keys, (result) => {
          void chrome.runtime.lastError;
          const excludedList = normalizeExcludedDomainsListFromStorage(
            Array.isArray(result.excludedDomains) ? result.excludedDomains : []
          );
          const alreadyExcluded = !!(hostname && excludedList.some((p) => patternMatchesHost(p, hostname)));
          sendResponse({
            tabUrl,
            hostname,
            injectable,
            paused,
            excludedDomains: excludedList,
            extensionGloballyEnabled: result.extensionGloballyEnabled !== false,
            focusBlockingEnabled: result.focusBlockingEnabled !== false,
            optionsReduceAnimations: !!result.optionsReduceAnimations,
            securityEnabled: !!mergeSecurityFromStorage(result || {}).securityEnabled,
            networkSecurityEnabled: !!mergeNetworkFromStorage(result || {}).networkSecurityEnabled,
            alreadyExcluded,
          });
        });
      });
    });
    return true;
  }

  if (msg.type === "FB_POPUP_SET_TAB_PAUSE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id;
      if (tabId == null) {
        sendResponse({ ok: false });
        return;
      }
      readPausedTabMap((map) => {
        const next = { ...map };
        if (msg.paused) next[String(tabId)] = true;
        else {
          delete next[String(tabId)];
          delete next[tabId];
        }
        writePausedTabMap(next, () => sendResponse({ ok: true }));
      });
    });
    return true;
  }

  if (msg.type === "FB_POPUP_SET_STORAGE_BOOL") {
    const key = typeof msg.key === "string" ? msg.key : "";
    if (key !== "extensionGloballyEnabled" && key !== "focusBlockingEnabled" && key !== "securityEnabled" && key !== "networkSecurityEnabled") {
      sendResponse({ ok: false });
      return;
    }
    const storage = (chrome.storage && chrome.storage.local) || chrome.storage.sync;
    storage.set({ [key]: !!msg.value }, () => {
      const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
      sendResponse({ ok: !err });
    });
    return true;
  }

  if (msg.type === "FB_POPUP_ADD_HOST_EXCLUSION") {
    const hostRaw = typeof msg.hostname === "string" ? msg.hostname.trim().toLowerCase() : "";
    const canonicalHost = normalizeExcludedDomainStorageEntry(hostRaw) || hostRaw;
    if (!canonicalHost) {
      sendResponse({ ok: false, reason: "empty" });
      return;
    }
    const storage = (chrome.storage && chrome.storage.local) || chrome.storage.sync;
    storage.get(["excludedDomains"], (r) => {
      void chrome.runtime.lastError;
      const list = normalizeExcludedDomainsListFromStorage(
        Array.isArray(r.excludedDomains) ? r.excludedDomains : []
      );
      const exists = list.some((p) => patternMatchesHost(p, canonicalHost));
      if (exists) {
        sendResponse({ ok: true, added: false });
        return;
      }
      list.push(canonicalHost);
      storage.set({ excludedDomains: list }, () => {
        void chrome.runtime.lastError;
        sendResponse({ ok: true, added: true });
      });
    });
    return true;
  }
});

reloadFromStorageSnapshot();
updateBadgeForActiveTab();
