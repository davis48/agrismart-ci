/**
 * Contrôleur des mesures IoT
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const config = require('../config');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');
const alertesService = require('../services/alertesService');

/**
 * Créer une nouvelle mesure
 */
exports.create = async (req, res, next) => {
  try {
    const { capteur_id, valeur, unite, timestamp } = req.body;
    const measureTime = timestamp ? new Date(timestamp) : new Date();

    // Insérer la mesure
    const result = await db.query(
      `INSERT INTO mesures (capteur_id, valeur, unite, timestamp)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [capteur_id, valeur, unite, measureTime]
    );

    // Mettre à jour la dernière mesure du capteur
    await db.query(
      `UPDATE capteurs SET derniere_mesure = $1 WHERE id = $2`,
      [measureTime, capteur_id]
    );

    // Vérifier les seuils d'alerte
    try {
      await alertesService.checkThresholds(capteur_id, valeur);
    } catch (alertError) {
      logger.warn('Erreur vérification seuils', { error: alertError.message });
    }

    // Émettre via Socket.IO si disponible
    const io = req.app.get('io');
    if (io) {
      io.emit('nouvelle_mesure', result.rows[0]);
    }

    logger.iot('Nouvelle mesure', { capteurId: capteur_id, valeur });

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Créer plusieurs mesures en lot
 */
exports.createBatch = async (req, res, next) => {
  try {
    const { mesures } = req.body;

    const results = [];
    const errors_list = [];

    await db.transaction(async (client) => {
      for (const mesure of mesures) {
        try {
          const { capteur_id, valeur, unite, timestamp } = mesure;
          const measureTime = timestamp ? new Date(timestamp) : new Date();

          const result = await client.query(
            `INSERT INTO mesures (capteur_id, valeur, unite, timestamp)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [capteur_id, valeur, unite, measureTime]
          );

          results.push({ capteur_id, id: result.rows[0].id, success: true });

          // Mettre à jour dernière mesure
          await client.query(
            `UPDATE capteurs SET derniere_mesure = $1 WHERE id = $2`,
            [measureTime, capteur_id]
          );
        } catch (err) {
          errors_list.push({ capteur_id: mesure.capteur_id, error: err.message });
        }
      }
    });

    logger.iot('Batch mesures', { total: mesures.length, success: results.length, errors: errors_list.length });

    res.status(201).json({
      success: true,
      data: {
        inserted: results.length,
        errors: errors_list
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les mesures avec filtres
 */
exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = (page - 1) * limit;
    const { capteur_id, parcelle_id, type, debut, fin } = req.query;

    let query = `
      SELECT m.*, c.type as capteur_type, s.nom as station_nom, p.nom as parcelle_nom
      FROM mesures m
      JOIN capteurs c ON m.capteur_id = c.id
      JOIN stations s ON c.station_id = s.id
      JOIN parcelles p ON s.parcelle_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (capteur_id) {
      query += ` AND m.capteur_id = $${paramIndex++}`;
      params.push(capteur_id);
    }

    if (parcelle_id) {
      query += ` AND p.id = $${paramIndex++}`;
      params.push(parcelle_id);
    }

    if (type) {
      query += ` AND c.type = $${paramIndex++}`;
      params.push(type);
    }

    if (debut) {
      query += ` AND m.timestamp >= $${paramIndex++}`;
      params.push(debut);
    }

    if (fin) {
      query += ` AND m.timestamp <= $${paramIndex++}`;
      params.push(fin);
    }

    query += ` ORDER BY m.timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
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
 * Obtenir les dernières mesures par capteur
 */
exports.getLatest = async (req, res, next) => {
  try {
    const { parcelle_id } = req.query;

    let query = `
      SELECT DISTINCT ON (c.id)
        c.id as capteur_id, c.type as capteur_type, s.nom as station_nom,
        p.id as parcelle_id, p.nom as parcelle_nom,
        m.valeur, m.unite, m.timestamp
      FROM capteurs c
      JOIN stations s ON c.station_id = s.id
      JOIN parcelles p ON s.parcelle_id = p.id
      LEFT JOIN mesures m ON c.id = m.capteur_id
      WHERE c.statut = 'actif'
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (parcelle_id) {
      query += ` AND p.id = $${paramIndex++}`;
      params.push(parcelle_id);
    }

    query += ` ORDER BY c.id, m.timestamp DESC`;

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
 * Statistiques des mesures
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_mesures,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as mesures_24h,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as mesures_7j,
        COUNT(DISTINCT capteur_id) as capteurs_actifs
      FROM mesures
      WHERE timestamp > NOW() - INTERVAL '30 days'
    `);

    const parType = await db.query(`
      SELECT c.type, 
             COUNT(m.id) as nb_mesures,
             AVG(m.valeur) as moyenne,
             MIN(m.valeur) as min,
             MAX(m.valeur) as max
      FROM mesures m
      JOIN capteurs c ON m.capteur_id = c.id
      WHERE m.timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY c.type
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
 * Données agrégées (moyennes horaires/journalières)
 */
exports.getAggregated = async (req, res, next) => {
  try {
    const { parcelle_id, capteur_id, type, periode = 'jour', debut, fin } = req.query;

    const interval = periode === 'heure' ? '1 hour' : '1 day';
    const truncate = periode === 'heure' ? 'hour' : 'day';

    let query = `
      SELECT 
        DATE_TRUNC('${truncate}', m.timestamp) as periode,
        c.type as capteur_type,
        AVG(m.valeur) as moyenne,
        MIN(m.valeur) as min,
        MAX(m.valeur) as max,
        COUNT(*) as nb_mesures
      FROM mesures m
      JOIN capteurs c ON m.capteur_id = c.id
      JOIN stations s ON c.station_id = s.id
      JOIN parcelles p ON s.parcelle_id = p.id
      WHERE m.timestamp >= COALESCE($1::timestamp, NOW() - INTERVAL '7 days')
        AND m.timestamp <= COALESCE($2::timestamp, NOW())
    `;
    const params = [debut || null, fin || null];
    let paramIndex = 3;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (parcelle_id) {
      query += ` AND p.id = $${paramIndex++}`;
      params.push(parcelle_id);
    }

    if (capteur_id) {
      query += ` AND c.id = $${paramIndex++}`;
      params.push(capteur_id);
    }

    if (type) {
      query += ` AND c.type = $${paramIndex++}`;
      params.push(type);
    }

    query += ` GROUP BY DATE_TRUNC('${truncate}', m.timestamp), c.type ORDER BY periode DESC`;

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
 * Exporter les mesures en CSV
 */
exports.exportCsv = async (req, res, next) => {
  try {
    const { parcelle_id, capteur_id, debut, fin } = req.query;

    let query = `
      SELECT m.timestamp, c.type as capteur_type, m.valeur, m.unite, 
             s.nom as station, p.nom as parcelle
      FROM mesures m
      JOIN capteurs c ON m.capteur_id = c.id
      JOIN stations s ON c.station_id = s.id
      JOIN parcelles p ON s.parcelle_id = p.id
      WHERE m.timestamp >= COALESCE($1::timestamp, NOW() - INTERVAL '30 days')
        AND m.timestamp <= COALESCE($2::timestamp, NOW())
    `;
    const params = [debut || null, fin || null];
    let paramIndex = 3;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (parcelle_id) {
      query += ` AND p.id = $${paramIndex++}`;
      params.push(parcelle_id);
    }

    if (capteur_id) {
      query += ` AND c.id = $${paramIndex++}`;
      params.push(capteur_id);
    }

    query += ` ORDER BY m.timestamp DESC LIMIT 10000`;

    const result = await db.query(query, params);

    // Générer le CSV
    const headers = ['timestamp', 'type_capteur', 'valeur', 'unite', 'station', 'parcelle'];
    const csv = [
      headers.join(','),
      ...result.rows.map(row => 
        [row.timestamp, row.capteur_type, row.valeur, row.unite, row.station, row.parcelle].join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=mesures.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir une mesure par son ID
 */
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT m.*, c.type as capteur_type, s.nom as station_nom
       FROM mesures m
       JOIN capteurs c ON m.capteur_id = c.id
       JOIN stations s ON c.station_id = s.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Mesure non trouvée');
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
 * Supprimer une mesure
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM mesures WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Mesure non trouvée');
    }

    logger.audit('Suppression mesure', { userId: req.user.id, mesureId: id });

    res.json({
      success: true,
      message: 'Mesure supprimée'
    });
  } catch (error) {
    next(error);
  }
};
