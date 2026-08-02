"use strict";

function $(id) {
  return document.getElementById(id);
}

function i18nT(key, vars) {
  try {
    if (typeof FbI18n !== "undefined" && FbI18n && typeof FbI18n.t === "function") {
      return FbI18n.t(key, vars);
    }
  } catch (_e) {}
  return key;
}

function applyPopupLanguage(lang) {
  try {
    if (typeof FbI18n !== "undefined" && FbI18n && typeof FbI18n.setUiLang === "function") {
      FbI18n.setUiLang(lang, document);
    }
  } catch (_e) {}
}

function setToggle(el, on) {
  if (!el) return;
  el.classList.toggle("active", !!on);
  if (el.getAttribute("role") === "switch") {
    el.setAttribute("aria-checked", on ? "true" : "false");
  }
}

function bindBoolToggle(el, storageKey) {
  if (!el) return;
  el.addEventListener("click", () => {
    const next = !el.classList.contains("active");
    setToggle(el, next);
    chrome.runtime.sendMessage({ type: "FB_POPUP_SET_STORAGE_BOOL", key: storageKey, value: next }, (resp) => {
      const err = chrome.runtime.lastError;
      if (err || !resp || resp.ok !== true) {
        setToggle(el, !next);
        return;
      }
      refresh();
    });
  });
}

function refresh() {
  chrome.runtime.sendMessage({ type: "FB_POPUP_GET_STATE" }, (state) => {
    void chrome.runtime.lastError;
    if (!state) return;

    applyPopupLanguage(state.optionsUiLanguage);

    const masterOn = !!state.extensionGloballyEnabled;
    setToggle($("extensionGloballyEnabled"), masterOn);
    setToggle($("focusBlockingEnabled"), !!state.focusBlockingEnabled);
    setToggle($("securityEnabledPopup"), !!state.securityEnabled);
    setToggle($("networkSecurityEnabledPopup"), !!state.networkSecurityEnabled);

    document.documentElement.classList.toggle("reduce-motion", !!state.optionsReduceAnimations);

    const sections = $("sections");
    if (sections) {
      sections.style.opacity = masterOn ? "1" : "0.45";
      sections.style.pointerEvents = masterOn ? "" : "none";
    }

    const hostEl = $("currentHost");
    if (hostEl) hostEl.textContent = state.hostname || "—";

    const injectable = !!state.injectable;
    const pauseBtn = $("btnPause");
    const addBtn = $("btnAddExclusion");
    const hint = $("statusHint");

    if (pauseBtn) {
      pauseBtn.disabled = !injectable;
      pauseBtn.textContent = state.paused ? i18nT("popup_unpause") : i18nT("popup_pause");
    }
    if (addBtn) {
      addBtn.disabled = !injectable || !!state.alreadyExcluded;
    }

    if (hint) {
      if (!injectable) {
        hint.textContent = i18nT("popup_hint_non_http");
      } else if (state.alreadyExcluded) {
        hint.textContent = i18nT("popup_hint_excluded");
      } else if (state.paused) {
        hint.textContent = i18nT("popup_hint_paused");
      } else {
        hint.textContent = i18nT("popup_hint_ok");
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindBoolToggle($("extensionGloballyEnabled"), "extensionGloballyEnabled");
  bindBoolToggle($("focusBlockingEnabled"), "focusBlockingEnabled");
  bindBoolToggle($("securityEnabledPopup"), "securityEnabled");
  bindBoolToggle($("networkSecurityEnabledPopup"), "networkSecurityEnabled");

  $("btnPause").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "FB_POPUP_GET_STATE" }, (state) => {
      void chrome.runtime.lastError;
      if (!state || !state.injectable) return;
      chrome.runtime.sendMessage({ type: "FB_POPUP_SET_TAB_PAUSE", paused: !state.paused }, () => {
        void chrome.runtime.lastError;
        refresh();
      });
    });
  });

  $("btnAddExclusion").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "FB_POPUP_GET_STATE" }, (state) => {
      void chrome.runtime.lastError;
      if (!state || !state.hostname || !state.injectable) return;
      chrome.runtime.sendMessage({ type: "FB_POPUP_ADD_HOST_EXCLUSION", hostname: state.hostname }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err || !resp || resp.ok !== true) {
          const hint = $("statusHint");
          if (hint) hint.textContent = i18nT("popup_exclude_fail");
          return;
        }
        refresh();
      });
    });
  });

  $("openOptions").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" && area !== "sync") return;
    if (changes && Object.keys(changes).length) refresh();
  });

  try {
    if (chrome.storage.session && chrome.storage.session.onChanged) {
      // StorageArea.onChanged is (changes) only — unlike chrome.storage.onChanged (changes, areaName).
      chrome.storage.session.onChanged.addListener((changes) => {
        if (changes && changes.focusBlockerPausedTabIds) refresh();
      });
    }
  } catch (e) {}

  refresh();
});
