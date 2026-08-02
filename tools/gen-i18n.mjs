/**
 * One-shot generator: writes src/i18n.js from the embedded message catalogs.
 * Run: node tools/gen-i18n.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** @type {Record<string, Record<string, string>>} */
const catalogs = { ru: {}, en: {}, uk: {} };

function m(key, ru, en, uk) {
  catalogs.ru[key] = ru;
  catalogs.en[key] = en;
  catalogs.uk[key] = uk;
}

// —— Shared / chrome UI ——
m("options_document_title", "Browser Security — Settings", "Browser Security — Settings", "Browser Security — Settings");
m("popup_document_title", "Browser Security", "Browser Security", "Browser Security");
m("save_toast", "Настройки сохранены!", "Settings saved!", "Налаштування збережено!");
m("lang_label", "Язык интерфейса", "Interface language", "Мова інтерфейсу");
m(
  "lang_label_secondary",
  "Страница настроек, всплывающее окно и баннер активной защиты",
  "Options page, popup, and active protection banner",
  "Сторінка налаштувань, спливаюче вікно та банер активного захисту"
);
m("lang_ru", "Русский", "Russian", "Російська");
m("lang_en", "English", "English", "English");
m("lang_uk", "Українська", "Ukrainian", "Українська");
m("nav_none_preset", "— Не применять —", "— Do not apply —", "— Не застосовувати —");

// —— Header / shell ——
m("header_subtitle", "Настройки расширения", "Extension settings", "Налаштування розширення");
m("sidebar_aria", "Разделы настроек", "Settings sections", "Розділи налаштувань");
m("sidebar_title", "Разделы", "Sections", "Розділи");
m("footer_powered", "Powered by", "Powered by", "Powered by");
m(
  "reload_notice_main",
  "После изменения настроек необходимо перезагрузить страницу, где используется расширение",
  "After changing settings, reload the page where the extension is used",
  "Після зміни налаштувань потрібно перезавантажити сторінку, де використовується розширення"
);
m(
  "reload_notice_en_sub",
  "After changing settings, reload the page where the extension runs",
  "After changing settings, reload the page where the extension runs",
  "After changing settings, reload the page where the extension runs"
);

// —— Nav ——
m("nav_excluded", "Исключённые домены", "Excluded domains", "Виключені домени");
m("nav_excluded_desc", "Где расширение отключено", "Where the extension is disabled", "Де розширення вимкнено");
m("nav_focus", "Фокус блокер", "Focus blocker", "Фокус-блокер");
m("nav_focus_desc", "События фокуса и видимость вкладки", "Focus events and tab visibility", "Події фокусу та видимість вкладки");
m("nav_copy", "Помощник при копировании", "Copy helper", "Помічник під час копіювання");
m("nav_copy_desc", "Подсветка и выделение для копирования", "Highlight and selection for copying", "Підсвічування та виділення для копіювання");
m("nav_threat", "Активная интернет защита", "Active internet protection", "Активний інтернет-захист");
m("nav_threat_desc", "HTTP, подозрительные домены, редиректы", "HTTP, suspicious domains, redirects", "HTTP, підозрілі домени, редіректи");
m("nav_security", "Анти‑фингерпринт", "Anti-fingerprint", "Анти‑фінгерпринт");
m("nav_security_desc", "Подмена сигналов (screen/WebGL/Canvas…)", "Signal spoofing (screen/WebGL/Canvas…)", "Підміна сигналів (screen/WebGL/Canvas…)");
m("nav_device", "Защита устройства", "Device security", "Захист пристрою");
m("nav_device_desc", "localStorage, IndexedDB, Cache API, камера/гео", "localStorage, IndexedDB, Cache API, camera/geo", "localStorage, IndexedDB, Cache API, камера/гео");
m("nav_network", "Network Security", "Network Security", "Network Security");
m("nav_network_desc", "Локальные адреса, Web‑сканы, WebRTC leak", "Local addresses, web scans, WebRTC leak", "Локальні адреси, веб‑скани, WebRTC leak");
m("nav_privacy", "Privacy pack", "Privacy pack", "Privacy pack");
m("nav_privacy_desc", "DNR трекеры и настройки Chrome (Referer)", "DNR trackers and Chrome settings (Referer)", "DNR трекери та налаштування Chrome (Referer)");
m("nav_ads", "ADS Block", "ADS Block", "ADS Block");
m("nav_ads_desc", "Бывший DS Block — попапы, баннеры, телеметрия", "Former DS Block — popups, banners, telemetry", "Колишній DS Block — попапи, банери, телеметрія");
m("nav_stats", "Статистика", "Statistics", "Статистика");
m("nav_stats_desc", "Блокировки и подмены по доменам", "Blocks and spoofs by domain", "Блокування та підміни за доменами");
m("nav_a11y", "Доступность", "Accessibility", "Доступність");
m("nav_a11y_desc", "Язык, анимации и сдержанный интерфейс", "Language, animations, and a calmer UI", "Мова, анімації та стриманий інтерфейс");

// —— Excluded ——
m("panel_excluded_h", "Исключённые домены", "Excluded domains", "Виключені домени");
m(
  "panel_excluded_desc",
  "По одному домену на строку. Расширение не активируется на этих сайтах.",
  "One domain per line. The extension will not activate on these sites.",
  "По одному домену на рядок. Розширення не активується на цих сайтах."
);
m("ext_enabled", "Расширение включено", "Extension enabled", "Розширення увімкнено");
m(
  "ext_enabled_secondary",
  "Глобально отключает все модули (то же, что переключатель в попапе)",
  "Globally disables all modules (same as the popup toggle)",
  "Глобально вимикає всі модулі (те саме, що перемикач у попапі)"
);
m("excluded_list_title", "Список доменов", "Domain list", "Список доменів");
m(
  "excluded_placeholder",
  "Введите домены по одному на строку (исключения)\nexample.com\n*.subdomain.com",
  "Enter domains one per line (exclusions)\nexample.com\n*.subdomain.com",
  "Введіть домени по одному на рядок (виключення)\nexample.com\n*.subdomain.com"
);
m(
  "excluded_hint_html",
  "• Обычное имя хоста (например <code>example.com</code>) отключает расширение на самом домене и всех поддоменах<br>• Строку <code>*.example.com</code> можно использовать — при сохранении она эквивалентна <code>example.com</code><br>• Можно вставить полный URL — сохранится только имя хоста<br>• Сложные шаблоны с <code>*</code> допускаются; одна строка <code>*</code> игнорируется<br>• Во всех остальных местах расширение включено по умолчанию",
  "• A plain hostname (e.g. <code>example.com</code>) disables the extension on that domain and all subdomains<br>• <code>*.example.com</code> is allowed — on save it is equivalent to <code>example.com</code><br>• You can paste a full URL — only the hostname is stored<br>• Complex patterns with <code>*</code> are allowed; a lone <code>*</code> is ignored<br>• Everywhere else the extension stays on by default",
  "• Звичайне ім’я хоста (наприклад <code>example.com</code>) вимикає розширення на самому домені та всіх піддоменах<br>• Рядок <code>*.example.com</code> можна використовувати — під час збереження він еквівалентний <code>example.com</code><br>• Можна вставити повний URL — збережеться лише ім’я хоста<br>• Складні шаблони з <code>*</code> дозволені; один рядок <code>*</code> ігнорується<br>• В усіх інших місцях розширення увімкнено за замовчуванням"
);

