/**
 * Contrôleur des parcelles
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');

/**
 * Obtenir toutes les parcelles (filtrées selon le rôle)
 */
exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { statut, type_sol, search } = req.query;

    let query = `
      SELECT p.id, p.nom, p.superficie, p.latitude, p.longitude, p.adresse, 
             p.type_sol, p.statut, p.created_at,
             u.nom as proprietaire_nom, u.prenom as proprietaire_prenom,
             COUNT(DISTINCT s.id) as nb_stations,
             COUNT(DISTINCT pl.id) as nb_plantations
      FROM parcelles p
      LEFT JOIN users u ON p.proprietaire_id = u.id
      LEFT JOIN stations s ON p.id = s.parcelle_id
      LEFT JOIN plantations pl ON p.id = pl.parcelle_id AND pl.statut = 'active'
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filtrer selon le rôle
    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (statut) {
      query += ` AND p.statut = $${paramIndex++}`;
      params.push(statut);
    }

    if (type_sol) {
      query += ` AND p.type_sol = $${paramIndex++}`;
      params.push(type_sol);
    }

    if (search) {
      query += ` AND (p.nom ILIKE $${paramIndex} OR p.adresse ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` GROUP BY p.id, u.nom, u.prenom`;

    // Count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) FROM parcelles p
      WHERE 1=1 ${req.user.role === ROLES.PRODUCTEUR ? 'AND p.proprietaire_id = $1' : ''}
    `;
    const countParams = req.user.role === ROLES.PRODUCTEUR ? [req.user.id] : [];
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Paginated results
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Statistiques des parcelles
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_parcelles,
        COALESCE(SUM(superficie), 0) as superficie_totale,
        AVG(superficie) as superficie_moyenne,
        COUNT(*) FILTER (WHERE statut = 'active') as parcelles_actives,
        COUNT(DISTINCT proprietaire_id) as nb_proprietaires
      FROM parcelles
    `);

    const parType = await db.query(`
      SELECT type_sol, COUNT(*) as count, SUM(superficie) as superficie
      FROM parcelles
      WHERE type_sol IS NOT NULL
      GROUP BY type_sol
    `);

    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        par_type_sol: parType.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Données pour la carte
 */
