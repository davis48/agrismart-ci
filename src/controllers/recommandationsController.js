/**
 * Contrôleur des recommandations
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');

exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { type, priorite } = req.query;

    let query = `
      SELECT r.*, p.nom as parcelle_nom
      FROM recommandations r
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND r.user_id = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (type) {
      query += ` AND r.type = $${paramIndex++}`;
      params.push(type);
    }

    if (priorite) {
      query += ` AND r.priorite = $${paramIndex++}`;
      params.push(priorite);
    }

    query += ` ORDER BY r.priorite DESC, r.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
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

exports.getActive = async (req, res, next) => {
  try {
    let query = `
      SELECT r.*, p.nom as parcelle_nom, c.nom as culture_nom
      FROM recommandations r
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      LEFT JOIN cultures c ON r.culture_id = c.id
      WHERE r.statut = 'en_attente'
        AND (r.date_fin IS NULL OR r.date_fin >= NOW())
    `;
    const params = [];

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $1`;
      params.push(req.user.id);
    }

    query += ` ORDER BY r.priorite DESC, r.created_at DESC`;

    const result = await db.query(query, params);

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
    const { type, titre, contenu, priorite = 'moyenne', parcelle_id, 
            culture_id, date_debut, date_fin } = req.body;

    const result = await db.query(
      `INSERT INTO recommandations (type, titre, contenu, priorite, parcelle_id, 
                                    culture_id, date_debut, date_fin, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'conseiller')
       RETURNING *`,
      [type, titre, contenu, priorite, parcelle_id, culture_id, date_debut, date_fin]
    );

    logger.audit('Création recommandation', { userId: req.user.id, recommandationId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Recommandation créée',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT r.*, p.nom as parcelle_nom, c.nom as culture_nom
       FROM recommandations r
       LEFT JOIN parcelles p ON r.parcelle_id = p.id
       LEFT JOIN cultures c ON r.culture_id = c.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Recommandation non trouvée');
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
    const { titre, contenu, priorite, date_fin } = req.body;

    const result = await db.query(
      `UPDATE recommandations 
       SET titre = COALESCE($1, titre),
           contenu = COALESCE($2, contenu),
           priorite = COALESCE($3, priorite),
           date_fin = COALESCE($4, date_fin),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [titre, contenu, priorite, date_fin, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Recommandation non trouvée');
    }

    res.json({
      success: true,
      message: 'Recommandation mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statut, feedback } = req.body;

    const result = await db.query(
      `UPDATE recommandations 
       SET statut = $1,
           feedback = $2,
           date_action = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [statut, feedback, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Recommandation non trouvée');
    }

    logger.audit('Mise à jour statut recommandation', { 
      userId: req.user.id, 
      recommandationId: id, 
      statut 
    });

    res.json({
      success: true,
      message: 'Statut mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(`DELETE FROM recommandations WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      throw errors.notFound('Recommandation non trouvée');
    }

    res.json({
      success: true,
      message: 'Recommandation supprimée'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== IRRIGATION ========== */

