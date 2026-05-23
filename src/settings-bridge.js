// This script runs in the content script context and can access chrome.storage
// It bridges the settings between chrome.storage and the MAIN world content script
// Depends on src/security-defaults.js (loaded first in manifest).

function fbSharedRoot() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.__focusBlockerShared) {
      return globalThis.__focusBlockerShared;
    }
  } catch (_e) {}
  try {
    if (typeof window !== "undefined" && window.__focusBlockerShared) {
      return window.__focusBlockerShared;
    }
  } catch (_e2) {}
  return null;
}

/**
 * Host match — works when sibling scripts don't share lexical scope with security-defaults.js.
 * Must stay in sync with patternMatchesHost in security-defaults.js.
 */
function fbPatternMatchesHost(pattern, host) {
  const shr = fbSharedRoot();
  if (shr && typeof shr.patternMatchesHost === "function") return shr.patternMatchesHost(pattern, host);

  let p = String(pattern ?? "").trim().toLowerCase();
  if (!p || p === "*") return false;

  try {
    if (p.includes("://")) {
      p = new URL(p).hostname.toLowerCase();
    }
  } catch (_e) {
    return false;
  }

  if (!p || p === "*") return false;

  const h = String(host ?? "").trim().toLowerCase();
  if (!h) return false;

  if (p.includes("*")) {
    if (p.startsWith("*.") && p.indexOf("*", 2) === -1) {
      let root = p.slice(2).replace(/^\.+/, "").replace(/\.+$/, "");
      if (root && !root.includes("*")) {
        return h === root || h.endsWith("." + root);
      }
    }

    const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(h);
  }

  p = p.replace(/^\.+/, "").replace(/\.+$/, "");
  if (!p) return false;

  return h === p || h.endsWith("." + p);
}

function fbMergeSecurityFromStorage(result) {
  const s = fbSharedRoot();
  if (s && typeof s.mergeSecurityFromStorage === "function") return s.mergeSecurityFromStorage(result || {});
  return { securityEnabled: false };
}

function fbMergeNetworkFromStorage(result) {
  const s = fbSharedRoot();
  if (s && typeof s.mergeNetworkFromStorage === "function") return s.mergeNetworkFromStorage(result || {});
  return { networkSecurityEnabled: false };
}

function fbMergeDsBlockFromStorage(result) {
  const s = fbSharedRoot();
  if (s && typeof s.mergeDsBlockFromStorage === "function") return s.mergeDsBlockFromStorage(result || {});
  return { dsBlockEnabled: false };
}

function fbMergeThreatShieldFromStorage(result) {
  const s = fbSharedRoot();
  if (s && typeof s.mergeThreatShieldFromStorage === "function") return s.mergeThreatShieldFromStorage(result || {});
  return { threatShieldEnabled: false };
}

function fbThreatShieldBuiltinsPayload() {
  const s = fbSharedRoot();
  const patterns = s && Array.isArray(s.THREAT_SHIELD_BUILTIN_HOST_PATTERNS) ? s.THREAT_SHIELD_BUILTIN_HOST_PATTERNS : [];
  const tails = s && Array.isArray(s.THREAT_SHIELD_STACKED_TLD_TAIL) ? s.THREAT_SHIELD_STACKED_TLD_TAIL : [];
  return { builtinHostPatterns: patterns, stackedTldTails: tails };
}

function fbMergeDeviceSecurityFromStorage(result) {
  const s = fbSharedRoot();
  if (s && typeof s.mergeDeviceSecurityFromStorage === "function") {
    return s.mergeDeviceSecurityFromStorage(result || {});
  }
  return { deviceSecurityEnabled: false };
}

function fbDsBuiltinHideSelectors() {
  const s = fbSharedRoot();
  const arr = s && s.DS_BLOCK_BUILTIN_HIDE_SELECTORS;
  return Array.isArray(arr) ? arr : [];
}

