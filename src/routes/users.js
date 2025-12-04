/**
 * Routes de gestion des utilisateurs
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticate, isAdmin, isConseiller, schemas } = require('../middlewares');

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Lister tous les utilisateurs (avec pagination et filtres)
 * @access  Admin, Conseiller
 */
router.get('/', isConseiller, schemas.pagination, usersController.getAll);

/**
 * @route   GET /api/users/stats
 * @desc    Statistiques des utilisateurs
 * @access  Admin
 */
router.get('/stats', isAdmin, usersController.getStats);

/**
 * @route   GET /api/users/producteurs
 * @desc    Lister les producteurs
 * @access  Admin, Conseiller
 */
router.get('/producteurs', isConseiller, schemas.pagination, usersController.getProducteurs);

/**
 * @route   GET /api/users/:id
 * @desc    Obtenir un utilisateur par son ID
 * @access  Admin, Conseiller
 */
router.get('/:id', isConseiller, schemas.paramUuid('id'), usersController.getById);

/**
 * @route   POST /api/users
 * @desc    Créer un nouvel utilisateur
 * @access  Admin
 */
router.post('/', isAdmin, usersController.create);

/**
 * @route   PUT /api/users/:id
 * @desc    Mettre à jour un utilisateur
 * @access  Admin
 */
router.put('/:id', isAdmin, schemas.paramUuid('id'), usersController.update);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Changer le statut d'un utilisateur
 * @access  Admin
 */
router.put('/:id/status', isAdmin, schemas.paramUuid('id'), usersController.updateStatus);

/**
 * @route   DELETE /api/users/:id
 * @desc    Supprimer un utilisateur
 * @access  Admin
 */
router.delete('/:id', isAdmin, schemas.paramUuid('id'), usersController.delete);

/**
 * @route   GET /api/users/:id/parcelles
 * @desc    Obtenir les parcelles d'un utilisateur
 * @access  Admin, Conseiller
 */
router.get('/:id/parcelles', isConseiller, schemas.paramUuid('id'), usersController.getParcelles);

/**
 * @route   GET /api/users/:id/alertes
 * @desc    Obtenir les alertes d'un utilisateur
 * @access  Admin, Conseiller
 */
router.get('/:id/alertes', isConseiller, schemas.paramUuid('id'), usersController.getAlertes);

module.exports = router;
