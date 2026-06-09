(() => {
  "use strict";

  /** Depends on security-defaults.js (MAIN) loaded before this script. */

  const USER_GESTURE_WINDOW_MS = 900;

  let fbMergeDsBlockFromStorage = typeof mergeDsBlockFromStorage === "function" ? mergeDsBlockFromStorage : null;
  let fbBuiltinDomains = typeof DS_BLOCK_BUILTIN_BLOCK_DOMAINS !== "undefined" ? DS_BLOCK_BUILTIN_BLOCK_DOMAINS : null;
  let fbBuiltinHideSelectors = typeof DS_BLOCK_BUILTIN_HIDE_SELECTORS !== "undefined" ? DS_BLOCK_BUILTIN_HIDE_SELECTORS : null;

  if (!fbMergeDsBlockFromStorage) {
    const DEFAULT_DS_BLOCK_FALLBACK = {
      dsBlockEnabled: false,
      dsBlockBlockPopups: true,
      dsBlockCosmeticEnabled: true,
      dsBlockTelemetryEnabled: true,
      dsBlockExtraBlockedDomains: [],
      dsBlockHideSelectors: [],
    };

    function normalizeDomainLineFallback(raw) {
      let s = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
      if (!s) return "";
      if (s.length > 300) s = s.slice(0, 300);
      s = s.replace(/^\*+\./, "");
      if (/^[a-z]+:\/\//i.test(s)) {
        try {
          s = new URL(s).hostname;
        } catch (_e) {}
      }
      s = s.split("/")[0].split("?")[0].split("#")[0].trim();
      s = s.replace(/^\[+|\]+$/g, "");
      s = s.replace(/^\.*/, "").replace(/\.*$/, "");
      return s ? s.toLowerCase() : "";
    }

    function normalizeSelectorLineFallback(raw) {
      const s = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
      if (!s) return "";
      return s.length > 400 ? s.slice(0, 400) : s;
    }

    function mergeDsBlockFromStorageFallback(result) {
      const d = DEFAULT_DS_BLOCK_FALLBACK;
      const extraDomainsRaw = Array.isArray(result.dsBlockExtraBlockedDomains) ? result.dsBlockExtraBlockedDomains : d.dsBlockExtraBlockedDomains;
      const selectorsRaw = Array.isArray(result.dsBlockHideSelectors) ? result.dsBlockHideSelectors : d.dsBlockHideSelectors;

      const extraDomains = [];
      for (const it of extraDomainsRaw) {
        const v = normalizeDomainLineFallback(it);
        if (!v) continue;
        extraDomains.push(v);
        if (extraDomains.length >= 220) break;
      }

      const selectors = [];
      for (const it of selectorsRaw) {
        const v = normalizeSelectorLineFallback(it);
        if (!v) continue;
        selectors.push(v);
        if (selectors.length >= 220) break;
      }

      return {
        dsBlockEnabled: result.dsBlockEnabled !== undefined ? !!result.dsBlockEnabled : d.dsBlockEnabled,
        dsBlockBlockPopups: result.dsBlockBlockPopups !== undefined ? !!result.dsBlockBlockPopups : d.dsBlockBlockPopups,
        dsBlockCosmeticEnabled: result.dsBlockCosmeticEnabled !== undefined ? !!result.dsBlockCosmeticEnabled : d.dsBlockCosmeticEnabled,
        dsBlockTelemetryEnabled: result.dsBlockTelemetryEnabled !== undefined ? !!result.dsBlockTelemetryEnabled : d.dsBlockTelemetryEnabled,
        dsBlockExtraBlockedDomains: extraDomains,
        dsBlockHideSelectors: selectors,
      };
    }

    fbMergeDsBlockFromStorage = mergeDsBlockFromStorageFallback;
  }

  if (!fbBuiltinDomains) {
    fbBuiltinDomains = [
      "google-analytics.com",
      "googletagmanager.com",
      "doubleclick.net",
      "googlesyndication.com",
      "adservice.google.com",
      "googletagservices.com",
      "googleadservices.com",
      "facebook.com",
      "facebook.net",
      "connect.facebook.net",
      "analytics.twitter.com",
      "static.ads-twitter.com",
      "bat.bing.com",
      "ads.linkedin.com",
      "snap.licdn.com",
      "stats.wp.com",
      "pixel.wp.com",
      "mc.yandex.ru",
      "appmetrica.yandex.ru",
      "metrika.yandex.ru",
      "cdn.amplitude.com",
      "api.amplitude.com",
      "api.segment.io",
      "cdn.segment.com",
      "plausible.io",
    ];
  }

  if (!fbBuiltinHideSelectors) {
    fbBuiltinHideSelectors = [
      "ins.adsbygoogle",
      "[class*=\"adsbygoogle\"]",
      "[id^=\"google_ads_iframe\"]",
      "[data-ad-client]",
      "[data-ad-slot]",
      "[data-ad-unit-path]",
      "[data-google-container-id]",
      "[id^=\"div-gpt-ad\"]",
      "iframe[src*=\"doubleclick.net\"]",
      "iframe[src*=\"googlesyndication.com\"]",
      "iframe[src*=\"googletagservices.com\"]",
      "iframe[src*=\"amazon-adsystem.com\"]",
      "iframe[src*=\"taboola.com\"]",
      "iframe[src*=\"outbrain.com\"]",
      "iframe[src*=\"criteo.com\"]",
      "iframe[src*=\"criteo.net\"]",
      "iframe[src*=\"openx.net\"]",
      "iframe[src*=\"adnxs.com\"]",
      "iframe[src*=\"adform.net\"]",
      "iframe[src*=\"pubmatic.com\"]",
      "iframe[src*=\"3lift.com\"]",
      "iframe[src*=\"casalemedia.com\"]",
      "iframe[src*=\"teads.tv\"]",
      "[aria-label=\"advertisement\"]",
    ];
  }

  const state = {
    isActive: false,
    merged: fbMergeDsBlockFromStorage({}),
    /** @type {Set<string>} */
    blockDomains: new Set(),
  };

  /** Fast MAIN-world boot: replay last bridge payload cached by settings-bridge. */
  try {
    const raw = localStorage.getItem("__focus_blocker_ds_block_cache_v1");
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        const ds = obj.dsBlock && typeof obj.dsBlock === "object" ? obj.dsBlock : {};
        state.merged = fbMergeDsBlockFromStorage(ds);
        if (typeof obj.isActive === "boolean") {
          state.isActive = obj.isActive;
        } else {
          state.isActive = !!state.merged.dsBlockEnabled;
        }
      }
    }
  } catch (_e) {}

  function computeBlockDomainsSet() {
    const out = new Set();
    const builtins = Array.isArray(fbBuiltinDomains) ? fbBuiltinDomains : [];
    builtins.forEach((d) => {
      const v = typeof d === "string" ? d.trim().toLowerCase() : "";
      if (v) out.add(v);
    });
    const extra = state.merged && Array.isArray(state.merged.dsBlockExtraBlockedDomains) ? state.merged.dsBlockExtraBlockedDomains : [];
    extra.forEach((d) => {
      const v = typeof d === "string" ? d.trim().toLowerCase() : "";
      if (v) out.add(v);
    });
    state.blockDomains = out;
  }

  computeBlockDomainsSet();

  function bumpDs(delta, subKey) {
    try {
      const fn = globalThis.__focusBlockerStatsBump;
      if (typeof fn === "function")
        fn("ds", typeof delta === "number" && delta > 0 ? delta : 1, typeof subKey === "string" ? subKey : undefined);
    } catch (_e) {}
  }

  function hostMatchesDomainList(hostRaw) {
    const host = String(hostRaw || "").trim().toLowerCase();
    if (!host) return false;
    for (const d of state.blockDomains) {
      if (host === d) return true;
      if (host.endsWith("." + d)) return true;
    }
    return false;
  }

  /** @param {unknown} rawUrl */
  function shouldBlockTelemetryUrl(rawUrl) {
    if (!state.isActive) return false;
    const m = state.merged;
    if (!m || !m.dsBlockEnabled || !m.dsBlockTelemetryEnabled) return false;
    try {
      const u = typeof rawUrl === "string" || rawUrl instanceof URL ? new URL(String(rawUrl), location.href) : null;
      if (!u || !u.hostname) return false;
      return hostMatchesDomainList(u.hostname);
    } catch (_e) {
      return false;
    }
  }

  function updateCosmeticStyle() {
    // Cosmetic CSS must not be injected via <style> tags in the page DOM on strict CSP sites.
    // The extension applies DS cosmetic rules via MV3 chrome.scripting (service worker).
    // Keep this function as a cleanup hook for old versions that may have inserted a style tag.
    try {
      const el = document.getElementById("__focus_blocker_ds_block_style_v1");
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (_e) {}
  }

  let lastGestureTs = 0;
  function markGesture() {
    lastGestureTs = Date.now();
  }

  try {
    window.addEventListener("pointerdown", markGesture, true);
    window.addEventListener("keydown", markGesture, true);
    window.addEventListener("touchstart", markGesture, true);
    window.addEventListener("mousedown", markGesture, true);
  } catch (_e) {}

  const nativeOpen = typeof window.open === "function" ? window.open.bind(window) : null;
  if (nativeOpen) {
    window.open = function openShim(url, target, features) {
      const m = state.merged;
      if (state.isActive && m && m.dsBlockEnabled && m.dsBlockBlockPopups) {
        const now = Date.now();
        const recentGesture = now - lastGestureTs <= USER_GESTURE_WINDOW_MS;
        if (!recentGesture) {
          bumpDs(1, "window_open_blocked");
          // eslint-disable-next-line no-console
          console.warn("[Focus Blocker DS Block] blocked window.open", url);
          return null;
        }
      }
      return nativeOpen(url, target, features);
    };
  }

  function shouldBlockSyntheticBlankNav(/** @type {MouseEvent} */ e) {
    const m = state.merged;
    if (!state.isActive || !m || !m.dsBlockEnabled || !m.dsBlockBlockPopups) return false;
    if (e.isTrusted) return false;
    const el = e.target;
    if (!(el instanceof Element)) return false;
    const a = el.closest("a[href]");
    if (!a) return false;
    const tgt = (a.getAttribute("target") || "").trim().toLowerCase();
    if (tgt !== "_blank" && tgt !== "_new") return false;
    return true;
  }

  function onPossibleSyntheticBlankClick(/** @type {MouseEvent} */ e) {
    if (!shouldBlockSyntheticBlankNav(e)) return;
    bumpDs(1, "synthetic_blank_nav_blocked");
    e.preventDefault();
    e.stopPropagation();
  }

  try {
    window.addEventListener("click", onPossibleSyntheticBlankClick, true);
    window.addEventListener("auxclick", onPossibleSyntheticBlankClick, true);
  } catch (_e) {}

  const nativeSendBeacon = typeof navigator.sendBeacon === "function" ? navigator.sendBeacon.bind(navigator) : null;
  if (nativeSendBeacon) {
    navigator.sendBeacon = function sendBeaconShim(url, data) {
      if (shouldBlockTelemetryUrl(url)) {
        bumpDs(1, "telemetry_sendBeacon_blocked");
        return false;
      }
      return nativeSendBeacon(url, data);
    };
  }

  /** @param {unknown} payload */
  function applyPayload(payload) {
    const p =
      payload && typeof payload === "object"
        ? /** @type {{ isActive?: boolean, dsBlock?: Record<string, unknown> }}*/ (payload)
        : {};
    state.isActive = !!p.isActive;
    state.merged = fbMergeDsBlockFromStorage(p.dsBlock && typeof p.dsBlock === "object" ? p.dsBlock : {});
    computeBlockDomainsSet();
    updateCosmeticStyle();

    try {
      localStorage.setItem(
        "__focus_blocker_ds_block_cache_v1",
        JSON.stringify({
          v: 1,
          isActive: state.isActive,
          dsBlock: p.dsBlock && typeof p.dsBlock === "object" ? p.dsBlock : {},
          ts: Date.now(),
        })
      );
    } catch (_e) {}
  }

  // HMAC channel: per-load secret key from the bridge, delivered via a short-lived
  // <html data-fb-k="..."> attribute at document_start (never inside messages).
  const fbChannelApi = (() => {
    try {
      return (typeof globalThis !== "undefined" && globalThis.__fbChannel) || null;
    } catch (_e) {
      return null;
    }
  })();
  let fbChannelKey = "";
  try {
    fbChannelKey = (document && document.documentElement && document.documentElement.getAttribute("data-fb-k")) || "";
  } catch (_e) {
    fbChannelKey = "";
  }
  let fbLastSeq = 0;

  // Authentic payload = valid HMAC-SHA256 signature + strictly increasing seq (anti-replay).
  function fbVerifyPayload(payload) {
    if (!fbChannelApi || !fbChannelKey || !payload || typeof payload !== "object") return false;
    const seq = payload.seq;
    if (typeof seq !== "number" || !Number.isFinite(seq) || seq <= fbLastSeq) return false;
    if (typeof payload.sig !== "string" || payload.sig.length !== 64) return false;
    let expected = "";
    try {
      expected = fbChannelApi.hmacSha256Hex(fbChannelKey, fbChannelApi.stableStringify(payload, "sig"));
    } catch (_e) {
      return false;
    }
    if (expected !== payload.sig) return false;
    fbLastSeq = seq;
    return true;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.type !== "FOCUS_BLOCKER_DS_BLOCK_SETTINGS") return;
    if (!fbVerifyPayload(event.data)) return;
    applyPayload(event.data);
  });

  window.addEventListener("FOCUS_BLOCKER_DS_BLOCK_SETTINGS_EVENT", (/** @type {CustomEvent} */ event) => {
    try {
      const detail = event && event.detail ? event.detail : {};
      if (!fbVerifyPayload(detail)) return;
      applyPayload(detail);
    } catch (_e) {}
  });

  updateCosmeticStyle();

  try {
    window.postMessage({ type: "FOCUS_BLOCKER_REQUEST_SETTINGS" }, "*");
  } catch (_e) {}
})();

