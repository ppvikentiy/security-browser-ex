(() => {
  "use strict";

  /** @type {{ isActive: boolean, security: Record<string, unknown> | null }} */
  const state = {
    // Fail-closed: start active so the page doesn't see native values
    // before settings-bridge delivers the real config.
    isActive: true,
    security: null,
  };

  /** Full URL (chrome-extension://.../src/security-worker.js), provided by settings-bridge. */
  let workerScriptUrl = "";

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

  /**
   * Lockdown getter descriptor with a no-op setter.
   * Getter-only + configurable:false throws TypeError in strict mode when the
   * page assigns (e.g. `navigator.userAgent = …`, `window.innerWidth = …`).
   */
  function lockedGetterDesc(enumerable, getter) {
    return {
      configurable: false,
      enumerable: enumerable !== false,
      get: getter,
      set() {},
    };
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

  const DEFAULTS = {
    fpMode: "random_each_call",
    preset: "desktop",
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      devicePixelRatio: 1,
      innerWidth: 1920,
      innerHeight: 969,
      outerWidth: 1920,
      outerHeight: 1080,
    },
    battery: { level: 0.92, charging: false, chargingTime: Infinity, dischargingTime: 7200 },
    cpu: { hardwareConcurrency: 8, deviceMemory: 8 },
    webgl: {
      vendor: "Google Inc. (Intel)",
      renderer: "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    canvas: { noiseLevel: 4 },
    timezone: { timeZone: "Europe/Berlin", timezoneOffsetMinutes: null },
    navigator: {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      appVersion:
        "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      platform: "Win32",
      vendor: "Google Inc.",
      language: "en-US",
      languages: ["en-US", "en"],
      uaDataMobile: false,
      uaDataPlatform: "Windows",
      uaDataBrands: [
        { brand: "Google Chrome", version: "120" },
        { brand: "Chromium", version: "120" },
        { brand: "Not;A=Brand", version: "99" },
      ],
      uaDataHighEntropy: {},
    },
    fonts: { families: [], measureTextEpsilon: 0 },
  };

  // Fail-closed boot: apply strict spoofing immediately.
  // settings-bridge can later disable it (spoofEnabled() checks state on each call).
  try {
    state.security =
      normalizeSecurity({
        securityEnabled: true,
        securitySpoofScreenEnabled: true,
        securitySpoofBatteryEnabled: true,
        securitySpoofCpuEnabled: true,
        securitySpoofMatchMediaEnabled: true,
        securitySpoofWebglEnabled: true,
        securitySpoofCanvasEnabled: true,
        securitySpoofTimezoneEnabled: true,
        securitySpoofNavigatorEnabled: true,
        securitySpoofLanguagesEnabled: true,
        securitySpoofFontsEnabled: true,
        securityPreset: DEFAULTS.preset,
        securityFpMode: DEFAULTS.fpMode,
        securityScreen: DEFAULTS.screen,
        securityBattery: DEFAULTS.battery,
        securityCpu: DEFAULTS.cpu,
        securityWebgl: DEFAULTS.webgl,
        securityCanvas: DEFAULTS.canvas,
        securityTimezone: DEFAULTS.timezone,
        securityNavigator: DEFAULTS.navigator,
        securityFonts: {
          families: [
            "arial",
            "helvetica",
            "times new roman",
            "courier new",
            "verdana",
            "georgia",
            "trebuchet ms",
            "impact",
            "segoe ui",
          ],
          measureTextEpsilon: 0,
        },
      }) || null;
  } catch (_e) {
    state.security = state.security || null;
  }

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
    {
      vendor: "Apple Inc.",
      renderer: "Apple GPU",
    },
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

  function hashStr(s) {
    let h = 2166136261;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  let tickWebGlProfile = null;

  function normalizeSecurity(secIn) {
    if (!isPlainObject(secIn)) return null;

    const fpModeRaw = safeStr(secIn.securityFpMode, DEFAULTS.fpMode, 64);
    const fpMode =
      fpModeRaw === "per_domain_deterministic" || fpModeRaw === "per_session_deterministic" || fpModeRaw === "random_each_call"
        ? fpModeRaw
        : DEFAULTS.fpMode;

    const presetRaw = safeStr(secIn.securityPreset, DEFAULTS.preset, 32);
    const preset = presetRaw === "laptop" || presetRaw === "desktop" || presetRaw === "mobile" || presetRaw === "custom" ? presetRaw : DEFAULTS.preset;

    const screenIn = isPlainObject(secIn.securityScreen) ? secIn.securityScreen : {};
    const width = clampInt(screenIn.width, 1, 20000, DEFAULTS.screen.width);
    const height = clampInt(screenIn.height, 1, 20000, DEFAULTS.screen.height);
    const availWidth = clampInt(screenIn.availWidth, 1, width, DEFAULTS.screen.availWidth);
    const availHeight = clampInt(screenIn.availHeight, 1, height, DEFAULTS.screen.availHeight);
    const dpr = clamp(toFiniteNumber(screenIn.devicePixelRatio, DEFAULTS.screen.devicePixelRatio), 0.25, 8);
    const innerWidth = clampInt(screenIn.innerWidth, 1, 20000, DEFAULTS.screen.innerWidth);
    const innerHeight = clampInt(screenIn.innerHeight, 1, 20000, DEFAULTS.screen.innerHeight);
    const outerWidth = clampInt(screenIn.outerWidth, 1, 20000, DEFAULTS.screen.outerWidth);
    const outerHeight = clampInt(screenIn.outerHeight, 1, 20000, DEFAULTS.screen.outerHeight);

    const batteryIn = isPlainObject(secIn.securityBattery) ? secIn.securityBattery : {};
    const batLevel = clamp(toFiniteNumber(batteryIn.level, DEFAULTS.battery.level), 0, 1);
    const charging = !!batteryIn.charging;
    const chargingTime = toFiniteNumber(batteryIn.chargingTime, DEFAULTS.battery.chargingTime);
    const dischargingTime = toFiniteNumber(batteryIn.dischargingTime, DEFAULTS.battery.dischargingTime);

    const cpuIn = isPlainObject(secIn.securityCpu) ? secIn.securityCpu : {};
    const hardwareConcurrency = clampInt(cpuIn.hardwareConcurrency, 1, 128, DEFAULTS.cpu.hardwareConcurrency);
    const deviceMemory = clamp(toFiniteNumber(cpuIn.deviceMemory, DEFAULTS.cpu.deviceMemory), 0.25, 64);

    const webglIn = isPlainObject(secIn.securityWebgl) ? secIn.securityWebgl : {};
    const vendor = safeStr(webglIn.vendor, DEFAULTS.webgl.vendor, 220);
    const renderer = safeStr(webglIn.renderer, DEFAULTS.webgl.renderer, 260);

    const canvasIn = isPlainObject(secIn.securityCanvas) ? secIn.securityCanvas : {};
    const noiseLevel = clampInt(canvasIn.noiseLevel, 0, 50, DEFAULTS.canvas.noiseLevel);

    const timezoneIn = isPlainObject(secIn.securityTimezone) ? secIn.securityTimezone : {};
    const timeZoneRaw = safeStr(timezoneIn.timeZone, DEFAULTS.timezone.timeZone, 64);
    let timeZone = timeZoneRaw;
    try {
      // Validate IANA id. If invalid, fallback to default.
      // eslint-disable-next-line no-new
      new Intl.DateTimeFormat("en-US", { timeZone });
    } catch (e) {
      timeZone = DEFAULTS.timezone.timeZone;
    }
    const tzOffsetRaw = timezoneIn.timezoneOffsetMinutes;
    const tzOffsetIsAuto = tzOffsetRaw === null || tzOffsetRaw === undefined || tzOffsetRaw === "";
    const timezoneOffsetMinutes = tzOffsetIsAuto
      ? null
      : clampInt(tzOffsetRaw, -14 * 60, 14 * 60, DEFAULTS.timezone.timezoneOffsetMinutes);

    const navIn = isPlainObject(secIn.securityNavigator) ? secIn.securityNavigator : {};
    const userAgent = safeStr(navIn.userAgent, DEFAULTS.navigator.userAgent, 1000);
    const appVersion = safeStr(navIn.appVersion, DEFAULTS.navigator.appVersion, 1000);
    const platform = safeStr(navIn.platform, DEFAULTS.navigator.platform, 80);
    const vendorNav = safeStr(navIn.vendor, DEFAULTS.navigator.vendor, 80);
    const uaDataMobile = !!navIn.uaDataMobile;
    const uaDataPlatform = safeStr(navIn.uaDataPlatform, DEFAULTS.navigator.uaDataPlatform, 80);

    function canonicalizeLocaleTag(tag, fallback) {
      const raw = safeStr(tag, fallback, 64);
      if (!raw) return fallback;
      if (!/^[A-Za-z0-9-]+$/.test(raw)) return fallback;
      try {
        if (typeof Intl !== "undefined" && typeof Intl.getCanonicalLocales === "function") {
          const out = Intl.getCanonicalLocales([raw]);
          if (Array.isArray(out) && out[0]) return String(out[0]);
        }
      } catch (_e) {}
      return raw;
    }

    function normalizeLocaleList(listRaw, primary) {
      const list = Array.isArray(listRaw) ? listRaw : [];
      const out = [];
      const seen = new Set();
      for (let i = 0; i < list.length; i++) {
        const v = canonicalizeLocaleTag(list[i], "");
        if (!v) continue;
        const k = v.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(v);
        if (out.length >= 20) break;
      }
      if (!out.length && primary) out.push(primary);
      return out;
    }

    const language = canonicalizeLocaleTag(navIn.language, DEFAULTS.navigator.language);
    const languages = normalizeLocaleList(navIn.languages, language);

    const brandsIn = Array.isArray(navIn.uaDataBrands) ? navIn.uaDataBrands : DEFAULTS.navigator.uaDataBrands;
    const uaDataBrands = brandsIn
      .slice(0, 20)
      .map((b) => ({
        brand: safeStr(b && b.brand, "", 80),
        version: safeStr(b && b.version, "", 32),
      }))
      .filter((b) => b.brand.length > 0 || b.version.length > 0);

    const highIn = isPlainObject(navIn.uaDataHighEntropy) ? navIn.uaDataHighEntropy : {};
    const uaDataHighEntropy = { ...highIn };

    const fontsIn = isPlainObject(secIn.securityFonts) ? secIn.securityFonts : {};
    const familiesIn = Array.isArray(fontsIn.families) ? fontsIn.families : [];
    const families = familiesIn
      .slice(0, 200)
      .map((x) => safeStr(x, "", 80).toLowerCase())
      .filter(Boolean);
    const measureTextEpsilon = clamp(toFiniteNumber(fontsIn.measureTextEpsilon, DEFAULTS.fonts.measureTextEpsilon), 0, 1);

    return {
      securityEnabled: !!secIn.securityEnabled,
      securitySpoofScreenEnabled: !!secIn.securitySpoofScreenEnabled,
      securitySpoofBatteryEnabled: !!secIn.securitySpoofBatteryEnabled,
      securitySpoofCpuEnabled: !!secIn.securitySpoofCpuEnabled,
      securitySpoofMatchMediaEnabled: !!secIn.securitySpoofMatchMediaEnabled,
      securitySpoofWebglEnabled: !!secIn.securitySpoofWebglEnabled,
      securitySpoofCanvasEnabled: !!secIn.securitySpoofCanvasEnabled,
      securitySpoofTimezoneEnabled: !!secIn.securitySpoofTimezoneEnabled,
      securitySpoofNavigatorEnabled: !!secIn.securitySpoofNavigatorEnabled,
      securitySpoofLanguagesEnabled: !!secIn.securitySpoofLanguagesEnabled,
      securitySpoofFontsEnabled: !!secIn.securitySpoofFontsEnabled,

      securityPreset: preset,
      securityFpMode: fpMode,

      securityScreen: {
        width,
        height,
        availWidth,
        availHeight,
        devicePixelRatio: dpr,
        innerWidth,
        innerHeight,
        outerWidth,
        outerHeight,
      },
      securityBattery: {
        level: batLevel,
        charging,
        chargingTime: Number.isFinite(chargingTime) ? chargingTime : DEFAULTS.battery.chargingTime,
        dischargingTime: Number.isFinite(dischargingTime) ? dischargingTime : DEFAULTS.battery.dischargingTime,
      },
      securityCpu: {
        hardwareConcurrency,
        deviceMemory,
      },
      securityWebgl: { vendor, renderer },
      securityCanvas: { noiseLevel },
      securityTimezone: { timeZone, timezoneOffsetMinutes },
      securityNavigator: {
        userAgent,
        appVersion,
        platform,
        vendor: vendorNav,
        language,
        languages,
        uaDataMobile,
        uaDataPlatform,
        uaDataBrands,
        uaDataHighEntropy,
      },
      securityFonts: { families, measureTextEpsilon },
    };
  }

  function getWebGLProfile() {
    const sec = state.security;
    if (!sec || !sec.securityWebgl) return WEBGL_PROFILE_POOL[0];

    const base = {
      vendor: safeStr(sec.securityWebgl.vendor, WEBGL_PROFILE_POOL[0].vendor, 220),
      renderer: safeStr(sec.securityWebgl.renderer, WEBGL_PROFILE_POOL[0].renderer, 260),
    };

    const mode = sec.securityFpMode;
    const preset = sec.securityPreset;

    /* Manual vendor/renderer when preset is Custom */
    if (preset === "custom") {
      return base;
    }

    if (mode === "per_domain_deterministic") {
      const idx = hashStr(`${location.hostname}|${preset}`) % WEBGL_PROFILE_POOL.length;
      return WEBGL_PROFILE_POOL[idx];
    }

    if (mode === "per_session_deterministic") {
      if (!sessionWebGlProfile) {
        const idx = Math.floor(Math.random() * WEBGL_PROFILE_POOL.length);
        sessionWebGlProfile = WEBGL_PROFILE_POOL[idx];
      }
      return sessionWebGlProfile;
    }

    /* random_each_call + preset laptop/desktop/mobile */
    if (!tickWebGlProfile) {
      const idx = Math.floor(Math.random() * WEBGL_PROFILE_POOL.length);
      tickWebGlProfile = WEBGL_PROFILE_POOL[idx];
      queueMicrotask(() => {
        tickWebGlProfile = null;
      });
    }
    return tickWebGlProfile;
  }

  function spoofEnabled(flag) {
    return !!(state.isActive && state.security && state.security[flag]);
  }

  let fpStatBumpTs = 0;
  let fpStatLastSub = "";
  function bumpFpSpoofThrottled(minGapMs, subKey) {
    const gap = typeof minGapMs === "number" && minGapMs > 0 ? minGapMs : 380;
    const sk = typeof subKey === "string" && subKey.trim() ? subKey.trim() : "fp_other";
    const now = Date.now();
    if (now - fpStatBumpTs < gap && sk === fpStatLastSub) return;
    fpStatBumpTs = now;
    fpStatLastSub = sk;
    try {
      const fn =
        globalThis.__focusBlockerStatsBump ||
        (document.documentElement && document.documentElement.__focusBlockerStatsBump) ||
        (typeof Document !== "undefined" && Document.prototype && Document.prototype.__focusBlockerStatsBump);
      if (typeof fn === "function") fn("fpSpoof", 1, sk);
    } catch (_e) {}
  }

  function screenVals() {
    const d = state.security && isPlainObject(state.security.securityScreen) ? state.security.securityScreen : null;
    return d || DEFAULTS.screen;
  }

  /* --- Workers (classic) --- */
  function isObject(v) {
    return !!v && typeof v === "object";
  }

  function workerSpoofWanted() {
    return (
      spoofEnabled("securitySpoofNavigatorEnabled") ||
      spoofEnabled("securitySpoofCpuEnabled") ||
      spoofEnabled("securitySpoofTimezoneEnabled") ||
      spoofEnabled("securitySpoofWebglEnabled") ||
      spoofEnabled("securitySpoofCanvasEnabled")
    );
  }

  function coerceAbsoluteWorkerUrl(raw) {
    try {
      if (raw instanceof URL) return raw.href;
    } catch (_e) {}
    const s = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
    if (!s) return "";
    try {
      return new URL(s, location.href).href;
    } catch (_e2) {
      return s;
    }
  }

  function canWrapWorkerUrl(absUrl) {
    if (!absUrl) return false;
    try {
      if (absUrl.startsWith("blob:") || absUrl.startsWith("data:")) return true;
      const u = new URL(absUrl);
      return u.origin === location.origin;
    } catch (_e) {
      return false;
    }
  }

  function isModuleWorkerOptions(options) {
    return !!(isObject(options) && options.type === "module");
  }

  function allowWorkerCredentials(options) {
    // importScripts() doesn't let us preserve arbitrary credentials policies; be conservative.
    const cred = isObject(options) ? options.credentials : undefined;
    return cred === undefined || cred === "same-origin";
  }

  function makeWorkerWrapperBlobUrl(absOriginalUrl) {
    if (!workerScriptUrl || !workerScriptUrl.trim()) return null;

    /** @type {any} */
    const boot = {
      isActive: !!state.isActive,
      security: state.security,
      host: location.hostname || "",
    };

    let bootJson = "";
    try {
      bootJson = JSON.stringify(boot);
    } catch (_e) {
      return null;
    }

    const src =
      `"use strict";\n` +
      `try{self.__focusBlockerSecurityBoot=${bootJson};}catch(e){}\n` +
      `try{importScripts(${JSON.stringify(workerScriptUrl)});}catch(e){}\n` +
      `importScripts(${JSON.stringify(absOriginalUrl)});\n` +
      `//# sourceURL=focus-blocker-worker-wrapper.js\n`;

    try {
      const blob = new Blob([src], { type: "application/javascript" });
      return URL.createObjectURL(blob);
    } catch (_e2) {
      return null;
    }
  }

  const NativeWorker = typeof Worker === "function" ? Worker : null;
  if (NativeWorker) {
    // eslint-disable-next-line no-inner-declarations
    function WorkerShim(scriptURL, options) {
      try {
        if (!state.isActive || !workerSpoofWanted() || isModuleWorkerOptions(options) || !allowWorkerCredentials(options)) {
          return new NativeWorker(scriptURL, options);
        }

        const abs = coerceAbsoluteWorkerUrl(scriptURL);
        if (!canWrapWorkerUrl(abs)) return new NativeWorker(scriptURL, options);

        const blobUrl = makeWorkerWrapperBlobUrl(abs);
        if (!blobUrl) return new NativeWorker(scriptURL, options);

        const w = new NativeWorker(blobUrl, options);
        try {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
        } catch (_e3) {}
        return w;
      } catch (_e4) {
        return new NativeWorker(scriptURL, options);
      }
    }

    try {
      WorkerShim.prototype = NativeWorker.prototype;
      Object.defineProperty(window, "Worker", { configurable: true, writable: true, value: WorkerShim });
    } catch (_e) {
      try {
        // @ts-ignore
        window.Worker = WorkerShim;
      } catch (_e2) {}
    }
  }

  const NativeSharedWorker = typeof SharedWorker === "function" ? SharedWorker : null;
  if (NativeSharedWorker) {
    // eslint-disable-next-line no-inner-declarations
    function SharedWorkerShim(scriptURL, nameOrOptions) {
      /** @type {any} */
      const options =
        typeof nameOrOptions === "string"
          ? { name: nameOrOptions }
          : isObject(nameOrOptions)
            ? nameOrOptions
            : undefined;

      try {
        if (!state.isActive || !workerSpoofWanted() || isModuleWorkerOptions(options) || !allowWorkerCredentials(options)) {
          // @ts-ignore
          return typeof nameOrOptions === "string" ? new NativeSharedWorker(scriptURL, nameOrOptions) : new NativeSharedWorker(scriptURL, options);
        }

        const abs = coerceAbsoluteWorkerUrl(scriptURL);
        if (!canWrapWorkerUrl(abs)) {
          // @ts-ignore
          return typeof nameOrOptions === "string" ? new NativeSharedWorker(scriptURL, nameOrOptions) : new NativeSharedWorker(scriptURL, options);
        }

        const blobUrl = makeWorkerWrapperBlobUrl(abs);
        if (!blobUrl) {
          // @ts-ignore
          return typeof nameOrOptions === "string" ? new NativeSharedWorker(scriptURL, nameOrOptions) : new NativeSharedWorker(scriptURL, options);
        }

        // Always pass the normalized options object to preserve `name` if provided.
        const sw = new NativeSharedWorker(blobUrl, options);
        try {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
        } catch (_e2) {}
        return sw;
      } catch (_e3) {
        // @ts-ignore
        return typeof nameOrOptions === "string" ? new NativeSharedWorker(scriptURL, nameOrOptions) : new NativeSharedWorker(scriptURL, options);
      }
    }

    try {
      SharedWorkerShim.prototype = NativeSharedWorker.prototype;
      Object.defineProperty(window, "SharedWorker", { configurable: true, writable: true, value: SharedWorkerShim });
    } catch (_e) {
      try {
        // @ts-ignore
        window.SharedWorker = SharedWorkerShim;
      } catch (_e2) {}
    }
  }

  /* --- Screen / Window / Navigator --- */
  function patchScreenDim(prop, key) {
    if (typeof Screen === "undefined") return;
    const od = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
    if (!od || typeof od.get !== "function") return;
    const nativeGet = od.get;
    try {
      Object.defineProperty(Screen.prototype, prop, lockedGetterDesc(od.enumerable !== false, function () {
        return spoofEnabled("securitySpoofScreenEnabled") ? screenVals()[key] : nativeGet.call(window.screen);
      }));
    } catch (e) {}
  }

  patchScreenDim("width", "width");
  patchScreenDim("height", "height");
  patchScreenDim("availWidth", "availWidth");
  patchScreenDim("availHeight", "availHeight");

  function patchWindowDim(prop, key) {
    const od = Object.getOwnPropertyDescriptor(Window.prototype, prop);
    if (!od || typeof od.get !== "function") return;
    const nativeGet = od.get;
    try {
      Object.defineProperty(Window.prototype, prop, lockedGetterDesc(od.enumerable !== false, function () {
        return spoofEnabled("securitySpoofScreenEnabled") ? screenVals()[key] : nativeGet.call(window);
      }));
    } catch (e) {}
  }

  patchWindowDim("devicePixelRatio", "devicePixelRatio");
  patchWindowDim("innerWidth", "innerWidth");
  patchWindowDim("innerHeight", "innerHeight");
  patchWindowDim("outerWidth", "outerWidth");
  patchWindowDim("outerHeight", "outerHeight");

  function patchNavigatorNumber(prop, flag, key) {
    const proto = Navigator.prototype;
    if (!(prop in proto)) return;
    const od = Object.getOwnPropertyDescriptor(proto, prop);
    if (!od) return;
    const nativeGet = typeof od.get === "function" ? od.get : null;
    const nativeVal = "value" in od ? od.value : undefined;
    try {
      Object.defineProperty(proto, prop, lockedGetterDesc(od.enumerable !== false, function () {
        if (!spoofEnabled(flag)) {
          if (nativeGet) return nativeGet.call(navigator);
          return nativeVal;
        }
        const cpu =
          state.security && isPlainObject(state.security.securityCpu) ? state.security.securityCpu : DEFAULTS.cpu;
        return typeof cpu[key] === "number" ? cpu[key] : nativeGet ? nativeGet.call(navigator) : nativeVal;
      }));
    } catch (e) {}
  }

  patchNavigatorNumber("hardwareConcurrency", "securitySpoofCpuEnabled", "hardwareConcurrency");

  if ("deviceMemory" in Navigator.prototype) {
    patchNavigatorNumber("deviceMemory", "securitySpoofCpuEnabled", "deviceMemory");
  }

  function makeBatteryManager(cfg) {
    const listeners = new Map();

    const bm = {
      charging: !!cfg.charging,
      chargingTime: typeof cfg.chargingTime === "number" ? cfg.chargingTime : Infinity,
      dischargingTime: typeof cfg.dischargingTime === "number" ? cfg.dischargingTime : Infinity,
      level: typeof cfg.level === "number" ? Math.min(1, Math.max(0, cfg.level)) : 1,

      addEventListener(type, listener, _opts) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener, _opts) {
        listeners.get(type)?.delete(listener);
      },
      dispatchEvent(_event) {
        return true;
      },
    };

    bm.onchargingchange = null;
    bm.onlevelchange = null;
    bm.onchargingtimechange = null;
    bm.ondischargingtimechange = null;

    return bm;
  }

  const nativeGetBattery =
    typeof Navigator.prototype.getBattery === "function" ? Navigator.prototype.getBattery : null;

  if (nativeGetBattery) {
    try {
      Navigator.prototype.getBattery = function () {
        const ctx = this && typeof this === "object" ? this : navigator;
        if (!spoofEnabled("securitySpoofBatteryEnabled")) {
          try {
            return nativeGetBattery.call(ctx);
          } catch (e) {
            if (isIllegalInvocationError(e)) {
              return nativeGetBattery.call(navigator);
            }
            throw e;
          }
        }
        const cfg =
          state.security && isPlainObject(state.security.securityBattery) ? state.security.securityBattery : DEFAULTS.battery;
        bumpFpSpoofThrottled(420, "navigator_getBattery_spoof");
        return Promise.resolve(makeBatteryManager(cfg));
      };
    } catch (e) {}
  }

  /* --- Timezone (Intl + Date.getTimezoneOffset) --- */
  const nativeIntlResolvedOptions =
    typeof Intl !== "undefined" &&
    Intl.DateTimeFormat &&
    typeof Intl.DateTimeFormat.prototype.resolvedOptions === "function"
      ? Intl.DateTimeFormat.prototype.resolvedOptions
      : null;

  const nativeIntlFormatToParts =
    typeof Intl !== "undefined" &&
    Intl.DateTimeFormat &&
    typeof Intl.DateTimeFormat.prototype.formatToParts === "function"
      ? Intl.DateTimeFormat.prototype.formatToParts
      : null;

  const tzOffsetFormatterCache = new Map();

  function getTzOffsetFormatter(timeZone) {
    const id = String(timeZone || "").trim();
    if (!id) return null;
    if (tzOffsetFormatterCache.has(id)) return tzOffsetFormatterCache.get(id);
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: id,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        hourCycle: "h23",
      });
      tzOffsetFormatterCache.set(id, fmt);
      return fmt;
    } catch (_e) {
      tzOffsetFormatterCache.set(id, null);
      return null;
    }
  }

  function computeIanaTimezoneOffsetMinutes(dateObj, timeZone) {
    if (!nativeIntlFormatToParts || !dateObj || typeof dateObj.getTime !== "function") return null;
    const t = dateObj.getTime();
    if (!Number.isFinite(t)) return null;
    const fmt = getTzOffsetFormatter(timeZone);
    if (!fmt) return null;
    let parts;
    try {
      parts = fmt.formatToParts(dateObj);
    } catch (_e) {
      return null;
    }
    const map = {};
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p || !p.type) continue;
      if (p.type === "year" || p.type === "month" || p.type === "day" || p.type === "hour" || p.type === "minute" || p.type === "second") {
        map[p.type] = p.value;
      }
    }
    const y = Number(map.year);
    const mo = Number(map.month);
    const d = Number(map.day);
    const h = Number(map.hour);
    const mi = Number(map.minute);
    const s = Number(map.second);
    if (![y, mo, d, h, mi, s].every((n) => Number.isFinite(n))) return null;
    const wallClockAsUTC = Date.UTC(y, mo - 1, d, h, mi, s);
    const localOffsetMinutes = (wallClockAsUTC - t) / 60000;
    if (!Number.isFinite(localOffsetMinutes)) return null;
    // getTimezoneOffset() is minutes to add to local to get UTC
    return Math.round(-localOffsetMinutes);
  }

  if (nativeIntlResolvedOptions) {
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      const r = nativeIntlResolvedOptions.apply(this, arguments);
      if (!spoofEnabled("securitySpoofTimezoneEnabled")) return r;
      const tzCfg =
        state.security && isPlainObject(state.security.securityTimezone) ? state.security.securityTimezone : DEFAULTS.timezone;
      const id = typeof tzCfg.timeZone === "string" && tzCfg.timeZone.trim() ? tzCfg.timeZone.trim() : r.timeZone;
      return { ...r, timeZone: id };
    };
  }

  const nativeGetTimezoneOffset =
    typeof Date !== "undefined" && typeof Date.prototype.getTimezoneOffset === "function"
      ? Date.prototype.getTimezoneOffset
      : null;

  if (nativeGetTimezoneOffset) {
    Date.prototype.getTimezoneOffset = function () {
      if (!spoofEnabled("securitySpoofTimezoneEnabled")) {
        return nativeGetTimezoneOffset.call(this);
      }
      const tzCfg =
        state.security && isPlainObject(state.security.securityTimezone) ? state.security.securityTimezone : DEFAULTS.timezone;
      const n = tzCfg.timezoneOffsetMinutes;
      if (typeof n === "number" && Number.isFinite(n)) return n;
      const id = typeof tzCfg.timeZone === "string" && tzCfg.timeZone.trim() ? tzCfg.timeZone.trim() : "";
      const auto = id ? computeIanaTimezoneOffsetMinutes(this, id) : null;
      if (typeof auto === "number" && Number.isFinite(auto)) return auto;
      return nativeGetTimezoneOffset.call(this);
    };
  }

  /* --- Navigator strings + UA-CH --- */
  function patchNavigatorString(prop, flag, cfgKey) {
    const proto = Navigator.prototype;
    if (!(prop in proto)) return;
    const od = Object.getOwnPropertyDescriptor(proto, prop);
    if (!od) return;
    const nativeGet = typeof od.get === "function" ? od.get : null;
    const nativeVal = "value" in od ? od.value : "";
    const getter = function () {
      if (!spoofEnabled(flag)) {
        return nativeGet ? nativeGet.call(this) : nativeVal;
      }
      const navCfg = state.security && state.security.securityNavigator;
      const v = navCfg && typeof navCfg[cfgKey] === "string" ? navCfg[cfgKey] : null;
      return v != null ? v : nativeGet ? nativeGet.call(this) : nativeVal;
    };

    let patched = false;
    try {
      Object.defineProperty(proto, prop, lockedGetterDesc(od.enumerable !== false, getter));
      patched = true;
    } catch (e) {
      patched = false;
    }

    // Fallback: patch the navigator instance if prototype is non-configurable.
    if (!patched) {
      try {
        Object.defineProperty(navigator, prop, lockedGetterDesc(od.enumerable !== false, getter));
        patched = true;
      } catch (e2) {}
    }
    return patched;
  }

  function patchNavigatorLanguages(flag) {
    const proto = Navigator.prototype;
    if (!("languages" in proto)) return false;
    const od = Object.getOwnPropertyDescriptor(proto, "languages");
    if (!od) return false;
    const nativeGet = typeof od.get === "function" ? od.get : null;
    const nativeVal = "value" in od ? od.value : undefined;

    function canonicalizeLocaleTag(tag, fallback) {
      const raw = safeStr(tag, fallback, 64);
      if (!raw) return fallback;
      if (!/^[A-Za-z0-9-]+$/.test(raw)) return fallback;
      try {
        if (typeof Intl !== "undefined" && typeof Intl.getCanonicalLocales === "function") {
          const out = Intl.getCanonicalLocales([raw]);
          if (Array.isArray(out) && out[0]) return String(out[0]);
        }
      } catch (_e) {}
      return raw;
    }

    function languagesNow() {
      const navCfg =
        state.security && isPlainObject(state.security.securityNavigator) ? state.security.securityNavigator : DEFAULTS.navigator;
      const primary = canonicalizeLocaleTag(navCfg && navCfg.language, DEFAULTS.navigator.language);
      const rawList = navCfg && Array.isArray(navCfg.languages) ? navCfg.languages : [];
      const out = [];
      const seen = new Set();
      for (let i = 0; i < rawList.length; i++) {
        const v = canonicalizeLocaleTag(rawList[i], "");
        if (!v) continue;
        const k = v.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(v);
        if (out.length >= 20) break;
      }
      if (!out.length && primary) out.push(primary);
      return out;
    }

    const getter = function () {
      if (!spoofEnabled(flag)) {
        return nativeGet ? nativeGet.call(this) : nativeVal;
      }
      const out = languagesNow().slice();
      try {
        Object.freeze(out);
      } catch (_e2) {}
      return out;
    };

    let patched = false;
    try {
      Object.defineProperty(proto, "languages", lockedGetterDesc(od.enumerable !== false, getter));
      patched = true;
    } catch (_e3) {
      patched = false;
    }

    if (!patched) {
      try {
        Object.defineProperty(navigator, "languages", lockedGetterDesc(od.enumerable !== false, getter));
        patched = true;
      } catch (_e4) {}
    }

    return patched;
  }

  /** @type {Record<string, boolean>} */
  const dbgNavigatorStrings = {
    userAgent: !!patchNavigatorString("userAgent", "securitySpoofNavigatorEnabled", "userAgent"),
    appVersion: !!patchNavigatorString("appVersion", "securitySpoofNavigatorEnabled", "appVersion"),
    platform: !!patchNavigatorString("platform", "securitySpoofNavigatorEnabled", "platform"),
    vendor: !!patchNavigatorString("vendor", "securitySpoofNavigatorEnabled", "vendor"),
    language: !!patchNavigatorString("language", "securitySpoofLanguagesEnabled", "language"),
  };

  const dbgNavigatorLanguages = !!patchNavigatorLanguages("securitySpoofLanguagesEnabled");

  function cloneBrandEntries(brands) {
    if (!Array.isArray(brands)) return [];
    return brands.map((b) => ({
      brand: String((b && b.brand) || ""),
      version: String((b && b.version) || ""),
    }));
  }

  let cachedSpoofUAData = null;
  let cachedSpoofUADataKey = "";

  function computeSpoofUADataKey(cfg) {
    try {
      return JSON.stringify({
        b: cfg && cfg.uaDataBrands,
        m: !!(cfg && cfg.uaDataMobile),
        p: cfg && cfg.uaDataPlatform,
        h: cfg && cfg.uaDataHighEntropy,
      });
    } catch (e) {
      return String(Math.random());
    }
  }

  function buildSpoofNavigatorUAData(nativeUAD) {
    const cfg =
      state.security && isPlainObject(state.security.securityNavigator) ? state.security.securityNavigator : DEFAULTS.navigator;
    const cacheKey = computeSpoofUADataKey(cfg);
    if (cachedSpoofUAData && cacheKey === cachedSpoofUADataKey) return cachedSpoofUAData;

    const brands = cloneBrandEntries(cfg && cfg.uaDataBrands);
    const mobile = !!(cfg && cfg.uaDataMobile);
    const platform = cfg && typeof cfg.uaDataPlatform === "string" ? cfg.uaDataPlatform : "Windows";
    const high = cfg && cfg.uaDataHighEntropy && typeof cfg.uaDataHighEntropy === "object" ? cfg.uaDataHighEntropy : {};

    const getHighEntropyValues = function (hints) {
      const hintList = Array.isArray(hints) ? hints : [];
      const fromCfg = {};
      for (let i = 0; i < hintList.length; i++) {
        const h = hintList[i];
        if (h != null && Object.prototype.hasOwnProperty.call(high, h)) fromCfg[h] = high[h];
      }

      if (!nativeUAD || typeof nativeUAD.getHighEntropyValues !== "function") {
        return Promise.resolve(fromCfg);
      }

      return nativeUAD.getHighEntropyValues.call(nativeUAD, hints).then((nativeObj) => {
        const out = nativeObj && typeof nativeObj === "object" ? { ...nativeObj } : {};
        for (let i = 0; i < hintList.length; i++) {
          const h = hintList[i];
          if (h != null && Object.prototype.hasOwnProperty.call(high, h)) out[h] = high[h];
        }
        return out;
      });
    };

    const toJSON = function () {
      return { brands, mobile, platform };
    };

    let out;
    if (nativeUAD && typeof Proxy !== "undefined") {
      out = new Proxy(nativeUAD, {
        get(target, prop, receiver) {
          if (prop === "brands") return brands;
          if (prop === "mobile") return mobile;
          if (prop === "platform") return platform;
          if (prop === "getHighEntropyValues") return getHighEntropyValues;
          if (prop === "toJSON") return toJSON;
          const v = Reflect.get(target, prop, receiver);
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
    } else {
      out = { brands, mobile, platform, getHighEntropyValues, toJSON };
    }

    cachedSpoofUAData = out;
    cachedSpoofUADataKey = cacheKey;
    return out;
  }

  const uaDataDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgentData");
  const nativeGetNavigatorUAData = uaDataDesc && typeof uaDataDesc.get === "function" ? uaDataDesc.get : null;

  let dbgUserAgentDataPrototype = false;
  let dbgUserAgentDataInstance = false;

  if (nativeGetNavigatorUAData) {
    try {
      Object.defineProperty(
        Navigator.prototype,
        "userAgentData",
        lockedGetterDesc(uaDataDesc.enumerable !== false, function () {
          if (!spoofEnabled("securitySpoofNavigatorEnabled")) {
            return nativeGetNavigatorUAData.call(navigator);
          }
          const nativeObj = nativeGetNavigatorUAData.call(navigator);
          return buildSpoofNavigatorUAData(nativeObj);
        })
      );
      dbgUserAgentDataPrototype = true;
    } catch (e) {}

    // Fallback: some environments don't allow patching the prototype getter.
    try {
      if (!Object.getOwnPropertyDescriptor(navigator, "userAgentData")) {
        Object.defineProperty(
          navigator,
          "userAgentData",
          lockedGetterDesc(uaDataDesc.enumerable !== false, function () {
            if (!spoofEnabled("securitySpoofNavigatorEnabled")) {
              return nativeGetNavigatorUAData.call(navigator);
            }
            const nativeObj = nativeGetNavigatorUAData.call(navigator);
            return buildSpoofNavigatorUAData(nativeObj);
          })
        );
        dbgUserAgentDataInstance = true;
      }
    } catch (e2) {}
  }

  /* --- Fonts: FontFaceSet.check + measureText jitter --- */
  const GENERIC_FONT_FAMILY =
    /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|emoji|math|fangsong)$/i;

  function stripFontShorthandPrefix(fontSpec) {
    const s = String(fontSpec || "");
    const m = s.match(/\b\d+(?:\.\d+)?(?:px|pt|pc|mm|cm|in|em|rem|%)\b/i);
    if (!m || m.index == null) return s.trim();
    let rest = s.slice(m.index + m[0].length).trimStart();
    if (rest.startsWith("/")) {
      rest = rest.slice(1).trimStart();
      rest = rest.replace(/^[\d.]+[a-z%]*/i, "").trimStart();
    }
    return rest.trim();
  }

  function normalizeFamilyName(name) {
    return String(name || "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim()
      .toLowerCase();
  }

  function extractFontFamilies(fontSpec) {
    const s = stripFontShorthandPrefix(fontSpec);
    if (!s) return [];
    const parts = s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p) continue;
      const q = p.match(/["']([^"']+)["']/);
      const fam = normalizeFamilyName(q ? q[1] : p);
      if (!fam) continue;
      if (GENERIC_FONT_FAMILY.test(fam)) continue;
      out.push(fam);
    }
    return out;
  }

  function fontAllowlistSet() {
    const cfg = state.security && state.security.securityFonts;
    const list = cfg && cfg.families;
    if (!Array.isArray(list) || !list.length) return null;
    const set = new Set();
    for (let i = 0; i < list.length; i++) {
      const x = String(list[i] || "")
        .trim()
        .toLowerCase();
      if (x) set.add(x);
    }
    return set.size ? set : null;
  }

  const nativeFontFaceSetCheck =
    typeof FontFaceSet !== "undefined" && typeof FontFaceSet.prototype.check === "function"
      ? FontFaceSet.prototype.check
      : null;

  const nativeDocumentFontsCheck =
    typeof document !== "undefined" && document.fonts && typeof document.fonts.check === "function"
      ? document.fonts.check.bind(document.fonts)
      : null;

  let dbgFontFaceSetPrototype = false;
  let dbgDocumentFontsCheck = false;

  function patchedFontsCheck(nativeCheck, thisArg, argsLike) {
    if (!spoofEnabled("securitySpoofFontsEnabled")) {
      if (nativeCheck) return nativeCheck.apply(thisArg, argsLike);
      return true;
    }
    const allow = fontAllowlistSet();
    if (!allow) {
      if (nativeCheck) return nativeCheck.apply(thisArg, argsLike);
      return true;
    }

    const fontArg = argsLike && argsLike.length ? argsLike[0] : "";
    const families = extractFontFamilies(fontArg);
    if (!families.length) {
      if (nativeCheck) return nativeCheck.apply(thisArg, argsLike);
      return true;
    }
    for (let i = 0; i < families.length; i++) {
      if (allow.has(families[i])) return true;
    }
    // Strict spoof: if allowlist is provided, everything else is treated as "not available".
    return false;
  }

  const patchedFontFaceSetCheck = function () {
    return patchedFontsCheck(nativeFontFaceSetCheck, this, arguments);
  };

  // Patch FontFaceSet.prototype.check (best-effort).
  if (nativeFontFaceSetCheck) {
    try {
      Object.defineProperty(FontFaceSet.prototype, "check", {
        configurable: false,
        enumerable: true,
        get: () => patchedFontFaceSetCheck,
        set() {},
      });
      dbgFontFaceSetPrototype = true;
    } catch (_e) {
      try {
        FontFaceSet.prototype.check = patchedFontFaceSetCheck;
        dbgFontFaceSetPrototype = true;
      } catch (_e2) {}
    }
  }

  // Patch document.fonts.check even if prototype patch succeeded/failed.
  if (typeof document !== "undefined" && document.fonts) {
    const patchedDocumentFontsCheck = function () {
      // Prefer the original document.fonts.check if available; else fall back to patched prototype.
      const native = nativeDocumentFontsCheck || nativeFontFaceSetCheck;
      return patchedFontsCheck(native, document.fonts, arguments);
    };

    try {
      Object.defineProperty(document.fonts, "check", {
        configurable: false,
        enumerable: true,
        get: () => patchedDocumentFontsCheck,
        set() {},
      });
      dbgDocumentFontsCheck = true;
    } catch (_e3) {
      try {
        document.fonts.check = patchedDocumentFontsCheck;
        dbgDocumentFontsCheck = true;
      } catch (_e4) {}
    }
  }

  const nativeMeasureText =
    typeof CanvasRenderingContext2D !== "undefined" && typeof CanvasRenderingContext2D.prototype.measureText === "function"
      ? CanvasRenderingContext2D.prototype.measureText
      : null;

  let dbgCanvasMeasureText = false;

  if (nativeMeasureText) {
    CanvasRenderingContext2D.prototype.measureText = function (text) {
      const tm = nativeMeasureText.apply(this, arguments);
      if (!spoofEnabled("securitySpoofFontsEnabled")) return tm;

      const eps =
        state.security && state.security.securityFonts && state.security.securityFonts.measureTextEpsilon;
      if (typeof eps !== "number" || !Number.isFinite(eps) || eps <= 0) return tm;

      const jitter = (Math.random() - 0.5) * 2 * eps;
      return new Proxy(tm, {
        get(target, prop, receiver) {
          if (prop === "width") return Math.max(0, target.width + jitter);
          const v = Reflect.get(target, prop, receiver);
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
    };
    dbgCanvasMeasureText = true;
  }

  /* --- matchMedia --- */
  const nativeMatchMedia = typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;

  function evalMediaPart(part, scr) {
    const p = part.trim();
    const w = scr.innerWidth;
    const h = scr.innerHeight;
    const dpr = scr.devicePixelRatio;

    let m = p.match(/^\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)\s*px\s*\)$/i);
    if (m) return w >= parseFloat(m[1]);

    m = p.match(/^\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)\s*px\s*\)$/i);
    if (m) return w <= parseFloat(m[1]);

    m = p.match(/^\(\s*min-height\s*:\s*(\d+(?:\.\d+)?)\s*px\s*\)$/i);
    if (m) return h >= parseFloat(m[1]);

    m = p.match(/^\(\s*max-height\s*:\s*(\d+(?:\.\d+)?)\s*px\s*\)$/i);
    if (m) return h <= parseFloat(m[1]);

    m = p.match(/^\(\s*min-resolution\s*:\s*(\d+(?:\.\d+)?)\s*dppx\s*\)$/i);
    if (m) return dpr >= parseFloat(m[1]);

    m = p.match(/^\(\s*max-resolution\s*:\s*(\d+(?:\.\d+)?)\s*dppx\s*\)$/i);
    if (m) return dpr <= parseFloat(m[1]);

    m = p.match(/^\(\s*resolution\s*:\s*(\d+(?:\.\d+)?)\s*dppx\s*\)$/i);
    if (m) return Math.abs(dpr - parseFloat(m[1])) < 1e-6;

    m = p.match(/^\(\s*min-resolution\s*:\s*(\d+(?:\.\d+)?)\s*dpcm\s*\)$/i);
    if (m) return dpr * 37.7952755906 >= parseFloat(m[1]);

    m = p.match(/^\(\s*max-resolution\s*:\s*(\d+(?:\.\d+)?)\s*dpcm\s*\)$/i);
    if (m) return dpr * 37.7952755906 <= parseFloat(m[1]);

    m = p.match(/^\(\s*resolution\s*:\s*(\d+(?:\.\d+)?)\s*dpcm\s*\)$/i);
    if (m) return Math.abs(dpr * 37.7952755906 - parseFloat(m[1])) < 1e-3;

    m = p.match(/^\(\s*-\s*webkit\s*-\s*min\s*-\s*device\s*-\s*pixel\s*-\s*ratio\s*:\s*(\d+(?:\.\d+)?)\s*\)$/i);
    if (m) return dpr >= parseFloat(m[1]);

    m = p.match(/^\(\s*-\s*webkit\s*-\s*max\s*-\s*device\s*-\s*pixel\s*-\s*ratio\s*:\s*(\d+(?:\.\d+)?)\s*\)$/i);
    if (m) return dpr <= parseFloat(m[1]);

    m = p.match(/^\(\s*-\s*webkit\s*-\s*device\s*-\s*pixel\s*-\s*ratio\s*:\s*(\d+(?:\.\d+)?)\s*\)$/i);
    if (m) return Math.abs(dpr - parseFloat(m[1])) < 1e-6;

    return null;
  }

  function evaluateMediaQuery(query) {
    const scr = screenVals();
    const raw = String(query || "").trim();
    if (!raw) return null;

    const parts = raw
      .split(/\s+and\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return null;

    let unknown = false;

    for (const part of parts) {
      const r = evalMediaPart(part, scr);
      if (r === null) unknown = true;
      else if (!r) return false;
    }

    if (unknown) return null;
    return true;
  }

  function createMediaQueryList(media, matches) {
    const listeners = new Map();

    const mql = {
      media: media || "",
      matches: !!matches,
      onchange: null,

      addListener(callback) {
        if (typeof callback === "function") this.addEventListener("change", callback);
      },
      removeListener(callback) {
        if (typeof callback === "function") this.removeEventListener("change", callback);
      },

      addEventListener(type, callback, _opts) {
        if (type !== "change" || typeof callback !== "function") return;
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(callback);
      },
      removeEventListener(type, callback, _opts) {
        listeners.get(type)?.delete(callback);
      },

      dispatchEvent(_event) {
        return true;
      },
    };

    return mql;
  }

  if (nativeMatchMedia) {
    try {
      window.matchMedia = function (query) {
        if (!spoofEnabled("securitySpoofMatchMediaEnabled")) {
          return nativeMatchMedia(query);
        }

        const ev = evaluateMediaQuery(query);
        if (ev !== null) {
          return createMediaQueryList(String(query), ev);
        }

        return nativeMatchMedia(query);
      };
    } catch (e) {}
  }

  /* --- WebGL getParameter --- */
  function patchWebGLContext(Ctor) {
    if (typeof Ctor === "undefined" || !Ctor.prototype || typeof Ctor.prototype.getParameter !== "function") return;

    const nativeGetParameter = Ctor.prototype.getParameter;

    try {
      Ctor.prototype.getParameter = function (pname) {
        if (!spoofEnabled("securitySpoofWebglEnabled")) {
          return nativeGetParameter.call(this, pname);
        }

        const gl = this;
        let ext = null;
        try {
          ext = gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
        } catch (e) {
          ext = null;
        }

        const profile = getWebGLProfile();

        try {
          if (ext && pname === ext.UNMASKED_VENDOR_WEBGL) {
            bumpFpSpoofThrottled(360, "webgl_UNMASKED_VENDOR_WEBGL");
            return profile.vendor;
          }
          if (ext && pname === ext.UNMASKED_RENDERER_WEBGL) {
            bumpFpSpoofThrottled(360, "webgl_UNMASKED_RENDERER_WEBGL");
            return profile.renderer;
          }
        } catch (e) {}

        try {
          if (pname === gl.VENDOR) {
            bumpFpSpoofThrottled(360, "webgl_VENDOR_const");
            return profile.vendor;
          }
          if (pname === gl.RENDERER) {
            bumpFpSpoofThrottled(360, "webgl_RENDERER_const");
            return profile.renderer;
          }
        } catch (e) {}

        return nativeGetParameter.call(this, pname);
      };
    } catch (e) {}
  }

  patchWebGLContext(typeof WebGLRenderingContext !== "undefined" ? WebGLRenderingContext : undefined);
  patchWebGLContext(typeof WebGL2RenderingContext !== "undefined" ? WebGL2RenderingContext : undefined);

  /* --- Canvas --- */
  const nativeGetImageData =
    typeof CanvasRenderingContext2D !== "undefined" && CanvasRenderingContext2D.prototype.getImageData
      ? CanvasRenderingContext2D.prototype.getImageData
      : null;

  const nativePutImageData =
    typeof CanvasRenderingContext2D !== "undefined" && CanvasRenderingContext2D.prototype.putImageData
      ? CanvasRenderingContext2D.prototype.putImageData
      : null;

  const nativeToDataURL =
    typeof HTMLCanvasElement !== "undefined" && HTMLCanvasElement.prototype.toDataURL
      ? HTMLCanvasElement.prototype.toDataURL
      : null;

  const nativeToBlob =
    typeof HTMLCanvasElement !== "undefined" && HTMLCanvasElement.prototype.toBlob
      ? HTMLCanvasElement.prototype.toBlob
      : null;

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
    const mode = state.security && state.security.securityFpMode;

    if (mode === "per_session_deterministic" && canvasSessionSeed === null) {
      canvasSessionSeed = (Math.random() * 0xffffffff) >>> 0;
    }

    const seedBaseHost = hashStr(location.hostname);

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

  if (nativeGetImageData) {
    CanvasRenderingContext2D.prototype.getImageData = function (sx, sy, sw, sh) {
      const img = nativeGetImageData.apply(this, arguments);
      if (spoofEnabled("securitySpoofCanvasEnabled")) {
        bumpFpSpoofThrottled(320, "canvas2d_getImageData_noise");
        const lvl =
          state.security && isPlainObject(state.security.securityCanvas) ? state.security.securityCanvas.noiseLevel : DEFAULTS.canvas.noiseLevel;
        addNoiseToImageData(img, lvl);
      }
      return img;
    };
  }

  function withNoisyCanvasCopy(canvasEl, fn) {
    const ctx = canvasEl && canvasEl.getContext ? canvasEl.getContext("2d") : null;
    const w = canvasEl ? canvasEl.width : 0;
    const h = canvasEl ? canvasEl.height : 0;
    if (!ctx || !w || !h || !nativeGetImageData || !nativePutImageData) return fn(canvasEl);

    try {
      const id = nativeGetImageData.call(ctx, 0, 0, w, h);
      const lvl =
        state.security && isPlainObject(state.security.securityCanvas) ? state.security.securityCanvas.noiseLevel : DEFAULTS.canvas.noiseLevel;

      let copy;
      try {
        copy = new ImageData(new Uint8ClampedArray(id.data), id.width, id.height);
      } catch (e) {
        copy = ctx.createImageData(id);
        copy.data.set(id.data);
      }

      addNoiseToImageData(copy, lvl);

      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext("2d");
      if (!tctx) return fn(canvasEl);

      nativePutImageData.call(tctx, copy, 0, 0);
      return fn(tmp);
    } catch (e) {
      return fn(canvasEl);
    }
  }

  if (nativeToDataURL && nativeGetImageData && nativePutImageData) {
    try {
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        if (!spoofEnabled("securitySpoofCanvasEnabled")) {
          return nativeToDataURL.apply(this, args);
        }
        return withNoisyCanvasCopy(this, (tmp) => nativeToDataURL.apply(tmp, args));
      };
    } catch (e) {}
  }

  if (nativeToBlob && nativeGetImageData && nativePutImageData) {
    try {
      HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
        if (!spoofEnabled("securitySpoofCanvasEnabled")) {
          return nativeToBlob.call(this, callback, ...rest);
        }
        return withNoisyCanvasCopy(this, (tmp) => nativeToBlob.call(tmp, callback, ...rest));
      };
    } catch (e) {}
  }

  /* --- OffscreenCanvas --- */
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
      OffscreenCanvasRenderingContext2D.prototype.getImageData = function (sx, sy, sw, sh) {
        const img = nativeOffscreenGetImageData.apply(this, arguments);
        if (spoofEnabled("securitySpoofCanvasEnabled")) {
          bumpFpSpoofThrottled(320, "offscreenCanvas_getImageData_noise");
          const lvl =
            state.security && isPlainObject(state.security.securityCanvas)
              ? state.security.securityCanvas.noiseLevel
              : DEFAULTS.canvas.noiseLevel;
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
        state.security && isPlainObject(state.security.securityCanvas)
          ? state.security.securityCanvas.noiseLevel
          : DEFAULTS.canvas.noiseLevel;

      let copy;
      try {
        copy = new ImageData(new Uint8ClampedArray(id.data), id.width, id.height);
      } catch (_e2) {
        // Some contexts don't allow ImageData construction directly.
        // Fall back to createImageData when available.
        copy = ctx.createImageData(id);
        copy.data.set(id.data);
      }

      addNoiseToImageData(copy, lvl);

      let tmp;
      try {
        tmp = new OffscreenCanvas(w, h);
      } catch (_e3) {
        return fn(offscreen);
      }

      const tctx = tmp.getContext("2d");
      if (!tctx) return fn(offscreen);
      nativeOffscreenPutImageData.call(tctx, copy, 0, 0);
      return fn(tmp);
    } catch (_e4) {
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
    } catch (_e5) {}
  }

  let lastFpCacheKey = "";

  function updateStateFromPayload(payload) {
    const sec = normalizeSecurity(payload && payload.security ? payload.security : null);
    const fpKey = sec ? `${sec.securityFpMode}|${sec.securityPreset}` : "";
    const nextWorkerUrlRaw =
      payload && typeof payload.workerScriptUrl === "string" && payload.workerScriptUrl.trim()
        ? payload.workerScriptUrl.trim()
        : "";

    // Accept workerScriptUrl only if it points at our worker script.
    // MAIN world has no chrome.runtime, so we cannot compare chrome.runtime.id —
    // authenticity comes from the HMAC check above; the bridge is the only signer
    // and always sends chrome.runtime.getURL("src/security-worker.js").
    let nextWorkerUrl = workerScriptUrl;
    try {
      const u = nextWorkerUrlRaw ? new URL(nextWorkerUrlRaw) : null;
      if (
        u &&
        u.protocol === "chrome-extension:" &&
        typeof u.pathname === "string" &&
        /\/src\/security-worker\.js$/i.test(u.pathname)
      ) {
        nextWorkerUrl = u.href;
      }
    } catch (_e) {}

    if (fpKey !== lastFpCacheKey) {
      sessionWebGlProfile = null;
      tickWebGlProfile = null;
      canvasSessionSeed = null;
      cachedSpoofUAData = null;
      cachedSpoofUADataKey = "";
      lastFpCacheKey = fpKey;
    }

    state.isActive = !!(payload && payload.isActive);
    state.security = sec;
    if (nextWorkerUrl) workerScriptUrl = nextWorkerUrl;

    // Do not persist full spoof config into page localStorage to avoid leakage.
    try {
      localStorage.removeItem("__focus_blocker_security_cache_v1");
    } catch (_e) {}
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

  window.addEventListener(
    "message",
    (event) => {
      if (event.source !== window || !event.data || event.data.type !== "FOCUS_BLOCKER_SECURITY_SETTINGS") return;
      if (!fbVerifyPayload(event.data)) return;
      updateStateFromPayload(event.data);
    },
    true
  );

  // Same payload via direct CustomEvent (more reliable than postMessage timing).
  // Capture phase: registered at document_start, before page scripts can stopPropagation.
  window.addEventListener(
    "FOCUS_BLOCKER_SECURITY_SETTINGS_EVENT",
    (event) => {
      try {
        const detail = event && event.detail ? event.detail : null;
        if (!fbVerifyPayload(detail)) return;
        updateStateFromPayload(detail);
      } catch (e) {}
    },
    true
  );

  // In case settings-bridge posted before we subscribed.
  try {
    window.postMessage({ type: "FOCUS_BLOCKER_REQUEST_SETTINGS" }, "*");
  } catch (e) {}

  try {
    window.__focusBlockerSecurityDebug = {
      v: 1,
      navigatorStrings: dbgNavigatorStrings,
      navigatorLanguagesPatched: dbgNavigatorLanguages,
      userAgentData: {
        hasNativeGetter: !!nativeGetNavigatorUAData,
        prototypePatched: dbgUserAgentDataPrototype,
        instanceFallbackPatched: dbgUserAgentDataInstance,
      },
      fonts: {
        fontFaceSetPrototypePatched: dbgFontFaceSetPrototype,
        documentFontsCheckPatched: dbgDocumentFontsCheck,
        hadNativeFontFaceSetCheck: !!nativeFontFaceSetCheck,
      },
      canvasMeasureTextWrapped: dbgCanvasMeasureText,
    };
  } catch (eDbg) {}
})();
