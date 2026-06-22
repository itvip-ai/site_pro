import { User } from '../models/user.js';
import { Log } from '../models/log.js';
import { comparePassword } from '../utils/helpers.js';

export function loginPage(req, res) {
  if (req.user) return res.redirect('/');
  res.render('login', { title: req.t('login.title'), error: null, login: '' });
}

export async function loginSubmit(req, res) {
  const login = (req.body.login || '').trim();
  const password = req.body.password || '';

  const render = (error) =>
    res.status(401).render('login', { title: req.t('login.title'), error, login });

  if (!login || !password) {
    return render(req.t('login.err.empty'));
  }

  const user = User.getByLogin(login);
  // Always run a comparison to keep timing roughly constant whether or not
  // the account exists, and give a single generic error message.
  const hash = user ? user.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await comparePassword(password, hash);

  if (!user || !ok) {
    return render(req.t('login.err.invalid'));
  }
  if (!user.is_active) {
    return render(req.t('login.err.blocked'));
  }

  req.session.regenerate((err) => {
    if (err) return render(req.t('login.err.server'));
    req.session.userId = user.id;
    try { Log.login(user.id, user.login, user.role); } catch (e) {}
    let dest = '/admin';
    if (user.role === 'partner') dest = '/catalog';
    else if (user.role === 'sales') dest = '/kp';
    res.redirect(dest);
  });
}

export function logout(req, res) {
  req.session.destroy(() => res.redirect('/'));
}
