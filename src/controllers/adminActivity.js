import { Activity } from '../models/activity.js';
import { paginate } from '../utils/helpers.js';

export function list(req, res) {
  const kind = ['product', 'user', 'kp', 'login'].includes(req.query.kind) ? req.query.kind : 'all';
  const actor = (req.query.actor || '').trim();
  const { page, limit } = paginate(req.query.page, 40, { page: 1, limit: 40, max: 100 });

  const { rows, total, pages } = Activity.query({ kind, actor, page, limit });

  res.render('admin/activity', {
    title: req.t('admin.activity.title'),
    section: 'activity',
    rows,
    actors: Activity.actors(),
    kind,
    actor,
    pagination: { page, limit, total, pages },
  });
}
