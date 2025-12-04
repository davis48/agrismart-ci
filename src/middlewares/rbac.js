/**
 * Middleware de contrôle d'accès basé sur les rôles (RBAC)
 * AgriSmart CI - Système Agricole Intelligent
 */

const { errors } = require('./errorHandler');

/**
 * Rôles du système
 * - admin: Accès complet à toutes les fonctionnalités
 * - conseiller: Gestion des producteurs, alertes, recommandations
 * - producteur: Accès à ses propres parcelles et données
 * - partenaire: Accès au marketplace et données agrégées
 */
const ROLES = {
  ADMIN: 'admin',
  CONSEILLER: 'conseiller',
  PRODUCTEUR: 'producteur',
  PARTENAIRE: 'partenaire'
};

/**
 * Hiérarchie des rôles (du plus élevé au moins élevé)
 */
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.CONSEILLER]: 3,
  [ROLES.PARTENAIRE]: 2,
  [ROLES.PRODUCTEUR]: 1
};

/**
 * Middleware pour restreindre l'accès à certains rôles
 * @param  {...string} allowedRoles - Rôles autorisés
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(errors.unauthorized('Authentification requise'));
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return next(errors.forbidden(
        `Accès réservé aux rôles: ${allowedRoles.join(', ')}`
      ));
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier un niveau de rôle minimum
 * @param {string} minimumRole - Rôle minimum requis
 */
const requireMinRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(errors.unauthorized('Authentification requise'));
    }
    
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;
    
    if (userLevel < requiredLevel) {
      return next(errors.forbidden(
        `Niveau d'accès insuffisant. Rôle minimum requis: ${minimumRole}`
      ));
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier la propriété d'une ressource
 * @param {Function} getResourceOwnerId - Fonction async qui retourne l'ID du propriétaire
 */
const requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(errors.unauthorized('Authentification requise'));
      }
      
      // Les admins ont toujours accès
      if (req.user.role === ROLES.ADMIN) {
        return next();
      }
      
      // Les conseillers ont accès aux ressources de leurs producteurs
      if (req.user.role === ROLES.CONSEILLER) {
        return next();
      }
      
      const ownerId = await getResourceOwnerId(req);
      
      if (ownerId !== req.user.id) {
        return next(errors.forbidden(
          'Vous n\'êtes pas autorisé à accéder à cette ressource'
        ));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware pour vérifier l'accès à une parcelle
 */
const requireParcelleAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(errors.unauthorized('Authentification requise'));
    }
    
    const parcelleId = req.params.parcelleId || req.body.parcelle_id;
    
    if (!parcelleId) {
      return next(errors.badRequest('ID de parcelle requis'));
    }
    
    // Admins et conseillers ont accès à toutes les parcelles
    if ([ROLES.ADMIN, ROLES.CONSEILLER].includes(req.user.role)) {
      return next();
    }
    
    // Vérifier si l'utilisateur est propriétaire de la parcelle
    const db = require('../config/database');
    const result = await db.query(
      `SELECT id FROM parcelles WHERE id = $1 AND proprietaire_id = $2`,
      [parcelleId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return next(errors.forbidden(
        'Vous n\'avez pas accès à cette parcelle'
      ));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware pour vérifier l'accès aux données d'un capteur
 */
const requireCapteurAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(errors.unauthorized('Authentification requise'));
    }
    
    const capteurId = req.params.capteurId || req.body.capteur_id;
    
    if (!capteurId) {
      return next(errors.badRequest('ID de capteur requis'));
    }
    
    // Admins et conseillers ont accès à tous les capteurs
    if ([ROLES.ADMIN, ROLES.CONSEILLER].includes(req.user.role)) {
      return next();
    }
    
    // Vérifier si l'utilisateur est propriétaire de la parcelle associée
    const db = require('../config/database');
    const result = await db.query(
      `SELECT c.id 
       FROM capteurs c
       JOIN stations s ON c.station_id = s.id
       JOIN parcelles p ON s.parcelle_id = p.id
       WHERE c.id = $1 AND p.proprietaire_id = $2`,
      [capteurId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return next(errors.forbidden(
        'Vous n\'avez pas accès à ce capteur'
      ));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Raccourcis pour les rôles courants
 */
const isAdmin = requireRole(ROLES.ADMIN);
const isConseiller = requireRole(ROLES.ADMIN, ROLES.CONSEILLER);
const isProducteur = requireRole(ROLES.ADMIN, ROLES.CONSEILLER, ROLES.PRODUCTEUR);
const isPartenaire = requireRole(ROLES.ADMIN, ROLES.PARTENAIRE);

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  requireRole,
  requireMinRole,
  requireOwnership,
  requireParcelleAccess,
  requireCapteurAccess,
  isAdmin,
  isConseiller,
  isProducteur,
  isPartenaire
};