function fbConcatModuleStorageKeys() {
  const s = fbSharedRoot();
  function take(name) {
    const arr = s && s[name];
    return Array.isArray(arr) ? arr : [];
  }
  return [
    ...take("SECURITY_STORAGE_KEYS"),
    ...take("NETWORK_STORAGE_KEYS"),
    ...take("DS_BLOCK_STORAGE_KEYS"),
    ...take("DEVICE_SECURITY_STORAGE_KEYS"),
    ...take("THREAT_SHIELD_STORAGE_KEYS"),
  ];
}

const DEFAULT_BLOCKED_EVENTS = [
  "visibilitychange",
  "webkitvisibilitychange",
  "mozvisibilitychange",
  "msvisibilitychange",
  "blur",
  "focus",
  "focusin",
  "focusout",
];

const DEFAULT_EXCLUDED_DOMAINS = [];

/** Совпадает с ключом в background.js для паузы вкладки. */
const SESSION_PAUSE_KEY = "focusBlockerPausedTabIds";

const FB_REQUEST_SETTINGS_TYPE = "FOCUS_BLOCKER_REQUEST_SETTINGS";
const FB_SETTINGS_ACK_TYPE = "FOCUS_BLOCKER_SETTINGS_ACK";
const FB_REQUEST_SETTINGS_EVENT = "FOCUS_BLOCKER_REQUEST_SETTINGS_EVENT";
const FB_SETTINGS_ACK_EVENT = "FOCUS_BLOCKER_SETTINGS_ACK_EVENT";
const FB_FOCUS_CACHE_KEY = "__focus_blocker_focus_cache_v1";

let tabPaused = false;

function isExcluded(excludedDomains) {
  const currentHost = window.location.hostname;
  return (excludedDomains || []).some((pattern) => fbPatternMatchesHost(pattern, currentHost));
}

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
  } catch (e) {
    done();
  }
}

function postFocusSettings(blockedEvents, isEnabled) {
  const payload = {
    type: "FOCUS_BLOCKER_SETTINGS",
    blockedEvents,
    isEnabled: !!isEnabled,
  };

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  // Cache last-known focus config for MAIN-world early startup (best-effort).
  try {
    localStorage.setItem(
      FB_FOCUS_CACHE_KEY,
      JSON.stringify({
        v: 1,
        blockedEvents: Array.isArray(blockedEvents) ? blockedEvents : DEFAULT_BLOCKED_EVENTS,
        isEnabled: !!isEnabled,
        ts: Date.now(),
      })
    );
  } catch (_e) {}
}

function postSecuritySettings(result, pageAllowsModules, excludedDomains) {
  const merged = fbMergeSecurityFromStorage(result || {});
  const isActive = !!(merged.securityEnabled && pageAllowsModules);

  let workerScriptUrl = "";
  try {
    if (chrome.runtime && typeof chrome.runtime.getURL === "function") {
      workerScriptUrl = chrome.runtime.getURL("src/security-worker.js");
    }
  } catch (e) {
    workerScriptUrl = "";
  }

  const payload = {
    type: "FOCUS_BLOCKER_SECURITY_SETTINGS",
    isActive,
    pageAllowed: !!pageAllowsModules,
    security: merged,
    workerScriptUrl,
  };

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_SECURITY_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  // Cache last-known security config for MAIN-world early startup (best-effort).
  try {
    localStorage.setItem(
      "__focus_blocker_security_cache_v1",
      JSON.stringify({
        v: 1,
        isActive,
        excludedDomains: Array.isArray(excludedDomains) ? excludedDomains : [],
        security: merged,
        workerScriptUrl,
        ts: Date.now(),
      })
    );
  } catch (e) {}
}

function postNetworkSettings(result, pageAllowsModules, excludedDomains) {
  const merged = fbMergeNetworkFromStorage(result || {});
  const isActive = !!(merged.networkSecurityEnabled && pageAllowsModules);

  const payload = {
    type: "FOCUS_BLOCKER_NETWORK_SETTINGS",
    isActive,
    pageAllowed: !!pageAllowsModules,
    network: merged,
  };

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_NETWORK_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  try {
    localStorage.setItem(
      "__focus_blocker_network_cache_v1",
      JSON.stringify({
        v: 1,
        isActive,
        pageAllowed: !!pageAllowsModules,
        network: merged,
        ts: Date.now(),
      })
    );
  } catch (e) {}
}

