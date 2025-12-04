/**
 * Contrôleur du Marketplace
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const { errors } = require('../middlewares/errorHandler');
const { ROLES } = require('../middlewares/rbac');
const logger = require('../utils/logger');

/* ========== PRODUITS ========== */

exports.getAllProduits = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { categorie, prix_min, prix_max } = req.query;

    let query = `
      SELECT p.*, u.nom as vendeur_nom, u.telephone as vendeur_telephone, u.localisation
      FROM produits_marketplace p
      JOIN users u ON p.vendeur_id = u.id
      WHERE p.statut = 'actif' AND p.quantite_disponible > 0
    `;
    const params = [];
    let paramIndex = 1;

    if (categorie) {
      query += ` AND p.categorie = $${paramIndex++}`;
      params.push(categorie);
    }

    if (prix_min) {
      query += ` AND p.prix >= $${paramIndex++}`;
      params.push(parseFloat(prix_min));
    }

    if (prix_max) {
      query += ` AND p.prix <= $${paramIndex++}`;
      params.push(parseFloat(prix_max));
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
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

exports.searchProduits = async (req, res, next) => {
  try {
    const { q, categorie } = req.query;

    let query = `
      SELECT p.*, u.nom as vendeur_nom, u.localisation
      FROM produits_marketplace p
      JOIN users u ON p.vendeur_id = u.id
      WHERE p.statut = 'actif' AND p.quantite_disponible > 0
    `;
    const params = [];
    let paramIndex = 1;

    if (q) {
      query += ` AND (p.nom ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (categorie) {
      query += ` AND p.categorie = $${paramIndex++}`;
      params.push(categorie);
    }

    query += ` ORDER BY p.created_at DESC LIMIT 50`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyProduits = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM produits_marketplace 
       WHERE vendeur_id = $1 
       ORDER BY created_at DESC`,
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

exports.createProduit = async (req, res, next) => {
  try {
    const { nom, description, categorie, prix, unite, quantite_disponible, localisation } = req.body;

    // Traiter les images si présentes
    let images = [];
    if (req.files && req.files.length > 0) {
      // TODO: Upload vers stockage (S3, local, etc.)
      images = req.files.map(f => `/uploads/produits/${f.filename}`);
    }

    const result = await db.query(
      `INSERT INTO produits_marketplace (vendeur_id, nom, description, categorie, prix, unite, 
                                          quantite_disponible, localisation, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, nom, description, categorie, prix, unite || 'kg', 
       quantite_disponible, localisation, images]
    );

    logger.audit('Création produit marketplace', { userId: req.user.id, produitId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Produit ajouté au marketplace',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getProduitById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT p.*, u.nom as vendeur_nom, u.prenom as vendeur_prenom, 
              u.telephone as vendeur_telephone, u.localisation as vendeur_localisation
       FROM produits_marketplace p
       JOIN users u ON p.vendeur_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Produit non trouvé');
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProduit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, description, prix, quantite_disponible, statut } = req.body;

    // Vérifier que c'est le propriétaire ou admin
    const produit = await db.query(`SELECT vendeur_id FROM produits_marketplace WHERE id = $1`, [id]);
    if (produit.rows.length === 0) {
      throw errors.notFound('Produit non trouvé');
    }
    if (produit.rows[0].vendeur_id !== req.user.id && req.user.role !== ROLES.ADMIN) {
      throw errors.forbidden('Vous n\'êtes pas autorisé à modifier ce produit');
    }

    const result = await db.query(
      `UPDATE produits_marketplace 
       SET nom = COALESCE($1, nom),
           description = COALESCE($2, description),
           prix = COALESCE($3, prix),
           quantite_disponible = COALESCE($4, quantite_disponible),
           statut = COALESCE($5, statut),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [nom, description, prix, quantite_disponible, statut, id]
    );

    res.json({
      success: true,
      message: 'Produit mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduit = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier les permissions
    const produit = await db.query(`SELECT vendeur_id FROM produits_marketplace WHERE id = $1`, [id]);
    if (produit.rows.length === 0) {
      throw errors.notFound('Produit non trouvé');
    }
    if (produit.rows[0].vendeur_id !== req.user.id && req.user.role !== ROLES.ADMIN) {
      throw errors.forbidden('Vous n\'êtes pas autorisé à supprimer ce produit');
    }

    await db.query(`UPDATE produits_marketplace SET statut = 'supprime' WHERE id = $1`, [id]);

    res.json({
      success: true,
      message: 'Produit supprimé'
    });
  } catch (error) {
    next(error);
  }
};

/* ========== COMMANDES ========== */

exports.getCommandes = async (req, res, next) => {
  try {
    const { type = 'all' } = req.query;

    let query = `
      SELECT c.*, p.nom as produit_nom, p.prix as produit_prix,
             acheteur.nom as acheteur_nom, acheteur.telephone as acheteur_telephone,
             vendeur.nom as vendeur_nom, vendeur.telephone as vendeur_telephone
      FROM commandes_marketplace c
      JOIN produits_marketplace p ON c.produit_id = p.id
      JOIN users acheteur ON c.acheteur_id = acheteur.id
      JOIN users vendeur ON p.vendeur_id = vendeur.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (type === 'achats') {
      query += ` AND c.acheteur_id = $${paramIndex++}`;
      params.push(req.user.id);
    } else if (type === 'ventes') {
      query += ` AND p.vendeur_id = $${paramIndex++}`;
      params.push(req.user.id);
    } else {
      query += ` AND (c.acheteur_id = $${paramIndex} OR p.vendeur_id = $${paramIndex})`;
      params.push(req.user.id);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

exports.createCommande = async (req, res, next) => {
  try {
    const { produit_id, quantite, adresse_livraison, notes } = req.body;

    // Vérifier le produit et la disponibilité
    const produit = await db.query(
      `SELECT * FROM produits_marketplace WHERE id = $1 AND statut = 'actif'`,
      [produit_id]
    );

    if (produit.rows.length === 0) {
      throw errors.notFound('Produit non disponible');
    }

    if (produit.rows[0].quantite_disponible < quantite) {
      throw errors.badRequest('Quantité insuffisante en stock');
    }

    if (produit.rows[0].vendeur_id === req.user.id) {
      throw errors.badRequest('Vous ne pouvez pas acheter votre propre produit');
    }

    const montant_total = produit.rows[0].prix * quantite;

    // Créer la commande
    const result = await db.query(
      `INSERT INTO commandes_marketplace (acheteur_id, produit_id, quantite, montant_total, 
                                           adresse_livraison, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, produit_id, quantite, montant_total, adresse_livraison, notes]
    );

    // Mettre à jour le stock
    await db.query(
      `UPDATE produits_marketplace SET quantite_disponible = quantite_disponible - $1 WHERE id = $2`,
      [quantite, produit_id]
    );

    logger.audit('Nouvelle commande marketplace', { 
      userId: req.user.id, 
      commandeId: result.rows[0].id,
      produitId: produit_id
    });

    res.status(201).json({
      success: true,
      message: 'Commande passée avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getCommandeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.*, p.nom as produit_nom, p.images as produit_images,
              acheteur.nom as acheteur_nom, acheteur.telephone as acheteur_telephone,
              vendeur.nom as vendeur_nom, vendeur.telephone as vendeur_telephone
       FROM commandes_marketplace c
       JOIN produits_marketplace p ON c.produit_id = p.id
       JOIN users acheteur ON c.acheteur_id = acheteur.id
       JOIN users vendeur ON p.vendeur_id = vendeur.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Commande non trouvée');
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCommandeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statut, notes } = req.body;

    const result = await db.query(
      `UPDATE commandes_marketplace 
       SET statut = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [statut, notes, id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Commande non trouvée');
    }

    logger.audit('Mise à jour statut commande', { userId: req.user.id, commandeId: id, statut });

    res.json({
      success: true,
      message: 'Statut mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelCommande = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { raison } = req.body;

    // Récupérer la commande
    const commande = await db.query(
      `SELECT c.*, p.vendeur_id FROM commandes_marketplace c
       JOIN produits_marketplace p ON c.produit_id = p.id
       WHERE c.id = $1`,
      [id]
    );

    if (commande.rows.length === 0) {
      throw errors.notFound('Commande non trouvée');
    }

    const cmd = commande.rows[0];

    // Vérifier les permissions
    if (cmd.acheteur_id !== req.user.id && cmd.vendeur_id !== req.user.id && req.user.role !== ROLES.ADMIN) {
      throw errors.forbidden('Vous n\'êtes pas autorisé à annuler cette commande');
    }

    // Annuler la commande
    await db.query(
      `UPDATE commandes_marketplace SET statut = 'annulee', notes = $1, updated_at = NOW() WHERE id = $2`,
      [raison, id]
    );

    // Remettre le stock
    await db.query(
      `UPDATE produits_marketplace SET quantite_disponible = quantite_disponible + $1 WHERE id = $2`,
      [cmd.quantite, cmd.produit_id]
    );

    logger.audit('Annulation commande', { userId: req.user.id, commandeId: id });

    res.json({
      success: true,
      message: 'Commande annulée'
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
        (SELECT COUNT(*) FROM produits_marketplace WHERE statut = 'actif') as produits_actifs,
        (SELECT COUNT(*) FROM commandes_marketplace) as total_commandes,
        (SELECT COUNT(*) FROM commandes_marketplace WHERE statut = 'livree') as commandes_livrees,
        (SELECT COALESCE(SUM(montant_total), 0) FROM commandes_marketplace WHERE statut = 'livree') as volume_ventes,
        (SELECT COUNT(DISTINCT vendeur_id) FROM produits_marketplace WHERE statut = 'actif') as vendeurs_actifs
    `);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.getVendeurStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM produits_marketplace WHERE vendeur_id = $1) as mes_produits,
        (SELECT COUNT(*) FROM produits_marketplace WHERE vendeur_id = $1 AND statut = 'actif') as produits_actifs,
        (SELECT COUNT(*) FROM commandes_marketplace c 
         JOIN produits_marketplace p ON c.produit_id = p.id 
         WHERE p.vendeur_id = $1) as commandes_recues,
        (SELECT COALESCE(SUM(c.montant_total), 0) FROM commandes_marketplace c 
         JOIN produits_marketplace p ON c.produit_id = p.id 
         WHERE p.vendeur_id = $1 AND c.statut = 'livree') as revenus_total
    `, [req.user.id]);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    next(error);
  }
};
