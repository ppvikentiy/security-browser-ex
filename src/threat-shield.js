(() => {
  "use strict";

  /** Depends on security-defaults.js (MAIN), loaded before this script. */

  const BANNER_TEXT = "Возможна угроза вашим данным. Будьте осторожны!";
  const BANNER_HOST = "__focus_blocker_threat_banner_v1";

  /** @typedef {{ threatShieldEnabled: boolean, threatWarnHttp: boolean, threatWarnList: boolean, threatWarnStackedTld: boolean, threatWarnGarbageHost: boolean, threatWarnRedirect: boolean, threatGarbageMinLabels: number, threatShieldExtraHosts: string[], threatShieldWhitelistHosts: string[] }} ThreatMerged */

  let fbMergeThreatShield =
    typeof mergeThreatShieldFromStorage === "function" ? mergeThreatShieldFromStorage : null;
  let fbPatternMatchesHost = typeof patternMatchesHost === "function" ? patternMatchesHost : null;
  let fbIsLocalOrPrivate = typeof isLocalOrPrivatePageHost === "function" ? isLocalOrPrivatePageHost : null;

  if (!fbMergeThreatShield) {
    // eslint-disable-next-line no-inner-declarations
    function mergeThreatShieldFromStorageFallback(result) {
      const d = {
        threatShieldEnabled: false,
        threatWarnHttp: true,
        threatWarnList: true,
        threatWarnStackedTld: true,
        threatWarnGarbageHost: false,
        threatWarnRedirect: true,
        threatGarbageMinLabels: 6,
        threatShieldExtraHosts: [],
        threatShieldWhitelistHosts: [],
      };
      const r = result || {};
      return {
        threatShieldEnabled: r.threatShieldEnabled !== undefined ? !!r.threatShieldEnabled : d.threatShieldEnabled,
        threatWarnHttp: r.threatWarnHttp !== undefined ? !!r.threatWarnHttp : d.threatWarnHttp,
        threatWarnList: r.threatWarnList !== undefined ? !!r.threatWarnList : d.threatWarnList,
        threatWarnStackedTld:
          r.threatWarnStackedTld !== undefined ? !!r.threatWarnStackedTld : d.threatWarnStackedTld,
        threatWarnGarbageHost:
          r.threatWarnGarbageHost !== undefined ? !!r.threatWarnGarbageHost : d.threatWarnGarbageHost,
        threatWarnRedirect: r.threatWarnRedirect !== undefined ? !!r.threatWarnRedirect : d.threatWarnRedirect,
        threatGarbageMinLabels: d.threatGarbageMinLabels,
        threatShieldExtraHosts: Array.isArray(r.threatShieldExtraHosts) ? r.threatShieldExtraHosts : d.threatShieldExtraHosts,
        threatShieldWhitelistHosts: Array.isArray(r.threatShieldWhitelistHosts)
          ? r.threatShieldWhitelistHosts
          : d.threatShieldWhitelistHosts,
      };
    }
    fbMergeThreatShield = mergeThreatShieldFromStorageFallback;
  }

  if (!fbPatternMatchesHost) {
    // eslint-disable-next-line no-inner-declarations
    function patternMatchesHostFallback(pattern, host) {
      let p = String(pattern ?? "").trim().toLowerCase();
      if (!p || p === "*") return false;
      try {
        if (p.includes("://")) p = new URL(p).hostname.toLowerCase();
      } catch (_e) {
        return false;
      }
      const h = String(host ?? "").trim().toLowerCase();
      if (!h) return false;
      if (p.includes("*")) {
        if (p.startsWith("*.") && p.indexOf("*", 2) === -1) {
          const root = p.slice(2).replace(/^\.+/, "").replace(/\.+$/, "");
          if (root && !root.includes("*")) return h === root || h.endsWith("." + root);
        }
        const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        return new RegExp(`^${escaped}$`).test(h);
      }
      p = p.replace(/^\.+/, "").replace(/\.+$/, "");
      return !!p && (h === p || h.endsWith("." + p));
    }
    fbPatternMatchesHost = patternMatchesHostFallback;
  }

  if (!fbIsLocalOrPrivate) {
    fbIsLocalOrPrivate = function isLocalFallback() {
      return false;
    };
  }

  const state = {
    isActive: false,
    pageAllowed: true,
    /** @type {ThreatMerged} */
    merged: fbMergeThreatShield({}),
    /** @type {string[]} */
    builtinHostPatterns: Array.isArray(
      typeof THREAT_SHIELD_BUILTIN_HOST_PATTERNS !== "undefined" ? THREAT_SHIELD_BUILTIN_HOST_PATTERNS : null
    )
      ? THREAT_SHIELD_BUILTIN_HOST_PATTERNS
      : [],
    /** @type {string[]} */
    stackedTldTails: Array.isArray(
      typeof THREAT_SHIELD_STACKED_TLD_TAIL !== "undefined" ? THREAT_SHIELD_STACKED_TLD_TAIL : null
    )
      ? THREAT_SHIELD_STACKED_TLD_TAIL
      : [],
  };

  /** Fast MAIN-world boot: replay last bridge payload */
  try {
    const raw = localStorage.getItem("__focus_blocker_threat_shield_cache_v1");
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        const ts = obj.threatShield && typeof obj.threatShield === "object" ? obj.threatShield : {};
        state.merged = fbMergeThreatShield(ts);
        if (typeof obj.isActive === "boolean") state.isActive = obj.isActive;
        else state.isActive = !!state.merged.threatShieldEnabled;
        if (typeof obj.pageAllowed === "boolean") state.pageAllowed = obj.pageAllowed;
        if (Array.isArray(obj.threatBuiltinHostPatterns)) state.builtinHostPatterns = obj.threatBuiltinHostPatterns;
        if (Array.isArray(obj.threatStackedTldTails)) state.stackedTldTails = obj.threatStackedTldTails;
      }
    }
  } catch (_e) {}

  /** VK и др.: SPA удаляют вставленный узел из DOM — периодически восстанавливаем баннер, пока условие срабатывания актуально. */
  /** @type {number | null} */
  let bannerKeepaliveTimer = null;
  function stopBannerKeepalive() {
    if (bannerKeepaliveTimer == null) return;
    window.clearInterval(bannerKeepaliveTimer);
    bannerKeepaliveTimer = null;
  }
  function startBannerKeepalive() {
    if (bannerKeepaliveTimer != null) return;
    bannerKeepaliveTimer = window.setInterval(() => {
      try {
        const r = evaluateReasons();
        if (!r) {
          stopBannerKeepalive();
          removeBanner();
          return;
        }
        const el = document.getElementById(BANNER_HOST);
        if (!el || !el.isConnected) {
          showBanner(r);
        }
      } catch (_e5) {}
    }, 850);
  }

  /** @param {string} host */
  function isWhitelisted(host) {
    const list = state.merged.threatShieldWhitelistHosts || [];
    for (let i = 0; i < list.length; i++) {
      if (fbPatternMatchesHost(list[i], host)) return true;
    }
    return false;
  }

  /** @param {string} host @param {string[]} patterns */
  function hostMatchesAnyPattern(host, patterns) {
    for (let i = 0; i < patterns.length; i++) {
      if (fbPatternMatchesHost(patterns[i], host)) return true;
    }
    return false;
  }

  /**
   * «Накладочный» домен: *.com.ru и т.п.
   * @param {string} host
   * @param {string[]} tails
   */
  function looksLikeStackedTld(host, tails) {
    const h = String(host || "").toLowerCase();
    if (!tails || !tails.length) return false;
    const escapedTails = tails.map((t) => String(t).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const rx = new RegExp(`\\.(?:com|net|org)\\.(${escapedTails.join("|")})$`, "i");
    return rx.test(h);
  }

  /** @param {string} host @param {number} minLabels */
  function looksLikeGarbageFqdn(host, minLabels) {
    const h = String(host || "").toLowerCase();
    if (!h || !h.includes(".")) return false;
    const labels = h.split(".").filter(Boolean);
    if (labels.length >= minLabels) return true;

    for (let i = 0; i < labels.length; i++) {
      const lab = labels[i];
      if (lab.length >= 38) return true;
      const digits = (lab.match(/\d/g) || []).length;
      if (lab.length >= 12 && digits >= 4 && digits / lab.length >= 0.35) return true;
    }
    return false;
  }

  /** @returns {boolean} */
  function hadHttpRedirects() {
    try {
      if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") return false;
      const nav = /** @type {PerformanceNavigationTiming | undefined}*/ (performance.getEntriesByType("navigation")[0]);
      if (!nav || typeof nav.redirectCount !== "number") return false;
      return nav.redirectCount > 0;
    } catch (_e) {
      return false;
    }
  }

  /**
   * @returns {null | string} reason tag for debugging
   */
  function evaluateReasons() {
    const m = state.merged;
    if (!(state.isActive && state.pageAllowed)) return null;

    let isTop = true;
    try {
      isTop = window.self === window.top;
    } catch (_e2) {
      isTop = true;
    }
    if (!isTop) return null;

    let proto = "";
    let host = "";
    try {
      proto = window.location.protocol || "";
      host = window.location.hostname || "";
    } catch (_e3) {
      return null;
    }

    if (!host) return null;
    if (isWhitelisted(host)) return null;

    /** «Закрыть»: на ~3 мин не показывать снова (иначе SPA-keepalive сразу вернёт баннер). */
    try {
      if (typeof sessionStorage !== "undefined") {
        const sn = sessionStorage.getItem("fb_threat_banner_snooze_" + host);
        const until = sn ? Number(sn) : 0;
        if (Number.isFinite(until) && until > Date.now()) return null;
      }
    } catch (_s) {}

    const sessKey = "fb_threat_sess_ok_" + host;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(sessKey)) return null;
    } catch (_e4) {}

    if (m.threatWarnHttp && proto === "http:" && !fbIsLocalOrPrivate(host)) return "http";

    const listPatterns = ([]).concat(state.builtinHostPatterns || [], m.threatShieldExtraHosts || []);
    if (m.threatWarnList && listPatterns.length && hostMatchesAnyPattern(host, listPatterns)) return "list";

    const tails =
      Array.isArray(state.stackedTldTails) && state.stackedTldTails.length ? state.stackedTldTails : [];
    if (m.threatWarnStackedTld && tails.length && looksLikeStackedTld(host, tails)) return "stacked_tld";

    const minLab = typeof m.threatGarbageMinLabels === "number" && m.threatGarbageMinLabels > 0 ? m.threatGarbageMinLabels : 6;
    if (m.threatWarnGarbageHost && looksLikeGarbageFqdn(host, minLab)) return "garbage_shape";

    if (m.threatWarnRedirect && hadHttpRedirects()) return "redirect_chain";

    return null;
  }

  function dismissForSession(hostname) {
    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("fb_threat_sess_ok_" + hostname, "1");
    } catch (_e) {}
    removeBanner();
  }

  function removeBanner() {
    try {
      const el = document.getElementById(BANNER_HOST);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (_e) {}
  }

  /** @param {string | null} reason */
  function showBanner(reason) {
    removeBanner();

    try {
      if (!document.documentElement) return;

      const host = window.location.hostname || "";

      const outer = document.createElement("div");
      outer.id = BANNER_HOST;
      outer.setAttribute("role", "presentation");
      outer.style.cssText =
        "position:fixed!important;left:0!important;right:0!important;top:0!important;width:100%!important;" +
        "z-index:2147483647!important;pointer-events:auto!important;display:block!important;margin:0!important;" +
        "padding:0!important;border:none!important;background:transparent!important;font-size:16px!important;" +
        "line-height:normal!important;box-sizing:border-box!important;";

      /** Shadow DOM: тяжёлые сайты (vk.com и др.) могут ломать видимость через глобальные стили. */
      const shadow =
        typeof outer.attachShadow === "function"
          ? outer.attachShadow({ mode: "open" })
          : /** @type {ShadowRoot | null}*/ (null);

      const panel = document.createElement("div");
      panel.setAttribute("role", "alert");
      panel.style.cssText =
        "box-sizing:border-box;width:100%;background:#b91c1c;color:#fff;font-family:-apple-system,BlinkMacSystemFont," +
        '\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;font-size:14px;padding:12px 14px;box-shadow:0 2px 10px rgba(0,0,0,0.25);' +
        "display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;direction:ltr;";

      const text = document.createElement("span");
      text.style.cssText = "flex:1;min-width:200px;margin:0;";
      text.textContent = BANNER_TEXT;

      const actions = document.createElement("span");
      actions.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;";

      const btnClose = document.createElement("button");
      btnClose.type = "button";
      btnClose.textContent = "Закрыть";
      btnClose.style.cssText =
        "background:#fff;color:#991b1b;border:none;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;font:inherit;";
      btnClose.addEventListener("click", () => {
        try {
          if (typeof sessionStorage !== "undefined" && host) {
            sessionStorage.setItem("fb_threat_banner_snooze_" + host, String(Date.now() + 3 * 60 * 1000));
          }
        } catch (_s) {}
        stopBannerKeepalive();
        removeBanner();
      });

      const btnSession = document.createElement("button");
      btnSession.type = "button";
      btnSession.textContent = "Не показывать на этом сайте (сессия)";
      btnSession.style.cssText =
        "background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.85);border-radius:6px;padding:6px 10px;cursor:pointer;font:inherit;";
      btnSession.addEventListener("click", () => dismissForSession(host));

      actions.appendChild(btnSession);
      actions.appendChild(btnClose);
      panel.appendChild(text);
      panel.appendChild(actions);

      if (shadow) shadow.appendChild(panel);
      else outer.appendChild(panel);

      // Вешаем на <html>: при перезапуске SPA часто меняют body, а узел под documentElement сохраняется дольше.
      document.documentElement.appendChild(outer);
      void reason;
    } catch (_e) {}
  }

  function runCheck() {
    const reason = evaluateReasons();
    if (!reason) {
      stopBannerKeepalive();
      removeBanner();
      return;
    }
    function paint() {
      showBanner(reason);
      startBannerKeepalive();
    }
    if (document.documentElement && (document.body || document.readyState !== "loading")) paint();
    else document.addEventListener("DOMContentLoaded", paint, { once: true });
  }

  /** @param {unknown} payload */
  function applyPayload(payload) {
    const p =
      payload && typeof payload === "object" ? /** @type {Record<string, unknown>}*/ (payload) : {};
    state.isActive = !!p.isActive;
    state.pageAllowed = p.pageAllowed !== false;
    const ts =
      /** @type {Record<string, unknown> | undefined}*/ (p.threatShield && typeof p.threatShield === "object")
        ? p.threatShield
        : {};
    state.merged = fbMergeThreatShield(ts);
    if (Array.isArray(p.threatBuiltinHostPatterns)) state.builtinHostPatterns = p.threatBuiltinHostPatterns;
    if (Array.isArray(p.threatStackedTldTails)) state.stackedTldTails = p.threatStackedTldTails;

    try {
      localStorage.setItem(
        "__focus_blocker_threat_shield_cache_v1",
        JSON.stringify({
          v: 1,
          isActive: state.isActive,
          pageAllowed: state.pageAllowed,
          threatShield: ts,
          threatBuiltinHostPatterns: state.builtinHostPatterns,
          threatStackedTldTails: state.stackedTldTails,
          ts: Date.now(),
        })
      );
    } catch (_e) {}

    runCheck();
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
    if (event.source !== window || !event.data || event.data.type !== "FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS") return;
    if (!fbVerifyPayload(event.data)) return;
    applyPayload(event.data);
  });

  window.addEventListener(
    "FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS_EVENT",
    (/** @type {CustomEvent} */ evt) => {
      try {
        const detail = evt && evt.detail ? evt.detail : {};
        if (!fbVerifyPayload(detail)) return;
        applyPayload(detail);
      } catch (_e2) {}
    },
    false
  );

  /** Первый прогон (кэш + позднее обновление с моста) */
  runCheck();

  try {
    window.postMessage({ type: "FOCUS_BLOCKER_REQUEST_SETTINGS" }, "*");
  } catch (_e3) {}
})();
