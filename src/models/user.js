import { db } from '../config/db.js';

function stripHash(user) {
  if (!user) return user;
  const { password_hash, ...rest } = user;
  return rest;
}

export const User = {
  getById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  getByLogin(login) {
    return db.prepare('SELECT * FROM users WHERE login = ?').get(login);
  },

  exists(login) {
    return !!db.prepare('SELECT 1 FROM users WHERE login = ?').get(login);
  },

  /** List users, optionally filtered by role. Password hashes are never returned. */
  list({ role = null } = {}) {
    const rows = role
      ? db.prepare('SELECT * FROM users WHERE role = ? ORDER BY login COLLATE NOCASE').all(role)
      : db.prepare('SELECT * FROM users ORDER BY role, login COLLATE NOCASE').all();
    return rows.map(stripHash);
  },

  create(data, createdBy) {
    const info = db
      .prepare(
        `INSERT INTO users
           (login, password_hash, role, display_name, phone, color, department, led_access, company, created_by)
         VALUES
           (@login, @password_hash, @role, @display_name, @phone, @color, @department, @led_access, @company, @createdBy)`
      )
      .run({
        login: data.login,
        password_hash: data.password_hash,
        role: data.role,
        display_name: data.display_name ?? null,
        phone: data.phone ?? null,
        color: data.color ?? null,
        department: data.department ?? null,
        led_access: data.led_access ? 1 : 0,
        company: data.company ?? null,
        createdBy: createdBy ?? null,
      });
    return info.lastInsertRowid;
  },

  /** Update editable profile fields (used by admin user management). */
  updateProfile(id, data) {
    const cur = this.getById(id);
    if (!cur) return { changes: 0 };
    return db
      .prepare(
        `UPDATE users SET
           display_name = @display_name, phone = @phone, color = @color,
           department = @department, led_access = @led_access, company = @company,
           updated_at = datetime('now')
         WHERE id = @id`
      )
      .run({
        id,
        display_name: data.display_name ?? cur.display_name ?? null,
        phone: data.phone ?? cur.phone ?? null,
        color: data.color ?? cur.color ?? null,
        department: data.department ?? cur.department ?? null,
        led_access: data.led_access !== undefined ? (data.led_access ? 1 : 0) : cur.led_access,
        company: data.company ?? cur.company ?? null,
      });
  },

  /** Staff users that can appear as the responsible manager on a proposal. */
  staffCards() {
    return db
      .prepare(
        `SELECT * FROM users
         WHERE is_active = 1 AND role IN ('admin','manager','sales')
         ORDER BY department, display_name, login`
      )
      .all()
      .map(stripHash);
  },

  setActive(id, isActive) {
    return db
      .prepare(`UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(isActive ? 1 : 0, id);
  },

  setRole(id, role) {
    return db
      .prepare(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(role, id);
  },

  setPassword(id, password_hash) {
    return db
      .prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(password_hash, id);
  },

  count() {
    return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  },
};

export default User;
