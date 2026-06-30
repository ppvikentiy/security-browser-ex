(() => {
  "use strict";

  const FB_REQUEST_SETTINGS_TYPE = "FOCUS_BLOCKER_REQUEST_SETTINGS";
  const FB_SETTINGS_TYPE = "FOCUS_BLOCKER_SETTINGS";
  const FB_SETTINGS_EVENT = "FOCUS_BLOCKER_SETTINGS_EVENT";
  const FB_SETTINGS_ACK_TYPE = "FOCUS_BLOCKER_SETTINGS_ACK";
  const FB_SETTINGS_ACK_EVENT = "FOCUS_BLOCKER_SETTINGS_ACK_EVENT";
  const FB_REQUEST_SETTINGS_EVENT = "FOCUS_BLOCKER_REQUEST_SETTINGS_EVENT";
  const FB_FOCUS_CACHE_KEY = "__focus_blocker_focus_cache_v1";

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

  let BLOCKED_EVENTS = new Set(DEFAULT_BLOCKED_EVENTS);
  let isEnabled = false;
  let gotSettingsFromBridge = false;
  let ackSent = false;

  function bumpFocus(delta, subKey) {
    try {
      const fn = globalThis.__focusBlockerStatsBump;
      if (typeof fn === "function")
        fn("focus", typeof delta === "number" && delta > 0 ? delta : 1, typeof subKey === "string" ? subKey : undefined);
    } catch (_e) {}
  }

  /** @type {Record<string, number>} */
  const focusBumpThrottleAt = {};
  function bumpFocusThrottled(throttleKey, ms, statSub) {
    if (!isEnabled) return;
    const now = Date.now();
    const last = focusBumpThrottleAt[throttleKey] || 0;
    if (now - last < ms) return;
    focusBumpThrottleAt[throttleKey] = now;
    bumpFocus(1, typeof statSub === "string" ? statSub : throttleKey);
  }

  /** @type {Record<string, number>} */
  const blockedEvtLast = {};
  function bumpBlockedDomEvent(eventType) {
    const now = Date.now();
    const last = blockedEvtLast[eventType] || 0;
    if (now - last < 40) return;
    blockedEvtLast[eventType] = now;
    bumpFocus(1, `capture_DOM_${eventType}`);
  }

  function getPropertyDescriptor(obj, prop) {
    let cur = obj;
    while (cur) {
      const desc = Object.getOwnPropertyDescriptor(cur, prop);
      if (desc) return desc;
      cur = Object.getPrototypeOf(cur);
    }
    return undefined;
  }

  function normalizeBlockedEvents(raw) {
    const list = Array.isArray(raw) ? raw : DEFAULT_BLOCKED_EVENTS;
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const s = typeof list[i] === "string" ? list[i].trim().toLowerCase() : "";
      if (s) out.push(s);
    }
    return out.length ? out : DEFAULT_BLOCKED_EVENTS.slice();
  }

  function applyFocusSettings(blockedEventsRaw, enabledRaw, fromBridge) {
    BLOCKED_EVENTS = new Set(normalizeBlockedEvents(blockedEventsRaw));
    isEnabled = !!enabledRaw;

    if (isEnabled) updateBlockedHandlers();
    else removeBlockedHandlers();

    if (fromBridge) {
      gotSettingsFromBridge = true;
      if (!ackSent) {
        ackSent = true;
        try {
          window.postMessage({ type: FB_SETTINGS_ACK_TYPE, ok: true }, "*");
        } catch (_e) {}
        try {
          window.dispatchEvent(new CustomEvent(FB_SETTINGS_ACK_EVENT, { detail: { ok: true } }));
        } catch (_e2) {}
      }
    }
  }

  function requestSettingsResend() {
    try {
      window.postMessage({ type: FB_REQUEST_SETTINGS_TYPE }, "*");
    } catch (_e) {}
    try {
      window.dispatchEvent(new CustomEvent(FB_REQUEST_SETTINGS_EVENT, { detail: { v: 1 } }));
    } catch (_e2) {}
  }

  function tryApplyCachedSettings() {
    // Best-effort: cache can be unavailable if Device Security blocks storage.
    try {
      const raw = localStorage.getItem(FB_FOCUS_CACHE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return;
      const blockedEvents = obj.blockedEvents;
      const enabled = obj.isEnabled;
      // Apply as a temporary state; keep requesting real settings from the bridge.
      applyFocusSettings(blockedEvents, enabled, false);
    } catch (_e) {}
  }

  const nativeAddEventListener = EventTarget.prototype.addEventListener;
  const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
  const nativeDispatchEvent = EventTarget.prototype.dispatchEvent;

  /**
   * Страницы вроде vk.com задают Permissions-Policy: unload=(). Наш перехватчик видит все add/removeEventListener,
   * и нативный вызов бросает — без try/catch в консоли «Permissions policy violation: unload is not allowed».
   */
  function forwardEventTargetListener(method, selfArg, type, restArgs) {
    const t = typeof type === "string" ? type.trim().toLowerCase() : "";
    // Avoid invoking native listeners that will immediately violate a page's
    // permissions policy (e.g., unload=()). Skipping the native call prevents
    // noisy console errors while keeping behavior unchanged for callers.
    if (t === "unload" || t === "beforeunload") {
      return undefined;
    }
    try {
      return method.apply(selfArg, [type, ...restArgs]);
    } catch (e) {
      const msg = e && typeof e.message === "string" ? e.message : String(e || "");
      if (/permissions? policy violation/i.test(msg)) {
        return undefined;
      }
      throw e;
    }
  }

  const eventInterceptor = function (method, statSub) {
    return function (type, ...args) {
      if (isEnabled && typeof type === "string" && BLOCKED_EVENTS.has(type.toLowerCase())) {
        bumpFocus(1, statSub);
        return;
      }
      return forwardEventTargetListener(method, this, type, args);
    };
  };

  EventTarget.prototype.addEventListener = eventInterceptor(nativeAddEventListener, "EventTarget_addEventListener_block");
  EventTarget.prototype.removeEventListener = eventInterceptor(nativeRemoveEventListener, "EventTarget_removeEventListener_block");

  EventTarget.prototype.dispatchEvent = function (event) {
    if (isEnabled && event && typeof event.type === "string" && BLOCKED_EVENTS.has(event.type.toLowerCase())) {
      bumpFocus(1, "EventTarget_dispatchEvent_block");
      return true;
    }
    return nativeDispatchEvent.call(this, event);
  };

  const visibilityProps = {
    hidden: false,
    mozHidden: false,
    webkitHidden: false,
    msHidden: false,
    visibilityState: "visible",
    mozVisibilityState: "visible",
    webkitVisibilityState: "visible",
    msVisibilityState: "visible",
  };

  for (const [prop, value] of Object.entries(visibilityProps)) {
    if (prop in document) {
      const originalDescriptor = getPropertyDescriptor(document, prop);
      Object.defineProperty(document, prop, {
        get: () => {
          if (isEnabled) {
            bumpFocusThrottled(`vis:${prop}`, 200, `document_visibility_${prop}`);
            return value;
          }
          if (originalDescriptor && typeof originalDescriptor.get === "function") {
            return originalDescriptor.get.call(document);
          }
          if (originalDescriptor && "value" in originalDescriptor) {
            return originalDescriptor.value;
          }
          return undefined;
        },
        set: (nextValue) => {
          if (!isEnabled && originalDescriptor && typeof originalDescriptor.set === "function") {
            originalDescriptor.set.call(document, nextValue);
          }
        },
        configurable: true,
        enumerable: true,
      });
    }
  }

  const originalHasFocus = document.hasFocus;
  const originalWindowFocus = window.focus;
  const originalWindowBlur = window.blur;
  
  document.hasFocus = () => {
    if (isEnabled) {
      bumpFocusThrottled("hasFocus", 200, "document_hasFocus_spoof");
      return true;
    }
    return originalHasFocus.call(document);
  };
  window.focus = function () {
    if (!isEnabled) originalWindowFocus.call(this);
    else bumpFocusThrottled("winfocus", 400, "window_focus_suppressed");
  };
  window.blur = function () {
    if (!isEnabled) originalWindowBlur.call(this);
    else bumpFocusThrottled("winblur", 400, "window_blur_suppressed");
  };

  const blockInlineHandler = (obj, prop, eventTypeKey) => {
    const eventKey = typeof eventTypeKey === "string" ? eventTypeKey.trim().toLowerCase() : "";
    if (!eventKey) return;

    const originalDescriptor = getPropertyDescriptor(obj, prop);
    let storedValue;
    try {
      storedValue = obj[prop];
    } catch (e) {
      storedValue = undefined;
    }

    Object.defineProperty(obj, prop, {
      get: () => {
        const block = isEnabled && BLOCKED_EVENTS.has(eventKey);
        if (block) {
          bumpFocusThrottled(`inline:${prop}`, 250, `inline_handler_${prop}`);
          return null;
        }
        if (originalDescriptor && typeof originalDescriptor.get === "function") {
          return originalDescriptor.get.call(obj);
        }
        if (originalDescriptor && "value" in originalDescriptor) {
          return originalDescriptor.value;
        }
        return storedValue;
      },
      set: (value) => {
        if (isEnabled && BLOCKED_EVENTS.has(eventKey)) return;
        storedValue = value;
        if (originalDescriptor && typeof originalDescriptor.set === "function") {
          originalDescriptor.set.call(obj, value);
        }
      },
      configurable: true,
    });
  };

  blockInlineHandler(window, "onblur", "blur");
  blockInlineHandler(window, "onfocus", "focus");
  blockInlineHandler(document, "onvisibilitychange", "visibilitychange");

  try {
    if ("onpageshow" in window) blockInlineHandler(window, "onpageshow", "pageshow");
    if ("onpagehide" in window) blockInlineHandler(window, "onpagehide", "pagehide");
    if ("onfreeze" in document) blockInlineHandler(document, "onfreeze", "freeze");
    if ("onresume" in document) blockInlineHandler(document, "onresume", "resume");
  } catch (_e) {}

  const blockedHandlers = new Map();

  const updateBlockedHandlers = () => {
    removeBlockedHandlers();

    if (!isEnabled) return;

    BLOCKED_EVENTS.forEach((eventType) => {
      const windowHandler = (e) => {
        bumpBlockedDomEvent(`w:${eventType}`);
        e.stopImmediatePropagation();
        e.preventDefault();
      };
      const documentHandler = (e) => {
        bumpBlockedDomEvent(`d:${eventType}`);
        e.stopImmediatePropagation();
        e.preventDefault();
      };

      nativeAddEventListener.call(window, eventType, windowHandler, true);
      nativeAddEventListener.call(document, eventType, documentHandler, true);

      blockedHandlers.set(`window:${eventType}`, windowHandler);
      blockedHandlers.set(`document:${eventType}`, documentHandler);
    });
  };

  const removeBlockedHandlers = () => {
    blockedHandlers.forEach((handler, key) => {
      const [target, eventType] = key.split(":");
      const targetObj = target === "window" ? window : document;
      nativeRemoveEventListener.call(targetObj, eventType, handler, true);
    });
    blockedHandlers.clear();
  };

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

  // --- Settings from bridge (postMessage + CustomEvent) ---
  window.addEventListener(
    "message",
    (event) => {
      if (event.source !== window || !event.data || event.data.type !== FB_SETTINGS_TYPE) return;
      if (!fbVerifyPayload(event.data)) return;
      applyFocusSettings(event.data.blockedEvents, event.data.isEnabled, true);
    },
    true
  );

  window.addEventListener(
    FB_SETTINGS_EVENT,
    (event) => {
      try {
        const detail = event && event.detail ? event.detail : null;
        if (!detail || detail.type !== FB_SETTINGS_TYPE) return;
        if (!fbVerifyPayload(detail)) return;
        applyFocusSettings(detail.blockedEvents, detail.isEnabled, true);
      } catch (_e) {}
    },
    true
  );

  // In case settings-bridge posted before we subscribed (or postMessage got interfered with).
  requestSettingsResend();
  // Small backoff retries until we get a real bridge payload.
  [50, 250, 1000, 2500].forEach((ms) => {
    setTimeout(() => {
      if (!gotSettingsFromBridge) requestSettingsResend();
    }, ms);
  });

  // Cache fallback if bridge delivery is delayed/missed.
  setTimeout(() => {
    if (!gotSettingsFromBridge) tryApplyCachedSettings();
  }, 200);
})();
