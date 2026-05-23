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

const DEFAULT_HIGHLIGHT_ENABLED = true;
const DEFAULT_BORDER_COLOR = "#4169E1";
const DEFAULT_BORDER_OPACITY = 100;
const DEFAULT_EXCLUDED_DOMAINS = [];

const STORAGE_GET_KEYS = [
  "blockedEvents",
  "highlightEnabled",
  "borderColor",
  "borderOpacity",
  "excludedDomains",
  "extensionGloballyEnabled",
  "focusBlockingEnabled",
  "optionsReduceAnimations",
  // UI-only helper: remember the last selected Navigator/UA preset
  "securityNavPresetId",
  ...SECURITY_STORAGE_KEYS,
  ...NETWORK_STORAGE_KEYS,
  ...DS_BLOCK_STORAGE_KEYS,
  ...THREAT_SHIELD_STORAGE_KEYS,
  ...PRIVACY_PACK_STORAGE_KEYS,
  ...PRIVACY_ISOLATION_STORAGE_KEYS,
  ...DEVICE_SECURITY_STORAGE_KEYS,
];

const STATS_STORAGE_KEY = "focusBlockerStatsByHost";

/** Кэш строк таблицы для панели детализации */
let statsByHostCache = {};
let statsDetailHostOpen = "";

const STATS_CATEGORY_TITLE = {
  focus: "Фокус и видимость вкладки",
  fpSpoof: "Анти‑фингерпринт (подмена в JavaScript)",
  netJs: "Сеть на странице (Network Security)",
  dnrBlock: "Declarative Net Request — блокировка",
  dnrModify: "Declarative Net Request — подмена заголовков",
  device: "Device Security",
  ds: "DS Block (попапы и телеметрия)",
};

/** Человекочитаемые названия подфункций (ключ — код из расширения). */
const STATS_SUB_LABELS = {
  focus: {
    EventTarget_addEventListener_block: "Подфункция: перехват EventTarget.addEventListener (слушатель не зарегистрирован)",
    EventTarget_removeEventListener_block: "Подфункция: перехват EventTarget.removeEventListener",
    EventTarget_dispatchEvent_block: "Подфункция: блокировка EventTarget.dispatchEvent",
    document_hasFocus_spoof: "Подфункция: document.hasFocus() всегда true",
    window_focus_suppressed: "Подфункция: window.focus() подавлен",
    window_blur_suppressed: "Подфункция: window.blur() подавлен",
    _other: "Прочие события фокуса",
  },
  fpSpoof: {
    navigator_getBattery_spoof: "Функция: Navigator.getBattery → подменный BatteryManager",
    webgl_UNMASKED_VENDOR_WEBGL: "Функция: WebGLRenderingContext.getParameter (UNMASKED_VENDOR_WEBGL)",
    webgl_UNMASKED_RENDERER_WEBGL: "Функция: WebGLRenderingContext.getParameter (UNMASKED_RENDERER_WEBGL)",
    webgl_VENDOR_const: "Функция: WebGLRenderingContext.getParameter (VENDOR)",
    webgl_RENDERER_const: "Функция: WebGLRenderingContext.getParameter (RENDERER)",
    canvas2d_getImageData_noise: "Функция: CanvasRenderingContext2D.getImageData → добавление шума",
    offscreenCanvas_getImageData_noise: "Функция: OffscreenCanvas 2D getImageData → шум",
    fp_other: "Прочая подмена FP",
    _other: "Прочая подмена FP",
  },
  netJs: {
    fetch_private_or_local: "Функция: fetch → блокировка локальных / приватных URL",
    xhr_open_private_or_local: "Функция: XMLHttpRequest.open → блокировка локальных / приватных URL",
    websocket_private_or_local: "Функция: WebSocket → блокировка локальных / приватных URL",
    sendBeacon_private_or_local: "Функция: navigator.sendBeacon → блокировка локальных / приватных URL",
    transport_XMLHttpRequest: "Блокировка транспорта (XHR)",
    transport_WebSocket: "Блокировка транспорта (WebSocket)",
    _other: "Прочая блокировка сети на странице",
  },
  device: {
    storage_write_throw: "Функция: Storage (setItem/removeItem/clear) → исключение",
    storage_read_null: "Функция: Storage.getItem / .key → возврат null при блокировке",
    storageWin_localStorage_hidden: "Функция: window.localStorage скрыт",
    storageWin_sessionStorage_hidden: "Функция: window.sessionStorage скрыт",
    indexedDB_factory_blocked: "Функция: indexedDB.open / deleteDatabase → исключение",
    window_indexedDB_hidden: "Функция: window.indexedDB скрыт",
    CacheStorage_open_reject: "Функция: caches.open → отказ",
    CacheStorage_match_reject: "Функция: caches.match → отказ",
    CacheStorage_keys_reject: "Функция: caches.keys → отказ",
    CacheStorage_delete_reject: "Функция: caches.delete → отказ",
    CacheStorage_has_reject: "Функция: caches.has → отказ",
    window_caches_hidden: "Функция: window.caches скрыт",
    navigator_mediaDevices_hidden: "Функция: navigator.mediaDevices скрыт",
    mediaDevices_enumerateDevices_empty: "Функция: enumerateDevices → пустой список",
    mediaDevices_getUserMedia_reject: "Функция: getUserMedia → отказ",
    navigator_geolocation_hidden: "Функция: navigator.geolocation скрыт",
    geolocation_getCurrentPosition_blocked: "Функция: getCurrentPosition → ошибка позиции",
    geolocation_watchPosition_blocked: "Функция: watchPosition → ошибка позиции",
    permissions_query_camera_mic_blocked: "Функция: permissions.query (camera/microphone) → отказ",
    permissions_query_geolocation_blocked: "Функция: permissions.query (geolocation) → отказ",
    _other: "Прочие блокировки Device Security",
  },
  ds: {
    window_open_blocked: "Функция: window.open без недавнего жеста пользователя",
    synthetic_blank_nav_blocked: "Функция: блок синтетического перехода по ссылке target=_blank",
    telemetry_sendBeacon_blocked: "Функция: sendBeacon на домены телеметрии",
    _other: "Прочие действия DS Block",
  },
  dnrBlock: {
    network_regex_slot_0: "Подфункция: блок запроса по regex Network Security (слот 0)",
    ds_telemetry_slot_0: "Подфункция: блок запроса к домену телеметрии (слот 0)",
    unknown_rule: "Подфункция: неизвестное правило DNR",
    _other: "Прочие блокировки DNR",
  },
  dnrModify: {
    headers_user_agent_sec_ch: "Подфункция: подмена User-Agent и Sec-CH-UA*",
    headers_accept_language: "Подфункция: подмена Accept-Language",
    _other: "Прочая подмена заголовков",
  },
};

function statsHumanSubLabel(cat, sk) {
  const map = STATS_SUB_LABELS[cat];
  if (map && map[sk]) return map[sk];
  if (sk.startsWith("capture_DOM_")) {
    const ev = sk.slice("capture_DOM_".length);
    return `Подфункция: перехват фазы захвата DOM для события «${ev}»`;
  }
  if (sk.startsWith("document_visibility_")) {
    const p = sk.slice("document_visibility_".length);
    return `Подфункция: подмена чтения document.${p}`;
  }
  if (sk.startsWith("inline_handler_")) {
    return `Подфункция: скрытие inline handler ${sk.slice("inline_handler_".length)}`;
  }
  if (sk.startsWith("embed_") && sk.includes("_assign_blocked")) return `Подфункция: блок назначения URL (${sk})`;
  if (sk.startsWith("embed_setAttribute_")) return `Подфункция: блок setAttribute (${sk})`;
  if (sk.startsWith("network_regex_slot_"))
    return `Подфункция: блокировка по правилу Network Security (слот ${sk.slice("network_regex_slot_".length)})`;
  if (sk.startsWith("ds_telemetry_slot_"))
    return `Подфункция: блок телеметрии по слоту ${sk.slice("ds_telemetry_slot_".length)}`;
  if (sk.startsWith("privacy_pack_slot_"))
    return `Подфункция: Privacy pack — блок по слоту ${sk.slice("privacy_pack_slot_".length)}`;
  if (sk.startsWith("rule_")) return `Подфункция: срабатывание правила DNR id=${sk.slice(5)}`;
  return `Подфункция: ${sk.replace(/_/g, " ")}`;
}

