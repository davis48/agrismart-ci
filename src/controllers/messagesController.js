/**
 * Contrôleur des Messages
 * AgriSmart CI - Système Agricole Intelligent
 * 
 * Table messages: id, user_id, destinataire_id, cooperative_id, est_public,
 *                 contenu, type, media_url, parcelle_id, alerte_id, lu, lu_at, created_at
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');

/* ========== CONVERSATIONS ========== */

exports.getConversations = async (req, res, next) => {
  try {
    // Récupérer les derniers messages par conversation
    const result = await db.query(`
      WITH conversations AS (
        SELECT DISTINCT 
          CASE WHEN user_id < destinataire_id 
            THEN user_id || '_' || destinataire_id 
            ELSE destinataire_id || '_' || user_id 
          END as conversation_id,
          CASE WHEN user_id = $1 THEN destinataire_id ELSE user_id END as contact_id
        FROM messages
        WHERE user_id = $1 OR destinataire_id = $1
      )
      SELECT c.conversation_id, c.contact_id,
             u.nom as contact_nom, u.prenoms as contact_prenom,
             (SELECT contenu FROM messages 
              WHERE (user_id = $1 AND destinataire_id = c.contact_id) 
                 OR (user_id = c.contact_id AND destinataire_id = $1)
              ORDER BY created_at DESC LIMIT 1) as dernier_message,
             (SELECT created_at FROM messages 
              WHERE (user_id = $1 AND destinataire_id = c.contact_id) 
                 OR (user_id = c.contact_id AND destinataire_id = $1)
              ORDER BY created_at DESC LIMIT 1) as dernier_message_date,
             (SELECT COUNT(*) FROM messages 
              WHERE destinataire_id = $1 AND user_id = c.contact_id AND lu = false) as non_lus
      FROM conversations c
      JOIN users u ON c.contact_id = u.id
      ORDER BY dernier_message_date DESC
    `, [req.user.id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.getConversation = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT m.*, 
             exp.nom as expediteur_nom, exp.prenoms as expediteur_prenom,
             dest.nom as destinataire_nom, dest.prenoms as destinataire_prenom
      FROM messages m
      JOIN users exp ON m.user_id = exp.id
      JOIN users dest ON m.destinataire_id = dest.id
      WHERE (m.user_id = $1 AND m.destinataire_id = $2)
         OR (m.user_id = $2 AND m.destinataire_id = $1)
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4
    `, [req.user.id, userId, limit, offset]);

    // Marquer les messages comme lus
    await db.query(
      `UPDATE messages SET lu = true, lu_at = NOW() 
       WHERE destinataire_id = $1 AND user_id = $2 AND lu = false`,
      [req.user.id, userId]
    );

    res.json({
      success: true,
      data: result.rows.reverse() // Remettre dans l'ordre chronologique
    });
  } catch (error) {
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { destinataire_id, contenu, type = 'texte' } = req.body;
    const media_url = req.body.media_url || null;

    // Vérifier que le destinataire existe
    const dest = await db.query('SELECT id, nom FROM users WHERE id = $1', [destinataire_id]);
    if (dest.rows.length === 0) {
      throw errors.notFound('Destinataire non trouvé');
    }

    // On ne peut pas s'envoyer un message à soi-même
    if (destinataire_id === req.user.id) {
      throw errors.badRequest('Vous ne pouvez pas vous envoyer un message');
    }

    const result = await db.query(
      'INSERT INTO messages (user_id, destinataire_id, contenu, type, media_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, destinataire_id, contenu, type, media_url]
    );

    const message = result.rows[0];

    // Émettre via Socket.IO si disponible
    const io = req.app.get('io');
    if (io) {
      io.to('user:' + destinataire_id).emit('nouveau_message', {
        ...message,
        expediteur_nom: req.user.nom
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message envoyé',
      data: message
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier que c'est l'expéditeur
    const message = await db.query(
      'SELECT user_id FROM messages WHERE id = $1',
      [id]
    );

    if (message.rows.length === 0) {
      throw errors.notFound('Message non trouvé');
    }

    if (message.rows[0].user_id !== req.user.id && req.user.role !== ROLES.ADMIN) {
      throw errors.forbidden('Vous ne pouvez supprimer que vos propres messages');
    }

    // Supprimer le message (vraie suppression)
    await db.query('DELETE FROM messages WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Message supprimé'
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE messages SET lu = true, lu_at = NOW() WHERE id = $1 AND destinataire_id = $2',
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Message marqué comme lu'
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;

    await db.query(
      'UPDATE messages SET lu = true, lu_at = NOW() WHERE destinataire_id = $1 AND user_id = $2 AND lu = false',
      [req.user.id, userId]
    );

    res.json({
      success: true,
      message: 'Messages marqués comme lus'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== NOTIFICATIONS (basées sur les alertes) ========== */

// Les notifications utilisent la table alertes
exports.getNotifications = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT a.id, a.niveau, a.titre, a.message, a.categorie, a.status,
             CASE WHEN a.lu_at IS NOT NULL THEN true ELSE false END as lue,
             a.lu_at, a.created_at
      FROM alertes a
      WHERE a.user_id = $1 
      ORDER BY a.created_at DESC 
      LIMIT 50
    `, [req.user.id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const messages = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE destinataire_id = $1 AND lu = false',
      [req.user.id]
    );

    // Utiliser alertes comme notifications (lu_at IS NULL = non lu)
    const notifications = await db.query(
      'SELECT COUNT(*) as count FROM alertes WHERE user_id = $1 AND lu_at IS NULL',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        messages: parseInt(messages.rows[0].count),
        notifications: parseInt(notifications.rows[0].count)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE alertes SET lu_at = NOW() WHERE id = $1 AND user_id = $2 AND lu_at IS NULL',
      [id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Notification marquée comme lue'
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE alertes SET lu_at = NOW() WHERE user_id = $1 AND lu_at IS NULL',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Toutes les notifications marquées comme lues'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== BROADCAST (Admin) ========== */

exports.broadcastMessage = async (req, res, next) => {
  try {
    const { titre, contenu, type = 'info', destinataires } = req.body;

    let userIds = [];

    if (destinataires === 'all') {
      const users = await db.query("SELECT id FROM users WHERE status = 'actif'");
      userIds = users.rows.map(u => u.id);
    } else if (destinataires === 'producteurs') {
      const users = await db.query("SELECT id FROM users WHERE role = 'producteur' AND status = 'actif'");
      userIds = users.rows.map(u => u.id);
    } else if (Array.isArray(destinataires)) {
      userIds = destinataires;
    }

    // Créer les alertes comme notifications (utiliser les colonnes correctes)
    for (const userId of userIds) {
      await db.query(
        "INSERT INTO alertes (user_id, niveau, titre, message, categorie) VALUES ($1, 'info', $2, $3, $4)",
        [userId, titre, contenu, type]
      );
    }

    // Émettre via Socket.IO
    const io = req.app.get('io');
    if (io) {
      for (const userId of userIds) {
        io.to('user:' + userId).emit('notification', {
          type,
          titre,
          message: contenu
        });
      }
    }

    logger.audit('Broadcast message', { userId: req.user.id, destinataires: userIds.length });

    res.json({
      success: true,
      message: 'Message envoyé à ' + userIds.length + ' utilisateurs'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== CONTACTS ========== */

exports.getContacts = async (req, res, next) => {
  try {
    // Récupérer les utilisateurs avec qui on a déjà échangé + les conseillers
    const result = await db.query(`
      SELECT DISTINCT u.id, u.nom, u.prenoms, u.role, u.region_id
      FROM users u
      WHERE u.id != $1 AND u.status = 'actif'
      AND (
        u.role IN ('conseiller', 'admin')
        OR u.id IN (
          SELECT DISTINCT user_id FROM messages WHERE destinataire_id = $1
          UNION
          SELECT DISTINCT destinataire_id FROM messages WHERE user_id = $1
        )
      )
      ORDER BY u.nom
    `, [req.user.id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const result = await db.query(`
      SELECT id, nom, prenoms, role, region_id
      FROM users 
      WHERE status = 'actif' 
      AND id != $1
      AND (nom ILIKE $2 OR prenoms ILIKE $2 OR telephone ILIKE $2)
      ORDER BY nom
      LIMIT 20
    `, [req.user.id, '%' + q + '%']);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};
