(() => {
  "use strict";

  /** Depends on security-defaults-main.js (MAIN copy), loaded before this script. */

  const BANNER_HOST = "__focus_blocker_threat_banner_v1";
  const BANNER_I18N = {
    ru: {
      text: "Возможна угроза вашим данным. Будьте осторожны!",
      close: "Закрыть",
      session: "Не показывать на этом сайте (сессия)",
    },
    en: {
      text: "Your data may be at risk. Be careful!",
      close: "Close",
      session: "Don’t show on this site (session)",
    },
    uk: {
      text: "Можлива загроза вашим даним. Будьте обережні!",
      close: "Закрити",
      session: "Не показувати на цьому сайті (сесія)",
    },
  };

  function bannerStrings(lang) {
    const key = lang === "en" || lang === "uk" ? lang : "ru";
    return BANNER_I18N[key] || BANNER_I18N.ru;
  }

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
    optionsUiLanguage: "ru",
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

  /**
   * No boot cache is read here, by design.
   *
   * A `localStorage` cache is attacker-controlled on a hostile origin and cannot be
   * authenticated at document_start (the HMAC channel key is minted per page load,
   * so nothing signed during an earlier load is verifiable now). Replaying one would
   * let a page hand itself `pageAllowed: false`, a matching whitelist entry or empty
   * detection lists and silence the warning. Unlike the ad/telemetry hooks, the
   * banner is only UI, so it can wait for the signed bridge payload.
   */

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

      const i18n = bannerStrings(state.optionsUiLanguage);

      const text = document.createElement("span");
      text.style.cssText = "flex:1;min-width:200px;margin:0;";
      text.textContent = i18n.text;

      const actions = document.createElement("span");
      actions.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;";

      const btnClose = document.createElement("button");
      btnClose.type = "button";
      btnClose.textContent = i18n.close;
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
      btnSession.textContent = i18n.session;
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
    const langRaw = p.optionsUiLanguage;
    state.optionsUiLanguage = langRaw === "en" || langRaw === "uk" || langRaw === "ru" ? langRaw : "ru";
    const ts =
      /** @type {Record<string, unknown> | undefined}*/ (p.threatShield && typeof p.threatShield === "object")
        ? p.threatShield
        : {};
    state.merged = fbMergeThreatShield(ts);
    if (Array.isArray(p.threatBuiltinHostPatterns)) state.builtinHostPatterns = p.threatBuiltinHostPatterns;
    if (Array.isArray(p.threatStackedTldTails)) state.stackedTldTails = p.threatStackedTldTails;

    runCheck();
  }

  // HMAC channel: per-load secret key from the bridge, delivered via a short-lived
  // <html data-fb-k="..."> attribute at document_start (never inside messages).
  // The channel itself comes from fb-channel-main.js, the MAIN-world copy of
  // fb-channel.js (see that file's header for why the copy exists).
  function fbResolveChannelApi() {
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
  }
  let fbChannelApi = fbResolveChannelApi();
  let fbChannelKey = "";
  try {
    fbChannelKey = (document && document.documentElement && document.documentElement.getAttribute("data-fb-k")) || "";
  } catch (_e) {
    fbChannelKey = "";
  }
  let fbLastSeq = 0;

  // A silently dropped control message leaves the module stuck at its startup
  // default forever, which is indistinguishable from "no settings yet". Report the
  // first genuine rejection so the channel cannot fail invisibly. Stale-seq drops
  // are normal (each payload is delivered twice, as event + postMessage) and are
  // deliberately not reported.
  let fbVerifyWarned = false;
  function fbWarnVerifyOnce(reason) {
    if (fbVerifyWarned) return;
    fbVerifyWarned = true;
    try {
      // eslint-disable-next-line no-console
      console.warn("[Focus Blocker Threat Shield] settings message rejected:", reason);
    } catch (_e) {}
  }

  // Authentic payload = valid HMAC-SHA256 signature + strictly increasing seq (anti-replay).
  function fbVerifyPayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    if (!fbChannelApi) fbChannelApi = fbResolveChannelApi();
    if (!fbChannelApi) {
      // Name the carrier that missed: which ones are empty says whether the channel
      // file did not run at all or only its cross-file handoff broke.
      let probe = "";
      try {
        probe =
          " global=" +
          (typeof globalThis !== "undefined" && globalThis.__fbChannel ? "y" : "n") +
          " html=" +
          (document && document.documentElement && document.documentElement.__fbChannelApi ? "y" : "n") +
          " proto=" +
          (typeof Document !== "undefined" && Document.prototype && Document.prototype.__fbChannelGet ? "y" : "n");
      } catch (_e) {}
      fbWarnVerifyOnce("channel api unavailable (fb-channel-main.js exports not visible):" + probe);
      return false;
    }
    if (!fbChannelKey) {
      fbWarnVerifyOnce("channel key unavailable (data-fb-k missing at document_start)");
      return false;
    }
    const seq = payload.seq;
    if (typeof seq !== "number" || !Number.isFinite(seq) || seq <= fbLastSeq) return false;
    if (typeof payload.sig !== "string" || payload.sig.length !== 64) {
      fbWarnVerifyOnce("payload has no signature");
      return false;
    }
    let expected = "";
    try {
      expected = fbChannelApi.hmacSha256Hex(fbChannelKey, fbChannelApi.stableStringify(payload, "sig"));
    } catch (_e) {
      fbWarnVerifyOnce("hmac computation threw");
      return false;
    }
    if (expected !== payload.sig) {
      fbWarnVerifyOnce("signature mismatch (key disagreement between worlds)");
      return false;
    }
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
