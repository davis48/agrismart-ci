/**
 * Configuration du logger Winston
 * AgriSmart CI - Système Agricole Intelligent
 */

const winston = require('winston');
const path = require('path');
const config = require('../config');

// Format personnalisé pour les logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Ajouter les métadonnées si présentes
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Ajouter la stack trace si présente
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Configuration des transports
const transports = [
  // Console (toujours actif)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    )
  })
];

// Fichier de logs en production
if (config.isProd || config.logs.file) {
  const logDir = path.dirname(config.logs.file);
  
  // Logs généraux
  transports.push(
    new winston.transports.File({
      filename: config.logs.file,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  );
  
  // Logs d'erreurs séparés
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  );
}

// Création du logger
const logger = winston.createLogger({
  level: config.logs.level,
  format: customFormat,
  transports,
  exitOnError: false
});

// Méthode pour les logs d'audit
logger.audit = (action, data) => {
  logger.info(`[AUDIT] ${action}`, { audit: true, ...data });
};

// Méthode pour les logs IoT
logger.iot = (event, data) => {
  logger.debug(`[IoT] ${event}`, { iot: true, ...data });
};

// Méthode pour les logs de performance
logger.perf = (operation, duration) => {
  logger.debug(`[PERF] ${operation}`, { performance: true, duration: `${duration}ms` });
};

module.exports = logger;
