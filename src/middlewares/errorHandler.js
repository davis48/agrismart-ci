/**
 * Middleware de gestion globale des erreurs
 * AgriSmart CI - Système Agricole Intelligent
 */

const logger = require('../utils/logger');
const config = require('../config');

// Classe d'erreur personnalisée
class AppError extends Error {
  constructor(message, statusCode, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Erreurs prédéfinies
const errors = {
  badRequest: (message = 'Requête invalide') => new AppError(message, 400, 'BAD_REQUEST'),
  unauthorized: (message = 'Non autorisé') => new AppError(message, 401, 'UNAUTHORIZED'),
  forbidden: (message = 'Accès interdit') => new AppError(message, 403, 'FORBIDDEN'),
  notFound: (message = 'Ressource non trouvée') => new AppError(message, 404, 'NOT_FOUND'),
  conflict: (message = 'Conflit de données') => new AppError(message, 409, 'CONFLICT'),
  validation: (message = 'Erreur de validation') => new AppError(message, 422, 'VALIDATION_ERROR'),
  internal: (message = 'Erreur interne du serveur') => new AppError(message, 500, 'INTERNAL_ERROR'),
  database: (message = 'Erreur de base de données') => new AppError(message, 500, 'DATABASE_ERROR'),
  external: (message = 'Erreur de service externe') => new AppError(message, 502, 'EXTERNAL_SERVICE_ERROR')
};

// Gestionnaire d'erreurs PostgreSQL
const handlePgError = (error) => {
  switch (error.code) {
    case '23505': // Violation de contrainte unique
      return new AppError('Cette donnée existe déjà', 409, 'DUPLICATE_ENTRY');
    case '23503': // Violation de clé étrangère
      return new AppError('Référence invalide', 400, 'FOREIGN_KEY_VIOLATION');
    case '23502': // Violation de contrainte NOT NULL
      return new AppError('Données obligatoires manquantes', 400, 'NOT_NULL_VIOLATION');
    case '22P02': // Syntaxe UUID invalide
      return new AppError('Format d\'identifiant invalide', 400, 'INVALID_UUID');
    case '42P01': // Table inexistante
      return new AppError('Erreur de configuration base de données', 500, 'DATABASE_ERROR');
    default:
      return new AppError('Erreur de base de données', 500, 'DATABASE_ERROR');
  }
};

// Gestionnaire d'erreurs JWT
const handleJwtError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Token invalide', 401, 'INVALID_TOKEN');
  }
  if (error.name === 'TokenExpiredError') {
    return new AppError('Token expiré', 401, 'TOKEN_EXPIRED');
  }
  return new AppError('Erreur d\'authentification', 401, 'AUTH_ERROR');
};

// Middleware de gestion des erreurs
const errorHandler = (err, req, res, next) => {
  let error = err;
  
  // Erreur PostgreSQL
  if (err.code && typeof err.code === 'string' && err.code.match(/^\d/)) {
    error = handlePgError(err);
  }
  
  // Erreur JWT
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJwtError(err);
  }
  
  // Erreur de syntaxe JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('JSON invalide dans le corps de la requête', 400, 'INVALID_JSON');
  }
  
  // Erreur de validation express-validator
  if (err.array && typeof err.array === 'function') {
    const validationErrors = err.array();
    error = new AppError(
      validationErrors.map(e => e.msg).join(', '),
      422,
      'VALIDATION_ERROR'
    );
  }
  
  // Définir le statut par défaut
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  
  // Log de l'erreur
  if (statusCode >= 500) {
    logger.error('Erreur serveur', {
      error: error.message,
      code,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });
  } else {
    logger.warn('Erreur client', {
      error: error.message,
      code,
      path: req.path,
      method: req.method
    });
  }
  
  // Réponse
  const response = {
    success: false,
    message: error.message,
    code
  };
  
  // Ajouter la stack trace en développement
  if (config.isDev && error.stack) {
    response.stack = error.stack;
  }
  
  // Ajouter les erreurs de validation si présentes
  if (error.errors) {
    response.errors = error.errors;
  }
  
  res.status(statusCode).json(response);
};

module.exports = errorHandler;
module.exports.AppError = AppError;
module.exports.errors = errors;
