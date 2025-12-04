/**
 * Routes d'ingestion des mesures IoT
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const mesuresController = require('../controllers/mesuresController');
const { 
  authenticate, 
  isProducteur,
  isConseiller,
  schemas,
  body,
  validate
} = require('../middlewares');

// Middleware d'authentification pour les endpoints protégés
router.use(authenticate);

/**
 * @route   POST /api/mesures
 * @desc    Enregistrer une nouvelle mesure
 * @access  Producteur, Conseiller, Admin (ou via API key IoT)
 */
router.post('/', isProducteur, schemas.sendMesure, mesuresController.create);

/**
 * @route   POST /api/mesures/batch
 * @desc    Enregistrer plusieurs mesures en lot
 * @access  Producteur, Conseiller, Admin
 */
router.post('/batch', 
  isProducteur,
  [
    body('mesures')
      .isArray({ min: 1, max: 100 })
      .withMessage('Le tableau de mesures doit contenir entre 1 et 100 éléments'),
    body('mesures.*.capteur_id')
      .isUUID()
      .withMessage('capteur_id doit être un UUID valide'),
    body('mesures.*.valeur')
      .isFloat()
      .withMessage('La valeur doit être un nombre'),
    validate
  ],
  mesuresController.createBatch
);

/**
 * @route   GET /api/mesures
 * @desc    Obtenir les mesures avec filtres
 * @access  Producteur, Conseiller, Admin
 */
router.get('/', isProducteur, schemas.pagination, mesuresController.getAll);

/**
 * @route   GET /api/mesures/latest
 * @desc    Obtenir les dernières mesures par capteur
 * @access  Producteur, Conseiller, Admin
 */
router.get('/latest', isProducteur, mesuresController.getLatest);

/**
 * @route   GET /api/mesures/stats
 * @desc    Statistiques des mesures
 * @access  Conseiller, Admin
 */
router.get('/stats', isConseiller, mesuresController.getStats);

/**
 * @route   GET /api/mesures/aggregated
 * @desc    Données agrégées (moyennes horaires/journalières)
 * @access  Producteur, Conseiller, Admin
 */
router.get('/aggregated', isProducteur, mesuresController.getAggregated);

/**
 * @route   GET /api/mesures/export
 * @desc    Exporter les mesures en CSV
 * @access  Producteur, Conseiller, Admin
 */
router.get('/export', isProducteur, mesuresController.exportCsv);

/**
 * @route   GET /api/mesures/:id
 * @desc    Obtenir une mesure par son ID
 * @access  Producteur, Conseiller, Admin
 */
router.get('/:id', schemas.paramUuid('id'), mesuresController.getById);

/**
 * @route   DELETE /api/mesures/:id
 * @desc    Supprimer une mesure
 * @access  Admin
 */
router.delete('/:id', schemas.paramUuid('id'), mesuresController.delete);

module.exports = router;