function hideStatsDetail() {
  statsDetailHostOpen = "";
  const panel = document.getElementById("statsDomainDetail");
  if (panel) panel.hidden = true;
}

function showStatsDetail(host) {
  const panel = document.getElementById("statsDomainDetail");
  const title = document.getElementById("statsDetailTitle");
  const body = document.getElementById("statsDetailBody");
  if (!panel || !title || !body) return;
  statsDetailHostOpen = host;
  title.textContent = host;
  body.replaceChildren();

  const row = statsByHostCache[host];
  const bd = row && row.breakdown && typeof row.breakdown === "object" ? row.breakdown : {};

  const cats = Object.keys(bd).filter((c) => STATS_CATEGORY_TITLE[c]).sort();
  if (!cats.length) {
    const p = document.createElement("p");
    p.className = "stats-muted";
    p.textContent =
      "Для этого домена нет сохранённой детализации (данные собраны до обновления или только суммы по столбцам). Откройте сайт заново после обновления расширения.";
    body.appendChild(p);
    panel.hidden = false;
    return;
  }

  cats.forEach((cat) => {
    const section = document.createElement("div");
    section.className = "stats-detail-section";

    const funcHead = document.createElement("div");
    funcHead.className = "stats-detail-func";
    funcHead.textContent = STATS_CATEGORY_TITLE[cat] || cat;
    section.appendChild(funcHead);

    const subs = bd[cat];
    if (!subs || typeof subs !== "object") return;

    const keys = Object.keys(subs).sort((a, b) => (Number(subs[b]) || 0) - (Number(subs[a]) || 0));
    keys.forEach((sk) => {
      const wrap = document.createElement("div");
      wrap.className = "stats-detail-sub";

      const meta = document.createElement("div");
      meta.className = "stats-detail-sub-meta";

      const nameEl = document.createElement("span");
      nameEl.className = "stats-detail-sub-name";
      nameEl.textContent = statsHumanSubLabel(cat, sk);

      const codeEl = document.createElement("span");
      codeEl.className = "stats-detail-sub-code";
      codeEl.textContent = sk;

      meta.appendChild(nameEl);
      meta.appendChild(codeEl);

      const cnt = document.createElement("strong");
      cnt.className = "stats-detail-sub-count";
      cnt.textContent = String(subs[sk] ?? 0);

      wrap.appendChild(meta);
      wrap.appendChild(cnt);
      section.appendChild(wrap);
    });

    body.appendChild(section);
  });

  panel.hidden = false;
}

// Keep last-known settings snapshot as a "base" for fallbacks while user edits.
// This prevents empty fields / invalid JSON drafts from overwriting stored values with defaults.
let lastKnownStorage = {};

