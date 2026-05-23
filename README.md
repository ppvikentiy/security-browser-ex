> 📄 [English version](./README-EN.md)

---

# Browser Security

![Browser Security](./assets/icon.svg)

Расширение для Chromium (Manifest V3): защита от слежки за фокусом и вкладкой, анти‑фингерпринт, сетевые и «устройственные» модули, оповещения о подозрительных страницах, статистика и настройки в одном месте.

**Версия:** см. поле `"version"` в [`manifest.json`](./manifest.json).

Исходный код и обновления: [https://github.com/ppvikentiy/security-browser-ex](https://github.com/ppvikentiy/security-browser-ex)

Лицензия: [MIT](./LICENSE)

## Что умеет расширение

### Базовый модуль (Focus Blocker)

* Блокирует типичные сигналы «ушёл с вкладки / потерял фокус»: `visibilitychange` (включая vendor‑варианты), `blur` / `focus` / `focusin` / `focusout`
* Подменяет чтение `document.hidden`, `visibilityState` и связанных полей так, чтобы страница «видела» вкладку как всегда активную (когда модуль включён)
* Ограничивает `addEventListener` / `removeEventListener` / `dispatchEvent` для перечисленных типов событий и inline‑обработчики `window.onfocus` / `window.onblur` / `document.onvisibilitychange`

### Расширенные возможности

* **Попап и глобальное включение** — один переключатель «всё расширение», отдельно Focus Blocker, анти‑фингерпринт и Network Security; пауза только для текущей вкладки; быстро добавить сайт в исключения
* **Анти‑фингерпринт (Security)** — подмена в JS и через заголовки запросов: экран/окно, батарея, CPU/память, `matchMedia`, WebGL, шум Canvas, часовой пояс, `navigator` / User‑Agent / Client Hints, языки и `Accept-Language`, allowlist шрифтов; режимы отпечатка (per domain / session / random)
* **Network Security** — блокировка запросов из страницы к localhost, частным и link‑local сетям (через Declarative Net Request), опционально жёсткая политика WebRTC против утечки IP (`chrome.privacy.network.webRTCIPHandlingPolicy`)
* **Privacy pack** — отдельный набор DNR‑правил под короткий список трекер‑доменов (узкий или широкий набор типов ресурсов); не смешивается с косметикой DS Block
* **Изоляция (`chrome.privacy`)** — глобально: отключение Referer, hyperlink auditing (`<a ping>`), network prediction/prefetch; см. предупреждения в настройках (SSO, оплаты, CDN)
* **Device Security** — жёсткое ограничение `localStorage` / `sessionStorage`, IndexedDB, Cache API; сокрытие `mediaDevices` и `geolocation`; режим lockdown дескрипторов
* **Threat Shield** — локальное предупреждение поверх страницы (основной фрейм) при срабатывании эвристик: не‑HTTPS для публичных хостов, совпадение с встроенным или пользовательским списком «подозрительных» шаблонов хостов, похожие на фишинг многослойные TLD, опционально «мусорная» форма FQDN, цепочка HTTP‑редиректов до документа; белый список и дополнительные паттерны в настройках; текст баннера задан в [`src/threat-shield.js`](src/threat-shield.js)
* **DS Block** — попапы без пользовательского жеста, косметическое скрытие по CSS (в т.ч. через `chrome.scripting` для строгого CSP), блок телеметрии доменами через DNR; свои списки доменов и селекторов
* **Копирование** — обход частых блокировок копирования; подсветка элемента и горячие клавиши (см. настройки раздела «Копирование»)
* **Исключённые домены** — шаблоны хостов (в т.ч. `*.example.com`); на модули и часть DNR влияет список исключений; глобальные `chrome.privacy` для всего браузера от исключений не откатываются автоматически
* **Статистика** — локальные суммы по домену верхнего окна: фокус, подмены FP, сеть в JS, DNR, устройство, DS; при настроенном `declarativeNetRequestFeedback` — учёт срабатываний правил DNR для бейджа и таблицы

После смены настроек **перезагрузите страницу**, где работают скрипты расширения.

## Установка

1. Скачайте архив репозитория: [https://github.com/ppvikentiy/security-browser-ex](https://github.com/ppvikentiy/security-browser-ex) (Code → Download ZIP), либо клонируйте этот репозиторий
2. Распакуйте папку (если скачивали ZIP)
3. Откройте `chrome://extensions/`, включите «Режим разработчика»
4. «Загрузить распакованное расширение» → выберите корень проекта (папку, где лежит [`manifest.json`](./manifest.json))

## Совместимость

* **Браузеры**: Chromium 111+ (Chrome и совместимые сборки)
* **Manifest**: 3
* **Сайты**: `http` / `https` (и см. `match_about_blank` в манифесте)

---

## Внутренний модуль «API»

Ниже — как расширение взаимодействует с браузером и между своими частями. Это не публичный HTTP API для сторонних серверов; это **внутренний контракт** (Chrome Extension APIs, `chrome.runtime.sendMessage`, `postMessage` между мирами страницы).

### Разрешения в `manifest.json`

| Разрешение | Зачем |
|------------|--------|
| `storage` | Настройки в `chrome.storage.local` / `sync`, сессионные карты в `chrome.storage.session` (пауза вкладки, косметический CSS, счётчики для бейджа) |
| `tabs`, `windows` | Активная вкладка в попапе, бейдж, хост для статистики |
| `scripting` | Вставка/снятие косметического CSS для DS Block (`insertCSS` / `removeCSS`) |
| `declarativeNetRequest`, `declarativeNetRequestFeedback` | Динамические правила блокировки/подмены заголовков; опционально `onRuleMatchedDebug` для статистики DNR |
| `privacy` | WebRTC policy, Referer / ping / network prediction |
| `host_permissions` `*://*/*` | Условия DNR и работа с вкладками на обычных сайтах |

### Service Worker (`src/background.js`)

При `runtime.onInstalled`, `runtime.onStartup` и при изменении релевантных ключей в `storage` вызывается **`reloadFromStorageSnapshot()`**:

1. **Подмена заголовков User-Agent и Client Hints** — правило `modifyHeaders` (id `990001`), если включены расширение, Security и флаг Navigator/UA; при ошибке Chromium применяется стратегия «полный набор → урезанный → только User-Agent»
2. **Accept-Language** — отдельное правило `modifyHeaders` (id `990002`), если включены Security и Languages
3. **Сетевые блокировки** — до 12 правил `block` с `regexFilter` на localhost / RFC1918 / link-local / ULA IPv6 для типов ресурсов без `main_frame`/`sub_frame`, чтобы не ломать прямой заход на LAN‑страницы
4. **DS Block телеметрия** — блок доменами пакетами по 40 доменов на правило, слоты с `990060`
5. **Privacy pack** — аналогично, слоты с `990078`, узкий или широкий набор `resourceTypes`
6. **WebRTC** — `chrome.privacy.network.webRTCIPHandlingPolicy.set` или `clear` в зависимости от Network Security
7. **Изоляция** — `referrersEnabled`, `hyperlinkAuditingEnabled`, `networkPredictionEnabled` через `chrome.privacy`

Дополнительно учитываются ключи Threat Shield для перезагрузки снимка при смене настроек этого модуля.

Дополнительно:

* **Пауза вкладки** — `chrome.storage.session`: ключ `focusBlockerPausedTabIds` (`{ [tabId]: true }`), сброс при смене URL / закрытии вкладки
* **Косметика DS** — хранение CSS по `tabId`, применение через `scripting` API
* **Статистика** — ключ `focusBlockerStatsByHost` в `local`/`sync`; инкремент из контента через сообщения и из `declarativeNetRequest.onRuleMatchedDebug` при доступности
* **Бейдж** — сумма полей счётчика активной вкладки в `focusBlockerTabStat` (session)

### Сообщения `chrome.runtime.sendMessage` → background

Тип в поле `type` тела сообщения:

| Тип | Кто шлёт | Назначение |
|-----|-----------|------------|
| `FB_STATS_REPORT` | `stats-bridge.js` (изолированный мир) | Передача `deltas`, `breakdown`, `topHost` для статистики и бейджа |
| `FB_DS_BLOCK_SET_COSMETIC_CSS` | `settings-bridge.js`, главный фрейм | Включить/выключить инжект CSS скрытия для текущей вкладки |
| `FB_IS_TAB_PAUSED` | `settings-bridge.js` | Узнать, стоит ли пауза на этой вкладке |
| `FB_POPUP_GET_STATE` | `popup.js` | Хост, флаги настроек, исключения, `injectable`, `paused` |
| `FB_POPUP_SET_TAB_PAUSE` | `popup.js` | Поставить/снять паузу для активной вкладки |
| `FB_POPUP_SET_STORAGE_BOOL` | `popup.js` | Запись `extensionGloballyEnabled`, `focusBlockingEnabled`, `securityEnabled`, `networkSecurityEnabled` и др. |
| `FB_POPUP_ADD_HOST_EXCLUSION` | `popup.js` | Добавить текущий хост в `excludedDomains` |

Ответы асинхронные (`return true` в listener где нужен `sendResponse`).

### Мост настроек: изолированный мир → MAIN (`src/settings-bridge.js`)

Читает `chrome.storage`, учитывает исключения домена, глобальное включение, паузу вкладки и рассылает в **основной мир страницы** через `window.postMessage` и дублирующие `CustomEvent`:

| `type` в `postMessage` | Назначение |
|------------------------|------------|
| `FOCUS_BLOCKER_SETTINGS` | Списки событий фокуса и флаг «модуль включён» для `content.js` |
| `FOCUS_BLOCKER_SECURITY_SETTINGS` | Сведения Security + URL worker для тяжёлых патчей |
| `FOCUS_BLOCKER_NETWORK_SETTINGS` | Флаги Network Security для `network-security.js` |
| `FOCUS_BLOCKER_DS_BLOCK_SETTINGS` | DS Block |
| `FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS` | Device Security |
| `FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS` | Threat Shield: объединённые настройки и встроенные списки паттернов / хвостов TLD |

MAIN-скрипт может запросить переотправку: `FOCUS_BLOCKER_REQUEST_SETTINGS` (ответ подтверждается `FOCUS_BLOCKER_SETTINGS_ACK`).

Кэш в `localStorage` (`__focus_blocker_*_cache_v1`) используется как запасной путь до прихода настроек с моста (в том числе `__focus_blocker_threat_shield_cache_v1` для Threat Shield).

### Статистика из MAIN (`src/stats-main.js` → `stats-bridge.js`)

В изолированный мир уходит `postMessage` с типом **`FOCUS_BLOCKER_STATS_DELTA`** (`deltas`, `breakdown`, `topHost`), оттуда — `FB_STATS_REPORT` в service worker.

### Где смотреть реализацию модулей страницы

* `src/content.js` — Focus Blocker в MAIN
* `src/security.js`, `src/security-worker.js` — анти‑фингерпринт
* `src/network-security.js` — перехваты fetch/XHR/WebSocket и др. в рамках настроек
* `src/device-security.js` — API устройства и хранилищ
* `src/ds-block.js` — попапы, телеметрия, косметика (совместно с background)
* `src/copy-helper.js` — копирование
* `src/threat-shield.js` — баннер и эвристики Threat Shield (в манифесте подключён только к главному фрейму страницы, `all_frames: false`)

---

## Лицензия

[MIT](./LICENSE). Подробности — в файле `LICENSE`.
