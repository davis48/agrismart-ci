/**
 * Service SMS via Twilio
 * AgriSmart CI - Système Agricole Intelligent
 */

const config = require('../config');
const logger = require('../utils/logger');

// Client Twilio (initialisé seulement si configuré)
let twilioClient = null;

if (config.twilio.accountSid && config.twilio.authToken) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
    logger.info('Client Twilio initialisé');
  } catch (error) {
    logger.warn('Impossible d\'initialiser le client Twilio', { error: error.message });
  }
}

/**
 * Formater le numéro de téléphone ivoirien
 */
const formatPhoneNumber = (phone) => {
  // Supprimer les espaces et caractères spéciaux
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  // Ajouter le code pays si nécessaire
  if (cleaned.startsWith('0')) {
    cleaned = '+225' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+225' + cleaned;
  }
  
  return cleaned;
};

/**
 * Envoyer un SMS
 */
exports.sendSms = async (to, body) => {
  if (!twilioClient) {
    logger.warn('Twilio non configuré, SMS non envoyé', { to });
    return { success: false, reason: 'Twilio non configuré' };
  }

  try {
    const formattedNumber = formatPhoneNumber(to);
    
    const message = await twilioClient.messages.create({
      body,
      from: config.twilio.phoneNumber,
      to: formattedNumber
    });

    logger.info('SMS envoyé', { to: formattedNumber, sid: message.sid });

    return {
      success: true,
      sid: message.sid
    };
  } catch (error) {
    logger.error('Erreur envoi SMS', { to, error: error.message });
    throw error;
  }
};

/**
 * Envoyer un code OTP par SMS
 */
exports.sendOtp = async (to, otp) => {
  const body = `Votre code de vérification AgriSmart CI est: ${otp}. Ce code expire dans 10 minutes.`;
  return this.sendSms(to, body);
};

/**
 * Envoyer une alerte par SMS
 */
exports.sendAlert = async (to, alerte) => {
  const niveauEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨'
  };

  const emoji = niveauEmoji[alerte.niveau] || '';
  const body = `${emoji} AgriSmart CI - ${alerte.titre}\n${alerte.message}`;
  
  return this.sendSms(to, body);
};

/**
 * Envoyer un message WhatsApp
 */
exports.sendWhatsApp = async (to, body) => {
  if (!twilioClient) {
    logger.warn('Twilio non configuré, WhatsApp non envoyé', { to });
    return { success: false, reason: 'Twilio non configuré' };
  }

  try {
    const formattedNumber = formatPhoneNumber(to);
    
    const message = await twilioClient.messages.create({
      body,
      from: `whatsapp:${config.twilio.whatsappNumber || config.twilio.phoneNumber}`,
      to: `whatsapp:${formattedNumber}`
    });

    logger.info('WhatsApp envoyé', { to: formattedNumber, sid: message.sid });

    return {
      success: true,
      sid: message.sid
    };
  } catch (error) {
    logger.error('Erreur envoi WhatsApp', { to, error: error.message });
    throw error;
  }
};

/**
 * Envoyer une notification vocale (appel)
 */
exports.sendVoiceCall = async (to, message) => {
  if (!twilioClient) {
    logger.warn('Twilio non configuré, appel non effectué', { to });
    return { success: false, reason: 'Twilio non configuré' };
  }

  try {
    const formattedNumber = formatPhoneNumber(to);
    
    const call = await twilioClient.calls.create({
      twiml: `<Response><Say language="fr-FR">${message}</Say></Response>`,
      from: config.twilio.phoneNumber,
      to: formattedNumber
    });

    logger.info('Appel vocal effectué', { to: formattedNumber, sid: call.sid });

    return {
      success: true,
      sid: call.sid
    };
  } catch (error) {
    logger.error('Erreur appel vocal', { to, error: error.message });
    throw error;
  }
};

module.exports = exports;
