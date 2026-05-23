(() => {
  "use strict";

  /** @type {const} */
  const MSG_TYPE = "FOCUS_BLOCKER_STATS_DELTA";

  const DEBOUNCE_MS = 400;

  /** @type {Record<string, number>} */
  const pending = {};

  /** @type {Record<string, Record<string, number>>} */
  const pendingBreakdown = {};

  let flushTimer = 0;

  const VALID_KEYS = new Set(["focus", "fpSpoof", "netJs", "device", "ds"]);

  function topHostname() {
    try {
      if (typeof window !== "undefined" && window.top && window.top.location && window.top.location.hostname) {
        return String(window.top.location.hostname).trim().toLowerCase();
      }
    } catch (_e) {}
    try {
      if (typeof location !== "undefined" && location.hostname) return String(location.hostname).trim().toLowerCase();
    } catch (_e2) {}
    return "";
  }

  function flushNow() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = 0;
    }
    const keys = Object.keys(pending);
    const bkCats = Object.keys(pendingBreakdown);
    if (!keys.length && !bkCats.length) return;

    const deltas = {};
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const n = pending[k];
      delete pending[k];
      if (typeof n === "number" && n > 0 && VALID_KEYS.has(k)) deltas[k] = n;
    }

    /** @type {Record<string, Record<string, number>>} */
    const breakdown = {};
    for (let i = 0; i < bkCats.length; i++) {
      const cat = bkCats[i];
      const subs = pendingBreakdown[cat];
      delete pendingBreakdown[cat];
      if (!subs || typeof subs !== "object") continue;
      const inner = {};
      const sks = Object.keys(subs);
      for (let j = 0; j < sks.length; j++) {
        const sk = sks[j];
        const v = subs[sk];
        if (typeof v === "number" && v > 0 && VALID_KEYS.has(cat)) inner[sk] = v;
      }
      if (Object.keys(inner).length) breakdown[cat] = inner;
    }

    if (!Object.keys(deltas).length && !Object.keys(breakdown).length) return;
    const topHost = topHostname();
    try {
      window.postMessage({ type: MSG_TYPE, topHost, deltas, breakdown }, "*");
    } catch (_e) {}
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = 0;
      flushNow();
    }, DEBOUNCE_MS);
  }

  /**
   * @param {string} category
   * @param {number} [delta]
   * @param {string} [subKey] код подфункции для детализации в статистике
   */
  function bump(category, delta, subKey) {
    const key = typeof category === "string" ? category.trim() : "";
    if (!key || !VALID_KEYS.has(key)) return;
    const d = typeof delta === "number" && delta > 0 ? Math.floor(delta) : 1;
    pending[key] = (pending[key] || 0) + d;

    const rawSk = typeof subKey === "string" ? subKey.trim() : "";
    const sk = rawSk ? rawSk.slice(0, 96) : "_other";
    if (!pendingBreakdown[key]) pendingBreakdown[key] = {};
    pendingBreakdown[key][sk] = (pendingBreakdown[key][sk] || 0) + d;

    scheduleFlush();
  }

  try {
    globalThis.__focusBlockerStatsBump = bump;
  } catch (_e) {}

  try {
    window.addEventListener(
      "pagehide",
      () => {
        flushNow();
      },
      true
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        try {
          if (document.visibilityState === "hidden") flushNow();
        } catch (_e) {}
      },
      true
    );
  } catch (_e2) {}
})();
