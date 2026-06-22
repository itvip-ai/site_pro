import { db } from '../config/db.js';

// Standalone directory of company contact persons, shown on the public
// "Контакты" page and managed by the admin. Not tied to login accounts or КП.
export const Contact = {
  // All contacts (admin view), ordered for display.
  all() {
    return db
      .prepare('SELECT * FROM contacts ORDER BY sort_order ASC, name COLLATE NOCASE ASC')
      .all();
  },

  // Only visible contacts, for the public page.
  listActive() {
    return db
      .prepare('SELECT * FROM contacts WHERE is_active = 1 ORDER BY sort_order ASC, name COLLATE NOCASE ASC')
      .all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  },

  create(data) {
    const info = db
      .prepare(
        `INSERT INTO contacts
           (name, position, position_ro, department, phone, email, photo_path, thumb_path, sort_order, is_active)
         VALUES
           (@name, @position, @position_ro, @department, @phone, @email, @photo_path, @thumb_path, @sort_order, @is_active)`
      )
      .run({
        name: data.name,
        position: data.position ?? null,
        position_ro: data.position_ro ?? null,
        department: data.department ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        photo_path: data.photo_path ?? null,
        thumb_path: data.thumb_path ?? null,
        sort_order: Number.isFinite(data.sort_order) ? data.sort_order : 0,
        is_active: data.is_active ? 1 : 0,
      });
    return info.lastInsertRowid;
  },

  update(id, data) {
    const cur = Contact.getById(id);
    if (!cur) return false;
    db.prepare(
      `UPDATE contacts SET
         name=@name, position=@position, position_ro=@position_ro, department=@department,
         phone=@phone, email=@email, photo_path=@photo_path, thumb_path=@thumb_path,
         sort_order=@sort_order, is_active=@is_active, updated_at=datetime('now')
       WHERE id=@id`
    ).run({
      id: Number(id),
      name: data.name,
      position: data.position ?? null,
      position_ro: data.position_ro ?? null,
      department: data.department ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      // Keep the existing photo unless a new one was supplied.
      photo_path: data.photo_path !== undefined ? data.photo_path : cur.photo_path,
      thumb_path: data.thumb_path !== undefined ? data.thumb_path : cur.thumb_path,
      sort_order: Number.isFinite(data.sort_order) ? data.sort_order : 0,
      is_active: data.is_active ? 1 : 0,
    });
    return true;
  },

  remove(id) {
    return db.prepare('DELETE FROM contacts WHERE id = ?').run(id).changes > 0;
  },
};

export default Contact;
