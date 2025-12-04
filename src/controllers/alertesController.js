/**
 * Contrôleur des alertes
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

/**
 * Obtenir toutes les alertes
 */
exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { categorie, niveau, status } = req.query;

    let query = `
      SELECT a.*, p.nom as parcelle_nom
      FROM alertes a
      LEFT JOIN parcelles p ON a.parcelle_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND a.user_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (categorie) {
      query += ` AND a.categorie = $${paramIndex++}`;
      params.push(categorie);
    }

    if (niveau) {
      query += ` AND a.niveau = $${paramIndex++}`;
      params.push(niveau);
    }

    if (status) {
      query += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les alertes non lues
 */
exports.getUnread = async (req, res, next) => {
  try {
    let query = `
      SELECT a.*, p.nom as parcelle_nom
      FROM alertes a
      LEFT JOIN parcelles p ON a.parcelle_id = p.id
      WHERE a.lu_at IS NULL
    `;
    const params = [];

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND a.user_id = $1`;
      params.push(req.user.id);
    }

    query += ` ORDER BY a.niveau DESC, a.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Statistiques des alertes
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE lu_at IS NULL) as non_lues,
        COUNT(*) FILTER (WHERE status = 'nouvelle') as nouvelles,
        COUNT(*) FILTER (WHERE niveau = 'critique') as critiques,
        COUNT(*) FILTER (WHERE niveau = 'avertissement') as warning,
        COUNT(*) FILTER (WHERE niveau = 'information') as info,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as dernieres_24h
      FROM alertes
    `);

    const parCategorie = await db.query(`
      SELECT categorie, COUNT(*) as count
      FROM alertes
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY categorie
    `);

    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        par_categorie: parCategorie.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Créer une alerte manuellement
 */
exports.create = async (req, res, next) => {
  try {
    const { categorie, niveau, titre, message, parcelle_id, destinataires } = req.body;

    // Si des destinataires spécifiques sont fournis
    if (destinataires && Array.isArray(destinataires)) {
      const alertes = [];
      for (const userId of destinataires) {
        const result = await db.query(
          `INSERT INTO alertes (user_id, parcelle_id, categorie, niveau, titre, message)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [userId, parcelle_id, categorie, niveau, titre, message]
        );
        alertes.push(result.rows[0]);

        // Envoyer notification
        await notificationService.sendAlert(userId, result.rows[0]);
      }

      return res.status(201).json({
        success: true,
        message: `${alertes.length} alertes créées`,
        data: alertes
      });
    }

    // Sinon, créer pour le propriétaire de la parcelle
    let userId = req.user.id;
    if (parcelle_id) {
      const parcelle = await db.query(
        `SELECT user_id FROM parcelles WHERE id = $1`,
        [parcelle_id]
      );
      if (parcelle.rows.length > 0) {
        userId = parcelle.rows[0].user_id;
      }
    }

    const result = await db.query(
      `INSERT INTO alertes (user_id, parcelle_id, categorie, niveau, titre, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, parcelle_id, categorie, niveau, titre, message]
    );

    // Envoyer notification
    await notificationService.sendAlert(userId, result.rows[0]);

    // Émettre via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('nouvelle_alerte', result.rows[0]);
    }

    logger.audit('Création alerte manuelle', { createdBy: req.user.id, alerteId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Alerte créée',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir une alerte par son ID
 */
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT a.*, p.nom as parcelle_nom, c.type as capteur_type
       FROM alertes a
       LEFT JOIN parcelles p ON a.parcelle_id = p.id
       LEFT JOIN capteurs c ON a.capteur_id = c.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Alerte non trouvée');
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marquer une alerte comme lue
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE alertes SET lu_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Alerte non trouvée');
    }

    res.json({
      success: true,
      message: 'Alerte marquée comme lue',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Résoudre une alerte
 */
exports.resolve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await db.query(
      `UPDATE alertes 
       SET status = 'traitee', 
           traite_at = NOW(),
           traite_par = $1,
           commentaire_traitement = $2
       WHERE id = $3 
       RETURNING *`,
      [req.user.id, notes || null, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Alerte non trouvée');
    }

    logger.audit('Résolution alerte', { userId: req.user.id, alerteId: id });

    res.json({
      success: true,
      message: 'Alerte résolue',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marquer toutes les alertes comme lues
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    let query = `UPDATE alertes SET lu_at = NOW() WHERE lu_at IS NULL`;
    const params = [];

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND user_id = $1`;
      params.push(req.user.id);
    }

    const result = await db.query(query + ' RETURNING id', params);

    res.json({
      success: true,
      message: `${result.rows.length} alertes marquées comme lues`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supprimer une alerte
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM alertes WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Alerte non trouvée');
    }

    logger.audit('Suppression alerte', { userId: req.user.id, alerteId: id });

    res.json({
      success: true,
      message: 'Alerte supprimée'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Envoyer une alerte de test
 */
exports.sendTest = async (req, res, next) => {
  try {
    const { categorie = 'systeme', niveau = 'information', destinataire_id } = req.body;
    const userId = destinataire_id || req.user.id;

    const alerte = {
      categorie,
      niveau,
      titre: 'Alerte de test',
      message: 'Ceci est une alerte de test du système AgriSmart CI'
    };

    // Créer l'alerte
    const result = await db.query(
      `INSERT INTO alertes (user_id, categorie, niveau, titre, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, alerte.categorie, alerte.niveau, alerte.titre, alerte.message]
    );

    // Envoyer les notifications
    await notificationService.sendAlert(userId, result.rows[0]);

    // Émettre via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('nouvelle_alerte', result.rows[0]);
    }

    res.json({
      success: true,
      message: 'Alerte de test envoyée',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};
