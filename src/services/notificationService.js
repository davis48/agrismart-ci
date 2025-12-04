/**
 * Service de notifications
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const smsService = require('./smsService');
const emailService = require('./emailService');
const logger = require('../utils/logger');

/**
 * Envoyer une alerte à un utilisateur (multi-canal)
 */
exports.sendAlert = async (userId, alerte) => {
  try {
    // Récupérer les informations de l'utilisateur
    const userResult = await db.query(
      `SELECT id, email, telephone, nom, prenom, 
              preferences_notification
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      logger.warn('Utilisateur non trouvé pour notification', { userId });
      return;
    }

    const user = userResult.rows[0];
    const prefs = user.preferences_notification || {
      email: true,
      sms: true,
      push: true,
      whatsapp: false
    };

    const results = {
      email: false,
      sms: false,
      whatsapp: false
    };

    // Envoyer par email si activé
    if (prefs.email !== false && user.email) {
      try {
        await emailService.sendAlert(user.email, alerte, user.prenom);
        results.email = true;
      } catch (error) {
        logger.warn('Échec notification email', { userId, error: error.message });
      }
    }

    // Envoyer par SMS si critique ou si activé
    if ((alerte.niveau === 'critical' || prefs.sms !== false) && user.telephone) {
      try {
        await smsService.sendAlert(user.telephone, alerte);
        results.sms = true;
      } catch (error) {
        logger.warn('Échec notification SMS', { userId, error: error.message });
      }
    }

    // Envoyer par WhatsApp si activé
    if (prefs.whatsapp && user.telephone) {
      try {
        await smsService.sendWhatsApp(user.telephone, 
          `🌱 AgriSmart CI - ${alerte.titre}\n\n${alerte.message}`
        );
        results.whatsapp = true;
      } catch (error) {
        logger.warn('Échec notification WhatsApp', { userId, error: error.message });
      }
    }

    logger.info('Notifications envoyées', { userId, alerteId: alerte.id, results });

    return results;
  } catch (error) {
    logger.error('Erreur envoi notifications', { userId, error: error.message });
    throw error;
  }
};

/**
 * Envoyer une notification à tous les utilisateurs d'un rôle
 */
exports.sendToRole = async (role, titre, message, niveau = 'info') => {
  try {
    const usersResult = await db.query(
      `SELECT id, email, telephone, nom, prenom 
       FROM users WHERE role = $1 AND statut = 'actif'`,
      [role]
    );

    const alerte = { titre, message, niveau };
    const results = [];

    for (const user of usersResult.rows) {
      try {
        const result = await this.sendAlert(user.id, alerte);
        results.push({ userId: user.id, success: true, ...result });
      } catch (error) {
        results.push({ userId: user.id, success: false, error: error.message });
      }
    }

    logger.info('Notifications de masse envoyées', { role, total: results.length });

    return results;
  } catch (error) {
    logger.error('Erreur notifications de masse', { error: error.message });
    throw error;
  }
};

/**
 * Envoyer une notification aux propriétaires d'une parcelle
 */
exports.sendToParcelleOwner = async (parcelleId, titre, message, niveau = 'info') => {
  try {
    const parcelleResult = await db.query(
      `SELECT p.id, p.nom, u.id as user_id, u.email, u.telephone, u.nom as user_nom
       FROM parcelles p
       JOIN users u ON p.proprietaire_id = u.id
       WHERE p.id = $1`,
      [parcelleId]
    );

    if (parcelleResult.rows.length === 0) {
      logger.warn('Parcelle non trouvée pour notification', { parcelleId });
      return null;
    }

    const parcelle = parcelleResult.rows[0];
    const alerte = {
      titre,
      message,
      niveau,
      parcelle_nom: parcelle.nom
    };

    return this.sendAlert(parcelle.user_id, alerte);
  } catch (error) {
    logger.error('Erreur notification propriétaire parcelle', { parcelleId, error: error.message });
    throw error;
  }
};

/**
 * Envoyer un rappel journalier
 */
exports.sendDailyReminder = async (userId, data) => {
  try {
    const userResult = await db.query(
      `SELECT id, email, telephone, nom, prenom FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) return null;

    const user = userResult.rows[0];

    const emailContent = `
      Bonjour ${user.prenom},

      Voici votre résumé quotidien AgriSmart CI:

      📊 Parcelles: ${data.parcelles || 0}
      🌡️ Alertes actives: ${data.alertes || 0}
      💧 Irrigation recommandée: ${data.irrigation ? 'Oui' : 'Non'}
      📈 Mesures collectées: ${data.mesures || 0}

      Bonne journée !
      L'équipe AgriSmart CI
    `;

    if (user.email) {
      await emailService.sendEmail(
        user.email,
        '📊 Votre résumé quotidien AgriSmart CI',
        emailContent.replace(/\n/g, '<br>')
      );
    }

    return { success: true };
  } catch (error) {
    logger.error('Erreur rappel journalier', { userId, error: error.message });
    throw error;
  }
};

module.exports = exports;
