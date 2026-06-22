import { Contact } from '../models/contact.js';
import { safeSlug } from '../utils/helpers.js';
import { processImage, removeImageFiles } from '../utils/images.js';

export function list(req, res) {
  res.render('admin/contacts', {
    title: req.t('admin.contacts.title'),
    section: 'contacts',
    contacts: Contact.all(),
  });
}

export function newForm(req, res) {
  res.render('admin/contact-form', {
    title: req.t('admin.contacts.newTitle'),
    section: 'contacts',
    contact: { is_active: 1, sort_order: 0 },
    isNew: true,
  });
}

export function editForm(req, res) {
  const contact = Contact.getById(req.params.id);
  if (!contact) return notFound(req, res);
  res.render('admin/contact-form', {
    title: req.t('admin.contacts.editTitle'),
    section: 'contacts',
    contact,
    isNew: false,
  });
}

function readBody(req) {
  return {
    name: (req.body.name || '').trim(),
    position: (req.body.position || '').trim() || null,
    position_ro: (req.body.position_ro || '').trim() || null,
    department: (req.body.department || '').trim() || null,
    phone: (req.body.phone || '').trim() || null,
    email: (req.body.email || '').trim() || null,
    sort_order: parseInt(req.body.sort_order, 10) || 0,
    is_active: req.body.is_active ? 1 : 0,
  };
}

export async function create(req, res) {
  const data = readBody(req);
  if (!data.name) {
    req.session.flash = { type: 'error', text: req.t('admin.contacts.nameRequired') };
    return res.redirect('/admin/contacts/new');
  }
  if (req.file) {
    const base = `${safeSlug(data.name) || 'contact'}-${Date.now()}`;
    const paths = await processImage(req.file.buffer, base, 'contacts');
    data.photo_path = paths.image_path;
    data.thumb_path = paths.thumb_path;
  }
  Contact.create(data);
  req.session.flash = { type: 'success', text: req.t('admin.contacts.created') };
  res.redirect('/admin/contacts');
}

export async function update(req, res) {
  const id = req.params.id;
  const current = Contact.getById(id);
  if (!current) return notFound(req, res);

  const data = readBody(req);
  if (!data.name) {
    req.session.flash = { type: 'error', text: req.t('admin.contacts.nameRequired') };
    return res.redirect(`/admin/contacts/${id}/edit`);
  }
  if (req.file) {
    const base = `${safeSlug(data.name) || 'contact'}-${Date.now()}`;
    const paths = await processImage(req.file.buffer, base, 'contacts');
    if (current.photo_path && current.photo_path !== paths.image_path) {
      removeImageFiles(current.photo_path, current.thumb_path);
    }
    data.photo_path = paths.image_path;
    data.thumb_path = paths.thumb_path;
  }
  Contact.update(id, data);
  req.session.flash = { type: 'success', text: req.t('admin.contacts.saved') };
  res.redirect('/admin/contacts');
}

export function remove(req, res) {
  const contact = Contact.getById(req.params.id);
  if (!contact) return notFound(req, res);
  Contact.remove(contact.id);
  if (contact.photo_path) removeImageFiles(contact.photo_path, contact.thumb_path);
  req.session.flash = { type: 'success', text: req.t('admin.contacts.deleted') };
  res.redirect('/admin/contacts');
}

function notFound(req, res) {
  return res.status(404).render('error', {
    title: req.t('error.notFound'),
    code: 404,
    message: req.t('admin.contacts.notFound'),
  });
}
