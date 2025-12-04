/**
 * Contrôleur des Messages
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');

/* ========== CONVERSATIONS ========== */

exports.getConversations = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT ON (conversation_id) 
        m.*,
        CASE WHEN m.expediteur_id = $1 THEN dest.nom ELSE exp.nom END as contact_nom,
        CASE WHEN m.expediteur_id = $1 THEN dest.prenom ELSE exp.prenom END as contact_prenom,
        CASE WHEN m.expediteur_id = $1 THEN m.destinataire_id ELSE m.expediteur_id END as contact_id,
        (SELECT COUNT(*) FROM messages 
         WHERE destinataire_id = $1 
         AND expediteur_id = CASE WHEN m.expediteur_id = $1 THEN m.destinataire_id ELSE m.expediteur_id END
         AND lu = false) as non_lus
      FROM messages m
      JOIN users exp ON m.expediteur_id = exp.id
      JOIN users dest ON m.destinataire_id = dest.id
      WHERE m.expediteur_id = $1 OR m.destinataire_id = $1
      ORDER BY conversation_id, m.created_at DESC
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

    // Générer l'ID de conversation (toujours le même peu importe l'ordre)
    const ids = [req.user.id, userId].sort();
    const conversationId = `${ids[0]}_${ids[1]}`;

    const result = await db.query(`
      SELECT m.*, 
             exp.nom as expediteur_nom, exp.prenom as expediteur_prenom,
             dest.nom as destinataire_nom, dest.prenom as destinataire_prenom
      FROM messages m
      JOIN users exp ON m.expediteur_id = exp.id
      JOIN users dest ON m.destinataire_id = dest.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, offset]);

    // Marquer les messages comme lus
    await db.query(
      `UPDATE messages SET lu = true, date_lecture = NOW() 
       WHERE destinataire_id = $1 AND expediteur_id = $2 AND lu = false`,
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
    const { destinataire_id, contenu, type = 'texte', fichier_url } = req.body;

    // Vérifier que le destinataire existe
    const dest = await db.query(`SELECT id, nom FROM users WHERE id = $1`, [destinataire_id]);
    if (dest.rows.length === 0) {
      throw errors.notFound('Destinataire non trouvé');
    }

    // On ne peut pas s'envoyer un message à soi-même
    if (destinataire_id === req.user.id) {
      throw errors.badRequest('Vous ne pouvez pas vous envoyer un message');
    }

    // Générer l'ID de conversation
    const ids = [req.user.id, destinataire_id].sort();
    const conversationId = `${ids[0]}_${ids[1]}`;

    const result = await db.query(
      `INSERT INTO messages (conversation_id, expediteur_id, destinataire_id, contenu, type, fichier_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [conversationId, req.user.id, destinataire_id, contenu, type, fichier_url]
    );

    const message = result.rows[0];

    // Émettre via Socket.IO si disponible
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${destinataire_id}`).emit('nouveau_message', {
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
      `SELECT expediteur_id FROM messages WHERE id = $1`,
      [id]
    );

    if (message.rows.length === 0) {
      throw errors.notFound('Message non trouvé');
    }

    if (message.rows[0].expediteur_id !== req.user.id && req.user.role !== ROLES.ADMIN) {
      throw errors.forbidden('Vous ne pouvez supprimer que vos propres messages');
    }

    await db.query(
      `UPDATE messages SET supprime = true WHERE id = $1`,
      [id]
    );

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
      `UPDATE messages SET lu = true, date_lecture = NOW() 
       WHERE id = $1 AND destinataire_id = $2`,
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
      `UPDATE messages SET lu = true, date_lecture = NOW() 
       WHERE destinataire_id = $1 AND expediteur_id = $2 AND lu = false`,
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

/* ========== NOTIFICATIONS ========== */

exports.getNotifications = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
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
      `SELECT COUNT(*) as count FROM messages WHERE destinataire_id = $1 AND lu = false`,
      [req.user.id]
    );

    const notifications = await db.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND lue = false`,
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
      `UPDATE notifications SET lue = true WHERE id = $1 AND user_id = $2`,
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
      `UPDATE notifications SET lue = true WHERE user_id = $1 AND lue = false`,
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
      const users = await db.query(`SELECT id FROM users WHERE actif = true`);
      userIds = users.rows.map(u => u.id);
    } else if (destinataires === 'producteurs') {
      const users = await db.query(`SELECT id FROM users WHERE role = 'producteur' AND actif = true`);
      userIds = users.rows.map(u => u.id);
    } else if (Array.isArray(destinataires)) {
      userIds = destinataires;
    }

    // Créer les notifications
    const values = userIds.map(userId => 
      `('${userId}', '${type}', '${titre}', '${contenu}')`
    ).join(',');

    if (values) {
      await db.query(`
        INSERT INTO notifications (user_id, type, titre, message) VALUES ${values}
      `);
    }

    // Émettre via Socket.IO
    const io = req.app.get('io');
    if (io) {
      for (const userId of userIds) {
        io.to(`user_${userId}`).emit('notification', {
          type,
          titre,
          message: contenu
        });
      }
    }

    logger.audit('Broadcast message', { userId: req.user.id, destinataires: userIds.length });

    res.json({
      success: true,
      message: `Message envoyé à ${userIds.length} utilisateurs`
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
      SELECT DISTINCT u.id, u.nom, u.prenom, u.role, u.localisation
      FROM users u
      WHERE u.id != $1 AND u.actif = true
      AND (
        u.role IN ('conseiller', 'admin')
        OR u.id IN (
          SELECT DISTINCT expediteur_id FROM messages WHERE destinataire_id = $1
          UNION
          SELECT DISTINCT destinataire_id FROM messages WHERE expediteur_id = $1
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
      SELECT id, nom, prenom, role, localisation
      FROM users 
      WHERE actif = true 
      AND id != $1
      AND (nom ILIKE $2 OR prenom ILIKE $2 OR telephone ILIKE $2)
      ORDER BY nom
      LIMIT 20
    `, [req.user.id, `%${q}%`]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};
