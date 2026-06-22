import { User } from '../models/user.js';
import { Log } from '../models/log.js';
import { hashPassword } from '../utils/helpers.js';

// Which roles each actor is allowed to create / manage.
function creatableRoles(actor) {
  if (actor.role === 'admin') return ['manager', 'sales', 'partner'];
  if (actor.role === 'manager') return ['partner'];
  return [];
}

// Can `actor` manage (block/reset/change) the `target` account?
function canManage(actor, target) {
  if (!target) return false;
  if (actor.role === 'admin') return true;
  if (actor.role === 'manager') return target.role === 'partner';
  return false;
}

export function list(req, res) {
  // Managers only see partners; admins see everyone.
  const users = req.user.role === 'admin' ? User.list() : User.list({ role: 'partner' });
  res.render('admin/users', {
    title: req.t('admin.users.title'),
    section: 'users',
    users,
    creatableRoles: creatableRoles(req.user),
    canManage: (target) => canManage(req.user, target),
    currentUserId: req.user.id,
  });
}

export async function create(req, res) {
  const login = (req.body.login || '').trim();
  const password = req.body.password || '';
  const role = req.body.role;

  const fail = (text) => {
    req.session.flash = { type: 'error', text };
    res.redirect('/admin/users');
  };

  if (!login || !password || !role) return fail(req.t('flash.user.fillAll'));
  if (password.length < 6) return fail(req.t('flash.user.passwordShort'));
  if (!creatableRoles(req.user).includes(role)) return fail(req.t('flash.user.noRightsRole'));
  if (User.exists(login)) return fail(req.t('flash.user.exists', { login }));

  const id = User.create(
    {
      login,
      password_hash: await hashPassword(password),
      role,
      display_name: (req.body.display_name || '').trim() || null,
      phone: (req.body.phone || '').trim() || null,
      department: (req.body.department || '').trim() || null,
      color: (req.body.color || '').trim() || null,
      company: (req.body.company || '').trim() || null,
      led_access: req.body.led_access ? 1 : 0,
    },
    req.user.id
  );
  Log.user(id, 'create', req.user.id, { login, role });
  req.session.flash = { type: 'success', text: req.t('flash.user.created', { login }) };
  res.redirect('/admin/users');
}

export function setActive(req, res, isActive) {
  const target = User.getById(req.params.id);
  if (!canManage(req.user, target)) return deny(req, res);
  if (target.id === req.user.id) {
    req.session.flash = { type: 'error', text: req.t('flash.user.cantBlockSelf') };
    return res.redirect('/admin/users');
  }
  User.setActive(target.id, isActive);
  Log.user(target.id, isActive ? 'unblock' : 'block', req.user.id);
  req.session.flash = {
    type: 'success',
    text: isActive ? req.t('flash.user.unblocked') : req.t('flash.user.blocked'),
  };
  res.redirect('/admin/users');
}

export async function resetPassword(req, res) {
  const target = User.getById(req.params.id);
  if (!canManage(req.user, target)) return deny(req, res);
  const password = req.body.password || '';
  if (password.length < 6) {
    req.session.flash = { type: 'error', text: req.t('flash.user.newPasswordShort') };
    return res.redirect('/admin/users');
  }
  User.setPassword(target.id, await hashPassword(password));
  Log.user(target.id, 'reset_password', req.user.id);
  req.session.flash = { type: 'success', text: req.t('flash.user.passwordUpdated', { login: target.login }) };
  res.redirect('/admin/users');
}

export function updateProfile(req, res) {
  const target = User.getById(req.params.id);
  if (!canManage(req.user, target)) return deny(req, res);
  User.updateProfile(target.id, {
    display_name: (req.body.display_name || '').trim() || null,
    phone: (req.body.phone || '').trim() || null,
    department: (req.body.department || '').trim() || null,
    color: (req.body.color || '').trim() || null,
    company: (req.body.company || '').trim() || null,
    led_access: req.body.led_access ? 1 : 0,
  });
  Log.user(target.id, 'profile', req.user.id);
  req.session.flash = { type: 'success', text: req.t('flash.user.profileSaved') };
  res.redirect('/admin/users');
}

function deny(req, res) {
  req.session.flash = { type: 'error', text: req.t('flash.user.noRightsAction') };
  res.redirect('/admin/users');
}
