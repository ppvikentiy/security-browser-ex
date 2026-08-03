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

/**
 * Normalizes excluded-domain list from storage — works when sibling scripts don't share
 * lexical scope with security-defaults.js (see __focusBlockerShared in security-defaults.js).
 */
function fbNormalizeExcludedDomainsListFromStorage(rawList) {
  const shr = fbSharedRoot();
  if (shr && typeof shr.normalizeExcludedDomainsListFromStorage === "function") {
    return shr.normalizeExcludedDomainsListFromStorage(rawList);
  }
  try {
    if (typeof normalizeExcludedDomainsListFromStorage === "function") {
      return normalizeExcludedDomainsListFromStorage(rawList);
    }
  } catch (_e) {}
  return [];
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

/** Доп. события при focusBlockingStrict (merge в effective blockedEvents, не в DEFAULT). */
const STRICT_EXTRA_EVENTS = ["freeze", "resume", "pagehide", "pageshow"];

function normalizeBlockedEventsListFromRaw(raw) {
  const list = Array.isArray(raw) ? raw : DEFAULT_BLOCKED_EVENTS;
  const out = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const s = typeof list[i] === "string" ? list[i].trim().toLowerCase() : "";
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.length ? out : DEFAULT_BLOCKED_EVENTS.slice();
}

function mergeEffectiveBlockedEvents(rawUserList, strictOn) {
  const base = normalizeBlockedEventsListFromRaw(rawUserList);
  if (!strictOn) return base;
  const seen = new Set(base);
  const out = base.slice();
  for (let i = 0; i < STRICT_EXTRA_EVENTS.length; i++) {
    const ev = STRICT_EXTRA_EVENTS[i];
    if (!seen.has(ev)) {
      seen.add(ev);
      out.push(ev);
    }
  }
  return out;
}

const DEFAULT_EXCLUDED_DOMAINS = [];

/** Совпадает с ключом в background.js для паузы вкладки. */
const SESSION_PAUSE_KEY = "focusBlockerPausedTabIds";

const FB_REQUEST_SETTINGS_TYPE = "FOCUS_BLOCKER_REQUEST_SETTINGS";
const FB_SETTINGS_ACK_TYPE = "FOCUS_BLOCKER_SETTINGS_ACK";
const FB_REQUEST_SETTINGS_EVENT = "FOCUS_BLOCKER_REQUEST_SETTINGS_EVENT";
const FB_SETTINGS_ACK_EVENT = "FOCUS_BLOCKER_SETTINGS_ACK_EVENT";
const FB_FOCUS_CACHE_KEY = "__focus_blocker_focus_cache_v1";

// Per-load secret key for HMAC-signing the isolated → MAIN settings channel.
// Delivered out-of-band via a short-lived <html data-fb-k="..."> attribute that
// MAIN-world scripts read synchronously at document_start (before page scripts run).
// The key is NEVER placed inside broadcast messages, so a page that merely listens
// to settings traffic cannot learn it.
const FB_CHANNEL = (() => {
  try {
    if (typeof globalThis !== "undefined" && globalThis.__fbChannel) return globalThis.__fbChannel;
  } catch (_e) {}
  try {
    const el = document && document.documentElement;
    if (el && el.__fbChannelApi) return el.__fbChannelApi;
  } catch (_e) {}
  try {
    if (typeof Document !== "undefined" && Document.prototype && typeof Document.prototype.__fbChannelGet === "function") {
      return Document.prototype.__fbChannelGet();
    }
  } catch (_e) {}
  return null;
})();

const FB_CHANNEL_KEY = FB_CHANNEL ? FB_CHANNEL.randomHexKey(32) : "";

/** Monotonic per-load sequence so MAIN can reject replays/stale messages. */
let fbChannelSeq = 0;

let fbChannelKeyAttrRemoved = false;
let fbChannelKeyRemoveTimer = 0;
function fbSetChannelKeyAttr() {
  try {
    if (FB_CHANNEL_KEY && typeof document !== "undefined" && document.documentElement) {
      document.documentElement.setAttribute("data-fb-k", FB_CHANNEL_KEY);
    }
  } catch (_e) {}
}

function fbRemoveChannelKeyAttrOnce() {
  if (fbChannelKeyAttrRemoved) return;
  fbChannelKeyAttrRemoved = true;
  if (fbChannelKeyRemoveTimer) {
    try {
      clearTimeout(fbChannelKeyRemoveTimer);
    } catch (_e) {}
    fbChannelKeyRemoveTimer = 0;
  }
  try {
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.removeAttribute("data-fb-k");
    }
  } catch (_e) {}
}

/**
 * Keep data-fb-k until Focus ACK (or a safety timeout). MAIN modules that miss the
 * sync document_start read — e.g. Chromium forks that inject MAIN before isolated —
 * can still capture the key on the first signed broadcast. Removing immediately after
 * the first async storage.get left those modules with a permanent empty key.
 */