// —— Focus ——
m("panel_focus_h", "Фокус блокер", "Focus blocker", "Фокус-блокер");
m(
  "panel_focus_desc",
  "Какие события видимости вкладки и фокуса блокировать на страницах.",
  "Which tab visibility and focus events to block on pages.",
  "Які події видимості вкладки та фокусу блокувати на сторінках."
);
m("focus_module", "Модуль блокировки фокуса", "Focus blocking module", "Модуль блокування фокусу");
m(
  "focus_module_secondary",
  "Отключите целиком, не меняя список событий ниже",
  "Turn off entirely without changing the event list below",
  "Вимкніть повністю, не змінюючи список подій нижче"
);
m("focus_strict", "Жёсткая подмена (lifecycle)", "Strict spoof (lifecycle)", "Жорстка підміна (lifecycle)");
m(
  "focus_strict_secondary",
  "По умолчанию выключено. Дополнительно блокирует события freeze, resume, pagehide, pageshow (в т.ч. обход через window.onpageshow и аналоги). Может мешать SPA и восстановлению из кэша назад/вперёд (bfcache).",
  "Off by default. Also blocks freeze, resume, pagehide, pageshow (including bypass via window.onpageshow and similar). May break SPAs and back/forward cache (bfcache).",
  "За замовчуванням вимкнено. Додатково блокує події freeze, resume, pagehide, pageshow (зокрема обхід через window.onpageshow та аналоги). Може заважати SPA і відновленню з кешу назад/вперед (bfcache)."
);
m("focus_events_title", "События", "Events", "Події");
m("ev_visibility", "Изменение видимости", "Visibility change", "Зміна видимості");
m("ev_visibility_webkit", "Изменение видимости (webkit)", "Visibility change (webkit)", "Зміна видимості (webkit)");
m("ev_visibility_moz", "Изменение видимости (moz)", "Visibility change (moz)", "Зміна видимості (moz)");
m("ev_visibility_ms", "Изменение видимости (ms)", "Visibility change (ms)", "Зміна видимості (ms)");
m("ev_blur", "Потеря фокуса", "Focus loss", "Втрата фокусу");
m("ev_focus", "Получение фокуса", "Focus gain", "Отримання фокусу");
m("ev_focusin", "Вход фокуса", "Focus in", "Вхід фокусу");
m("ev_focusout", "Выход фокуса", "Focus out", "Вихід фокусу");

// —— Copy ——
m("panel_copy_h", "Помощник при копировании", "Copy helper", "Помічник під час копіювання");
m(
  "panel_copy_desc",
  "Подсветка под курсором и копирование текста в буфер обмена.",
  "Highlight under the cursor and copy text to the clipboard.",
  "Підсвічування під курсором і копіювання тексту в буфер обміну."
);
m("copy_enable", "Включить подсветку", "Enable highlighting", "Увімкнути підсвічування");
m("copy_enable_secondary", "Включить подсветку", "Turn highlighting on", "Увімкнути підсвічування");
m("copy_border_color", "Цвет рамки", "Border color", "Колір рамки");
m("copy_border_color_secondary", "Цвет рамки", "Border color", "Колір рамки");
m("copy_border_opacity", "Прозрачность рамки", "Border opacity", "Прозорість рамки");
m("copy_border_opacity_secondary", "Прозрачность рамки", "Border opacity", "Прозорість рамки");

// —— Threat ——
m("panel_threat_h", "Активная интернет защита", "Active internet protection", "Активний інтернет-захист");
m(
  "panel_threat_desc_html",
  "Красное предупреждение только в главном окне вкладки. <strong>Важно:</strong> если тот же домен указан в разделе «Исключённые домены», расширение там полностью выключено — предупреждение появится только после удаления этого домена из исключений (список «подозрительных доменов» от этого не включит модуль сам по себе). Для SPA (VK и др.) баннер удерживается на странице и при необходимости восстанавливается. Локальные и приватные адреса (localhost, 192.168.x.x) для проверки HTTP не считаются. Ложные срабатывания — белый список или отключение отдельных правил.",
  "A red warning only in the tab’s main frame. <strong>Important:</strong> if the same domain is listed under “Excluded domains”, the extension is fully off there — the warning appears only after you remove that domain from exclusions (the “suspicious domains” list alone will not enable the module). For SPAs (VK, etc.) the banner stays on the page and is restored if needed. Local/private addresses (localhost, 192.168.x.x) are ignored for the HTTP check. False positives — use the whitelist or turn off individual rules.",
  "Червоне попередження лише в головному вікні вкладки. <strong>Важливо:</strong> якщо той самий домен зазначено в розділі «Виключені домени», розширення там повністю вимкнено — попередження з’явиться лише після видалення цього домену з виключень (список «підозрілих доменів» сам модуль не вмикає). Для SPA (VK тощо) банер утримується на сторінці й за потреби відновлюється. Локальні та приватні адреси (localhost, 192.168.x.x) для перевірки HTTP не враховуються. Хибні спрацьовування — білий список або вимкнення окремих правил."
);
m("threat_enable", "Включить активную защиту", "Enable active protection", "Увімкнути активний захист");
m(
  "threat_enable_secondary",
  "Применяется только вне «Исключённые домены» и при глобально включённом расширении",
  "Applies only outside “Excluded domains” and when the extension is globally on",
  "Застосовується лише поза «Виключені домени» та коли розширення глобально увімкнено"
);
m("threat_rules_title", "Условия предупреждения", "Warning conditions", "Умови попередження");
m("threat_http", "Страница по HTTP", "Page over HTTP", "Сторінка через HTTP");
m(
  "threat_http_secondary",
  "Не срабатывает на localhost и LAN (см. Network Security)",
  "Does not trigger on localhost and LAN (see Network Security)",
  "Не спрацьовує на localhost і LAN (див. Network Security)"
);
m("threat_list", "Подозрительный домен (списки)", "Suspicious domain (lists)", "Підозрілий домен (списки)");
m(
  "threat_list_secondary",
  "Встроенные шаблоны (*.tk и др.) + ваши строки ниже",
  "Built-in patterns (*.tk, etc.) + your lines below",
  "Вбудовані шаблони (*.tk тощо) + ваші рядки нижче"
);
m("threat_stacked", "«Двойной» домен (накладочный TLD)", "“Stacked” domain (overlay TLD)", "«Подвійний» домен (накладний TLD)");
m(
  "threat_stacked_secondary",
  "Шаблоны вроде example.com.ru, example.net.xyz (настраиваемые суффиксы из кода расширения)",
  "Patterns like example.com.ru, example.net.xyz (configurable suffixes in the extension code)",
  "Шаблони на кшталт example.com.ru, example.net.xyz (суфікси з коду розширення)"
);
m("threat_garbage", "Очень длинное / шумное имя хоста", "Very long / noisy hostname", "Дуже довге / шумне ім’я хоста");
m(
  "threat_garbage_secondary",
  "Много меток или длинный/цифровой сегмент; по умолчанию выкл.",
  "Many labels or a long/numeric segment; off by default",
  "Багато міток або довгий/цифровий сегмент; за замовчуванням вимк."
);
m("threat_redirect", "Цепочка редиректов", "Redirect chain", "Ланцюг редіректів");
m(
  "threat_redirect_secondary",
  "HTTP-редирект перед текущей страницей (Performance Navigation)",
  "HTTP redirect before the current page (Performance Navigation)",
  "HTTP-редірект перед поточною сторінкою (Performance Navigation)"
);
m("threat_params_title", "Параметры и списки", "Parameters and lists", "Параметри та списки");
m("threat_garbage_threshold", "Порог «мусорности» по числу меток в FQDN", "“Garbage” threshold by FQDN label count", "Поріг «сміття» за кількістю міток у FQDN");
m(
  "threat_garbage_threshold_secondary",
  "Срабатывание если меток не меньше этого числа (4–15, при включённой эвристике выше)",
  "Triggers when label count is at least this number (4–15, when the heuristic above is on)",
  "Спрацьовує, якщо міток не менше цього числа (4–15, коли евристика вище увімкнена)"
);
m("threat_extra_label", "Доп. подозрительные домены и шаблоны (одна строка = один паттерн)", "Extra suspicious domains and patterns (one line = one pattern)", "Дод. підозрілі домени та шаблони (один рядок = один патерн)");
m(
  "threat_extra_placeholder",
  "Примеры:\nevil-phish.example\n*.scam-login.net\nbadsite.xyz",
  "Examples:\nevil-phish.example\n*.scam-login.net\nbadsite.xyz",
  "Приклади:\nevil-phish.example\n*.scam-login.net\nbadsite.xyz"
);
m(
  "threat_extra_warn",
  "Если вы добавили здесь vk.com для теста, но домен уже в «Исключённые домены», баннер не появится — уберите его из исключений. Нужны включённые «Включить активную защиту», «Подозрительный домен (списки)», сохранение настроек и обновление страницы vk.com (Ctrl+F5).",
  "If you added vk.com here for testing but the domain is already in “Excluded domains”, the banner will not appear — remove it from exclusions. You need “Enable active protection”, “Suspicious domain (lists)”, saved settings, and a reload of vk.com (Ctrl+F5).",
  "Якщо ви додали тут vk.com для тесту, але домен уже в «Виключені домени», банер не з’явиться — приберіть його з виключень. Потрібні увімкнені «Увімкнути активний захист», «Підозрілий домен (списки)», збереження налаштувань і оновлення сторінки vk.com (Ctrl+F5)."
);
m("threat_whitelist_label", "Белый список (никогда не предупреждать, если совпало)", "Whitelist (never warn on match)", "Білий список (ніколи не попереджати при збігу)");
m("threat_reset", "Сбросить активную защиту", "Reset active protection", "Скинути активний захист");
m("threat_banner_text", "Возможна угроза вашим данным. Будьте осторожны!", "Your data may be at risk. Be careful!", "Можлива загроза вашим даним. Будьте обережні!");
m("threat_banner_close", "Закрыть", "Close", "Закрити");
m("threat_banner_session", "Не показывать на этом сайте (сессия)", "Don’t show on this site (session)", "Не показувати на цьому сайті (сесія)");

