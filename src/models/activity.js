import { db } from '../config/db.js';

// Unified activity feed across product changes, user management, KP actions and
// logins. Normalized to a common shape so admins/managers see one timeline.
const FEED = `
  SELECT pl.changed_at AS at, 'product' AS kind, pl.action AS action,
         COALESCE(u.login,'—') AS actor, COALESCE(u.role,'') AS actor_role,
         COALESCE(p.code,'') AS t_code, COALESCE(p.name,'') AS t_name, '' AS t_extra
  FROM product_logs pl
  LEFT JOIN users u ON u.id = pl.changed_by
  LEFT JOIN products p ON p.id = pl.product_id
  UNION ALL
  SELECT ul.changed_at, 'user', ul.action,
         COALESCE(a.login,'—'), COALESCE(a.role,''),
         COALESCE(tu.login,''), COALESCE(tu.display_name,''), COALESCE(tu.role,'')
  FROM user_logs ul
  LEFT JOIN users a ON a.id = ul.changed_by
  LEFT JOIN users tu ON tu.id = ul.user_id
  UNION ALL
  SELECT kl.at, 'kp', kl.action,
         COALESCE(kl.actor,'—'), COALESCE(kl.actor_role,''),
         COALESCE(kl.num,''), COALESCE(NULLIF(kl.client_name,''), kl.detail, ''),
         TRIM(COALESCE(kl.variant,'') ||
              CASE WHEN kl.device IS NOT NULL AND kl.device <> '' THEN ' · ' || kl.device ELSE '' END)
  FROM kp_logs kl
  UNION ALL
  SELECT l.at, 'login', 'login', COALESCE(l.login,'—'), COALESCE(l.role,''), '', '', ''
  FROM login_logs l
`;

export const Activity = {
  query({ kind = 'all', actor = '', page = 1, limit = 40 } = {}) {
    const offset = (Math.max(1, page) - 1) * limit;
    const params = {
      kind,
      actor,
      actorLike: `%${actor}%`,
      limit,
      offset,
    };
    const where = `WHERE (@kind = 'all' OR kind = @kind) AND (@actor = '' OR actor LIKE @actorLike)`;

    const total = db.prepare(`SELECT COUNT(*) AS c FROM (${FEED}) ${where}`).get(params).c;
    const rows = db
      .prepare(`SELECT * FROM (${FEED}) ${where} ORDER BY at DESC LIMIT @limit OFFSET @offset`)
      .all(params);

    return { rows, total, pages: Math.max(1, Math.ceil(total / limit)) };
  },

  // Distinct actors for the filter dropdown.
  actors() {
    return db
      .prepare(`SELECT DISTINCT actor FROM (${FEED}) WHERE actor <> '—' ORDER BY actor`)
      .all()
      .map((r) => r.actor);
  },
};

export default Activity;