function num(elId, fallback) {
  const el = document.getElementById(elId);
  if (!el || el.value === "") return fallback;
  const n = Number(el.value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonArray(text, fallback) {
  try {
    const v = JSON.parse(String(text || "").trim());
    return Array.isArray(v) ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

function parseJsonObject(text, fallback) {
  try {
    const v = JSON.parse(String(text || "").trim());
    return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

function sanitizeUaBrands(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((b) => ({
      brand: String((b && b.brand) != null ? b.brand : ""),
      version: String((b && b.version) != null ? b.version : ""),
    }))
    .filter((b) => b.brand.length > 0 || b.version.length > 0);
}

function toggleActive(id) {
  const el = document.getElementById(id);
  return !!(el && el.classList.contains("active"));
}

function setToggleActive(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("active", !!on);
}

function applyPresetFields(presetKey) {
  const mergedBase = mergeSecurityFromStorage(lastKnownStorage || {});
  const presetData =
    presetKey !== "custom" && SECURITY_PRESETS[presetKey]
      ? SECURITY_PRESETS[presetKey]
      : {};

  const screen = {
    ...mergedBase.securityScreen,
    ...(presetData.securityScreen || {}),
  };
  const cpu = {
    ...mergedBase.securityCpu,
    ...(presetData.securityCpu || {}),
  };

  document.getElementById("secScreenWidth").value = screen.width;
  document.getElementById("secScreenHeight").value = screen.height;
  document.getElementById("secAvailWidth").value = screen.availWidth;
  document.getElementById("secAvailHeight").value = screen.availHeight;
  document.getElementById("secDpr").value = screen.devicePixelRatio;
  document.getElementById("secInnerWidth").value = screen.innerWidth;
  document.getElementById("secInnerHeight").value = screen.innerHeight;
  document.getElementById("secOuterWidth").value = screen.outerWidth;
  document.getElementById("secOuterHeight").value = screen.outerHeight;

  document.getElementById("secCpuCores").value = cpu.hardwareConcurrency;
  document.getElementById("secCpuMemory").value = cpu.deviceMemory;

  updatePresetHintText(presetKey);
}

function updatePresetHintText(presetKey) {
  const hint = document.getElementById("securityPresetHint");
  if (!hint) return;
  if (presetKey === "custom") {
    hint.textContent =
      "Custom: WebGL vendor/renderer применяются только в этом режиме. Screen/CPU значения также берутся из полей ниже.";
  } else {
    hint.textContent =
      "Laptop/Desktop/Mobile: при выборе профиля подставляются Screen/CPU. WebGL vendor/renderer настраиваются только в Custom (в остальных режимах WebGL выбирается алгоритмом).";
  }
}

function applySecurityUI(s) {
  setToggleActive("securityEnabled", s.securityEnabled);

  setToggleActive("secSpoofScreen", s.securitySpoofScreenEnabled);
  setToggleActive("secSpoofBattery", s.securitySpoofBatteryEnabled);
  setToggleActive("secSpoofCpu", s.securitySpoofCpuEnabled);
  setToggleActive("secSpoofMatchMedia", s.securitySpoofMatchMediaEnabled);
  setToggleActive("secSpoofWebgl", s.securitySpoofWebglEnabled);
  setToggleActive("secSpoofCanvas", s.securitySpoofCanvasEnabled);
  setToggleActive("secSpoofTimezone", s.securitySpoofTimezoneEnabled);
  setToggleActive("secSpoofNavigator", s.securitySpoofNavigatorEnabled);
  setToggleActive("secSpoofLanguages", s.securitySpoofLanguagesEnabled);
  setToggleActive("secSpoofFonts", s.securitySpoofFontsEnabled);

  document.getElementById("securityPreset").value = s.securityPreset;
  document.getElementById("securityFpMode").value = s.securityFpMode;

  const scr = s.securityScreen || {};
  document.getElementById("secScreenWidth").value = scr.width;
  document.getElementById("secScreenHeight").value = scr.height;
  document.getElementById("secAvailWidth").value = scr.availWidth;
  document.getElementById("secAvailHeight").value = scr.availHeight;
  document.getElementById("secDpr").value = scr.devicePixelRatio;
  document.getElementById("secInnerWidth").value = scr.innerWidth;
  document.getElementById("secInnerHeight").value = scr.innerHeight;
  document.getElementById("secOuterWidth").value = scr.outerWidth;
  document.getElementById("secOuterHeight").value = scr.outerHeight;

  const bat = s.securityBattery || {};
  document.getElementById("secBatLevel").value = bat.level;
  setToggleActive("secBatCharging", !!bat.charging);

  const cpu = s.securityCpu || {};
  document.getElementById("secCpuCores").value = cpu.hardwareConcurrency;
  document.getElementById("secCpuMemory").value = cpu.deviceMemory;

  const webgl = s.securityWebgl || {};
  document.getElementById("secWebglVendor").value = webgl.vendor || "";
  document.getElementById("secWebglRenderer").value = webgl.renderer || "";

  const canvas = s.securityCanvas || {};
  document.getElementById("secCanvasNoise").value = canvas.noiseLevel;

  const tz = s.securityTimezone || {};
  const tzPreset = document.getElementById("secTzPreset");
  if (tzPreset) tzPreset.value = "custom";
  document.getElementById("secTzTimeZone").value = tz.timeZone || "";
  document.getElementById("secTzOffsetMin").value =
    tz.timezoneOffsetMinutes !== undefined && tz.timezoneOffsetMinutes !== null ? tz.timezoneOffsetMinutes : "";

  const nav = s.securityNavigator || {};
  const langPreset = document.getElementById("secLangPreset");
  if (langPreset) langPreset.value = "custom";
  document.getElementById("secNavLanguage").value = nav.language || "";
  document.getElementById("secNavLanguages").value = Array.isArray(nav.languages) ? nav.languages.join("\n") : "";
  document.getElementById("secNavUserAgent").value = nav.userAgent || "";
  document.getElementById("secNavAppVersion").value = nav.appVersion || "";
  document.getElementById("secNavPlatform").value = nav.platform || "";
  document.getElementById("secNavVendor").value = nav.vendor || "";
  setToggleActive("secUaDataMobile", !!nav.uaDataMobile);
  document.getElementById("secUaPlatform").value = nav.uaDataPlatform || "";
  document.getElementById("secUaBrandsJson").value = JSON.stringify(nav.uaDataBrands || [], null, 2);
  document.getElementById("secUaHighEntropyJson").value = JSON.stringify(nav.uaDataHighEntropy || {}, null, 2);

  const fonts = s.securityFonts || {};
  document.getElementById("secFontFamilies").value = Array.isArray(fonts.families) ? fonts.families.join("\n") : "";
  document.getElementById("secFontMeasureEpsilon").value =
    fonts.measureTextEpsilon !== undefined && fonts.measureTextEpsilon !== null ? fonts.measureTextEpsilon : "";

  updatePresetHintText(s.securityPreset);
  updateSecurityFieldsVisibility();
}

function updateNetworkSubTogglesEnabled() {
  const master =
    document.getElementById("networkSecurityEnabled") &&
    document.getElementById("networkSecurityEnabled").classList.contains("active");
  ["networkBlockPrivateIp", "networkBlockLocalhost", "networkBlockEmbeddedProbes"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = master ? "1" : "0.55";
  });
  const rtc = document.getElementById("networkWebRtcProtectionEnabled");
  const rtcOn = !!(rtc && rtc.classList.contains("active"));
  const pol = document.getElementById("networkWebRtcPolicy");
  if (pol) pol.disabled = !master || !rtcOn;
}

function applyNetworkUI(net) {
  setToggleActive("networkSecurityEnabled", net.networkSecurityEnabled);
  setToggleActive("networkBlockPrivateIp", net.networkBlockPrivateIp);
  setToggleActive("networkBlockLocalhost", net.networkBlockLocalhost);
  setToggleActive("networkBlockEmbeddedProbes", net.networkBlockEmbeddedProbes);
  setToggleActive("networkWebRtcProtectionEnabled", net.networkWebRtcProtectionEnabled);
  const sel = document.getElementById("networkWebRtcPolicy");
  if (sel) {
    sel.value = NETWORK_WEBRTC_POLICY_IDS.includes(net.networkWebRtcPolicy)
      ? net.networkWebRtcPolicy
      : DEFAULT_NETWORK_SECURITY.networkWebRtcPolicy;
  }
  updateNetworkSubTogglesEnabled();
  refreshNetworkWebRtcHint();
}

function collectNetworkPayload() {
  const base = mergeNetworkFromStorage(lastKnownStorage || {});
  const polEl = document.getElementById("networkWebRtcPolicy");
  const pol = polEl ? polEl.value : base.networkWebRtcPolicy;
  return {
    networkSecurityEnabled: toggleActive("networkSecurityEnabled"),
    networkBlockPrivateIp: toggleActive("networkBlockPrivateIp"),
    networkBlockLocalhost: toggleActive("networkBlockLocalhost"),
    networkBlockEmbeddedProbes: toggleActive("networkBlockEmbeddedProbes"),
    networkWebRtcProtectionEnabled: toggleActive("networkWebRtcProtectionEnabled"),
    networkWebRtcPolicy: NETWORK_WEBRTC_POLICY_IDS.includes(pol) ? pol : base.networkWebRtcPolicy,
  };
}

function updatePrivacyPackSubControlsEnabled() {
  const master = toggleActive("privacyPackEnabled");
  ["privacyPackWideResourceTypes"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = master ? "1" : "0.55";
  });
  const ta = document.getElementById("privacyPackExtraBlockedDomains");
  if (ta) {
    ta.disabled = !master;
    ta.style.opacity = master ? "1" : "0.6";
  }
}

function applyPrivacyPackUI(pp) {
  setToggleActive("privacyPackEnabled", pp.privacyPackEnabled);
  setToggleActive("privacyPackWideResourceTypes", pp.privacyPackWideResourceTypes);
  const dom = document.getElementById("privacyPackExtraBlockedDomains");
  if (dom) dom.value = Array.isArray(pp.privacyPackExtraBlockedDomains) ? pp.privacyPackExtraBlockedDomains.join("\n") : "";
  updatePrivacyPackSubControlsEnabled();
}

function collectPrivacyPackPayload() {
  const base = mergePrivacyPackFromStorage(lastKnownStorage || {});
  const domEl = document.getElementById("privacyPackExtraBlockedDomains");
  const extraDomains = domEl
    ? domEl.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : base.privacyPackExtraBlockedDomains;

  return {
    privacyPackEnabled: toggleActive("privacyPackEnabled"),
    privacyPackWideResourceTypes: toggleActive("privacyPackWideResourceTypes"),
    privacyPackExtraBlockedDomains: extraDomains,
  };
}

function applyPrivacyIsolationUI(iso) {
  setToggleActive("privacyIsolationReferrersOff", iso.privacyIsolationReferrersOff);
  setToggleActive("privacyIsolationHyperlinkAuditingOff", iso.privacyIsolationHyperlinkAuditingOff);
  setToggleActive("privacyIsolationNetworkPredictionOff", iso.privacyIsolationNetworkPredictionOff);
}

function collectPrivacyIsolationPayload() {
  return {
    privacyIsolationReferrersOff: toggleActive("privacyIsolationReferrersOff"),
    privacyIsolationHyperlinkAuditingOff: toggleActive("privacyIsolationHyperlinkAuditingOff"),
    privacyIsolationNetworkPredictionOff: toggleActive("privacyIsolationNetworkPredictionOff"),
  };
}

function refreshPrivacyIsolationHints() {
  const el = document.getElementById("privacyIsolationHint");
  if (!el) return;
  const websites = chrome.privacy && chrome.privacy.websites;
  const network = chrome.privacy && chrome.privacy.network;

  /** @param {string} label @param {chrome.types.ChromeSetting | undefined} setObj */
  function line(label, setObj) {
    if (!setObj || typeof setObj.get !== "function") {
      return Promise.resolve(`${label}: недоступно.`);
    }
    return new Promise((resolve) => {
      try {
        setObj.get({}, (d) => {
          void chrome.runtime.lastError;
          const errMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "";
          if (errMsg) {
            resolve(`${label}: ошибка (${errMsg}).`);
            return;
          }
          const lvl = d && d.levelOfControl ? String(d.levelOfControl) : "—";
          let valRaw = "";
          if (d && Object.prototype.hasOwnProperty.call(d, "value")) {
            valRaw =
              typeof d.value === "boolean" ? (d.value ? "вкл" : "выкл") : d.value !== undefined && d.value !== null ? String(d.value) : "—";
          } else valRaw = "—";
          resolve(`${label}: ${valRaw}; контроль: ${lvl}`);
        });
      } catch (_e) {
        resolve(`${label}: ошибка.`);
      }
    });
  }

  Promise.all([
    line("Referer (referrersEnabled)", websites && websites.referrersEnabled),
    line("Hyperlink auditing (ping)", websites && websites.hyperlinkAuditingEnabled),
    line("Network prediction", network && network.networkPredictionEnabled),
  ]).then((rows) => {
    el.textContent = rows.join(" · ");
  });
}

function updateDsBlockSubControlsEnabled() {
  const master = toggleActive("dsBlockEnabled");
  ["dsBlockBlockPopups", "dsBlockCosmeticEnabled", "dsBlockTelemetryEnabled"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = master ? "1" : "0.55";
  });
  ["dsBlockExtraBlockedDomains", "dsBlockHideSelectors"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !master;
    el.style.opacity = master ? "1" : "0.6";
  });
}

function applyDsBlockUI(ds) {
  setToggleActive("dsBlockEnabled", ds.dsBlockEnabled);
  setToggleActive("dsBlockBlockPopups", ds.dsBlockBlockPopups);
  setToggleActive("dsBlockCosmeticEnabled", ds.dsBlockCosmeticEnabled);
  setToggleActive("dsBlockTelemetryEnabled", ds.dsBlockTelemetryEnabled);

  const dom = document.getElementById("dsBlockExtraBlockedDomains");
  if (dom) dom.value = Array.isArray(ds.dsBlockExtraBlockedDomains) ? ds.dsBlockExtraBlockedDomains.join("\n") : "";
  const css = document.getElementById("dsBlockHideSelectors");
  if (css) css.value = Array.isArray(ds.dsBlockHideSelectors) ? ds.dsBlockHideSelectors.join("\n") : "";

  updateDsBlockSubControlsEnabled();
}

function updateThreatShieldSubControlsEnabled() {
  const master = toggleActive("threatShieldEnabled");
  ["threatWarnHttp", "threatWarnList", "threatWarnStackedTld", "threatWarnGarbageHost", "threatWarnRedirect"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = master ? "1" : "0.55";
  });
  ["threatShieldExtraHosts", "threatShieldWhitelistHosts"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !master;
    el.style.opacity = master ? "1" : "0.6";
  });
  const nl = document.getElementById("threatGarbageMinLabels");
  if (nl) {
    nl.disabled = !master;
    nl.style.opacity = master ? "1" : "0.6";
  }
}