// —— Security ——
m("panel_security_h", "Анти‑фингерпринт", "Anti-fingerprint", "Анти‑фінгерпринт");
m(
  "panel_security_desc",
  "Подмена части браузерных «сигналов», которые часто используют для fingerprint. Некоторые пункты могут ломать сайты — включайте только нужное. Для проверки «как на whoer» включите анти‑фингерпринт + Navigator/UA и перезагрузите страницу.",
  "Spoofs some browser “signals” often used for fingerprinting. Some options may break sites — enable only what you need. To test “like whoer”, enable anti-fingerprint + Navigator/UA and reload the page.",
  "Підміна частини браузерних «сигналів», які часто використовують для fingerprint. Деякі пункти можуть ламати сайти — вмикайте лише потрібне. Для перевірки «як на whoer» увімкніть анти‑фінгерпринт + Navigator/UA і перезавантажте сторінку."
);
m("sec_enable", "Включить анти‑фингерпринт", "Enable anti-fingerprint", "Увімкнути анти‑фінгерпринт");
m(
  "sec_enable_secondary",
  "Модуль работает только вне списка «Исключённые домены»",
  "The module only runs outside the “Excluded domains” list",
  "Модуль працює лише поза списком «Виключені домени»"
);
m("sec_reset", "Сбросить Security к умолчаниям", "Reset Security to defaults", "Скинути Security до типових");
m("sec_spoof_title", "Что подменять", "What to spoof", "Що підміняти");
m("sec_screen", "Screen / окно", "Screen / window", "Screen / вікно");
m("sec_battery", "Battery", "Battery", "Battery");
m("sec_cpu", "CPU / память", "CPU / memory", "CPU / пам’ять");
m("sec_matchmedia", "matchMedia", "matchMedia", "matchMedia");
m("sec_matchmedia_secondary", "Размеры/DPR в медиа-запросах", "Sizes/DPR in media queries", "Розміри/DPR у медіа-запитах");
m("sec_webgl", "WebGL", "WebGL", "WebGL");
m("sec_canvas", "Canvas", "Canvas", "Canvas");
m("sec_canvas_secondary", "Шум при readback", "Noise on readback", "Шум під час readback");
m("sec_timezone", "Timezone", "Timezone", "Timezone");
m(
  "sec_timezone_secondary",
  "Intl timeZone + Date.getTimezoneOffset (иногда ломает)",
  "Intl timeZone + Date.getTimezoneOffset (may break sites)",
  "Intl timeZone + Date.getTimezoneOffset (іноді ламає)"
);
m("sec_navigator", "Navigator / UA", "Navigator / UA", "Navigator / UA");
m(
  "sec_navigator_secondary",
  "Сетевые заголовки (User-Agent, Sec-CH-UA*) + JS navigator. Сайты вроде whoer смотрят на заголовки запроса.",
  "Network headers (User-Agent, Sec-CH-UA*) + JS navigator. Sites like whoer look at request headers.",
  "Мережеві заголовки (User-Agent, Sec-CH-UA*) + JS navigator. Сайти на кшталт whoer дивляться на заголовки запиту."
);
m("sec_languages", "Languages", "Languages", "Languages");
m(
  "sec_languages_secondary",
  "navigator.language(s) + Accept-Language (заголовок запроса)",
  "navigator.language(s) + Accept-Language (request header)",
  "navigator.language(s) + Accept-Language (заголовок запиту)"
);
m("sec_fonts", "Fonts", "Fonts", "Fonts");
m(
  "sec_fonts_secondary",
  "document.fonts.check + опц. measureText (редко нужно)",
  "document.fonts.check + optional measureText (rarely needed)",
  "document.fonts.check + опц. measureText (рідко потрібно)"
);
m("sec_profiles_title", "Профиль и отпечаток", "Profile and fingerprint", "Профіль і відбиток");
m("sec_profile", "Профиль", "Profile", "Профіль");
m(
  "sec_profile_secondary",
  "Laptop / Desktop / Mobile / Custom (ручные значения)",
  "Laptop / Desktop / Mobile / Custom (manual values)",
  "Laptop / Desktop / Mobile / Custom (ручні значення)"
);
m("sec_fp_mode", "Режим отпечатка", "Fingerprint mode", "Режим відбитка");
m(
  "sec_fp_mode_secondary",
  "Как часто меняются WebGL/Canvas (детерминированно или случайно)",
  "How often WebGL/Canvas change (deterministic or random)",
  "Як часто змінюються WebGL/Canvas (детерміновано чи випадково)"
);
m("sec_fp_per_domain", "Per domain (детерминированно)", "Per domain (deterministic)", "Per domain (детерміновано)");
m("sec_fp_per_session", "Per session", "Per session", "Per session");
m("sec_fp_random", "Random each call", "Random each call", "Random each call");
m("sec_nav_preset", "Пресет браузера / ОС", "Browser / OS preset", "Пресет браузера / ОС");
m(
  "sec_nav_preset_secondary",
  "Заполняет поля Navigator/UA и UA‑CH (userAgentData)",
  "Fills Navigator/UA and UA-CH (userAgentData) fields",
  "Заповнює поля Navigator/UA та UA‑CH (userAgentData)"
);
m("btn_apply", "Применить", "Apply", "Застосувати");
m("sec_fields_title", "Числовые и текстовые поля пресета", "Numeric and text preset fields", "Числові та текстові поля пресета");
m("sec_tz_iana", "Timezone (IANA id для Intl)", "Timezone (IANA id for Intl)", "Timezone (IANA id для Intl)");
m("sec_tz_preset", "Пресет часового пояса", "Timezone preset", "Пресет часового поясу");
m("sec_tz_offset", "getTimezoneOffset() (минуты, как у MDN)", "getTimezoneOffset() (minutes, as in MDN)", "getTimezoneOffset() (хвилини, як у MDN)");
m(
  "sec_tz_note",
  "Date.toString может по-прежнему показывать системную зону; для fingerprint обычно важны Intl + getTimezoneOffset.",
  "Date.toString may still show the system zone; for fingerprinting, Intl + getTimezoneOffset usually matter.",
  "Date.toString може й далі показувати системну зону; для fingerprint зазвичай важливі Intl + getTimezoneOffset."
);
m("sec_lang_preset", "Пресет языков", "Language preset", "Пресет мов");
m("sec_nav_languages", "navigator.languages (по одному locale на строку)", "navigator.languages (one locale per line)", "navigator.languages (по одному locale на рядок)");
m(
  "sec_lang_note_html",
  "Accept-Language собирается из списка <code>languages</code> (с q-weights) при включённом Languages.",
  "Accept-Language is built from the <code>languages</code> list (with q-weights) when Languages is on.",
  "Accept-Language збирається зі списку <code>languages</code> (з q-weights) коли Languages увімкнено."
);
m("sec_font_families", "Шрифты в allowlist для fonts.check (один на строку)", "Font allowlist for fonts.check (one per line)", "Шрифти в allowlist для fonts.check (один на рядок)");
m(
  "sec_font_note_html",
  "Если семейство из запроса есть в списке — <code>check</code> вернёт <code>true</code>, иначе <code>false</code>. Пустой список = только нативное поведение.",
  "If the requested family is in the list — <code>check</code> returns <code>true</code>, otherwise <code>false</code>. Empty list = native behavior only.",
  "Якщо сімейство з запиту є в списку — <code>check</code> поверне <code>true</code>, інакше <code>false</code>. Порожній список = лише нативна поведінка."
);
m(
  "sec_hint_custom",
  "Custom: WebGL vendor/renderer применяются только в этом режиме. Screen/CPU значения также берутся из полей ниже.",
  "Custom: WebGL vendor/renderer apply only in this mode. Screen/CPU values also come from the fields below.",
  "Custom: WebGL vendor/renderer застосовуються лише в цьому режимі. Значення Screen/CPU також беруться з полів нижче."
);
m(
  "sec_hint_preset",
  "Laptop/Desktop/Mobile: при выборе профиля подставляются Screen/CPU. WebGL vendor/renderer настраиваются только в Custom (в остальных режимах WebGL выбирается алгоритмом).",
  "Laptop/Desktop/Mobile: choosing a profile fills Screen/CPU. WebGL vendor/renderer are configured only in Custom (otherwise WebGL is chosen by algorithm).",
  "Laptop/Desktop/Mobile: під час вибору профілю підставляються Screen/CPU. WebGL vendor/renderer налаштовуються лише в Custom (в інших режимах WebGL обирає алгоритм)."
);

