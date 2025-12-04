/**
 * Routes de gestion des formations
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const formationsController = require('../controllers/formationsController');
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
 * @route   GET /api/formations
 * @desc    Lister les formations disponibles
 * @access  Producteur, Conseiller, Admin
 */
router.get('/', isProducteur, formationsController.getAllFormations);

/**
 * @route   GET /api/formations/mes-progressions
 * @desc    Obtenir mes progressions
 * @access  Producteur, Conseiller, Admin
 */
router.get('/mes-progressions', isProducteur, formationsController.getMyProgressions);

/**
 * @route   GET /api/formations/mes-formations
 * @desc    Obtenir mes formations inscrites
 * @access  Producteur, Conseiller, Admin
 */
router.get('/mes-formations', isProducteur, formationsController.getMesFormations);

/**
 * @route   GET /api/formations/stats
 * @desc    Statistiques des formations
 * @access  Conseiller, Admin
 */
router.get('/stats', isConseiller, formationsController.getStats);

/**
 * @route   POST /api/formations
 * @desc    Créer une nouvelle formation
 * @access  Conseiller, Admin
 */
router.post('/', 
  isConseiller,
  [
    body('titre').trim().notEmpty().isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 5000 }),
    body('type').notEmpty().isIn(['video', 'document', 'audio', 'interactif']),
    body('duree_minutes').optional().isInt({ min: 1 }),
    validate
  ],
  formationsController.createFormation
);

/**
 * @route   GET /api/formations/:id
 * @desc    Obtenir une formation par son ID
 * @access  Producteur, Conseiller, Admin
 */
router.get('/:id', schemas.paramUuid('id'), formationsController.getFormationById);

/**
 * @route   PUT /api/formations/:id
 * @desc    Mettre à jour une formation
 * @access  Conseiller, Admin
 */
router.put('/:id', isConseiller, schemas.paramUuid('id'), formationsController.updateFormation);

/**
 * @route   DELETE /api/formations/:id
 * @desc    Supprimer une formation
 * @access  Admin
 */
router.delete('/:id', isAdmin, schemas.paramUuid('id'), formationsController.deleteFormation);

/**
 * @route   POST /api/formations/:id/inscrire
 * @desc    S'inscrire à une formation
 * @access  Producteur, Conseiller, Admin
 */
router.post('/:id/inscrire', schemas.paramUuid('id'), formationsController.inscrireFormation);

/**
 * @route   PUT /api/formations/:id/progression
 * @desc    Mettre à jour la progression
 * @access  Producteur, Conseiller, Admin
 */
router.put('/:id/progression', schemas.paramUuid('id'), formationsController.updateProgression);

module.exports = router;