function fbScheduleChannelKeyRemoval(ms) {
  if (fbChannelKeyAttrRemoved) return;
  if (fbChannelKeyRemoveTimer) {
    try {
      clearTimeout(fbChannelKeyRemoveTimer);
    } catch (_e) {}
  }
  fbChannelKeyRemoveTimer = setTimeout(() => {
    fbChannelKeyRemoveTimer = 0;
    fbRemoveChannelKeyAttrOnce();
  }, ms);
}

/**
 * Stamps `seq` + HMAC `sig` onto an outgoing payload so MAIN can authenticate it.
 * Signs the stable serialization of the payload excluding the `sig` field itself.
 */
function fbSignPayload(payload) {
  payload.seq = ++fbChannelSeq;
  if (FB_CHANNEL && FB_CHANNEL_KEY) {
    try {
      payload.sig = FB_CHANNEL.hmacSha256Hex(FB_CHANNEL_KEY, FB_CHANNEL.stableStringify(payload, "sig"));
    } catch (_e) {
      payload.sig = "";
    }
  } else {
    payload.sig = "";
  }
  return payload;
}

// Expose key early. Cleanup is ACK-driven (or a 5s safety timeout) — see
// broadcastAll / fbMarkAcked. Do not assume MAIN always loads after isolated.
fbSetChannelKeyAttr();
fbScheduleChannelKeyRemoval(5000);

let tabPaused = false;
/** Set true when Focus MAIN acks a signed settings payload (see fbMarkAcked). */
let fbFocusAcked = false;

function isExcluded(excludedDomains) {
  const currentHost = window.location.hostname;
  return (excludedDomains || []).some((pattern) => fbPatternMatchesHost(pattern, currentHost));
}