// —— Device ——
m("panel_device_h", "Защита устройства", "Device security", "Захист пристрою");
m(
  "panel_device_desc",
  "Жёсткая защита от извлечения/загрузки локальных данных и от попыток понять, есть ли у вас устройство/гео. Этот модуль может ломать сайты — включайте, только если готовы к поломкам.",
  "Hard protection against reading/writing local data and against probing for devices/geo. This module can break sites — enable only if you accept breakage.",
  "Жорсткий захист від витягування/запису локальних даних і від спроб зрозуміти, чи є у вас пристрій/гео. Цей модуль може ламати сайти — вмикайте, лише якщо готові до поломок."
);
m("device_enable", "Включить защиту устройства", "Enable device security", "Увімкнути захист пристрою");
m(
  "device_enable_secondary",
  "Применяется только вне доменов из «Исключённые домены»",
  "Applies only outside domains in “Excluded domains”",
  "Застосовується лише поза доменами з «Виключені домени»"
);
m("important", "Важно", "Important", "Важливо");
m(
  "device_important_html",
  "В режиме «жёстко» сайт может получать <code>undefined</code> вместо API и/или ошибки <code>SecurityError</code>. Это сделано намеренно, чтобы страница не успевала увидеть реальные данные.",
  "In “hard” mode a site may get <code>undefined</code> instead of APIs and/or <code>SecurityError</code>. This is intentional so the page cannot see real data.",
  "У режимі «жорстко» сайт може отримувати <code>undefined</code> замість API та/або помилки <code>SecurityError</code>. Це зроблено навмисно, щоб сторінка не встигала побачити реальні дані."
);
m("device_local_title", "Локальные данные", "Local data", "Локальні дані");
m("device_block_storage", "Блокировать localStorage / sessionStorage", "Block localStorage / sessionStorage", "Блокувати localStorage / sessionStorage");
m("device_block_storage_secondary", "Чтение/запись ключей из JS", "Read/write keys from JS", "Читання/запис ключів з JS");
m("device_block_idb", "Блокировать IndexedDB", "Block IndexedDB", "Блокувати IndexedDB");
m("device_block_cache", "Блокировать Cache API", "Block Cache API", "Блокувати Cache API");
m("device_hardware_title", "Устройства", "Devices", "Пристрої");
m("device_hide_media", "Скрывать камеру/микрофон", "Hide camera/microphone", "Приховувати камеру/мікрофон");
m("device_hide_media_secondary", "navigator.mediaDevices → как будто нет", "navigator.mediaDevices → as if missing", "navigator.mediaDevices → ніби немає");
m("device_hide_geo", "Скрывать геолокацию", "Hide geolocation", "Приховувати геолокацію");
m("device_hide_geo_secondary", "navigator.geolocation → как будто нет", "navigator.geolocation → as if missing", "navigator.geolocation → ніби немає");
m("device_extra_title", "Дополнительно", "Extra", "Додатково");
m("device_lockdown", "Lockdown (не давать странице откатить хуки)", "Lockdown (prevent the page from undoing hooks)", "Lockdown (не давати сторінці відкотити хуки)");
m("device_lockdown_secondary", "configurable/writable → максимально строго", "configurable/writable → as strict as possible", "configurable/writable → максимально суворо");
m("device_reset", "Сбросить защиту устройства", "Reset device security", "Скинути захист пристрою");