function applyThreatShieldUI(cfg) {
  const t = mergeThreatShieldFromStorage(cfg || {});
  setToggleActive("threatShieldEnabled", t.threatShieldEnabled);
  setToggleActive("threatWarnHttp", t.threatWarnHttp);
  setToggleActive("threatWarnList", t.threatWarnList);
  setToggleActive("threatWarnStackedTld", t.threatWarnStackedTld);
  setToggleActive("threatWarnGarbageHost", t.threatWarnGarbageHost);
  setToggleActive("threatWarnRedirect", t.threatWarnRedirect);
  const numEl = document.getElementById("threatGarbageMinLabels");
  if (numEl) numEl.value = String(typeof t.threatGarbageMinLabels === "number" ? t.threatGarbageMinLabels : 6);
  const ex = document.getElementById("threatShieldExtraHosts");
  if (ex) ex.value = Array.isArray(t.threatShieldExtraHosts) ? t.threatShieldExtraHosts.join("\n") : "";
  const wh = document.getElementById("threatShieldWhitelistHosts");
  if (wh) wh.value = Array.isArray(t.threatShieldWhitelistHosts) ? t.threatShieldWhitelistHosts.join("\n") : "";
  updateThreatShieldSubControlsEnabled();
}

function collectThreatShieldPayload() {
  const base = mergeThreatShieldFromStorage(lastKnownStorage || {});
  const exEl = document.getElementById("threatShieldExtraHosts");
  const wlEl = document.getElementById("threatShieldWhitelistHosts");
  const numEl = document.getElementById("threatGarbageMinLabels");
  const extra = exEl
    ? exEl.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : base.threatShieldExtraHosts;
  const whitelist = wlEl
    ? wlEl.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : base.threatShieldWhitelistHosts;
  let minL = numEl ? parseInt(String(numEl.value), 10) : base.threatGarbageMinLabels;
  if (!Number.isFinite(minL)) minL = base.threatGarbageMinLabels;

  return {
    threatShieldEnabled: toggleActive("threatShieldEnabled"),
    threatWarnHttp: toggleActive("threatWarnHttp"),
    threatWarnList: toggleActive("threatWarnList"),
    threatWarnStackedTld: toggleActive("threatWarnStackedTld"),
    threatWarnGarbageHost: toggleActive("threatWarnGarbageHost"),
    threatWarnRedirect: toggleActive("threatWarnRedirect"),
    threatGarbageMinLabels: minL,
    threatShieldExtraHosts: extra,
    threatShieldWhitelistHosts: whitelist,
  };
}

function applyDeviceSecurityUI(cfg) {
  const d = mergeDeviceSecurityFromStorage(cfg || {});
  setToggleActive("deviceSecurityEnabled", d.deviceSecurityEnabled);
  setToggleActive("deviceSecurityBlockStorage", d.deviceSecurityBlockStorage);
  setToggleActive("deviceSecurityBlockIndexedDb", d.deviceSecurityBlockIndexedDb);
  setToggleActive("deviceSecurityBlockCacheApi", d.deviceSecurityBlockCacheApi);
  setToggleActive("deviceSecurityHideMediaDevices", d.deviceSecurityHideMediaDevices);
  setToggleActive("deviceSecurityHideGeolocation", d.deviceSecurityHideGeolocation);
  setToggleActive("deviceSecurityLockdown", d.deviceSecurityLockdown);
}

function collectDeviceSecurityPayload() {
  const base = mergeDeviceSecurityFromStorage(lastKnownStorage || {});
  return {
    ...base,
    deviceSecurityEnabled: toggleActive("deviceSecurityEnabled"),
    deviceSecurityBlockStorage: toggleActive("deviceSecurityBlockStorage"),
    deviceSecurityBlockIndexedDb: toggleActive("deviceSecurityBlockIndexedDb"),
    deviceSecurityBlockCacheApi: toggleActive("deviceSecurityBlockCacheApi"),
    deviceSecurityHideMediaDevices: toggleActive("deviceSecurityHideMediaDevices"),
    deviceSecurityHideGeolocation: toggleActive("deviceSecurityHideGeolocation"),
    deviceSecurityLockdown: toggleActive("deviceSecurityLockdown"),
  };
}

function collectDsBlockPayload() {
  const base = mergeDsBlockFromStorage(lastKnownStorage || {});
  const domEl = document.getElementById("dsBlockExtraBlockedDomains");
  const cssEl = document.getElementById("dsBlockHideSelectors");

  const extraDomains = domEl
    ? domEl.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : base.dsBlockExtraBlockedDomains;

  const selectors = cssEl
    ? cssEl.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : base.dsBlockHideSelectors;

  return {
    dsBlockEnabled: toggleActive("dsBlockEnabled"),
    dsBlockBlockPopups: toggleActive("dsBlockBlockPopups"),
    dsBlockCosmeticEnabled: toggleActive("dsBlockCosmeticEnabled"),
    dsBlockTelemetryEnabled: toggleActive("dsBlockTelemetryEnabled"),
    dsBlockExtraBlockedDomains: extraDomains,
    dsBlockHideSelectors: selectors,
  };
}

function refreshNetworkWebRtcHint() {
  const hint = document.getElementById("networkWebRtcHint");
  if (!hint) return;
  if (!chrome.privacy || !chrome.privacy.network || !chrome.privacy.network.webRTCIPHandlingPolicy) {
    hint.textContent = "";
    return;
  }
  chrome.privacy.network.webRTCIPHandlingPolicy.get({}, (d) => {
    const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
    if (err) {
      hint.textContent = "WebRTC: не удалось прочитать политику браузера.";
      return;
    }
    const lvl = d && d.levelOfControl ? String(d.levelOfControl) : "";
    const val = d && d.value != null ? String(d.value) : "";
    if (lvl === "controllable_by_this_extension") {
      hint.textContent = `Текущее значение Chrome: ${val}. Расширение может менять политику.`;
    } else if (lvl === "controlled_by_other_extensions") {
      hint.textContent = `Сейчас ${val}, но настройку переопределяет другое расширение.`;
    } else if (lvl === "not_controllable") {
      hint.textContent = `Политика зафиксирована администратором (${val}).`;
    } else {
      hint.textContent = `Chrome: ${val} (контроль: ${lvl || "—"}).`;
    }
  });
}

