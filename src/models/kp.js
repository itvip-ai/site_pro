import { db } from '../config/db.js';

// Categories treated as "LED" for the LED builder's catalog filter.
export const LED_CATEGORIES = ['LED экраны', 'Интерактивные панели'];

function money(v) {
  return parseFloat(String(v || '0').replace(/[^0-9.]/g, '')) || 0;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export const KP = {
  /** Insert or update a proposal, keyed on (variant, num). */
  save(variant, data, ctx) {
    const orig = money(data.totalOrig);
    const disc = money(data.total);
    const discPct = orig > 0 ? Math.round((1 - disc / orig) * 100) : 0;
    const row = {
      variant,
      num: data.num,
      type: data.type === 'new' ? 'Новый' : 'Постоянный',
      lang: data.lang || 'RU',
      client_name: data.cl_n || '',
      company: data.cl_co || '',
      phone: data.cl_ph || '',
      email: data.cl_em || '',
      address: data.cl_ad || '',
      object_type: data.cl_ty || '',
      region: data.selRegion || '',
      manager: data.m_name || '',
      total_orig: '$' + orig.toFixed(0),
      total: '$' + disc.toFixed(0),
      discount: discPct + '%',
      status: data.c_st || 'Отправлено',
      kp_date: new Date().toISOString(),
      json: JSON.stringify(data),
      creator_email: (ctx.email || '').toLowerCase(),
      creator_role: ctx.role || '',
    };

    const existing = db
      .prepare('SELECT id FROM kps WHERE variant = ? AND num = ?')
      .get(variant, row.num);

    if (existing) {
      db.prepare(
        `UPDATE kps SET
           type=@type, lang=@lang, client_name=@client_name, company=@company,
           phone=@phone, email=@email, address=@address, object_type=@object_type,
           region=@region, manager=@manager, total_orig=@total_orig, total=@total,
           discount=@discount, status=@status, kp_date=@kp_date, json=@json,
           updated_at=datetime('now')
         WHERE id=@id`
      ).run({ ...row, id: existing.id });
    } else {
      db.prepare(
        `INSERT INTO kps
           (variant, num, type, lang, client_name, company, phone, email, address,
            object_type, region, manager, total_orig, total, discount, status,
            kp_date, json, creator_email, creator_role)
         VALUES
           (@variant, @num, @type, @lang, @client_name, @company, @phone, @email, @address,
            @object_type, @region, @manager, @total_orig, @total, @discount, @status,
            @kp_date, @json, @creator_email, @creator_role)`
      ).run(row);
    }
    return {
      success: true,
      created: !existing,
      num: row.num,
      client_name: row.client_name,
      total: row.total,
    };
  },

  /** List proposals of a variant. Partners only see their own. */
  list(variant, ctx) {
    let rows = db
      .prepare('SELECT * FROM kps WHERE variant = ? ORDER BY id DESC')
      .all(variant);
    if (ctx.role === 'partner') {
      const email = (ctx.email || '').toLowerCase();
      rows = rows.filter((r) => (r.creator_email || '').toLowerCase() === email);
    }
    return rows.map((r) => {
      let state = null;
      try { state = JSON.parse(r.json); } catch {}
      return {
        rowIndex: r.id,
        date: fmtDate(r.kp_date),
        num: r.num, type: r.type, lang: r.lang,
        name: r.client_name, company: r.company, phone: r.phone, email: r.email,
        addr: r.address, objType: r.object_type, region: r.region, manager: r.manager,
        totalOrig: r.total_orig, total: r.total, discount: r.discount, status: r.status,
        state,
        creator: (r.creator_email || '').toLowerCase(), creatorRole: r.creator_role,
      };
    });
  },

  remove(variant, num, ctx) {
    const r = db.prepare('SELECT * FROM kps WHERE variant = ? AND num = ?').get(variant, String(num));
    if (!r) return { success: false, error: 'КП ' + num + ' не найдено' };
    if (ctx.role === 'partner' && (r.creator_email || '').toLowerCase() !== (ctx.email || '').toLowerCase()) {
      return { success: false, error: 'Это КП создал другой пользователь' };
    }
    db.prepare('DELETE FROM kps WHERE id = ?').run(r.id);
    return { success: true, num: r.num, client_name: r.client_name, total: r.total };
  },
};

export default KP;