// —— Network ——
m("panel_network_h", "Network Security", "Network Security", "Network Security");
m(
  "panel_network_desc_html",
  "Защита от веб‑страниц, которые пытаются подключиться к вашему <code>localhost</code>, локальной сети (RFC1918) или уменьшают утечки через WebRTC. Внешний скан вашего публичного IP браузерным расширением остановить нельзя — см. блок ниже (роутер / файрвол).",
  "Protects against pages that try to reach your <code>localhost</code>, LAN (RFC1918), or reduces WebRTC leaks. An external scan of your public IP cannot be stopped by a browser extension — see the note below (router / firewall).",
  "Захист від веб‑сторінок, які намагаються підключитися до вашого <code>localhost</code>, локальної мережі (RFC1918) або зменшують витоки через WebRTC. Зовнішній скан вашого публічного IP браузерним розширенням зупинити не можна — див. блок нижче (роутер / файрвол)."
);
m("network_enable", "Включить Network Security", "Enable Network Security", "Увімкнути Network Security");
m(
  "network_enable_secondary",
  "Применяется вне доменов из «Исключённые домены»",
  "Applies outside domains in “Excluded domains”",
  "Застосовується поза доменами з «Виключені домени»"
);
m("network_ext_scan_title", "Внешний онлайн‑скан портов", "External online port scan", "Зовнішній онлайн‑скан портів");
m(
  "network_ext_scan_html",
  "Скан «с интернета» идёт к вашему <dfn>NAT</dfn>/роутеру; расширение его не режет. Отключите <strong>Перенаправление портов (port forwarding)</strong> и при возможности <strong>UPnP</strong>; проверьте <strong>Файрвол Windows</strong> (разрешённые входящие правила); не публикуйте лишние сервисы наружу.",
  "A scan “from the internet” hits your <dfn>NAT</dfn>/router; the extension cannot block it. Disable <strong>port forwarding</strong> and <strong>UPnP</strong> if possible; check the <strong>Windows Firewall</strong> (allowed inbound rules); don’t expose unnecessary services.",
  "Скан «з інтернету» йде до вашого <dfn>NAT</dfn>/роутера; розширення його не ріже. Вимкніть <strong>перенаправлення портів (port forwarding)</strong> і за можливості <strong>UPnP</strong>; перевірте <strong>файрвол Windows</strong> (дозволені вхідні правила); не публікуйте зайві сервіси назовні."
);
m("network_lan_title", "Блокировка из страницы (LAN / loopback)", "Block from the page (LAN / loopback)", "Блокування зі сторінки (LAN / loopback)");
m("network_block_private", "Блокировать частные / link‑local сети", "Block private / link-local networks", "Блокувати приватні / link‑local мережі");
m("network_block_localhost", "Блокировать localhost / loopback", "Block localhost / loopback", "Блокувати localhost / loopback");
m("network_block_embed", "Блокировать встроенные зонды", "Block embedded probes", "Блокувати вбудовані зонди");
m(
  "network_block_embed_secondary",
  "img / iframe / object / embed — не применяется на самих LAN‑страницах",
  "img / iframe / object / embed — not applied on LAN pages themselves",
  "img / iframe / object / embed — не застосовується на самих LAN‑сторінках"
);
m("network_webrtc_title", "WebRTC (утечка IP)", "WebRTC (IP leak)", "WebRTC (витік IP)");
m("network_webrtc_enable", "Защита от утечки через WebRTC", "Protect against WebRTC leaks", "Захист від витоку через WebRTC");
m(
  "network_webrtc_enable_secondary_html",
  "Меняет политику Chrome <code>webRTCIPHandlingPolicy</code>; может ломать звонки",
  "Changes Chrome <code>webRTCIPHandlingPolicy</code>; may break calls",
  "Змінює політику Chrome <code>webRTCIPHandlingPolicy</code>; може ламати дзвінки"
);
m("network_webrtc_mode", "Режим WebRTC", "WebRTC mode", "Режим WebRTC");
m("network_webrtc_mode_secondary", "Строже = чаще ломает видеочаты", "Stricter = more often breaks video chats", "Суворіше = частіше ламає відеочати");
m("network_webrtc_public", "Только публичный интерфейс", "Public interface only", "Лише публічний інтерфейс");
m("network_webrtc_udp", "Без непроксируемого UDP (строже)", "Disable non-proxied UDP (stricter)", "Без непроксованого UDP (суворіше)");
m("network_reset", "Сбросить Network Security", "Reset Network Security", "Скинути Network Security");
m("webrtc_read_fail", "WebRTC: не удалось прочитать политику браузера.", "WebRTC: failed to read the browser policy.", "WebRTC: не вдалося прочитати політику браузера.");
m("webrtc_controllable", "Текущее значение Chrome: {val}. Расширение может менять политику.", "Current Chrome value: {val}. The extension can change the policy.", "Поточне значення Chrome: {val}. Розширення може змінювати політику.");
m("webrtc_other_ext", "Сейчас {val}, но настройку переопределяет другое расширение.", "Currently {val}, but another extension overrides this setting.", "Зараз {val}, але налаштування перевизначає інше розширення.");
m("webrtc_admin", "Политика зафиксирована администратором ({val}).", "Policy is locked by the administrator ({val}).", "Політику зафіксовано адміністратором ({val}).");
m("webrtc_other", "Chrome: {val} (контроль: {lvl}).", "Chrome: {val} (control: {lvl}).", "Chrome: {val} (контроль: {lvl}).");

