import express from 'express';
import rateLimit from 'express-rate-limit';
import * as catalog from '../controllers/catalog.js';
import * as auth from '../controllers/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Basic brute-force protection on the login endpoint (ТЗ 4.2).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => req.t('login.rateLimited'),
});

router.get('/', catalog.home);
router.get('/catalog', catalog.catalog);
router.get('/contacts', catalog.contacts);
router.get('/product/:id', catalog.productDetail);

router.get('/login', auth.loginPage);
router.post('/login', loginLimiter, auth.loginSubmit);
router.post('/logout', requireAuth, auth.logout);

export default router;
