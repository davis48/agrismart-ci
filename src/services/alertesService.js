/**
 * Service de gestion des alertes automatiques
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

/**
 * Seuils d'alerte par type de capteur
 */
const SEUILS = config.alertThresholds;

/**
 * Vérifier les seuils et créer une alerte si nécessaire
 */
exports.checkThresholds = async (capteurId, valeur) => {
  try {
    // Récupérer les informations du capteur
    const capteurResult = await db.query(
      `SELECT c.id, c.type, c.config, s.nom as station_nom, s.parcelle_id,
              p.nom as parcelle_nom, p.proprietaire_id
       FROM capteurs c
       JOIN stations s ON c.station_id = s.id
       JOIN parcelles p ON s.parcelle_id = p.id
       WHERE c.id = $1`,
      [capteurId]
    );

    if (capteurResult.rows.length === 0) {
      return null;
    }

    const capteur = capteurResult.rows[0];
    const seuils = SEUILS[capteur.type];

    if (!seuils) {
      return null; // Pas de seuils définis pour ce type
    }

    // Seuils personnalisés du capteur ou de la parcelle
    const customSeuils = capteur.config?.seuils || {};
    const min = customSeuils.min ?? seuils.min;
    const max = customSeuils.max ?? seuils.max;
    const criticalMin = customSeuils.criticalMin ?? seuils.criticalMin;
    const criticalMax = customSeuils.criticalMax ?? seuils.criticalMax;

    let alerte = null;

    // Vérifier les seuils critiques
    if (valeur <= criticalMin || valeur >= criticalMax) {
      alerte = {
        niveau: 'critical',
        type: 'capteur',
        titre: `Valeur critique: ${capteur.type}`,
        message: this.generateAlertMessage(capteur.type, valeur, 'critical', capteur.station_nom)
      };
    }
    // Vérifier les seuils d'avertissement
    else if (valeur <= min || valeur >= max) {
      alerte = {
        niveau: 'warning',
        type: 'capteur',
        titre: `Attention: ${capteur.type}`,
        message: this.generateAlertMessage(capteur.type, valeur, 'warning', capteur.station_nom)
      };
    }

    if (alerte) {
      // Vérifier si une alerte similaire n'a pas été créée récemment (éviter le spam)
      const recentAlert = await db.query(
        `SELECT id FROM alertes 
         WHERE capteur_id = $1 AND niveau = $2 AND resolue = false
         AND created_at > NOW() - INTERVAL '1 hour'`,
        [capteurId, alerte.niveau]
      );

      if (recentAlert.rows.length > 0) {
        logger.debug('Alerte similaire récente existe', { capteurId, niveau: alerte.niveau });
        return null;
      }

      // Créer l'alerte
      const alerteResult = await db.query(
        `INSERT INTO alertes (user_id, parcelle_id, capteur_id, type, niveau, titre, message, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'automatique')
         RETURNING *`,
        [capteur.proprietaire_id, capteur.parcelle_id, capteurId, 
         alerte.type, alerte.niveau, alerte.titre, alerte.message]
      );

      const createdAlerte = alerteResult.rows[0];

      // Envoyer les notifications
      try {
        await notificationService.sendAlert(capteur.proprietaire_id, {
          ...createdAlerte,
          parcelle_nom: capteur.parcelle_nom
        });
      } catch (notifError) {
        logger.warn('Échec notification alerte', { error: notifError.message });
      }

      logger.info('Alerte automatique créée', { 
        alerteId: createdAlerte.id, 
        capteurId, 
        niveau: alerte.niveau 
      });

      return createdAlerte;
    }

    return null;
  } catch (error) {
    logger.error('Erreur vérification seuils', { capteurId, error: error.message });
    throw error;
  }
};

/**
 * Générer le message d'alerte
 */
exports.generateAlertMessage = (type, valeur, niveau, stationNom) => {
  const unites = {
    temperature: '°C',
    humidite_sol: '%',
    humidite_air: '%',
    luminosite: 'lux',
    pluviometrie: 'mm',
    ph_sol: '',
    niveau_eau: 'cm'
  };

  const labels = {
    temperature: 'Température',
    humidite_sol: 'Humidité du sol',
    humidite_air: 'Humidité de l\'air',
    luminosite: 'Luminosité',
    pluviometrie: 'Pluviométrie',
    ph_sol: 'pH du sol',
    niveau_eau: 'Niveau d\'eau'
  };

  const unite = unites[type] || '';
  const label = labels[type] || type;

  if (niveau === 'critical') {
    return `⚠️ ATTENTION: ${label} a atteint un niveau critique (${valeur}${unite}) sur la station ${stationNom}. Action immédiate requise.`;
  } else {
    return `${label} hors des limites normales (${valeur}${unite}) sur la station ${stationNom}. Surveillance recommandée.`;
  }
};

