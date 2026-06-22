/*
 * КП builder UI localizer.
 *
 * The builders' editing interface (buttons, field labels, placeholders, section
 * titles, units, object types …) is hardcoded in Russian. This layer translates
 * those static strings to Romanian when the builder's RU/RO switch is set to RO,
 * and restores Russian when switched back.
 *
 * It only touches text that EXACTLY matches the dictionary, so product names,
 * user-entered values and the (already bilingual) КП preview are left untouched.
 */
(function () {
  var DICT = {
    // Top bar / actions
    'Конструктор КП': 'Constructor ofertă',
    'Синхронизировать': 'Sincronizează', 'Синхр.': 'Sincr.', 'Синхронизация прайса...': 'Sincronizare preț...',
    'Новое': 'Nou', 'Новое предложение': 'Ofertă nouă',
    'Сохранить': 'Salvează', 'Сохранить КП': 'Salvează oferta', 'Сохр.': 'Salv.',
    'Превью': 'Previzualizare', 'Скачать PDF': 'Descarcă PDF',
    'Печать через браузер': 'Printare prin browser',
    'Копир.': 'Copiază', 'Копировать': 'Copiază', 'Открыть': 'Deschide', 'Удалить': 'Șterge',
    'Загрузка...': 'Se încarcă...', 'Сохраняем...': 'Se salvează...', 'Генерируем PDF...': 'Se generează PDF...',
    // Tabs / sections
    'Клиент и объект': 'Client și obiect', 'Клиент и Объект': 'Client și obiect',
    'Боли': 'Probleme', 'Боли клиента': 'Problemele clientului',
    'Кейсы': 'Cazuri', 'Решение': 'Soluție',
    'Позиции': 'Poziții', 'Товары': 'Produse', 'Товары в КП': 'Produse în ofertă',
    'Товары и оборудование': 'Produse și echipamente',
    'Каталог товаров': 'Catalog de produse', 'База': 'Bază',
    'Работы и услуги': 'Lucrări și servicii', 'Стоимость работ и услуг': 'Costul lucrărilor și serviciilor',
    'Что включено в цену': 'Ce include prețul',
    'Условия': 'Condiții', 'Условия оплаты': 'Condiții de plată', 'Примечание': 'Notă',
    'Итого': 'Total', 'Итого и условия': 'Total și condiții', 'Итого:': 'Total:', 'Итого $': 'Total $',
    'Итого со скидкой': 'Total cu reducere', 'Итого без НДС': 'Total fără TVA',
    'Реализованные проекты': 'Proiecte realizate', 'Реализованные проекты QGROUP': 'Proiecte realizate QGROUP',
    'Сохранённые КП': 'Oferte salvate', 'Сохранённые:': 'Salvate:',
    'Сохранённых КП пока нет': 'Nu există oferte salvate', 'Нет КП.': 'Nicio ofertă.',
    // Client / object fields
    'Тип объекта': 'Tip obiect', 'Название компании': 'Denumirea companiei',
    'Компания (необязательно)': 'Companie (opțional)', 'Компания': 'Companie',
    'ФИО клиента': 'Numele clientului', 'Имя': 'Nume', 'Имя клиента': 'Numele clientului',
    'Телефон': 'Telefon', 'Адрес': 'Adresă', 'Адрес объекта': 'Adresa obiectului',
    'Введите адрес': 'Introduceți adresa', 'Регион': 'Regiune',
    'Должность / Отдел': 'Funcție / Departament',
    'Менеджер': 'Manager', 'Выбрать менеджера': 'Alege managerul',
    // Object types
    'Торговый центр': 'Centru comercial', 'Квартира': 'Apartament', 'Частный дом': 'Casă privată',
    'Офис': 'Birou', 'Дача': 'Casă de țară', 'Магазин': 'Magazin', 'Склад': 'Depozit',
    'Бизнес-центр': 'Centru de afaceri', 'Завод / Производство': 'Fabrică / Producție',
    'Школа / Лицей': 'Școală / Liceu', 'Детский сад': 'Grădiniță',
    'Госучреждение': 'Instituție publică', 'Больница / Клиника': 'Spital / Clinică',
    // Table headers
    'Наименование': 'Denumire', 'Артикул': 'Cod', 'Модель': 'Model', 'Название': 'Denumire',
    'Кол.': 'Cant.', 'Кол': 'Cant.', 'Ед.': 'Un.', 'Цена': 'Preț', 'Цена $': 'Preț $',
    'Скидка': 'Reducere', 'Скидка %': 'Reducere %', 'Скидка%': 'Reducere%',
    'Сумма': 'Total', 'Сумма $': 'Total $',
    'Общая скидка %': 'Reducere generală %', 'Общая скидка клиенту:': 'Reducere generală client:',
    'Без скидки': 'Fără reducere', 'Без скидки:': 'Fără reducere:',
    // Units
    'шт.': 'buc.', 'компл.': 'set', 'комп.': 'set', 'услуга': 'serviciu', 'час': 'oră', 'день': 'zi', 'м': 'm',
    // Add buttons
    '+ Добавить позицию': '+ Adaugă poziție', '+ Добавить работу': '+ Adaugă lucrare',
    '+ добавить работу': '+ adaugă lucrare', '+ добавить строку вручную': '+ adaugă rând manual',
    '+ описание': '+ descriere',
    // LED params
    'Параметры LED-экрана': 'Parametrii ecranului LED', 'Технические параметры LED-экрана': 'Parametrii tehnici LED',
    'Площадь экрана': 'Suprafața ecranului', 'Потребл. мощность': 'Consum energie',
    'Раб. температура': 'Temp. de lucru', 'Рабочая температура': 'Temperatura de lucru',
    'Размер (мм)': 'Dimensiune (mm)', 'Угол обзора': 'Unghi de vizualizare',
    'Частота обновл.': 'Rată reîmprospătare', 'Частота обновления': 'Rata de reîmprospătare',
    'Шаг пикселя': 'Pas pixel', 'Яркость': 'Luminozitate',
    // Statuses / KP types
    'Статус': 'Status', 'Статус КП': 'Status ofertă',
    'Черновик': 'Ciornă', 'Отправлено': 'Trimisă', 'Принято': 'Acceptată',
    'Отклонено': 'Respinsă', 'Отказ': 'Refuz', 'В работе': 'În lucru', 'Дата': 'Data', 'Тип': 'Tip',
    'Новый клиент': 'Client nou', 'Постоянный клиент': 'Client permanent', 'Постоянный': 'Permanent',
    'Нужно убедить — кейсы, ценность': 'Trebuie convins — cazuri, valoare',
    'Только позиции и итоговая сумма': 'Doar poziții și suma totală',
    // Hints / placeholders
    'Выбери проекты, которые покажешь клиенту в КП.': 'Alege proiectele pe care le arăți clientului în ofertă.',
    'Отметь нужные пункты, текст можно редактировать.': 'Bifează punctele necesare, textul poate fi editat.',
    'Каталог пуст. Нажми «🔄 Синхр.» для загрузки.': 'Catalogul e gol. Apasă «🔄 Sincr.» pentru încărcare.',
    'Название пункта': 'Denumirea punctului', 'Описание пункта': 'Descrierea punctului',
    'Наименование работы': 'Denumirea lucrării', 'Например: Монтаж камер': 'De ex.: Montaj camere',
    'Описание товара': 'Descrierea produsului',
    'Описание товара (показывается в КП если открыто)': 'Descrierea produsului (apare în ofertă dacă e deschisă)',
    'Например: переживает за сохранность документов в офисе, нужна интеграция с 1С...':
      'De ex.: este îngrijorat de securitatea documentelor în birou, necesită integrare cu 1C...',
    '🔍 Поиск по названию или артикулу...': '🔍 Căutare după denumire sau cod...',
    'Поиск по названию или артикулу...': 'Căutare după denumire sau cod...',
    'Поиск...': 'Căutare...',
    // Builder titles (logo)
    'Партнёрский конструктор': 'Constructor parteneri',
    'LED Конструктор': 'Constructor LED',
    // Section hints (.cs — leading "— " is stripped before lookup)
    'войдут в текст КП': 'vor intra în textul ofertei',
    'выберите подходящие для клиента': 'alegeți cele potrivite pentru client',
    'по отделам': 'pe departamente',
    'реальный прайс QGROUP ·': 'preț real QGROUP ·',
    'для позиций без индивидуальной скидки': 'pentru pozițiile fără reducere individuală',
    'монтаж, прокладка, пусконаладка': 'montaj, cablare, punere în funcțiune',
    // Field labels (full, emoji prefix stripped before lookup)
    'Регион (определит контакты офиса в КП)': 'Regiune (stabilește contactele biroului în ofertă)',
    'Другая проблема клиента (своими словами)': 'Altă problemă a clientului (în cuvinte proprii)',
    'Действие цен': 'Valabilitatea prețurilor',
    'Конфиденциальность': 'Confidențialitate',
    'Гарантия': 'Garanție',
    'Срок выполнения': 'Termen de execuție',
    'Что включено в цену (отметь нужные пункты, можно редактировать)':
      'Ce include prețul (bifează punctele necesare, se poate edita)',
    'Описание будет включено в КП клиенту. Можешь редактировать.':
      'Descrierea va fi inclusă în oferta clientului. Poți edita.',
    // List view (Toate) header
    'Клиент': 'Client',
    // Category strip ::after + dynamic JS-set counters/toasts
    'Товары выбранной категории': 'Produse din categoria selectată',
    'товары': 'produse',
    'стандартный каталог': 'catalog standard',
    'загрузка...': 'se încarcă...',
    'Прочее': 'Altele',
    'Синхронизация...': 'Sincronizare...',
    // Default input values (translated on switch to RO only while still unchanged)
    '3–7 рабочих дней': '3–7 zile lucrătoare',
    '50% предоплата, 50% при сдаче': '50% avans, 50% la predare',
    '48 часов': '48 ore',
    'Конфиденциально': 'Confidențial',
    'Гарантия Hikvision 3 года': 'Garanție Hikvision 3 ani',
    'Данное предложение конфиденциально и предназначено исключительно для указанного клиента. Цены действительны 48 часов с момента передачи КП.':
      'Această ofertă este confidențială și destinată exclusiv clientului indicat. Prețurile sunt valabile 48 de ore din momentul transmiterii ofertei.',
    // LED params section heading + spec placeholders
    'Параметры LED-экрана (попадут в КП)': 'Parametrii ecranului LED (vor intra în ofertă)',
    '2,5 мм': '2,5 mm',
    '829 Вт/ч (max 1.9 кВт)': '829 W/h (max 1.9 kW)',
    '829 Вт/ч': '829 W/h',
    '-10° до 40°': '-10° până la 40°',
    '4,61 м²': '4,61 m²',
    // Mobile header / misc labels
    'сменить': 'schimbă',
    'Срок исполнения': 'Termen de execuție',
    'Партнёрский · Новое': 'Parteneri · Nou',
    '3–7 дней': '3–7 zile',
    // Sample placeholders (client name / company)
    'Андрей Попеску': 'Andrei Popescu',
    'SRL Burcovschi (опционально)': 'SRL Burcovschi (opțional)',
    // Toast messages (set via #toast textContent → caught by the MutationObserver).
    // Only the fixed-text toasts; ones with appended counts/names can't exact-match.
    'КП сохранено!': 'Oferta a fost salvată!',
    'Ошибка': 'Eroare',
    'Удалено': 'Șters',
    'Заполни клиента': 'Completează clientul',
    'Новое КП': 'Ofertă nouă',
    'PDF готов': 'PDF gata',
    'Скопировано': 'Copiat',
    'Не удалось': 'Nu a reușit',
  };

  var origText = new WeakMap(); // textNode -> original RU
  var origPh = new WeakMap();   // element  -> original RU placeholder
  var origVal = new WeakMap();  // element  -> { orig, ro } for default input values

  // Split a leading emoji/symbol/space prefix from the meaningful text so one
  // dictionary entry covers both "Тип объекта" and "🏠 Тип объекта".
  function splitPrefix(s) {
    var m = s.match(/^([^A-Za-zА-Яа-яЁё0-9]+)?([\s\S]*)$/);
    var pre = (m && m[1]) || '';
    var coreFull = (m && m[2]) || s;
    var coreTrim = coreFull.replace(/\s+$/, '');
    var post = coreFull.slice(coreTrim.length);
    return { pre: pre, core: coreTrim, post: post };
  }

  function toROString(trimmed) {
    if (DICT[trimmed]) return DICT[trimmed];
    var p = splitPrefix(trimmed);
    if (p.core && DICT[p.core]) return p.pre + DICT[p.core] + p.post;
    // Dynamic catalog counter: "2128 позиций · 35 категорий"
    var m = trimmed.match(/^(\d+)\s+позиций\s+·\s+(\d+)\s+категорий$/);
    if (m) return m[1] + ' poziții · ' + m[2] + ' categorii';
    return null;
  }

  function inPreview(node) {
    var el = node.nodeType === 1 ? node : node.parentNode;
    while (el) {
      if (el.id === 'pv-wrap') return true;
      el = el.parentNode;
    }
    return false;
  }

  function handleTextNode(tn, toRO) {
    if (toRO) {
      if (origText.has(tn)) return; // already translated
      var raw = tn.nodeValue;
      if (!raw || !/[А-Яа-яЁё]/.test(raw)) return;
      var lead = raw.match(/^\s*/)[0];
      var tail = raw.match(/\s*$/)[0];
      var trimmed = raw.slice(lead.length, raw.length - tail.length);
      var ro = toROString(trimmed);
      if (ro != null) {
        origText.set(tn, raw);
        tn.nodeValue = lead + ro + tail;
      }
    } else if (origText.has(tn)) {
      tn.nodeValue = origText.get(tn);
      origText.delete(tn);
    }
  }

  function handlePlaceholder(el, toRO) {
    if (toRO) {
      if (origPh.has(el)) return;
      var ph = el.getAttribute('placeholder');
      if (!ph || !/[А-Яа-яЁё]/.test(ph)) return;
      var ro = toROString(ph.trim());
      if (ro != null) {
        origPh.set(el, ph);
        el.setAttribute('placeholder', ro);
      }
    } else if (origPh.has(el)) {
      el.setAttribute('placeholder', origPh.get(el));
      origPh.delete(el);
    }
  }

  // Translate default values of free-text inputs/textareas (e.g. "48 часов").
  // Only touches values that EXACTLY match the dictionary, and on switch-back
  // restores the original only if the user has not edited it since.
  function handleValue(el, toRO) {
    var tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
    if (tag === 'INPUT') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t !== 'text' && t !== 'search' && t !== 'tel' && t !== 'email' && t !== 'url') return;
    }
    if (toRO) {
      if (origVal.has(el)) return;
      var v = el.value;
      if (!v || !/[А-Яа-яЁё]/.test(v)) return;
      var ro = toROString(v.trim());
      if (ro != null && ro !== v.trim()) {
        origVal.set(el, { orig: v, ro: ro });
        el.value = ro;
      }
    } else if (origVal.has(el)) {
      var rec = origVal.get(el);
      if (el.value === rec.ro) el.value = rec.orig; // untouched → restore
      origVal.delete(el);
    }
  }

  function walk(root, toRO) {
    if (!root) return;
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (inPreview(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = tw.nextNode())) handleTextNode(n, toRO);

    var ph = root.querySelectorAll ? root.querySelectorAll('[placeholder]') : [];
    for (var i = 0; i < ph.length; i++) {
      if (!inPreview(ph[i])) handlePlaceholder(ph[i], toRO);
    }

    var inp = root.querySelectorAll ? root.querySelectorAll('input, textarea') : [];
    for (var j = 0; j < inp.length; j++) {
      if (!inPreview(inp[j])) handleValue(inp[j], toRO);
    }
  }

  // The category strip caption lives in CSS (`.cat-row::after{content:…}`) so the
  // text walker can't reach it. Inject a RO override scoped to a body class; read
  // the original caption from the live ::after so it works for both the desktop
  // ("Товары выбранной категории") and mobile ("товары") wording.
  var afterDone = false;
  function ensureAfterStyle() {
    if (afterDone) return;
    var cr = document.querySelector('.cat-row');
    if (!cr) return; // not built yet — retry on next apply
    afterDone = true;
    var raw;
    try { raw = getComputedStyle(cr, '::after').content; } catch (e) { raw = ''; }
    if (!raw || raw === 'none' || raw === 'normal') return;
    raw = raw.replace(/^["']|["']$/g, '');
    var inner = raw.replace(/▾/g, '').trim();
    var ro = toROString(inner);
    if (!ro) return;
    var st = document.createElement('style');
    st.textContent = ".kp-lang-ro .cat-row::after{content:'▾ " + ro.replace(/'/g, "\\'") + " ▾'}";
    document.head.appendChild(st);
  }

  var current = false;
  function apply(toRO) {
    current = !!toRO;
    if (document.body) document.body.classList.toggle('kp-lang-ro', current);
    if (current) ensureAfterStyle();
    walk(document.body, current);
  }

  // Re-translate dynamically added nodes (rows, catalog items, etc.).
  function observe() {
    var mo = new MutationObserver(function (muts) {
      if (!current) return;
      muts.forEach(function (m) {
        for (var i = 0; i < m.addedNodes.length; i++) {
          var node = m.addedNodes[i];
          if (node.nodeType === 1) walk(node, true);
          else if (node.nodeType === 3) handleTextNode(node, true);
        }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  window.KP_I18N = { apply: apply, dict: DICT };

  // Wire into the builder after its own script has defined setLang / LANG.
  window.addEventListener('load', function () {
    var orig = window.setLang;
    if (typeof orig === 'function') {
      window.setLang = function (l) {
        orig.apply(this, arguments);
        apply(String(l).toUpperCase() === 'RO');
      };
    }
    // newKP() resets fields to their Russian defaults — re-translate afterwards.
    var origNewKP = window.newKP;
    if (typeof origNewKP === 'function') {
      window.newKP = function () {
        var r = origNewKP.apply(this, arguments);
        apply(current);
        return r;
      };
    }
    observe();
    apply(String(window.LANG || 'RU').toUpperCase() === 'RO');
  });
})();