function presetMajorFromKey(key) {
  const m = String(key || "").match(/_(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function populateSecurityNavPresetSelect() {
  const sel = document.getElementById("securityNavPreset");
  if (!sel || typeof SECURITY_NAV_PRESETS !== "object" || !SECURITY_NAV_PRESETS) return;

  sel.textContent = "";

  const none = document.createElement("option");
  none.value = "none";
  none.textContent = "— Не применять —";
  sel.appendChild(none);

  const groups = Array.isArray(SECURITY_NAV_PRESET_GROUPS) ? SECURITY_NAV_PRESET_GROUPS : [];
  for (const gid of groups) {
    const og = document.createElement("optgroup");
    og.label =
      (typeof SECURITY_NAV_PRESET_GROUP_LABELS === "object" && SECURITY_NAV_PRESET_GROUP_LABELS && SECURITY_NAV_PRESET_GROUP_LABELS[gid]) || gid;

    const ids = Object.keys(SECURITY_NAV_PRESETS)
      .filter((id) => SECURITY_NAV_PRESETS[id] && SECURITY_NAV_PRESETS[id].group === gid)
      .sort((a, b) => {
        const d = presetMajorFromKey(b) - presetMajorFromKey(a);
        if (d !== 0) return d;
        return String(a).localeCompare(String(b));
      });

    for (const id of ids) {
      const entry = SECURITY_NAV_PRESETS[id];
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = entry.label || id;
      og.appendChild(opt);
    }

    if (og.children.length) sel.appendChild(og);
  }
}

populateSecurityNavPresetSelect();

function applyNavigatorPreset(presetId) {
  const base = mergeSecurityFromStorage(lastKnownStorage || {});
  const entry = SECURITY_NAV_PRESETS[presetId];
  if (!entry || !entry.securityNavigator) return;

  const merged = mergeSecurityFromStorage({
    ...base,
    securityNavigator: {
      ...(base.securityNavigator || {}),
      ...(entry.securityNavigator || {}),
    },
  });

  // Ensure navigator spoofing is enabled when applying a preset.
  setToggleActive("securityEnabled", true);
  setToggleActive("secSpoofNavigator", true);

  const nav = merged.securityNavigator || {};
  document.getElementById("secNavUserAgent").value = nav.userAgent || "";
  document.getElementById("secNavAppVersion").value = nav.appVersion || "";
  document.getElementById("secNavPlatform").value = nav.platform || "";
  document.getElementById("secNavVendor").value = nav.vendor || "";
  setToggleActive("secUaDataMobile", !!nav.uaDataMobile);
  document.getElementById("secUaPlatform").value = nav.uaDataPlatform || "";
  document.getElementById("secUaBrandsJson").value = JSON.stringify(nav.uaDataBrands || [], null, 2);
  document.getElementById("secUaHighEntropyJson").value = JSON.stringify(nav.uaDataHighEntropy || {}, null, 2);

  updateSecurityFieldsVisibility();
}

const SECURITY_LANGUAGE_PRESETS = {
  "ru-RU": { language: "ru-RU", languages: ["ru-RU", "ru", "en-US", "en"] },
  "en-US": { language: "en-US", languages: ["en-US", "en"] },
  "uk-UA": { language: "uk-UA", languages: ["uk-UA", "uk", "en-US", "en"] },
  "de-DE": { language: "de-DE", languages: ["de-DE", "de", "en-US", "en"] },
  "fr-FR": { language: "fr-FR", languages: ["fr-FR", "fr", "en-US", "en"] },
  "es-ES": { language: "es-ES", languages: ["es-ES", "es", "en-US", "en"] },
};

function applyLanguagePreset(presetId) {
  const p = SECURITY_LANGUAGE_PRESETS[presetId];
  if (!p) return;

  setToggleActive("securityEnabled", true);
  setToggleActive("secSpoofLanguages", true);

  const langEl = document.getElementById("secNavLanguage");
  const langsEl = document.getElementById("secNavLanguages");
  if (langEl) langEl.value = p.language;
  if (langsEl) langsEl.value = (p.languages || []).join("\n");

  updateSecurityFieldsVisibility();
}

function updateSecurityFieldsVisibility() {
  const fields = document.querySelectorAll("#securityFields .security-field[data-sec-group]");
  if (!fields.length) return;

  const groupEnabled = {
    screen: toggleActive("secSpoofScreen"),
    battery: toggleActive("secSpoofBattery"),
    cpu: toggleActive("secSpoofCpu"),
    webgl: toggleActive("secSpoofWebgl"),
    canvas: toggleActive("secSpoofCanvas"),
    timezone: toggleActive("secSpoofTimezone"),
    navigator: toggleActive("secSpoofNavigator"),
    languages: toggleActive("secSpoofLanguages"),
    fonts: toggleActive("secSpoofFonts"),
  };

  fields.forEach((el) => {
    const g = el.dataset.secGroup;
    const on = Object.prototype.hasOwnProperty.call(groupEnabled, g) ? !!groupEnabled[g] : true;
    el.style.display = on ? "" : "none";
  });

  const preset = document.getElementById("securityPreset")?.value || "desktop";
  const customOnly = preset === "custom";
  document.querySelectorAll('#securityFields .security-field[data-sec-custom-only="webgl"]').forEach((el) => {
    el.style.display = groupEnabled.webgl && customOnly ? "" : "none";
  });
}

function collectSecurityPayload() {
  const base = mergeSecurityFromStorage(lastKnownStorage || {});

  const screen = {
    width: Math.round(num("secScreenWidth", base.securityScreen.width)),
    height: Math.round(num("secScreenHeight", base.securityScreen.height)),
    availWidth: Math.round(num("secAvailWidth", base.securityScreen.availWidth)),
    availHeight: Math.round(num("secAvailHeight", base.securityScreen.availHeight)),
    devicePixelRatio: num("secDpr", base.securityScreen.devicePixelRatio),
    innerWidth: Math.round(num("secInnerWidth", base.securityScreen.innerWidth)),
    innerHeight: Math.round(num("secInnerHeight", base.securityScreen.innerHeight)),
    outerWidth: Math.round(num("secOuterWidth", base.securityScreen.outerWidth)),
    outerHeight: Math.round(num("secOuterHeight", base.securityScreen.outerHeight)),
  };

  const batLevelRaw = num("secBatLevel", base.securityBattery.level);
  const batLevel = Math.min(1, Math.max(0, batLevelRaw));

  const presetVal = document.getElementById("securityPreset").value;
  const fpVal = document.getElementById("securityFpMode").value;

  return {
    securityEnabled: toggleActive("securityEnabled"),
    securitySpoofScreenEnabled: toggleActive("secSpoofScreen"),
    securitySpoofBatteryEnabled: toggleActive("secSpoofBattery"),
    securitySpoofCpuEnabled: toggleActive("secSpoofCpu"),
    securitySpoofMatchMediaEnabled: toggleActive("secSpoofMatchMedia"),
    securitySpoofWebglEnabled: toggleActive("secSpoofWebgl"),
    securitySpoofCanvasEnabled: toggleActive("secSpoofCanvas"),
    securitySpoofTimezoneEnabled: toggleActive("secSpoofTimezone"),
    securitySpoofNavigatorEnabled: toggleActive("secSpoofNavigator"),
    securitySpoofLanguagesEnabled: toggleActive("secSpoofLanguages"),
    securitySpoofFontsEnabled: toggleActive("secSpoofFonts"),
    securityPreset: SECURITY_PRESET_IDS.includes(presetVal) ? presetVal : base.securityPreset,
    securityFpMode: SECURITY_FP_MODES.includes(fpVal) ? fpVal : base.securityFpMode,
    securityScreen: screen,
    securityBattery: {
      level: batLevel,
      charging: toggleActive("secBatCharging"),
      chargingTime: base.securityBattery.chargingTime,
      dischargingTime: base.securityBattery.dischargingTime,
    },
    securityCpu: {
      hardwareConcurrency: Math.round(num("secCpuCores", base.securityCpu.hardwareConcurrency)),
      deviceMemory: num("secCpuMemory", base.securityCpu.deviceMemory),
    },
    securityWebgl: {
      vendor: document.getElementById("secWebglVendor").value || base.securityWebgl.vendor,
      renderer: document.getElementById("secWebglRenderer").value || base.securityWebgl.renderer,
    },
    securityCanvas: {
      noiseLevel: Math.round(num("secCanvasNoise", base.securityCanvas.noiseLevel)),
    },
    securityTimezone: {
      timeZone:
        document.getElementById("secTzTimeZone").value.trim() ||
        (base.securityTimezone && base.securityTimezone.timeZone) ||
        "Europe/Berlin",
      timezoneOffsetMinutes: (() => {
        const el = document.getElementById("secTzOffsetMin");
        const raw = el ? String(el.value || "").trim() : "";
        if (!raw) return null;
        const n = Number(raw);
        if (Number.isFinite(n)) return Math.round(n);
        const baseN = base && base.securityTimezone ? base.securityTimezone.timezoneOffsetMinutes : null;
        return typeof baseN === "number" && Number.isFinite(baseN) ? Math.round(baseN) : null;
      })(),
    },
    securityNavigator: {
      language: document.getElementById("secNavLanguage").value.trim() || base.securityNavigator.language,
      languages: (() => {
        const raw = document.getElementById("secNavLanguages").value || "";
        const list = raw
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (list.length) return list;
        const lang = document.getElementById("secNavLanguage").value.trim() || base.securityNavigator.language;
        if (lang) return [lang];
        return Array.isArray(base.securityNavigator.languages) ? base.securityNavigator.languages : [];
      })(),
      userAgent: document.getElementById("secNavUserAgent").value.trim() || base.securityNavigator.userAgent,
      appVersion: document.getElementById("secNavAppVersion").value.trim() || base.securityNavigator.appVersion,
      platform: document.getElementById("secNavPlatform").value.trim() || base.securityNavigator.platform,
      vendor: document.getElementById("secNavVendor").value.trim() || base.securityNavigator.vendor,
      uaDataMobile: toggleActive("secUaDataMobile"),
      uaDataPlatform:
        document.getElementById("secUaPlatform").value.trim() || base.securityNavigator.uaDataPlatform,
      uaDataBrands: sanitizeUaBrands(
        parseJsonArray(document.getElementById("secUaBrandsJson").value, base.securityNavigator.uaDataBrands)
      ),
      uaDataHighEntropy: parseJsonObject(
        document.getElementById("secUaHighEntropyJson").value,
        base.securityNavigator.uaDataHighEntropy || {}
      ),
    },
    securityFonts: {
      families: document.getElementById("secFontFamilies").value
        .split("\n")
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line.length > 0),
      measureTextEpsilon: num("secFontMeasureEpsilon", base.securityFonts.measureTextEpsilon),
    },
  };
}

function getStorageArea() {
  // `sync` can be unavailable/limited in some Chromium forks; use `local` as the canonical store.
  return (chrome.storage && chrome.storage.local) || chrome.storage.sync;
}

function maybeMigrateSyncToLocal(keys, done) {
  try {
    if (!chrome.storage || !chrome.storage.sync || !chrome.storage.local) return done();
    chrome.storage.local.get(keys, (localResult) => {
      const localHasAny = localResult && Object.keys(localResult).length > 0;
      if (localHasAny) return done();
      chrome.storage.sync.get(keys, (syncResult) => {
        const syncHasAny = syncResult && Object.keys(syncResult).length > 0;
        if (!syncHasAny) return done();
        chrome.storage.local.set(syncResult, () => done());
      });
    });
  } catch (e) {
    done();
  }
}

function syncReduceMotionClassFromToggle() {
  const el = document.getElementById("optionsReduceAnimations");
  document.documentElement.classList.toggle(
    "reduce-motion",
    !!(el && el.classList.contains("active"))
  );
}

/** Полная синхронизация DOM страницы настроек с объектом результата `chrome.storage.get`. */
function applyOptionsFromStorageResult(result) {
  if (!result || typeof result !== "object") result = {};

  lastKnownStorage = result && typeof result === "object" ? { ...result } : {};

  const blockedEvents = result.blockedEvents || DEFAULT_BLOCKED_EVENTS;
  const highlightEnabled =
    result.highlightEnabled !== undefined ? result.highlightEnabled : DEFAULT_HIGHLIGHT_ENABLED;
  const borderColor = result.borderColor || DEFAULT_BORDER_COLOR;
  const borderOpacity = result.borderOpacity !== undefined ? result.borderOpacity : DEFAULT_BORDER_OPACITY;
  const excludedDomainsRaw = Array.isArray(result.excludedDomains)
    ? result.excludedDomains
    : DEFAULT_EXCLUDED_DOMAINS;
  const excludedDomains = normalizeExcludedDomainsListFromStorage(excludedDomainsRaw);

  document.querySelectorAll(".toggle[data-event]").forEach((toggle) => {
    const event = toggle.dataset.event;
    if (blockedEvents.includes(event)) toggle.classList.add("active");
    else toggle.classList.remove("active");
  });

  document.getElementById("borderColor").value = borderColor;
  document.getElementById("borderColorValue").textContent = borderColor;

  document.getElementById("borderOpacity").value = borderOpacity;
  document.getElementById("borderOpacityValue").textContent = borderOpacity + "%";

  setToggleActive("highlightEnabled", highlightEnabled);

  updateHighlightSettingsVisibility(highlightEnabled);

  document.getElementById("excludedDomains").value = excludedDomains.join("\n");

  setToggleActive("extensionGloballyEnabled", result.extensionGloballyEnabled !== false);
  setToggleActive("focusBlockingEnabled", result.focusBlockingEnabled !== false);
  setToggleActive("optionsReduceAnimations", !!result.optionsReduceAnimations);
  syncReduceMotionClassFromToggle();

  applySecurityUI(mergeSecurityFromStorage(result));

  applyNetworkUI(mergeNetworkFromStorage(result));

  applyPrivacyPackUI(mergePrivacyPackFromStorage(result));

  applyPrivacyIsolationUI(mergePrivacyIsolationFromStorage(result));
  refreshPrivacyIsolationHints();

  applyDsBlockUI(mergeDsBlockFromStorage(result));

  applyThreatShieldUI(mergeThreatShieldFromStorage(result));

  applyDeviceSecurityUI(mergeDeviceSecurityFromStorage(result));

  const navPresetSelect = document.getElementById("securityNavPreset");
  if (navPresetSelect) {
    const savedPresetId =
      result && typeof result.securityNavPresetId === "string" ? result.securityNavPresetId : "none";
    const entry = savedPresetId && SECURITY_NAV_PRESETS[savedPresetId];
    navPresetSelect.value = entry && entry.securityNavigator ? savedPresetId : "none";
  }
}

maybeMigrateSyncToLocal(STORAGE_GET_KEYS, () => {
  getStorageArea().get(STORAGE_GET_KEYS, (result) => {
    void chrome.runtime.lastError;
    applyOptionsFromStorageResult(result || {});
  });
});

document.querySelectorAll(".toggle[data-event]").forEach((toggle) => {
  toggle.addEventListener("click", function () {
    this.classList.toggle("active");
    saveSettings();
  });
});

["extensionGloballyEnabled", "focusBlockingEnabled", "optionsReduceAnimations"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    el.classList.toggle("active");
    if (id === "optionsReduceAnimations") syncReduceMotionClassFromToggle();
    saveSettings();
  });
});

