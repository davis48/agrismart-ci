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
    body('description').trim().notEmpty().isLength({ max: 5000 }),
    body('type').optional().isIn(['video', 'tutoriel', 'pratique', 'webinaire']),
    body('niveau').optional().isIn(['debutant', 'intermediaire', 'avance']),
    body('duree_estimee').optional().isInt({ min: 1 }),
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
 * @route   POST /api/formations/:id/modules
 * @desc    Ajouter un module à une formation
 * @access  Conseiller, Admin
 */
router.post('/:id/modules', 
  isConseiller, 
  schemas.paramUuid('id'),
  [
    body('titre').trim().notEmpty(),
    body('contenu').trim().notEmpty(),
    body('ordre').isInt({ min: 1 }),
    validate
  ],
  formationsController.addModule
);

/**
 * @route   PUT /api/formations/modules/:moduleId
 * @desc    Mettre à jour un module
 * @access  Conseiller, Admin
 */
router.put('/modules/:moduleId', isConseiller, formationsController.updateModule);

/**
 * @route   DELETE /api/formations/modules/:moduleId
 * @desc    Supprimer un module
 * @access  Conseiller, Admin
 */
router.delete('/modules/:moduleId', isConseiller, formationsController.deleteModule);

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

/**
 * @route   GET /api/formations/modules/:moduleId/quiz
 * @desc    Obtenir le quiz d'un module
 * @access  Producteur, Conseiller, Admin
 */
router.get('/modules/:moduleId/quiz', formationsController.getQuiz);

/**
 * @route   POST /api/formations/modules/:moduleId/quiz
 * @desc    Soumettre les réponses du quiz
 * @access  Producteur, Conseiller, Admin
 */
router.post('/modules/:moduleId/quiz', formationsController.submitQuiz);

module.exports = router;
