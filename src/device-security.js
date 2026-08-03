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
      const fn =
        globalThis.__focusBlockerStatsBump ||
        (document.documentElement && document.documentElement.__focusBlockerStatsBump) ||
        (typeof Document !== "undefined" && Document.prototype && Document.prototype.__focusBlockerStatsBump);
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

  /**
   * Install a method shim as an accessor with a no-op setter.
   * Data properties with writable:false (via lockdown) throw TypeError when the
   * page does `MediaDevices.prototype.getUserMedia = …` — common in vendor
   * bundles. Silent ignore keeps our shim and avoids crashing the page.
   */
  function defineShimMethod(target, name, shimFn, assignStatKey) {
    defineProp(
      target,
      name,
      maybeLockdownDesc({
        configurable: true,
        enumerable: true,
        get: () => shimFn,
        set: () => {
          bumpDeviceThrottled(`assign:${name}`, 500, assignStatKey || `assign_${name}_ignored`);
        },
      })
    );
  }

  /**
   * Install a read-only-looking getter with a no-op setter.
   * Getter-only + lockdown (configurable:false) throws in strict mode on
   * `navigator.mediaDevices = …` / `window.localStorage = …`.
   */
  function defineGuardedGetter(target, name, getter, enumerable, assignStatKey) {
    defineProp(
      target,
      name,
      maybeLockdownDesc({
        configurable: true,
        enumerable: enumerable !== false,
        get: getter,
        set: () => {
          bumpDeviceThrottled(`assign:${name}`, 500, assignStatKey || `assign_${name}_ignored`);
        },
      })
    );
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

  /** Same name/shape browsers use when the user (or policy) denies cam/mic. */
  function makeNotAllowedError(msg) {
    try {
      return new DOMException(msg || "Permission denied", "NotAllowedError");
    } catch (_e) {
      const err = new Error(msg || "Permission denied");
      // @ts-ignore
      err.name = "NotAllowedError";
      return err;
    }
  }

  /** permissions.query() resolves with this shape when access is denied — sites expect resolve, not reject. */
  function makeDeniedPermissionStatus(name) {
    /** @type {any} */
    const status = {
      state: "denied",
      name: typeof name === "string" ? name : "",
      onchange: null,
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {
        return false;
      },
    };
    return status;
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
        defineGuardedGetter(Window.prototype, prop, getter, od.enumerable !== false, `window_assign_${prop}_ignored`);
      } catch (_e) {}
    }

    patchWindowStorageGetter("localStorage");
    patchWindowStorageGetter("sessionStorage");
  })();

  /* ---------------- IndexedDB ---------------- */
  (function patchIndexedDb() {
    if (typeof indexedDB === "undefined" || !indexedDB) return;

    function makeBlockedIdbRequest() {
      const err = makeSecurityError("[Focus Blocker Device Security] IndexedDB disabled");
      /** @type {any} */
      const req = {
        result: undefined,
        error: err,
        readyState: "done",
        source: null,
        transaction: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
        onupgradeneeded: null,
        addEventListener: function (type, listener) {
          if (type === "error" && typeof listener === "function") {
            queueMicrotask(() => {
              try {
                listener.call(req, { type: "error", target: req });
              } catch (_e) {}
            });
          }
        },
        removeEventListener: function () {},
        dispatchEvent: function () {
          return false;
        },
      };
      queueMicrotask(() => {
        try {
          if (typeof req.onerror === "function") req.onerror({ type: "error", target: req });
        } catch (_e) {}
      });
      return req;
    }

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
            // Async request error instead of sync throw — avoids uncaught
            // SecurityError in frameworks that wrap open() in promises poorly.
            return makeBlockedIdbRequest();
          }
          return native.apply(this, arguments);
        };
        defineShimMethod(tgt, name, shim, `indexedDB_assign_${name}_ignored`);
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
        defineGuardedGetter(Window.prototype, "indexedDB", getter, od.enumerable !== false, "window_assign_indexedDB_ignored");
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
        defineShimMethod(proto, name, shim, `CacheStorage_assign_${name}_ignored`);
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
        defineGuardedGetter(Window.prototype, "caches", getter, od.enumerable !== false, "window_assign_caches_ignored");
      }
    } catch (_e2) {}
  })();

  /* ---------------- Camera/Microphone (mediaDevices) ---------------- */
  (function patchMediaDevices() {
    // Hide camera/microphone only. Speakers (kind === "audiooutput") must stay
    // visible — emptying enumerateDevices broke site audio-device pickers.

    /** @type {WeakSet<object>} */
    const instancePatched = typeof WeakSet !== "undefined" ? new WeakSet() : null;

    const nativeEnumerate =
      typeof MediaDevices !== "undefined" && MediaDevices.prototype && typeof MediaDevices.prototype.enumerateDevices === "function"
        ? MediaDevices.prototype.enumerateDevices
        : null;
    const nativeGum =
      typeof MediaDevices !== "undefined" && MediaDevices.prototype && typeof MediaDevices.prototype.getUserMedia === "function"
        ? MediaDevices.prototype.getUserMedia
        : null;
    const nativeGdm =
      typeof MediaDevices !== "undefined" && MediaDevices.prototype && typeof MediaDevices.prototype.getDisplayMedia === "function"
        ? MediaDevices.prototype.getDisplayMedia
        : null;

    function isCaptureDeviceKind(kind) {
      const k = typeof kind === "string" ? kind.toLowerCase() : "";
      return k === "audioinput" || k === "videoinput";
    }

    function filterOutCaptureDevices(list) {
      const arr = Array.isArray(list) ? list : [];
      return arr.filter((d) => !isCaptureDeviceKind(d && d.kind));
    }

    function callNativeMedia(nativeFn, selfArg, args, onFail) {
      const ctx = getMediaDevicesContext(selfArg);
      if (!ctx || typeof nativeFn !== "function") return onFail();
      try {
        return nativeFn.apply(ctx, args);
      } catch (e) {
        if (isIllegalInvocationError(e)) {
          return onFail();
        }
        throw e;
      }
    }

    const shimEnumerate =
      typeof nativeEnumerate === "function"
        ? function enumerateDevicesShim() {
            const args = arguments;
            const selfArg = this;
            if (!enabled("deviceSecurityHideMediaDevices")) {
              return callNativeMedia(nativeEnumerate, selfArg, args, () => Promise.resolve([]));
            }
            // Keep audiooutput (speakers); drop microphone/camera entries only.
            return Promise.resolve(callNativeMedia(nativeEnumerate, selfArg, args, () => Promise.resolve([])))
              .then((list) => {
                bumpDeviceThrottled("mediaEnum", 300, "mediaDevices_enumerateDevices_filtered");
                return filterOutCaptureDevices(list);
              })
              .catch(() => {
                bumpDeviceThrottled("mediaEnum", 300, "mediaDevices_enumerateDevices_filtered");
                return [];
              });
          }
        : null;

    const shimGum =
      typeof nativeGum === "function"
        ? function getUserMediaShim() {
            if (enabled("deviceSecurityHideMediaDevices")) {
              bumpDevice(1, "mediaDevices_getUserMedia_reject");
              // Native-like denial — meeting apps handle NotAllowedError; branded
              // SecurityError/NotFoundError gets shipped to their Sentry.
              return Promise.reject(makeNotAllowedError("Permission denied"));
            }
            return callNativeMedia(nativeGum, this, arguments, () =>
              Promise.reject(makeNotAllowedError("Permission denied"))
            );
          }
        : null;

    const shimGdm = function getDisplayMediaShim() {
      if (enabled("deviceSecurityHideMediaDevices")) {
        bumpDevice(1, "mediaDevices_getDisplayMedia_reject");
        return Promise.reject(makeNotAllowedError("Permission denied"));
      }
      if (typeof nativeGdm !== "function") {
        return Promise.reject(makeNotAllowedError("Permission denied"));
      }
      return callNativeMedia(nativeGdm, this, arguments, () => Promise.reject(makeNotAllowedError("Permission denied")));
    };

    function patchMediaInstance(md) {
      if (!md || typeof md !== "object") return;
      if (instancePatched) {
        if (instancePatched.has(md)) return;
        instancePatched.add(md);
      }
      if (shimEnumerate) defineShimMethod(md, "enumerateDevices", shimEnumerate, "mediaDevices_assign_enumerateDevices_ignored");
      if (shimGum) defineShimMethod(md, "getUserMedia", shimGum, "mediaDevices_assign_getUserMedia_ignored");
      defineShimMethod(md, "getDisplayMedia", shimGdm, "mediaDevices_assign_getDisplayMedia_ignored");
    }

    try {
      const od = Object.getOwnPropertyDescriptor(Navigator.prototype, "mediaDevices");
      if (od && typeof od.get === "function") {
        const nativeGet = od.get;
        const getter = function () {
          if (enabled("deviceSecurityHideMediaDevices")) {
            bumpDeviceThrottled("mediaDevWin", 400, "navigator_mediaDevices_cam_mic_hidden");
          }
          const md = nativeGet.call(navigator);
          try {
            patchMediaInstance(md);
          } catch (_e) {}
          return md;
        };
        defineGuardedGetter(Navigator.prototype, "mediaDevices", getter, od.enumerable !== false, "navigator_assign_mediaDevices_ignored");
      }
    } catch (_e) {}

    try {
      if (typeof MediaDevices !== "undefined" && MediaDevices.prototype) {
        if (shimEnumerate) defineShimMethod(MediaDevices.prototype, "enumerateDevices", shimEnumerate, "mediaDevices_assign_enumerateDevices_ignored");
        if (shimGum) defineShimMethod(MediaDevices.prototype, "getUserMedia", shimGum, "mediaDevices_assign_getUserMedia_ignored");
        defineShimMethod(MediaDevices.prototype, "getDisplayMedia", shimGdm, "mediaDevices_assign_getDisplayMedia_ignored");
      }
    } catch (_e2) {}
  })();

  /* ---------------- Geolocation ---------------- */
  (function patchGeolocation() {
    // Keep the real geolocation object when hiding — returning undefined makes
    // pages crash on `navigator.geolocation.getCurrentPosition`. Method shims
    // enforce the block.
    try {
      const od = Object.getOwnPropertyDescriptor(Navigator.prototype, "geolocation");
      if (od && typeof od.get === "function") {
        const nativeGet = od.get;
        const getter = function () {
          if (enabled("deviceSecurityHideGeolocation")) {
            bumpDeviceThrottled("geoWin", 400, "navigator_geolocation_hidden");
          }
          return nativeGet.call(navigator);
        };
        defineGuardedGetter(Navigator.prototype, "geolocation", getter, od.enumerable !== false, "navigator_assign_geolocation_ignored");
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
          defineShimMethod(Geolocation.prototype, "getCurrentPosition", shim, "geolocation_assign_getCurrentPosition_ignored");
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
          defineShimMethod(Geolocation.prototype, "watchPosition", shimWatch, "geolocation_assign_watchPosition_ignored");
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
            // Resolve denied — rejecting with SecurityError makes Sentry noise and
            // breaks NavigatorPermissions init in meeting apps.
            return Promise.resolve(makeDeniedPermissionStatus(name));
          }
          if (enabled("deviceSecurityHideGeolocation") && name === "geolocation") {
            bumpDevice(1, "permissions_query_geolocation_blocked");
            return Promise.resolve(makeDeniedPermissionStatus(name));
          }
        } catch (_e) {}
        return nativeQuery(desc);
      };
      defineShimMethod(navigator.permissions, "query", shim, "permissions_assign_query_ignored");
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
  function fbReadChannelKey() {
    try {
      return (document && document.documentElement && document.documentElement.getAttribute("data-fb-k")) || "";
    } catch (_e) {
      return "";
    }
  }
  // Lazy: re-read on verify if empty — MAIN may load before the isolated bridge sets data-fb-k.
  let fbChannelKey = fbReadChannelKey();
  let fbLastSeq = 0;

  // Authentic payload = valid HMAC-SHA256 signature + strictly increasing seq (anti-replay).
  function fbVerifyPayload(payload) {
    if (!fbChannelApi) fbChannelApi = fbResolveChannelApi();
    if (!fbChannelKey) fbChannelKey = fbReadChannelKey();
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

  // Capture phase: registered at document_start, before page scripts can stopPropagation.
  window.addEventListener(
    "message",
    (event) => {
      if (event.source !== window || !event.data || event.data.type !== "FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS") return;
      if (!fbVerifyPayload(event.data)) return;
      applyPayload(event.data);
    },
    true
  );

  window.addEventListener(
    "FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS_EVENT",
    (event) => {
      try {
        const detail = event && event.detail ? event.detail : {};
        if (!fbVerifyPayload(detail)) return;
        applyPayload(detail);
      } catch (_e) {}
    },
    true
  );

  // In case settings-bridge posted before we subscribed.
  try {
    window.postMessage({ type: "FOCUS_BLOCKER_REQUEST_SETTINGS" }, "*");
  } catch (_e) {}
})();

