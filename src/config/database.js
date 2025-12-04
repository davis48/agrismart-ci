/**
 * Configuration de la base de données PostgreSQL
 * AgriSmart CI - Système Agricole Intelligent
 */

const { Pool } = require('pg');
const winston = require('winston');

// Configuration du logger pour la DB
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Configuration du pool de connexions
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'agrismart_ci',
  user: process.env.DB_USER || 'agrismart',
  password: process.env.DB_PASSWORD,
  
  // Configuration du pool
  max: 20,                          // Nombre max de clients dans le pool
  idleTimeoutMillis: 30000,         // Timeout avant fermeture client inactif
  connectionTimeoutMillis: 10000,   // Timeout connexion
  
  // SSL (pour production)
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
};

// Création du pool
const pool = new Pool(poolConfig);

// Événements du pool
pool.on('connect', (client) => {
  logger.debug('Nouvelle connexion PostgreSQL établie');
});

pool.on('error', (err, client) => {
  logger.error('Erreur inattendue sur le client PostgreSQL', { error: err.message });
});

pool.on('remove', (client) => {
  logger.debug('Client PostgreSQL retiré du pool');
});

/**
 * Exécute une requête SQL
 * @param {string} text - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise} - Résultat de la requête
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Requête exécutée', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logger.error('Erreur requête SQL', {
      query: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
};

/**
 * Obtient un client du pool pour les transactions
 * @returns {Promise} - Client PostgreSQL
 */
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Timeout pour éviter les clients bloqués
  const timeout = setTimeout(() => {
    logger.error('Client PostgreSQL bloqué, forçage de la libération');
    client.release();
  }, 5000);
  
  client.release = () => {
    clearTimeout(timeout);
    release();
  };
  
  return client;
};

/**
 * Exécute une transaction
 * @param {Function} callback - Fonction contenant les opérations de transaction
 * @returns {Promise} - Résultat de la transaction
 */
const transaction = async (callback) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Vérifie la connexion à la base de données
 * @returns {Promise<boolean>}
 */
const checkConnection = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, current_database() as database');
    logger.info('Connexion PostgreSQL établie', {
      database: result.rows[0].database,
      time: result.rows[0].current_time
    });
    return true;
  } catch (error) {
    logger.error('Échec connexion PostgreSQL', { error: error.message });
    return false;
  }
};

/**
 * Ferme toutes les connexions du pool
 */
const closePool = async () => {
  await pool.end();
  logger.info('Pool de connexions PostgreSQL fermé');
};

/**
 * Statistiques du pool de connexions
 */
const getPoolStats = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount
});

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  checkConnection,
  closePool,
  getPoolStats
};
