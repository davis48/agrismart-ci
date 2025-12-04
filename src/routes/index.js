/**
 * Routes principales - Agrégation de toutes les routes
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();

// Import des routes
const authRoutes = require('./auth');
const usersRoutes = require('./users');
const parcellesRoutes = require('./parcelles');
const capteursRoutes = require('./capteurs');
const mesuresRoutes = require('./mesures');
const alertesRoutes = require('./alertes');
const culturesRoutes = require('./cultures');
const maladiesRoutes = require('./maladies');
const recommandationsRoutes = require('./recommandations');
const marketplaceRoutes = require('./marketplace');
const formationsRoutes = require('./formations');
const messagesRoutes = require('./messages');

// Montage des routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/parcelles', parcellesRoutes);
router.use('/capteurs', capteursRoutes);
router.use('/mesures', mesuresRoutes);
router.use('/alertes', alertesRoutes);
router.use('/cultures', culturesRoutes);
router.use('/maladies', maladiesRoutes);
router.use('/recommandations', recommandationsRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/formations', formationsRoutes);
router.use('/messages', messagesRoutes);

// Route de health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Route d'information de l'API
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenue sur l\'API AgriSmart CI',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      parcelles: '/api/parcelles',
      capteurs: '/api/capteurs',
      mesures: '/api/mesures',
      alertes: '/api/alertes',
      cultures: '/api/cultures',
      maladies: '/api/maladies',
      recommandations: '/api/recommandations',
      marketplace: '/api/marketplace',
      formations: '/api/formations',
      messages: '/api/messages'
    }
  });
});

module.exports = router;