// —— Privacy ——
m("panel_privacy_h", "Privacy pack (Declarative Net Request)", "Privacy pack (Declarative Net Request)", "Privacy pack (Declarative Net Request)");
m(
  "panel_privacy_desc",
  "Отдельно от ADS Block: только сетевая блокировка малого списка сторонних трекер‑доменов (без косметики и попапов). Работает вне доменов из раздела «Исключённые домены». Типы ресурсов по умолчанию узкие (script / XHR / ping) — см. переключатель ниже.",
  "Separate from ADS Block: network blocking of a small third-party tracker domain list only (no cosmetics or popups). Works outside “Excluded domains”. Default resource types are narrow (script / XHR / ping) — see the toggle below.",
  "Окремо від ADS Block: лише мережеве блокування малого списку сторонніх трекер‑доменів (без косметики й попапів). Працює поза доменами з розділу «Виключені домени». Типи ресурсів за замовчуванням вузькі (script / XHR / ping) — див. перемикач нижче."
);
m("privacy_enable", "Включить Privacy pack", "Enable Privacy pack", "Увімкнути Privacy pack");
m(
  "privacy_enable_secondary",
  "DNR блок по списку доменов ниже и встроенному набору",
  "DNR block using the domain list below and the built-in set",
  "DNR блок за списком доменів нижче та вбудованим набором"
);
m("privacy_wide", "Расширенный набор типов запросов", "Wider set of request types", "Розширений набір типів запитів");
m(
  "privacy_wide_secondary",
  "Как блок телеметрии в ADS Block (iframes, image, websocket…). Выше шанс поломать сайты",
  "Same as ADS Block telemetry (iframes, image, websocket…). Higher chance of breaking sites",
  "Як блок телеметрії в ADS Block (iframes, image, websocket…). Вищий шанс зламати сайти"
);
m("privacy_extra_label", "Дополнительные домены (одна строка — один hostname)", "Extra domains (one line — one hostname)", "Додаткові домени (один рядок — один hostname)");
m("privacy_reset", "Сбросить Privacy pack", "Reset Privacy pack", "Скинути Privacy pack");
m("privacy_iso_h", "Изоляция (chrome.privacy)", "Isolation (chrome.privacy)", "Ізоляція (chrome.privacy)");
m(
  "privacy_iso_desc_html",
  "Жёсткие настройки браузера: отключение отправки заголовка <code>Referer</code>, ping по ссылкам (<code>a ping</code>) и сетевого prefetch (Network Prediction). Если что‑то сломало оплату или вход — добавьте сайт в «Исключённые домены» для модулей DNR здесь это не восстанавливает Referer: выключите соответствующий пункт или снимите ограничение в Chrome.",
  "Hard browser settings: disable sending the <code>Referer</code> header, link ping (<code>a ping</code>), and network prefetch (Network Prediction). If something broke payments or login — add the site to “Excluded domains” for DNR modules; that does not restore Referer here: turn the option off or lift the limit in Chrome.",
  "Жорсткі налаштування браузера: вимкнення надсилання заголовка <code>Referer</code>, ping за посиланнями (<code>a ping</code>) і мережевого prefetch (Network Prediction). Якщо щось зламало оплату чи вхід — додайте сайт у «Виключені домени» для модулів DNR; це не відновлює Referer тут: вимкніть відповідний пункт або зніміть обмеження в Chrome."
);
m("privacy_referrer", "Не отправлять Referer", "Do not send Referer", "Не надсилати Referer");
m("privacy_ping", "Отключить аудит ссылок (ping)", "Disable hyperlink auditing (ping)", "Вимкнути аудит посилань (ping)");
m("privacy_prefetch", "Отключить предсказание сети (prefetch/DNS prefetch)", "Disable network prediction (prefetch/DNS prefetch)", "Вимкнути передбачення мережі (prefetch/DNS prefetch)");
m(
  "privacy_prefetch_secondary_html",
  "<code>networkPredictionEnabled → false</code>. Меньше префетча, может изменить ощущаемую скорость",
  "<code>networkPredictionEnabled → false</code>. Less prefetch; may change perceived speed",
  "<code>networkPredictionEnabled → false</code>. Менше префетчу, може змінити відчутну швидкість"
);
m("privacy_iso_reset", "Сбросить изоляцию (к браузеру)", "Reset isolation (to browser defaults)", "Скинути ізоляцію (до браузера)");
m("privacy_hint_unavailable", "{label}: недоступно.", "{label}: unavailable.", "{label}: недоступно.");
m("privacy_hint_error", "{label}: ошибка ({err}).", "{label}: error ({err}).", "{label}: помилка ({err}).");
m("privacy_hint_error_short", "{label}: ошибка.", "{label}: error.", "{label}: помилка.");
m("privacy_hint_on", "вкл", "on", "увімк");
m("privacy_hint_off", "выкл", "off", "вимк");
m("privacy_hint_line", "{label}: {val}; контроль: {lvl}", "{label}: {val}; control: {lvl}", "{label}: {val}; контроль: {lvl}");

// —— ADS ——
m("panel_ads_h", "ADS Block", "ADS Block", "ADS Block");
m(
  "panel_ads_desc",
  "Ранее модуль «DS Block». Блокировка всплывающих окон, рекламных баннеров и части телеметрии. Может ломать логин/виджеты/аналитику — включайте точечно и используйте «Исключённые домены» при проблемах. Встроенные CSS‑правила для типичной рекламы (AdSense, GPT, частые сети) расширены, но не заменяют полноценный блокировщик — под свою вёрстку добавляйте селекторы ниже.",
  "Formerly “DS Block”. Blocks popups, ad banners, and some telemetry. May break login/widgets/analytics — enable selectively and use “Excluded domains” when needed. Built-in CSS rules for common ads (AdSense, GPT, popular networks) are expanded but are not a full ad blocker — add your own selectors below for custom layouts.",
  "Раніше модуль «DS Block». Блокування спливаючих вікон, рекламних банерів і частини телеметрії. Може ламати логін/віджети/аналітику — вмикайте точково й використовуйте «Виключені домени» за проблем. Вбудовані CSS‑правила для типової реклами (AdSense, GPT, поширені мережі) розширено, але вони не замінюють повноцінний блокувальник — для своєї верстки додавайте селектори нижче."
);
m("ads_enable", "Включить ADS Block", "Enable ADS Block", "Увімкнути ADS Block");
m(
  "ads_enable_secondary",
  "Применяется только вне доменов из «Исключённые домены»",
  "Applies only outside domains in “Excluded domains”",
  "Застосовується лише поза доменами з «Виключені домени»"
);
m(
  "ads_important_body",
  "«Телеметрия» здесь означает домены аналитики/пикселей/трекеров. Если сломался вход (OAuth), чат, видео или кнопки — сначала выключите телеметрию, затем добавьте сайт в «Исключённые домены».",
  "“Telemetry” here means analytics/pixel/tracker domains. If login (OAuth), chat, video, or buttons break — turn off telemetry first, then add the site to “Excluded domains”.",
  "«Телеметрія» тут означає домени аналітики/пікселів/трекерів. Якщо зламався вхід (OAuth), чат, відео чи кнопки — спочатку вимкніть телеметрію, потім додайте сайт у «Виключені домени»."
);
m("ads_rules_title", "Что блокировать", "What to block", "Що блокувати");
m("ads_popups", "Попапы (window.open)", "Popups (window.open)", "Попапи (window.open)");
m(
  "ads_popups_secondary",
  "Вызовы без пользовательского жеста и программные клики по ссылкам с target=_blank",
  "Calls without a user gesture and synthetic clicks on target=_blank links",
  "Виклики без жесту користувача та програмні кліки за посиланнями з target=_blank"
);
m("ads_cosmetic", "Баннеры (косметика)", "Banners (cosmetic)", "Банери (косметика)");
m("ads_cosmetic_secondary", "Скрытие элементов по CSS селекторам", "Hide elements by CSS selectors", "Приховування елементів за CSS селекторами");
m("ads_telemetry", "Телеметрия (сеть + sendBeacon)", "Telemetry (network + sendBeacon)", "Телеметрія (мережа + sendBeacon)");
m(
  "ads_telemetry_secondary",
  "Блок доменов аналитики через DNR; может ломать сайты",
  "Block analytics domains via DNR; may break sites",
  "Блок доменів аналітики через DNR; може ламати сайти"
);
m("ads_lists_title", "Пользовательские списки", "Custom lists", "Користувацькі списки");
m("ads_domains_label", "Доп. домены для блокировки (по одному на строку)", "Extra domains to block (one per line)", "Дод. домени для блокування (по одному на рядок)");
m(
  "ads_domains_placeholder",
  "Примеры:\nexample.com\n*.tracker.example\nhttps://telemetry.example/path",
  "Examples:\nexample.com\n*.tracker.example\nhttps://telemetry.example/path",
  "Приклади:\nexample.com\n*.tracker.example\nhttps://telemetry.example/path"
);
m(
  "ads_domains_hint",
  "Эти домены добавляются к встроенному небольшому списку и используются для блокировки запросов к телеметрии/рекламе.",
  "These domains are added to the small built-in list and used to block telemetry/ad requests.",
  "Ці домени додаються до вбудованого невеликого списку й використовуються для блокування запитів до телеметрії/реклами."
);
m("ads_css_label", "CSS селекторы для скрытия (по одному на строку)", "CSS selectors to hide (one per line)", "CSS селектори для приховування (по одному на рядок)");
m(
  "ads_css_placeholder",
  'Примеры:\n.banner\n#ad_container\niframe[src*="ads"]',
  'Examples:\n.banner\n#ad_container\niframe[src*="ads"]',
  'Приклади:\n.banner\n#ad_container\niframe[src*="ads"]'
);
m(
  "ads_css_hint",
  "Селекторы применяются к странице через инъекцию CSS и работают быстрее, чем скриптовые «поиски» элементов. К встроенному списку (см. описание панели выше) добавляются только ваши строки; агрессивные правила вводите вручную.",
  "Selectors are applied via CSS injection and are faster than scripted element “hunts”. Only your lines are added to the built-in list (see the panel description above); enter aggressive rules manually.",
  "Селектори застосовуються до сторінки через ін’єкцію CSS і працюють швидше за скриптові «пошуки» елементів. До вбудованого списку (див. опис панелі вище) додаються лише ваші рядки; агресивні правила вводьте вручну."
);
m("ads_reset", "Сбросить ADS Block", "Reset ADS Block", "Скинути ADS Block");

