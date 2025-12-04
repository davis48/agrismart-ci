/**
 * Contrôleur des maladies et détection IA
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');

/* ========== CATALOGUE DES MALADIES ========== */

exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { type } = req.query;

    let query = `SELECT * FROM maladies WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND type = $${paramIndex++}`;
      params.push(type);
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
      `SELECT * FROM maladies 
       WHERE nom ILIKE $1 OR nom_scientifique ILIKE $1 OR symptomes ILIKE $1
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
    const { nom, nom_scientifique, type, description, symptomes, 
            traitements, prevention, cultures_affectees } = req.body;

    const result = await db.query(
      `INSERT INTO maladies (nom, nom_scientifique, type, description, symptomes, 
                             traitements, prevention, cultures_affectees)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nom, nom_scientifique, type, description, symptomes, 
       traitements, prevention, cultures_affectees || []]
    );

    logger.audit('Création maladie', { userId: req.user.id, maladieId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Maladie ajoutée au catalogue',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(`SELECT * FROM maladies WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      throw errors.notFound('Maladie non trouvée');
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
    const fields = ['nom', 'nom_scientifique', 'type', 'description', 
                   'symptomes', 'traitements', 'prevention', 'cultures_affectees'];
    
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
      `UPDATE maladies SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Maladie non trouvée');
    }

    res.json({
      success: true,
      message: 'Maladie mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(`DELETE FROM maladies WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      throw errors.notFound('Maladie non trouvée');
    }

    logger.audit('Suppression maladie', { userId: req.user.id, maladieId: id });

    res.json({
      success: true,
      message: 'Maladie supprimée'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== DÉTECTION IA ========== */

exports.detectFromImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw errors.badRequest('Image requise');
    }

    const { parcelle_id, culture_id, description } = req.body;

    // Traiter l'image avec Sharp
    const processedImage = await sharp(req.file.buffer)
      .resize(640, 640, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Générer un nom de fichier unique
    const filename = `detection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const uploadPath = path.join(config.upload.path, 'detections', filename);

    // Créer le dossier si nécessaire
    await fs.mkdir(path.dirname(uploadPath), { recursive: true });
    await fs.writeFile(uploadPath, processedImage);

    const imageUrl = `/uploads/detections/${filename}`;

    // TODO: Intégrer le modèle IA réel (TensorFlow/PyTorch)
    // Pour l'instant, simulation de détection
    const detectionResult = await simulateAIDetection(processedImage);

    // Enregistrer la détection
    const result = await db.query(
      `INSERT INTO detections_maladies (user_id, parcelle_id, culture_id, image_url,
                                        maladie_detectee_id, confiance, description, resultats_bruts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, parcelle_id, culture_id, imageUrl, 
       detectionResult.maladie_id, detectionResult.confiance, 
       description, JSON.stringify(detectionResult.raw)]
    );

    const detection = result.rows[0];

    // Récupérer les détails de la maladie si détectée
    let maladie = null;
    if (detectionResult.maladie_id) {
      const maladieResult = await db.query(
        `SELECT * FROM maladies WHERE id = $1`,
        [detectionResult.maladie_id]
      );
      maladie = maladieResult.rows[0];
    }

    logger.audit('Détection maladie', { userId: req.user.id, detectionId: detection.id });

    res.status(201).json({
      success: true,
      data: {
        detection,
        maladie,
        recommendations: maladie ? generateRecommendations(maladie) : null
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.detectFromImageBatch = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw errors.badRequest('Au moins une image requise');
    }

    const results = [];
    
    for (const file of req.files) {
      const processedImage = await sharp(file.buffer)
        .resize(640, 640, { fit: 'inside' })
        .jpeg({ quality: 85 })
        .toBuffer();

      const detectionResult = await simulateAIDetection(processedImage);
      results.push({
        filename: file.originalname,
        ...detectionResult
      });
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

/* ========== HISTORIQUE DES DÉTECTIONS ========== */

exports.getDetections = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let query = `
      SELECT d.*, m.nom as maladie_nom, p.nom as parcelle_nom, c.nom as culture_nom
      FROM detections_maladies d
      LEFT JOIN maladies m ON d.maladie_detectee_id = m.id
      LEFT JOIN parcelles p ON d.parcelle_id = p.id
      LEFT JOIN cultures c ON d.culture_id = c.id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [req.user.id, limit, offset]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.getDetectionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT d.*, m.*, p.nom as parcelle_nom, c.nom as culture_nom
       FROM detections_maladies d
       LEFT JOIN maladies m ON d.maladie_detectee_id = m.id
       LEFT JOIN parcelles p ON d.parcelle_id = p.id
       LEFT JOIN cultures c ON d.culture_id = c.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Détection non trouvée');
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.confirmDetection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { confirmed, maladie_corrigee_id, notes } = req.body;

    const result = await db.query(
      `UPDATE detections_maladies 
       SET confirme = $1,
           maladie_corrigee_id = $2,
           notes_correction = $3,
           date_confirmation = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [confirmed, maladie_corrigee_id, notes, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Détection non trouvée');
    }

    res.json({
      success: true,
      message: 'Détection mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_detections,
        COUNT(*) FILTER (WHERE confiance > 0.8) as haute_confiance,
        COUNT(*) FILTER (WHERE confirme = true) as confirmees,
        COUNT(*) FILTER (WHERE maladie_detectee_id IS NOT NULL) as maladies_detectees,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as dernier_mois
      FROM detections_maladies
    `);

    const parMaladie = await db.query(`
      SELECT m.nom, COUNT(*) as count
      FROM detections_maladies d
      JOIN maladies m ON d.maladie_detectee_id = m.id
      WHERE d.created_at > NOW() - INTERVAL '30 days'
      GROUP BY m.id, m.nom
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        par_maladie: parMaladie.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ========== HELPERS ========== */

// Simulation de détection IA (à remplacer par le modèle réel)
async function simulateAIDetection(imageBuffer) {
  // Récupérer une maladie aléatoire pour la simulation
  const maladies = await db.query(`SELECT id, nom FROM maladies LIMIT 10`);
  
  if (maladies.rows.length === 0) {
    return {
      maladie_id: null,
      confiance: 0,
      raw: { message: 'Aucune maladie dans la base de données' }
    };
  }

  // Simulation: 70% de chance de détecter une maladie
  if (Math.random() > 0.3) {
    const randomMaladie = maladies.rows[Math.floor(Math.random() * maladies.rows.length)];
    return {
      maladie_id: randomMaladie.id,
      confiance: 0.7 + Math.random() * 0.25,
      raw: {
        model: 'simulation_v1',
        predictions: [
          { maladie: randomMaladie.nom, confiance: 0.7 + Math.random() * 0.25 }
        ]
      }
    };
  }

  return {
    maladie_id: null,
    confiance: 0,
    raw: { model: 'simulation_v1', message: 'Plante saine' }
  };
}

// Générer des recommandations basées sur la maladie détectée
function generateRecommendations(maladie) {
  const recommendations = [];

  if (maladie.traitements) {
    recommendations.push({
      type: 'traitement',
      priorite: 'haute',
      contenu: maladie.traitements
    });
  }

  if (maladie.prevention) {
    recommendations.push({
      type: 'prevention',
      priorite: 'moyenne',
      contenu: maladie.prevention
    });
  }

  recommendations.push({
    type: 'general',
    priorite: 'basse',
    contenu: 'Surveillez régulièrement vos cultures et isolez les plants affectés si possible.'
  });

  return recommendations;
}