function postDsBlockSettings(result, pageAllowsModules) {
  const merged = fbMergeDsBlockFromStorage(result || {});
  const isActive = !!(merged.dsBlockEnabled && pageAllowsModules);

  const payload = {
    type: "FOCUS_BLOCKER_DS_BLOCK_SETTINGS",
    isActive,
    pageAllowed: !!pageAllowsModules,
    dsBlock: merged,
  };

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_DS_BLOCK_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  try {
    localStorage.setItem(
      "__focus_blocker_ds_block_cache_v1",
      JSON.stringify({
        v: 1,
        isActive,
        pageAllowed: !!pageAllowsModules,
        dsBlock: merged,
        ts: Date.now(),
      })
    );
  } catch (e) {}

  // Cosmetic hiding must not inject <style> into the page DOM on strict CSP sites.
  // Apply it via MV3 chrome.scripting (service worker) instead.
  try {
    let isTop = true;
    try {
      isTop = window.top === window;
    } catch (_e) {
      isTop = true;
    }
    if (isTop && chrome && chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
      const builtins = fbDsBuiltinHideSelectors();
      const user = Array.isArray(merged.dsBlockHideSelectors) ? merged.dsBlockHideSelectors : [];
      const selectors = [...builtins, ...user].map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);

      const shouldApply = !!(isActive && merged.dsBlockEnabled && merged.dsBlockCosmeticEnabled && selectors.length);
      const cssText = shouldApply ? selectors.map((sel) => `${sel}{display:none !important;}`).join("\n") : "";

      chrome.runtime.sendMessage(
        {
          type: "FB_DS_BLOCK_SET_COSMETIC_CSS",
          enabled: shouldApply && !!cssText,
          cssText,
        },
        () => void chrome.runtime.lastError
      );
    }
  } catch (_e) {}
}

function postThreatShieldSettings(result, pageAllowsModules) {
  const merged = fbMergeThreatShieldFromStorage(result || {});
  const builtins = fbThreatShieldBuiltinsPayload();

  const isActive = !!(merged.threatShieldEnabled && pageAllowsModules);

  const payload = {
    type: "FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS",
    isActive,
    pageAllowed: !!pageAllowsModules,
    threatShield: merged,
    threatBuiltinHostPatterns: builtins.builtinHostPatterns,
    threatStackedTldTails: builtins.stackedTldTails,
  };

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS_EVENT", { detail: payload }));
  } catch (_e) {}

  try {
    localStorage.setItem(
      "__focus_blocker_threat_shield_cache_v1",
      JSON.stringify({
        v: 1,
        isActive,
        pageAllowed: !!pageAllowsModules,
        threatShield: merged,
        threatBuiltinHostPatterns: builtins.builtinHostPatterns,
        threatStackedTldTails: builtins.stackedTldTails,
        ts: Date.now(),
      })
    );
  } catch (_e) {}
}

function postDeviceSecuritySettings(result, pageAllowsModules) {
  const merged = fbMergeDeviceSecurityFromStorage(result || {});
  const isActive = !!(merged.deviceSecurityEnabled && pageAllowsModules);

  const payload = {
    type: "FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS",
    isActive,
    pageAllowed: !!pageAllowsModules,
    deviceSecurity: merged,
  };

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  try {
    localStorage.setItem(
      "__focus_blocker_device_security_cache_v1",
      JSON.stringify({
        v: 1,
        isActive,
        pageAllowed: !!pageAllowsModules,
        deviceSecurity: merged,
        ts: Date.now(),
      })
    );
  } catch (_e) {}
}

