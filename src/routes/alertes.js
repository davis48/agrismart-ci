/**
 * Routes de gestion des alertes
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const alertesController = require('../controllers/alertesController');
const { 
  authenticate, 
  isProducteur, 
  isConseiller,
  isAdmin,
  schemas,
  body,
  validate
} = require('../middlewares');

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * @route   GET /api/alertes
 * @desc    Lister les alertes (filtrées selon le rôle)
 * @access  Producteur, Conseiller, Admin
 */
router.get('/', isProducteur, schemas.pagination, alertesController.getAll);

/**
 * @route   GET /api/alertes/unread
 * @desc    Obtenir les alertes non lues
 * @access  Producteur, Conseiller, Admin
 */
router.get('/unread', isProducteur, alertesController.getUnread);

/**
 * @route   GET /api/alertes/stats
 * @desc    Statistiques des alertes
 * @access  Conseiller, Admin
 */
router.get('/stats', isConseiller, alertesController.getStats);

/**
 * @route   POST /api/alertes
 * @desc    Créer une alerte manuellement
 * @access  Conseiller, Admin
 */
router.post('/', 
  isConseiller,
  [
    body('type')
      .isIn(['meteo', 'capteur', 'maladie', 'irrigation', 'systeme', 'conseil'])
      .withMessage('Type d\'alerte invalide'),
    body('niveau')
      .isIn(['info', 'warning', 'critical'])
      .withMessage('Niveau invalide'),
    body('titre')
      .trim()
      .notEmpty()
      .isLength({ max: 255 }),
    body('message')
      .trim()
      .notEmpty()
      .isLength({ max: 1000 }),
    body('parcelle_id')
      .optional()
      .isUUID(),
    body('destinataires')
      .optional()
      .isArray(),
    validate
  ],
  alertesController.create
);

/**
 * @route   GET /api/alertes/:id
 * @desc    Obtenir une alerte par son ID
 * @access  Producteur, Conseiller, Admin
 */
router.get('/:id', schemas.paramUuid('id'), alertesController.getById);

/**
 * @route   PUT /api/alertes/:id/read
 * @desc    Marquer une alerte comme lue
 * @access  Producteur, Conseiller, Admin
 */
router.put('/:id/read', schemas.paramUuid('id'), alertesController.markAsRead);

/**
 * @route   PUT /api/alertes/:id/resolve
 * @desc    Marquer une alerte comme résolue
 * @access  Propriétaire, Conseiller, Admin
 */
router.put('/:id/resolve', schemas.paramUuid('id'), alertesController.resolve);

/**
 * @route   POST /api/alertes/read-all
 * @desc    Marquer toutes les alertes comme lues
 * @access  Producteur, Conseiller, Admin
 */
router.post('/read-all', isProducteur, alertesController.markAllAsRead);

/**
 * @route   DELETE /api/alertes/:id
 * @desc    Supprimer une alerte
 * @access  Admin
 */
router.delete('/:id', isAdmin, schemas.paramUuid('id'), alertesController.delete);

/**
 * @route   POST /api/alertes/test
 * @desc    Envoyer une alerte de test
 * @access  Admin
 */
router.post('/test', isAdmin, alertesController.sendTest);

module.exports = router;
