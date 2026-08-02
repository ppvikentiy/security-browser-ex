(() => {
  "use strict";

  const DEFAULT_HIGHLIGHT_ENABLED = true;
  const DEFAULT_BORDER_COLOR = "#4169E1";
  const DEFAULT_BORDER_OPACITY = 100;
  const DEFAULT_EXCLUDED_DOMAINS = [];

  const STORAGE_KEYS = [
    "highlightEnabled",
    "borderColor",
    "borderOpacity",
    "excludedDomains",
    "extensionGloballyEnabled",
  ];
  const SESSION_PAUSE_KEY = "focusBlockerPausedTabIds";

  let highlightEnabled = DEFAULT_HIGHLIGHT_ENABLED;
  let borderColor = DEFAULT_BORDER_COLOR;
  let borderOpacity = DEFAULT_BORDER_OPACITY;
  let isEnabled = false;
  let refreshGeneration = 0;
  let currentElement = null;
  let copyInProgress = false;

  function getStorageArea() {
    // `sync` can be unavailable/limited in some Chromium forks; use `local` as the canonical store.
    try {
      const s = typeof chrome !== "undefined" ? chrome.storage : undefined;
      if (!s) return null;
      return s.local || s.sync || null;
    } catch (_e) {
      return null;
    }
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
    } catch (_e) {
      done();
    }
  }

  // patternMatchesHost + normalizeExcludedDomainsListFromStorage: src/security-defaults.js
  // (injected in the same isolated world via the document_start content_scripts entry; do not reload here).
  // On some Chromium forks content scripts may not share scope; fall back to shared root if exposed.
  function fbSharedRoot() {
    try {
      if (typeof globalThis !== "undefined" && globalThis.__focusBlockerShared) {
        return globalThis.__focusBlockerShared;
      }
    } catch (_e) {}
    try {
      if (typeof window !== "undefined" && window.__focusBlockerShared) {
        return window.__focusBlockerShared;
      }
    } catch (_e2) {}
    return null;
  }

  function fbPatternMatchesHost(pattern, host) {
    const shr = fbSharedRoot();
    if (shr && typeof shr.patternMatchesHost === "function") {
      return shr.patternMatchesHost(pattern, host);
    }
    try {
      if (typeof patternMatchesHost === "function") {
        return patternMatchesHost(pattern, host);
      }
    } catch (_e) {}
    return false;
  }

  function fbNormalizeExcludedDomainsListFromStorage(rawList) {
    const shr = fbSharedRoot();
    if (shr && typeof shr.normalizeExcludedDomainsListFromStorage === "function") {
      return shr.normalizeExcludedDomainsListFromStorage(rawList);
    }
    try {
      if (typeof normalizeExcludedDomainsListFromStorage === "function") {
        return normalizeExcludedDomainsListFromStorage(rawList);
      }
    } catch (_e) {}
    return [];
  }

  // Extension is enabled everywhere except excluded domains
  function isExcluded(excludedDomains) {
    const currentHost = window.location.hostname;
    return (excludedDomains || []).some((pattern) => fbPatternMatchesHost(pattern, currentHost));
  }

  function refreshFromStorage() {
    const myGeneration = ++refreshGeneration;
    const area = getStorageArea();

    function finish(result, paused) {
      if (myGeneration !== refreshGeneration) return;
      highlightEnabled = result.highlightEnabled !== undefined ? result.highlightEnabled : DEFAULT_HIGHLIGHT_ENABLED;
      borderColor = result.borderColor || DEFAULT_BORDER_COLOR;
      borderOpacity = result.borderOpacity !== undefined ? result.borderOpacity : DEFAULT_BORDER_OPACITY;
      const rawExcluded = Array.isArray(result.excludedDomains) ? result.excludedDomains : DEFAULT_EXCLUDED_DOMAINS;
      const excludedDomains = fbNormalizeExcludedDomainsListFromStorage(rawExcluded);
      const globalOn = result.extensionGloballyEnabled !== false;
      isEnabled = globalOn && !isExcluded(excludedDomains) && !paused;
      updateStyles();
      if (!isEnabled) {
        clearAllHighlights();
        currentElement = null;
      }
    }

    function applyWithPause(result) {
      const snapshot = result && typeof result === "object" ? result : {};
      try {
        if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
          finish(snapshot, false);
          return;
        }
        chrome.runtime.sendMessage({ type: "FB_IS_TAB_PAUSED" }, (resp) => {
          if (myGeneration !== refreshGeneration) return;
          const paused = chrome.runtime.lastError ? false : !!(resp && resp.paused);
          finish(snapshot, paused);
        });
      } catch (_e) {
        finish(snapshot, false);
      }
    }

    if (!area || typeof area.get !== "function") {
      applyWithPause({});
      return;
    }
    area.get(STORAGE_KEYS, (result) => {
      void chrome.runtime.lastError;
      if (myGeneration !== refreshGeneration) return;
      applyWithPause(result || {});
    });
  }

  const style = document.createElement("style");
  const className = `highlight_asdfqweafsdfa`;

  /** @returns {boolean} */
  function isValidHexColor(hex) {
    return typeof hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(hex);
  }

  /** @param {string} hex @returns {{ r: number, g: number, b: number } | null} */
  function parseHexRgb(hex) {
    if (!isValidHexColor(hex)) return null;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (![r, g, b].every((n) => Number.isFinite(n))) return null;
    return { r, g, b };
  }

  function hexToRgba(hex, alpha) {
    const rgb = parseHexRgb(hex) || parseHexRgb(DEFAULT_BORDER_COLOR);
    if (!rgb) return `rgba(65, 105, 225, ${alpha})`;
    const { r, g, b } = rgb;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function updateStyles() {
    const borderOpacityValue = Math.min(1, Math.max(0, borderOpacity / 100));
    const colorForOutline = isValidHexColor(borderColor) ? borderColor : DEFAULT_BORDER_COLOR;

    if (isEnabled && (highlightEnabled || borderOpacityValue > 0)) {
      style.textContent = `
        .${className} {
          outline: 2px solid ${hexToRgba(colorForOutline, borderOpacityValue)} !important;
        }
      `;
    } else {
      style.textContent = "";
    }
  }

  function clearAllHighlights() {
    document.querySelectorAll(`.${className}`).forEach((el) => {
      try {
        el.classList.remove(className);
      } catch (e) {}
    });
  }

  updateStyles();

  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.head.appendChild(style);
    });
  }

  maybeMigrateSyncToLocal(STORAGE_KEYS, () => {
    refreshFromStorage();
  });

  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== "local" && namespace !== "sync") return;
        if (!changes || !Object.keys(changes).length) return;
        refreshFromStorage();
      });
    }
  } catch (_e) {}

  try {
    if (chrome.storage && chrome.storage.session && chrome.storage.session.onChanged) {
      chrome.storage.session.onChanged.addListener((changes) => {
        if (!changes || !changes[SESSION_PAUSE_KEY]) return;
        refreshFromStorage();
      });
    }
  } catch (_e) {}

  try {
    if (chrome.runtime && typeof chrome.runtime.onMessage === "object") {
      chrome.runtime.onMessage.addListener((msg) => {
        if (!msg || msg.type !== "FB_REFRESH_SETTINGS") return;
        refreshFromStorage();
      });
    }
  } catch (_e) {}

  document.addEventListener("mousemove", function (event) {
    if (!isEnabled || copyInProgress) return;

    const isMetaKeyPressed = event.metaKey || event.ctrlKey;

    clearAllHighlights();
    currentElement = null;

    if (!isMetaKeyPressed) {
      return;
    }

    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (element && element.nodeType === Node.ELEMENT_NODE) {
      try {
        if (highlightEnabled) {
          element.classList.add(className);
        }

        currentElement = element;
      } catch (e) {}
    }
  });

  document.addEventListener("keydown", async function (event) {
    if (!isEnabled) return;
    
    const isMetaKeyPressed = event.metaKey || event.ctrlKey;
    const shouldCopy = isMetaKeyPressed && event.altKey;

    if (!highlightEnabled && shouldCopy) {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (element && element.nodeType === Node.ELEMENT_NODE && !copyInProgress) {
        currentElement = element;
      }
    }

    if (!currentElement || copyInProgress) {
      return;
    }

    if (shouldCopy) {
      event.preventDefault();
      copyInProgress = true;

      let textToCopy = "";
      try {
        textToCopy = currentElement.innerText || currentElement.textContent || "";
      } catch (e) {
        console.error("Failed to get text content:", e);
        copyInProgress = false;
        return;
      }

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          const body = document.body;
          if (!body) {
            copyInProgress = false;
            return;
          }
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          textArea.style.left = "-9999px";
          textArea.style.top = "-9999px";
          body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          try {
            document.execCommand("copy");
          } catch (e) {
            console.error("execCommand failed:", e);
          }

          body.removeChild(textArea);
        }

        clearAllHighlights();
        copyInProgress = false;
      } catch (err) {
        console.error("Failed to copy:", err);
        copyInProgress = false;
      }

      currentElement = null;
    } else if (!isMetaKeyPressed) {
      clearAllHighlights();
      currentElement = null;
    }
  });

  document.addEventListener("keyup", function (event) {
    if ((event.key === "Meta" || event.key === "Control") && !copyInProgress) {
      clearAllHighlights();
      currentElement = null;
    }
  });

  window.addEventListener("blur", function () {
    clearAllHighlights();
    currentElement = null;
  });
})();
