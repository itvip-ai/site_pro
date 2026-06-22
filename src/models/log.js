import { db } from '../config/db.js';

export const Log = {
  product(productId, action, changedBy, details = null) {
    db.prepare(
      `INSERT INTO product_logs (product_id, action, changed_by, details)
       VALUES (?, ?, ?, ?)`
    ).run(productId, action, changedBy ?? null, details ? JSON.stringify(details) : null);
  },

  user(userId, action, changedBy, details = null) {
    db.prepare(
      `INSERT INTO user_logs (user_id, action, changed_by, details)
       VALUES (?, ?, ?, ?)`
    ).run(userId, action, changedBy ?? null, details ? JSON.stringify(details) : null);
  },

  // КП constructor audit trail. `action`: create | update | delete | open |
  // denied | error. `info`: { variant, num, client_name, total, device, detail }.
  kp(action, ctx = {}, info = {}) {
    db.prepare(
      `INSERT INTO kp_logs
         (variant, num, action, actor, actor_role, client_name, total, device, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      info.variant ?? null,
      info.num != null ? String(info.num) : null,
      action,
      (ctx.email || ctx.actor || '').toLowerCase() || null,
      ctx.role ?? ctx.actor_role ?? null,
      info.client_name ?? null,
      info.total ?? null,
      info.device ?? null,
      info.detail ?? null
    );
  },

  login(userId, login, role) {
    db.prepare('INSERT INTO login_logs (user_id, login, role) VALUES (?, ?, ?)').run(
      userId ?? null,
      login ?? null,
      role ?? null
    );
  },
};

export default Log;
