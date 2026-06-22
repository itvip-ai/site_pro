import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { api, serveBuilder, kpContext, canAccessGroup } from '../controllers/kp.js';

const router = express.Router();

router.use(requireAuth);

// Hub — lists the builders available to the current user.
router.get('/', (req, res) => {
  const ctx = kpContext(req);
  const tiles = [
    { key: 'general', group: 'general', icon: '🛡', url: '/kp/general', mobile: '/kp/general/mobile' },
    { key: 'led', group: 'led', icon: '📺', url: '/kp/led', mobile: '/kp/led/mobile' },
    { key: 'partner', group: 'partner', icon: '🤝', url: '/kp/partner', mobile: '/kp/partner/mobile' },
  ].filter((t) => canAccessGroup(ctx, t.group));

  res.render('kp/hub', { title: req.t('kp.title'), section: 'kp', tiles });
});

// Builder pages
router.get('/general', serveBuilder('general'));
router.get('/general/mobile', serveBuilder('general-mobile'));
router.get('/led', serveBuilder('led'));
router.get('/led/mobile', serveBuilder('led-mobile'));
router.get('/partner', serveBuilder('partner'));
router.get('/partner/mobile', serveBuilder('partner-mobile'));

// JSON API the builders call (via the gas-shim).
router.post('/api/:fn', express.json({ limit: '5mb' }), api);

export default router;
