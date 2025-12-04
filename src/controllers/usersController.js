/**
 * Contrôleur des utilisateurs
 * AgriSmart CI - Système Agricole Intelligent
 */

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Obtenir tous les utilisateurs avec pagination
 */
exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { role, status, search } = req.query;

    let query = `
      SELECT id, email, telephone, nom, prenoms, role, status, langue_preferee, 
             localisation, created_at, derniere_connexion
      FROM users
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex++}`;
      params.push(role);
    }

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND (nom ILIKE $${paramIndex} OR prenoms ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR telephone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Count total
    const countResult = await db.query(
      query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM'),
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
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
 * Obtenir les statistiques des utilisateurs
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE role = 'producteur') as producteurs,
        COUNT(*) FILTER (WHERE role = 'conseiller') as conseillers,
        COUNT(*) FILTER (WHERE role = 'admin') as admins,
        COUNT(*) FILTER (WHERE role = 'partenaire') as partenaires,
        COUNT(*) FILTER (WHERE status = 'actif') as actifs,
        COUNT(*) FILTER (WHERE status = 'en_attente') as en_attente,
        COUNT(*) FILTER (WHERE status = 'suspendu') as suspendus,
        COUNT(*) FILTER (WHERE derniere_connexion > NOW() - INTERVAL '7 days') as actifs_7j,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as nouveaux_30j
      FROM users
    `);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les producteurs
 */
exports.getProducteurs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT u.id, u.email, u.telephone, u.nom, u.prenoms, u.status, u.langue_preferee,
              u.localisation, u.created_at, u.derniere_connexion,
              COUNT(DISTINCT p.id) as nb_parcelles,
              COALESCE(SUM(p.superficie), 0) as superficie_totale
       FROM users u
       LEFT JOIN parcelles p ON u.id = p.proprietaire_id
       WHERE u.role = 'producteur'
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM users WHERE role = 'producteur'`
    );
    const total = parseInt(countResult.rows[0].count);

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
 * Obtenir un utilisateur par son ID
 */
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, email, telephone, nom, prenoms, role, status, langue_preferee,
              photo_url, adresse, localisation, created_at, derniere_connexion
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Utilisateur non trouvé');
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
 * Créer un nouvel utilisateur (par admin)
 */
exports.create = async (req, res, next) => {
  try {
    const { email, telephone, password, nom, prenoms, role, langue_preferee = 'fr' } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existing = await db.query(
      `SELECT id FROM users WHERE email = $1 OR telephone = $2`,
      [email, telephone]
    );

    if (existing.rows.length > 0) {
      throw errors.conflict('Un utilisateur avec cet email ou ce téléphone existe déjà');
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (email, telephone, password_hash, nom, prenoms, role, langue_preferee, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'actif')
       RETURNING id, email, telephone, nom, prenoms, role, status, langue_preferee, created_at`,
      [email, telephone, hashedPassword, nom, prenoms, role, langue_preferee]
    );

    logger.audit('Création utilisateur par admin', { 
      createdBy: req.user.id, 
      newUserId: result.rows[0].id 
    });

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour un utilisateur
 */
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, prenoms, role, langue_preferee, adresse, localisation } = req.body;

    const result = await db.query(
      `UPDATE users 
       SET nom = COALESCE($1, nom),
           prenoms = COALESCE($2, prenoms),
           role = COALESCE($3, role),
           langue_preferee = COALESCE($4, langue_preferee),
           adresse = COALESCE($5, adresse),
           localisation = COALESCE($6, localisation),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, email, telephone, nom, prenoms, role, status, langue_preferee`,
      [nom, prenoms, role, langue_preferee, adresse, localisation, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Utilisateur non trouvé');
    }

    logger.audit('Mise à jour utilisateur', { updatedBy: req.user.id, userId: id });

    res.json({
      success: true,
      message: 'Utilisateur mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour le statut d'un utilisateur
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['actif', 'en_attente', 'suspendu'].includes(status)) {
      throw errors.badRequest('Statut invalide');
    }

    const result = await db.query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email, nom, prenoms, status`,
      [status, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Utilisateur non trouvé');
    }

    logger.audit('Changement statut utilisateur', { 
      changedBy: req.user.id, 
      userId: id, 
      newStatus: statut 
    });

    res.json({
      success: true,
      message: `Statut changé en "${status}"`,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supprimer un utilisateur
 */
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const user = await db.query(`SELECT id, email FROM users WHERE id = $1`, [id]);
    if (user.rows.length === 0) {
      throw errors.notFound('Utilisateur non trouvé');
    }

    // Soft delete - on change juste le statut
    await db.query(
      `UPDATE users SET status = 'supprime', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    logger.audit('Suppression utilisateur', { deletedBy: req.user.id, userId: id });

    res.json({
      success: true,
      message: 'Utilisateur supprimé'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir les parcelles d'un utilisateur
 */
exports.getParcelles = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, nom, superficie, latitude, longitude, adresse, type_sol, statut, created_at
       FROM parcelles 
       WHERE proprietaire_id = $1
       ORDER BY created_at DESC`,
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
 * Obtenir les alertes d'un utilisateur
 */
exports.getAlertes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const result = await db.query(
      `SELECT a.id, a.type, a.niveau, a.titre, a.message, a.lue, a.resolue, a.created_at,
              p.nom as parcelle_nom
       FROM alertes a
       LEFT JOIN parcelles p ON a.parcelle_id = p.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [id, limit]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};
