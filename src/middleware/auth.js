import { User } from '../models/user.js';
import { formatPrice, nl2br } from '../utils/helpers.js';

/**
 * Reads the session, loads the current user, and exposes it to controllers
 * (req.user) and to all views (res.locals.currentUser / role). A blocked or
 * deleted account is treated as logged out.
 */
export function attachUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.role = 'public';
  res.locals.formatPrice = formatPrice;
  res.locals.nl2br = nl2br;
  req.user = null;
  req.role = 'public';

  if (req.session?.userId) {
    const user = User.getById(req.session.userId);
    if (user && user.is_active) {
      req.user = user;
      req.role = user.role;
      res.locals.currentUser = user;
      res.locals.role = user.role;
    } else {
      req.session.destroy(() => {});
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.redirect('/login');
}

/** Allow only the given roles; otherwise 403. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('error', {
        title: req.t('error.403.title'),
        code: 403,
        message: req.t('error.403.msg'),
      });
    }
    next();
  };
}

// Convenience guards.
export const requireStaff = requireRole('admin', 'manager'); // back-office
export const requireAdmin = requireRole('admin');