// —— Stats ——
m("panel_stats_h", "Статистика", "Statistics", "Статистика");
m(
  "panel_stats_desc",
  "Локальные суммы по доменам верхнего окна: насколько часто срабатывали блокировки и подмены (фокус, анти‑фингерпринт в JS, сеть на странице, правила Declarative Net Request, защита устройства, ADS Block). Это не полный журнал посещений и не все сторонние домены. Нажмите на строку с доменом, чтобы увидеть разбивку по функциям и подфункциям.",
  "Local totals per top-frame domain: how often blocks and spoofs fired (focus, JS anti-fingerprint, in-page network, Declarative Net Request, device security, ADS Block). Not a full visit log and not every third-party domain. Click a domain row for a breakdown by function and sub-function.",
  "Локальні суми за доменами верхнього вікна: як часто спрацьовували блокування та підміни (фокус, анти‑фінгерпринт у JS, мережа на сторінці, правила Declarative Net Request, захист пристрою, ADS Block). Це не повний журнал відвідувань і не всі сторонні домени. Натисніть рядок з доменом, щоб побачити розбивку за функціями та підфункціями."
);
m("stats_clear", "Очистить статистику", "Clear statistics", "Очистити статистику");
m(
  "stats_empty",
  "Пока нет данных — откройте страницы с включённым расширением и действующими модулями.",
  "No data yet — open pages with the extension enabled and modules active.",
  "Поки немає даних — відкрийте сторінки з увімкненим розширенням і активними модулями."
);
m("stats_table_aria", "Статистика по доменам", "Statistics by domain", "Статистика за доменами");
m("stats_col_domain", "Домен", "Domain", "Домен");
m("stats_col_focus", "Фокус", "Focus", "Фокус");
m("stats_col_fp", "Подмена FP", "FP spoof", "Підміна FP");
m("stats_col_net", "Сеть (JS)", "Network (JS)", "Мережа (JS)");
m("stats_col_dnr", "DNR блок", "DNR block", "DNR блок");
m("stats_col_dnr_h", "DNR заголовки", "DNR headers", "DNR заголовки");
m("stats_col_device", "Устройство", "Device", "Пристрій");
m("stats_col_ads", "ADS", "ADS", "ADS");
m("stats_col_total", "Всего", "Total", "Усього");
m("stats_detail_aria", "Разбивка по домену", "Breakdown by domain", "Розбивка за доменом");
m("stats_close", "Закрыть", "Close", "Закрити");
m(
  "stats_no_detail",
  "Для этого домена нет сохранённой детализации (данные собраны до обновления или только суммы по столбцам). Откройте сайт заново после обновления расширения.",
  "No saved breakdown for this domain (data from before an update, or column totals only). Revisit the site after updating the extension.",
  "Для цього домену немає збереженої деталізації (дані зібрані до оновлення або лише суми за стовпцями). Відкрийте сайт знову після оновлення розширення."
);
m("stats_cat_focus", "Фокус и видимость вкладки", "Focus and tab visibility", "Фокус і видимість вкладки");
m("stats_cat_fp", "Анти‑фингерпринт (подмена в JavaScript)", "Anti-fingerprint (JavaScript spoof)", "Анти‑фінгерпринт (підміна в JavaScript)");
m("stats_cat_net", "Сеть на странице (Network Security)", "In-page network (Network Security)", "Мережа на сторінці (Network Security)");
m("stats_cat_dnr_block", "Declarative Net Request — блокировка", "Declarative Net Request — blocking", "Declarative Net Request — блокування");
m("stats_cat_dnr_modify", "Declarative Net Request — подмена заголовков", "Declarative Net Request — header spoofing", "Declarative Net Request — підміна заголовків");
m("stats_cat_device", "Device Security", "Device Security", "Device Security");
m("stats_cat_ds", "ADS Block (блок рекламы и телеметрии)", "ADS Block (ads and telemetry)", "ADS Block (блок реклами та телеметрії)");
m("stats_sub_prefix", "Подфункция: {name}", "Sub-function: {name}", "Підфункція: {name}");
m("stats_sub_capture", "Подфункция: перехват фазы захвата DOM для события «{ev}»", "Sub-function: capture-phase DOM intercept for “{ev}”", "Підфункція: перехоплення фази захоплення DOM для події «{ev}»");
m("stats_sub_visibility", "Подфункция: подмена чтения document.{p}", "Sub-function: spoof reading document.{p}", "Підфункція: підміна читання document.{p}");
m("stats_sub_inline", "Подфункция: скрытие inline handler {name}", "Sub-function: hide inline handler {name}", "Підфункція: приховування inline handler {name}");
m("stats_sub_embed_assign", "Подфункция: блок назначения URL ({sk})", "Sub-function: block URL assignment ({sk})", "Підфункція: блок призначення URL ({sk})");
m("stats_sub_embed_attr", "Подфункция: блок setAttribute ({sk})", "Sub-function: block setAttribute ({sk})", "Підфункція: блок setAttribute ({sk})");
m("stats_sub_net_slot", "Подфункция: блокировка по правилу Network Security (слот {n})", "Sub-function: Network Security rule block (slot {n})", "Підфункція: блокування за правилом Network Security (слот {n})");
m("stats_sub_ds_slot", "Подфункция: блок телеметрии по слоту {n}", "Sub-function: telemetry block for slot {n}", "Підфункція: блок телеметрії за слотом {n}");
m("stats_sub_pp_slot", "Подфункция: Privacy pack — блок по слоту {n}", "Sub-function: Privacy pack — block for slot {n}", "Підфункція: Privacy pack — блок за слотом {n}");
m("stats_sub_rule", "Подфункция: срабатывание правила DNR id={id}", "Sub-function: DNR rule fired id={id}", "Підфункція: спрацювання правила DNR id={id}");