exports.getIrrigationPrevisions = async (req, res, next) => {
  try {
    // Récupérer les parcelles de l'utilisateur avec données capteurs
    let query = `
      SELECT p.id, p.nom, p.superficie,
             (SELECT valeur FROM mesures m 
              JOIN capteurs c ON m.capteur_id = c.id 
              JOIN stations s ON c.station_id = s.id 
              WHERE s.parcelle_id = p.id AND c.type = 'humidite_sol'
              ORDER BY m.timestamp DESC LIMIT 1) as humidite_sol,
             (SELECT valeur FROM mesures m 
              JOIN capteurs c ON m.capteur_id = c.id 
              JOIN stations s ON c.station_id = s.id 
              WHERE s.parcelle_id = p.id AND c.type = 'temperature'
              ORDER BY m.timestamp DESC LIMIT 1) as temperature
      FROM parcelles p
      WHERE p.statut = 'active'
    `;
    const params = [];

    if (req.user.role === ROLES.PRODUCTEUR) {
      query += ` AND p.proprietaire_id = $1`;
      params.push(req.user.id);
    }

    const result = await db.query(query, params);

    // Calculer les recommandations d'irrigation
    const previsions = result.rows.map(parcelle => {
      const humidite = parcelle.humidite_sol || 50;
      const temperature = parcelle.temperature || 25;
      
      let besoin = 'faible';
      let quantite_recommandee = 0;
      let prochaine_irrigation = null;

      if (humidite < 30) {
        besoin = 'urgent';
        quantite_recommandee = parcelle.superficie * 5; // 5 L/m²
        prochaine_irrigation = new Date();
      } else if (humidite < 50) {
        besoin = 'moyen';
        quantite_recommandee = parcelle.superficie * 3;
        prochaine_irrigation = new Date(Date.now() + 24 * 60 * 60 * 1000);
      } else if (humidite < 70) {
        besoin = 'faible';
        quantite_recommandee = parcelle.superficie * 1;
        prochaine_irrigation = new Date(Date.now() + 48 * 60 * 60 * 1000);
      }

      // Ajuster selon la température
      if (temperature > 35) {
        quantite_recommandee *= 1.5;
      }

      return {
        parcelle_id: parcelle.id,
        parcelle_nom: parcelle.nom,
        humidite_actuelle: humidite,
        temperature_actuelle: temperature,
        besoin,
        quantite_recommandee_litres: Math.round(quantite_recommandee),
        prochaine_irrigation
      };
    });

    res.json({
      success: true,
      data: previsions
    });
  } catch (error) {
    next(error);
  }
};

