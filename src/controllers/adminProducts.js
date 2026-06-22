import ExcelJS from 'exceljs';
import { Product } from '../models/product.js';
import { Log } from '../models/log.js';
import { parsePrice, paginate, safeSlug } from '../utils/helpers.js';
import { processImage, removeImageFiles } from '../utils/images.js';

export function list(req, res) {
  const { search = '', category = '' } = req.query;
  const { page, limit, offset } = paginate(req.query.page, req.query.limit, {
    page: 1,
    limit: 30,
    max: 100,
  });
  const { rows, total } = Product.list({
    search: search.trim() || null,
    category: category.trim() || null,
    limit,
    offset,
    includeInactive: true, // staff see hidden products too
  });
  const pages = Math.max(1, Math.ceil(total / limit));
  res.render('admin/products', {
    title: req.t('admin.products.title'),
    section: 'products',
    products: rows,
    categories: Product.categories(),
    search,
    activeCategory: category,
    pagination: { page, limit, total, pages },
  });
}

// Admin-only Excel export (route-guarded by requireAdmin). With no `cat`
// params it exports every product; otherwise only the selected categories.
// Includes hidden products and the partner price — this is an internal dump.
export async function exportExcel(req, res) {
  let cats = req.query.cat;
  if (cats == null) cats = [];
  else if (!Array.isArray(cats)) cats = [cats];
  cats = cats.map((c) => String(c).trim()).filter(Boolean);
  const catSet = cats.length ? new Set(cats) : null;

  const { rows } = Product.list({ includeInactive: true, limit: 1000000, offset: 0 });
  const products = catSet ? rows.filter((p) => catSet.has(String(p.category || ''))) : rows;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QGROUP';
  wb.created = new Date();
  const ws = wb.addWorksheet('Товары');
  ws.columns = [
    { header: 'Код', key: 'code', width: 18 },
    { header: 'Название', key: 'name', width: 42 },
    { header: 'Название (RO)', key: 'name_ro', width: 42 },
    { header: 'Категория', key: 'category', width: 22 },
    { header: 'Цена розница, $', key: 'price_retail', width: 16 },
    { header: 'Цена партнёр, $', key: 'price_partner', width: 16 },
    { header: 'Описание', key: 'description', width: 50 },
    { header: 'Описание (RO)', key: 'description_ro', width: 50 },
    { header: 'Новинка', key: 'is_new', width: 9 },
    { header: 'Статус', key: 'status', width: 12 },
    { header: 'Фото', key: 'image_path', width: 38 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16572C' } };
  head.alignment = { vertical: 'middle' };

  products.forEach((p) => {
    ws.addRow({
      code: p.code,
      name: p.name,
      name_ro: p.name_ro || '',
      category: p.category || '',
      price_retail: p.price_retail != null ? Number(p.price_retail) : '',
      price_partner: p.price_partner != null ? Number(p.price_partner) : '',
      description: p.description || '',
      description_ro: p.description_ro || '',
      is_new: p.is_new ? 'да' : '',
      status: p.is_active ? 'активен' : 'скрыт',
      image_path: p.image_path || '',
    });
  });
  ws.autoFilter = 'A1:K1';
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.getColumn('price_retail').numFmt = '#,##0.00';
  ws.getColumn('price_partner').numFmt = '#,##0.00';

  const stamp = new Date().toISOString().slice(0, 10);
  const tag = catSet ? 'selected' : 'all';
  const fname = `qgroup-products-${tag}-${stamp}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  await wb.xlsx.write(res);
  res.end();
}

export function newForm(req, res) {
  res.render('admin/product-form', {
    title: req.t('admin.form.newTitle'),
    section: 'products',
    product: { is_active: 1, is_new: 1 },
    categories: Product.categories(),
    isNew: true,
  });
}

export function editForm(req, res) {
  const product = Product.getById(req.params.id, { includeInactive: true });
  if (!product) return notFound(req, res);
  res.render('admin/product-form', {
    title: req.t('admin.form.editTitle'),
    section: 'products',
    product,
    categories: Product.categories(),
    isNew: false,
  });
}

function readBody(req) {
  const category =
    (req.body.category_new || '').trim() || (req.body.category || '').trim() || null;
  return {
    code: (req.body.code || '').trim(),
    name: (req.body.name || '').trim(),
    name_ro: (req.body.name_ro || '').trim() || null,
    category,
    description: (req.body.description || '').trim() || null,
    description_ro: (req.body.description_ro || '').trim() || null,
    price_retail: parsePrice(req.body.price_retail),
    price_partner: parsePrice(req.body.price_partner),
    is_active: req.body.is_active ? 1 : 0,
    is_new: req.body.is_new ? 1 : 0,
  };
}

export async function create(req, res) {
  const data = readBody(req);
  if (!data.code || !data.name) {
    req.session.flash = { type: 'error', text: req.t('flash.product.codeNameRequired') };
    return res.redirect('/admin/products/new');
  }
  if (Product.getByCode(data.code)) {
    req.session.flash = { type: 'error', text: req.t('flash.product.codeExists', { code: data.code }) };
    return res.redirect('/admin/products/new');
  }

  if (req.file) {
    const base = `${safeSlug(data.code)}-${Date.now()}`;
    const paths = await processImage(req.file.buffer, base);
    data.image_path = paths.image_path;
    data.thumb_path = paths.thumb_path;
  }

  const id = Product.create(data, req.user.id);
  Log.product(id, 'create', req.user.id, { code: data.code });
  req.session.flash = { type: 'success', text: req.t('flash.product.created') };
  res.redirect('/admin/products');
}

export async function update(req, res) {
  const id = req.params.id;
  const current = Product.getById(id, { includeInactive: true });
  if (!current) return notFound(req, res);

  const data = readBody(req);
  if (!data.code || !data.name) {
    req.session.flash = { type: 'error', text: req.t('flash.product.codeNameRequired') };
    return res.redirect(`/admin/products/${id}/edit`);
  }
  const clash = Product.getByCode(data.code);
  if (clash && clash.id !== Number(id)) {
    req.session.flash = { type: 'error', text: req.t('flash.product.codeTaken', { code: data.code }) };
    return res.redirect(`/admin/products/${id}/edit`);
  }

  if (req.file) {
    const base = `${safeSlug(data.code)}-${Date.now()}`;
    const paths = await processImage(req.file.buffer, base);
    if (current.image_path && current.image_path !== paths.image_path) {
      removeImageFiles(current.image_path, current.thumb_path);
    }
    data.image_path = paths.image_path;
    data.thumb_path = paths.thumb_path;
  }

  Product.update(id, data, req.user.id);
  Log.product(id, 'update', req.user.id, { code: data.code });
  req.session.flash = { type: 'success', text: req.t('flash.product.saved') };
  res.redirect('/admin/products');
}

export function hide(req, res) {
  const id = req.params.id;
  if (!Product.getById(id, { includeInactive: true })) return notFound(req, res);
  Product.setActive(id, false, req.user.id);
  Log.product(id, 'hide', req.user.id);
  req.session.flash = { type: 'success', text: req.t('flash.product.hidden') };
  res.redirect('/admin/products');
}

export function show(req, res) {
  const id = req.params.id;
  if (!Product.getById(id, { includeInactive: true })) return notFound(req, res);
  Product.setActive(id, true, req.user.id);
  Log.product(id, 'show', req.user.id);
  req.session.flash = { type: 'success', text: req.t('flash.product.shown') };
  res.redirect('/admin/products');
}

function notFound(req, res) {
  return res.status(404).render('error', {
    title: req.t('error.notFound'),
    code: 404,
    message: req.t('error.product.short'),
  });
}