// —— Accessibility ——
m("panel_a11y_h", "Доступность", "Accessibility", "Доступність");
m(
  "panel_a11y_desc",
  "Настройки интерфейса страницы настроек и всплывающего окна расширения. Системная опция ОС «Показывать анимации» / Reduce motion также учитывается браузером автоматически.",
  "Interface settings for the options page and the extension popup. The OS “Reduce motion” preference is also respected by the browser automatically.",
  "Налаштування інтерфейсу сторінки налаштувань і спливаючого вікна розширення. Системну опцію ОС «Показувати анімації» / Reduce motion браузер також враховує автоматично."
);
m("a11y_reduce", "Снижение анимаций", "Reduce animations", "Зменшення анімацій");
m(
  "a11y_reduce_secondary",
  "Отключает анимации переходов и делает интерфейс более сдержанным (стекло и переключатели без плавности)",
  "Disables transition animations and makes the UI calmer (glass and toggles without easing)",
  "Вимикає анімації переходів і робить інтерфейс стриманішим (скло та перемикачі без плавності)"
);

// —— Popup ——
m("popup_title", "Быстрые действия", "Quick actions", "Швидкі дії");
m("popup_ext", "Расширение", "Extension", "Розширення");
m("popup_ext_sub", "Все модули сразу", "All modules at once", "Усі модулі одразу");
m("popup_focus", "Focus Blocker", "Focus Blocker", "Focus Blocker");
m("popup_focus_sub", "События фокуса и видимости вкладки", "Focus and tab visibility events", "Події фокусу та видимості вкладки");
m("popup_sec", "Анти‑фингерпринт", "Anti-fingerprint", "Анти‑фінгерпринт");
m("popup_sec_sub", "Подмена screen/WebGL/Canvas и др.", "Spoof screen/WebGL/Canvas and more", "Підміна screen/WebGL/Canvas тощо");
m("popup_net", "Network Security", "Network Security", "Network Security");
m("popup_net_sub", "Локальные адреса, WebRTC…", "Local addresses, WebRTC…", "Локальні адреси, WebRTC…");
m("popup_host", "Текущий сайт:", "Current site:", "Поточний сайт:");
m("popup_pause", "Временно отключить на этой вкладке", "Temporarily disable on this tab", "Тимчасово вимкнути на цій вкладці");
m("popup_unpause", "Снять паузу на этой вкладке", "Resume on this tab", "Зняти паузу на цій вкладці");
m("popup_exclude", "Добавить сайт в исключения", "Add site to exclusions", "Додати сайт до виключень");
m("popup_open_options", "Все настройки…", "All settings…", "Усі налаштування…");
m("popup_hint_non_http", "Откройте вкладку с адресом http или https.", "Open a tab with an http or https address.", "Відкрийте вкладку з адресою http або https.");
m(
  "popup_hint_excluded",
  "Сайт уже в списке исключений (настройки → исключённые домены).",
  "Site is already in the exclusion list (settings → excluded domains).",
  "Сайт уже в списку виключень (налаштування → виключені домени)."
);
m(
  "popup_hint_paused",
  "На этой вкладке всё отключено до перехода по другому URL или закрытия вкладки.",
  "Everything is off on this tab until you navigate to another URL or close the tab.",
  "На цій вкладці все вимкнено до переходу за іншим URL або закриття вкладки."
);
m(
  "popup_hint_ok",
  "Пауза только для этой вкладки; после смены страницы действие расширения снова как в настройках.",
  "Pause is only for this tab; after navigation the extension follows settings again.",
  "Пауза лише для цієї вкладки; після зміни сторінки дія розширення знову як у налаштуваннях."
);
m("popup_exclude_fail", "Не удалось добавить в исключения. Попробуйте ещё раз.", "Could not add to exclusions. Try again.", "Не вдалося додати до виключень. Спробуйте ще раз.");

const out = `/* Auto-generated by tools/gen-i18n.mjs — edit that file and re-run to update catalogs. */
(function (global) {
  "use strict";

  var DEFAULT_UI_LANG = "ru";
  var UI_LANGS = ["ru", "en", "uk"];

  var MESSAGES = ${JSON.stringify(catalogs, null, 2)};

  var currentLang = DEFAULT_UI_LANG;

  function normalizeUiLang(v) {
    var s = String(v == null ? "" : v)
      .trim()
      .toLowerCase();
    if (s === "en" || s === "uk" || s === "ru") return s;
    return DEFAULT_UI_LANG;
  }

  function getUiLang() {
    return currentLang;
  }

  function t(key, vars) {
    var dict = MESSAGES[currentLang] || MESSAGES.ru;
    var s = dict[key];
    if (s == null && MESSAGES.ru) s = MESSAGES.ru[key];
    if (s == null) s = key;
    if (vars && typeof vars === "object") {
      Object.keys(vars).forEach(function (k) {
        s = String(s).split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function applyDomI18n(root) {
    var scope = root && root.querySelectorAll ? root : typeof document !== "undefined" ? document : null;
    if (!scope || !scope.querySelectorAll) return;
    var doc = scope.ownerDocument || (typeof document !== "undefined" ? document : null);

    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = t(key);
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", t(key));
    });
    scope.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria-label");
      if (!key) return;
      el.setAttribute("aria-label", t(key));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      if (!key) return;
      el.setAttribute("title", t(key));
    });

    if (doc && doc.documentElement) {
      doc.documentElement.setAttribute("lang", currentLang === "uk" ? "uk" : currentLang);
    }
    if (doc && doc.title != null) {
      var titleKey = doc.body && doc.body.getAttribute("data-i18n-doc-title");
      if (titleKey) doc.title = t(titleKey);
    }
  }

  function setUiLang(lang, root) {
    currentLang = normalizeUiLang(lang);
    applyDomI18n(root || (typeof document !== "undefined" ? document : null));
    return currentLang;
  }

  var api = {
    DEFAULT_UI_LANG: DEFAULT_UI_LANG,
    UI_LANGS: UI_LANGS,
    MESSAGES: MESSAGES,
    normalizeUiLang: normalizeUiLang,
    getUiLang: getUiLang,
    t: t,
    applyDomI18n: applyDomI18n,
    setUiLang: setUiLang,
  };

  try {
    global.FbI18n = api;
  } catch (_e) {}
  try {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
  } catch (_e2) {}
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
`;

fs.writeFileSync(path.join(root, "src", "i18n.js"), out, "utf8");
console.log("Wrote src/i18n.js with", Object.keys(catalogs.ru).length, "keys");
