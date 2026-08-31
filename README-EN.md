![Static Badge](https://img.shields.io/badge/Created_by-Vikentiy_Pachovskiy-brightgreen)  [![Google Chrome](https://img.shields.io/badge/Google%20Chrome-4285F4?logo=GoogleChrome&logoColor=white)](#)  ![Opera](https://img.shields.io/badge/Opera-%23FF1B2D.svg?style=for-the-badge&logo=Opera&logoColor=white) ![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)  

> 📄 [Русская версия](./README.md)

---

# Browser Security

Browser Security is a local shield between you and the page for Chrome, Opera, and other Chromium builds: less tracking, a less unique fingerprint, and a clear warning on a shady address. There is no cloud: tab history stays in the browser, modules toggle independently, a site can be excluded, and the current tab can be paused.

* **Tab and focus** — a page should not reliably know that you switched away or minimized the window.
* **Fingerprint** — screen, Canvas, WebGL, language, and User-Agent look less unique.
* **Network** — requests to localhost and private addresses are blocked; WebRTC can be hardened.
* **Trackers and isolation** — a short tracker-domain pack, plus optional profile-wide Referer / ping / prefetch.
* **Device** — tighter page storage; camera and microphone are hidden, speakers stay listed.
* **Suspicious sites** — a local banner on plain HTTP, a phishing-like host, or a redirect chain.
* **Nuisance** — popups without a gesture, cosmetic junk, telemetry; separately, a copy-unlock helper.
* **Controls** — popup for quick actions, options page for everything else, per-domain stats, UI in ru / en / uk.

Chromium extension (Manifest V3): focus/visibility hardening, anti-fingerprinting, network and device privacy tools, on-page caution banners for heuristic hits, and a full **options page** ([`public/options.html`](./public/options.html); see `options_page` in [`manifest.json`](./manifest.json)): excluded domains, every module, statistics, accessibility. The toolbar popup offers quick toggles and an **«All settings…»** link.

**Version:** **3.0.0** (see also `"version"` in [`manifest.json`](./manifest.json)).

> **What's new in 3.0.0**
>
> * **Settings channel (isolated → MAIN)** — more reliable HMAC delivery: lazy `data-fb-k` capture, key attribute removed after Focus ACK (or a 5s timeout), capture-phase listeners, `postMessage` with target `"*"` (opaque origins no longer silently drop messages), and MAIN acceptance of `workerScriptUrl` without `chrome.runtime`.
> * **Device Security — camera/mic without speakers** — `enumerateDevices` hides only `audioinput` / `videoinput`; speakers (`audiooutput`) stay listed. `getUserMedia` / `getDisplayMedia` and `permissions.query` use native-shaped denials (`NotAllowedError` / `state: "denied"`) instead of branded `SecurityError` noise in site consoles/Sentry.
> * **Page compatibility** — lockdown descriptors use no-op setters (vendor bundles no longer crash on `getUserMedia = …`); geolocation is not replaced with `undefined`; blocked IndexedDB returns an async request error instead of a sync `throw`.
> * **Anti-fingerprint** — screen / navigator / UA-CH lockdown getters also use no-op setters so page assignments in strict mode do not throw `TypeError`.

Source: [https://github.com/ppvikentiy/security-browser-ex](https://github.com/ppvikentiy/security-browser-ex)

License: [MIT](./LICENSE)

## Download

![Opera](https://img.shields.io/badge/Opera-%23FF1B2D.svg?style=for-the-badge&logo=Opera&logoColor=white) [![Download](https://img.shields.io/badge/Download-2ea44f?style=for-the-badge)](https://addons.opera.com/ru/extensions/details/browser-security/)

![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white) [![Download](https://img.shields.io/badge/Download-2ea44f?style=for-the-badge)](https://github.com/ppvikentiy/security-browser-ex)

## Features

### Focus Blocker (core)

* Blocks common “tab blurred / hidden” signals: `visibilitychange` (vendor variants), `blur` / `focus` / `focusin` / `focusout`
* Spoofs `document.hidden`, `visibilityState`, and related fields so the page sees an always-active tab when enabled
* Hooks `addEventListener` / `removeEventListener` / `dispatchEvent` for those types and, for matching event kinds, inline handlers on `window` / `document` (e.g. `onfocus` / `onblur` / `onvisibilitychange` only while that event type remains blocked)
* `addEventListener` / `removeEventListener` interceptors do not forward `unload` / `beforeunload` to native (and swallow `Permissions-Policy` violations) so pages with `unload=()` do not spam the console
* **Strict lifecycle mode** — optional toggle in settings (`focusBlockingStrict`, **off by default**): additionally blocks `freeze`, `resume`, `pagehide`, `pageshow`, including related inline properties (`window.onpageshow`, `window.onpagehide`, `document.onfreeze` / `document.onresume` where supported). May break some SPA flows and bfcache restore behavior

### Extended capabilities

* **Popup** — master switch plus three modules: Focus Blocker, anti-fingerprint (`securityEnabled`), Network Security. Per-tab pause; quick-add the current host to exclusions. ADS Block, Device Security, Threat Shield, Privacy pack, and isolation are configured **only** on the options page
* **Anti-fingerprint (Security)** — JS spoofing plus request headers: screen/window, battery, CPU/memory, `matchMedia`, WebGL, canvas noise, timezone, navigator + UA + Client Hints, languages/`Accept-Language`, font allowlist; fingerprint modes (per domain / session / random)
* **Network Security** — DNR blocks page-initiated requests to localhost/private/link-local targets; optional WebRTC IP-hardening via `chrome.privacy.network.webRTCIPHandlingPolicy`
* **Privacy pack** — separate DNR tracker list (narrow vs wide resource types); independent of ADS Block cosmetics/popups
* **Isolation (`chrome.privacy`)** — optional profile-wide Referer off, hyperlink auditing off, network prediction off (see payment/SSO caveats in the UI)
* **Device Security** — strict limits on `localStorage` / `sessionStorage`, IndexedDB, Cache API; hide camera/microphone (speakers `audiooutput` kept) and block geolocation; lockdown descriptors that do not TypeError on page assignment
* **Threat Shield** (labeled **«Активная интернет защита»** in the Russian options UI) — top-frame overlay banner when heuristics match: plain HTTP on public hosts, builtin + custom suspicious host patterns, “stacked TLD” look-alikes, optional long/garbage-looking FQDN heuristic, chains of HTTP redirects before the document loads; whitelist and extra patterns in settings. Banner copy is localized (ru / en / uk) in [`src/threat-shield.js`](src/threat-shield.js) from the UI language
* **ADS Block** (formerly DS Block; code — [`src/ds-block.js`](src/ds-block.js); internal message keys still use the `DS_BLOCK` prefix) — popups without a user gesture, cosmetic CSS (via `chrome.scripting` for strict CSP), telemetry domain blocking via DNR; custom domain/selector lists
* **Copy helper** — unlock common copy blocks; highlight + shortcuts (see the **«Copy assistant» / «Помощник при копировании»** section — wording follows UI locale). Script runs in the **isolated** world at `document_idle` (separate `content_scripts` entry, not MAIN)
* **Accessibility** — UI language (ru / en / uk) for the options page, popup, and Threat Shield banner; reduced motion and calmer UI (Accessibility section). String catalogs live in [`src/i18n.js`](src/i18n.js)
* **Excluded domains** — host patterns (`*.example.com` style); affects modules and some DNR rules; profile-wide `chrome.privacy` toggles do not automatically follow per-site exclusions
* **Statistics** — per top-level host counters: focus, FP spoofs, JS network, DNR, device, ADS Block; with `declarativeNetRequestFeedback`, DNR matches feed the badge/table

**Reload** pages after changing settings.

## Installation

1. Download ZIP from [https://github.com/ppvikentiy/security-browser-ex](https://github.com/ppvikentiy/security-browser-ex) (**Code → Download ZIP**), or clone this repository
2. Unzip if you used ZIP
3. Open the extensions page: Chrome — `chrome://extensions/`, Opera — `opera://extensions/`; enable Developer mode
4. **Load unpacked** → select the folder that contains [`manifest.json`](./manifest.json)
5. Options: click **«All settings…»** in the popup, or open the extension’s details page from the extensions list and launch Extension options (wording differs slightly by Chromium build)

## Compatibility

* **Browsers**: Chromium 111+ — Google Chrome and compatible builds, including Opera
* **Manifest**: 3
* **Sites**: `http` / `https` (manifest: `match_about_blank`, `match_origin_as_fallback`, `all_frames`)

## Developer tools

* `node tools/check-world-copies.mjs` — verify that `fb-channel.js` / `fb-channel-main.js` and `security-defaults.js` / `security-defaults-main.js` are byte-identical
* `node tools/check-world-copies.mjs --fix` — copy the primary files over the MAIN copies
* `node tools/gen-i18n.mjs` — rebuild [`src/i18n.js`](src/i18n.js) from the catalogs inside the generator (after UI string changes)

---

## Internal “API” module

How the extension talks to the browser and to itself—not a public HTTP API. This is an **internal contract** (Chrome Extension APIs, `chrome.runtime.sendMessage`, `postMessage` between page worlds).

### `manifest` permissions

| Permission | Role |
|------------|------|
| `storage` | Options: **`chrome.storage.local` is canonical** (with a best-effort one-time migrate from `sync` when local is empty); session maps in `chrome.storage.session` (paused tabs, cosmetic CSS text, per-tab stat bucket) |
| `tabs`, `windows` | Popup state, badge, hostname for stats |
| `scripting` | Insert/remove ADS Block cosmetic CSS (`insertCSS` / `removeCSS`) |
| `declarativeNetRequest`, `declarativeNetRequestFeedback` | Dynamic block/modify-headers rules; optional `onRuleMatchedDebug` for DNR stats |
| `privacy` | WebRTC policy, Referer / ping / network prediction |
| `host_permissions` `*://*/*` | DNR conditions and normal pages |

### `content_scripts` entries in the manifest

1. **Isolated world, `document_start`** — `fb-channel.js`, `security-defaults.js`, `settings-bridge.js`, `stats-bridge.js`
2. **MAIN, `document_start`** — `fb-channel-main.js`, `security-defaults-main.js`, `stats-main.js`, `device-security.js`, `content.js`, `security.js`, `network-security.js`, `ds-block.js`, `threat-shield.js` (single entry: the same path cannot be injected twice)
3. **Isolated world, `document_idle`** — `copy-helper.js`

`web_accessible_resources`: [`src/security-worker.js`](src/security-worker.js) for heavy anti-fingerprint patches.

### Service worker (`src/background.js`)

On `runtime.onInstalled`, `runtime.onStartup`, and relevant `storage` changes, **`reloadFromStorageSnapshot()`** refreshes:

1. **UA + Client Hints headers** — `modifyHeaders` rule id `990001` when the extension, Security, and Navigator/UA flag are on; if Chromium rejects the full set, fallback is “full set → trimmed → User-Agent only”
2. **Accept-Language** — separate `modifyHeaders` rule id `990002` when Security and Languages are on
3. **LAN/loopback blocks** — up to 12 `block` rules with `regexFilter` for localhost / RFC1918 / link-local / ULA IPv6; resource types omit `main_frame`/`sub_frame` so top-level LAN pages still load (slots from `990020`)
4. **ADS Block telemetry** — chunked `requestDomains` rules, 40 domains per rule, slots from `990060` (18 slots)
5. **Privacy pack** — same pattern, slots from `990078` (20 slots), narrow or wide `resourceTypes`
6. **WebRTC** — `chrome.privacy.network.webRTCIPHandlingPolicy.set` or `clear` depending on Network Security
7. **Isolation** — `referrersEnabled`, `hyperlinkAuditingEnabled`, `networkPredictionEnabled` via `chrome.privacy`

Threat Shield storage keys participate in the same reload path when those options change.

Also:

* **Tab pause** — `chrome.storage.session` key `focusBlockerPausedTabIds` (`{ [tabId]: true }`), cleared on URL change / tab close
* **ADS Block cosmetics** — CSS per `tabId` (`focusBlockerDsCosmeticCssByTabId`) applied via the `scripting` API
* **Statistics** — key `focusBlockerStatsByHost` in `chrome.storage.local` (see sync migrate above); increments from content messages and from `declarativeNetRequest.onRuleMatchedDebug` when available; counter fields: `focus`, `fpSpoof`, `netJs`, `device`, `ds`, `dnrBlock`, `dnrModify`
* **Badge** — sum of the active tab’s bucket in `focusBlockerTabStat` (session)

### `chrome.runtime.sendMessage` → background

`type` field on the message body:

| `type` | From | Purpose |
|--------|------|---------|
| `FB_STATS_REPORT` | `stats-bridge.js` (isolated world) | `deltas`, `breakdown`, `topHost` for stats and badge |
| `FB_DS_BLOCK_SET_COSMETIC_CSS` | `settings-bridge.js`, top frame | Enable/disable injected hide CSS for the tab |
| `FB_IS_TAB_PAUSED` | `settings-bridge.js`, `copy-helper.js` | Pause flag for current tab |
| `FB_REFRESH_SETTINGS` | `background.js` → tab | Re-read storage/pause and rebroadcast settings to MAIN (`settings-bridge.js`, `copy-helper.js`) |
| `FB_POPUP_GET_STATE` | `popup.js` | Host, flags, exclusions, `injectable`, `paused` |
| `FB_POPUP_SET_TAB_PAUSE` | `popup.js` | Toggle pause for the active tab |
| `FB_POPUP_SET_STORAGE_BOOL` | `popup.js` | Only keys `extensionGloballyEnabled`, `focusBlockingEnabled`, `securityEnabled`, `networkSecurityEnabled` |
| `FB_POPUP_ADD_HOST_EXCLUSION` | `popup.js` | Append the current host to `excludedDomains` |

Responses are async (`return true` in the listener when `sendResponse` is used).

### Settings bridge → MAIN world (`src/settings-bridge.js`)

Isolated world reads `chrome.storage`, applies domain exclusions, the global master switch, and tab pause, then posts to the **MAIN world** via `window.postMessage` plus duplicate `CustomEvent`s. Every message is **HMAC-SHA256 signed** (`seq` + `sig` fields, see [Internal channel security](#internal-channel-security-hmac)); MAIN modules ignore unsigned or replayed messages:

| `type` in `postMessage` | Purpose |
|-------------------------|---------|
| `FOCUS_BLOCKER_SETTINGS` | Focus module on/off + blocked event list for `content.js` |
| `FOCUS_BLOCKER_SECURITY_SETTINGS` | Security payload + worker URL for heavy patches |
| `FOCUS_BLOCKER_NETWORK_SETTINGS` | Network Security flags for `network-security.js` |
| `FOCUS_BLOCKER_DS_BLOCK_SETTINGS` | ADS Block payload (historic `DS_BLOCK` naming) |
| `FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS` | Device Security |
| `FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS` | Threat Shield merged prefs + builtin host patterns and stacked-TLD tail list |

Resend request: `FOCUS_BLOCKER_REQUEST_SETTINGS`; ack: `FOCUS_BLOCKER_SETTINGS_ACK`.

The `__focus_blocker_*_cache_v1` entries live in the **page's own** `localStorage` and are always treated as untrusted: they cannot be signed (the HMAC key is minted per page load) and a page can delete them regardless. Hence the rule — a cache may only ever **raise** protection above the fail-safe default, never relax it.

- **Focus Blocker** reads the `__focus_blocker_focus_cache_v1` boot hint at `document_start` so focus/visibility events are already blocked before page scripts run. Only `isEnabled: true` is consumed; the event list is always the module’s own `DEFAULT_BLOCKED_EVENTS`. Cached `false` and a cached event list are ignored. The bridge writes only the on/off flag, not the event list.
- **ADS Block** reads `__focus_blocker_ds_block_cache_v1` at `document_start` so the `window.open` / `sendBeacon` / telemetry hooks are armed before page scripts run. Only boolean flags are consumed, and only when `true`; cached `false` values, domain/selector lists and `pageAllowed` are ignored, and user lists are never written to the cache.
- **Threat Shield**, **Network Security** and **Device Security** never read or write a cache: `isActive` is set only by a signed bridge message. Stale entries for those modules are deleted on the first settings broadcast.
- The full anti-fingerprint config is never persisted to page `localStorage`.

### Internal channel security (HMAC)

The isolated → MAIN channel is authenticated so a malicious page cannot disable modules or alter config with forged `postMessage` / `CustomEvent` traffic:

* **`src/fb-channel.js`** (isolated world) and **`src/fb-channel-main.js`** (MAIN) — shared library, loaded first in its `content_scripts` entry: pure-JS SHA-256 / HMAC-SHA256 (synchronous, works on `http://` pages where `crypto.subtle` is unavailable) plus a deterministic `stableStringify` with sorted keys. All natives it relies on (`TextEncoder`, `JSON.stringify`, `Object.keys`, `Array.prototype.sort`, `Uint8Array`, …) are captured at `document_start` before any page script runs, and the exported API is frozen so the page cannot swap methods to steal the key. It is published in three places — `globalThis.__fbChannel`, `document.documentElement.__fbChannelApi`, and `Document.prototype.__fbChannelGet` (all non-writable)
* **The byte-identical per-world copies are deliberate.** A script path listed in several `content_scripts` entries can be injected into a document only once, so the isolated entry consumed the single injection and MAIN modules were left with no channel at all, rejecting every signed settings message (Threat Shield silent, Device Security stuck fail-closed with IndexedDB blocked). The defaults file is duplicated for the same reason — `src/security-defaults.js` (isolated world, options page, service worker) and `src/security-defaults-main.js` (MAIN) — otherwise MAIN modules silently fell back to trimmed inline defaults and ADS Block lost its builtin domain/selector lists. When you change one file, copy it over the other; verify or repair both pairs with `node tools/check-world-copies.mjs [--fix]`
* **Key** — 32 random bytes per page load; the bridge hands it to MAIN modules via a short-lived `<html data-fb-k="...">` attribute. MAIN modules re-read the key on verify if needed; the attribute is removed after Focus ACK or a ~5s timeout, not immediately after the first async broadcast. The key is **never placed inside messages**
* **Signature** — each message carries a monotonic `seq` counter and `sig = HMAC(key, stableStringify(payload without sig))`; MAIN modules verify the signature and require a strictly increasing `seq` (anti-replay)
* **Fail-closed** — Network Security and Device Security start enabled and can only be turned off by a signed message; the anti-fingerprint `workerScriptUrl` is accepted from the HMAC payload as a `chrome-extension://…/src/security-worker.js` URL (MAIN has no `chrome.runtime`); critical API hooks are pinned with `configurable: false` plus a no-op setter so page assignment does not crash
* The cosmetic-CSS handler in `background.js` additionally checks `sender.id` and caps CSS size

Residual risk: the key attribute exists from `document_start` until ACK/timeout (usually milliseconds to a few seconds) — an inline script at the top of `<head>` could theoretically read it. The attack bar is raised from "passively listen to `postMessage`" to "actively read a DOM attribute within the load window".

### Stats path (`src/stats-main.js` → `stats-bridge.js`)

MAIN posts `FOCUS_BLOCKER_STATS_DELTA` (`deltas`, `breakdown`, `topHost`) → isolated `stats-bridge.js` → `FB_STATS_REPORT` to the service worker.

### Where to look

* `src/fb-channel.js`, `src/fb-channel-main.js` — settings-channel crypto primitives (HMAC-SHA256, canonical serialization); identical copies for the isolated and MAIN worlds
* `src/security-defaults.js`, `src/security-defaults-main.js` — defaults, presets and settings-merge helpers; the same pair of copies
* `src/settings-bridge.js`, `src/stats-bridge.js` — isolated world: storage → MAIN, stats → background
* `src/content.js` — Focus Blocker in MAIN
* `src/security.js`, `src/security-worker.js` — anti-fingerprint
* `src/network-security.js` — fetch/XHR/WebSocket hooks (per settings)
* `src/device-security.js` — device APIs / storage caps
* `src/ds-block.js` — ADS Block (popups, telemetry, cosmetics with background)
* `src/copy-helper.js` — copy UX (isolated, `document_idle`)
* `src/threat-shield.js` — Threat Shield banner/heuristics (banner in the top frame only; strings follow UI language)
* `src/i18n.js` — ru / en / uk catalogs for popup, options page, and banner (built by `tools/gen-i18n.mjs`)
* `src/options.js`, `public/options.html` — options page
* `src/popup.js`, `public/popup.html` — popup
* `src/background.js` — service worker

---

## License

[MIT](./LICENSE). Details are in the `LICENSE` file.
