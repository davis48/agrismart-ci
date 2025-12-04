/**
 * Service Email via Nodemailer
 * AgriSmart CI - Système Agricole Intelligent
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

// Créer le transporteur
let transporter = null;

if (config.email.host) {
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass
    }
  });

  // Vérifier la connexion
  transporter.verify((error) => {
    if (error) {
      logger.warn('Erreur connexion email', { error: error.message });
    } else {
      logger.info('Serveur email prêt');
    }
  });
}

/**
 * Envoyer un email
 */
exports.sendEmail = async (to, subject, html, text) => {
  if (!transporter) {
    logger.warn('Email non configuré, email non envoyé', { to, subject });
    return { success: false, reason: 'Email non configuré' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"AgriSmart CI" <${config.email.from}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    });

    logger.info('Email envoyé', { to, messageId: info.messageId });

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    logger.error('Erreur envoi email', { to, error: error.message });
    throw error;
  }
};

/**
 * Envoyer un code OTP par email
 */
exports.sendOtp = async (to, otp, nom) => {
  const subject = 'Votre code de vérification AgriSmart CI';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2E7D32; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .code { font-size: 32px; font-weight: bold; color: #2E7D32; 
                text-align: center; padding: 20px; background: white; 
                border-radius: 8px; letter-spacing: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌱 AgriSmart CI</h1>
        </div>
        <div class="content">
          <p>Bonjour ${nom || 'Utilisateur'},</p>
          <p>Voici votre code de vérification :</p>
          <div class="code">${otp}</div>
          <p>Ce code expire dans <strong>10 minutes</strong>.</p>
          <p>Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AgriSmart CI - Système Agricole Intelligent</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return this.sendEmail(to, subject, html);
};

/**
 * Envoyer un email de réinitialisation de mot de passe
 */
exports.sendPasswordReset = async (to, otp, nom) => {
  const subject = 'Réinitialisation de votre mot de passe AgriSmart CI';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2E7D32; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .code { font-size: 32px; font-weight: bold; color: #2E7D32; 
                text-align: center; padding: 20px; background: white; 
                border-radius: 8px; letter-spacing: 5px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 AgriSmart CI</h1>
        </div>
        <div class="content">
          <p>Bonjour ${nom || 'Utilisateur'},</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Voici votre code de réinitialisation :</p>
          <div class="code">${otp}</div>
          <p>Ce code expire dans <strong>10 minutes</strong>.</p>
          <div class="warning">
            ⚠️ Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email 
            et assurez-vous que votre compte est sécurisé.
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AgriSmart CI - Système Agricole Intelligent</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return this.sendEmail(to, subject, html);
};

/**
 * Envoyer une alerte par email
 */
exports.sendAlert = async (to, alerte, nom) => {
  const niveauInfo = {
    info: { emoji: 'ℹ️', color: '#17a2b8', label: 'Information' },
    warning: { emoji: '⚠️', color: '#ffc107', label: 'Avertissement' },
    critical: { emoji: '🚨', color: '#dc3545', label: 'Critique' }
  };

  const info = niveauInfo[alerte.niveau] || niveauInfo.info;
  const subject = `${info.emoji} [${info.label}] ${alerte.titre}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${info.color}; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .alert-box { background: white; border-left: 4px solid ${info.color}; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .btn { display: inline-block; background: #2E7D32; color: white; 
               padding: 12px 24px; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${info.emoji} Alerte AgriSmart CI</h1>
        </div>
        <div class="content">
          <p>Bonjour ${nom || 'Utilisateur'},</p>
          <div class="alert-box">
            <h2>${alerte.titre}</h2>
            <p>${alerte.message}</p>
            ${alerte.parcelle_nom ? `<p><strong>Parcelle :</strong> ${alerte.parcelle_nom}</p>` : ''}
            <p><small>Reçue le ${new Date().toLocaleString('fr-FR')}</small></p>
          </div>
          <p style="text-align: center;">
            <a href="${config.server.frontendUrl || 'https://agrismart-ci.com'}/alertes" class="btn">
              Voir dans l'application
            </a>
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AgriSmart CI - Système Agricole Intelligent</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return this.sendEmail(to, subject, html);
};

/**
 * Envoyer un email de bienvenue
 */
exports.sendWelcome = async (to, nom) => {
  const subject = 'Bienvenue sur AgriSmart CI ! 🌱';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2E7D32; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .feature { display: flex; align-items: center; margin: 15px 0; }
        .feature-icon { font-size: 24px; margin-right: 15px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .btn { display: inline-block; background: #2E7D32; color: white; 
               padding: 12px 24px; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌱 Bienvenue sur AgriSmart CI</h1>
          <p>L'agriculture intelligente à votre portée</p>
        </div>
        <div class="content">
          <p>Bonjour ${nom},</p>
          <p>Félicitations ! Votre compte AgriSmart CI a été créé avec succès.</p>
          
          <h3>Voici ce que vous pouvez faire :</h3>
          <div class="feature">
            <span class="feature-icon">📊</span>
            <span>Suivre vos parcelles en temps réel</span>
          </div>
          <div class="feature">
            <span class="feature-icon">🌡️</span>
            <span>Recevoir des données de vos capteurs IoT</span>
          </div>
          <div class="feature">
            <span class="feature-icon">🔔</span>
            <span>Être alerté en cas de problème</span>
          </div>
          <div class="feature">
            <span class="feature-icon">💡</span>
            <span>Recevoir des recommandations personnalisées</span>
          </div>
          <div class="feature">
            <span class="feature-icon">🛒</span>
            <span>Vendre vos produits sur le marketplace</span>
          </div>

          <p style="text-align: center; margin-top: 30px;">
            <a href="${config.server.frontendUrl || 'https://agrismart-ci.com'}" class="btn">
              Commencer maintenant
            </a>
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AgriSmart CI - Système Agricole Intelligent</p>
          <p>Développé pour les agriculteurs de Côte d'Ivoire 🇨🇮</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return this.sendEmail(to, subject, html);
};

module.exports = exports;