/**
 * Vérifier les capteurs hors ligne
 */
exports.checkOfflineSensors = async () => {
  try {
    // Capteurs qui n'ont pas envoyé de données depuis 30 minutes
    const offlineResult = await db.query(
      `SELECT c.id, c.type, s.nom as station_nom, s.parcelle_id,
              p.nom as parcelle_nom, p.proprietaire_id, c.derniere_mesure
       FROM capteurs c
       JOIN stations s ON c.station_id = s.id
       JOIN parcelles p ON s.parcelle_id = p.id
       WHERE c.statut = 'actif'
         AND (c.derniere_mesure IS NULL OR c.derniere_mesure < NOW() - INTERVAL '30 minutes')
         AND NOT EXISTS (
           SELECT 1 FROM alertes 
           WHERE capteur_id = c.id AND type = 'systeme' AND resolue = false
           AND created_at > NOW() - INTERVAL '2 hours'
         )`
    );

    for (const capteur of offlineResult.rows) {
      const alerte = await db.query(
        `INSERT INTO alertes (user_id, parcelle_id, capteur_id, type, niveau, titre, message, source)
         VALUES ($1, $2, $3, 'systeme', 'warning', $4, $5, 'automatique')
         RETURNING *`,
        [
          capteur.proprietaire_id,
          capteur.parcelle_id,
          capteur.id,
          `Capteur hors ligne: ${capteur.type}`,
          `Le capteur ${capteur.type} sur la station ${capteur.station_nom} ne répond plus depuis plus de 30 minutes.`
        ]
      );

      // Notifier
      await notificationService.sendAlert(capteur.proprietaire_id, {
        ...alerte.rows[0],
        parcelle_nom: capteur.parcelle_nom
      });
    }

    if (offlineResult.rows.length > 0) {
      logger.info('Capteurs hors ligne détectés', { count: offlineResult.rows.length });
    }

    return offlineResult.rows.length;
  } catch (error) {
    logger.error('Erreur vérification capteurs hors ligne', { error: error.message });
    throw error;
  }
};

/**
 * Analyser les tendances et anticiper les problèmes
 */
exports.analyzeTrends = async (parcelleId) => {
  try {
    // Analyser les tendances sur 24h
    const trendsResult = await db.query(
      `SELECT c.type,
              AVG(m.valeur) as moyenne,
              MIN(m.valeur) as min,
              MAX(m.valeur) as max,
              STDDEV(m.valeur) as ecart_type,
              (SELECT valeur FROM mesures WHERE capteur_id = c.id ORDER BY timestamp DESC LIMIT 1) as derniere_valeur
       FROM capteurs c
       JOIN stations s ON c.station_id = s.id
       JOIN mesures m ON c.id = m.capteur_id
       WHERE s.parcelle_id = $1
         AND m.timestamp > NOW() - INTERVAL '24 hours'
       GROUP BY c.id, c.type`,
      [parcelleId]
    );

    const alertes = [];

    for (const trend of trendsResult.rows) {
      const seuils = SEUILS[trend.type];
      if (!seuils) continue;

      // Détecter les tendances dangereuses
      if (trend.derniere_valeur && trend.moyenne) {
        const variation = ((trend.derniere_valeur - trend.moyenne) / trend.moyenne) * 100;

        // Si la valeur actuelle est 20% supérieure à la moyenne et proche du seuil max
        if (variation > 20 && trend.derniere_valeur > seuils.max * 0.9) {
          alertes.push({
            type: trend.type,
            niveau: 'warning',
            message: `Tendance à la hausse détectée pour ${trend.type}. Valeur actuelle: ${trend.derniere_valeur}, Moyenne 24h: ${trend.moyenne.toFixed(2)}`
          });
        }
      }
    }

    return alertes;
  } catch (error) {
    logger.error('Erreur analyse tendances', { parcelleId, error: error.message });
    throw error;
  }
};

module.exports = exports;
