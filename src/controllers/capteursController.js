/**
 * Contrôleur des capteurs et stations
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');

/* ========== STATIONS ========== */

/**
 * Obtenir toutes les stations
 */
exports.getAllStations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let query = `
      SELECT s.*, p.nom as parcelle_nom, p.proprietaire_id,
             COUNT(c.id) as nb_capteurs
      FROM stations s
      LEFT JOIN parcelles p ON s.parcelle_id = p.id
      LEFT JOIN capteurs c ON s.id = c.station_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    query += ` GROUP BY s.id, p.nom, p.proprietaire_id`;
    query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
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

/**
 * Créer une station
 */
exports.createStation = async (req, res, next) => {
  try {
    const { nom, parcelle_id, latitude, longitude, description } = req.body;

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
      `INSERT INTO stations (nom, parcelle_id, latitude, longitude, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nom, parcelle_id, latitude, longitude, description]
    );

    logger.audit('Création station', { userId: req.user.id, stationId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Station créée avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir une station par son ID
 */
exports.getStationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT s.*, p.nom as parcelle_nom, p.proprietaire_id,
              json_agg(
                json_build_object(
                  'id', c.id,
                  'type', c.type,
                  'modele', c.modele,
                  'statut', c.statut
                )
              ) FILTER (WHERE c.id IS NOT NULL) as capteurs
       FROM stations s
       LEFT JOIN parcelles p ON s.parcelle_id = p.id
       LEFT JOIN capteurs c ON s.id = c.station_id
       WHERE s.id = $1
       GROUP BY s.id, p.nom, p.proprietaire_id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Station non trouvée');
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
 * Mettre à jour une station
 */
exports.updateStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, latitude, longitude, description, statut } = req.body;

    const result = await db.query(
      `UPDATE stations 
       SET nom = COALESCE($1, nom),
           latitude = COALESCE($2, latitude),
           longitude = COALESCE($3, longitude),
           description = COALESCE($4, description),
           statut = COALESCE($5, statut),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [nom, latitude, longitude, description, statut, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Station non trouvée');
    }

    res.json({
      success: true,
      message: 'Station mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supprimer une station
 */
exports.deleteStation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE stations SET statut = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Station non trouvée');
    }

    logger.audit('Suppression station', { userId: req.user.id, stationId: id });

    res.json({
      success: true,
      message: 'Station supprimée'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== CAPTEURS ========== */

/**
 * Obtenir tous les capteurs
 */
exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { type, statut } = req.query;

    let query = `
      SELECT c.*, s.nom as station_nom, p.nom as parcelle_nom, p.proprietaire_id
      FROM capteurs c
      LEFT JOIN stations s ON c.station_id = s.id
      LEFT JOIN parcelles p ON s.parcelle_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (type) {
      query += ` AND c.type = $${paramIndex++}`;
      params.push(type);
    }

    if (statut) {
      query += ` AND c.statut = $${paramIndex++}`;
      params.push(statut);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
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

/**
 * Statistiques des capteurs
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE statut = 'actif') as actifs,
        COUNT(*) FILTER (WHERE statut = 'inactif') as inactifs,
        COUNT(*) FILTER (WHERE statut = 'maintenance') as en_maintenance,
        COUNT(*) FILTER (WHERE derniere_mesure < NOW() - INTERVAL '1 hour') as hors_ligne
      FROM capteurs
    `);

    const parType = await db.query(`
      SELECT type, COUNT(*) as count
      FROM capteurs
      GROUP BY type
    `);

    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        par_type: parType.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Créer un capteur
 */
exports.create = async (req, res, next) => {
  try {
    const { station_id, type, modele, numero_serie, config } = req.body;

    // Vérifier l'accès à la station
    if (req.user.role === ROLES.PRODUCTEUR) {
      const station = await db.query(
        `SELECT s.id FROM stations s
         JOIN parcelles p ON s.parcelle_id = p.id
         WHERE s.id = $1 AND p.proprietaire_id = $2`,
        [station_id, req.user.id]
      );
      if (station.rows.length === 0) {
        throw errors.forbidden('Vous n\'avez pas accès à cette station');
      }
    }

    const result = await db.query(
      `INSERT INTO capteurs (station_id, type, modele, numero_serie, config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [station_id, type, modele, numero_serie, config || {}]
    );

    logger.audit('Création capteur', { userId: req.user.id, capteurId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Capteur créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir un capteur par son ID
 */
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.*, s.nom as station_nom, s.parcelle_id, p.nom as parcelle_nom
       FROM capteurs c
       LEFT JOIN stations s ON c.station_id = s.id
       LEFT JOIN parcelles p ON s.parcelle_id = p.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Capteur non trouvé');
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
 * Mettre à jour un capteur
 */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { modele, numero_serie, statut, config } = req.body;

    const result = await db.query(
      `UPDATE capteurs 
       SET modele = COALESCE($1, modele),
           numero_serie = COALESCE($2, numero_serie),
           statut = COALESCE($3, statut),
           config = COALESCE($4, config),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [modele, numero_serie, statut, config, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Capteur non trouvé');
    }

    res.json({
      success: true,
      message: 'Capteur mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supprimer un capteur
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE capteurs SET statut = 'inactif', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Capteur non trouvé');
    }

    logger.audit('Suppression capteur', { userId: req.user.id, capteurId: id });

    res.json({
      success: true,
      message: 'Capteur supprimé'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calibrer un capteur
 */
exports.calibrate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { facteur_calibration, offset_calibration } = req.body;

    const result = await db.query(
      `UPDATE capteurs 
       SET config = jsonb_set(
             jsonb_set(config, '{facteur_calibration}', $1::jsonb),
             '{offset_calibration}', $2::jsonb
           ),
           derniere_calibration = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(facteur_calibration || 1), JSON.stringify(offset_calibration || 0), id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Capteur non trouvé');
    }

    logger.audit('Calibration capteur', { userId: req.user.id, capteurId: id });

    res.json({
      success: true,
      message: 'Capteur calibré',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les mesures d'un capteur
 */
exports.getMesures = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { debut, fin, limit: queryLimit } = req.query;
    const limit = Math.min(parseInt(queryLimit) || 100, 1000);

    let query = `
      SELECT * FROM mesures 
      WHERE capteur_id = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (debut) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(debut);
    }

    if (fin) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(fin);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

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
 * Obtenir le statut d'un capteur
 */
exports.getStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const capteur = await db.query(
      `SELECT c.*, 
              (SELECT valeur FROM mesures WHERE capteur_id = c.id ORDER BY timestamp DESC LIMIT 1) as derniere_valeur,
              (SELECT timestamp FROM mesures WHERE capteur_id = c.id ORDER BY timestamp DESC LIMIT 1) as derniere_mesure_timestamp
       FROM capteurs c
       WHERE c.id = $1`,
      [id]
    );

    if (capteur.rows.length === 0) {
      throw errors.notFound('Capteur non trouvé');
    }

    const data = capteur.rows[0];
    const lastMeasure = data.derniere_mesure_timestamp;
    const isOnline = lastMeasure && (new Date() - new Date(lastMeasure)) < 30 * 60 * 1000; // 30 min

    res.json({
      success: true,
      data: {
        id: data.id,
        type: data.type,
        statut: data.statut,
        en_ligne: isOnline,
        derniere_valeur: data.derniere_valeur,
        derniere_mesure: lastMeasure,
        batterie: data.config?.batterie || null
      }
    });
  } catch (error) {
    next(error);
  }
};
