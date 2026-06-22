import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Product } from '../models/product.js';
import { User } from '../models/user.js';
import { KP, LED_CATEGORIES } from '../models/kp.js';
import { Log } from '../models/log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILDERS_DIR = path.join(__dirname, '..', '..', 'kp-builders');

// ── Builder catalogue: which file + access rule per route key.
// general-mobile falls back to the desktop file (its source was corrupted).
export const BUILDERS = {
  general: { file: 'general.html', variant: 'general', group: 'general' },
  'general-mobile': { file: 'general.html', variant: 'general', group: 'general' },
  led: { file: 'led.html', variant: 'led', group: 'led' },
  'led-mobile': { file: 'led-mobile.html', variant: 'led', group: 'led' },
  partner: { file: 'partner.html', variant: 'partner', group: 'partner' },
  'partner-mobile': { file: 'partner-mobile.html', variant: 'partner', group: 'partner' },
};

/** Map the site user to the KP-style context the builders expect. */
export function kpContext(req) {
  const u = req.user;
  if (!u) return { email: '', allowed: false, role: 'guest', name: '', company: '', dept: '' };
  // Site roles → KP roles. Only 'sales' acts as KP staff; 'manager' is
  // catalog-only and has no builder access (separation requested by the client).
  const role =
    u.role === 'admin' ? 'admin'
    : u.role === 'partner' ? 'partner'
    : u.role === 'sales' ? 'staff'
    : 'none';
  return {
    email: (u.login || '').toLowerCase(),
    allowed: true,
    role, // admin | staff | partner  (as in the original Apps Script)
    name: u.display_name || u.login,
    company: u.company || '',
    dept: u.department || '',
    ledAccess: !!u.led_access,
    siteRole: u.role,
  };
}

/** Can this context access a builder group (general/led/partner)? */
export function canAccessGroup(ctx, group) {
  if (ctx.role === 'admin') return true;
  if (group === 'partner') return ctx.role === 'partner';
  if (group === 'led') return ctx.role === 'staff' && ctx.ledAccess;
  return ctx.role === 'staff'; // general
}

// ── Catalog (from the existing product catalog) ────────────────────────────
// Name/description are localized to `lang` (RO uses the translated fields with
// a fallback to the Russian original), so Romanian proposals get Romanian text.
function toCatalogItem(p, lang) {
  const ro = lang === 'ro';
  return {
    code: String(p.code),
    name: ro && p.name_ro ? p.name_ro : p.name,
    price: Number(p.price_retail) || 0,
    category: String(p.category || 'Прочее'),
    desc: ro && p.description_ro ? p.description_ro : String(p.description || ''),
    img: p.image_path || p.thumb_path || '',
    thumb: p.thumb_path || p.image_path || '',
  };
}

// The builder passes its own language ('RU'/'RO'); fall back to the site cookie.
function pickLang(explicit, cookieLang) {
  const v = String(explicit || cookieLang || 'ru').toLowerCase();
  return v.startsWith('ro') ? 'ro' : 'ru';
}

function getCatalog(lang) {
  const { rows } = Product.list({ limit: 100000, offset: 0 });
  return rows
    .filter((p) => p.price_retail != null && Number(p.price_retail) > 0)
    .map((p) => toCatalogItem(p, lang));
}

function getCatalogLED(lang) {
  return getCatalog(lang).filter((it) => LED_CATEGORIES.indexOf(String(it.category).trim()) >= 0);
}

// ── Managers (from staff user accounts) ────────────────────────────────────
function toManagerCard(u, idx) {
  const name = u.display_name || u.login;
  const init = String(name).split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  return {
    id: idx,
    name,
    role: u.department || '',
    ph: u.phone || '',
    em: (u.login || '').toLowerCase(),
    color: u.color || '#0E411F',
    init,
  };
}

function getManagers() {
  return User.staffCards().map(toManagerCard);
}

function getMyManager(ctx) {
  return getManagers().find((m) => m.em === ctx.email) || null;
}