const highlightToggle = document.getElementById("highlightEnabled");
highlightToggle.addEventListener("click", function () {
  this.classList.toggle("active");
  const isEnabled = this.classList.contains("active");
  updateHighlightSettingsVisibility(isEnabled);
  saveSettings();
});

const borderColorPicker = document.getElementById("borderColor");
const borderColorValue = document.getElementById("borderColorValue");

borderColorPicker.addEventListener("input", function () {
  borderColorValue.textContent = this.value;
  saveSettings();
});

const borderOpacitySlider = document.getElementById("borderOpacity");
const borderOpacityValue = document.getElementById("borderOpacityValue");

borderOpacitySlider.addEventListener("input", function () {
  borderOpacityValue.textContent = this.value + "%";
  saveSettings();
});

const excludedDomainsTextarea = document.getElementById("excludedDomains");
excludedDomainsTextarea.addEventListener("input", function () {
  saveSettings();
});

["dsBlockEnabled", "dsBlockBlockPopups", "dsBlockCosmeticEnabled", "dsBlockTelemetryEnabled"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    el.classList.toggle("active");
    updateDsBlockSubControlsEnabled();
    saveSettings();
  });
});

["dsBlockExtraBlockedDomains", "dsBlockHideSelectors"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => saveSettings());
});

