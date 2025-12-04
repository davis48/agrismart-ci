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
    const { type, niveau, culture } = req.query;

    let query = `
      SELECT f.*, u.nom as formateur_nom, u.prenom as formateur_prenom,
             (SELECT COUNT(*) FROM progressions_formation pf WHERE pf.formation_id = f.id) as nb_inscrits
      FROM formations f
      LEFT JOIN users u ON f.createur_id = u.id
      WHERE f.statut = 'publiee'
    `;
    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND f.type = $${paramIndex++}`;
      params.push(type);
    }

    if (niveau) {
      query += ` AND f.niveau = $${paramIndex++}`;
      params.push(niveau);
    }

    if (culture) {
      query += ` AND f.culture_cible = $${paramIndex++}`;
      params.push(culture);
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
      `SELECT f.*, u.nom as formateur_nom, u.prenom as formateur_prenom
       FROM formations f
       LEFT JOIN users u ON f.createur_id = u.id
       WHERE f.id = $1`,
      [id]
    );

    if (formation.rows.length === 0) {
      throw errors.notFound('Formation non trouvée');
    }

    // Récupérer les modules
    const modules = await db.query(
      `SELECT * FROM modules_formation WHERE formation_id = $1 ORDER BY ordre`,
      [id]
    );

    // Vérifier la progression de l'utilisateur si connecté
    let progression = null;
    if (req.user) {
      const prog = await db.query(
        `SELECT * FROM progressions_formation WHERE user_id = $1 AND formation_id = $2`,
        [req.user.id, id]
      );
      progression = prog.rows[0] || null;
    }

    res.json({
      success: true,
      data: {
        ...formation.rows[0],
        modules: modules.rows,
        progression
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.createFormation = async (req, res, next) => {
  try {
    const { titre, description, type, niveau, duree_estimee, culture_cible, prerequis, objectifs } = req.body;

    const result = await db.query(
      `INSERT INTO formations (createur_id, titre, description, type, niveau, duree_estimee, 
                               culture_cible, prerequis, objectifs, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'brouillon')
       RETURNING *`,
      [req.user.id, titre, description, type, niveau, duree_estimee, culture_cible, prerequis, objectifs]
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
    const { titre, description, type, niveau, duree_estimee, culture_cible, statut } = req.body;

    // Vérifier propriétaire ou admin
    const formation = await db.query(`SELECT createur_id FROM formations WHERE id = $1`, [id]);
    if (formation.rows.length === 0) {
      throw errors.notFound('Formation non trouvée');
    }
    if (formation.rows[0].createur_id !== req.user.id && req.user.role !== ROLES.ADMIN) {
      throw errors.forbidden('Vous n\'êtes pas autorisé à modifier cette formation');
    }

    const result = await db.query(
      `UPDATE formations 
       SET titre = COALESCE($1, titre),
           description = COALESCE($2, description),
           type = COALESCE($3, type),
           niveau = COALESCE($4, niveau),
           duree_estimee = COALESCE($5, duree_estimee),
           culture_cible = COALESCE($6, culture_cible),
           statut = COALESCE($7, statut),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [titre, description, type, niveau, duree_estimee, culture_cible, statut, id]
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

    const formation = await db.query(`SELECT createur_id FROM formations WHERE id = $1`, [id]);
    if (formation.rows.length === 0) {
      throw errors.notFound('Formation non trouvée');
    }
    if (formation.rows[0].createur_id !== req.user.id && req.user.role !== ROLES.ADMIN) {
      throw errors.forbidden('Vous n\'êtes pas autorisé à supprimer cette formation');
    }

    await db.query(`UPDATE formations SET statut = 'archivee' WHERE id = $1`, [id]);

    res.json({
      success: true,
      message: 'Formation archivée'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== MODULES ========== */

exports.addModule = async (req, res, next) => {
  try {
    const { id: formationId } = req.params;
    const { titre, contenu, type_contenu, duree_minutes, ordre, url_video, fichiers } = req.body;

    // Vérifier propriétaire
    const formation = await db.query(`SELECT createur_id FROM formations WHERE id = $1`, [formationId]);
    if (formation.rows.length === 0) {
      throw errors.notFound('Formation non trouvée');
    }
    if (formation.rows[0].createur_id !== req.user.id && req.user.role !== ROLES.ADMIN) {
      throw errors.forbidden('Vous n\'êtes pas autorisé à modifier cette formation');
    }

    const result = await db.query(
      `INSERT INTO modules_formation (formation_id, titre, contenu, type_contenu, 
                                       duree_minutes, ordre, url_video, fichiers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [formationId, titre, contenu, type_contenu || 'texte', duree_minutes, ordre, url_video, fichiers]
    );

    res.status(201).json({
      success: true,
      message: 'Module ajouté',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.updateModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { titre, contenu, type_contenu, duree_minutes, ordre, url_video } = req.body;

    const result = await db.query(
      `UPDATE modules_formation 
       SET titre = COALESCE($1, titre),
           contenu = COALESCE($2, contenu),
           type_contenu = COALESCE($3, type_contenu),
           duree_minutes = COALESCE($4, duree_minutes),
           ordre = COALESCE($5, ordre),
           url_video = COALESCE($6, url_video),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [titre, contenu, type_contenu, duree_minutes, ordre, url_video, moduleId]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Module non trouvé');
    }

    res.json({
      success: true,
      message: 'Module mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    await db.query(`DELETE FROM modules_formation WHERE id = $1`, [moduleId]);

    res.json({
      success: true,
      message: 'Module supprimé'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== PROGRESSION ========== */

exports.inscrireFormation = async (req, res, next) => {
  try {
    const { id: formationId } = req.params;

    // Vérifier si déjà inscrit
    const existing = await db.query(
      `SELECT * FROM progressions_formation WHERE user_id = $1 AND formation_id = $2`,
      [req.user.id, formationId]
    );

    if (existing.rows.length > 0) {
      throw errors.badRequest('Vous êtes déjà inscrit à cette formation');
    }

    const result = await db.query(
      `INSERT INTO progressions_formation (user_id, formation_id, statut, pourcentage)
       VALUES ($1, $2, 'en_cours', 0)
       RETURNING *`,
      [req.user.id, formationId]
    );

    logger.audit('Inscription formation', { userId: req.user.id, formationId });

    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyProgressions = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT pf.*, f.titre, f.type, f.niveau, f.duree_estimee
       FROM progressions_formation pf
       JOIN formations f ON pf.formation_id = f.id
       WHERE pf.user_id = $1
       ORDER BY pf.updated_at DESC`,
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
    const { id: formationId } = req.params;
    const { module_id, pourcentage } = req.body;

    // Calculer le pourcentage basé sur les modules complétés
    let nouveauPourcentage = pourcentage;
    
    if (module_id) {
      // Compter les modules et le pourcentage
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM modules_formation WHERE formation_id = $1) as total_modules,
          (SELECT COUNT(DISTINCT module_id) FROM progressions_formation pf
           JOIN modules_formation m ON pf.formation_id = m.formation_id
           WHERE pf.user_id = $2 AND pf.formation_id = $1 
           AND m.id <= $3) as modules_completes
      `, [formationId, req.user.id, module_id]);

      const { total_modules, modules_completes } = stats.rows[0];
      nouveauPourcentage = Math.round((modules_completes / total_modules) * 100);
    }

    const statut = nouveauPourcentage >= 100 ? 'terminee' : 'en_cours';
    const dateTerminee = nouveauPourcentage >= 100 ? new Date() : null;

    const result = await db.query(
      `UPDATE progressions_formation 
       SET pourcentage = $1, statut = $2, dernier_module_id = $3, 
           date_terminee = $4, updated_at = NOW()
       WHERE user_id = $5 AND formation_id = $6
       RETURNING *`,
      [nouveauPourcentage, statut, module_id, dateTerminee, req.user.id, formationId]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Progression non trouvée');
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

/* ========== QUIZ ========== */

exports.getQuiz = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    const questions = await db.query(
      `SELECT id, question, options, points FROM quiz_questions WHERE module_id = $1 ORDER BY ordre`,
      [moduleId]
    );

    res.json({
      success: true,
      data: questions.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.submitQuiz = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { reponses } = req.body; // Array de { question_id, reponse }

    // Récupérer les bonnes réponses
    const questions = await db.query(
      `SELECT id, reponse_correcte, points FROM quiz_questions WHERE module_id = $1`,
      [moduleId]
    );

    let score = 0;
    let totalPoints = 0;
    const resultats = [];

    for (const q of questions.rows) {
      totalPoints += q.points;
      const userReponse = reponses.find(r => r.question_id === q.id);
      const correct = userReponse && userReponse.reponse === q.reponse_correcte;
      if (correct) score += q.points;
      resultats.push({
        question_id: q.id,
        correct,
        points_obtenus: correct ? q.points : 0
      });
    }

    const pourcentage = Math.round((score / totalPoints) * 100);

    // Sauvegarder le résultat
    await db.query(
      `INSERT INTO resultats_quiz (user_id, module_id, score, pourcentage, reponses)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, module_id) DO UPDATE SET score = $3, pourcentage = $4, updated_at = NOW()`,
      [req.user.id, moduleId, score, pourcentage, JSON.stringify(resultats)]
    );

    res.json({
      success: true,
      data: {
        score,
        totalPoints,
        pourcentage,
        reussi: pourcentage >= 70,
        resultats
      }
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
        (SELECT COUNT(*) FROM formations WHERE statut = 'publiee') as formations_publiees,
        (SELECT COUNT(*) FROM progressions_formation) as total_inscriptions,
        (SELECT COUNT(*) FROM progressions_formation WHERE statut = 'terminee') as formations_terminees,
        (SELECT AVG(pourcentage) FROM progressions_formation) as progression_moyenne,
        (SELECT COUNT(DISTINCT user_id) FROM progressions_formation) as apprenants_actifs
    `);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    next(error);
  }
};
