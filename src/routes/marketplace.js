/**
 * Routes du Marketplace
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplaceController');
const { 
  authenticate, 
  isProducteur, 
  isPartenaire,
  isConseiller,
  isAdmin,
  schemas,
  body,
  validate
} = require('../middlewares');
const multer = require('multer');

// Configuration multer pour les images de produits
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
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

/* ========== PRODUITS ========== */

/**
 * @route   GET /api/marketplace/produits
 * @desc    Lister les produits disponibles
 * @access  Producteur, Partenaire, Conseiller, Admin
 */
router.get('/produits', isProducteur, schemas.pagination, marketplaceController.getAllProduits);

/**
 * @route   GET /api/marketplace/produits/search
 * @desc    Rechercher des produits
 * @access  Producteur, Partenaire, Conseiller, Admin
 */
router.get('/produits/search', isProducteur, marketplaceController.searchProduits);

/**
 * @route   GET /api/marketplace/produits/mes-produits
 * @desc    Lister mes produits en vente
 * @access  Producteur, Partenaire
 */
router.get('/produits/mes-produits', isProducteur, schemas.pagination, marketplaceController.getMyProduits);

/**
 * @route   POST /api/marketplace/produits
 * @desc    Ajouter un produit à vendre
 * @access  Producteur, Partenaire
 */
router.post('/produits', 
  isProducteur,
  upload.array('images', 5),
  [
    body('nom').trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('categorie')
      .isIn(['cereale', 'legume', 'fruit', 'tubercule', 'oleagineux', 'intrant', 'equipement', 'autre']),
    body('prix').isFloat({ min: 0 }),
    body('unite').optional().isIn(['kg', 'tonne', 'unite', 'sac', 'litre']),
    body('quantite_disponible').isFloat({ min: 0 }),
    body('localisation').optional().trim().isLength({ max: 255 }),
    validate
  ],
  marketplaceController.createProduit
);

/**
 * @route   GET /api/marketplace/produits/:id
 * @desc    Obtenir un produit par son ID
 * @access  Producteur, Partenaire, Conseiller, Admin
 */
router.get('/produits/:id', schemas.paramUuid('id'), marketplaceController.getProduitById);

/**
 * @route   PUT /api/marketplace/produits/:id
 * @desc    Mettre à jour un produit
 * @access  Propriétaire, Admin
 */
router.put('/produits/:id', schemas.paramUuid('id'), upload.array('images', 5), marketplaceController.updateProduit);

/**
 * @route   DELETE /api/marketplace/produits/:id
 * @desc    Supprimer un produit
 * @access  Propriétaire, Admin
 */
router.delete('/produits/:id', schemas.paramUuid('id'), marketplaceController.deleteProduit);

/* ========== COMMANDES ========== */

/**
 * @route   GET /api/marketplace/commandes
 * @desc    Lister mes commandes (acheteur ou vendeur)
 * @access  Producteur, Partenaire
 */
router.get('/commandes', isProducteur, schemas.pagination, marketplaceController.getCommandes);

/**
 * @route   POST /api/marketplace/commandes
 * @desc    Passer une commande
 * @access  Producteur, Partenaire
 */
router.post('/commandes',
  isProducteur,
  [
    body('produit_id').isUUID(),
    body('quantite').isFloat({ min: 0.01 }),
    body('adresse_livraison').optional().trim().isLength({ max: 500 }),
    body('notes').optional().trim().isLength({ max: 500 }),
    validate
  ],
  marketplaceController.createCommande
);

/**
 * @route   GET /api/marketplace/commandes/:id
 * @desc    Obtenir une commande par son ID
 * @access  Acheteur, Vendeur, Admin
 */
router.get('/commandes/:id', schemas.paramUuid('id'), marketplaceController.getCommandeById);

/**
 * @route   PUT /api/marketplace/commandes/:id/status
 * @desc    Mettre à jour le statut d'une commande
 * @access  Vendeur, Admin
 */
router.put('/commandes/:id/status',
  [
    body('statut')
      .isIn(['en_attente', 'confirmee', 'en_preparation', 'expediee', 'livree', 'annulee'])
      .withMessage('Statut invalide'),
    body('notes').optional().trim().isLength({ max: 500 }),
    validate
  ],
  marketplaceController.updateCommandeStatus
);

/**
 * @route   PUT /api/marketplace/commandes/:id/cancel
 * @desc    Annuler une commande
 * @access  Acheteur, Vendeur, Admin
 */
router.put('/commandes/:id/cancel',
  [
    body('raison').optional().trim().isLength({ max: 500 }),
    validate
  ],
  marketplaceController.cancelCommande
);

/* ========== STATISTIQUES ========== */

/**
 * @route   GET /api/marketplace/stats
 * @desc    Statistiques du marketplace
 * @access  Conseiller, Admin
 */
router.get('/stats', isConseiller, marketplaceController.getStats);

/**
 * @route   GET /api/marketplace/stats/vendeur
 * @desc    Statistiques pour un vendeur
 * @access  Producteur, Partenaire
 */
router.get('/stats/vendeur', isProducteur, marketplaceController.getVendeurStats);

module.exports = router;
