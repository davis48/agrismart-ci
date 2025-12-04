/**
 * Contrôleur des Formations
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');

/* ========== FORMATIONS ========== */

exports.getAllFormations = async (req, res, next) => {
  try {
    const { type, categorie, langue } = req.query;

    let query = `
      SELECT f.*,
             (SELECT COUNT(*) FROM user_formations uf WHERE uf.formation_id = f.id) as nb_inscrits
      FROM formations f
      WHERE f.est_actif = true
    `;
    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND f.type = $${paramIndex++}`;
      params.push(type);
    }

    if (categorie) {
      query += ` AND f.categorie = $${paramIndex++}`;
      params.push(categorie);
    }

    if (langue) {
      query += ` AND f.langue = $${paramIndex++}`;
      params.push(langue);
    }

    query += ` ORDER BY f.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.getFormationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const formation = await db.query(
      `SELECT f.* FROM formations f WHERE f.id = $1`,
      [id]
    );

    if (formation.rows.length === 0) {
      throw errors.notFound('Formation non trouvée');
    }

    let progression = null;
    if (req.user) {
      const prog = await db.query(
        `SELECT * FROM user_formations WHERE user_id = $1 AND formation_id = $2`,
        [req.user.id, id]
      );
      progression = prog.rows[0] || null;
    }

    await db.query(`UPDATE formations SET vues = vues + 1 WHERE id = $1`, [id]);

    res.json({
      success: true,
      data: {
        ...formation.rows[0],
        progression
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.createFormation = async (req, res, next) => {
  try {
    const { titre, description, type, categorie, url, duree_minutes, langue, cultures_id } = req.body;

    const result = await db.query(
      `INSERT INTO formations (titre, description, type, categorie, url, duree_minutes, langue, cultures_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [titre, description, type, categorie, url, duree_minutes, langue, cultures_id]
    );

    logger.audit('Création formation', { userId: req.user.id, formationId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Formation créée',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.updateFormation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { titre, description, type, categorie, url, duree_minutes, langue, est_actif } = req.body;

    const formation = await db.query(`SELECT id FROM formations WHERE id = $1`, [id]);
    if (formation.rows.length === 0) {
      throw errors.notFound('Formation non trouvée');
    }

    const result = await db.query(
      `UPDATE formations 
       SET titre = COALESCE($1, titre),
           description = COALESCE($2, description),
           type = COALESCE($3, type),
           categorie = COALESCE($4, categorie),
           url = COALESCE($5, url),
           duree_minutes = COALESCE($6, duree_minutes),
           langue = COALESCE($7, langue),
           est_actif = COALESCE($8, est_actif)
       WHERE id = $9
       RETURNING *`,
      [titre, description, type, categorie, url, duree_minutes, langue, est_actif, id]
    );

    res.json({
      success: true,
      message: 'Formation mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteFormation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`DELETE FROM formations WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      throw errors.notFound('Formation non trouvée');
    }

    res.json({
      success: true,
      message: 'Formation supprimée'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== INSCRIPTIONS ========== */

exports.inscrireFormation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const formation = await db.query(`SELECT id FROM formations WHERE id = $1 AND est_actif = true`, [id]);
    if (formation.rows.length === 0) {
      throw errors.notFound('Formation non trouvée ou inactive');
    }

    const existing = await db.query(
      `SELECT id FROM user_formations WHERE user_id = $1 AND formation_id = $2`,
      [req.user.id, id]
    );
    
    if (existing.rows.length > 0) {
      throw errors.conflict('Vous êtes déjà inscrit à cette formation');
    }

    const result = await db.query(
      `INSERT INTO user_formations (user_id, formation_id, progression, complete)
       VALUES ($1, $2, 0, false)
       RETURNING *`,
      [req.user.id, id]
    );

    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getMesFormations = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT f.*, uf.progression, uf.complete, uf.created_at as date_inscription
       FROM user_formations uf
       JOIN formations f ON uf.formation_id = f.id
       WHERE uf.user_id = $1
       ORDER BY uf.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyProgressions = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT uf.*, f.titre, f.type, f.duree_minutes
       FROM user_formations uf
       JOIN formations f ON uf.formation_id = f.id
       WHERE uf.user_id = $1
       ORDER BY uf.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProgression = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { progression, complete } = req.body;

    const result = await db.query(
      `UPDATE user_formations 
       SET progression = COALESCE($1, progression),
           complete = COALESCE($2, complete)
       WHERE user_id = $3 AND formation_id = $4
       RETURNING *`,
      [progression, complete, req.user.id, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Inscription non trouvée');
    }

    res.json({
      success: true,
      message: 'Progression mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/* ========== STATISTIQUES ========== */

exports.getStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM formations WHERE est_actif = true) as formations_actives,
        (SELECT COUNT(*) FROM user_formations) as total_inscriptions,
        (SELECT COUNT(*) FROM user_formations WHERE complete = true) as formations_terminees,
        (SELECT AVG(progression) FROM user_formations) as progression_moyenne,
        (SELECT COUNT(DISTINCT user_id) FROM user_formations) as apprenants_actifs
    `);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    next(error);
  }
};
