/**
 * Contrôleur des cultures et plantations
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');

/* ========== CULTURES (Catalogue) ========== */

exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { categorie } = req.query;

    let query = `SELECT * FROM cultures WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (categorie) {
      query += ` AND categorie = $${paramIndex++}`;
      params.push(categorie);
    }

    query += ` ORDER BY nom ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const result = await db.query(
      `SELECT * FROM cultures 
       WHERE nom ILIKE $1 OR nom_scientifique ILIKE $1
       ORDER BY nom ASC LIMIT 20`,
      [`%${q}%`]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { nom, nom_scientifique, categorie, cycle_jours, description,
            temp_min, temp_max, humidite_min, humidite_max, ph_min, ph_max } = req.body;

    const result = await db.query(
      `INSERT INTO cultures (nom, nom_scientifique, categorie, cycle_jours, description,
                             temp_min, temp_max, humidite_min, humidite_max, ph_min, ph_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [nom, nom_scientifique, categorie, cycle_jours, description,
       temp_min, temp_max, humidite_min, humidite_max, ph_min, ph_max]
    );

    logger.audit('Création culture', { userId: req.user.id, cultureId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Culture créée',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(`SELECT * FROM cultures WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      throw errors.notFound('Culture non trouvée');
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = ['nom', 'nom_scientifique', 'categorie', 'cycle_jours', 'description',
                   'temp_min', 'temp_max', 'humidite_min', 'humidite_max', 'ph_min', 'ph_max'];
    
    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      throw errors.badRequest('Aucune donnée à mettre à jour');
    }

    params.push(id);
    const result = await db.query(
      `UPDATE cultures SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Culture non trouvée');
    }

    res.json({
      success: true,
      message: 'Culture mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(`DELETE FROM cultures WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      throw errors.notFound('Culture non trouvée');
    }

    logger.audit('Suppression culture', { userId: req.user.id, cultureId: id });

    res.json({
      success: true,
      message: 'Culture supprimée'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== PLANTATIONS ========== */

exports.getAllPlantations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let query = `
      SELECT pl.*, c.nom as culture_nom, c.cycle_jours, p.nom as parcelle_nom, p.proprietaire_id
      FROM plantations pl
      JOIN cultures c ON pl.culture_id = c.id
      JOIN parcelles p ON pl.parcelle_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    query += ` ORDER BY pl.date_plantation DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.createPlantation = async (req, res, next) => {
  try {
    const { parcelle_id, culture_id, date_plantation, superficie, 
            date_recolte_prevue, quantite_semence, notes } = req.body;

    // Vérifier l'accès à la parcelle
    if (req.user.role === ROLES.PRODUCTEUR) {
      const parcelle = await db.query(
        `SELECT id FROM parcelles WHERE id = $1 AND proprietaire_id = $2`,
        [parcelle_id, req.user.id]
      );
      if (parcelle.rows.length === 0) {
        throw errors.forbidden('Vous n\'avez pas accès à cette parcelle');
      }
    }

    const result = await db.query(
      `INSERT INTO plantations (parcelle_id, culture_id, date_plantation, superficie,
                                date_recolte_prevue, quantite_semence, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [parcelle_id, culture_id, date_plantation, superficie, date_recolte_prevue, quantite_semence, notes]
    );

    logger.audit('Création plantation', { userId: req.user.id, plantationId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Plantation enregistrée',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getPlantationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT pl.*, c.nom as culture_nom, c.cycle_jours, c.description as culture_description,
              p.nom as parcelle_nom, p.superficie as parcelle_superficie
       FROM plantations pl
       JOIN cultures c ON pl.culture_id = c.id
       JOIN parcelles p ON pl.parcelle_id = p.id
       WHERE pl.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Plantation non trouvée');
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePlantation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date_recolte_prevue, notes, statut } = req.body;

    const result = await db.query(
      `UPDATE plantations 
       SET date_recolte_prevue = COALESCE($1, date_recolte_prevue),
           notes = COALESCE($2, notes),
           statut = COALESCE($3, statut),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [date_recolte_prevue, notes, statut, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Plantation non trouvée');
    }

    res.json({
      success: true,
      message: 'Plantation mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.recordRecolte = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date_recolte, quantite_recoltee, qualite, notes } = req.body;

    const result = await db.query(
      `UPDATE plantations 
       SET date_recolte = $1,
           quantite_recoltee = $2,
           qualite_recolte = $3,
           notes = COALESCE($4, notes),
           statut = 'recoltee',
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [date_recolte, quantite_recoltee, qualite, notes, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Plantation non trouvée');
    }

    logger.audit('Récolte enregistrée', { userId: req.user.id, plantationId: id });

    res.json({
      success: true,
      message: 'Récolte enregistrée',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.deletePlantation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE plantations SET statut = 'annulee', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Plantation non trouvée');
    }

    logger.audit('Suppression plantation', { userId: req.user.id, plantationId: id });

    res.json({
      success: true,
      message: 'Plantation supprimée'
    });
  } catch (error) {
    next(error);
  }
};
