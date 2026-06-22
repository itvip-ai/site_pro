import { Product, serializeProducts, serializeProduct } from '../models/product.js';
import { Contact } from '../models/contact.js';
import { paginate } from '../utils/helpers.js';

export function home(req, res) {
  const categories = Product.categories();
  res.render('home', {
    title: req.t('home.hero.title'),
    categories,
    totalProducts: Product.count(),
  });
}

const SORT_OPTIONS = ['name', 'price_asc', 'price_desc', 'new'];

export function catalog(req, res) {
  const { search = '', category = '' } = req.query;
  const sort = SORT_OPTIONS.includes(req.query.sort) ? req.query.sort : 'name';
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);

  const { rows, total } = Product.list({
    search: search.trim() || null,
    category: category.trim() || null,
    sort,
    limit,
    offset,
  });

  const products = serializeProducts(rows, req.role);
  const categories = Product.categories();
  const pages = Math.max(1, Math.ceil(total / limit));

  res.render('catalog', {
    title: req.t('catalog.title'),
    products,
    categories,
    activeCategory: category,
    search,
    sort,
    pagination: { page, limit, total, pages },
    canSeePartner: req.role !== 'public',
  });
}

export function contacts(req, res) {
  res.render('contacts', {
    title: req.t('contacts.title'),
    contacts: Contact.listActive(),
  });
}

export function productDetail(req, res) {
  const product = Product.getById(req.params.id);
  if (!product) {
    return res.status(404).render('error', {
      title: req.t('error.product.title'),
      code: 404,
      message: req.t('error.product.msg'),
    });
  }
  const displayName = req.lang === 'ro' && product.name_ro ? product.name_ro : product.name;
  res.render('product', {
    title: displayName,
    product: serializeProduct(product, req.role),
    canSeePartner: req.role !== 'public',
  });
}
