// Isolated-world bridge: MAIN stats-main.js posts deltas here → background worker.

(function () {
  "use strict";

  const MSG_TYPE = "FOCUS_BLOCKER_STATS_DELTA";

  window.addEventListener(
    "message",
    (event) => {
      if (event.source !== window || !event.data || event.data.type !== MSG_TYPE) return;
      const topHost = typeof event.data.topHost === "string" ? event.data.topHost.trim().toLowerCase() : "";
      const deltas = event.data.deltas && typeof event.data.deltas === "object" ? event.data.deltas : null;
      const breakdown = event.data.breakdown && typeof event.data.breakdown === "object" ? event.data.breakdown : null;
      const hasDeltas = deltas && Object.keys(deltas).length > 0;
      const hasBk = breakdown && Object.keys(breakdown).length > 0;
      if (!hasDeltas && !hasBk) return;
      try {
        if (!chrome.runtime || typeof chrome.runtime.sendMessage !== "function") return;
        chrome.runtime.sendMessage(
          { type: "FB_STATS_REPORT", topHost, deltas: deltas || {}, breakdown: breakdown || {} },
          () => void chrome.runtime.lastError
        );
      } catch (_e) {}
    },
    true
  );
})();
