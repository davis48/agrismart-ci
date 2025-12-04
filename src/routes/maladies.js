/**
 * Routes de gestion des maladies et détection IA
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const maladiesController = require('../controllers/maladiesController');
const { 
  authenticate, 
  isProducteur, 
  isConseiller,
  isAdmin,
  schemas,
  body,
  validate
} = require('../middlewares');
const multer = require('multer');

// Configuration de multer pour l'upload d'images
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
    files: 5
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont acceptées'), false);
    }
  }
});

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/* ========== CATALOGUE DES MALADIES ========== */

/**
 * @route   GET /api/maladies
 * @desc    Lister toutes les maladies
 * @access  Producteur, Conseiller, Admin
 */
router.get('/', isProducteur, schemas.pagination, maladiesController.getAll);

/**
 * @route   GET /api/maladies/search
 * @desc    Rechercher une maladie
 * @access  Producteur, Conseiller, Admin
 */
router.get('/search', isProducteur, maladiesController.search);

/**
 * @route   POST /api/maladies
 * @desc    Ajouter une nouvelle maladie au catalogue
 * @access  Admin
 */
router.post('/', 
  isAdmin,
  [
    body('nom').trim().notEmpty().isLength({ max: 100 }),
    body('nom_scientifique').optional().trim().isLength({ max: 150 }),
    body('type').isIn(['fongique', 'bacterienne', 'virale', 'parasitaire', 'carence', 'autre']),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('symptomes').optional().trim().isLength({ max: 2000 }),
    body('traitements').optional().trim().isLength({ max: 2000 }),
    body('prevention').optional().trim().isLength({ max: 2000 }),
    body('cultures_affectees').optional().isArray(),
    validate
  ],
  maladiesController.create
);

/**
 * @route   GET /api/maladies/:id
 * @desc    Obtenir une maladie par son ID
 * @access  Producteur, Conseiller, Admin
 */
router.get('/:id', schemas.paramUuid('id'), maladiesController.getById);

/**
 * @route   PUT /api/maladies/:id
 * @desc    Mettre à jour une maladie
 * @access  Admin
 */
router.put('/:id', isAdmin, schemas.paramUuid('id'), maladiesController.update);

/**
 * @route   DELETE /api/maladies/:id
 * @desc    Supprimer une maladie
 * @access  Admin
 */
router.delete('/:id', isAdmin, schemas.paramUuid('id'), maladiesController.delete);

/* ========== DÉTECTION IA ========== */

/**
 * @route   POST /api/maladies/detect
 * @desc    Détecter une maladie à partir d'une image
 * @access  Producteur, Conseiller, Admin
 */
router.post('/detect', 
  isProducteur,
  upload.single('image'),
  [
    body('parcelle_id').optional().isUUID(),
    body('culture_id').optional().isUUID(),
    body('description').optional().trim().isLength({ max: 500 }),
    validate
  ],
  maladiesController.detectFromImage
);

/**
 * @route   POST /api/maladies/detect/batch
 * @desc    Détecter des maladies à partir de plusieurs images
 * @access  Producteur, Conseiller, Admin
 */
router.post('/detect/batch', 
  isProducteur,
  upload.array('images', 5),
  maladiesController.detectFromImageBatch
);

/* ========== HISTORIQUE DES DÉTECTIONS ========== */

/**
 * @route   GET /api/maladies/detections
 * @desc    Historique des détections de l'utilisateur
 * @access  Producteur, Conseiller, Admin
 */
router.get('/detections/history', isProducteur, schemas.pagination, maladiesController.getDetections);

/**
 * @route   GET /api/maladies/detections/:id
 * @desc    Obtenir une détection par son ID
 * @access  Propriétaire, Conseiller, Admin
 */
router.get('/detections/:id', schemas.paramUuid('id'), maladiesController.getDetectionById);

/**
 * @route   PUT /api/maladies/detections/:id/confirm
 * @desc    Confirmer ou corriger une détection
 * @access  Propriétaire, Conseiller, Admin
 */
router.put('/detections/:id/confirm',
  [
    body('confirmed').isBoolean(),
    body('maladie_corrigee_id').optional().isUUID(),
    body('notes').optional().trim().isLength({ max: 500 }),
    validate
  ],
  maladiesController.confirmDetection
);

/**
 * @route   GET /api/maladies/stats
 * @desc    Statistiques des maladies détectées
 * @access  Conseiller, Admin
 */
router.get('/stats/global', isConseiller, maladiesController.getStats);

module.exports = router;
