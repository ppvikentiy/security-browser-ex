(() => {
  "use strict";

  /** @type {{ isActive: boolean, cfg: any }} */
  const state = {
    // Fail-closed: start enabled until bridge says otherwise.
    isActive: true,
    cfg: {
      deviceSecurityEnabled: true,
      deviceSecurityBlockStorage: true,
      deviceSecurityBlockIndexedDb: true,
      deviceSecurityBlockCacheApi: true,
      deviceSecurityHideMediaDevices: true,
      deviceSecurityHideGeolocation: true,
      deviceSecurityLockdown: true,
    },
  };

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function normalizeCfg(inCfg) {
    const d = state.cfg;
    const c = isPlainObject(inCfg) ? inCfg : {};
    return {
      deviceSecurityEnabled: c.deviceSecurityEnabled !== undefined ? !!c.deviceSecurityEnabled : !!d.deviceSecurityEnabled,
      deviceSecurityBlockStorage: c.deviceSecurityBlockStorage !== undefined ? !!c.deviceSecurityBlockStorage : !!d.deviceSecurityBlockStorage,
      deviceSecurityBlockIndexedDb:
        c.deviceSecurityBlockIndexedDb !== undefined ? !!c.deviceSecurityBlockIndexedDb : !!d.deviceSecurityBlockIndexedDb,
      deviceSecurityBlockCacheApi:
        c.deviceSecurityBlockCacheApi !== undefined ? !!c.deviceSecurityBlockCacheApi : !!d.deviceSecurityBlockCacheApi,
      deviceSecurityHideMediaDevices:
        c.deviceSecurityHideMediaDevices !== undefined ? !!c.deviceSecurityHideMediaDevices : !!d.deviceSecurityHideMediaDevices,
      deviceSecurityHideGeolocation:
        c.deviceSecurityHideGeolocation !== undefined ? !!c.deviceSecurityHideGeolocation : !!d.deviceSecurityHideGeolocation,
      deviceSecurityLockdown: c.deviceSecurityLockdown !== undefined ? !!c.deviceSecurityLockdown : !!d.deviceSecurityLockdown,
    };
  }

  function enabled(flag) {
    return !!(state.isActive && state.cfg && state.cfg.deviceSecurityEnabled && state.cfg[flag]);
  }

  function bumpDevice(delta, subKey) {
    try {
      const fn = globalThis.__focusBlockerStatsBump;
      if (typeof fn === "function")
        fn("device", typeof delta === "number" && delta > 0 ? delta : 1, typeof subKey === "string" ? subKey : undefined);
    } catch (_e) {}
  }

  /** @type {Record<string, number>} */
  const deviceBumpThrottleAt = {};
  function bumpDeviceThrottled(key, ms, statSubKey) {
    const now = Date.now();
    const last = deviceBumpThrottleAt[key] || 0;
    if (now - last < ms) return;
    deviceBumpThrottleAt[key] = now;
    bumpDevice(1, statSubKey || key);
  }

  function defineProp(target, prop, desc) {
    try {
      Object.defineProperty(target, prop, desc);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function maybeLockdownDesc(desc) {
    if (!state.cfg || !state.cfg.deviceSecurityLockdown) return desc;
    const out = { ...desc };
    // If we can, prevent page scripts from overriding our hooks.
    out.configurable = false;
    if ("writable" in out) out.writable = false;
    return out;
  }

  function makeSecurityError(msg) {
    try {
      return new DOMException(msg, "SecurityError");
    } catch (_e) {
      const err = new Error(msg);
      // @ts-ignore
      err.name = "SecurityError";
      return err;
    }
  }

  function makeNotFoundError(msg) {
    try {
      return new DOMException(msg, "NotFoundError");
    } catch (_e) {
      const err = new Error(msg);
      // @ts-ignore
      err.name = "NotFoundError";
      return err;
    }
  }

  function isIllegalInvocationError(err) {
    if (!err) return false;
    const msg = typeof err.message === "string" ? err.message : "";
    return err.name === "TypeError" && /illegal invocation/i.test(msg);
  }

  function getMediaDevicesContext(self) {
    const maybeCtx =
      self && typeof self === "object" && typeof self.enumerateDevices === "function" && typeof self.getUserMedia === "function"
        ? self
        : navigator.mediaDevices;
    return maybeCtx || null;
  }

  /* ---------------- Storage (localStorage/sessionStorage) ---------------- */
  (function patchStorage() {
    if (typeof Storage === "undefined" || !Storage.prototype) return;

    function guardRead() {
      if (enabled("deviceSecurityBlockStorage")) return null;
      return undefined;
    }

    function guardWrite() {
      if (!enabled("deviceSecurityBlockStorage")) return false;
      bumpDevice(1, "storage_write_block");
      return true;
    }

    /** @type {Array<[string, Function]>} */
    const methods = [
      [
        "getItem",
        function getItemShim(key) {
          const r = guardRead();
          if (r !== undefined) {
            bumpDeviceThrottled("storageRead", 220, "storage_read_null");
            return r;
          }
          // @ts-ignore
          return native.getItem.call(this, key);
        },
      ],
      [
        "key",
        function keyShim(index) {
          const r = guardRead();
          if (r !== undefined) {
            bumpDeviceThrottled("storageRead", 220, "storage_read_null");
            return r;
          }
          // @ts-ignore
          return native.key.call(this, index);
        },
      ],
      [
        "setItem",
        function setItemShim(key, value) {
          if (guardWrite()) return undefined;
          // @ts-ignore
          return native.setItem.call(this, key, value);
        },
      ],
      [
        "removeItem",
        function removeItemShim(key) {
          if (guardWrite()) return undefined;
          // @ts-ignore
          return native.removeItem.call(this, key);
        },
      ],
      [
        "clear",
        function clearShim() {
          if (guardWrite()) return undefined;
          // @ts-ignore
          return native.clear.call(this);
        },
      ],
    ];

    const native = {
      getItem: Storage.prototype.getItem,
      key: Storage.prototype.key,
      setItem: Storage.prototype.setItem,
      removeItem: Storage.prototype.removeItem,
      clear: Storage.prototype.clear,
    };

    methods.forEach(([name, fn]) => {
      try {
        // Accessor with no-op setter to avoid TypeError on page attempts to overwrite.
        defineProp(
          Storage.prototype,
          name,
          maybeLockdownDesc({
            configurable: true,
            enumerable: true,
            get: () => fn,
            set: () => {
              bumpDeviceThrottled("storage_assign_block", 500, `storage_assign_${name}_ignored`);
            },
          })
        );
      } catch (_e) {}
    });

    // Best-effort: make window.localStorage / window.sessionStorage look absent.
    function patchWindowStorageGetter(prop) {
      try {
        const od = Object.getOwnPropertyDescriptor(Window.prototype, prop) || Object.getOwnPropertyDescriptor(window, prop);
        if (!od) return;
        const nativeGet = typeof od.get === "function" ? od.get : null;
        const getter = function () {
          if (enabled("deviceSecurityBlockStorage")) {
            bumpDeviceThrottled(`storageWin:${prop}`, 400, `window_${prop}_hidden`);
            return undefined;
          }
          return nativeGet ? nativeGet.call(window) : undefined;
        };
        defineProp(Window.prototype, prop, maybeLockdownDesc({ configurable: true, enumerable: od.enumerable !== false, get: getter }));
      } catch (_e) {}
    }

    patchWindowStorageGetter("localStorage");
    patchWindowStorageGetter("sessionStorage");
  })();

  /* ---------------- IndexedDB ---------------- */
  (function patchIndexedDb() {
    if (typeof indexedDB === "undefined" || !indexedDB) return;

    function patchIdbFactoryMethod(name) {
      try {
        const proto = Object.getPrototypeOf(indexedDB);
        const tgt = proto || indexedDB;
        const od = Object.getOwnPropertyDescriptor(tgt, name);
        const native = od && "value" in od && typeof od.value === "function" ? od.value : null;
        if (!native) return;
        const shim = function () {
          if (enabled("deviceSecurityBlockIndexedDb")) {
            bumpDevice(1, "indexedDB_factory_blocked");
            throw makeSecurityError("[Focus Blocker Device Security] IndexedDB disabled");
          }
          return native.apply(this, arguments);
        };
        defineProp(tgt, name, maybeLockdownDesc({ configurable: true, writable: true, value: shim }));
      } catch (_e) {}
    }

    patchIdbFactoryMethod("open");
    patchIdbFactoryMethod("deleteDatabase");

    // Best-effort: hide window.indexedDB.
    try {
      const od = Object.getOwnPropertyDescriptor(Window.prototype, "indexedDB");
      if (od && typeof od.get === "function") {
        const nativeGet = od.get;
        const getter = function () {
          if (enabled("deviceSecurityBlockIndexedDb")) {
            bumpDeviceThrottled("idbWin", 400, "window_indexedDB_hidden");
            return undefined;
          }
          return nativeGet.call(window);
        };
        defineProp(Window.prototype, "indexedDB", maybeLockdownDesc({ configurable: true, enumerable: od.enumerable !== false, get: getter }));
      }
    } catch (_e2) {}
  })();

  /* ---------------- Cache API (caches) ---------------- */
  (function patchCacheApi() {
    if (typeof caches === "undefined") return;

    function wrapCacheStorageMethod(name) {
      try {
        const proto = typeof CacheStorage !== "undefined" ? CacheStorage.prototype : null;
        if (!proto || typeof proto[name] !== "function") return;
        const native = proto[name];
        const shim = function () {
          if (enabled("deviceSecurityBlockCacheApi")) {
            bumpDevice(1, `CacheStorage_${name}_reject`);
            return Promise.reject(makeSecurityError("[Focus Blocker Device Security] Cache API disabled"));
          }
          return native.apply(this, arguments);
        };
        defineProp(proto, name, maybeLockdownDesc({ configurable: true, writable: true, value: shim }));
      } catch (_e) {}
    }

    ["open", "match", "keys", "delete", "has"].forEach(wrapCacheStorageMethod);

    // Best-effort: hide window.caches.
    try {
      const od = Object.getOwnPropertyDescriptor(Window.prototype, "caches");
      if (od && typeof od.get === "function") {
        const nativeGet = od.get;
        const getter = function () {
          if (enabled("deviceSecurityBlockCacheApi")) {
            bumpDeviceThrottled("cachesWin", 400, "window_caches_hidden");
            return undefined;
          }
          return nativeGet.call(window);
        };
        defineProp(Window.prototype, "caches", maybeLockdownDesc({ configurable: true, enumerable: od.enumerable !== false, get: getter }));
      }
    } catch (_e2) {}
  })();

  /* ---------------- Camera/Microphone (mediaDevices) ---------------- */
  (function patchMediaDevices() {
    // Hide navigator.mediaDevices as undefined where possible.
    try {
      const od = Object.getOwnPropertyDescriptor(Navigator.prototype, "mediaDevices");
      if (od && typeof od.get === "function") {
        const nativeGet = od.get;
        const getter = function () {
          if (enabled("deviceSecurityHideMediaDevices")) {
            bumpDeviceThrottled("mediaDevWin", 400, "navigator_mediaDevices_hidden");
            return undefined;
          }
          return nativeGet.call(navigator);
        };
        defineProp(Navigator.prototype, "mediaDevices", maybeLockdownDesc({ configurable: true, enumerable: od.enumerable !== false, get: getter }));
      }
    } catch (_e) {}

    // Fallbacks: even if we can't hide the property, make calls fail/empty.
    try {
      if (typeof MediaDevices !== "undefined" && MediaDevices.prototype) {
        if (typeof MediaDevices.prototype.enumerateDevices === "function") {
          const nativeEnum = MediaDevices.prototype.enumerateDevices;
          const shimEnum = function () {
            if (enabled("deviceSecurityHideMediaDevices")) {
              bumpDeviceThrottled("mediaEnum", 300, "mediaDevices_enumerateDevices_empty");
              return Promise.resolve([]);
            }
            const ctx = getMediaDevicesContext(this);
            if (!ctx) {
              return Promise.resolve([]);
            }
            try {
              return nativeEnum.apply(ctx, arguments);
            } catch (e) {
              if (isIllegalInvocationError(e)) {
                bumpDeviceThrottled("mediaEnum", 300, "mediaDevices_enumerateDevices_safe_fallback");
                return Promise.resolve([]);
              }
              throw e;
            }
          };
          defineProp(MediaDevices.prototype, "enumerateDevices", maybeLockdownDesc({ configurable: true, writable: true, value: shimEnum }));
        }
        if (typeof MediaDevices.prototype.getUserMedia === "function") {
          const nativeGum = MediaDevices.prototype.getUserMedia;
          const shimGum = function () {
            if (enabled("deviceSecurityHideMediaDevices")) {
              bumpDevice(1, "mediaDevices_getUserMedia_reject");
            }
            const ctx = getMediaDevicesContext(this);
            if (!ctx) {
              return Promise.reject(makeNotFoundError("[Focus Blocker Device Security] mediaDevices unavailable"));
            }
            try {
              return nativeGum.apply(ctx, arguments);
            } catch (e) {
              if (isIllegalInvocationError(e)) {
                bumpDevice(1, "mediaDevices_getUserMedia_illegal_invocation");
                return Promise.reject(makeSecurityError("[Focus Blocker Device Security] getUserMedia unavailable"));
              }
              throw e;
            }
          };
          defineProp(MediaDevices.prototype, "getUserMedia", maybeLockdownDesc({ configurable: true, writable: true, value: shimGum }));
        }
      }
    } catch (_e2) {}
  })();

  /* ---------------- Geolocation ---------------- */
  (function patchGeolocation() {
    // Hide navigator.geolocation as undefined where possible.
    try {
      const od = Object.getOwnPropertyDescriptor(Navigator.prototype, "geolocation");
      if (od && typeof od.get === "function") {
        const nativeGet = od.get;
        const getter = function () {
          if (enabled("deviceSecurityHideGeolocation")) {
            bumpDeviceThrottled("geoWin", 400, "navigator_geolocation_hidden");
            return undefined;
          }
          return nativeGet.call(navigator);
        };
        defineProp(Navigator.prototype, "geolocation", maybeLockdownDesc({ configurable: true, enumerable: od.enumerable !== false, get: getter }));
      }
    } catch (_e) {}

    // Fallback: patch Geolocation methods to always error.
    try {
      if (typeof Geolocation !== "undefined" && Geolocation.prototype) {
        const nativeGetCurrent = Geolocation.prototype.getCurrentPosition;
        if (typeof nativeGetCurrent === "function") {
          const shim = function (success, error, options) {
            if (!enabled("deviceSecurityHideGeolocation")) return nativeGetCurrent.call(this, success, error, options);
            bumpDevice(1, "geolocation_getCurrentPosition_blocked");
            if (typeof error === "function") {
              // 2 == POSITION_UNAVAILABLE (common failure)
              error({ code: 2, message: "Position unavailable" });
            }
          };
          defineProp(Geolocation.prototype, "getCurrentPosition", maybeLockdownDesc({ configurable: true, writable: true, value: shim }));
        }
        const nativeWatch = Geolocation.prototype.watchPosition;
        if (typeof nativeWatch === "function") {
          const shimWatch = function (success, error, options) {
            if (!enabled("deviceSecurityHideGeolocation")) return nativeWatch.call(this, success, error, options);
            bumpDevice(1, "geolocation_watchPosition_blocked");
            if (typeof error === "function") {
              error({ code: 2, message: "Position unavailable" });
            }
            return -1;
          };
          defineProp(Geolocation.prototype, "watchPosition", maybeLockdownDesc({ configurable: true, writable: true, value: shimWatch }));
        }
      }
    } catch (_e2) {}
  })();

  /* ---------------- Permissions ---------------- */
  (function patchPermissions() {
    try {
      if (!navigator.permissions || typeof navigator.permissions.query !== "function") return;
      const nativeQuery = navigator.permissions.query.bind(navigator.permissions);
      const shim = function (desc) {
        try {
          const name = desc && typeof desc === "object" ? String(desc.name || "") : "";
          if (enabled("deviceSecurityHideMediaDevices") && (name === "camera" || name === "microphone")) {
            bumpDevice(1, "permissions_query_camera_mic_blocked");
            return Promise.reject(makeSecurityError("[Focus Blocker Device Security] permission query blocked"));
          }
          if (enabled("deviceSecurityHideGeolocation") && name === "geolocation") {
            bumpDevice(1, "permissions_query_geolocation_blocked");
            return Promise.reject(makeSecurityError("[Focus Blocker Device Security] permission query blocked"));
          }
        } catch (_e) {}
        return nativeQuery(desc);
      };
      defineProp(navigator.permissions, "query", maybeLockdownDesc({ configurable: true, writable: true, value: shim }));
    } catch (_e2) {}
  })();

  /* ---------------- Settings updates from bridge ---------------- */
  function applyPayload(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    state.isActive = !!p.isActive;
    state.cfg = normalizeCfg(p.deviceSecurity || null);
  }

  // Fail-closed: start enabled; only an HMAC-authenticated payload may change it.
  // Do not trust page-localStorage cache for deciding isActive.

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
    if (event.source !== window || !event.data || event.data.type !== "FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS") return;
    if (!fbVerifyPayload(event.data)) return;
    applyPayload(event.data);
  });

  window.addEventListener("FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS_EVENT", (event) => {
    try {
      const detail = event && event.detail ? event.detail : {};
      if (!fbVerifyPayload(detail)) return;
      applyPayload(detail);
    } catch (_e) {}
  });

  // In case settings-bridge posted before we subscribed.
  try {
    window.postMessage({ type: "FOCUS_BLOCKER_REQUEST_SETTINGS" }, "*");
  } catch (_e) {}
})();

