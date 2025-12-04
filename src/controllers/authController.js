/**
 * Contrôleur d'authentification
 * AgriSmart CI - Système Agricole Intelligent
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const { errors } = require('../middlewares/errorHandler');
const { 
  generateAccessToken, 
  generateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens
} = require('../middlewares/auth');
const logger = require('../utils/logger');
const smsService = require('../services/smsService');
const emailService = require('../services/emailService');

/**
 * Générer un code OTP à 6 chiffres
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Inscription d'un nouvel utilisateur
 */
exports.register = async (req, res, next) => {
  try {
    const { email, telephone, password, nom, prenoms, langue_preferee = 'fr' } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.query(
      `SELECT id FROM users WHERE email = $1 OR telephone = $2`,
      [email, telephone]
    );

    if (existingUser.rows.length > 0) {
      throw errors.conflict('Un utilisateur avec cet email ou ce téléphone existe déjà');
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Créer l'utilisateur (colonnes selon le schéma SQL)
    const result = await db.query(
      `INSERT INTO users (email, telephone, password_hash, nom, prenoms, langue_preferee, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'en_attente')
       RETURNING id, email, telephone, nom, prenoms, role, status, langue_preferee, created_at`,
      [email, telephone, hashedPassword, nom, prenoms, langue_preferee]
    );

    const user = result.rows[0];

    // Générer et envoyer l'OTP
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + config.otp.expiresIn);

    await db.query(
      `INSERT INTO otp_codes (user_id, code, type, expires_at)
       VALUES ($1, $2, 'verification', $3)`,
      [user.id, otp, otpExpires]
    );

    // Envoyer l'OTP par SMS
    try {
      await smsService.sendOtp(telephone, otp);
    } catch (smsError) {
      logger.warn('Échec envoi SMS OTP', { userId: user.id, error: smsError.message });
    }

    // Envoyer également par email
    try {
      await emailService.sendOtp(email, otp, nom);
    } catch (emailError) {
      logger.warn('Échec envoi Email OTP', { userId: user.id, error: emailError.message });
    }

    logger.audit('Inscription utilisateur', { userId: user.id, email });

    res.status(201).json({
      success: true,
      message: 'Inscription réussie. Un code de vérification a été envoyé.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          telephone: user.telephone,
          nom: user.nom,
          prenom: user.prenoms
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Connexion (première étape - envoi OTP)
 */
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    // Rechercher l'utilisateur par email ou téléphone
    const result = await db.query(
      `SELECT id, email, telephone, password_hash, nom, prenoms, role, status, langue_preferee
       FROM users 
       WHERE (email = $1 OR telephone = $1)`,
      [identifier]
    );

    if (result.rows.length === 0) {
      throw errors.unauthorized('Identifiants invalides');
    }

    const user = result.rows[0];

    // Vérifier le statut
    if (user.status === 'suspendu') {
      throw errors.forbidden('Votre compte est suspendu');
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw errors.unauthorized('Identifiants invalides');
    }

    // Générer l'OTP
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + config.otp.expiresIn);

    // Supprimer les anciens OTP et créer le nouveau
    await db.query(`DELETE FROM otp_codes WHERE user_id = $1 AND type = 'login'`, [user.id]);
    await db.query(
      `INSERT INTO otp_codes (user_id, code, type, expires_at)
       VALUES ($1, $2, 'login', $3)`,
      [user.id, otp, otpExpires]
    );

    // Envoyer l'OTP
    try {
      await smsService.sendOtp(user.telephone, otp);
    } catch (smsError) {
      logger.warn('Échec envoi SMS OTP', { userId: user.id, error: smsError.message });
    }

    res.json({
      success: true,
      message: 'Code de vérification envoyé',
      data: {
        userId: user.id,
        maskedPhone: user.telephone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vérification du code OTP
 */
exports.verifyOtp = async (req, res, next) => {
  try {
    const { identifier, otp } = req.body;

    // Rechercher l'utilisateur
    const userResult = await db.query(
      `SELECT id, email, telephone, nom, prenoms, role, status, langue_preferee
       FROM users 
       WHERE email = $1 OR telephone = $1`,
      [identifier]
    );

    if (userResult.rows.length === 0) {
      throw errors.unauthorized('Utilisateur non trouvé');
    }

    const user = userResult.rows[0];

    // Vérifier l'OTP
    const otpResult = await db.query(
      `SELECT id, code, type, expires_at, attempts
       FROM otp_codes 
       WHERE user_id = $1 AND code = $2 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, otp]
    );

    if (otpResult.rows.length === 0) {
      // Incrémenter les tentatives
      await db.query(
        `UPDATE otp_codes SET attempts = attempts + 1 
         WHERE user_id = $1 AND used = false`,
        [user.id]
      );
      throw errors.unauthorized('Code OTP invalide');
    }

    const otpData = otpResult.rows[0];

    // Vérifier l'expiration
    if (new Date(otpData.expires_at) < new Date()) {
      throw errors.unauthorized('Code OTP expiré');
    }

    // Vérifier le nombre de tentatives
    if (otpData.attempts >= config.otp.maxAttempts) {
      throw errors.forbidden('Nombre maximum de tentatives atteint');
    }

    // Marquer l'OTP comme utilisé
    await db.query(`UPDATE otp_codes SET used = true WHERE id = $1`, [otpData.id]);

    // Si c'est une vérification d'inscription, activer le compte
    if (otpData.type === 'verification' && user.status === 'en_attente') {
      await db.query(
        `UPDATE users SET status = 'actif', email_verified = true WHERE id = $1`,
        [user.id]
      );
      user.status = 'actif';
    }

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    // Mettre à jour la dernière connexion
    await db.query(
      `UPDATE users SET derniere_connexion = NOW() WHERE id = $1`,
      [user.id]
    );

    logger.audit('Connexion réussie', { userId: user.id });

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          email: user.email,
          telephone: user.telephone,
          nom: user.nom,
          prenom: user.prenoms,
          role: user.role,
          langue: user.langue_preferee
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rafraîchir le token d'accès
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const user = req.user;

    // Générer un nouveau token d'accès
    const accessToken = generateAccessToken(user);

    res.json({
      success: true,
      data: { accessToken }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Déconnexion
 */
exports.logout = async (req, res, next) => {
  try {
    // Révoquer tous les refresh tokens de l'utilisateur
    await revokeAllUserTokens(req.user.id);

    logger.audit('Déconnexion', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Demande de réinitialisation du mot de passe
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    // Rechercher l'utilisateur
    const result = await db.query(
      `SELECT id, email, telephone, nom FROM users 
       WHERE email = $1 OR telephone = $1`,
      [identifier]
    );

    // Ne pas révéler si l'utilisateur existe
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Si un compte existe avec cet identifiant, un code de réinitialisation sera envoyé'
      });
    }

    const user = result.rows[0];

    // Générer l'OTP
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + config.otp.expiresIn);

    // Supprimer les anciens OTP et créer le nouveau
    await db.query(`DELETE FROM otp_codes WHERE user_id = $1 AND type = 'reset'`, [user.id]);
    await db.query(
      `INSERT INTO otp_codes (user_id, code, type, expires_at)
       VALUES ($1, $2, 'reset', $3)`,
      [user.id, otp, otpExpires]
    );

    // Envoyer l'OTP
    try {
      await smsService.sendOtp(user.telephone, otp);
      await emailService.sendPasswordReset(user.email, otp, user.nom);
    } catch (err) {
      logger.warn('Échec envoi OTP reset', { userId: user.id, error: err.message });
    }

    res.json({
      success: true,
      message: 'Si un compte existe avec cet identifiant, un code de réinitialisation sera envoyé'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Réinitialisation du mot de passe
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    // Rechercher l'utilisateur
    const userResult = await db.query(
      `SELECT id FROM users WHERE email = $1 OR telephone = $1`,
      [identifier]
    );

    if (userResult.rows.length === 0) {
      throw errors.unauthorized('Requête invalide');
    }

    const userId = userResult.rows[0].id;

    // Vérifier l'OTP
    const otpResult = await db.query(
      `SELECT id, expires_at FROM otp_codes 
       WHERE user_id = $1 AND code = $2 AND type = 'reset' AND used = false`,
      [userId, otp]
    );

    if (otpResult.rows.length === 0 || new Date(otpResult.rows[0].expires_at) < new Date()) {
      throw errors.unauthorized('Code invalide ou expiré');
    }

    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Mettre à jour le mot de passe
    await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hashedPassword, userId]
    );

    // Marquer l'OTP comme utilisé
    await db.query(`UPDATE otp_codes SET used = true WHERE id = $1`, [otpResult.rows[0].id]);

    // Révoquer tous les refresh tokens
    await revokeAllUserTokens(userId);

    logger.audit('Réinitialisation mot de passe', { userId });

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Renvoyer le code OTP
 */
exports.resendOtp = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    // Rechercher l'utilisateur
    const result = await db.query(
      `SELECT id, email, telephone, nom FROM users 
       WHERE email = $1 OR telephone = $1`,
      [identifier]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Utilisateur non trouvé');
    }

    const user = result.rows[0];

    // Vérifier le rate limiting (max 3 renvois par heure)
    const recentOtps = await db.query(
      `SELECT COUNT(*) FROM otp_codes 
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [user.id]
    );

    if (parseInt(recentOtps.rows[0].count) >= 5) {
      throw errors.forbidden('Trop de demandes. Réessayez dans une heure.');
    }

    // Générer et envoyer un nouvel OTP
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + config.otp.expiresIn);

    await db.query(
      `INSERT INTO otp_codes (user_id, code, type, expires_at)
       VALUES ($1, $2, 'login', $3)`,
      [user.id, otp, otpExpires]
    );

    try {
      await smsService.sendOtp(user.telephone, otp);
    } catch (err) {
      logger.warn('Échec renvoi SMS OTP', { userId: user.id, error: err.message });
    }

    res.json({
      success: true,
      message: 'Nouveau code envoyé'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtenir le profil de l'utilisateur connecté
 */
exports.getMe = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, email, telephone, nom, prenoms, role, status, langue_preferee, 
              photo_url, adresse, localisation, created_at, derniere_connexion
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour le profil
 */
exports.updateMe = async (req, res, next) => {
  try {
    const { nom, prenoms, langue_preferee, adresse, localisation } = req.body;

    const result = await db.query(
      `UPDATE users 
       SET nom = COALESCE($1, nom),
           prenoms = COALESCE($2, prenoms),
           langue_preferee = COALESCE($3, langue_preferee),
           adresse = COALESCE($4, adresse),
           localisation = COALESCE($5, localisation),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, email, telephone, nom, prenoms, role, langue_preferee, adresse, localisation`,
      [nom, prenoms, langue_preferee, adresse, localisation, req.user.id]
    );

    logger.audit('Mise à jour profil', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Profil mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Changer le mot de passe
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Récupérer le hash actuel
    const result = await db.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.user.id]
    );

    // Vérifier l'ancien mot de passe
    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      throw errors.unauthorized('Mot de passe actuel incorrect');
    }

    // Hasher et mettre à jour le nouveau mot de passe
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hashedPassword, req.user.id]
    );

    // Révoquer tous les refresh tokens (force reconnexion)
    await revokeAllUserTokens(req.user.id);

    logger.audit('Changement mot de passe', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });
  } catch (error) {
    next(error);
  }
};
