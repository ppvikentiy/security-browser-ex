![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)  ![Static Badge](https://img.shields.io/badge/Created_by-Vikentiy_Pachovskiy-brightgreen)  [![Google Chrome](https://img.shields.io/badge/Google%20Chrome-4285F4?logo=GoogleChrome&logoColor=white)](#)  ![Opera](https://img.shields.io/badge/Opera-%23FF1B2D.svg?style=for-the-badge&logo=Opera&logoColor=white)

> 📄 [English version](./README-EN.md)

---

# Browser Security

Browser Security — локальный щит между вами и страницей для Chrome, Opera и других Chromium-сборок: меньше слежки, меньше отпечатка, явное предупреждение на сомнительном адресе. Облака нет: история вкладок никуда не уходит, модули включаются по отдельности, сайт можно исключить, вкладку — поставить на паузу.

* **Вкладка и фокус** — страница не должна уверенно знать, что вы переключились или свернули окно.
* **Отпечаток** — экран, Canvas, WebGL, язык и User-Agent выглядят менее уникальными.
* **Сеть** — запросы к localhost и частным адресам режутся; по желанию ужесточается WebRTC.
* **Трекеры и изоляция** — короткий блок трекер-доменов, опционально Referer / ping / prefetch на весь профиль.
* **Устройство** — жёстче хранилища страницы; камера и микрофон скрыты, динамики остаются.
* **Подозрительные сайты** — локальный баннер при HTTP, фишинг-похожем хосте или цепочке редиректов.
* **Помехи** — попапы без жеста, косметический мусор, телеметрия; отдельно — обход запрета копирования.
* **Управление** — попап для быстрых действий, страница параметров для всего остального, статистика по доменам, UI на ru / en / uk.

Расширение для Chromium (Manifest V3): защита от слежки за фокусом и вкладкой, анти‑фингерпринт, сетевые и «устройственные» модули, оповещения о подозрительных страницах и полноценная **страница параметров** ([`public/options.html`](./public/options.html), в манифесте — [`options_page`](./manifest.json)): исключённые домены, все модули, статистика, доступность. Во всплывающем окне действий — быстрые переключатели и ссылка «Все настройки…».

**Версия:** **3.0.0** (см. также `"version"` в [`manifest.json`](./manifest.json)).

> **Что нового в 3.0.0**
>
> * **Канал настроек (isolated → MAIN)** — надёжная доставка HMAC‑подписанных настроек: ленивый захват ключа `data-fb-k`, снятие атрибута после ACK Focus (или таймаута 5 с), слушатели в фазе capture, `postMessage` с target `"*"` (opaque‑origin больше не молча дропает сообщения), принятие `workerScriptUrl` в MAIN без `chrome.runtime`.
> * **Device Security — камера/микрофон без динамиков** — `enumerateDevices` скрывает только `audioinput` / `videoinput`; динамики (`audiooutput`) остаются в списке. Отказ `getUserMedia` / `getDisplayMedia` и `permissions.query` оформлены как нативные (`NotAllowedError` / `state: "denied"`), без брендированных `SecurityError` в консоли сайтов.
> * **Совместимость со страницами** — lockdown‑дескрипторы с no‑op setter (vendor‑бандлы больше не падают на `getUserMedia = …`); geolocation не подменяется на `undefined`; IndexedDB при блоке отдаёт async‑ошибку request вместо sync `throw`.
> * **Анти‑фингерпринт** — lockdown‑геттеры screen / navigator / UA‑CH также с no‑op setter, чтобы присвоения страницы в strict mode не давали `TypeError`.

Исходный код и обновления: [https://github.com/ppvikentiy/security-browser-ex](https://github.com/ppvikentiy/security-browser-ex)

Лицензия: [MIT](./LICENSE)

## Download

![Opera](https://img.shields.io/badge/Opera-%23FF1B2D.svg?style=for-the-badge&logo=Opera&logoColor=white) [![Скачать](https://img.shields.io/badge/Скачать-2ea44f?style=for-the-badge)](https://addons.opera.com/ru/extensions/details/browser-security/)

![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white) [![Скачать](https://img.shields.io/badge/Скачать-2ea44f?style=for-the-badge)](https://github.com/ppvikentiy/security-browser-ex)

## Что умеет расширение

### Базовый модуль (Focus Blocker)

* Блокирует типичные сигналы «ушёл с вкладки / потерял фокус»: `visibilitychange` (включая vendor‑варианты), `blur` / `focus` / `focusin` / `focusout`
* Подменяет чтение `document.hidden`, `visibilityState` и связанных полей так, чтобы страница «видела» вкладку как всегда активную (когда модуль включён)
* Ограничивает `addEventListener` / `removeEventListener` / `dispatchEvent` для перечисленных типов событий и inline‑обработчики `window.onfocus` / `window.onblur` / `document.onvisibilitychange` — только пока соответствующий тип события включён в списке блокировки
* Перехватчики `addEventListener` / `removeEventListener` не проксируют натив для `unload` / `beforeunload` (и глушат `Permissions-Policy` violation), чтобы страницы с политикой `unload=()` не сыпали ошибками в консоль
* **Жёсткая подмена (lifecycle)** — отдельный переключатель в настройках (`focusBlockingStrict`, **по умолчанию выключен**): к вашему списку событий добавляются `freeze`, `resume`, `pagehide`, `pageshow`, с подавлением связанных inline‑свойств (`window.onpageshow`, `window.onpagehide`, `document.onfreeze`, `document.onresume` при поддержке в браузере). Может мешать SPA и восстановлению страницы из bfcache

### Расширенные возможности

* **Попап** — мастер‑переключатель «всё расширение» и три модуля: Focus Blocker, анти‑фингерпринт (`securityEnabled`), Network Security. Пауза только для текущей вкладки; быстро добавить текущий хост в исключения. ADS Block, Device Security, Threat Shield, Privacy pack и изоляция настраиваются **только** на странице параметров
* **Анти‑фингерпринт (Security)** — подмена в JS и через заголовки запросов: экран/окно, батарея, CPU/память, `matchMedia`, WebGL, шум Canvas, часовой пояс, `navigator` / User‑Agent / Client Hints, языки и `Accept-Language`, allowlist шрифтов; режимы отпечатка (per domain / session / random)
* **Network Security** — блокировка запросов из страницы к localhost, частным и link‑local сетям (через Declarative Net Request), опционально жёсткая политика WebRTC против утечки IP (`chrome.privacy.network.webRTCIPHandlingPolicy`)
* **Privacy pack** — отдельный набор DNR‑правил под короткий список трекер‑доменов (узкий или широкий набор типов ресурсов); не смешивается с косметикой ADS Block
* **Изоляция (`chrome.privacy`)** — глобально: отключение Referer, hyperlink auditing (`<a ping>`), network prediction/prefetch; см. предупреждения в настройках (SSO, оплаты, CDN)
* **Device Security** — жёсткое ограничение `localStorage` / `sessionStorage`, IndexedDB, Cache API; скрытие камеры/микрофона (динамики `audiooutput` сохраняются) и блокировка geolocation; режим lockdown дескрипторов без TypeError при присвоениях страницы
* **Threat Shield** («Активная интернет защита» в настройках) — локальное предупреждение поверх страницы (основной фрейм) при срабатывании эвристик: не‑HTTPS для публичных хостов, совпадение с встроенным или пользовательским списком «подозрительных» шаблонов хостов, похожие на фишинг многослойные TLD, опционально «мусорная» форма FQDN, цепочка HTTP‑редиректов до документа; белый список и дополнительные паттерны в настройках. Текст баннера локализован (ru / en / uk) в [`src/threat-shield.js`](src/threat-shield.js) по языку интерфейса
* **ADS Block** (ранее модуль DS Block; код — [`src/ds-block.js`](src/ds-block.js); внутренние ключи сообщений по‑прежнему с префиксом `DS_BLOCK`) — попапы без пользовательского жеста, косметическое скрытие по CSS (в т.ч. через `chrome.scripting` для строгого CSP), блок телеметрии доменами через DNR; свои списки доменов и селекторов
* **Копирование** — обход частых блокировок копирования; подсветка элемента и горячие клавиши (см. настройки раздела «Помощник при копировании»). Скрипт живёт в **изолированном** мире, `run_at: document_idle` (отдельная запись `content_scripts`, не MAIN)
* **Доступность** — язык интерфейса (ru / en / uk) для страницы параметров, попапа и баннера Threat Shield; уменьшение анимаций и более спокойный вид (секция «Доступность»). Каталоги строк — [`src/i18n.js`](src/i18n.js)
* **Исключённые домены** — шаблоны хостов (в т.ч. `*.example.com`); на модули и часть DNR влияет список исключений; глобальные `chrome.privacy` для всего браузера от исключений не откатываются автоматически
* **Статистика** — локальные суммы по домену верхнего окна: фокус, подмены FP, сеть в JS, DNR, устройство, ADS Block; при настроенном `declarativeNetRequestFeedback` — учёт срабатываний правил DNR для бейджа и таблицы

После смены настроек **перезагрузите страницу**, где работают скрипты расширения.

## Установка

1. Скачайте архив репозитория: [https://github.com/ppvikentiy/security-browser-ex](https://github.com/ppvikentiy/security-browser-ex) (Code → Download ZIP), либо клонируйте этот репозиторий
2. Распакуйте папку (если скачивали ZIP)
3. Откройте страницу расширений: в Chrome — `chrome://extensions/`, в Opera — `opera://extensions/`; включите «Режим разработчика»
4. «Загрузить распакованное расширение» → выберите корень проекта (папку, где лежит [`manifest.json`](./manifest.json))
5. Параметры: из попапа ссылка **«Все настройки…»** или страница расширений → карточка расширения → «Просмотреть на странице параметров расширения» / пункт про расширенные настройки (зависит от версии браузера)

## Совместимость

* **Браузеры**: Chromium 111+ — Google Chrome и совместимые сборки, включая Opera
* **Manifest**: 3
* **Сайты**: `http` / `https` (в манифесте: `match_about_blank`, `match_origin_as_fallback`, `all_frames`)

## Инструменты разработчика

* `node tools/check-world-copies.mjs` — проверить, что пары `fb-channel.js` / `fb-channel-main.js` и `security-defaults.js` / `security-defaults-main.js` байт‑идентичны
* `node tools/check-world-copies.mjs --fix` — скопировать «основные» файлы поверх MAIN‑копий
* `node tools/gen-i18n.mjs` — пересобрать [`src/i18n.js`](src/i18n.js) из каталогов в самом генераторе (после смены строк UI)

---

## Внутренний модуль «API»

Ниже — как расширение взаимодействует с браузером и между своими частями. Это не публичный HTTP API для сторонних серверов; это **внутренний контракт** (Chrome Extension APIs, `chrome.runtime.sendMessage`, `postMessage` между мирами страницы).

### Разрешения в `manifest.json`

| Разрешение | Зачем |
|------------|--------|
| `storage` | Настройки: основным хранилищем служит `chrome.storage.local` (при первом запуске возможна миграция из `sync`), сессионные карты в `chrome.storage.session` (пауза вкладки, косметический CSS, счётчики для бейджа) |
| `tabs`, `windows` | Активная вкладка в попапе, бейдж, хост для статистики |
| `scripting` | Вставка/снятие косметического CSS для ADS Block (`insertCSS` / `removeCSS`) |
| `declarativeNetRequest`, `declarativeNetRequestFeedback` | Динамические правила блокировки/подмены заголовков; опционально `onRuleMatchedDebug` для статистики DNR |
| `privacy` | WebRTC policy, Referer / ping / network prediction |
| `host_permissions` `*://*/*` | Условия DNR и работа с вкладками на обычных сайтах |

### Записи `content_scripts` в манифесте

1. **Изолированный мир, `document_start`** — `fb-channel.js`, `security-defaults.js`, `settings-bridge.js`, `stats-bridge.js`
2. **MAIN, `document_start`** — `fb-channel-main.js`, `security-defaults-main.js`, `stats-main.js`, `device-security.js`, `content.js`, `security.js`, `network-security.js`, `ds-block.js`, `threat-shield.js` (одна запись: общий путь нельзя внедрить дважды)
3. **Изолированный мир, `document_idle`** — `copy-helper.js`

`web_accessible_resources`: [`src/security-worker.js`](src/security-worker.js) для тяжёлых патчей анти‑фингерпринта.

### Service Worker (`src/background.js`)

При `runtime.onInstalled`, `runtime.onStartup` и при изменении релевантных ключей в `storage` вызывается **`reloadFromStorageSnapshot()`**:

1. **Подмена заголовков User-Agent и Client Hints** — правило `modifyHeaders` (id `990001`), если включены расширение, Security и флаг Navigator/UA; при ошибке Chromium применяется стратегия «полный набор → урезанный → только User-Agent»
2. **Accept-Language** — отдельное правило `modifyHeaders` (id `990002`), если включены Security и Languages
3. **Сетевые блокировки** — до 12 правил `block` с `regexFilter` на localhost / RFC1918 / link-local / ULA IPv6 для типов ресурсов без `main_frame`/`sub_frame`, чтобы не ломать прямой заход на LAN‑страницы (слоты с `990020`)
4. **ADS Block телеметрия** — блок доменами пакетами по 40 доменов на правило, слоты с `990060` (18 слотов)
5. **Privacy pack** — аналогично, слоты с `990078` (20 слотов), узкий или широкий набор `resourceTypes`
6. **WebRTC** — `chrome.privacy.network.webRTCIPHandlingPolicy.set` или `clear` в зависимости от Network Security
7. **Изоляция** — `referrersEnabled`, `hyperlinkAuditingEnabled`, `networkPredictionEnabled` через `chrome.privacy`

Дополнительно учитываются ключи Threat Shield для перезагрузки снимка при смене настроек этого модуля.

Дополнительно:

* **Пауза вкладки** — `chrome.storage.session`: ключ `focusBlockerPausedTabIds` (`{ [tabId]: true }`), сброс при смене URL / закрытии вкладки
* **Косметика ADS Block** — хранение CSS по `tabId` (`focusBlockerDsCosmeticCssByTabId`), применение через `scripting` API
* **Статистика** — ключ `focusBlockerStatsByHost` в `chrome.storage.local` (см. миграцию из `sync` выше); инкремент из контента через сообщения и из `declarativeNetRequest.onRuleMatchedDebug` при доступности; поля счётчика: `focus`, `fpSpoof`, `netJs`, `device`, `ds`, `dnrBlock`, `dnrModify`
* **Бейдж** — сумма полей счётчика активной вкладки в `focusBlockerTabStat` (session)

### Сообщения `chrome.runtime.sendMessage` → background

Тип в поле `type` тела сообщения:

| Тип | Кто шлёт | Назначение |
|-----|-----------|------------|
| `FB_STATS_REPORT` | `stats-bridge.js` (изолированный мир) | Передача `deltas`, `breakdown`, `topHost` для статистики и бейджа |
| `FB_DS_BLOCK_SET_COSMETIC_CSS` | `settings-bridge.js`, главный фрейм | Включить/выключить инжект CSS скрытия для текущей вкладки |
| `FB_IS_TAB_PAUSED` | `settings-bridge.js`, `copy-helper.js` | Узнать, стоит ли пауза на этой вкладке |
| `FB_REFRESH_SETTINGS` | `background.js` → вкладка | Перечитать storage/паузу и заново разослать настройки в MAIN (`settings-bridge.js`, `copy-helper.js`) |
| `FB_POPUP_GET_STATE` | `popup.js` | Хост, флаги настроек, исключения, `injectable`, `paused` |
| `FB_POPUP_SET_TAB_PAUSE` | `popup.js` | Поставить/снять паузу для активной вкладки |
| `FB_POPUP_SET_STORAGE_BOOL` | `popup.js` | Только ключи `extensionGloballyEnabled`, `focusBlockingEnabled`, `securityEnabled`, `networkSecurityEnabled` |
| `FB_POPUP_ADD_HOST_EXCLUSION` | `popup.js` | Добавить текущий хост в `excludedDomains` |

Ответы асинхронные (`return true` в listener где нужен `sendResponse`).

### Мост настроек: изолированный мир → MAIN (`src/settings-bridge.js`)

Читает `chrome.storage`, учитывает исключения домена, глобальное включение, паузу вкладки и рассылает в **основной мир страницы** через `window.postMessage` и дублирующие `CustomEvent`. Каждое сообщение **подписано HMAC‑SHA256** (поля `seq` + `sig`, см. раздел [«Защита внутреннего канала»](#защита-внутреннего-канала-hmac)) — неподписанные или повторно отправленные сообщения MAIN‑модули игнорируют:

| `type` в `postMessage` | Назначение |
|------------------------|------------|
| `FOCUS_BLOCKER_SETTINGS` | Списки событий фокуса и флаг «модуль включён» для `content.js` |
| `FOCUS_BLOCKER_SECURITY_SETTINGS` | Сведения Security + URL worker для тяжёлых патчей |
| `FOCUS_BLOCKER_NETWORK_SETTINGS` | Флаги Network Security для `network-security.js` |
| `FOCUS_BLOCKER_DS_BLOCK_SETTINGS` | ADS Block (legacy имя сообщения DS Block) |
| `FOCUS_BLOCKER_DEVICE_SECURITY_SETTINGS` | Device Security |
| `FOCUS_BLOCKER_THREAT_SHIELD_SETTINGS` | Threat Shield: объединённые настройки и встроенные списки паттернов / хвостов TLD |

MAIN-скрипт может запросить переотправку: `FOCUS_BLOCKER_REQUEST_SETTINGS` (ответ подтверждается `FOCUS_BLOCKER_SETTINGS_ACK`).

Кэш в `localStorage` (`__focus_blocker_*_cache_v1`) — это хранилище **самой страницы**, поэтому оно всегда считается недоверенным: подписать его нельзя (ключ HMAC генерируется заново на каждую загрузку), а удалить кэш страница может в любом случае. Отсюда правило: кэш способен только **усилить** защиту относительно безопасного значения по умолчанию, но никогда её не ослабить.

- **Focus Blocker** читает boot-hint `__focus_blocker_focus_cache_v1` на `document_start`, чтобы события фокуса/видимости уже блокировались до скриптов страницы. Из кэша берётся только `isEnabled: true`; список событий всегда свой (`DEFAULT_BLOCKED_EVENTS`). Кэшированный `false` и чужой список событий игнорируются. Мост пишет в кэш лишь флаг on/off, без списка событий.
- **ADS Block** читает кэш `__focus_blocker_ds_block_cache_v1` при `document_start`, чтобы перехватчики (`window.open`, `sendBeacon`, телеметрия) успели встать до скриптов страницы. Из кэша берутся **только булевы флаги и только значение `true`**; `false`, списки доменов/селекторов и `pageAllowed` игнорируются. Пользовательские списки в кэш **не пишутся**.
- **Threat Shield**, **Network Security** и **Device Security** кэш **не читают и не пишут**: их состояние (`isActive`) задаётся только подписанным сообщением с моста. Устаревшие записи этих модулей при первой же рассылке настроек удаляются.
- Полная конфигурация анти‑фингерпринта в `localStorage` страницы **не сохраняется**.

### Защита внутреннего канала (HMAC)

Канал «изолированный мир → MAIN» аутентифицирован, чтобы вредоносная страница не могла поддельным `postMessage` / `CustomEvent` отключить модули или подменить конфигурацию:

* **`src/fb-channel.js`** (изолированный мир) и **`src/fb-channel-main.js`** (MAIN) — общая библиотека, подключается первой в своей записи `content_scripts`: чистый JS SHA‑256 / HMAC‑SHA256 (синхронный, работает и на `http://`, где недоступен `crypto.subtle`) и детерминированная сериализация `stableStringify` с сортировкой ключей. Все используемые нативы (`TextEncoder`, `JSON.stringify`, `Object.keys`, `Array.prototype.sort`, `Uint8Array` и т.д.) захватываются на `document_start` до выполнения скриптов страницы, а экспортируемый API заморожен — страница не может подменить методы и подсмотреть ключ. API публикуется в трёх местах: `globalThis.__fbChannel`, `document.documentElement.__fbChannelApi` и `Document.prototype.__fbChannelGet` (все неперезаписываемые)
* **Байт‑идентичные копии для миров — так и задумано.** Один и тот же путь, перечисленный в нескольких записях `content_scripts`, может быть внедрён в документ лишь один раз: изолированная запись забирала единственное внедрение, и MAIN‑модули оставались вовсе без канала — все подписанные настройки отбрасывались (Threat Shield молчал, Device Security оставался fail‑closed и глушил IndexedDB). По той же причине продублирован и файл значений по умолчанию: `src/security-defaults.js` (изолированный мир, страница настроек, service worker) и `src/security-defaults-main.js` (MAIN) — иначе MAIN‑модули молча уходили на урезанные встроенные значения и ADS Block терял свои списки доменов/селекторов. Правите один файл — копируйте его поверх второго; проверить и починить обе пары: `node tools/check-world-copies.mjs [--fix]`
* **Ключ** — 32 случайных байта на каждую загрузку страницы; мост передаёт его MAIN‑модулям через короткоживущий атрибут `<html data-fb-k="...">`. MAIN‑модули при необходимости перечитывают ключ при проверке подписи; атрибут снимается после ACK Focus или по таймауту (~5 с), а не сразу после первой async‑рассылки. Ключ **никогда не попадает в сами сообщения**
* **Подпись** — каждое сообщение несёт монотонный счётчик `seq` и `sig = HMAC(key, stableStringify(payload без sig))`; MAIN‑модули проверяют подпись и требуют строго возрастающий `seq` (защита от replay)
* **Fail-closed** — Network Security и Device Security стартуют включёнными и могут быть отключены только подписанным сообщением; `workerScriptUrl` для анти‑фингерпринта принимается из HMAC‑payload как `chrome-extension://…/src/security-worker.js` (в MAIN нет `chrome.runtime`); критичные перехваты API закреплены через `configurable: false` с no‑op setter, чтобы страница не падала на присвоении
* Обработчик косметического CSS в `background.js` дополнительно проверяет `sender.id` и ограничивает размер CSS

Остаточный риск: атрибут с ключом существует от `document_start` до ACK/таймаута (обычно миллисекунды–секунды) — inline‑скрипт в начале `<head>` теоретически может успеть его прочитать. Планка атаки поднята с «пассивно слушать `postMessage`» до «активно читать DOM‑атрибут в окне загрузки».

### Статистика из MAIN (`src/stats-main.js` → `stats-bridge.js`)

В изолированный мир уходит `postMessage` с типом **`FOCUS_BLOCKER_STATS_DELTA`** (`deltas`, `breakdown`, `topHost`), оттуда — `FB_STATS_REPORT` в service worker.

### Где смотреть реализацию

* `src/fb-channel.js`, `src/fb-channel-main.js` — криптопримитивы канала настроек (HMAC‑SHA256, каноническая сериализация); идентичные копии для изолированного и MAIN миров
* `src/security-defaults.js`, `src/security-defaults-main.js` — значения по умолчанию, пресеты и функции слияния настроек; такая же пара копий
* `src/settings-bridge.js`, `src/stats-bridge.js` — изолированный мир: storage → MAIN, статистика → background
* `src/content.js` — Focus Blocker в MAIN
* `src/security.js`, `src/security-worker.js` — анти‑фингерпринт
* `src/network-security.js` — перехваты fetch/XHR/WebSocket и др. в рамках настроек
* `src/device-security.js` — API устройства и хранилищ
* `src/ds-block.js` — ADS Block: попапы, телеметрия, косметика (совместно с background)
* `src/copy-helper.js` — копирование (isolated, `document_idle`)
* `src/threat-shield.js` — баннер и эвристики Threat Shield (баннер только в главном фрейме; строки по языку UI)
* `src/i18n.js` — каталоги ru / en / uk для попапа, страницы параметров и баннера (собирается `tools/gen-i18n.mjs`)
* `src/options.js`, `public/options.html` — страница параметров
* `src/popup.js`, `public/popup.html` — попап
* `src/background.js` — service worker

---

## Лицензия

[MIT](./LICENSE). Подробности — в файле `LICENSE`.
