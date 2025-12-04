/**
 * Routes de gestion des capteurs et stations
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const capteursController = require('../controllers/capteursController');
const { 
  authenticate, 
  isProducteur, 
  isConseiller,
  isAdmin,
  requireCapteurAccess,
  schemas 
} = require('../middlewares');

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/* ========== STATIONS ========== */

/**
 * @route   GET /api/capteurs/stations
 * @desc    Lister toutes les stations
 * @access  Producteur, Conseiller, Admin
 */
router.get('/stations', isProducteur, schemas.pagination, capteursController.getAllStations);

/**
 * @route   POST /api/capteurs/stations
 * @desc    Créer une nouvelle station
 * @access  Producteur, Conseiller, Admin
 */
router.post('/stations', isProducteur, schemas.createStation, capteursController.createStation);

/**
 * @route   GET /api/capteurs/stations/:id
 * @desc    Obtenir une station par son ID
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/stations/:id', schemas.paramUuid('id'), capteursController.getStationById);

/**
 * @route   PUT /api/capteurs/stations/:id
 * @desc    Mettre à jour une station
 * @access  Propriétaire, Admin
 */
router.put('/stations/:id', schemas.paramUuid('id'), capteursController.updateStation);

/**
 * @route   DELETE /api/capteurs/stations/:id
 * @desc    Supprimer une station
 * @access  Propriétaire, Admin
 */
router.delete('/stations/:id', schemas.paramUuid('id'), capteursController.deleteStation);

/* ========== CAPTEURS ========== */

/**
 * @route   GET /api/capteurs
 * @desc    Lister tous les capteurs
 * @access  Producteur, Conseiller, Admin
 */
router.get('/', isProducteur, schemas.pagination, capteursController.getAll);

/**
 * @route   GET /api/capteurs/stats
 * @desc    Statistiques des capteurs
 * @access  Conseiller, Admin
 */
router.get('/stats', isConseiller, capteursController.getStats);

/**
 * @route   POST /api/capteurs
 * @desc    Enregistrer un nouveau capteur
 * @access  Producteur, Conseiller, Admin
 */
router.post('/', isProducteur, schemas.createCapteur, capteursController.create);

/**
 * @route   GET /api/capteurs/:id
 * @desc    Obtenir un capteur par son ID
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/:id', schemas.paramUuid('id'), requireCapteurAccess, capteursController.getById);

/**
 * @route   PUT /api/capteurs/:id
 * @desc    Mettre à jour un capteur
 * @access  Propriétaire, Admin
 */
router.put('/:id', schemas.paramUuid('id'), requireCapteurAccess, capteursController.update);

/**
 * @route   DELETE /api/capteurs/:id
 * @desc    Supprimer un capteur
 * @access  Propriétaire, Admin
 */
router.delete('/:id', schemas.paramUuid('id'), requireCapteurAccess, capteursController.delete);

/**
 * @route   PUT /api/capteurs/:id/calibrate
 * @desc    Calibrer un capteur
 * @access  Admin
 */
router.put('/:id/calibrate', isAdmin, schemas.paramUuid('id'), capteursController.calibrate);

/**
 * @route   GET /api/capteurs/:id/mesures
 * @desc    Obtenir les mesures d'un capteur
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/:id/mesures', schemas.paramUuid('id'), requireCapteurAccess, capteursController.getMesures);

/**
 * @route   GET /api/capteurs/:id/status
 * @desc    Obtenir le statut d'un capteur
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/:id/status', schemas.paramUuid('id'), requireCapteurAccess, capteursController.getStatus);

module.exports = router;
