/**
 * Middleware de validation des requêtes
 * AgriSmart CI - Système Agricole Intelligent
 */

const { validationResult, body, param, query } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Middleware pour vérifier les résultats de validation
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));
    
    const error = new AppError(
      'Erreur de validation des données',
      422,
      'VALIDATION_ERROR'
    );
    error.errors = errorMessages;
    
    return next(error);
  }
  
  next();
};

/**
 * Validations communes réutilisables
 */
const validators = {
  // UUID
  uuid: (field, location = 'param') => {
    const validator = location === 'param' ? param(field) : 
                      location === 'body' ? body(field) : query(field);
    return validator
      .isUUID()
      .withMessage(`${field} doit être un UUID valide`);
  },
  
  // Email
  email: () => body('email')
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email trop long (max 255 caractères)'),
  
  // Téléphone (format ivoirien)
  telephone: () => body('telephone')
    .matches(/^(\+225)?[0-9]{10}$/)
    .withMessage('Numéro de téléphone invalide (format: +2250123456789 ou 0123456789)'),
  
  // Mot de passe
  password: () => body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/[A-Z]/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule')
    .matches(/[a-z]/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule')
    .matches(/[0-9]/)
    .withMessage('Le mot de passe doit contenir au moins un chiffre'),
  
  // Nom / Prénom
  nom: () => body('nom')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
  
  prenom: () => body('prenom')
    .trim()
    .notEmpty()
    .withMessage('Le prénom est requis')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le prénom doit contenir entre 2 et 100 caractères'),
  
  prenoms: () => body('prenoms')
    .trim()
    .notEmpty()
    .withMessage('Les prénoms sont requis')
    .isLength({ min: 2, max: 100 })
    .withMessage('Les prénoms doivent contenir entre 2 et 100 caractères'),
  
  // OTP
  otp: () => body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('Le code OTP doit contenir 6 chiffres')
    .isNumeric()
    .withMessage('Le code OTP doit être numérique'),
  
  // Coordonnées GPS
  latitude: (field = 'latitude') => body(field)
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude invalide (doit être entre -90 et 90)'),
  
  longitude: (field = 'longitude') => body(field)
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude invalide (doit être entre -180 et 180)'),
  
  // Surface en hectares
  superficie: () => body('superficie')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Superficie invalide (doit être entre 0.01 et 10000 hectares)'),
  
  // Pagination
  page: () => query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif')
    .toInt(),
  
  limit: () => query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100')
    .toInt(),
  
  // Dates
  date: (field) => body(field)
    .isISO8601()
    .withMessage(`${field} doit être une date valide (format ISO 8601)`)
    .toDate(),
  
  dateOptional: (field) => body(field)
    .optional()
    .isISO8601()
    .withMessage(`${field} doit être une date valide (format ISO 8601)`)
    .toDate(),
  
  // Langue
  langue: () => body('langue')
    .optional()
    .isIn(['fr', 'dioula', 'baoule', 'bete'])
    .withMessage('Langue non supportée'),
  
  langue_preferee: () => body('langue_preferee')
    .optional()
    .isIn(['fr', 'dioula', 'baoule', 'bete'])
    .withMessage('Langue non supportée'),
  
  // Rôle
  role: () => body('role')
    .isIn(['producteur', 'conseiller', 'admin', 'partenaire'])
    .withMessage('Rôle invalide'),
  
  // Type de capteur
  typeCapteur: () => body('type')
    .isIn(['temperature', 'humidite_sol', 'humidite_air', 'luminosite', 'pluviometrie', 'ph_sol', 'niveau_eau'])
    .withMessage('Type de capteur invalide'),
  
  // Niveau d'alerte
  niveauAlerte: () => body('niveau')
    .isIn(['info', 'warning', 'critical'])
    .withMessage('Niveau d\'alerte invalide'),
  
  // Texte optionnel
  textOptional: (field, max = 500) => body(field)
    .optional()
    .trim()
    .isLength({ max })
    .withMessage(`${field} ne peut pas dépasser ${max} caractères`),
  
  // Texte requis
  textRequired: (field, min = 1, max = 500) => body(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} est requis`)
    .isLength({ min, max })
    .withMessage(`${field} doit contenir entre ${min} et ${max} caractères`),
  
  // Nombre positif
  positiveNumber: (field) => body(field)
    .isFloat({ min: 0 })
    .withMessage(`${field} doit être un nombre positif`),
  
  // Entier positif
  positiveInt: (field) => body(field)
    .isInt({ min: 0 })
    .withMessage(`${field} doit être un entier positif`)
    .toInt(),
  
  // Tableau non vide
  arrayNotEmpty: (field) => body(field)
    .isArray({ min: 1 })
    .withMessage(`${field} doit être un tableau non vide`),
  
  // Boolean
  boolean: (field) => body(field)
    .isBoolean()
    .withMessage(`${field} doit être un booléen`)
    .toBoolean()
};

/**
 * Schémas de validation prédéfinis
 */
const schemas = {
  // Inscription
  register: [
    validators.email(),
    validators.telephone(),
    validators.password(),
    validators.nom(),
    validators.prenoms(),
    validators.langue_preferee(),
    validate
  ],
  
  // Connexion
  login: [
    body('identifier')
      .notEmpty()
      .withMessage('Email ou téléphone requis'),
    body('password')
      .notEmpty()
      .withMessage('Mot de passe requis'),
    validate
  ],
  
  // Vérification OTP
  verifyOtp: [
    validators.otp(),
    body('identifier')
      .notEmpty()
      .withMessage('Email ou téléphone requis'),
    validate
  ],
  
  // Création de parcelle
  createParcelle: [
    validators.textRequired('nom', 2, 100),
    validators.superficie(),
    validators.latitude(),
    validators.longitude(),
    validators.textOptional('adresse', 255),
    body('type_sol')
      .optional()
      .isIn(['argileux', 'sableux', 'limoneux', 'calcaire', 'humifere'])
      .withMessage('Type de sol invalide'),
    validate
  ],
  
  // Création de station
  createStation: [
    validators.textRequired('nom', 2, 100),
    validators.uuid('parcelle_id', 'body'),
    validators.latitude('latitude'),
    validators.longitude('longitude'),
    validate
  ],
  
  // Création de capteur
  createCapteur: [
    validators.uuid('station_id', 'body'),
    validators.typeCapteur(),
    validators.textOptional('modele', 50),
    validators.textOptional('numero_serie', 100),
    validate
  ],
  
  // Envoi de mesure
  sendMesure: [
    validators.uuid('capteur_id', 'body'),
    body('valeur')
      .isFloat()
      .withMessage('La valeur doit être un nombre'),
    body('unite')
      .optional()
      .isString()
      .isLength({ max: 20 }),
    validators.dateOptional('timestamp'),
    validate
  ],
  
  // Pagination
  pagination: [
    validators.page(),
    validators.limit(),
    validate
  ],
  
  // Paramètre UUID
  paramUuid: (field = 'id') => [
    validators.uuid(field, 'param'),
    validate
  ]
};

module.exports = {
  validate,
  validators,
  schemas,
  body,
  param,
  query,
  validationResult
};
