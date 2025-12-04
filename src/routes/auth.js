/**
 * Routes d'authentification
 * AgriSmart CI - Système Agricole Intelligent
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { schemas, authenticate, verifyRefreshToken } = require('../middlewares');

/**
 * @route   POST /api/auth/register
 * @desc    Inscription d'un nouvel utilisateur
 * @access  Public
 */
router.post('/register', schemas.register, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Connexion (première étape - envoi OTP)
 * @access  Public
 */
router.post('/login', schemas.login, authController.login);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Vérification du code OTP
 * @access  Public
 */
router.post('/verify-otp', schemas.verifyOtp, authController.verifyOtp);

/**
 * @route   POST /api/auth/refresh
 * @desc    Rafraîchir le token d'accès
 * @access  Public (avec refresh token valide)
 */
router.post('/refresh', verifyRefreshToken, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnexion (révocation du refresh token)
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Demande de réinitialisation du mot de passe
 * @access  Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Réinitialisation du mot de passe
 * @access  Public (avec token valide)
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Renvoyer le code OTP
 * @access  Public
 */
router.post('/resend-otp', authController.resendOtp);

/**
 * @route   GET /api/auth/me
 * @desc    Obtenir le profil de l'utilisateur connecté
 * @access  Private
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @route   PUT /api/auth/me
 * @desc    Mettre à jour le profil
 * @access  Private
 */
router.put('/me', authenticate, authController.updateMe);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Changer le mot de passe
 * @access  Private
 */
router.put('/change-password', authenticate, authController.changePassword);

module.exports = router;