["threatShieldEnabled", "threatWarnHttp", "threatWarnList", "threatWarnStackedTld", "threatWarnGarbageHost", "threatWarnRedirect"].forEach(
  (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", () => {
      el.classList.toggle("active");
      updateThreatShieldSubControlsEnabled();
      saveSettings();
    });
  }
);

["threatShieldExtraHosts", "threatShieldWhitelistHosts"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => saveSettings());
});

const threatGarbageMinLabelsEl = document.getElementById("threatGarbageMinLabels");
if (threatGarbageMinLabelsEl) {
  threatGarbageMinLabelsEl.addEventListener("input", () => saveSettings());
}

const threatResetBtn = document.getElementById("threatShieldResetDefaults");
if (threatResetBtn) {
  threatResetBtn.addEventListener("click", () => {
    applyThreatShieldUI(DEFAULT_THREAT_SHIELD);
    saveSettings();
  });
}

[
  "deviceSecurityEnabled",
  "deviceSecurityBlockStorage",
  "deviceSecurityBlockIndexedDb",
  "deviceSecurityBlockCacheApi",
  "deviceSecurityHideMediaDevices",
  "deviceSecurityHideGeolocation",
  "deviceSecurityLockdown",
].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    el.classList.toggle("active");
    saveSettings();
  });
});

const deviceResetBtn = document.getElementById("deviceSecurityResetDefaults");
if (deviceResetBtn) {
  deviceResetBtn.addEventListener("click", () => {
    applyDeviceSecurityUI(DEFAULT_DEVICE_SECURITY);
    saveSettings();
  });
}

[
  "networkSecurityEnabled",
  "networkBlockPrivateIp",
  "networkBlockLocalhost",
  "networkBlockEmbeddedProbes",
  "networkWebRtcProtectionEnabled",
].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    el.classList.toggle("active");
    updateNetworkSubTogglesEnabled();
    refreshNetworkWebRtcHint();
    saveSettings();
  });
});

const networkWebRtcPolicySelect = document.getElementById("networkWebRtcPolicy");
if (networkWebRtcPolicySelect) {
  networkWebRtcPolicySelect.addEventListener("change", () => {
    refreshNetworkWebRtcHint();
    saveSettings();
  });
}

const networkResetBtn = document.getElementById("networkResetDefaults");
if (networkResetBtn) {
  networkResetBtn.addEventListener("click", () => {
    applyNetworkUI(DEFAULT_NETWORK_SECURITY);
    saveSettings();
  });
}

const dsResetBtn = document.getElementById("dsBlockResetDefaults");
if (dsResetBtn) {
  dsResetBtn.addEventListener("click", () => {
    applyDsBlockUI(DEFAULT_DS_BLOCK);
    saveSettings();
  });
}

["privacyPackEnabled", "privacyPackWideResourceTypes"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    el.classList.toggle("active");
    updatePrivacyPackSubControlsEnabled();
    saveSettings();
  });
});

const privacyPackTa = document.getElementById("privacyPackExtraBlockedDomains");
if (privacyPackTa) {
  privacyPackTa.addEventListener("input", () => saveSettings());
}

const privacyPackResetBtn = document.getElementById("privacyPackResetDefaults");
if (privacyPackResetBtn) {
  privacyPackResetBtn.addEventListener("click", () => {
    applyPrivacyPackUI(DEFAULT_PRIVACY_PACK);
    saveSettings();
  });
}

["privacyIsolationReferrersOff", "privacyIsolationHyperlinkAuditingOff", "privacyIsolationNetworkPredictionOff"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    el.classList.toggle("active");
    saveSettings();
    setTimeout(() => refreshPrivacyIsolationHints(), 180);
  });
});

const privacyIsolationResetBtn = document.getElementById("privacyIsolationResetDefaults");
if (privacyIsolationResetBtn) {
  privacyIsolationResetBtn.addEventListener("click", () => {
    applyPrivacyIsolationUI(DEFAULT_PRIVACY_ISOLATION);
    saveSettings();
    setTimeout(() => refreshPrivacyIsolationHints(), 180);
  });
}

if (chrome.privacy && chrome.privacy.websites) {
  try {
    const ws = chrome.privacy.websites;
    if (ws.referrersEnabled && ws.referrersEnabled.onChange) {
      ws.referrersEnabled.onChange.addListener(() => refreshPrivacyIsolationHints());
    }
    if (ws.hyperlinkAuditingEnabled && ws.hyperlinkAuditingEnabled.onChange) {
      ws.hyperlinkAuditingEnabled.onChange.addListener(() => refreshPrivacyIsolationHints());
    }
  } catch (_e0) {}
}
if (
  chrome.privacy &&
  chrome.privacy.network &&
  chrome.privacy.network.networkPredictionEnabled &&
  chrome.privacy.network.networkPredictionEnabled.onChange
) {
  try {
    chrome.privacy.network.networkPredictionEnabled.onChange.addListener(() => refreshPrivacyIsolationHints());
  } catch (_e1) {}
}

if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy && chrome.privacy.network.webRTCIPHandlingPolicy.onChange) {
  try {
    chrome.privacy.network.webRTCIPHandlingPolicy.onChange.addListener(() => refreshNetworkWebRtcHint());
  } catch (e) {}
}

[
  "securityEnabled",
  "secSpoofScreen",
  "secSpoofBattery",
  "secSpoofCpu",
  "secSpoofMatchMedia",
  "secSpoofWebgl",
  "secSpoofCanvas",
  "secSpoofTimezone",
  "secSpoofNavigator",
  "secSpoofLanguages",
  "secSpoofFonts",
  "secBatCharging",
  "secUaDataMobile",
].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    el.classList.toggle("active");
    updateSecurityFieldsVisibility();
    saveSettings();
  });
});

document.getElementById("securityPreset").addEventListener("change", function () {
  const v = this.value;
  if (v !== "custom") {
    applyPresetFields(v);
  } else {
    updatePresetHintText("custom");
  }
  updateSecurityFieldsVisibility();
  saveSettings();
});

document.getElementById("securityFpMode").addEventListener("change", () => saveSettings());

const securityResetBtn = document.getElementById("securityResetDefaults");
if (securityResetBtn) {
  securityResetBtn.addEventListener("click", () => {
    applySecurityUI(DEFAULT_SECURITY);
    saveSettings();
  });
}

const securityApplyNavPresetBtn = document.getElementById("securityApplyNavPreset");
if (securityApplyNavPresetBtn) {
  securityApplyNavPresetBtn.addEventListener("click", () => {
    const id = document.getElementById("securityNavPreset")?.value || "none";
    if (id === "none") return;
    applyNavigatorPreset(id);
    saveSettings();
  });
}

const securityApplyLangPresetBtn = document.getElementById("secLangApplyPreset");
if (securityApplyLangPresetBtn) {
  securityApplyLangPresetBtn.addEventListener("click", () => {
    const id = document.getElementById("secLangPreset")?.value || "custom";
    if (id === "custom") return;
    applyLanguagePreset(id);
    saveSettings();
  });
}

const securityLangPresetSelect = document.getElementById("secLangPreset");
if (securityLangPresetSelect) {
  securityLangPresetSelect.addEventListener("change", () => {
    const id = securityLangPresetSelect.value || "custom";
    if (id === "custom") return;
    applyLanguagePreset(id);
    saveSettings();
  });
}

function applyTimezonePreset(timeZoneId) {
  const tz = String(timeZoneId || "").trim();
  if (!tz) return;
  setToggleActive("securityEnabled", true);
  setToggleActive("secSpoofTimezone", true);
  const tzEl = document.getElementById("secTzTimeZone");
  const offEl = document.getElementById("secTzOffsetMin");
  if (tzEl) tzEl.value = tz;
  if (offEl) offEl.value = ""; // auto-offset
  updateSecurityFieldsVisibility();
}

const securityApplyTzPresetBtn = document.getElementById("secTzApplyPreset");
if (securityApplyTzPresetBtn) {
  securityApplyTzPresetBtn.addEventListener("click", () => {
    const id = document.getElementById("secTzPreset")?.value || "custom";
    if (id === "custom") return;
    applyTimezonePreset(id);
    saveSettings();
  });
}