exports.getMapData = async (req, res, next) => {
  try {
    let query = `
      SELECT p.id, p.nom, p.superficie, p.latitude, p.longitude, p.statut,
             u.nom as proprietaire_nom
      FROM parcelles p
      LEFT JOIN users u ON p.proprietaire_id = u.id
      WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    `;

    const params = [];
    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $1`;
      params.push(req.user.id);
    }

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Créer une parcelle
 */
exports.create = async (req, res, next) => {
  try {
    const { nom, superficie, latitude, longitude, adresse, type_sol } = req.body;
    const proprietaireId = req.body.proprietaire_id || req.user.id;

    // Vérifier les permissions
    if (req.body.proprietaire_id && req.user.role === ROLES.PRODUCTEUR) {
      throw errors.forbidden('Vous ne pouvez créer que vos propres parcelles');
    }

    const result = await db.query(
      `INSERT INTO parcelles (nom, superficie, latitude, longitude, adresse, type_sol, proprietaire_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [nom, superficie, latitude, longitude, adresse, type_sol, proprietaireId]
    );

    logger.audit('Création parcelle', { userId: req.user.id, parcelleId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Parcelle créée avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir une parcelle par son ID
 */
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT p.*, 
              u.nom as proprietaire_nom, u.prenom as proprietaire_prenom, u.telephone as proprietaire_telephone,
              COUNT(DISTINCT s.id) as nb_stations,
              COUNT(DISTINCT c.id) as nb_capteurs
       FROM parcelles p
       LEFT JOIN users u ON p.proprietaire_id = u.id
       LEFT JOIN stations s ON p.id = s.parcelle_id
       LEFT JOIN capteurs c ON s.id = c.station_id
       WHERE p.id = $1
       GROUP BY p.id, u.nom, u.prenom, u.telephone`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Parcelle non trouvée');
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
 * Mettre à jour une parcelle
 */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, superficie, latitude, longitude, adresse, type_sol, statut } = req.body;

    const result = await db.query(
      `UPDATE parcelles 
       SET nom = COALESCE($1, nom),
           superficie = COALESCE($2, superficie),
           latitude = COALESCE($3, latitude),
           longitude = COALESCE($4, longitude),
           adresse = COALESCE($5, adresse),
           type_sol = COALESCE($6, type_sol),
           statut = COALESCE($7, statut),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [nom, superficie, latitude, longitude, adresse, type_sol, statut, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Parcelle non trouvée');
    }

    logger.audit('Mise à jour parcelle', { userId: req.user.id, parcelleId: id });

    res.json({
      success: true,
      message: 'Parcelle mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supprimer une parcelle
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Soft delete
    const result = await db.query(
      `UPDATE parcelles SET statut = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Parcelle non trouvée');
    }

    logger.audit('Suppression parcelle', { userId: req.user.id, parcelleId: id });

    res.json({
      success: true,
      message: 'Parcelle supprimée'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les stations d'une parcelle
 */
exports.getStations = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT s.*, COUNT(c.id) as nb_capteurs
       FROM stations s
       LEFT JOIN capteurs c ON s.id = c.station_id
       WHERE s.parcelle_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les dernières mesures d'une parcelle
 */
exports.getMesures = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT m.*, c.type as capteur_type, s.nom as station_nom
       FROM mesures m
       JOIN capteurs c ON m.capteur_id = c.id
       JOIN stations s ON c.station_id = s.id
       WHERE s.parcelle_id = $1
       ORDER BY m.timestamp DESC
       LIMIT 100`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les alertes d'une parcelle
 */
exports.getAlertes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { niveau, resolue } = req.query;

    let query = `
      SELECT * FROM alertes 
      WHERE parcelle_id = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (niveau) {
      query += ` AND niveau = $${paramIndex++}`;
      params.push(niveau);
    }

    if (resolue !== undefined) {
      query += ` AND resolue = $${paramIndex++}`;
      params.push(resolue === 'true');
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les cultures d'une parcelle
 */
exports.getCultures = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT pl.*, c.nom as culture_nom, c.cycle_jours
       FROM plantations pl
       JOIN cultures c ON pl.culture_id = c.id
       WHERE pl.parcelle_id = $1
       ORDER BY pl.date_plantation DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les recommandations pour une parcelle
 */
exports.getRecommandations = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM recommandations 
       WHERE parcelle_id = $1 AND statut = 'en_attente'
       ORDER BY priorite DESC, created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Historique d'une parcelle
 */
exports.getHistorique = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, debut, fin } = req.query;

    let dateFilter = '';
    const params = [id];
    let paramIndex = 2;

    if (debut) {
      dateFilter += ` AND timestamp >= $${paramIndex++}`;
      params.push(debut);
    }
    if (fin) {
      dateFilter += ` AND timestamp <= $${paramIndex++}`;
      params.push(fin);
    }

    // Agrégation journalière des mesures
    const result = await db.query(
      `SELECT 
        DATE(m.timestamp) as date,
        c.type as capteur_type,
        AVG(m.valeur) as moyenne,
        MIN(m.valeur) as min,
        MAX(m.valeur) as max,
        COUNT(*) as nb_mesures
       FROM mesures m
       JOIN capteurs c ON m.capteur_id = c.id
       JOIN stations s ON c.station_id = s.id
       WHERE s.parcelle_id = $1 ${dateFilter}
       ${type ? `AND c.type = $${paramIndex++}` : ''}
       GROUP BY DATE(m.timestamp), c.type
       ORDER BY date DESC, c.type`,
      type ? [...params, type] : params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};
