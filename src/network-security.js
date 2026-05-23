(() => {
  "use strict";

  /** Depends on security-defaults.js (MAIN) loaded before this script. */

  let fbMergeNetworkFromStorage = typeof mergeNetworkFromStorage === "function" ? mergeNetworkFromStorage : null;
  let fbBlockedNetworkHostForMerge = typeof blockedNetworkHostForMerge === "function" ? blockedNetworkHostForMerge : null;
  let fbIsLocalOrPrivatePageHost = typeof isLocalOrPrivatePageHost === "function" ? isLocalOrPrivatePageHost : null;

  // Fallback: some pages/browsers may not inject `security-defaults.js` into MAIN world.
  // Keep Network Security functional by defining the minimum subset inline.
  if (!fbMergeNetworkFromStorage || !fbBlockedNetworkHostForMerge || !fbIsLocalOrPrivatePageHost) {
    const DEFAULT_NETWORK_SECURITY_FALLBACK = {
      networkSecurityEnabled: false,
      networkBlockPrivateIp: true,
      networkBlockLocalhost: true,
      networkBlockEmbeddedProbes: true,
      networkWebRtcProtectionEnabled: false,
      networkWebRtcPolicy: "default_public_interface_only",
    };

    const NETWORK_WEBRTC_POLICY_IDS_FALLBACK = ["default_public_interface_only", "disable_non_proxied_udp"];

    function normalizeHostnameForNetworkChecksFallback(hostRaw) {
      let h = String(hostRaw || "").trim().toLowerCase();
      if (!h) return "";
      return h.replace(/^\[+|\]+$/g, "").replace(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/, "$1");
    }

    function isIpv4OctetsFallback(parts) {
      if (!Array.isArray(parts) || parts.length !== 4) return false;
      return parts.every((p) => {
        const n = Number(p);
        return Number.isInteger(n) && n >= 0 && n <= 255;
      });
    }

    function isLocalhostNetworkHostFallback(hostRaw) {
      const host = normalizeHostnameForNetworkChecksFallback(hostRaw);
      if (!host) return false;
      if (host === "localhost") return true;
      if (host.endsWith(".localhost")) return true;
      if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;

      const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (m && isIpv4OctetsFallback([m[1], m[2], m[3], m[4]])) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        if (a === 127) return true;
        if (a === 0 && b === 0 && Number(m[3]) === 0 && Number(m[4]) === 0) return true;
      }
      return false;
    }

    function isPrivateIpv4NetworkHostFallback(hostRaw) {
      const host = normalizeHostnameForNetworkChecksFallback(hostRaw);
      if (!host) return false;

      const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (!m || !isIpv4OctetsFallback([m[1], m[2], m[3], m[4]])) return false;

      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      return false;
    }

    function isUniqueLocalIpv6Fallback(hostRaw) {
      const host = normalizeHostnameForNetworkChecksFallback(hostRaw);
      if (!host.includes(":")) return false;
      const collapsed = host.split(":")[0];
      if (!collapsed) return false;
      const first = collapsed.replace(/^0+/, "") || "0";
      return /^fd/i.test(first) || /^fc/i.test(first);
    }

    function isLinkLocalIpv6Fallback(hostRaw) {
      const host = normalizeHostnameForNetworkChecksFallback(hostRaw);
      if (!host.includes(":")) return false;
      return /^fe80/i.test(host);
    }

    function isTailscaleOrSimilarHostnameFallback(hostRaw) {
      const host = normalizeHostnameForNetworkChecksFallback(hostRaw);
      return host.endsWith(".ts.net") || host.endsWith(".tailscale.ts.net") || host.endsWith(".local");
    }

    // eslint-disable-next-line no-inner-declarations
    function isLocalOrPrivatePageHostFallback(hostname) {
      const h = normalizeHostnameForNetworkChecksFallback(hostname);
      if (!h) return false;
      if (isTailscaleOrSimilarHostnameFallback(h)) return true;
      if (isLocalhostNetworkHostFallback(h)) return true;
      if (isPrivateIpv4NetworkHostFallback(h)) return true;
      if (isLinkLocalIpv6Fallback(h) || isUniqueLocalIpv6Fallback(h)) return true;
      if (/^::$/.test(h) || /^::ffff:\d/.test(hostname)) return true;
      return false;
    }

    // eslint-disable-next-line no-inner-declarations
    function blockedNetworkHostForMergeFallback(hostRaw, merged) {
      const h = normalizeHostnameForNetworkChecksFallback(hostRaw);
      if (!h) return false;
      let block = false;
      if (merged.networkBlockPrivateIp && (isPrivateIpv4NetworkHostFallback(h) || isLinkLocalIpv6Fallback(h) || isUniqueLocalIpv6Fallback(h))) {
        block = true;
      }
      if (merged.networkBlockLocalhost && isLocalhostNetworkHostFallback(h)) {
        block = true;
      }
      return block;
    }

    // eslint-disable-next-line no-inner-declarations
    function mergeNetworkFromStorageFallback(result) {
      const d = DEFAULT_NETWORK_SECURITY_FALLBACK;
      const rawPolicy = typeof result.networkWebRtcPolicy === "string" ? result.networkWebRtcPolicy.trim() : d.networkWebRtcPolicy;
      const policy = NETWORK_WEBRTC_POLICY_IDS_FALLBACK.includes(rawPolicy) ? rawPolicy : d.networkWebRtcPolicy;
      return {
        networkSecurityEnabled: result.networkSecurityEnabled !== undefined ? !!result.networkSecurityEnabled : d.networkSecurityEnabled,
        networkBlockPrivateIp: result.networkBlockPrivateIp !== undefined ? !!result.networkBlockPrivateIp : d.networkBlockPrivateIp,
        networkBlockLocalhost: result.networkBlockLocalhost !== undefined ? !!result.networkBlockLocalhost : d.networkBlockLocalhost,
        networkBlockEmbeddedProbes: result.networkBlockEmbeddedProbes !== undefined ? !!result.networkBlockEmbeddedProbes : d.networkBlockEmbeddedProbes,
        networkWebRtcProtectionEnabled:
          result.networkWebRtcProtectionEnabled !== undefined
            ? !!result.networkWebRtcProtectionEnabled
            : d.networkWebRtcProtectionEnabled,
        networkWebRtcPolicy: policy,
      };
    }

    if (!fbMergeNetworkFromStorage) fbMergeNetworkFromStorage = mergeNetworkFromStorageFallback;
    if (!fbBlockedNetworkHostForMerge) fbBlockedNetworkHostForMerge = blockedNetworkHostForMergeFallback;
    if (!fbIsLocalOrPrivatePageHost) fbIsLocalOrPrivatePageHost = isLocalOrPrivatePageHostFallback;
  }

  const state = {
    isActive: false,
    merged: fbMergeNetworkFromStorage({}),
  };

  /** Fast MAIN-world boot: replay last bridge payload cached by settings-bridge. */
  try {
    const raw = localStorage.getItem("__focus_blocker_network_cache_v1");
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        const nw = obj.network && typeof obj.network === "object" ? obj.network : {};
        state.merged = fbMergeNetworkFromStorage(nw);
        if (typeof obj.isActive === "boolean") {
          state.isActive = obj.isActive;
        } else {
          state.isActive = !!state.merged.networkSecurityEnabled;
        }
      }
    }
  } catch (_e) {}

  /** Block third‑party probing from public origins into LAN/loopback. */
  function shouldInterceptOnThisPage() {
    return !!(state.isActive && !fbIsLocalOrPrivatePageHost(window.location.hostname));
  }

  function mergedNow() {
    return state.merged;
  }

  function bumpNet(delta, subKey) {
    try {
      const fn = globalThis.__focusBlockerStatsBump;
      if (typeof fn === "function")
        fn("netJs", typeof delta === "number" && delta > 0 ? delta : 1, typeof subKey === "string" ? subKey : undefined);
    } catch (_e) {}
  }

  function shouldEmbedBlock() {
    const m = mergedNow();
    return shouldInterceptOnThisPage() && !!m.networkBlockEmbeddedProbes && !!m.networkSecurityEnabled;
  }

  /** @param {string|URL} raw */
  function shouldTransportBlock(raw) {
    const m = mergedNow();
    if (!shouldInterceptOnThisPage() || !m.networkSecurityEnabled) return false;
    try {
      const u = typeof raw === "string" || raw instanceof URL ? new URL(raw, location.href) : null;
      if (!u || !u.hostname) return false;
      return !!(fbBlockedNetworkHostForMerge(u.hostname, m));
    } catch (_e) {
      return false;
    }
  }

  function denyTransport(urlString, label, statSubKey) {
    bumpNet(1, statSubKey || `transport_${String(label || "").replace(/\s+/g, "_")}`);
    const msg = `[Focus Blocker Network Security] Blocked ${label}: ${urlString}`;
    // eslint-disable-next-line no-console
    console.warn(msg);
    throw new DOMException(msg, "SecurityError");
  }

  const nativeFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  if (nativeFetch) {
    window.fetch = function fetchShim(input, init) {
      let urlStr = "";
      try {
        if (typeof input === "string") urlStr = input;
        else if (input instanceof URL) urlStr = input.href;
        else if (input && typeof input === "object" && "url" in input) urlStr = String(/** @type {{ url: unknown }}*/ (input).url);
      } catch (_e) {
        urlStr = "";
      }
      if (urlStr && shouldTransportBlock(urlStr)) {
        bumpNet(1, "fetch_private_or_local");
        return Promise.reject(new TypeError("[Focus Blocker Network Security] blocked local/private request"));
      }
      return nativeFetch(input, init);
    };
  }

  const nativeXhrOpen =
    typeof XMLHttpRequest !== "undefined" && XMLHttpRequest.prototype && typeof XMLHttpRequest.prototype.open === "function"
      ? XMLHttpRequest.prototype.open
      : null;
  if (nativeXhrOpen) {
    XMLHttpRequest.prototype.open = function openShim(_method, url) {
      if (typeof url === "string" && shouldTransportBlock(url)) {
        denyTransport(url, "XMLHttpRequest", "xhr_open_private_or_local");
      }
      return nativeXhrOpen.apply(this, arguments);
    };
  }

  const NativeWS = typeof WebSocket !== "undefined" ? WebSocket : null;
  if (NativeWS && NativeWS.prototype) {
    const NativeWSCtor = NativeWS;
    /** @suppress {duplicate} */
    function WebSocketCtorShim(url, protocols) {
      if (typeof url === "string" && shouldTransportBlock(url)) {
        denyTransport(url, "WebSocket", "websocket_private_or_local");
      }
      return protocols !== undefined ? new NativeWSCtor(url, protocols) : new NativeWSCtor(url);
    }
    WebSocketCtorShim.prototype = NativeWSCtor.prototype;
    WebSocketCtorShim.CONNECTING = NativeWSCtor.CONNECTING;
    WebSocketCtorShim.OPEN = NativeWSCtor.OPEN;
    WebSocketCtorShim.CLOSING = NativeWSCtor.CLOSING;
    WebSocketCtorShim.CLOSED = NativeWSCtor.CLOSED;
    /** @suppress {globalThis} */
    window.WebSocket = WebSocketCtorShim;
  }

  const nativeSendBeacon =
    typeof navigator.sendBeacon === "function" ? navigator.sendBeacon.bind(navigator) : null;
  if (nativeSendBeacon) {
    navigator.sendBeacon = function sendBeaconShim(url, data) {
      try {
        if (typeof url === "string" && shouldTransportBlock(url)) {
          bumpNet(1, "sendBeacon_private_or_local");
          return false;
        }
      } catch (_e) {
        return false;
      }
      return nativeSendBeacon(url, data);
    };
  }

  function coerceUrlProbe(value) {
    if (typeof value !== "string" || !value.length) return null;
    if (value.startsWith("#")) return null;
    const lower = value.trim().toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("mailto:")) return null;
    try {
      return new URL(value, location.href);
    } catch (_e) {
      return null;
    }
  }

  function violatesEmbed(url) {
    const m = mergedNow();
    if (!shouldEmbedBlock()) return false;
    try {
      if (!url || !url.hostname) return false;
      return !!(fbBlockedNetworkHostForMerge(url.hostname, m));
    } catch (_e) {
      return false;
    }
  }

  function patchHrefLikeSetter(proto, prop) {
    if (!proto) return;
    const od = Object.getOwnPropertyDescriptor(proto, prop);
    if (!od || typeof od.set !== "function") return;
    const nativeSet = od.set;
    try {
      Object.defineProperty(proto, prop, {
        configurable: od.configurable !== false,
        enumerable: od.enumerable !== false,
        get: od.get,
        set(val) {
          const u = coerceUrlProbe(typeof val === "string" ? val : "");
          if (u && violatesEmbed(u)) {
            bumpNet(1, `embed_${prop}_assign_blocked`);
            // eslint-disable-next-line no-console
            console.warn("[Focus Blocker Network Security] blocked embedded probe", prop);
            return nativeSet.call(this, prop === "data" ? "about:blank" : "");
          }
          return nativeSet.call(this, val);
        },
      });
    } catch (_e) {}
  }

  if (typeof HTMLImageElement !== "undefined") patchHrefLikeSetter(HTMLImageElement.prototype, "src");
  if (typeof HTMLIFrameElement !== "undefined") patchHrefLikeSetter(HTMLIFrameElement.prototype, "src");
  if (typeof HTMLEmbedElement !== "undefined") patchHrefLikeSetter(HTMLEmbedElement.prototype, "src");
  if (typeof HTMLObjectElement !== "undefined") patchHrefLikeSetter(HTMLObjectElement.prototype, "data");
  if (typeof HTMLSourceElement !== "undefined") patchHrefLikeSetter(HTMLSourceElement.prototype, "src");

  const nativeSetAttribute =
    typeof Element !== "undefined" && Element.prototype && typeof Element.prototype.setAttribute === "function"
      ? Element.prototype.setAttribute
      : null;
  if (nativeSetAttribute) {
    Element.prototype.setAttribute = function setAttributeShim(name, value) {
      const n = String(name || "").toLowerCase();
      if (
        typeof value === "string" &&
        shouldEmbedBlock() &&
        (n === "src" || n === "href" || n === "data")
      ) {
        const u = coerceUrlProbe(value);
        const tag = (this.tagName || "").toLowerCase();
        if (
          u &&
          violatesEmbed(u) &&
          (tag === "img" ||
            tag === "iframe" ||
            tag === "embed" ||
            tag === "object" ||
            tag === "source" ||
            tag === "track" ||
            tag === "audio" ||
            tag === "video")
        ) {
          bumpNet(1, `embed_setAttribute_${tag}_blocked`);
          // eslint-disable-next-line no-console
          console.warn("[Focus Blocker Network Security] blocked setAttribute probe", tag, value);
          if (tag === "object" || n === "data") return nativeSetAttribute.call(this, name, "about:blank");
          return nativeSetAttribute.call(this, name, "");
        }
      }
      return nativeSetAttribute.apply(this, arguments);
    };
  }

  /** @param {unknown} payload */
  function applyPayload(payload) {
    const p = payload && typeof payload === "object" ? /** @type {{ isActive?: boolean, network?: Record<string, unknown> }}*/ (payload) : {};
    state.isActive = !!p.isActive;
    state.merged = fbMergeNetworkFromStorage((p.network && typeof p.network === "object") ? p.network : {});
    try {
      localStorage.setItem(
        "__focus_blocker_network_cache_v1",
        JSON.stringify({
          v: 1,
          isActive: state.isActive,
          network: p.network && typeof p.network === "object" ? p.network : {},
          ts: Date.now(),
        })
      );
    } catch (_e) {}
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.type !== "FOCUS_BLOCKER_NETWORK_SETTINGS") return;
    applyPayload(event.data);
  });

  window.addEventListener("FOCUS_BLOCKER_NETWORK_SETTINGS_EVENT", (/** @type {CustomEvent} */ event) => {
    try {
      applyPayload(event && event.detail ? event.detail : {});
    } catch (_e) {}
  });

  try {
    window.postMessage({ type: "FOCUS_BLOCKER_REQUEST_SETTINGS" }, "*");
  } catch (_e) {}
})();