function getStorageArea() {
  // `sync` can be unavailable/limited in some Chromium forks; use `local` as the canonical store.
  try {
    const s = typeof chrome !== "undefined" ? chrome.storage : undefined;
    if (!s) return null;
    return s.local || s.sync || null;
  } catch (_e) {
    return null;
  }
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
  fbSignPayload(payload);

  // Always "*": same-window delivery; HMAC authenticates. location.origin silently
  // drops the message on opaque origins (sandboxed iframes, some about:blank, file://).
  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  // Boot hint for MAIN-world early startup (best-effort). Only the on/off flag is
  // cached: the page owns this storage, and the module rebuilds the event list from
  // its own defaults rather than trusting anything read back from here.
  try {
    localStorage.setItem(
      FB_FOCUS_CACHE_KEY,
      JSON.stringify({
        v: 1,
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
  fbSignPayload(payload);

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_SECURITY_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  // Cache last-known security config for MAIN-world early startup (best-effort).
  try {
    // Do NOT persist full security spoof config in page-localStorage to avoid leakage.
    localStorage.removeItem("__focus_blocker_security_cache_v1");
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
  fbSignPayload(payload);

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_NETWORK_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  // Network Security boots only from a signed payload; never persist config into
  // page-owned localStorage. Drop any entry left by an older version.
  try {
    localStorage.removeItem("__focus_blocker_network_cache_v1");
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
  fbSignPayload(payload);

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_DS_BLOCK_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  // Boot-hint cache for the MAIN-world module: booleans only. The page owns this
  // storage, so user lists must not be persisted here and the module treats the
  // entry as a hint that can only raise protection, never relax it.
  try {
    localStorage.setItem(
      "__focus_blocker_ds_block_cache_v1",
      JSON.stringify({
        v: 1,
        isActive,
        dsBlock: {
          dsBlockEnabled: !!merged.dsBlockEnabled,
          dsBlockBlockPopups: !!merged.dsBlockBlockPopups,
          dsBlockCosmeticEnabled: !!merged.dsBlockCosmeticEnabled,
          dsBlockTelemetryEnabled: !!merged.dsBlockTelemetryEnabled,
        },
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

  const langRaw = result && result.optionsUiLanguage;
  const uiLang = langRaw === "en" || langRaw === "uk" || langRaw === "ru" ? langRaw : "ru";

  const payload = {
    type: "FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS",
    isActive,
    pageAllowed: !!pageAllowsModules,
    threatShield: merged,
    threatBuiltinHostPatterns: builtins.builtinHostPatterns,
    threatStackedTldTails: builtins.stackedTldTails,
    optionsUiLanguage: uiLang,
  };
  fbSignPayload(payload);

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS_EVENT", { detail: payload }));
  } catch (_e) {}

  // Threat Shield boots only from a signed payload, so no cache is written. Drop
  // any entry left by an older version (or planted by the page).
  try {
    localStorage.removeItem("__focus_blocker_threat_shield_cache_v1");
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
  fbSignPayload(payload);

  window.postMessage(payload, "*");
  try {
    window.dispatchEvent(new CustomEvent("FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS_EVENT", { detail: payload }));
  } catch (e) {}

  // Device Security boots only from a signed payload; never persist config into
  // page-owned localStorage. Drop any entry left by an older version.
  try {
    localStorage.removeItem("__focus_blocker_device_security_cache_v1");
  } catch (_e) {}
}

function broadcastAll(result) {
  const focusStrict = result.focusBlockingStrict === true;
  const blockedEvents = mergeEffectiveBlockedEvents(result.blockedEvents, focusStrict);
  const rawExcluded = Array.isArray(result.excludedDomains) ? result.excludedDomains : DEFAULT_EXCLUDED_DOMAINS;
  const excludedDomains = fbNormalizeExcludedDomainsListFromStorage(rawExcluded);
  const globalOn = result.extensionGloballyEnabled !== false;
  const focusModuleOn = result.focusBlockingEnabled !== false;
  const excluded = isExcluded(excludedDomains);
  const siteAllows = globalOn && !excluded && !tabPaused;

  // Re-publish before each pre-ACK broadcast so MAIN verifiers can lazy-capture
  // if they raced ahead of the isolated bridge at document_start.
  if (!fbFocusAcked && !fbChannelKeyAttrRemoved) {
    fbSetChannelKeyAttr();
  }

  postFocusSettings(blockedEvents, siteAllows && focusModuleOn);
  postSecuritySettings(result, siteAllows, excludedDomains);
  postNetworkSettings(result, siteAllows, excludedDomains);
  postDsBlockSettings(result, siteAllows);
  postThreatShieldSettings(result, siteAllows);
  postDeviceSecuritySettings(result, siteAllows);

  // Prefer ACK-driven removal; fall back to a short timeout so the attr does not
  // linger if Focus never acks (e.g. excluded host / focus module off).
  if (!fbFocusAcked) {
    fbScheduleChannelKeyRemoval(5000);
  } else {
    queueMicrotask(fbRemoveChannelKeyAttrOnce);
  }
}

const ALL_KEYS = [
  "blockedEvents",
  "excludedDomains",
  "extensionGloballyEnabled",
  "focusBlockingEnabled",
  "focusBlockingStrict",
  "optionsUiLanguage",
  ...fbConcatModuleStorageKeys(),
];

let lastResultSnapshot = null;

/** Monotonic id so overlapping storage.get + sendMessage callbacks from older refreshes are ignored. */
let refreshGeneration = 0;

/**
 * Loads storage snapshot, then tab pause flag, then broadcasts once — same snapshot paired with same pause answer.
 * Stale callbacks (superseded by a newer refresh) do not mutate `tabPaused` or post to MAIN.
 */
function refreshStorageAndBroadcastFast() {
  const myGeneration = ++refreshGeneration;

  function applyPauseThenBroadcast(snapshot) {
    if (myGeneration !== refreshGeneration) return;

    lastResultSnapshot = snapshot;

    try {
      if (!chrome || !chrome.runtime || typeof chrome.runtime.id !== "string") {
        tabPaused = false;
        broadcastAll(snapshot);
        return;
      }
      chrome.runtime.sendMessage({ type: "FB_IS_TAB_PAUSED" }, (resp) => {
        if (myGeneration !== refreshGeneration) return;
        tabPaused = chrome.runtime.lastError ? false : !!(resp && resp.paused);
        broadcastAll(snapshot);
      });
    } catch (_e) {
      if (myGeneration !== refreshGeneration) return;
      tabPaused = false;
      broadcastAll(snapshot);
    }
  }

  const area = getStorageArea();
  if (!area || typeof area.get !== "function") {
    applyPauseThenBroadcast({});
    return;
  }

  try {
    area.get(ALL_KEYS, (result) => {
      void chrome.runtime.lastError;
      if (myGeneration !== refreshGeneration) return;
      const snapshot = result && typeof result === "object" ? result : {};
      applyPauseThenBroadcast(snapshot);
    });
  } catch (_e) {
    applyPauseThenBroadcast({});
  }
}

let fbBurstTimers = [];
let fbLastRequestTs = 0;

function fbMarkAcked() {
  fbFocusAcked = true;
  if (fbBurstTimers.length) {
    fbBurstTimers.forEach((t) => clearTimeout(t));
    fbBurstTimers = [];
  }
  // Focus verified a signed payload → every MAIN module that shares this document
  // had a chance to read data-fb-k; drop it now.
  queueMicrotask(fbRemoveChannelKeyAttrOnce);
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
    // StorageArea.onChanged is (changes) only — unlike chrome.storage.onChanged (changes, areaName).
    chrome.storage.session.onChanged.addListener((changes) => {
      if (!changes || !changes[SESSION_PAUSE_KEY]) return;
      refreshStorageAndBroadcastFast();
    });
  }
} catch (e) {}

try {
  if (chrome.runtime && typeof chrome.runtime.onMessage === "object") {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || msg.type !== "FB_REFRESH_SETTINGS") return;
      refreshStorageAndBroadcastFast();
      try {
        sendResponse({ ok: true });
      } catch (_e) {}
    });
  }
} catch (_e) {}
