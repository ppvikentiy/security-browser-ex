![Static Badge](https://img.shields.io/badge/Created_by-Vikentiy_Pachovskiy-brightgreen) [![Google Chrome](https://img.shields.io/badge/Google%20Chrome-4285F4?logo=GoogleChrome&logoColor=white)](#)

> 📄 [Русская версия](./README.md)

---

# Browser Security



Chromium extension (Manifest V3): focus/visibility hardening, anti-fingerprinting, optional network and device privacy tools, **on-page caution banners** when heuristic checks trigger, statistics, accessibility toggles, and a dedicated **extension options page** ([`public/options.html`](./public/options.html); see `options_page` in [`manifest.json`](./manifest.json)). The toolbar popup offers quick toggles and an **«All settings…»** link.

**Version:** see `"version"` in [`manifest.json`](./manifest.json).

Source: [https://github.com/ppvikentiy/security-browser-ex](https://github.com/ppvikentiy/security-browser-ex)

License: [MIT](./LICENSE)

## Features

### Focus Blocker (core)

* Blocks common “tab blurred / hidden” signals: `visibilitychange` (vendor variants), `blur` / `focus` / `focusin` / `focusout`
* Spoofs `document.hidden`, `visibilityState`, and related fields so the page sees an always-active tab when enabled
* Hooks `addEventListener` / `removeEventListener` / `dispatchEvent` for those types and, for matching event kinds, inline handlers on `window` / `document` (e.g. `onfocus` / `onblur` / `onvisibilitychange` only while that event type remains blocked)
* **Strict lifecycle mode** — optional toggle in settings (`focusBlockingStrict`, **off by default**): additionally blocks `freeze`, `resume`, `pagehide`, `pageshow`, including related inline properties (`window.onpageshow`, `window.onpagehide`, `document.onfreeze` / `document.onresume` where supported). May break some SPA flows and bfcache restore behavior

### Extended capabilities

* **Popup & global master switch** — enable/disable everything; separate toggles for Focus Blocker, anti-fingerprint, Network Security, and related modules; per-tab pause; quick add to exclusions
* **Anti-fingerprint (Security)** — JS spoofing plus request headers: screen/window, battery, CPU/memory, `matchMedia`, WebGL, canvas noise, timezone, navigator + UA + Client Hints, languages/`Accept-Language`, font allowlist; fingerprint modes (per domain / session / random)
* **Network Security** — DNR blocks page-initiated requests to localhost/private/link-local targets; optional WebRTC IP-hardening via `chrome.privacy.network.webRTCIPHandlingPolicy`
* **Privacy pack** — separate DNR tracker list (narrow vs wide resource types); independent of ADS Block cosmetics/popups
* **Isolation (`chrome.privacy`)** — optional profile-wide Referer off, hyperlink auditing off, network prediction off (see payment/SSO caveats in the UI)
* **Device Security** — strict limits on storage/IndexedDB/cache; hide `mediaDevices` / `geolocation`; lockdown option
* **Threat Shield** — top-frame overlay banner when heuristics match: plain HTTP on public hosts (excluding local/private detection), builtin + custom suspicious host patterns, “stacked TLD” look-alikes using configurable suffix tails, optional long/garbage-looking FQDN heuristic, chains of HTTP redirects before the document loads; whitelist and extra patterns in settings. In the RU options UI this panel is labeled **«Активная интернет защита»**. Banner copy lives in [`src/threat-shield.js`](src/threat-shield.js) (upstream strings are largely Russian).
* **ADS Block** — popups/adjacent nuisance blocking without user gesture, cosmetic CSS (via `chrome.scripting` for strict CSP), telemetry domain blocking via DNR; custom lists. Implemented in [`src/ds-block.js`](src/ds-block.js); internal message keys still use the `DS_BLOCK` prefix.
* **Copy helper** — unlock common copy blocks; highlight + shortcuts (see the **«Copy assistant» / «Помощник при копировании»** section—wording follows UI locale).
* **Accessibility** — reduced motion / calmer UI controls on the options page
* **Excluded domains** — host patterns (`*.example.com` style); affects modules and some DNR rules; profile-wide `chrome.privacy` toggles do not automatically follow per-site exclusions
* **Statistics** — per top-level host counters including an **ADS** bucket (telemetry/cosmetics module); with `declarativeNetRequestFeedback`, DNR matches feed the badge/table

**Reload** pages after changing settings.

## Installation

1. Download ZIP from [https://github.com/ppvikentiy/security-browser-ex](https://github.com/ppvikentiy/security-browser-ex) (**Code → Download ZIP**), or clone this repository
2. Unzip if you used ZIP
3. Open `chrome://extensions/` → Developer mode → **Load unpacked** → select the folder that contains [`manifest.json`](./manifest.json)
4. Options: click **«All settings…»** in the popup, or open the extension’s details page from `chrome://extensions/` and launch the Extension options entry (wording differs slightly by Chromium build).

## Compatibility

* **Browsers**: Chromium 111+
* **Manifest**: 3
* **Sites**: `http` / `https` (see manifest `match_about_blank`)

---

## Internal “API” module

How the extension talks to the browser and to itself—not a public HTTP API.

### `manifest` permissions

| Permission | Role |
|------------|------|
| `storage` | Options: **`chrome.storage.local` is canonical** (with a best-effort one-time migrate from `sync` when local is empty); session maps (`paused` tabs, cosmetic CSS text, per-tab stat bucket) |
| `tabs`, `windows` | Popup state, badge, hostname for stats |
| `scripting` | Insert/remove ADS Block cosmetic CSS |
| `declarativeNetRequest`, `declarativeNetRequestFeedback` | Dynamic rules; optional `onRuleMatchedDebug` |
| `privacy` | WebRTC policy, Referer/ping/prediction |
| `host_permissions` `*://*/*` | DNR + normal pages |

### Service worker (`src/background.js`)

On install/startup/storage changes, **`reloadFromStorageSnapshot()`** refreshes:

1. **UA + CH headers** — `modifyHeaders` rule id `990001` (with fallback if the browser rejects the full header set)
2. **Accept-Language** — rule id `990002` when Languages spoofing is on
3. **LAN/loopback blocks** — up to 12 `block` rules with `regexFilter` (resource types exclude top-level navigations)
4. **ADS Block telemetry** — chunked `requestDomains` rules from slot `990060`
5. **Privacy pack** — from slot `990078`, narrow or wide resource types
6. **WebRTC** — `webRTCIPHandlingPolicy` or clear/default
7. **Isolation** — `chrome.privacy` toggles as configured

Threat Shield storage keys participate in the same reload path when those options change.

Also: tab pause map `focusBlockerPausedTabIds`, ADS cosmetic CSS per tab, stats key `focusBlockerStatsByHost`, badge from `focusBlockerTabStat` (session).

### `chrome.runtime.sendMessage` → background

| `type` | From | Purpose |
|--------|------|---------|
| `FB_STATS_REPORT` | `stats-bridge.js` | `deltas`, `breakdown`, `topHost` |
| `FB_DS_BLOCK_SET_COSMETIC_CSS` | `settings-bridge.js` | Enable/disable injected hide CSS for the tab |
| `FB_IS_TAB_PAUSED` | `settings-bridge.js` | Pause flag for current tab |
| `FB_POPUP_GET_STATE` | `popup.js` | Host, flags, exclusions, injectable, paused |
| `FB_POPUP_SET_TAB_PAUSE` | `popup.js` | Toggle pause |
| `FB_POPUP_SET_STORAGE_BOOL` | `popup.js` | Master switch and feature toggles (`extensionGloballyEnabled`, focus/security/network, etc.) |
| `FB_POPUP_ADD_HOST_EXCLUSION` | `popup.js` | Append `excludedDomains` |

### Settings bridge → MAIN world (`src/settings-bridge.js`)

Isolated world reads `chrome.storage` and posts to MAIN via `postMessage` + `CustomEvent`:

| `type` | Purpose |
|--------|---------|
| `FOCUS_BLOCKER_SETTINGS` | Focus module on/off + blocked event list |
| `FOCUS_BLOCKER_SECURITY_SETTINGS` | Security payload + worker URL |
| `FOCUS_BLOCKER_NETWORK_SETTINGS` | Network Security flags |
| `FOCUS_BLOCKER_DS_BLOCK_SETTINGS` | ADS Block payload (historic `DS_BLOCK` naming) |
| `FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS` | Device Security |
| `FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS` | Threat Shield merged prefs + builtin host patterns and stacked-TLD tail list |

Resend request: `FOCUS_BLOCKER_REQUEST_SETTINGS`; ack: `FOCUS_BLOCKER_SETTINGS_ACK`. Optional `localStorage` caches `__focus_blocker_*_cache_v1` (Threat Shield uses `__focus_blocker_threat_shield_cache_v1`).

### Stats path

MAIN posts `FOCUS_BLOCKER_STATS_DELTA` → isolated `stats-bridge.js` → `FB_STATS_REPORT` to the service worker.

### Page scripts (MAIN and related)

* `src/content.js` — focus
* `src/security.js`, `src/security-worker.js` — anti-fingerprint
* `src/network-security.js` — fetch/XHR/WebSocket hooks (per settings)
* `src/device-security.js` — device APIs / storage caps
* `src/ds-block.js` — ADS Block (popups, telemetry/cosmetics DNR coordination)
* `src/copy-helper.js` — copy UX
* `src/threat-shield.js` — Threat Shield banner/heuristics (manifest: **top frame only**, `all_frames: false`)

---

## License

[MIT](./LICENSE)
