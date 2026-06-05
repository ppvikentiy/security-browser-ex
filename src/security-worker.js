(() => {
  "use strict";

  /** @type {{ isActive?: boolean, security?: Record<string, unknown>, host?: string } | null} */
  const boot =
    typeof self !== "undefined" && self && typeof self === "object" && "__focusBlockerSecurityBoot" in self
      ? /** @type {any} */ (self).__focusBlockerSecurityBoot
      : null;

  const state = {
    isActive: !!(boot && boot.isActive),
    security: boot && boot.security && typeof boot.security === "object" ? boot.security : null,
    host: boot && typeof boot.host === "string" ? boot.host : "",
  };

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function toFiniteNumber(v, fallback) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function clampInt(v, min, max, fallback) {
    const n = Math.round(toFiniteNumber(v, fallback));
    return clamp(n, min, max);
  }

  function isIllegalInvocationError(err) {
    if (!err) return false;
    const msg = typeof err.message === "string" ? err.message : "";
    return err.name === "TypeError" && /illegal invocation/i.test(msg);
  }

  function safeStr(v, fallback, maxLen = 240) {
    const s = typeof v === "string" ? v : v == null ? "" : String(v);
    const out = s.trim();
    if (!out) return fallback;
    return out.length > maxLen ? out.slice(0, maxLen) : out;
  }

  function spoofEnabled(flag) {
    return !!(state.isActive && state.security && state.security[flag]);
  }

  function hashStr(s) {
    let h = 2166136261;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* --- Timezone (Intl + Date.getTimezoneOffset) --- */
  const nativeIntlResolvedOptions =
    typeof Intl !== "undefined" &&
    Intl.DateTimeFormat &&
    typeof Intl.DateTimeFormat.prototype.resolvedOptions === "function"
      ? Intl.DateTimeFormat.prototype.resolvedOptions
      : null;

  if (nativeIntlResolvedOptions) {
    try {
      Intl.DateTimeFormat.prototype.resolvedOptions = function () {
        const r = nativeIntlResolvedOptions.apply(this, arguments);
        if (!spoofEnabled("securitySpoofTimezoneEnabled")) return r;
        const tzCfg =
          state.security && isPlainObject(state.security.securityTimezone) ? state.security.securityTimezone : null;
        const id = tzCfg && typeof tzCfg.timeZone === "string" && tzCfg.timeZone.trim() ? tzCfg.timeZone.trim() : r.timeZone;
        return { ...r, timeZone: id };
      };
    } catch (_e) {}
  }

  const nativeGetTimezoneOffset =
    typeof Date !== "undefined" && typeof Date.prototype.getTimezoneOffset === "function"
      ? Date.prototype.getTimezoneOffset
      : null;

  if (nativeGetTimezoneOffset) {
    try {
      Date.prototype.getTimezoneOffset = function () {
        if (!spoofEnabled("securitySpoofTimezoneEnabled")) return nativeGetTimezoneOffset.call(this);
        const tzCfg =
          state.security && isPlainObject(state.security.securityTimezone) ? state.security.securityTimezone : null;
        const n = tzCfg && typeof tzCfg.timezoneOffsetMinutes === "number" ? tzCfg.timezoneOffsetMinutes : null;
        return n != null && Number.isFinite(n) ? n : nativeGetTimezoneOffset.call(this);
      };
    } catch (_e2) {}
  }

  /* --- Worker navigator (strings + cpu) --- */
  function patchWorkerNavigatorString(prop, flag, cfgKey) {
    try {
      if (!self.navigator) return false;
      const nav = self.navigator;
      const proto = Object.getPrototypeOf(nav);
      const od = (proto && Object.getOwnPropertyDescriptor(proto, prop)) || Object.getOwnPropertyDescriptor(nav, prop);
      if (!od) return false;
      const nativeGet = typeof od.get === "function" ? od.get : null;
      const nativeVal = "value" in od ? od.value : "";
      const getter = function () {
        if (!spoofEnabled(flag)) return nativeGet ? nativeGet.call(nav) : nativeVal;
        const cfg = state.security && isPlainObject(state.security.securityNavigator) ? state.security.securityNavigator : null;
        const v = cfg && typeof cfg[cfgKey] === "string" ? cfg[cfgKey] : null;
        return v != null ? v : nativeGet ? nativeGet.call(nav) : nativeVal;
      };
      try {
        if (proto) {
          Object.defineProperty(proto, prop, { configurable: true, enumerable: od.enumerable !== false, get: getter });
          return true;
        }
      } catch (_e) {}
      try {
        Object.defineProperty(nav, prop, { configurable: true, enumerable: od.enumerable !== false, get: getter });
        return true;
      } catch (_e2) {
        return false;
      }
    } catch (_e3) {
      return false;
    }
  }

  function patchWorkerNavigatorNumber(prop, flag, key) {
    try {
      if (!self.navigator) return false;
      const nav = self.navigator;
      const proto = Object.getPrototypeOf(nav);
      const od = (proto && Object.getOwnPropertyDescriptor(proto, prop)) || Object.getOwnPropertyDescriptor(nav, prop);
      if (!od) return false;
      const nativeGet = typeof od.get === "function" ? od.get : null;
      const nativeVal = "value" in od ? od.value : undefined;
      const getter = function () {
        if (!spoofEnabled(flag)) return nativeGet ? nativeGet.call(nav) : nativeVal;
        const cpu = state.security && isPlainObject(state.security.securityCpu) ? state.security.securityCpu : null;
        const v = cpu && typeof cpu[key] === "number" ? cpu[key] : null;
        return v != null ? v : nativeGet ? nativeGet.call(nav) : nativeVal;
      };
      try {
        if (proto) {
          Object.defineProperty(proto, prop, { configurable: true, enumerable: od.enumerable !== false, get: getter });
          return true;
        }
      } catch (_e) {}
      try {
        Object.defineProperty(nav, prop, { configurable: true, enumerable: od.enumerable !== false, get: getter });
        return true;
      } catch (_e2) {
        return false;
      }
    } catch (_e3) {
      return false;
    }
  }

  patchWorkerNavigatorString("userAgent", "securitySpoofNavigatorEnabled", "userAgent");
  patchWorkerNavigatorString("platform", "securitySpoofNavigatorEnabled", "platform");
  patchWorkerNavigatorString("vendor", "securitySpoofNavigatorEnabled", "vendor");
  patchWorkerNavigatorNumber("hardwareConcurrency", "securitySpoofCpuEnabled", "hardwareConcurrency");
  patchWorkerNavigatorNumber("deviceMemory", "securitySpoofCpuEnabled", "deviceMemory");

  /* --- WebGL getParameter (worker-safe) --- */
  const WEBGL_PROFILE_POOL = [
    {
      vendor: "Google Inc. (Intel)",
      renderer: "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    {
      vendor: "Google Inc. (NVIDIA)",
      renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    {
      vendor: "Google Inc. (AMD)",
      renderer: "ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    { vendor: "Apple Inc.", renderer: "Apple GPU" },
    {
      vendor: "Google Inc. (Qualcomm)",
      renderer: "ANGLE (Qualcomm, Adreno (TM) 640 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    {
      vendor: "Google Inc. (Microsoft)",
      renderer: "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
  ];

  let sessionWebGlProfile = null;
  let tickWebGlProfile = null;

  function getWebGLProfile() {
    const sec = state.security;
    if (!sec || !sec.securityWebgl) return WEBGL_PROFILE_POOL[0];

    const base = {
      vendor: safeStr(sec.securityWebgl.vendor, WEBGL_PROFILE_POOL[0].vendor, 220),
      renderer: safeStr(sec.securityWebgl.renderer, WEBGL_PROFILE_POOL[0].renderer, 260),
    };

    const mode = sec.securityFpMode;
    const preset = sec.securityPreset;

    if (preset === "custom") return base;

    const hostKey = state.host || "worker";

    if (mode === "per_domain_deterministic") {
      const idx = hashStr(`${hostKey}|${preset}`) % WEBGL_PROFILE_POOL.length;
      return WEBGL_PROFILE_POOL[idx];
    }

    if (mode === "per_session_deterministic") {
      if (!sessionWebGlProfile) {
        const idx = Math.floor(Math.random() * WEBGL_PROFILE_POOL.length);
        sessionWebGlProfile = WEBGL_PROFILE_POOL[idx];
      }
      return sessionWebGlProfile;
    }

    if (!tickWebGlProfile) {
      const idx = Math.floor(Math.random() * WEBGL_PROFILE_POOL.length);
      tickWebGlProfile = WEBGL_PROFILE_POOL[idx];
      try {
        queueMicrotask(() => {
          tickWebGlProfile = null;
        });
      } catch (_e) {
        tickWebGlProfile = null;
      }
    }
    return tickWebGlProfile || WEBGL_PROFILE_POOL[0];
  }

  function patchWebGLContext(Ctor) {
    if (typeof Ctor === "undefined" || !Ctor.prototype || typeof Ctor.prototype.getParameter !== "function") return;
    const nativeGetParameter = Ctor.prototype.getParameter;
    try {
      Ctor.prototype.getParameter = function (pname) {
        if (!spoofEnabled("securitySpoofWebglEnabled")) return nativeGetParameter.call(this, pname);
        const gl = this;
        let ext = null;
        try {
          ext = gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
        } catch (_e) {
          ext = null;
        }
        const profile = getWebGLProfile();
        try {
          if (ext && pname === ext.UNMASKED_VENDOR_WEBGL) return profile.vendor;
          if (ext && pname === ext.UNMASKED_RENDERER_WEBGL) return profile.renderer;
        } catch (_e2) {}
        try {
          if (pname === gl.VENDOR) return profile.vendor;
          if (pname === gl.RENDERER) return profile.renderer;
        } catch (_e3) {}
        return nativeGetParameter.call(this, pname);
      };
    } catch (_e4) {}
  }

  patchWebGLContext(typeof WebGLRenderingContext !== "undefined" ? WebGLRenderingContext : undefined);
  patchWebGLContext(typeof WebGL2RenderingContext !== "undefined" ? WebGL2RenderingContext : undefined);

  /* --- OffscreenCanvas noise (getImageData + convertToBlob) --- */
  let canvasSessionSeed = null;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clampNoiseLevel(n) {
    const x = typeof n === "number" ? n : 4;
    return Math.min(50, Math.max(0, Math.round(x)));
  }

  function addNoiseToImageData(imgData, level) {
    const lv = clampNoiseLevel(level);
    if (lv <= 0 || !imgData || !imgData.data) return;

    const d = imgData.data;
    const sec = state.security;
    const mode = sec && sec.securityFpMode ? sec.securityFpMode : "random_each_call";
    const seedBaseHost = hashStr(state.host || "worker");

    if (mode === "per_session_deterministic" && canvasSessionSeed === null) {
      canvasSessionSeed = (Math.random() * 0xffffffff) >>> 0;
    }

    for (let i = 0; i < d.length; i += 4) {
      let amp;
      let n1;
      let n2;
      let n3;

      if (mode === "random_each_call") {
        amp = Math.max(1, Math.floor(Math.random() * (lv + 1)));
        n1 = (Math.random() - 0.5) * amp * 2;
        n2 = (Math.random() - 0.5) * amp * 2;
        n3 = (Math.random() - 0.5) * amp * 2;
      } else {
        const seedBase =
          mode === "per_domain_deterministic" ? seedBaseHost : canvasSessionSeed !== null ? canvasSessionSeed : seedBaseHost;
        const randAmp = mulberry32(seedBase + i * 131 + 17);
        amp = Math.max(1, Math.floor(randAmp() * (lv + 1)));
        const r1 = mulberry32(seedBase + i * 17 + 1);
        const r2 = mulberry32(seedBase + i * 17 + 2);
        const r3 = mulberry32(seedBase + i * 17 + 3);
        n1 = (r1() - 0.5) * amp * 2;
        n2 = (r2() - 0.5) * amp * 2;
        n3 = (r3() - 0.5) * amp * 2;
      }

      d[i] = Math.min(255, Math.max(0, Math.round(d[i] + n1)));
      d[i + 1] = Math.min(255, Math.max(0, Math.round(d[i + 1] + n2)));
      d[i + 2] = Math.min(255, Math.max(0, Math.round(d[i + 2] + n3)));
    }
  }

  const nativeOffscreenGetImageData =
    typeof OffscreenCanvasRenderingContext2D !== "undefined" &&
    OffscreenCanvasRenderingContext2D.prototype &&
    typeof OffscreenCanvasRenderingContext2D.prototype.getImageData === "function"
      ? OffscreenCanvasRenderingContext2D.prototype.getImageData
      : null;

  const nativeOffscreenPutImageData =
    typeof OffscreenCanvasRenderingContext2D !== "undefined" &&
    OffscreenCanvasRenderingContext2D.prototype &&
    typeof OffscreenCanvasRenderingContext2D.prototype.putImageData === "function"
      ? OffscreenCanvasRenderingContext2D.prototype.putImageData
      : null;

  const nativeOffscreenConvertToBlob =
    typeof OffscreenCanvas !== "undefined" &&
    OffscreenCanvas.prototype &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function"
      ? OffscreenCanvas.prototype.convertToBlob
      : null;

  if (nativeOffscreenGetImageData) {
    try {
      OffscreenCanvasRenderingContext2D.prototype.getImageData = function () {
        const img = nativeOffscreenGetImageData.apply(this, arguments);
        if (spoofEnabled("securitySpoofCanvasEnabled")) {
          const lvl =
            state.security && isPlainObject(state.security.securityCanvas) ? state.security.securityCanvas.noiseLevel : 4;
          addNoiseToImageData(img, lvl);
        }
        return img;
      };
    } catch (_e) {}
  }

  function withNoisyOffscreenCanvasCopy(offscreen, fn) {
    const ctx = offscreen && offscreen.getContext ? offscreen.getContext("2d") : null;
    const w = offscreen ? offscreen.width : 0;
    const h = offscreen ? offscreen.height : 0;
    if (!ctx || !w || !h || !nativeOffscreenGetImageData || !nativeOffscreenPutImageData) return fn(offscreen);
    try {
      const id = nativeOffscreenGetImageData.call(ctx, 0, 0, w, h);
      const lvl =
        state.security && isPlainObject(state.security.securityCanvas) ? state.security.securityCanvas.noiseLevel : 4;
      let copy;
      try {
        copy = new ImageData(new Uint8ClampedArray(id.data), id.width, id.height);
      } catch (_e2) {
        copy = ctx.createImageData(id);
        copy.data.set(id.data);
      }
      addNoiseToImageData(copy, lvl);
      const tmp = new OffscreenCanvas(w, h);
      const tctx = tmp.getContext("2d");
      if (!tctx) return fn(offscreen);
      nativeOffscreenPutImageData.call(tctx, copy, 0, 0);
      return fn(tmp);
    } catch (_e3) {
      return fn(offscreen);
    }
  }

  if (nativeOffscreenConvertToBlob && nativeOffscreenGetImageData && nativeOffscreenPutImageData) {
    try {
      OffscreenCanvas.prototype.convertToBlob = function (...args) {
        const fallbackBlob = () => {
          try {
            const blank = new OffscreenCanvas(1, 1);
            return nativeOffscreenConvertToBlob.call(blank, ...args);
          } catch (_e) {
            try {
              return Promise.resolve(new Blob());
            } catch (_e2) {
              return Promise.reject(_e2);
            }
          }
        };

        if (!spoofEnabled("securitySpoofCanvasEnabled")) {
          try {
            return nativeOffscreenConvertToBlob.apply(this, args);
          } catch (e) {
            if (isIllegalInvocationError(e)) {
              return fallbackBlob();
            }
            throw e;
          }
        }

        return withNoisyOffscreenCanvasCopy(this, (tmp) => {
          try {
            return nativeOffscreenConvertToBlob.apply(tmp, args);
          } catch (e) {
            if (isIllegalInvocationError(e)) {
              return fallbackBlob();
            }
            throw e;
          }
        });
      };
    } catch (_e) {}
  }
})();

