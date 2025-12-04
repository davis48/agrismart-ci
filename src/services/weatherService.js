/**
 * Service Météo
 * AgriSmart CI - Système Agricole Intelligent
 * 
 * Intégration avec OpenWeatherMap et SODEXAM (Côte d'Ivoire)
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const db = require('../config/database');

class WeatherService {
  constructor() {
    this.openWeatherApiKey = config.weather?.openWeatherApiKey;
    this.openWeatherBaseUrl = 'https://api.openweathermap.org/data/2.5';
    this.cache = new Map();
    this.cacheDuration = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Obtenir la météo actuelle pour une localisation
   */
  async getCurrentWeather(lat, lon) {
    const cacheKey = `current_${lat}_${lon}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }
    }

    try {
      const response = await axios.get(`${this.openWeatherBaseUrl}/weather`, {
        params: {
          lat,
          lon,
          appid: this.openWeatherApiKey,
          units: 'metric',
          lang: 'fr'
        },
        timeout: 10000
      });

      const data = this.formatCurrentWeather(response.data);
      
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data
      });

      return data;
    } catch (error) {
      logger.error('Erreur récupération météo actuelle', { error: error.message, lat, lon });
      throw new Error('Impossible de récupérer les données météo');
    }
  }

  /**
   * Obtenir les prévisions sur 5 jours
   */
  async getForecast(lat, lon) {
    const cacheKey = `forecast_${lat}_${lon}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }
    }

    try {
      const response = await axios.get(`${this.openWeatherBaseUrl}/forecast`, {
        params: {
          lat,
          lon,
          appid: this.openWeatherApiKey,
          units: 'metric',
          lang: 'fr'
        },
        timeout: 10000
      });

      const data = this.formatForecast(response.data);
      
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data
      });

      return data;
    } catch (error) {
      logger.error('Erreur récupération prévisions', { error: error.message, lat, lon });
      throw new Error('Impossible de récupérer les prévisions météo');
    }
  }

  /**
   * Formater les données météo actuelles
   */
  formatCurrentWeather(data) {
    return {
      temperature: Math.round(data.main.temp),
      ressenti: Math.round(data.main.feels_like),
      humidite: data.main.humidity,
      pression: data.main.pressure,
      vent: {
        vitesse: Math.round(data.wind.speed * 3.6), // m/s to km/h
        direction: data.wind.deg
      },
      nuages: data.clouds.all,
      description: data.weather[0].description,
      icone: data.weather[0].icon,
      visibilite: data.visibility,
      lever_soleil: new Date(data.sys.sunrise * 1000),
      coucher_soleil: new Date(data.sys.sunset * 1000),
      timestamp: new Date()
    };
  }

  /**
   * Formater les prévisions
   */
  formatForecast(data) {
    const dailyForecasts = [];
    const groupedByDay = {};

    data.list.forEach(item => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      
      if (!groupedByDay[date]) {
        groupedByDay[date] = [];
      }
      groupedByDay[date].push(item);
    });

    Object.keys(groupedByDay).forEach(date => {
      const dayData = groupedByDay[date];
      const temps = dayData.map(d => d.main.temp);
      const humidites = dayData.map(d => d.main.humidity);
      const precipitations = dayData.reduce((sum, d) => sum + (d.rain?.['3h'] || 0), 0);

      dailyForecasts.push({
        date,
        temp_min: Math.round(Math.min(...temps)),
        temp_max: Math.round(Math.max(...temps)),
        humidite_moyenne: Math.round(humidites.reduce((a, b) => a + b) / humidites.length),
        precipitation_totale: Math.round(precipitations * 10) / 10,
        description: dayData[Math.floor(dayData.length / 2)].weather[0].description,
        icone: dayData[Math.floor(dayData.length / 2)].weather[0].icon
      });
    });

    return {
      ville: data.city.name,
      pays: data.city.country,
      previsions: dailyForecasts
    };
  }

  /**
   * Obtenir les alertes météo agricoles
   */
  async getAgriculturalAlerts(lat, lon) {
    const current = await this.getCurrentWeather(lat, lon);
    const forecast = await this.getForecast(lat, lon);
    const alerts = [];

    // Alerte chaleur
    if (current.temperature > 35) {
      alerts.push({
        type: 'chaleur',
        niveau: 'warning',
        message: `Température élevée (${current.temperature}°C). Évitez les travaux aux heures chaudes et hydratez les cultures.`
      });
    }

    // Alerte sécheresse
    if (current.humidite < 40) {
      alerts.push({
        type: 'secheresse',
        niveau: 'warning',
        message: `Humidité basse (${current.humidite}%). Irrigation recommandée.`
      });
    }

    // Alerte pluie forte
    const pluieProchaine = forecast.previsions.find(p => p.precipitation_totale > 30);
    if (pluieProchaine) {
      alerts.push({
        type: 'pluie',
        niveau: 'info',
        message: `Fortes pluies prévues le ${pluieProchaine.date} (${pluieProchaine.precipitation_totale}mm). Reporter les traitements phytosanitaires.`
      });
    }

    // Alerte vent fort
    if (current.vent.vitesse > 40) {
      alerts.push({
        type: 'vent',
        niveau: 'warning',
        message: `Vent fort (${current.vent.vitesse} km/h). Reporter les pulvérisations.`
      });
    }

    return alerts;
  }

  /**
   * Calculer l'évapotranspiration potentielle (ETP) - Formule de Hargreaves simplifiée
   */
  calculateETP(tempMin, tempMax, latitude) {
    const tempMoyenne = (tempMin + tempMax) / 2;
    const amplitudeThermique = tempMax - tempMin;
    
    // Rayonnement extraterrestre estimé (simplifié pour la Côte d'Ivoire)
    const Ra = 37.5; // MJ/m²/jour environ pour la zone tropicale
    
    // Formule de Hargreaves
    const ETP = 0.0023 * (tempMoyenne + 17.8) * Math.sqrt(amplitudeThermique) * Ra * 0.408;
    
    return Math.round(ETP * 10) / 10; // mm/jour
  }

  /**
   * Recommandations d'irrigation basées sur la météo
   */
  async getIrrigationRecommendations(parcelleId) {
    try {
      // Récupérer les infos de la parcelle
      const parcelle = await db.query(
        `SELECT p.*, c.nom as culture_nom, c.besoins_eau_jour
         FROM parcelles p
         LEFT JOIN cultures_plantees cp ON cp.parcelle_id = p.id AND cp.statut = 'active'
         LEFT JOIN cultures c ON cp.culture_id = c.id
         WHERE p.id = $1`,
        [parcelleId]
      );

      if (parcelle.rows.length === 0) {
        throw new Error('Parcelle non trouvée');
      }

      const p = parcelle.rows[0];
      const coords = p.coordonnees_gps || { lat: 5.3600, lon: -4.0083 }; // Abidjan par défaut

      // Obtenir météo
      const current = await this.getCurrentWeather(coords.lat, coords.lon);
      const forecast = await this.getForecast(coords.lat, coords.lon);

      // Dernière mesure d'humidité sol
      const lastMesure = await db.query(
        `SELECT valeur FROM mesures m
         JOIN capteurs c ON m.capteur_id = c.id
         WHERE c.parcelle_id = $1 AND c.type = 'humidite_sol'
         ORDER BY m.timestamp DESC LIMIT 1`,
        [parcelleId]
      );

      const humiditeSol = lastMesure.rows[0]?.valeur || 50;
      const besoinsEau = p.besoins_eau_jour || 5; // mm/jour par défaut

      // Calculer ETP
      const etp = this.calculateETP(
        forecast.previsions[0].temp_min,
        forecast.previsions[0].temp_max,
        coords.lat
      );

      // Pluie prévue dans les 24h
      const pluiePrevue = forecast.previsions[0].precipitation_totale;

      // Calculer besoin en irrigation
      let besoinIrrigation = besoinsEau - pluiePrevue;
      
      // Ajuster selon l'humidité du sol
      if (humiditeSol > 70) {
        besoinIrrigation *= 0.5;
      } else if (humiditeSol < 30) {
        besoinIrrigation *= 1.5;
      }

      besoinIrrigation = Math.max(0, Math.round(besoinIrrigation * 10) / 10);

      // Meilleur moment pour irriguer
      let meilleurMoment = 'matin (6h-9h)';
      if (current.temperature < 25) {
        meilleurMoment = 'matinée ou fin d\'après-midi';
      } else if (current.temperature > 32) {
        meilleurMoment = 'tôt le matin (5h-7h) ou soir (18h-20h)';
      }

      return {
        parcelle: {
          id: p.id,
          nom: p.nom,
          culture: p.culture_nom
        },
        meteo: {
          temperature: current.temperature,
          humidite_air: current.humidite,
          humidite_sol: humiditeSol,
          pluie_prevue: pluiePrevue
        },
        irrigation: {
          etp: etp,
          besoin_eau_mm: besoinIrrigation,
          meilleur_moment: meilleurMoment,
          recommandation: besoinIrrigation > 0 
            ? `Irriguer avec environ ${besoinIrrigation} mm d'eau` 
            : 'Pas d\'irrigation nécessaire aujourd\'hui'
        },
        alerts: await this.getAgriculturalAlerts(coords.lat, coords.lon)
      };
    } catch (error) {
      logger.error('Erreur calcul recommandations irrigation', { error: error.message, parcelleId });
      throw error;
    }
  }

  /**
   * Sauvegarder les données météo historiques
   */
  async saveWeatherData(lat, lon) {
    try {
      const current = await this.getCurrentWeather(lat, lon);
      
      await db.query(
        `INSERT INTO meteo_historique (latitude, longitude, temperature, humidite, 
                                        pression, vent_vitesse, vent_direction, 
                                        description, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [lat, lon, current.temperature, current.humidite, current.pression,
         current.vent.vitesse, current.vent.direction, current.description, 
         current.timestamp]
      );

      logger.info('Données météo sauvegardées', { lat, lon });
    } catch (error) {
      logger.error('Erreur sauvegarde données météo', { error: error.message });
    }
  }

  /**
   * Nettoyer le cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new WeatherService();
