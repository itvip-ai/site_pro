import express from 'express';
import multer from 'multer';
import { requireStaff, requireAdmin } from '../middleware/auth.js';
import * as products from '../controllers/adminProducts.js';
import * as users from '../controllers/adminUsers.js';
import * as activity from '../controllers/adminActivity.js';
import * as contacts from '../controllers/adminContacts.js';
import { Product } from '../models/product.js';
import { User } from '../models/user.js';

const router = express.Router();

// In-memory upload; sharp converts the buffer to WebP before anything hits disk.
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif|bmp|tiff)$/i.test(file.mimetype)) cb(null, true);
    else {
      const err = new Error('Only images are allowed');
      err.code = 'IMAGE_ONLY';
      cb(err);
    }
  },
});

// Everything under /admin requires staff (manager or admin).
router.use(requireStaff);

// Dashboard
router.get('/', (req, res) => {
  res.render('admin/dashboard', {
    title: req.t('admin.dashboard.title'),
    section: 'dashboard',
    stats: {
      products: Product.count(),
      categories: Product.categories().length,
      users: req.user.role === 'admin' ? User.count() : null,
    },
  });
});

// Activity / audit feed
router.get('/activity', activity.list);

// Products
router.get('/products', products.list);
router.get('/products/export', requireAdmin, products.exportExcel); // admin-only Excel dump
router.get('/products/new', products.newForm);
router.post('/products', upload.single('image'), products.create);
router.get('/products/:id/edit', products.editForm);
router.post('/products/:id', upload.single('image'), products.update);
router.post('/products/:id/hide', products.hide);
router.post('/products/:id/show', products.show);

// Contact persons (public "Контакты" page) — admin-only directory.
router.get('/contacts', requireAdmin, contacts.list);
router.get('/contacts/new', requireAdmin, contacts.newForm);
router.post('/contacts', requireAdmin, upload.single('photo'), contacts.create);
router.get('/contacts/:id/edit', requireAdmin, contacts.editForm);
router.post('/contacts/:id', requireAdmin, upload.single('photo'), contacts.update);
router.post('/contacts/:id/delete', requireAdmin, contacts.remove);

// Users — managers may manage partners, admins may manage everyone.
router.get('/users', users.list);
router.post('/users', users.create);
router.post('/users/:id/block', (req, res) => users.setActive(req, res, false));
router.post('/users/:id/unblock', (req, res) => users.setActive(req, res, true));
router.post('/users/:id/reset-password', users.resetPassword);
router.post('/users/:id/profile', users.updateProfile);

export default router;