const securityTzPresetSelect = document.getElementById("secTzPreset");
if (securityTzPresetSelect) {
  securityTzPresetSelect.addEventListener("change", () => {
    const id = securityTzPresetSelect.value || "custom";
    if (id === "custom") return;
    applyTimezonePreset(id);
    saveSettings();
  });
}

// Auto-apply Navigator/UA preset on selection change (no need to click "Применить").
const securityNavPresetSelect = document.getElementById("securityNavPreset");
if (securityNavPresetSelect) {
  securityNavPresetSelect.addEventListener("change", () => {
    const id = securityNavPresetSelect.value || "none";
    if (id === "none") return;
    applyNavigatorPreset(id);
    saveSettings();
  });
}

[
  "secScreenWidth",
  "secScreenHeight",
  "secAvailWidth",
  "secAvailHeight",
  "secDpr",
  "secInnerWidth",
  "secInnerHeight",
  "secOuterWidth",
  "secOuterHeight",
  "secBatLevel",
  "secCpuCores",
  "secCpuMemory",
  "secWebglVendor",
  "secWebglRenderer",
  "secCanvasNoise",
  "secTzTimeZone",
  "secTzOffsetMin",
  "secNavLanguage",
  "secNavLanguages",
  "secNavUserAgent",
  "secNavAppVersion",
  "secNavPlatform",
  "secNavVendor",
  "secUaPlatform",
  "secUaBrandsJson",
  "secUaHighEntropyJson",
  "secFontFamilies",
  "secFontMeasureEpsilon",
].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => saveSettings());
});

function updateHighlightSettingsVisibility(enabled) {
  const borderColorSettings = document.getElementById("borderColorSettings");
  const borderOpacitySettings = document.getElementById("borderOpacitySettings");

  if (enabled) {
    borderColorSettings.style.display = "flex";
    borderOpacitySettings.style.display = "flex";
  } else {
    borderColorSettings.style.display = "none";
    borderOpacitySettings.style.display = "none";
  }
}

function buildSettingsPayload() {
  const blockedEvents = [];

  document.querySelectorAll(".toggle[data-event].active").forEach((toggle) => {
    blockedEvents.push(toggle.dataset.event);
  });

  const highlightEnabled = highlightToggle.classList.contains("active");
  const borderColor = borderColorPicker.value;
  const borderOpacity = parseInt(borderOpacitySlider.value);

  const excludedDomains = normalizeExcludedDomainsListFromStorage(excludedDomainsTextarea.value.split(/\r?\n/));

  const sec = collectSecurityPayload();
  const net = collectNetworkPayload();
  const pp = collectPrivacyPackPayload();
  const iso = collectPrivacyIsolationPayload();
  const ds = collectDsBlockPayload();
  const ts = collectThreatShieldPayload();
  const dev = collectDeviceSecurityPayload();

  return {
    blockedEvents,
    highlightEnabled,
    borderColor,
    borderOpacity,
    excludedDomains,
    extensionGloballyEnabled: toggleActive("extensionGloballyEnabled"),
    focusBlockingEnabled: toggleActive("focusBlockingEnabled"),
    optionsReduceAnimations: toggleActive("optionsReduceAnimations"),
    securityNavPresetId: document.getElementById("securityNavPreset")?.value || "none",
    ...sec,
    ...net,
    ...pp,
    ...iso,
    ...ds,
    ...ts,
    ...dev,
  };
}

let savingInFlight = false;
let saveTimer = null;

function saveToastHideMs() {
  if (document.documentElement.classList.contains("reduce-motion")) return 380;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 380;
  } catch (_e) {}
  return 2000;
}

function showSavedToast() {
  const saveStatus = document.getElementById("saveStatus");
  if (!saveStatus) return;
  saveStatus.classList.add("show");
  setTimeout(() => {
    saveStatus.classList.remove("show");
  }, saveToastHideMs());
}

function flushSaveNow() {
  if (savingInFlight) return;

  savingInFlight = true;
  const payload = buildSettingsPayload();

  getStorageArea().set(payload, () => {
    const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
    if (err) {
      // Keep UI quiet, but don't lose future saves.
      // eslint-disable-next-line no-console
      console.warn("[focus-blocker] options save failed:", err.message);
    } else {
      // Update local snapshot so future fallbacks preserve the user's latest saved values.
      lastKnownStorage = { ...(lastKnownStorage || {}), ...(payload || {}) };
      showSavedToast();
    }

    savingInFlight = false;
  });
}

function saveSettings() {
  // Debounce + serialize writes; payload собирается в момент flush из актуального DOM.
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushSaveNow();
  }, 120);
}

// Best-effort: if the options page closes quickly after changes, flush immediately.
window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  flushSaveNow();
});

function statsRowTotal(row) {
  if (!row || typeof row !== "object") return 0;
  const keys = ["focus", "fpSpoof", "netJs", "dnrBlock", "dnrModify", "device", "ds"];
  let t = 0;
  for (let i = 0; i < keys.length; i++) {
    const n = Number(row[keys[i]]);
    if (Number.isFinite(n) && n > 0) t += Math.floor(n);
  }
  return t;
}

function statsFmtCell(n) {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
  return v > 0 ? String(v) : "—";
}

function refreshStatsPanel() {
  const tbody = document.getElementById("statsTableBody");
  const emptyHint = document.getElementById("statsEmptyHint");
  if (!tbody) return;
  getStorageArea().get([STATS_STORAGE_KEY], (r) => {
    void chrome.runtime.lastError;
    const raw = r && r[STATS_STORAGE_KEY];
    const byHost = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    statsByHostCache = { ...byHost };
    const hosts = Object.keys(byHost).sort((a, b) => statsRowTotal(byHost[b]) - statsRowTotal(byHost[a]));
    tbody.replaceChildren();
    if (!hosts.length) {
      hideStatsDetail();
      if (emptyHint) emptyHint.style.display = "block";
      return;
    }
    if (emptyHint) emptyHint.style.display = "none";
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      const row = byHost[host];
      const total = statsRowTotal(row);
      const tr = document.createElement("tr");
      tr.className = "stats-row-selectable";
      tr.dataset.host = host;
      tr.tabIndex = 0;
      const labels = [
        host,
        statsFmtCell(row.focus),
        statsFmtCell(row.fpSpoof),
        statsFmtCell(row.netJs),
        statsFmtCell(row.dnrBlock),
        statsFmtCell(row.dnrModify),
        statsFmtCell(row.device),
        statsFmtCell(row.ds),
        statsFmtCell(total),
      ];
      for (let j = 0; j < labels.length; j++) {
        const td = document.createElement("td");
        if (j === 0) {
          td.className = "stats-row-domain";
          td.textContent = labels[j];
        } else {
          td.textContent = labels[j];
        }
        tr.appendChild(td);
      }
      function activateRow() {
        showStatsDetail(host);
      }
      tr.addEventListener("click", activateRow);
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activateRow();
        }
      });
      tbody.appendChild(tr);
    }
    if (statsDetailHostOpen && statsByHostCache[statsDetailHostOpen]) {
      showStatsDetail(statsDetailHostOpen);
    }
  });
}

(function initStatsPanel() {
  const closeBtn = document.getElementById("statsDetailClose");
  if (closeBtn) closeBtn.addEventListener("click", () => hideStatsDetail());

  const clearBtn = document.getElementById("statsClearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      getStorageArea().set({ [STATS_STORAGE_KEY]: {} }, () => {
        void chrome.runtime.lastError;
        hideStatsDetail();
        refreshStatsPanel();
      });
    });
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" && area !== "sync") return;
      if (!changes || !changes[STATS_STORAGE_KEY]) return;
      refreshStatsPanel();
    });
  } catch (_e) {}
})();

(function initSettingsSidebar() {
  const navButtons = document.querySelectorAll(".nav-item[data-panel]");
  const panels = document.querySelectorAll(".settings-panel");
  if (!navButtons.length || !panels.length) return;

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const panelId = btn.getAttribute("data-panel");
      if (!panelId) return;

      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === panelId);
      });
      if (panelId === "panel-network") {
        refreshNetworkWebRtcHint();
      }
      if (panelId === "panel-stats") {
        refreshStatsPanel();
      }
    });
  });
})();