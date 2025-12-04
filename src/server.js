/**
 * Point d'entrée principal du serveur
 * AgriSmart CI - Système Agricole Intelligent
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

const config = require('./config');
const { checkConnection, closePool } = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');

// Création de l'application Express
const app = express();
const httpServer = createServer(app);

// Configuration Socket.IO pour les alertes temps réel
const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST']
  }
});

// Middleware global pour injecter io
app.set('io', io);

// =====================================================
// MIDDLEWARES DE SÉCURITÉ
// =====================================================

// Protection des headers HTTP
app.use(helmet({
  contentSecurityPolicy: config.isProd,
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Rate limiting spécifique pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/otp', authLimiter);

// =====================================================
// MIDDLEWARES GÉNÉRAUX
// =====================================================

// Compression des réponses
app.use(compression());

// Parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging des requêtes
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Fichiers statiques (uploads)
app.use('/uploads', express.static(config.upload.path));

// =====================================================
// ROUTES
// =====================================================

// Route de santé
app.get('/health', async (req, res) => {
  const dbConnected = await checkConnection();
  res.json({
    status: dbConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Routes API
app.use(`/api/${config.server.apiVersion}`, routes);

// Route 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl
  });
});

// Gestionnaire d'erreurs global
app.use(errorHandler);

// =====================================================
// SOCKET.IO - Événements temps réel
// =====================================================

io.on('connection', (socket) => {
  logger.info(`Client WebSocket connecté: ${socket.id}`);
  
  // Rejoindre une room pour un utilisateur
  socket.on('join:user', (userId) => {
    socket.join(`user:${userId}`);
    logger.debug(`Socket ${socket.id} a rejoint user:${userId}`);
  });
  
  // Rejoindre une room pour une parcelle
  socket.on('join:parcelle', (parcelleId) => {
    socket.join(`parcelle:${parcelleId}`);
    logger.debug(`Socket ${socket.id} a rejoint parcelle:${parcelleId}`);
  });
  
  // Rejoindre une room pour une coopérative
  socket.on('join:cooperative', (cooperativeId) => {
    socket.join(`cooperative:${cooperativeId}`);
  });
  
  socket.on('disconnect', () => {
    logger.debug(`Client WebSocket déconnecté: ${socket.id}`);
  });
});

// Fonction pour émettre des alertes
app.set('emitAlert', (userId, alert) => {
  io.to(`user:${userId}`).emit('alert:new', alert);
});

// Fonction pour émettre des mises à jour de mesures
app.set('emitMeasurement', (parcelleId, measurement) => {
  io.to(`parcelle:${parcelleId}`).emit('measurement:new', measurement);
});

// =====================================================
// DÉMARRAGE DU SERVEUR
// =====================================================

const startServer = async () => {
  try {
    // Vérification de la connexion à la base de données
    const dbConnected = await checkConnection();
    if (!dbConnected) {
      logger.error('Impossible de se connecter à la base de données');
      process.exit(1);
    }
    
    // Démarrage du serveur
    httpServer.listen(config.server.port, () => {
      logger.info(`🌱 AgriSmart CI Backend démarré`);
      logger.info(`📡 Port: ${config.server.port}`);
      logger.info(`🌍 Environnement: ${config.env}`);
      logger.info(`📚 API Version: ${config.server.apiVersion}`);
      logger.info(`🔗 URL: http://localhost:${config.server.port}`);
    });
    
  } catch (error) {
    logger.error('Erreur au démarrage du serveur', { error: error.message });
    process.exit(1);
  }
};

// =====================================================
// GESTION DE L'ARRÊT
// =====================================================

const gracefulShutdown = async (signal) => {
  logger.info(`Signal ${signal} reçu, arrêt en cours...`);
  
  // Fermer le serveur HTTP
  httpServer.close(() => {
    logger.info('Serveur HTTP fermé');
  });
  
  // Fermer les connexions WebSocket
  io.close(() => {
    logger.info('Connexions WebSocket fermées');
  });
  
  // Fermer le pool de connexions DB
  await closePool();
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('Exception non capturée', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesse rejetée non gérée', { reason });
});

// Démarrage
startServer();

module.exports = { app, httpServer, io };