function broadcastAll(result) {
  const blockedEvents = result.blockedEvents || DEFAULT_BLOCKED_EVENTS;
  const rawExcluded = Array.isArray(result.excludedDomains) ? result.excludedDomains : DEFAULT_EXCLUDED_DOMAINS;
  const excludedDomains = normalizeExcludedDomainsListFromStorage(rawExcluded);
  const globalOn = result.extensionGloballyEnabled !== false;
  const focusModuleOn = result.focusBlockingEnabled !== false;
  const excluded = isExcluded(excludedDomains);
  const siteAllows = globalOn && !excluded && !tabPaused;

  postFocusSettings(blockedEvents, siteAllows && focusModuleOn);
  postSecuritySettings(result, siteAllows, excludedDomains);
  postNetworkSettings(result, siteAllows, excludedDomains);
  postDsBlockSettings(result, siteAllows);
  postThreatShieldSettings(result, siteAllows);
  postDeviceSecuritySettings(result, siteAllows);
}

const ALL_KEYS = [
  "blockedEvents",
  "excludedDomains",
  "extensionGloballyEnabled",
  "focusBlockingEnabled",
  ...fbConcatModuleStorageKeys(),
];

let lastResultSnapshot = null;

function refreshStorageAndBroadcastFast() {
  // 1) Fast path: broadcast immediately from storage snapshot (tabPaused default is false).
  //    Avoid waiting for the MV3 background service worker wake-up on every reload.
  getStorageArea().get(ALL_KEYS, (result) => {
    lastResultSnapshot = result && typeof result === "object" ? result : {};
    broadcastAll(lastResultSnapshot);
  });

  // 2) In parallel, resolve per-tab pause state; if it changes, re-broadcast using the same snapshot.
  chrome.runtime.sendMessage({ type: "FB_IS_TAB_PAUSED" }, (resp) => {
    const paused = chrome.runtime.lastError ? false : !!(resp && resp.paused);
    if (paused === tabPaused) return;
    tabPaused = paused;
    if (lastResultSnapshot) broadcastAll(lastResultSnapshot);
  });
}

let fbFocusAcked = false;
let fbBurstTimers = [];
let fbLastRequestTs = 0;

function fbMarkAcked() {
  fbFocusAcked = true;
  if (fbBurstTimers.length) {
    fbBurstTimers.forEach((t) => clearTimeout(t));
    fbBurstTimers = [];
  }
}

function fbScheduleBurstRebroadcast() {
  if (fbFocusAcked || fbBurstTimers.length) return;
  const delays = [0, 50, 250, 1000, 2500];
  delays.forEach((ms) => {
    fbBurstTimers.push(
      setTimeout(() => {
        if (fbFocusAcked) return;
        refreshStorageAndBroadcastFast();
      }, ms)
    );
  });
}

function fbHandleSettingsRequest() {
  const now = Date.now();
  if (now - fbLastRequestTs < 40) return; // simple throttle against loops
  fbLastRequestTs = now;
  refreshStorageAndBroadcastFast();
  fbScheduleBurstRebroadcast();
}

// MAIN-world scripts can start after our initial postMessage.
// Let them request a resend to avoid missing the first broadcast.
window.addEventListener(
  "message",
  (event) => {
    if (event.source !== window || !event.data) return;
    const t = event.data.type;
    if (t === FB_REQUEST_SETTINGS_TYPE) return fbHandleSettingsRequest();
    if (t === FB_SETTINGS_ACK_TYPE) return fbMarkAcked();
  },
  true
);

try {
  window.addEventListener(FB_REQUEST_SETTINGS_EVENT, () => fbHandleSettingsRequest(), true);
  window.addEventListener(FB_SETTINGS_ACK_EVENT, () => fbMarkAcked(), true);
} catch (_e) {}

maybeMigrateSyncToLocal(ALL_KEYS, () => {
  refreshStorageAndBroadcastFast();
  fbScheduleBurstRebroadcast();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  // Some Chromium forks can fall back to `sync`; keep bridge reactive in both cases.
  if (namespace !== "local" && namespace !== "sync") return;
  if (!changes || !Object.keys(changes).length) return;
  refreshStorageAndBroadcastFast();
});

try {
  if (chrome.storage && chrome.storage.session && chrome.storage.session.onChanged) {
    chrome.storage.session.onChanged.addListener((changes, areaName) => {
      if (areaName !== "session") return;
      if (!changes || !changes[SESSION_PAUSE_KEY]) return;
      refreshStorageAndBroadcastFast();
    });
  }
} catch (e) {}
