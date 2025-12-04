/**
 * Middleware d'authentification JWT
 * AgriSmart CI - Système Agricole Intelligent
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError, errors } = require('./errorHandler');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware pour vérifier le token JWT
 */
const authenticate = async (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw errors.unauthorized('Token d\'authentification manquant');
    }
    
    const token = authHeader.split(' ')[1];
    
    // Vérifier le token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw errors.unauthorized('Token expiré');
      }
      throw errors.unauthorized('Token invalide');
    }
    
    // Récupérer l'utilisateur de la base de données
    const result = await db.query(
      `SELECT id, email, telephone, nom, prenoms, role, status, langue_preferee
       FROM users 
       WHERE id = $1 AND status = 'actif'`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      throw errors.unauthorized('Utilisateur non trouvé ou inactif');
    }
    
    // Attacher l'utilisateur à la requête
    req.user = result.rows[0];
    req.token = token;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware optionnel - n'échoue pas si pas de token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      const result = await db.query(
        `SELECT id, email, telephone, nom, prenoms, role, status, langue_preferee
         FROM users 
         WHERE id = $1 AND status = 'actif'`,
        [decoded.userId]
      );
      
      if (result.rows.length > 0) {
        req.user = result.rows[0];
        req.token = token;
      }
    } catch (err) {
      // Token invalide - on continue sans utilisateur
      logger.debug('Token optionnel invalide', { error: err.message });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware pour vérifier le token de refresh
 */
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw errors.badRequest('Token de rafraîchissement manquant');
    }
    
    // Vérifier le token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (err) {
      throw errors.unauthorized('Token de rafraîchissement invalide');
    }
    
    // Vérifier que le token existe en base et n'est pas révoqué
    const result = await db.query(
      `SELECT id, user_id, expires_at, revoked
       FROM refresh_tokens 
       WHERE token = $1`,
      [refreshToken]
    );
    
    if (result.rows.length === 0) {
      throw errors.unauthorized('Token de rafraîchissement non reconnu');
    }
    
    const tokenData = result.rows[0];
    
    if (tokenData.revoked) {
      throw errors.unauthorized('Token de rafraîchissement révoqué');
    }
    
    if (new Date(tokenData.expires_at) < new Date()) {
      throw errors.unauthorized('Token de rafraîchissement expiré');
    }
    
    // Récupérer l'utilisateur
    const userResult = await db.query(
      `SELECT id, email, telephone, nom, prenoms, role, status, langue_preferee
       FROM users 
       WHERE id = $1 AND status = 'actif'`,
      [tokenData.user_id]
    );
    
    if (userResult.rows.length === 0) {
      throw errors.unauthorized('Utilisateur non trouvé ou inactif');
    }
    
    req.user = userResult.rows[0];
    req.refreshTokenId = tokenData.id;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Générer un token JWT
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

/**
 * Générer un refresh token
 */
const generateRefreshToken = async (userId) => {
  const token = jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours
  
  // Stocker en base de données
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
  
  return token;
};

/**
 * Révoquer un refresh token
 */
const revokeRefreshToken = async (tokenId) => {
  await db.query(
    `UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
    [tokenId]
  );
};

/**
 * Révoquer tous les refresh tokens d'un utilisateur
 */
const revokeAllUserTokens = async (userId) => {
  await db.query(
    `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
    [userId]
  );
};

module.exports = {
  authenticate,
  optionalAuth,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens
};
