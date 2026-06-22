import { db } from '../config/db.js';

// Sentinel category for the virtual "New arrivals" group.
export const NEW_KEY = '__new__';

// Roles that are allowed to see the partner (dealer) price.
const PARTNER_PRICE_ROLES = new Set(['partner', 'manager', 'admin']);

/**
 * Strip the partner price from a product unless the viewer's role is allowed
 * to see it. This is the single choke point that keeps the dealer margin out
 * of any public response — controllers must route every product through here.
 */
export function serializeProduct(product, role) {
  if (!product) return product;
  if (PARTNER_PRICE_ROLES.has(role)) return product;
  const { price_partner, ...publicFields } = product;
  return publicFields;
}

export function serializeProducts(products, role) {
  return products.map((p) => serializeProduct(p, role));
}

export const Product = {
  /**
   * Filtered, paginated list of active products. `category` and `search`
   * are optional. Returns { rows, total } — total ignores pagination.
   */
  list({ category = null, search = null, limit = 24, offset = 0, includeInactive = false, sort = 'name' } = {}) {
    // Whitelisted sort orders (ORDER BY is interpolated, so never trust input).
    // NULL prices ("по запросу") always sort last regardless of direction.
    const SORTS = {
      name: 'name COLLATE NOCASE ASC',
      price_asc: 'price_retail IS NULL, price_retail ASC, name COLLATE NOCASE ASC',
      price_desc: 'price_retail IS NULL, price_retail DESC, name COLLATE NOCASE ASC',
      new: 'is_new DESC, name COLLATE NOCASE ASC',
    };
    const orderBy = SORTS[sort] || SORTS.name;
    const where = [];
    const params = {};
    if (!includeInactive) where.push('is_active = 1');
    if (category === NEW_KEY) {
      where.push('is_new = 1');
    } else if (category) {
      where.push('category = @category');
      params.category = category;
    }
    if (search) {
      where.push('(name LIKE @q OR name_ro LIKE @q OR code LIKE @q)');
      params.q = `%${search}%`;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM products ${whereSql}`)
      .get(params).c;

    const rows = db
      .prepare(
        `SELECT * FROM products ${whereSql}
         ORDER BY ${orderBy}
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset });

    return { rows, total };
  },

  getById(id, { includeInactive = false } = {}) {
    const sql = includeInactive
      ? 'SELECT * FROM products WHERE id = ?'
      : 'SELECT * FROM products WHERE id = ? AND is_active = 1';
    return db.prepare(sql).get(id);
  },

  getByCode(code) {
    return db.prepare('SELECT * FROM products WHERE code = ?').get(code);
  },

  categories() {
    const cats = db
      .prepare(
        `SELECT category, COUNT(*) AS count
         FROM products
         WHERE is_active = 1 AND category IS NOT NULL AND category <> ''
         GROUP BY category
         ORDER BY category COLLATE NOCASE ASC`
      )
      .all();
    // Prepend the virtual "New arrivals" category when there are new products.
    const newCount = db
      .prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 1 AND is_new = 1')
      .get().c;
    if (newCount > 0) cats.unshift({ category: NEW_KEY, count: newCount, isNew: true });
    return cats;
  },

  create(data, userId) {
    const info = db
      .prepare(
        `INSERT INTO products
           (code, name, name_ro, category, description, description_ro,
            price_retail, price_partner, image_path, thumb_path, is_active, is_new,
            created_by, updated_by)
         VALUES
           (@code, @name, @name_ro, @category, @description, @description_ro,
            @price_retail, @price_partner, @image_path, @thumb_path, @is_active, @is_new,
            @userId, @userId)`
      )
      .run({
        code: data.code,
        name: data.name,
        name_ro: data.name_ro ?? null,
        category: data.category ?? null,
        description: data.description ?? null,
        description_ro: data.description_ro ?? null,
        price_retail: data.price_retail ?? null,
        price_partner: data.price_partner ?? null,
        image_path: data.image_path ?? null,
        thumb_path: data.thumb_path ?? null,
        is_active: data.is_active ?? 1,
        is_new: data.is_new ?? 0,
        userId: userId ?? null,
      });
    return info.lastInsertRowid;
  },

  update(id, data, userId) {
    const current = this.getById(id, { includeInactive: true });
    if (!current) return { changes: 0 };
    const merged = { ...current, ...data };
    return db
      .prepare(
        `UPDATE products SET
           code = @code, name = @name, name_ro = @name_ro, category = @category,
           description = @description, description_ro = @description_ro,
           price_retail = @price_retail, price_partner = @price_partner,
           image_path = @image_path, thumb_path = @thumb_path, is_active = @is_active,
           is_new = @is_new, updated_at = datetime('now'), updated_by = @userId
         WHERE id = @id`
      )
      .run({
        id,
        code: merged.code,
        name: merged.name,
        name_ro: merged.name_ro ?? null,
        category: merged.category ?? null,
        description: merged.description ?? null,
        description_ro: merged.description_ro ?? null,
        price_retail: merged.price_retail ?? null,
        price_partner: merged.price_partner ?? null,
        image_path: merged.image_path ?? null,
        thumb_path: merged.thumb_path ?? null,
        is_active: merged.is_active ?? 1,
        is_new: merged.is_new ?? 0,
        userId: userId ?? null,
      });
  },

  // Soft delete — keep the row, just hide it (ТЗ 9.6).
  setActive(id, isActive, userId) {
    return db
      .prepare(
        `UPDATE products SET is_active = ?, updated_at = datetime('now'), updated_by = ?
         WHERE id = ?`
      )
      .run(isActive ? 1 : 0, userId ?? null, id);
  },

  /**
   * Idempotent insert-or-update keyed on `code`. Used by the price importer
   * so re-running it updates existing rows instead of creating duplicates.
   * Returns 'inserted' | 'updated'.
   */
  upsertByCode(data) {
    const existing = this.getByCode(data.code);
    if (existing) {
      // Don't clobber an existing image with null on a data-only re-import.
      const image_path = data.image_path ?? existing.image_path;
      const thumb_path = data.thumb_path ?? existing.thumb_path;
      db.prepare(
        `UPDATE products SET
           name = @name, category = @category, description = @description,
           price_retail = @price_retail, price_partner = @price_partner,
           image_path = @image_path, thumb_path = @thumb_path,
           updated_at = datetime('now')
         WHERE code = @code`
      ).run({
        code: data.code,
        name: data.name,
        category: data.category ?? null,
        description: data.description ?? null,
        price_retail: data.price_retail ?? null,
        price_partner: data.price_partner ?? null,
        image_path,
        thumb_path,
      });
      return 'updated';
    }
    this.create(data, null);
    return 'inserted';
  },

  count() {
    return db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 1').get().c;
  },
};

export default Product;
