/**
 * Configuration générale de l'application
 * AgriSmart CI - Système Agricole Intelligent
 */

require('dotenv').config();

const config = {
  // Environnement
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  
  // Serveur
  server: {
    port: parseInt(process.env.PORT) || 3000,
    apiVersion: process.env.API_VERSION || 'v1'
  },
  
  // Base de données
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'agrismart_ci',
    user: process.env.DB_USER || 'agrismart',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  // OTP
  otp: {
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES) || 10,
    expiresIn: (parseInt(process.env.OTP_EXPIRES_MINUTES) || 10) * 60 * 1000, // en millisecondes
    length: parseInt(process.env.OTP_LENGTH) || 6,
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS) || 3
  },
  
  // Twilio (SMS/WhatsApp)
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER
  },
  
  // Email
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM || 'AgriSmart CI <noreply@agrismart.ci>'
  },
  
  // API Météo
  weather: {
    apiUrl: process.env.WEATHER_API_URL || 'https://api.openweathermap.org/data/2.5',
    apiKey: process.env.WEATHER_API_KEY
  },
  
  // Upload fichiers
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  
  // IoT
  iot: {
    gatewaySecret: process.env.IOT_GATEWAY_SECRET,
    loraNetworkKey: process.env.LORA_NETWORK_KEY
  },
  
  // Logs
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log'
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3001']
  },
  
  // Seuils d'alerte par défaut
  alertThresholds: {
    humidity: {
      criticalLow: 20,
      warningLow: 30,
      warningHigh: 80,
      criticalHigh: 90
    },
    temperature: {
      criticalLow: 10,
      warningLow: 15,
      warningHigh: 40,
      criticalHigh: 45
    },
    ph: {
      criticalLow: 4.5,
      warningLow: 5.5,
      warningHigh: 7.5,
      criticalHigh: 8.5
    }
  },
  
  // Langues supportées
  languages: ['fr', 'baoule', 'malinke', 'senoufo'],
  defaultLanguage: 'fr'
};

// Validation des configurations critiques en production
if (config.isProd) {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DB_PASSWORD',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN'
  ];
  
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error(`Variables d'environnement manquantes: ${missingVars.join(', ')}`);
    process.exit(1);
  }
}

module.exports = config;
