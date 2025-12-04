/**
 * Routes de gestion des cultures et plantations
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const culturesController = require('../controllers/culturesController');
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

/* ========== CULTURES (Catalogue) ========== */

/**
 * @route   GET /api/cultures
 * @desc    Lister toutes les cultures disponibles
 * @access  Producteur, Conseiller, Admin
 */
router.get('/', isProducteur, schemas.pagination, culturesController.getAll);

/**
 * @route   GET /api/cultures/search
 * @desc    Rechercher une culture
 * @access  Producteur, Conseiller, Admin
 */
router.get('/search', isProducteur, culturesController.search);

/**
 * @route   POST /api/cultures
 * @desc    Ajouter une nouvelle culture au catalogue
 * @access  Admin
 */
router.post('/', 
  isAdmin,
  [
    body('nom').trim().notEmpty().isLength({ max: 100 }),
    body('nom_scientifique').optional().trim().isLength({ max: 150 }),
    body('categorie').optional().isIn(['cereale', 'legume', 'fruit', 'tubercule', 'oleagineux', 'autre']),
    body('cycle_jours').optional().isInt({ min: 1 }),
    body('temp_min').optional().isFloat(),
    body('temp_max').optional().isFloat(),
    body('humidite_min').optional().isFloat({ min: 0, max: 100 }),
    body('humidite_max').optional().isFloat({ min: 0, max: 100 }),
    body('ph_min').optional().isFloat({ min: 0, max: 14 }),
    body('ph_max').optional().isFloat({ min: 0, max: 14 }),
    validate
  ],
  culturesController.create
);

/**
 * @route   GET /api/cultures/:id
 * @desc    Obtenir une culture par son ID
 * @access  Producteur, Conseiller, Admin
 */
router.get('/:id', schemas.paramUuid('id'), culturesController.getById);

/**
 * @route   PUT /api/cultures/:id
 * @desc    Mettre à jour une culture
 * @access  Admin
 */
router.put('/:id', isAdmin, schemas.paramUuid('id'), culturesController.update);

/**
 * @route   DELETE /api/cultures/:id
 * @desc    Supprimer une culture
 * @access  Admin
 */
router.delete('/:id', isAdmin, schemas.paramUuid('id'), culturesController.delete);

/* ========== PLANTATIONS ========== */

/**
 * @route   GET /api/cultures/plantations
 * @desc    Lister les plantations de l'utilisateur
 * @access  Producteur, Conseiller, Admin
 */
router.get('/plantations/all', isProducteur, schemas.pagination, culturesController.getAllPlantations);

/**
 * @route   POST /api/cultures/plantations
 * @desc    Créer une nouvelle plantation
 * @access  Producteur, Conseiller, Admin
 */
router.post('/plantations', 
  isProducteur,
  [
    body('parcelle_id').isUUID(),
    body('culture_id').isUUID(),
    body('date_plantation').isISO8601().toDate(),
    body('superficie').isFloat({ min: 0.01 }),
    body('date_recolte_prevue').optional().isISO8601().toDate(),
    body('quantite_semence').optional().isFloat({ min: 0 }),
    body('notes').optional().trim().isLength({ max: 1000 }),
    validate
  ],
  culturesController.createPlantation
);

/**
 * @route   GET /api/cultures/plantations/:id
 * @desc    Obtenir une plantation par son ID
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/plantations/:id', schemas.paramUuid('id'), culturesController.getPlantationById);

/**
 * @route   PUT /api/cultures/plantations/:id
 * @desc    Mettre à jour une plantation
 * @access  Propriétaire, Conseiller, Admin
 */
router.put('/plantations/:id', schemas.paramUuid('id'), culturesController.updatePlantation);

/**
 * @route   PUT /api/cultures/plantations/:id/recolte
 * @desc    Enregistrer la récolte d'une plantation
 * @access  Propriétaire, Conseiller, Admin
 */
router.put('/plantations/:id/recolte',
  [
    body('date_recolte').isISO8601().toDate(),
    body('quantite_recoltee').isFloat({ min: 0 }),
    body('qualite').optional().isIn(['excellent', 'bon', 'moyen', 'mauvais']),
    body('notes').optional().trim().isLength({ max: 1000 }),
    validate
  ],
  culturesController.recordRecolte
);

/**
 * @route   DELETE /api/cultures/plantations/:id
 * @desc    Supprimer une plantation
 * @access  Propriétaire, Admin
 */
router.delete('/plantations/:id', schemas.paramUuid('id'), culturesController.deletePlantation);

module.exports = router;
