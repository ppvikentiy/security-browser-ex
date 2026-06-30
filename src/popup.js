"use strict";

function $(id) {
  return document.getElementById(id);
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
      pauseBtn.textContent = state.paused ? "Снять паузу на этой вкладке" : "Временно отключить на этой вкладке";
    }
    if (addBtn) {
      addBtn.disabled = !injectable || !!state.alreadyExcluded;
    }

    if (hint) {
      if (!injectable) {
        hint.textContent = "Откройте вкладку с адресом http или https.";
      } else if (state.alreadyExcluded) {
        hint.textContent = "Сайт уже в списке исключений (настройки → исключённые домены).";
      } else if (state.paused) {
        hint.textContent =
          "На этой вкладке всё отключено до перехода по другому URL или закрытия вкладки.";
      } else {
        hint.textContent =
          "Пауза только для этой вкладки; после смены страницы действие расширения снова как в настройках.";
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
          if (hint) hint.textContent = "Не удалось добавить в исключения. Попробуйте ещё раз.";
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
      chrome.storage.session.onChanged.addListener((changes, area) => {
        if (area === "session" && changes && changes.focusBlockerPausedTabIds) refresh();
      });
    }
  } catch (e) {}

  refresh();
});
