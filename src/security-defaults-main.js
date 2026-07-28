/**
 * Shared defaults for Security module (options UI + settings bridge).
 * Keep in sync with runtime validation in security.js.
 *
 * TWO IDENTICAL COPIES EXIST: security-defaults.js (isolated entry, options page,
 * service worker) and security-defaults-main.js (MAIN entry). They must stay
 * byte-identical — change one, copy it over the other. The duplication is required,
 * not stylistic: a script path listed in several content_scripts entries can be
 * injected into a document only once, so the isolated entry consumed the single
 * injection and MAIN modules silently fell back to their trimmed inline defaults
 * (ADS Block lost its builtin domain/selector lists). Distinct paths give each world
 * its own copy. See fb-channel.js for the same constraint on the settings channel.
 */
const SECURITY_FP_MODES = ["per_domain_deterministic", "per_session_deterministic", "random_each_call"];

const DEFAULT_SECURITY_PRESET = "desktop";

const DEFAULT_SECURITY = {
  securityEnabled: false,
  securitySpoofScreenEnabled: true,
  securitySpoofBatteryEnabled: true,
  securitySpoofCpuEnabled: true,
  securitySpoofMatchMediaEnabled: true,
  securitySpoofWebglEnabled: true,
  securitySpoofCanvasEnabled: true,
  securitySpoofTimezoneEnabled: false,
  securitySpoofNavigatorEnabled: false,
  securitySpoofLanguagesEnabled: false,
  securitySpoofFontsEnabled: false,
  securityPreset: DEFAULT_SECURITY_PRESET,
  securityFpMode: "random_each_call",
  securityScreen: {
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
  securityBattery: {
    level: 0.92,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: 7200,
  },
  securityCpu: {
    hardwareConcurrency: 8,
    deviceMemory: 8,
  },
  securityWebgl: {
    vendor: "Google Inc. (Intel)",
    renderer: "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  securityCanvas: {
    noiseLevel: 4,
  },
  securityTimezone: {
    timeZone: "Europe/Berlin",
    timezoneOffsetMinutes: null,
  },
  securityNavigator: {
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
    uaDataHighEntropy: {
      architecture: "x86",
      bitness: "64",
      wow64: false,
      platformVersion: "15.0.0",
      uaFullVersion: "120.0.0.0",
      fullVersionList: [
        { brand: "Google Chrome", version: "120.0.0.0" },
        { brand: "Chromium", version: "120.0.0.0" },
        { brand: "Not;A=Brand", version: "99.0.0.0" },
      ],
    },
  },
  securityFonts: {
    families: [
      "arial",
      "helvetica",
      "times new roman",
      "courier new",
      "verdana",
      "georgia",
      "trebuchet ms",
      "comic sans ms",
      "impact",
      "segoe ui",
    ],
    measureTextEpsilon: 0,
  },
};

/** Presets applied in options page (also used when merging saved preset id). */
const SECURITY_PRESETS = {
  laptop: {
    securityScreen: {
      width: 1366,
      height: 768,
      availWidth: 1366,
      availHeight: 728,
      devicePixelRatio: 1,
      innerWidth: 1366,
      innerHeight: 657,
      outerWidth: 1366,
      outerHeight: 768,
    },
    securityCpu: { hardwareConcurrency: 8, deviceMemory: 8 },
    securityWebgl: {
      vendor: "Google Inc. (Intel)",
      renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
  },
  desktop: {
    securityScreen: {
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
    securityCpu: { hardwareConcurrency: 16, deviceMemory: 16 },
    securityWebgl: {
      vendor: "Google Inc. (NVIDIA)",
      renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
  },
  mobile: {
    securityScreen: {
      width: 390,
      height: 844,
      availWidth: 390,
      availHeight: 812,
      devicePixelRatio: 3,
      innerWidth: 390,
      innerHeight: 664,
      outerWidth: 390,
      outerHeight: 844,
    },
    securityCpu: { hardwareConcurrency: 6, deviceMemory: 4 },
    securityWebgl: {
      vendor: "Apple Inc.",
      renderer: "Apple GPU",
    },
  },
};

const SECURITY_STORAGE_KEYS = [
  "securityEnabled",
  "securitySpoofScreenEnabled",
  "securitySpoofBatteryEnabled",
  "securitySpoofCpuEnabled",
  "securitySpoofMatchMediaEnabled",
  "securitySpoofWebglEnabled",
  "securitySpoofCanvasEnabled",
  "securitySpoofTimezoneEnabled",
  "securitySpoofNavigatorEnabled",
  "securitySpoofLanguagesEnabled",
  "securitySpoofFontsEnabled",
  "securityPreset",
  "securityFpMode",
  "securityScreen",
  "securityBattery",
  "securityCpu",
  "securityWebgl",
  "securityCanvas",
  "securityTimezone",
  "securityNavigator",
  "securityFonts",
];

const SECURITY_PRESET_IDS = ["laptop", "desktop", "mobile", "custom"];

/** Order of Navigator/UA preset groups in the options dropdown (<optgroup> labels). */
const SECURITY_NAV_PRESET_GROUPS = ["chrome_win", "chrome_mac", "chrome_linux", "chrome_android_pixel", "chrome_android_samsung", "edge_win", "edge_mac"];

const SECURITY_NAV_PRESET_GROUP_LABELS = {
  chrome_win: "Chrome · Windows",
  chrome_mac: "Chrome · macOS",
  chrome_linux: "Chrome · Linux",
  chrome_android_pixel: "Chrome · Android (Pixel)",
  chrome_android_samsung: "Chrome · Android (Samsung)",
  edge_win: "Microsoft Edge · Windows",
  edge_mac: "Microsoft Edge · macOS",
};

const CHROME_PRESET_MAJOR_VERSIONS = [118, 122, 126, 130, 134, 138];
const EDGE_PRESET_MAJOR_VERSIONS = [130, 134, 138];

function fullVersionFromMajor(major) {
  const n = Number(major);
  return `${Math.floor(Number.isFinite(n) ? n : 0)}.0.0.0`;
}

function majorBrandString(major) {
  const n = Number(major);
  return String(Math.floor(Number.isFinite(n) ? n : 0));
}

function buildChromeNavigator({
  major,
  uaProduct,
  navigatorPlatform,
  vendor,
  uaDataPlatform,
  uaDataMobile,
  uaDataHighEntropy,
}) {
  const majStr = majorBrandString(major);
  const fv = fullVersionFromMajor(major);
  const tailChrome = uaDataMobile ? `Chrome/${fv} Mobile Safari/537.36` : `Chrome/${fv} Safari/537.36`;
  const userAgent = `Mozilla/5.0 ${uaProduct} AppleWebKit/537.36 (KHTML, like Gecko) ${tailChrome}`;
  const appVersion = `5.0 ${uaProduct} AppleWebKit/537.36 (KHTML, like Gecko) ${tailChrome}`;
  return {
    userAgent,
    appVersion,
    platform: navigatorPlatform,
    vendor,
    uaDataMobile: !!uaDataMobile,
    uaDataPlatform,
    uaDataBrands: [
      { brand: "Google Chrome", version: majStr },
      { brand: "Chromium", version: majStr },
      { brand: "Not;A=Brand", version: "99" },
    ],
    uaDataHighEntropy: {
      ...uaDataHighEntropy,
      uaFullVersion: fv,
      fullVersionList: [
        { brand: "Google Chrome", version: fv },
        { brand: "Chromium", version: fv },
        { brand: "Not;A=Brand", version: "99.0.0.0" },
      ],
    },
  };
}

function buildEdgeNavigator({
  major,
  uaProduct,
  navigatorPlatform,
  uaDataPlatform,
  uaDataMobile,
  uaDataHighEntropy,
}) {
  const majStr = majorBrandString(major);
  const fv = fullVersionFromMajor(major);
  const tailEdge = uaDataMobile
    ? `Chrome/${fv} Mobile Safari/537.36 Edg/${fv}`
    : `Chrome/${fv} Safari/537.36 Edg/${fv}`;
  const userAgent = `Mozilla/5.0 ${uaProduct} AppleWebKit/537.36 (KHTML, like Gecko) ${tailEdge}`;
  const appVersion = `5.0 ${uaProduct} AppleWebKit/537.36 (KHTML, like Gecko) ${tailEdge}`;
  return {
    userAgent,
    appVersion,
    platform: navigatorPlatform,
    vendor: "Google Inc.",
    uaDataMobile: !!uaDataMobile,
    uaDataPlatform,
    uaDataBrands: [
      { brand: "Microsoft Edge", version: majStr },
      { brand: "Chromium", version: majStr },
      { brand: "Not;A=Brand", version: "24" },
    ],
    uaDataHighEntropy: {
      ...uaDataHighEntropy,
      uaFullVersion: fv,
      fullVersionList: [
        { brand: "Microsoft Edge", version: fv },
        { brand: "Chromium", version: fv },
        { brand: "Not;A=Brand", version: "24.0.0.0" },
      ],
    },
  };
}

function buildChromeWin(major) {
  return buildChromeNavigator({
    major,
    uaProduct: "(Windows NT 10.0; Win64; x64)",
    navigatorPlatform: "Win32",
    vendor: "Google Inc.",
    uaDataPlatform: "Windows",
    uaDataMobile: false,
    uaDataHighEntropy: {
      architecture: "x86",
      bitness: "64",
      wow64: false,
      platformVersion: "15.0.0",
    },
  });
}

function buildChromeMac(major) {
  return buildChromeNavigator({
    major,
    uaProduct: "(Macintosh; Intel Mac OS X 10_15_7)",
    navigatorPlatform: "MacIntel",
    vendor: "Google Inc.",
    uaDataPlatform: "macOS",
    uaDataMobile: false,
    uaDataHighEntropy: {
      architecture: "x86",
      bitness: "64",
      wow64: false,
      platformVersion: "15.0.0",
    },
  });
}

function buildChromeLinux(major) {
  return buildChromeNavigator({
    major,
    uaProduct: "(X11; Linux x86_64)",
    navigatorPlatform: "Linux x86_64",
    vendor: "Google Inc.",
    uaDataPlatform: "Linux",
    uaDataMobile: false,
    uaDataHighEntropy: {
      architecture: "x86",
      bitness: "64",
      wow64: false,
      platformVersion: "",
    },
  });
}

function buildChromeAndroidPixel(major) {
  return buildChromeNavigator({
    major,
    uaProduct: "(Linux; Android 14; Pixel 7)",
    navigatorPlatform: "Linux armv8l",
    vendor: "Google Inc.",
    uaDataPlatform: "Android",
    uaDataMobile: true,
    uaDataHighEntropy: {
      architecture: "arm",
      bitness: "64",
      wow64: false,
      model: "Pixel 7",
      platformVersion: "14.0.0",
    },
  });
}

function buildChromeAndroidSamsung(major) {
  return buildChromeNavigator({
    major,
    uaProduct: "(Linux; Android 14; SM-S928B)",
    navigatorPlatform: "Linux armv8l",
    vendor: "Google Inc.",
    uaDataPlatform: "Android",
    uaDataMobile: true,
    uaDataHighEntropy: {
      architecture: "arm",
      bitness: "64",
      wow64: false,
      model: "SM-S928B",
      platformVersion: "14.0.0",
    },
  });
}

function buildEdgeWin(major) {
  return buildEdgeNavigator({
    major,
    uaProduct: "(Windows NT 10.0; Win64; x64)",
    navigatorPlatform: "Win32",
    uaDataPlatform: "Windows",
    uaDataMobile: false,
    uaDataHighEntropy: {
      architecture: "x86",
      bitness: "64",
      wow64: false,
      platformVersion: "15.0.0",
    },
  });
}

function buildEdgeMac(major) {
  return buildEdgeNavigator({
    major,
    uaProduct: "(Macintosh; Intel Mac OS X 10_15_7)",
    navigatorPlatform: "MacIntel",
    uaDataPlatform: "macOS",
    uaDataMobile: false,
    uaDataHighEntropy: {
      architecture: "x86",
      bitness: "64",
      wow64: false,
      platformVersion: "15.0.0",
    },
  });
}

const SECURITY_NAV_PRESETS = {};

function navPreset(nav, label, group) {
  return { securityNavigator: nav, label, group };
}

for (const v of CHROME_PRESET_MAJOR_VERSIONS) {
  SECURITY_NAV_PRESETS[`chrome_win_${v}`] = navPreset(buildChromeWin(v), `Chrome ${v} · Windows (x64)`, "chrome_win");
  SECURITY_NAV_PRESETS[`chrome_mac_${v}`] = navPreset(buildChromeMac(v), `Chrome ${v} · macOS (Intel)`, "chrome_mac");
  SECURITY_NAV_PRESETS[`chrome_linux_${v}`] = navPreset(buildChromeLinux(v), `Chrome ${v} · Linux (x86_64)`, "chrome_linux");
  SECURITY_NAV_PRESETS[`chrome_android_pixel_${v}`] = navPreset(
    buildChromeAndroidPixel(v),
    `Chrome ${v} · Android 14 · Pixel 7`,
    "chrome_android_pixel"
  );
  SECURITY_NAV_PRESETS[`chrome_android_samsung_${v}`] = navPreset(
    buildChromeAndroidSamsung(v),
    `Chrome ${v} · Android 14 · Samsung (SM-S928B)`,
    "chrome_android_samsung"
  );
}

for (const v of EDGE_PRESET_MAJOR_VERSIONS) {
  SECURITY_NAV_PRESETS[`edge_win_${v}`] = navPreset(buildEdgeWin(v), `Microsoft Edge ${v} · Windows (x64)`, "edge_win");
  SECURITY_NAV_PRESETS[`edge_mac_${v}`] = navPreset(buildEdgeMac(v), `Microsoft Edge ${v} · macOS`, "edge_mac");
}

/** Saved IDs before multi-version presets — identical navigators to chrome_*_120 matrix entries. */
const navLegacyWin120 = buildChromeWin(120);
const navLegacyMac120 = buildChromeMac(120);
const navLegacyPixel120 = buildChromeAndroidPixel(120);
SECURITY_NAV_PRESETS.chrome_win_120 = navPreset(navLegacyWin120, `Chrome 120 · Windows (x64) (legacy)`, "chrome_win");
SECURITY_NAV_PRESETS.chrome_mac_120 = navPreset(navLegacyMac120, `Chrome 120 · macOS (Intel) (legacy)`, "chrome_mac");
SECURITY_NAV_PRESETS.chrome_android_pixel_120 = navPreset(navLegacyPixel120, `Chrome 120 · Android 14 · Pixel 7`, "chrome_android_pixel");
SECURITY_NAV_PRESETS.chrome_android_120 = navPreset(navLegacyPixel120, `Chrome 120 · Android (Mobile, legacy)`, "chrome_android_pixel");

/** WebRTC leak mitigation (chrome.privacy.network.webRTCIPHandlingPolicy.value). */
const NETWORK_WEBRTC_POLICY_IDS = ["default_public_interface_only", "disable_non_proxied_udp"];

const DEFAULT_NETWORK_SECURITY = {
  networkSecurityEnabled: false,
  /** RFC1918 + IPv4 link-local 169.254/16 */
  networkBlockPrivateIp: true,
  /** localhost / 127.* / ::1 */
  networkBlockLocalhost: true,
  /** img/iframe/embed/object probes in page JS */
  networkBlockEmbeddedProbes: true,
  networkWebRtcProtectionEnabled: false,
  networkWebRtcPolicy: "default_public_interface_only",
};

const NETWORK_STORAGE_KEYS = [
  "networkSecurityEnabled",
  "networkBlockPrivateIp",
  "networkBlockLocalhost",
  "networkBlockEmbeddedProbes",
  "networkWebRtcProtectionEnabled",
  "networkWebRtcPolicy",
];

const DEFAULT_DS_BLOCK = {
  dsBlockEnabled: false,
  dsBlockBlockPopups: true,
  dsBlockCosmeticEnabled: true,
  dsBlockTelemetryEnabled: true,
  /** One entry per line in UI (hostname / wildcard like *.example.com). */
  dsBlockExtraBlockedDomains: [],
  /** One CSS selector per line. */
  dsBlockHideSelectors: [],
};

/** Curated starter list (small by design; user can extend in options). */
const DS_BLOCK_BUILTIN_BLOCK_DOMAINS = [
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

/** Small cosmetic set; avoid overly-generic selectors that break layouts. */
const DS_BLOCK_BUILTIN_HIDE_SELECTORS = [
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

const DS_BLOCK_STORAGE_KEYS = [
  "dsBlockEnabled",
  "dsBlockBlockPopups",
  "dsBlockCosmeticEnabled",
  "dsBlockTelemetryEnabled",
  "dsBlockExtraBlockedDomains",
  "dsBlockHideSelectors",
];

/**
 * Известные дешёвые / часто абьюзируемые TLD и шаблоны для списка «подозрительный домен».
 * Пользователь может расширить в настройках; при ложных срабатываниях добавьте хост в белый список.
 */
const THREAT_SHIELD_BUILTIN_HOST_PATTERNS = ["*.tk", "*.ml", "*.ga", "*.cf", "*.gq", "*.ddns.net", "*.duckdns.org"];

/** Суффикс после `.com|.net|.org` для эвристики типа paypal.com.ru */
const THREAT_SHIELD_STACKED_TLD_TAIL = ["ru", "su", "kz", "xyz", "zip", "click", "loan", "top", "cfd", "ink", "sbs", "quest", "beauty", "autos"];

const DEFAULT_THREAT_SHIELD = {
  threatShieldEnabled: false,
  threatWarnHttp: true,
  threatWarnList: true,
  threatWarnStackedTld: true,
  threatWarnGarbageHost: false,
  threatWarnRedirect: true,
  /** Минимум лейблов в FQDN для эвристики «мусорной длины» (например 6 → срабатывает при ≥6). */
  threatGarbageMinLabels: 6,
  /** Дополнительные хосты / шаблоны (строго как исключённые: example.com, *.bad.net). */
  threatShieldExtraHosts: [],
  /** Никогда не показывать предупреждение, если совпало (поддомены тоже, см. patternMatchesHost). */
  threatShieldWhitelistHosts: [],
};

const THREAT_SHIELD_STORAGE_KEYS = [
  "threatShieldEnabled",
  "threatWarnHttp",
  "threatWarnList",
  "threatWarnStackedTld",
  "threatWarnGarbageHost",
  "threatWarnRedirect",
  "threatGarbageMinLabels",
  "threatShieldExtraHosts",
  "threatShieldWhitelistHosts",
];

/** Curated third-party trackers / ads (DNR Privacy pack); may overlap DS — double block is fine. */
const PRIVACY_PACK_BUILTIN_BLOCK_DOMAINS = [
  "hotjar.com",
  "hotjar.io",
  "clarity.ms",
  "mixpanel.com",
  "fullstory.com",
  "heap.io",
  "mouseflow.com",
  "luckyorange.com",
  "crazyegg.com",
  "chartbeat.net",
  "optimizely.com",
  "scorecardresearch.com",
  "quantserve.com",
  "moatads.com",
  "adsrvr.org",
  "demdex.net",
  "everesttech.net",
  "agkn.com",
  "imrworldwide.com",
  "bluekai.com",
  "krxd.net",
  "exelator.com",
  "mathtag.com",
  "rlcdn.com",
  "adsymptotic.com",
  "addthis.com",
  "sharethis.com",
  "contextweb.com",
  "rubiconproject.com",
  "amazon-adsystem.com",
  "adnxs.com",
  "casalemedia.com",
  "openx.net",
  "pubmatic.com",
  "3lift.com",
  "lijit.com",
  "media.net",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "criteo.net",
  "teads.tv",
  "zemanta.com",
];

const DEFAULT_PRIVACY_PACK = {
  privacyPackEnabled: false,
  /** false = narrow resource types (script, xhr, ping); true = broad set like DS block */
  privacyPackWideResourceTypes: false,
  privacyPackExtraBlockedDomains: [],
};

const PRIVACY_PACK_STORAGE_KEYS = [
  "privacyPackEnabled",
  "privacyPackWideResourceTypes",
  "privacyPackExtraBlockedDomains",
];

const DEFAULT_PRIVACY_ISOLATION = {
  privacyIsolationReferrersOff: false,
  privacyIsolationHyperlinkAuditingOff: false,
  privacyIsolationNetworkPredictionOff: false,
};

const PRIVACY_ISOLATION_STORAGE_KEYS = [
  "privacyIsolationReferrersOff",
  "privacyIsolationHyperlinkAuditingOff",
  "privacyIsolationNetworkPredictionOff",
];

const DEFAULT_DEVICE_SECURITY = {
  deviceSecurityEnabled: false,
  /** Block localStorage/sessionStorage (read + write). */
  deviceSecurityBlockStorage: true,
  /** Block IndexedDB open/deleteDatabase. */
  deviceSecurityBlockIndexedDb: true,
  /** Block Cache API (caches.* + CacheStorage methods). */
  deviceSecurityBlockCacheApi: true,
  /** Hide camera/microphone APIs (navigator.mediaDevices). */
  deviceSecurityHideMediaDevices: true,
  /** Hide geolocation API (navigator.geolocation). */
  deviceSecurityHideGeolocation: true,
  /** Lock down patched APIs so page can't easily undo spoofing. */
  deviceSecurityLockdown: true,
};

const DEVICE_SECURITY_STORAGE_KEYS = [
  "deviceSecurityEnabled",
  "deviceSecurityBlockStorage",
  "deviceSecurityBlockIndexedDb",
  "deviceSecurityBlockCacheApi",
  "deviceSecurityHideMediaDevices",
  "deviceSecurityHideGeolocation",
  "deviceSecurityLockdown",
];

/**
 * Normalize hostname for checks (handles IPv6 without brackets).
 * @param {string} hostRaw
 * @returns {string}
 */
function normalizeHostnameForNetworkChecks(hostRaw) {
  let h = String(hostRaw || "").trim().toLowerCase();
  if (!h) return "";
  return h.replace(/^\[+|\]+$/g, "").replace(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/, "$1");
}

function isIpv4Octets(parts) {
  if (!Array.isArray(parts) || parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

/**
 * localhost, loopback, ::1 mapped host
 */
function isLocalhostNetworkHost(hostRaw) {
  const host = normalizeHostnameForNetworkChecks(hostRaw);
  if (!host) return false;
  if (host === "localhost") return true;
  if (host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m && isIpv4Octets([m[1], m[2], m[3], m[4]])) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 127) return true;
    if (a === 0 && b === 0 && Number(m[3]) === 0 && Number(m[4]) === 0) return true;
  }
  return false;
}

/**
 * RFC1918 / IPv4 link-local (excluding 127 unless caller combines with localhost gate)
 */
function isPrivateIpv4NetworkHost(hostRaw) {
  const host = normalizeHostnameForNetworkChecks(hostRaw);
  if (!host) return false;

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m || !isIpv4Octets([m[1], m[2], m[3], m[4]])) return false;

  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isUniqueLocalIpv6(hostRaw) {
  const host = normalizeHostnameForNetworkChecks(hostRaw);
  if (!host.includes(":")) return false;
  const collapsed = host.split(":")[0];
  if (!collapsed) return false;
  const first = collapsed.replace(/^0+/, "") || "0";
  return /^fd/i.test(first) || /^fc/i.test(first);
}

function isLinkLocalIpv6(hostRaw) {
  const host = normalizeHostnameForNetworkChecks(hostRaw);
  if (!host.includes(":")) return false;
  return /^fe80/i.test(host);
}

function isTailscaleOrSimilarHostname(hostRaw) {
  const host = normalizeHostnameForNetworkChecks(hostRaw);
  return host.endsWith(".ts.net") || host.endsWith(".tailscale.ts.net") || host.endsWith(".local");
}

/**
 * True if browsing context is localhost/private — do not intercept (router admin pages, LAN apps).
 */
function isLocalOrPrivatePageHost(hostname) {
  const h = normalizeHostnameForNetworkChecks(hostname);
  if (!h) return false;
  if (isTailscaleOrSimilarHostname(h)) return true;
  if (isLocalhostNetworkHost(h)) return true;
  if (isPrivateIpv4NetworkHost(h)) return true;
  if (isLinkLocalIpv6(h) || isUniqueLocalIpv6(h)) return true;
  if (/^::$/.test(h) || /^::ffff:\d/.test(hostname)) return true;
  return false;
}

/**
 * Whether `url` resolves to localhost/private target we want to optionally block when flags are on.
 */
function blockedNetworkHostForMerge(hostRaw, merged) {
  const h = normalizeHostnameForNetworkChecks(hostRaw);
  if (!h) return false;

  let block = false;
  if (merged.networkBlockPrivateIp && (isPrivateIpv4NetworkHost(h) || isLinkLocalIpv6(h) || isUniqueLocalIpv6(h))) {
    block = true;
  }
  if (merged.networkBlockLocalhost && isLocalhostNetworkHost(h)) {
    block = true;
  }
  return block;
}

/**
 * @param {Record<string, unknown>} result
 */
function mergeNetworkFromStorage(result) {
  const d = DEFAULT_NETWORK_SECURITY;
  const rawPolicy =
    typeof result.networkWebRtcPolicy === "string" ? result.networkWebRtcPolicy.trim() : d.networkWebRtcPolicy;
  const policy = NETWORK_WEBRTC_POLICY_IDS.includes(rawPolicy) ? rawPolicy : d.networkWebRtcPolicy;

  const blockPrivate =
    result.networkBlockPrivateIp !== undefined ? !!result.networkBlockPrivateIp : d.networkBlockPrivateIp;
  const blockLocalhost =
    result.networkBlockLocalhost !== undefined ? !!result.networkBlockLocalhost : d.networkBlockLocalhost;
  const blockEmbedded =
    result.networkBlockEmbeddedProbes !== undefined ? !!result.networkBlockEmbeddedProbes : d.networkBlockEmbeddedProbes;
  const rtcOn =
    result.networkWebRtcProtectionEnabled !== undefined ? !!result.networkWebRtcProtectionEnabled : d.networkWebRtcProtectionEnabled;

  return {
    networkSecurityEnabled: result.networkSecurityEnabled !== undefined ? !!result.networkSecurityEnabled : d.networkSecurityEnabled,
    networkBlockPrivateIp: blockPrivate,
    networkBlockLocalhost: blockLocalhost,
    networkBlockEmbeddedProbes: blockEmbedded,
    networkWebRtcProtectionEnabled: rtcOn,
    networkWebRtcPolicy: policy,
  };
}

function normalizeDsDomainLine(raw) {
  let s = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
  if (!s) return "";
  if (s.length > 300) s = s.slice(0, 300);

  // Allow entries like `*.example.com` or full URLs pasted by user.
  s = s.replace(/^\*+\./, "");
  if (/^[a-z]+:\/\//i.test(s)) {
    try {
      s = new URL(s).hostname;
    } catch (_e) {
      // fall through to manual normalization
    }
  }

  s = s.split("/")[0].split("?")[0].split("#")[0].trim();
  s = s.replace(/^\[+|\]+$/g, ""); // IPv6 brackets
  s = s.replace(/^\.*/, "").replace(/\.*$/, "");
  return s ? s.toLowerCase() : "";
}

function normalizeDsSelectorLine(raw) {
  const s = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
  if (!s) return "";
  return s.length > 400 ? s.slice(0, 400) : s;
}

/**
 * @param {Record<string, unknown>} result
 */
function mergeDsBlockFromStorage(result) {
  const d = DEFAULT_DS_BLOCK;
  const extraDomainsRaw = Array.isArray(result.dsBlockExtraBlockedDomains) ? result.dsBlockExtraBlockedDomains : d.dsBlockExtraBlockedDomains;
  const selectorsRaw = Array.isArray(result.dsBlockHideSelectors) ? result.dsBlockHideSelectors : d.dsBlockHideSelectors;

  const extraDomains = [];
  for (const it of extraDomainsRaw) {
    const v = normalizeDsDomainLine(it);
    if (!v) continue;
    extraDomains.push(v);
    if (extraDomains.length >= 220) break;
  }

  const selectors = [];
  for (const it of selectorsRaw) {
    const v = normalizeDsSelectorLine(it);
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

/**
 * @param {Record<string, unknown>} result
 */
function mergeThreatShieldFromStorage(result) {
  const d = DEFAULT_THREAT_SHIELD;
  const extraRaw =
    Array.isArray(result.threatShieldExtraHosts) ? result.threatShieldExtraHosts : d.threatShieldExtraHosts;
  const whiteRaw =
    Array.isArray(result.threatShieldWhitelistHosts) ? result.threatShieldWhitelistHosts : d.threatShieldWhitelistHosts;

  const extraHosts = [];
  for (const it of extraRaw) {
    const v = normalizeDsDomainLine(it);
    if (!v) continue;
    extraHosts.push(v);
    if (extraHosts.length >= 220) break;
  }

  const whitelistHosts = [];
  for (const it of whiteRaw) {
    const v = normalizeDsDomainLine(it);
    if (!v) continue;
    whitelistHosts.push(v);
    if (whitelistHosts.length >= 220) break;
  }

  const rawMin = result.threatGarbageMinLabels != null ? Number(result.threatGarbageMinLabels) : d.threatGarbageMinLabels;
  const minLabels =
    Number.isFinite(rawMin) ? Math.min(15, Math.max(4, Math.floor(rawMin))) : d.threatGarbageMinLabels;

  return {
    threatShieldEnabled: result.threatShieldEnabled !== undefined ? !!result.threatShieldEnabled : d.threatShieldEnabled,
    threatWarnHttp: result.threatWarnHttp !== undefined ? !!result.threatWarnHttp : d.threatWarnHttp,
    threatWarnList: result.threatWarnList !== undefined ? !!result.threatWarnList : d.threatWarnList,
    threatWarnStackedTld: result.threatWarnStackedTld !== undefined ? !!result.threatWarnStackedTld : d.threatWarnStackedTld,
    threatWarnGarbageHost: result.threatWarnGarbageHost !== undefined ? !!result.threatWarnGarbageHost : d.threatWarnGarbageHost,
    threatWarnRedirect: result.threatWarnRedirect !== undefined ? !!result.threatWarnRedirect : d.threatWarnRedirect,
    threatGarbageMinLabels: minLabels,
    threatShieldExtraHosts: extraHosts,
    threatShieldWhitelistHosts: whitelistHosts,
  };
}

/**
 * @param {Record<string, unknown>} result
 */
function mergePrivacyPackFromStorage(result) {
  const d = DEFAULT_PRIVACY_PACK;
  const extraRaw =
    Array.isArray(result && result.privacyPackExtraBlockedDomains)
      ? result.privacyPackExtraBlockedDomains
      : d.privacyPackExtraBlockedDomains;

  const extraDomains = [];
  for (const it of extraRaw) {
    const v = normalizeDsDomainLine(it);
    if (!v) continue;
    extraDomains.push(v);
    if (extraDomains.length >= 220) break;
  }

  return {
    privacyPackEnabled: result.privacyPackEnabled !== undefined ? !!result.privacyPackEnabled : d.privacyPackEnabled,
    privacyPackWideResourceTypes:
      result.privacyPackWideResourceTypes !== undefined ? !!result.privacyPackWideResourceTypes : d.privacyPackWideResourceTypes,
    privacyPackExtraBlockedDomains: extraDomains,
  };
}

/**
 * @param {Record<string, unknown>} result
 */
function mergePrivacyIsolationFromStorage(result) {
  const i = DEFAULT_PRIVACY_ISOLATION;
  return {
    privacyIsolationReferrersOff:
      result.privacyIsolationReferrersOff !== undefined ? !!result.privacyIsolationReferrersOff : i.privacyIsolationReferrersOff,
    privacyIsolationHyperlinkAuditingOff:
      result.privacyIsolationHyperlinkAuditingOff !== undefined
        ? !!result.privacyIsolationHyperlinkAuditingOff
        : i.privacyIsolationHyperlinkAuditingOff,
    privacyIsolationNetworkPredictionOff:
      result.privacyIsolationNetworkPredictionOff !== undefined
        ? !!result.privacyIsolationNetworkPredictionOff
        : i.privacyIsolationNetworkPredictionOff,
  };
}

/**
 * @param {Record<string, unknown>} result
 * @returns {typeof DEFAULT_DEVICE_SECURITY}
 */
function mergeDeviceSecurityFromStorage(result) {
  const d = DEFAULT_DEVICE_SECURITY;
  return {
    deviceSecurityEnabled: result.deviceSecurityEnabled !== undefined ? !!result.deviceSecurityEnabled : d.deviceSecurityEnabled,
    deviceSecurityBlockStorage:
      result.deviceSecurityBlockStorage !== undefined ? !!result.deviceSecurityBlockStorage : d.deviceSecurityBlockStorage,
    deviceSecurityBlockIndexedDb:
      result.deviceSecurityBlockIndexedDb !== undefined ? !!result.deviceSecurityBlockIndexedDb : d.deviceSecurityBlockIndexedDb,
    deviceSecurityBlockCacheApi:
      result.deviceSecurityBlockCacheApi !== undefined ? !!result.deviceSecurityBlockCacheApi : d.deviceSecurityBlockCacheApi,
    deviceSecurityHideMediaDevices:
      result.deviceSecurityHideMediaDevices !== undefined ? !!result.deviceSecurityHideMediaDevices : d.deviceSecurityHideMediaDevices,
    deviceSecurityHideGeolocation:
      result.deviceSecurityHideGeolocation !== undefined ? !!result.deviceSecurityHideGeolocation : d.deviceSecurityHideGeolocation,
    deviceSecurityLockdown:
      result.deviceSecurityLockdown !== undefined ? !!result.deviceSecurityLockdown : d.deviceSecurityLockdown,
  };
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

function safeStr(v, fallback, maxLen = 240) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  const out = s.trim();
  if (!out) return fallback;
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param {Record<string, unknown>} result chrome.storage.sync subset
 * @returns {typeof DEFAULT_SECURITY}
 */
function mergeSecurityFromStorage(result) {
  const d = DEFAULT_SECURITY;
  const fpMode = SECURITY_FP_MODES.includes(result.securityFpMode) ? result.securityFpMode : d.securityFpMode;
  const preset = SECURITY_PRESET_IDS.includes(result.securityPreset) ? result.securityPreset : d.securityPreset;

  const screenRaw = { ...d.securityScreen, ...(result.securityScreen || {}) };
  const screenWidth = clampInt(screenRaw.width, 1, 20000, d.securityScreen.width);
  const screenHeight = clampInt(screenRaw.height, 1, 20000, d.securityScreen.height);
  const screen = {
    width: screenWidth,
    height: screenHeight,
    availWidth: clampInt(screenRaw.availWidth, 1, screenWidth, d.securityScreen.availWidth),
    availHeight: clampInt(screenRaw.availHeight, 1, screenHeight, d.securityScreen.availHeight),
    devicePixelRatio: clamp(toFiniteNumber(screenRaw.devicePixelRatio, d.securityScreen.devicePixelRatio), 0.25, 8),
    innerWidth: clampInt(screenRaw.innerWidth, 1, 20000, d.securityScreen.innerWidth),
    innerHeight: clampInt(screenRaw.innerHeight, 1, 20000, d.securityScreen.innerHeight),
    outerWidth: clampInt(screenRaw.outerWidth, 1, 20000, d.securityScreen.outerWidth),
    outerHeight: clampInt(screenRaw.outerHeight, 1, 20000, d.securityScreen.outerHeight),
  };

  const batteryRaw = { ...d.securityBattery, ...(result.securityBattery || {}) };
  const battery = {
    level: clamp(toFiniteNumber(batteryRaw.level, d.securityBattery.level), 0, 1),
    charging: !!batteryRaw.charging,
    chargingTime: toFiniteNumber(batteryRaw.chargingTime, d.securityBattery.chargingTime),
    dischargingTime: toFiniteNumber(batteryRaw.dischargingTime, d.securityBattery.dischargingTime),
  };

  const cpuRaw = { ...d.securityCpu, ...(result.securityCpu || {}) };
  const cpu = {
    hardwareConcurrency: clampInt(cpuRaw.hardwareConcurrency, 1, 128, d.securityCpu.hardwareConcurrency),
    deviceMemory: clamp(toFiniteNumber(cpuRaw.deviceMemory, d.securityCpu.deviceMemory), 0.25, 64),
  };

  const webglRaw = { ...d.securityWebgl, ...(result.securityWebgl || {}) };
  const webgl = {
    vendor: safeStr(webglRaw.vendor, d.securityWebgl.vendor, 220),
    renderer: safeStr(webglRaw.renderer, d.securityWebgl.renderer, 260),
  };

  const canvasRaw = { ...d.securityCanvas, ...(result.securityCanvas || {}) };
  const canvas = {
    noiseLevel: clampInt(canvasRaw.noiseLevel, 0, 50, d.securityCanvas.noiseLevel),
  };

  const tzRaw = { ...d.securityTimezone, ...(result.securityTimezone || {}) };
  const timeZoneCandidate = safeStr(tzRaw.timeZone, d.securityTimezone.timeZone, 64);
  let timeZone = timeZoneCandidate;
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch (e) {
    timeZone = d.securityTimezone.timeZone;
  }
  const tzOffsetRaw = tzRaw.timezoneOffsetMinutes;
  const tzOffsetIsAuto = tzOffsetRaw === null || tzOffsetRaw === undefined || tzOffsetRaw === "";
  const tz = {
    timeZone,
    timezoneOffsetMinutes: tzOffsetIsAuto
      ? null
      : clampInt(tzOffsetRaw, -14 * 60, 14 * 60, d.securityTimezone.timezoneOffsetMinutes),
  };

  const nav = {
    ...d.securityNavigator,
    ...(result.securityNavigator || {}),
    uaDataBrands: Array.isArray(result.securityNavigator?.uaDataBrands)
      ? result.securityNavigator.uaDataBrands
      : Array.isArray(d.securityNavigator.uaDataBrands)
        ? d.securityNavigator.uaDataBrands
        : [],
    uaDataHighEntropy: {
      ...(d.securityNavigator.uaDataHighEntropy || {}),
      ...(result.securityNavigator?.uaDataHighEntropy || {}),
    },
  };

  const uaBrands = Array.isArray(nav.uaDataBrands) ? nav.uaDataBrands : [];
  const uaDataBrands = uaBrands
    .slice(0, 20)
    .map((b) => ({
      brand: safeStr(b && b.brand, "", 80),
      version: safeStr(b && b.version, "", 32),
    }))
    .filter((b) => b.brand.length > 0 || b.version.length > 0);

  const uaDataHighEntropy = isPlainObject(nav.uaDataHighEntropy) ? nav.uaDataHighEntropy : {};

  const navNorm = {
    ...nav,
    userAgent: safeStr(nav.userAgent, d.securityNavigator.userAgent, 1000),
    appVersion: safeStr(nav.appVersion, d.securityNavigator.appVersion, 1000),
    platform: safeStr(nav.platform, d.securityNavigator.platform, 80),
    vendor: safeStr(nav.vendor, d.securityNavigator.vendor, 80),
    language: safeStr(nav.language, d.securityNavigator.language, 64),
    uaDataMobile: !!nav.uaDataMobile,
    uaDataPlatform: safeStr(nav.uaDataPlatform, d.securityNavigator.uaDataPlatform, 80),
    uaDataBrands,
    uaDataHighEntropy,
  };

  function normalizeLocaleTag(tagRaw, fallback) {
    const tag = safeStr(tagRaw, fallback, 64);
    if (!tag) return fallback;
    // BCP-47-ish sanity check (allow letters/digits/hyphen only).
    if (!/^[A-Za-z0-9-]+$/.test(tag)) return fallback;
    try {
      if (typeof Intl !== "undefined" && typeof Intl.getCanonicalLocales === "function") {
        const out = Intl.getCanonicalLocales([tag]);
        if (Array.isArray(out) && out[0]) return String(out[0]);
      }
    } catch (_e) {}
    return tag;
  }

  function normalizeLocaleList(listRaw, fallbackList, fallbackPrimary) {
    const list = Array.isArray(listRaw) ? listRaw : [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < list.length; i++) {
      const v = normalizeLocaleTag(list[i], "");
      if (!v) continue;
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
      if (out.length >= 20) break;
    }
    if (!out.length) {
      const primary = normalizeLocaleTag(fallbackPrimary, "");
      if (primary) out.push(primary);
    }
    return out.length ? out : Array.isArray(fallbackList) ? fallbackList : [];
  }

  const language = normalizeLocaleTag(navNorm.language, d.securityNavigator.language);
  const languages = normalizeLocaleList(navNorm.languages, d.securityNavigator.languages, language);
  navNorm.language = language;
  navNorm.languages = languages;

  const fontsRaw = result.securityFonts || {};
  const familiesIn = fontsRaw.families;
  const families = Array.isArray(familiesIn)
    ? familiesIn
        .slice(0, 200)
        .map((x) => safeStr(x, "", 80).toLowerCase())
        .filter(Boolean)
    : d.securityFonts.families;

  const fonts = {
    ...d.securityFonts,
    ...fontsRaw,
    families,
    measureTextEpsilon:
      clamp(toFiniteNumber(fontsRaw.measureTextEpsilon, d.securityFonts.measureTextEpsilon), 0, 1),
  };

  return {
    securityEnabled: result.securityEnabled !== undefined ? !!result.securityEnabled : d.securityEnabled,
    securitySpoofScreenEnabled:
      result.securitySpoofScreenEnabled !== undefined ? !!result.securitySpoofScreenEnabled : d.securitySpoofScreenEnabled,
    securitySpoofBatteryEnabled:
      result.securitySpoofBatteryEnabled !== undefined ? !!result.securitySpoofBatteryEnabled : d.securitySpoofBatteryEnabled,
    securitySpoofCpuEnabled:
      result.securitySpoofCpuEnabled !== undefined ? !!result.securitySpoofCpuEnabled : d.securitySpoofCpuEnabled,
    securitySpoofMatchMediaEnabled:
      result.securitySpoofMatchMediaEnabled !== undefined ? !!result.securitySpoofMatchMediaEnabled : d.securitySpoofMatchMediaEnabled,
    securitySpoofWebglEnabled:
      result.securitySpoofWebglEnabled !== undefined ? !!result.securitySpoofWebglEnabled : d.securitySpoofWebglEnabled,
    securitySpoofCanvasEnabled:
      result.securitySpoofCanvasEnabled !== undefined ? !!result.securitySpoofCanvasEnabled : d.securitySpoofCanvasEnabled,
    securitySpoofTimezoneEnabled:
      result.securitySpoofTimezoneEnabled !== undefined ? !!result.securitySpoofTimezoneEnabled : d.securitySpoofTimezoneEnabled,
    securitySpoofNavigatorEnabled:
      result.securitySpoofNavigatorEnabled !== undefined ? !!result.securitySpoofNavigatorEnabled : d.securitySpoofNavigatorEnabled,
    securitySpoofLanguagesEnabled:
      result.securitySpoofLanguagesEnabled !== undefined ? !!result.securitySpoofLanguagesEnabled : d.securitySpoofLanguagesEnabled,
    securitySpoofFontsEnabled:
      result.securitySpoofFontsEnabled !== undefined ? !!result.securitySpoofFontsEnabled : d.securitySpoofFontsEnabled,
    securityPreset: preset,
    securityFpMode: fpMode,
    securityScreen: screen,
    securityBattery: battery,
    securityCpu: cpu,
    securityWebgl: webgl,
    securityCanvas: canvas,
    securityTimezone: tz,
    securityNavigator: navNorm,
    securityFonts: fonts,
  };
}

/**
 * One exclusion line from settings → canonical stored string, or null if invalid / ignored.
 * Bare `*` is rejected (avoids "match all hosts"). `*.foo.com` folds to `foo.com` like DNR root rules.
 * @param {unknown} raw
 * @returns {string|null}
 */
function normalizeExcludedDomainStorageEntry(raw) {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s || s === "*") return null;

  try {
    if (s.includes("://")) {
      s = new URL(s).hostname.toLowerCase();
    }
  } catch (_e) {
    return null;
  }

  if (!s || s === "*") return null;

  if (s.includes("*")) {
    if (s.startsWith("*.") && s.indexOf("*", 2) === -1) {
      const root = s.slice(2).replace(/^\.+/, "").replace(/\.+$/, "");
      if (!root || root.includes("*")) return null;
      if (!/^[\w.\-]+$/.test(root)) return null;
      return root;
    }
    s = s.replace(/^\.+/, "").replace(/\.+$/, "");
    if (!s || s === "*") return null;
    if (!/^[\w.*\-]+$/.test(s)) return null;
    return s;
  }

  if (s.startsWith("*.")) s = s.slice(2);

  s = s.replace(/^\.+/, "").replace(/\.+$/, "");
  if (!s) return null;
  if (!/^[\w.\-]+$/.test(s)) return null;
  return s;
}

/**
 * Deduplicates and normalizes a list loaded from textarea or chrome.storage.
 * @param {unknown} rawList
 * @returns {string[]}
 */
function normalizeExcludedDomainsListFromStorage(rawList) {
  const out = [];
  const seen = new Set();
  if (!Array.isArray(rawList)) return out;

  for (let i = 0; i < rawList.length; i++) {
    const n = normalizeExcludedDomainStorageEntry(rawList[i]);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Host match for exclusions (content bridge + background + options data).
 * — Plain host / storage root matches apex and every subdomain (aligned with DNR semantics).
 * — Optional glob with `*` (except lone `*` and leading `*.root` folded at save): full-string regex match.
 * — URLs in legacy data: hostname extracted first.
 *
 * Mirrors settings-bridge.js fbPatternMatchesHost fallback (keep in sync when editing).
 *
 * @param {string} pattern
 * @param {string} host
 * @returns {boolean}
 */
function patternMatchesHost(pattern, host) {
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
 * Maps excluded-domain patterns from options to host roots for declarativeNetRequest
 * `excludedInitiatorDomains`. Chromium matches subdomains of each entry (Chrome 101+).
 * @param {string[]} patterns
 * @returns {string[]}
 */
function normalizeExcludedDomainsForDnrHostList(patterns) {
  const out = new Set();
  if (!Array.isArray(patterns)) return [];

  for (let i = 0; i < patterns.length; i++) {
    const n = normalizeExcludedDomainStorageEntry(patterns[i]);
    if (!n || n.includes("*")) continue;
    out.add(n);
  }

  return Array.from(out);
}

/**
 * Content-script sibling files may run in separate scopes on some Chromium forks
 * (e.g. Yandex Browser). Expose shared symbols on globalThis for settings-bridge.js.
 */
(function exposeFocusBlockerSharedForContentScripts() {
  try {
    // MAIN-world injected scripts don't get extension APIs; skip so we don't expose helpers to web JS.
    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.id !== "string") {
      return;
    }
    const root =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
          ? window
          : typeof self !== "undefined"
            ? self
            : {};
    root.__focusBlockerShared = {
      SECURITY_STORAGE_KEYS,
      NETWORK_STORAGE_KEYS,
      DS_BLOCK_STORAGE_KEYS,
      DEVICE_SECURITY_STORAGE_KEYS,
      THREAT_SHIELD_STORAGE_KEYS,
      THREAT_SHIELD_BUILTIN_HOST_PATTERNS,
      THREAT_SHIELD_STACKED_TLD_TAIL,
      DS_BLOCK_BUILTIN_HIDE_SELECTORS,
      mergeSecurityFromStorage,
      mergeNetworkFromStorage,
      mergeDsBlockFromStorage,
      mergeDeviceSecurityFromStorage,
      mergeThreatShieldFromStorage,
      patternMatchesHost,
      normalizeExcludedDomainsListFromStorage,
    };
  } catch (_e) {}
})();