exports.getIrrigationByParcelle = async (req, res, next) => {
  try {
    const { parcelleId } = req.params;

    // Historique des mesures d'humidité
    const mesures = await db.query(
      `SELECT DATE(m.timestamp) as date, AVG(m.valeur) as moyenne
       FROM mesures m
       JOIN capteurs c ON m.capteur_id = c.id
       JOIN stations s ON c.station_id = s.id
       WHERE s.parcelle_id = $1 AND c.type = 'humidite_sol'
         AND m.timestamp > NOW() - INTERVAL '30 days'
       GROUP BY DATE(m.timestamp)
       ORDER BY date DESC`,
      [parcelleId]
    );

    res.json({
      success: true,
      data: {
        historique: mesures.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.calculateIrrigation = async (req, res, next) => {
  try {
    const { parcelle_id } = req.body;

    // Récupérer les données de la parcelle
    const parcelleResult = await db.query(
      `SELECT p.*, pl.culture_id, c.nom as culture_nom
       FROM parcelles p
       LEFT JOIN plantations pl ON p.id = pl.parcelle_id AND pl.statut = 'active'
       LEFT JOIN cultures c ON pl.culture_id = c.id
       WHERE p.id = $1`,
      [parcelle_id]
    );

    if (parcelleResult.rows.length === 0) {
      throw errors.notFound('Parcelle non trouvée');
    }

    const parcelle = parcelleResult.rows[0];

    // Créer une recommandation d'irrigation
    const result = await db.query(
      `INSERT INTO recommandations (type, titre, contenu, priorite, parcelle_id, culture_id, source)
       VALUES ('irrigation', $1, $2, 'moyenne', $3, $4, 'automatique')
       RETURNING *`,
      [
        `Irrigation recommandée pour ${parcelle.nom}`,
        `Basé sur l'analyse des données capteurs, nous recommandons une irrigation de ${Math.round(parcelle.superficie * 3)} litres dans les prochaines 24 heures.`,
        parcelle_id,
        parcelle.culture_id
      ]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/* ========== MÉTÉO ========== */

exports.getMeteoPrevisions = async (req, res, next) => {
  try {
    // TODO: Intégrer une API météo réelle (OpenWeatherMap, etc.)
    // Pour l'instant, données simulées
    const previsions = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      previsions.push({
        date: date.toISOString().split('T')[0],
        temperature_min: 22 + Math.floor(Math.random() * 5),
        temperature_max: 30 + Math.floor(Math.random() * 5),
        humidite: 60 + Math.floor(Math.random() * 30),
        precipitation_mm: Math.random() > 0.7 ? Math.floor(Math.random() * 20) : 0,
        vent_kmh: 5 + Math.floor(Math.random() * 15),
        description: ['Ensoleillé', 'Partiellement nuageux', 'Nuageux', 'Pluie légère'][Math.floor(Math.random() * 4)]
      });
    }

    res.json({
      success: true,
      data: previsions
    });
  } catch (error) {
    next(error);
  }
};

exports.getMeteoByParcelle = async (req, res, next) => {
  try {
    const { parcelleId } = req.params;

    // Récupérer les coordonnées de la parcelle
    const parcelleResult = await db.query(
      `SELECT latitude, longitude, nom FROM parcelles WHERE id = $1`,
      [parcelleId]
    );

    if (parcelleResult.rows.length === 0) {
      throw errors.notFound('Parcelle non trouvée');
    }

    const parcelle = parcelleResult.rows[0];

    // TODO: Appeler l'API météo avec les coordonnées
    // Données simulées pour l'instant
    res.json({
      success: true,
      data: {
        parcelle: parcelle.nom,
        localisation: {
          latitude: parcelle.latitude,
          longitude: parcelle.longitude
        },
        actuel: {
          temperature: 28,
          humidite: 65,
          precipitation: 0,
          vent_kmh: 10
        },
        previsions: []
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ========== GÉNÉRATION AUTOMATIQUE ========== */

exports.generate = async (req, res, next) => {
  try {
    const { parcelle_id } = req.body;

    // Récupérer les données de la parcelle
    const parcelleData = await db.query(
      `SELECT p.*, 
              (SELECT json_agg(row_to_json(m)) FROM (
                SELECT c.type, m.valeur, m.timestamp
                FROM mesures m
                JOIN capteurs cap ON m.capteur_id = cap.id
                JOIN stations s ON cap.station_id = s.id
                JOIN cultures c ON true
                WHERE s.parcelle_id = p.id
                ORDER BY m.timestamp DESC
                LIMIT 10
              ) m) as dernieres_mesures
       FROM parcelles p
       WHERE p.id = $1`,
      [parcelle_id]
    );

    if (parcelleData.rows.length === 0) {
      throw errors.notFound('Parcelle non trouvée');
    }

    const recommandationsGenerees = [];

    // Analyser les données et générer des recommandations
    // (Logique simplifiée - à enrichir avec IA/ML)
    const mesures = parcelleData.rows[0].dernieres_mesures || [];

    // Vérifier l'humidité du sol
    const humidite = mesures.find(m => m.type === 'humidite_sol');
    if (humidite && humidite.valeur < 40) {
      recommandationsGenerees.push({
        type: 'irrigation',
        titre: 'Irrigation nécessaire',
        contenu: 'L\'humidité du sol est basse. Nous recommandons une irrigation dans les prochaines heures.',
        priorite: humidite.valeur < 25 ? 'haute' : 'moyenne'
      });
    }

    // Insérer les recommandations
    for (const reco of recommandationsGenerees) {
      await db.query(
        `INSERT INTO recommandations (type, titre, contenu, priorite, parcelle_id, source)
         VALUES ($1, $2, $3, $4, $5, 'automatique')`,
        [reco.type, reco.titre, reco.contenu, reco.priorite, parcelle_id]
      );
    }

    res.json({
      success: true,
      message: `${recommandationsGenerees.length} recommandations générées`,
      data: recommandationsGenerees
    });
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE statut = 'en_attente') as en_attente,
        COUNT(*) FILTER (WHERE statut = 'appliquee') as appliquees,
        COUNT(*) FILTER (WHERE statut = 'ignoree') as ignorees,
        COUNT(*) FILTER (WHERE priorite = 'urgente') as urgentes,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as cette_semaine
      FROM recommandations
    `);

    const parType = await db.query(`
      SELECT type, COUNT(*) as count
      FROM recommandations
      WHERE created_at > NOW() - INTERVAL '30 days'
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
