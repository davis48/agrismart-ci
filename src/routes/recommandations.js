/**
 * Routes de gestion des recommandations et prévisions
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const recommandationsController = require('../controllers/recommandationsController');
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

/* ========== RECOMMANDATIONS ========== */

/**
 * @route   GET /api/recommandations
 * @desc    Lister les recommandations de l'utilisateur
 * @access  Producteur, Conseiller, Admin
 */
router.get('/', isProducteur, schemas.pagination, recommandationsController.getAll);

/**
 * @route   GET /api/recommandations/active
 * @desc    Obtenir les recommandations actives
 * @access  Producteur, Conseiller, Admin
 */
router.get('/active', isProducteur, recommandationsController.getActive);

/**
 * @route   POST /api/recommandations
 * @desc    Créer une recommandation manuelle
 * @access  Conseiller, Admin
 */
router.post('/', 
  isConseiller,
  [
    body('type')
      .isIn(['irrigation', 'fertilisation', 'traitement', 'recolte', 'semis', 'general'])
      .withMessage('Type de recommandation invalide'),
    body('titre')
      .trim()
      .notEmpty()
      .isLength({ max: 255 }),
    body('contenu')
      .trim()
      .notEmpty()
      .isLength({ max: 2000 }),
    body('priorite')
      .optional()
      .isIn(['basse', 'moyenne', 'haute', 'urgente']),
    body('parcelle_id')
      .optional()
      .isUUID(),
    body('culture_id')
      .optional()
      .isUUID(),
    body('date_debut')
      .optional()
      .isISO8601(),
    body('date_fin')
      .optional()
      .isISO8601(),
    validate
  ],
  recommandationsController.create
);

/**
 * @route   GET /api/recommandations/:id
 * @desc    Obtenir une recommandation par son ID
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/:id', schemas.paramUuid('id'), recommandationsController.getById);

/**
 * @route   PUT /api/recommandations/:id
 * @desc    Mettre à jour une recommandation
 * @access  Conseiller, Admin
 */
router.put('/:id', isConseiller, schemas.paramUuid('id'), recommandationsController.update);

/**
 * @route   PUT /api/recommandations/:id/status
 * @desc    Mettre à jour le statut d'une recommandation (appliquée/ignorée)
 * @access  Propriétaire, Conseiller, Admin
 */
router.put('/:id/status',
  [
    body('statut')
      .isIn(['en_attente', 'appliquee', 'ignoree', 'expiree'])
      .withMessage('Statut invalide'),
    body('feedback')
      .optional()
      .trim()
      .isLength({ max: 500 }),
    validate
  ],
  recommandationsController.updateStatus
);

/**
 * @route   DELETE /api/recommandations/:id
 * @desc    Supprimer une recommandation
 * @access  Admin
 */
router.delete('/:id', isAdmin, schemas.paramUuid('id'), recommandationsController.delete);

/* ========== PRÉVISIONS D'IRRIGATION ========== */

/**
 * @route   GET /api/recommandations/irrigation
 * @desc    Obtenir les prévisions d'irrigation
 * @access  Producteur, Conseiller, Admin
 */
router.get('/irrigation/previsions', isProducteur, recommandationsController.getIrrigationPrevisions);

/**
 * @route   GET /api/recommandations/irrigation/:parcelleId
 * @desc    Prévisions d'irrigation pour une parcelle
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/irrigation/:parcelleId', schemas.paramUuid('parcelleId'), recommandationsController.getIrrigationByParcelle);

/**
 * @route   POST /api/recommandations/irrigation/calculate
 * @desc    Calculer les besoins en irrigation
 * @access  Producteur, Conseiller, Admin
 */
router.post('/irrigation/calculate',
  isProducteur,
  [
    body('parcelle_id').isUUID(),
    body('date_debut').optional().isISO8601(),
    body('date_fin').optional().isISO8601(),
    validate
  ],
  recommandationsController.calculateIrrigation
);

/* ========== PRÉVISIONS MÉTÉO ========== */

/**
 * @route   GET /api/recommandations/meteo
 * @desc    Obtenir les prévisions météo
 * @access  Producteur, Conseiller, Admin
 */
router.get('/meteo/previsions', isProducteur, recommandationsController.getMeteoPrevisions);

/**
 * @route   GET /api/recommandations/meteo/:parcelleId
 * @desc    Prévisions météo pour une parcelle
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/meteo/:parcelleId', schemas.paramUuid('parcelleId'), recommandationsController.getMeteoByParcelle);

/* ========== GÉNÉRATION AUTOMATIQUE ========== */

/**
 * @route   POST /api/recommandations/generate
 * @desc    Générer des recommandations automatiques pour une parcelle
 * @access  Conseiller, Admin
 */
router.post('/generate',
  isConseiller,
  [
    body('parcelle_id').isUUID(),
    validate
  ],
  recommandationsController.generate
);

/**
 * @route   GET /api/recommandations/stats
 * @desc    Statistiques des recommandations
 * @access  Conseiller, Admin
 */
router.get('/stats/global', isConseiller, recommandationsController.getStats);

module.exports = router;