// ── API dispatch ───────────────────────────────────────────────────────────
// Mirrors the Apps Script server functions 1:1 so the builders work unchanged.
export function api(req, res) {
  const fn = req.params.fn;
  const args = Array.isArray(req.body?.args) ? req.body.args : [];
  const ctx = kpContext(req);
  if (!ctx.allowed) {
    Log.kp('denied', ctx, { detail: fn });
    return res.json({ __error: 'Нет доступа' });
  }

  const needGroup = (group, run) => {
    if (!canAccessGroup(ctx, group)) {
      Log.kp('denied', ctx, { variant: group, detail: fn });
      return res.json({ __error: 'Недостаточно прав' });
    }
    return res.json(run());
  };

  // Save with create/update audit logging.
  const saveKP = (variant) =>
    needGroup(variant, () => {
      const r = KP.save(variant, args[0] || {}, ctx);
      Log.kp(r.created ? 'create' : 'update', ctx, {
        variant, num: r.num, client_name: r.client_name, total: r.total,
      });
      return r;
    });

  // Delete with audit logging (delete on success, error on failure).
  const deleteKP = (variant) =>
    needGroup(variant, () => {
      const r = KP.remove(variant, args[0], ctx);
      if (r.success) {
        Log.kp('delete', ctx, { variant, num: r.num, client_name: r.client_name, total: r.total });
      } else {
        Log.kp('error', ctx, { variant, num: args[0], detail: r.error });
      }
      return r;
    });

  switch (fn) {
    case 'getCurrentUserContext':
      return res.json(ctx);
    case 'getCatalogFromSheet':
      return res.json(getCatalog(pickLang(args[0], req.lang)));
    case 'getCatalogLED':
      return res.json(getCatalogLED(pickLang(args[0], req.lang)));
    case 'getManagers':
      return res.json(getManagers());
    case 'getMyManagerByEmail':
      return res.json(getMyManager(ctx));

    // General builder
    case 'saveKP':
      return saveKP('general');
    case 'getKPs':
      return needGroup('general', () => KP.list('general', ctx));
    case 'deleteKP':
      return deleteKP('general');

    // LED builder
    case 'saveKP_LED':
      return saveKP('led');
    case 'getKPs_LED':
      return needGroup('led', () => KP.list('led', ctx));
    case 'deleteKP_LED':
      return deleteKP('led');

    // Partner builder
    case 'saveKP_Partner':
      return saveKP('partner');
    case 'getKPs_Partner':
      return needGroup('partner', () => KP.list('partner', ctx));
    case 'deleteKP_Partner':
      return deleteKP('partner');

    case 'generatePDFFromHtml':
      // PDF is produced client-side via print() in the shim; safe fallback here.
      return res.json({ success: false, error: 'Используйте печать браузера' });

    default:
      Log.kp('error', ctx, { detail: 'Неизвестная функция: ' + fn });
      return res.json({ __error: 'Неизвестная функция: ' + fn });
  }
}

// ── Serve a builder page (inject the shim, relax CSP for inline scripts) ────
const cache = new Map();
function loadBuilder(file) {
  if (cache.has(file)) return cache.get(file);
  let html = fs.readFileSync(path.join(BUILDERS_DIR, file), 'utf8');
  const inject = '<script src="/js/gas-shim.js"></script>\n<script src="/js/kp-i18n.js"></script>';
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + '\n' + inject);
  else html = inject + html;
  cache.set(file, html);
  return html;
}

export function serveBuilder(key) {
  return (req, res) => {
    const def = BUILDERS[key];
    if (!def) return res.status(404).render('error', { title: 'KP', code: 404, message: 'Not found' });
    const ctx = kpContext(req);
    const device = key.endsWith('-mobile') ? 'mobile' : 'desktop';
    if (!canAccessGroup(ctx, def.group)) {
      Log.kp('denied', ctx, { variant: def.variant, device, detail: 'open ' + key });
      return res.status(403).render('error', {
        title: req.t('error.403.title'),
        code: 403,
        message: req.t('kp.noAccess'),
      });
    }
    Log.kp('open', ctx, { variant: def.variant, device });
    // The builders use inline scripts and inline event handlers — allow them
    // for these trusted internal pages only.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self'"
    );
    // Tell the builder which language to open in (matches the site switch).
    const langScript = `<script>window.__SITE_LANG__=${JSON.stringify((req.lang || 'ru').toUpperCase())};</script>`;
    const html = loadBuilder(def.file).replace('</head>', langScript + '</head>');
    res.type('html').send(html);
  };
}
