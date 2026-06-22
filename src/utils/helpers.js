import bcrypt from 'bcryptjs';

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);

/** Format a numeric price for display. Returns '' for null/undefined. */
export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parsePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(String(value).replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

export function paginate(page, limit, defaults = { page: 1, limit: 24, max: 100 }) {
  const p = Math.max(1, parseInt(page, 10) || defaults.page);
  const l = Math.min(defaults.max, Math.max(1, parseInt(limit, 10) || defaults.limit));
  return { page: p, limit: l, offset: (p - 1) * l };
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape HTML and convert newlines to <br> for safe rich-ish display. */
export function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

const ROLE_LABELS = { admin: 'Администратор', manager: 'Менеджер', partner: 'Партнёр' };
export const roleLabel = (role) => ROLE_LABELS[role] || role;

/** Build a filesystem-safe slug from a product code, for image filenames. */
export function safeSlug(input, fallback = 'img') {
  const slug = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}
