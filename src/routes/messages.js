/**
 * Routes de messagerie
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');
const { 
  authenticate, 
  isProducteur,
  isAdmin,
  schemas,
  body,
  validate
} = require('../middlewares');

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * @route   GET /api/messages/conversations
 * @desc    Lister les conversations de l'utilisateur
 * @access  Producteur, Conseiller, Admin
 */
router.get('/conversations', isProducteur, messagesController.getConversations);

/**
 * @route   GET /api/messages/conversations/:userId
 * @desc    Obtenir les messages d'une conversation
 * @access  Producteur, Conseiller, Admin
 */
router.get('/conversations/:userId', schemas.paramUuid('userId'), messagesController.getConversation);

/**
 * @route   POST /api/messages
 * @desc    Envoyer un message
 * @access  Producteur, Conseiller, Admin
 */
router.post('/', 
  isProducteur,
  [
    body('destinataire_id').isUUID(),
    body('contenu').trim().notEmpty().isLength({ max: 2000 }),
    body('type').optional().isIn(['texte', 'image', 'document', 'audio']),
    validate
  ],
  messagesController.sendMessage
);

/**
 * @route   GET /api/messages/unread
 * @desc    Obtenir le nombre de messages non lus
 * @access  Producteur, Conseiller, Admin
 */
router.get('/unread', isProducteur, messagesController.getUnreadCount);

/**
 * @route   GET /api/messages/notifications
 * @desc    Obtenir les notifications
 * @access  Producteur, Conseiller, Admin
 */
router.get('/notifications', isProducteur, messagesController.getNotifications);

/**
 * @route   GET /api/messages/contacts
 * @desc    Obtenir la liste des contacts
 * @access  Producteur, Conseiller, Admin
 */
router.get('/contacts', isProducteur, messagesController.getContacts);

/**
 * @route   GET /api/messages/contacts/search
 * @desc    Rechercher des utilisateurs
 * @access  Producteur, Conseiller, Admin
 */
router.get('/contacts/search', isProducteur, messagesController.searchUsers);

/**
 * @route   PUT /api/messages/:id/read
 * @desc    Marquer un message comme lu
 * @access  Destinataire
 */
router.put('/:id/read', schemas.paramUuid('id'), messagesController.markAsRead);

/**
 * @route   PUT /api/messages/conversations/:userId/read
 * @desc    Marquer tous les messages d'une conversation comme lus
 * @access  Producteur, Conseiller, Admin
 */
router.put('/conversations/:userId/read', schemas.paramUuid('userId'), messagesController.markAllAsRead);

/**
 * @route   PUT /api/messages/notifications/:id/read
 * @desc    Marquer une notification comme lue
 * @access  Producteur, Conseiller, Admin
 */
router.put('/notifications/:id/read', messagesController.markNotificationRead);

/**
 * @route   PUT /api/messages/notifications/read-all
 * @desc    Marquer toutes les notifications comme lues
 * @access  Producteur, Conseiller, Admin
 */
router.put('/notifications/read-all', messagesController.markAllNotificationsRead);

/**
 * @route   POST /api/messages/broadcast
 * @desc    Envoyer un message à plusieurs utilisateurs (Admin)
 * @access  Admin
 */
router.post('/broadcast', isAdmin, messagesController.broadcastMessage);

/**
 * @route   DELETE /api/messages/:id
 * @desc    Supprimer un message
 * @access  Expéditeur
 */
router.delete('/:id', schemas.paramUuid('id'), messagesController.deleteMessage);

module.exports = router;
