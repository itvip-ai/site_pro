/*
 * QGROUP selection cart.
 *
 * A lightweight, client-side "подборка": the user adds catalog products to a
 * cart (persisted in localStorage), opens the drawer, and clicks "Создать КП"
 * to jump into the КП builder with those items pre-loaded. It is NOT a shop
 * cart — no stock/orders/payment — just a bridge from catalog → КП.
 *
 * The КП builder reads the same localStorage key after its catalog loads and
 * matches items by `code` (authoritative price/name/description come from the
 * live catalog there, so the stored snapshot is only for the drawer display).
 */
(function () {
  var KEY = 'qgroup_cart_v1';
  var lang = (document.documentElement.lang || 'ru').toLowerCase().indexOf('ro') === 0 ? 'ro' : 'ru';

  var T = {
    ru: {
      title: 'Корзина для КП', empty: 'Корзина пуста. Добавьте товары из каталога.',
      qty: 'Кол-во', total: 'Позиций', clear: 'Очистить', create: 'Создать КП →',
      remove: 'Убрать', added: '✓ В корзине', add: '+ В корзину', close: 'Закрыть',
    },
    ro: {
      title: 'Coș pentru ofertă', empty: 'Coșul este gol. Adăugați produse din catalog.',
      qty: 'Cant.', total: 'Poziții', clear: 'Golește', create: 'Creează oferta →',
      remove: 'Elimină', added: '✓ În coș', add: '+ În coș', close: 'Închide',
    },
  }[lang];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(c) { localStorage.setItem(KEY, JSON.stringify(c)); }
  var cart = load();

  function count() { return cart.reduce(function (n, i) { return n + (Number(i.qty) || 1); }, 0); }

  function add(item) {
    var ex = cart.filter(function (i) { return i.code === item.code; })[0];
    if (ex) ex.qty = (Number(ex.qty) || 1) + 1;
    else cart.push({ code: item.code, name: item.name, price: item.price, img: item.img || '', qty: 1 });
    save(cart); refresh();
  }
  function setQty(code, q) {
    var ex = cart.filter(function (i) { return i.code === code; })[0];
    if (!ex) return;
    ex.qty = Math.max(1, Number(q) || 1);
    save(cart); refresh();
  }
  function remove(code) {
    cart = cart.filter(function (i) { return i.code !== code; });
    save(cart); refresh();
  }
  function clear() { cart = []; save(cart); refresh(); }

  // ── DOM ────────────────────────────────────────────────────────────────
  var root = document.getElementById('cart-root');
  if (!root) return; // cart not enabled for this role / page

  var kpUrl = root.getAttribute('data-kp-url') || '/kp/general?fromCart=1';

  var overlay = document.createElement('div');
  overlay.className = 'cart-overlay';
  overlay.innerHTML =
    '<aside class="cart-panel" role="dialog" aria-label="' + T.title + '">' +
      '<div class="cart-panel__head"><strong>' + T.title + '</strong>' +
        '<button type="button" class="cart-x" aria-label="' + T.close + '">×</button></div>' +
      '<div class="cart-panel__body" id="cart-items"></div>' +
      '<div class="cart-panel__foot">' +
        '<div class="cart-foot__row"><span>' + T.total + ':</span><b id="cart-total">0</b></div>' +
        '<button type="button" class="btn btn--ghost btn--sm btn--block" id="cart-clear">' + T.clear + '</button>' +
        '<button type="button" class="btn btn--primary btn--block" id="cart-create">' + T.create + '</button>' +
      '</div>' +
    '</aside>';
  document.body.appendChild(overlay);

  var itemsEl = overlay.querySelector('#cart-items');
  var totalEl = overlay.querySelector('#cart-total');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function renderDrawer() {
    if (!cart.length) { itemsEl.innerHTML = '<div class="cart-empty">' + T.empty + '</div>'; return; }
    itemsEl.innerHTML = cart.map(function (i) {
      return '<div class="cart-item" data-code="' + esc(i.code) + '">' +
        (i.img ? '<img class="cart-item__img" src="' + esc(i.img) + '" loading="lazy">' : '<div class="cart-item__img cart-item__img--none"></div>') +
        '<div class="cart-item__main">' +
          '<div class="cart-item__name">' + esc(i.name) + '</div>' +
          '<div class="cart-item__meta"><span class="mono">' + esc(i.code) + '</span>' +
            (i.price != null && i.price !== '' ? ' · $' + esc(i.price) : '') + '</div>' +
          '<div class="cart-item__ctl">' +
            '<button type="button" class="cart-step" data-act="dec">−</button>' +
            '<input class="cart-qty" type="text" inputmode="numeric" value="' + esc(i.qty) + '">' +
            '<button type="button" class="cart-step" data-act="inc">+</button>' +
            '<button type="button" class="cart-rm" data-act="rm">' + T.remove + '</button>' +
          '</div>' +
        '</div></div>';
    }).join('');
  }

  function refresh() {
    var n = count();
    document.querySelectorAll('.cart-count').forEach(function (b) {
      b.textContent = n; b.style.display = n ? '' : 'none';
    });
    if (totalEl) totalEl.textContent = n;
    renderDrawer();
  }

  function open() { renderDrawer(); overlay.classList.add('is-open'); }
  function close() { overlay.classList.remove('is-open'); }

  // Cart toggle button(s) in the header.
  document.querySelectorAll('.cart-toggle').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); open(); });
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
    if (e.target.closest('.cart-x')) close();
  });
  overlay.querySelector('#cart-clear').addEventListener('click', clear);
  overlay.querySelector('#cart-create').addEventListener('click', function () {
    if (!cart.length) return;
    window.location.href = kpUrl;
  });

  // Item controls (delegated).
  itemsEl.addEventListener('click', function (e) {
    var row = e.target.closest('.cart-item'); if (!row) return;
    var code = row.getAttribute('data-code');
    var act = e.target.getAttribute('data-act');
    if (act === 'rm') remove(code);
    else if (act === 'inc') setQty(code, (cart.filter(function (i) { return i.code === code; })[0].qty || 1) + 1);
    else if (act === 'dec') setQty(code, (cart.filter(function (i) { return i.code === code; })[0].qty || 1) - 1);
  });
  itemsEl.addEventListener('change', function (e) {
    if (!e.target.classList.contains('cart-qty')) return;
    var row = e.target.closest('.cart-item');
    setQty(row.getAttribute('data-code'), e.target.value);
  });

  // Add-to-cart buttons across catalog/product pages (delegated on document).
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.add-to-cart'); if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    add({
      code: btn.getAttribute('data-code'),
      name: btn.getAttribute('data-name'),
      price: btn.getAttribute('data-price'),
      img: btn.getAttribute('data-img'),
    });
    var orig = btn.getAttribute('data-label') || btn.textContent;
    btn.textContent = T.added; btn.classList.add('is-added');
    setTimeout(function () { btn.textContent = orig; btn.classList.remove('is-added'); }, 1100);
  });

  refresh();
})();
