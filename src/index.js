import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import { initSchema } from './config/db.js';
import { attachUser } from './middleware/auth.js';
import { i18nMiddleware, normalizeLang } from './config/i18n.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import kpRoutes from './routes/kp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

initSchema();

const app = express();
const PORT = process.env.PORT || 3000;

// Behind nginx in production — trust the proxy so secure cookies / IPs work.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(projectRoot, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
      },
    },
  })
);

app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '5mb' }));

// Static assets. Images are served straight from /public/images (nginx does
// this directly in production).
app.use(
  express.static(path.join(projectRoot, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  })
);

app.use(
  session({
    name: 'qgroup.sid',
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto', // becomes secure once served over HTTPS behind the proxy
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// One-shot flash messages stored on the session.
app.use((req, res, next) => {
  res.locals.flash = req.session?.flash || null;
  if (req.session?.flash) delete req.session.flash;
  next();
});

app.use(i18nMiddleware);
app.use(attachUser);

// Language switch: set a long-lived cookie and return to the originating page.
app.get('/lang/:lang', (req, res) => {
  res.cookie('lang', normalizeLang(req.params.lang), {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: false,
    sameSite: 'lax',
  });
  // Prefer an explicit ?return= (Referer is stripped by our Referrer-Policy).
  // Only allow local paths to avoid open redirects.
  const ret = req.query.return;
  const safe = typeof ret === 'string' && /^\/(?!\/)/.test(ret) ? ret : null;
  res.redirect(safe || req.get('Referer') || '/');
});

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);
app.use('/kp', kpRoutes);

// Upload / known errors: flash and bounce back instead of a raw 500.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.code === 'IMAGE_ONLY') {
    let text;
    if (err.code === 'LIMIT_FILE_SIZE') text = req.t('flash.upload.tooLarge');
    else if (err.code === 'IMAGE_ONLY') text = req.t('flash.upload.imageOnly');
    else text = req.t('flash.upload.generic');
    if (req.session) req.session.flash = { type: 'error', text };
    return res.redirect(req.get('Referer') || '/admin/products');
  }
  console.error(err);
  res.status(500).render('error', {
    title: req.t('error.500.title'),
    code: 500,
    message: req.t('error.500.msg'),
  });
});

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: req.t('error.404.title'),
    code: 404,
    message: req.t('error.404.msg'),
  });
});

app.listen(PORT, () => {
  console.log(`QGROUP catalog → http://localhost:${PORT}`);
});

export default app;
