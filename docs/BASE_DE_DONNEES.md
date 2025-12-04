# 📊 Documentation Base de Données - AgriSmart CI

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture de la Base de Données](#architecture-de-la-base-de-données)
3. [Installation et Configuration](#installation-et-configuration)
4. [Structure des Tables](#structure-des-tables)
5. [Types Énumérés](#types-énumérés)
6. [Relations entre Tables](#relations-entre-tables)
7. [Vues et Fonctions](#vues-et-fonctions)
8. [Données Initiales](#données-initiales)
9. [Accès et Gestion](#accès-et-gestion)
10. [Maintenance et Sauvegarde](#maintenance-et-sauvegarde)
11. [FAQ](#faq)

---

## Vue d'Ensemble

### Informations Générales

| Élément | Valeur |
|---------|--------|
| **SGBD** | PostgreSQL 15 Alpine |
| **Nom de la base** | `agrismart_ci` |
| **Encodage** | UTF-8 |
| **Nombre de tables** | 27 |
| **Nombre de vues** | 2 |
| **Extensions** | uuid-ossp, pgcrypto |

### Objectif

La base de données AgriSmart CI est conçue pour supporter un système agricole intelligent permettant :
- La gestion des exploitations agricoles et parcelles
- Le suivi des capteurs IoT (humidité, température, pH, NPK)
- La détection de maladies via IA
- Les recommandations d'irrigation et fertilisation
- Un marketplace agricole
- La formation des producteurs

---

## Architecture de la Base de Données

### Diagramme Conceptuel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UTILISATEURS                                   │
│  ┌──────────┐     ┌──────────────┐     ┌──────────┐                     │
│  │  users   │────▶│ cooperatives │◀────│ regions  │                     │
│  └──────────┘     └──────────────┘     └──────────┘                     │
│       │                                                                  │
│       ▼                                                                  │
│  ┌──────────┐                                                           │
│  │ sessions │  (authentification JWT + OTP)                             │
│  │ otp_codes│                                                           │
│  └──────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           EXPLOITATION                                   │
│  ┌──────────┐     ┌──────────────┐     ┌──────────┐                     │
│  │ parcelles│────▶│  plantations │◀────│ cultures │                     │
│  └──────────┘     └──────────────┘     └──────────┘                     │
│       │                                                                  │
│       ▼                                                                  │
│  ┌──────────┐     ┌──────────────┐     ┌──────────┐                     │
│  │ stations │────▶│   capteurs   │────▶│ mesures  │                     │
│  └──────────┘     └──────────────┘     └──────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           INTELLIGENCE                                   │
│  ┌──────────┐     ┌──────────────┐     ┌────────────────────┐          │
│  │ alertes  │     │recommandations│    │ previsions_irrigation│         │
│  └──────────┘     └──────────────┘     └────────────────────┘          │
│                                                                          │
│  ┌──────────┐     ┌──────────────────┐                                  │
│  │ maladies │────▶│detections_maladies│                                 │
│  └──────────┘     └──────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVICES                                       │
│  ┌────────────────────┐     ┌──────────────────────┐                    │
│  │ marketplace_produits│────▶│marketplace_commandes │                   │
│  └────────────────────┘     └──────────────────────┘                    │
│                                                                          │
│  ┌──────────┐     ┌────────────────┐     ┌──────────┐                   │
│  │formations│────▶│user_formations │     │ messages │                   │
│  └──────────┘     └────────────────┘     └──────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Installation et Configuration

### Prérequis

- Docker et Docker Compose installés
- 2 Go de RAM minimum
- 10 Go d'espace disque

### Démarrage avec Docker

```bash
# Démarrer tous les services
cd backend
docker compose up -d

# Vérifier que PostgreSQL est opérationnel
docker exec agrismart_postgres pg_isready -U postgres
```

### Variables d'Environnement

```env
# Configuration PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=agrismart_ci
POSTGRES_USER=postgres
POSTGRES_PASSWORD=agrismart_secure_2024
```

### Initialisation de la Base

La base est automatiquement initialisée au premier démarrage via le script `init.sql` :

```bash
# Le script est exécuté automatiquement, mais peut être relancé manuellement
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < src/database/schema.sql
```

---

## Structure des Tables

### 1. Gestion des Utilisateurs

#### Table `users`
Stocke les informations des utilisateurs du système.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique (auto-généré) |
| `nom` | VARCHAR(100) | Nom de famille |
| `prenoms` | VARCHAR(150) | Prénoms |
| `email` | VARCHAR(150) | Email (unique) |
| `telephone` | VARCHAR(20) | Téléphone (unique, requis) |
| `password_hash` | VARCHAR(255) | Mot de passe hashé (bcrypt) |
| `role` | user_role | Rôle (producteur, conseiller, admin, partenaire) |
| `status` | user_status | Statut (actif, inactif, suspendu, en_attente) |
| `otp_code` | VARCHAR(10) | Code OTP temporaire |
| `otp_expires_at` | TIMESTAMP | Expiration OTP |
| `region_id` | UUID | Référence région |
| `cooperative_id` | UUID | Référence coopérative |
| `village` | VARCHAR(100) | Village de résidence |
| `langue_preferee` | VARCHAR(20) | Langue (fr, baoule, malinke, senoufo) |
| `notifications_sms` | BOOLEAN | Activer SMS |
| `notifications_whatsapp` | BOOLEAN | Activer WhatsApp |
| `notifications_push` | BOOLEAN | Activer Push |
| `derniere_connexion` | TIMESTAMP | Dernière connexion |
| `tentatives_connexion` | INTEGER | Nombre de tentatives |
| `compte_verrouille_jusqu_a` | TIMESTAMP | Verrouillage temporaire |
| `created_at` | TIMESTAMP | Date de création |
| `updated_at` | TIMESTAMP | Dernière mise à jour |

#### Table `sessions`
Gestion des sessions et refresh tokens.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Référence utilisateur |
| `refresh_token` | VARCHAR(500) | Token de rafraîchissement |
| `device_info` | TEXT | Informations appareil |
| `ip_address` | VARCHAR(45) | Adresse IP |
| `expires_at` | TIMESTAMP | Date d'expiration |

#### Table `otp_codes`
Codes OTP pour l'authentification à deux facteurs.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Référence utilisateur |
| `code` | VARCHAR(10) | Code OTP à 6 chiffres |
| `type` | VARCHAR(50) | Type (verification, reset_password) |
| `used` | BOOLEAN | Déjà utilisé |
| `attempts` | INTEGER | Nombre de tentatives |
| `expires_at` | TIMESTAMP | Date d'expiration |

#### Table `regions`
Régions de Côte d'Ivoire.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `nom` | VARCHAR(100) | Nom de la région |
| `code` | VARCHAR(10) | Code unique |
| `chef_lieu` | VARCHAR(100) | Chef-lieu |
| `superficie_km2` | DECIMAL | Superficie |

#### Table `cooperatives`
Coopératives agricoles.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `nom` | VARCHAR(200) | Nom de la coopérative |
| `code` | VARCHAR(20) | Code unique |
| `region_id` | UUID | Référence région |
| `adresse` | TEXT | Adresse |
| `telephone` | VARCHAR(20) | Téléphone |
| `email` | VARCHAR(100) | Email |
| `nombre_membres` | INTEGER | Nombre de membres |
| `date_creation` | DATE | Date de création |
| `est_active` | BOOLEAN | Active ou non |

---

### 2. Gestion des Parcelles

#### Table `parcelles`
Parcelles agricoles avec géolocalisation.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Propriétaire |
| `nom` | VARCHAR(100) | Nom de la parcelle |
| `code` | VARCHAR(20) | Code unique |
| `latitude` | DECIMAL(10,8) | Latitude GPS |
| `longitude` | DECIMAL(11,8) | Longitude GPS |
| `altitude` | DECIMAL(6,2) | Altitude |
| `polygon_geojson` | JSONB | Délimitation GeoJSON |
| `superficie_hectares` | DECIMAL(8,4) | Surface en hectares |
| `type_sol` | soil_type | Type de sol |
| `description` | TEXT | Description |
| `status` | parcel_status | Statut |
| `date_acquisition` | DATE | Date d'acquisition |

#### Table `cultures`
Référentiel des cultures supportées.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `nom` | VARCHAR(100) | Nom de la culture |
| `nom_scientifique` | VARCHAR(150) | Nom scientifique |
| `nom_local_baoule` | VARCHAR(100) | Nom en baoulé |
| `nom_local_malinke` | VARCHAR(100) | Nom en malinké |
| `nom_local_senoufo` | VARCHAR(100) | Nom en sénoufo |
| `categorie` | crop_category | Catégorie |
| `temperature_min/max` | DECIMAL | Plage température optimale |
| `humidite_sol_min/max` | DECIMAL | Plage humidité optimale |
| `ph_min/max` | DECIMAL | Plage pH optimale |
| `besoin_azote` | DECIMAL | Besoin N (kg/ha) |
| `besoin_phosphore` | DECIMAL | Besoin P (kg/ha) |
| `besoin_potassium` | DECIMAL | Besoin K (kg/ha) |
| `duree_cycle_jours` | INTEGER | Durée du cycle |
| `rendement_moyen` | DECIMAL | Rendement moyen (t/ha) |
| `besoin_eau_total` | INTEGER | Besoin eau (mm/cycle) |
| `sols_compatibles` | soil_type[] | Types de sol compatibles |

#### Table `plantations`
Cultures en cours sur les parcelles.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `parcelle_id` | UUID | Référence parcelle |
| `culture_id` | UUID | Référence culture |
| `date_semis` | DATE | Date de semis |
| `date_recolte_prevue` | DATE | Date récolte prévue |
| `date_recolte_effective` | DATE | Date récolte effective |
| `superficie_plantee` | DECIMAL | Surface plantée |
| `rendement_obtenu` | DECIMAL | Rendement obtenu (tonnes) |
| `rendement_par_hectare` | DECIMAL | Rendement par hectare |
| `est_active` | BOOLEAN | Plantation active |
| `observations` | TEXT | Notes |

---

### 3. Capteurs IoT

#### Table `stations`
Stations IoT regroupant plusieurs capteurs.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `code` | VARCHAR(50) | Code unique (auto-généré) |
| `nom` | VARCHAR(100) | Nom de la station |
| `parcelle_id` | UUID | Référence parcelle |
| `latitude` | DECIMAL(10,8) | Position GPS |
| `longitude` | DECIMAL(11,8) | Position GPS |
| `intervalle_transmission_minutes` | INTEGER | Intervalle (défaut: 15) |
| `niveau_batterie` | DECIMAL | Niveau batterie % |
| `panneau_solaire_watts` | DECIMAL | Puissance panneau (défaut: 20W) |
| `type_connexion` | VARCHAR(20) | lorawan, 4g, wifi |
| `signal_force` | INTEGER | Force signal (dBm) |
| `status` | sensor_status | Statut |
| `derniere_transmission` | TIMESTAMP | Dernière transmission |
| `date_installation` | DATE | Date d'installation |
| `prochaine_maintenance` | DATE | Prochaine maintenance |

#### Table `capteurs`
Capteurs individuels rattachés aux stations.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `station_id` | UUID | Référence station |
| `code` | VARCHAR(50) | Code unique (auto-généré) |
| `type` | sensor_type | Type (humidite, temperature, ph, npk, meteo, camera) |
| `modele` | VARCHAR(100) | Modèle du capteur |
| `fabricant` | VARCHAR(100) | Fabricant |
| `unite_mesure` | VARCHAR(20) | Unité de mesure |
| `precision_mesure` | DECIMAL | Précision |
| `valeur_min/max` | DECIMAL | Plage de mesure |
| `profondeur_cm` | INTEGER | Profondeur dans le sol |
| `derniere_calibration` | DATE | Dernière calibration |
| `prochaine_calibration` | DATE | Prochaine calibration |
| `facteur_correction` | DECIMAL | Facteur de correction (défaut: 1.0) |
| `status` | sensor_status | Statut |
| `duree_vie_estimee_mois` | INTEGER | Durée de vie (défaut: 60) |

#### Table `mesures`
Données collectées par les capteurs.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `capteur_id` | UUID | Référence capteur |
| `station_id` | UUID | Référence station |
| `parcelle_id` | UUID | Référence parcelle |
| `valeur` | DECIMAL(12,4) | Valeur mesurée |
| `unite` | VARCHAR(20) | Unité |
| `qualite_signal` | INTEGER | Qualité 0-100% |
| `est_valide` | BOOLEAN | Valeur valide |
| `est_anomalie` | BOOLEAN | Anomalie détectée |
| `mesure_at` | TIMESTAMP | Date/heure de mesure |
| `received_at` | TIMESTAMP | Date de réception |

#### Table `mesures_agregees`
Données agrégées (horaires/journalières).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `capteur_id` | UUID | Référence capteur |
| `parcelle_id` | UUID | Référence parcelle |
| `periode_debut` | TIMESTAMP | Début de période |
| `periode_fin` | TIMESTAMP | Fin de période |
| `type_agregation` | VARCHAR(20) | horaire, journalier, hebdomadaire |
| `valeur_moyenne` | DECIMAL | Moyenne |
| `valeur_min` | DECIMAL | Minimum |
| `valeur_max` | DECIMAL | Maximum |
| `ecart_type` | DECIMAL | Écart-type |
| `nombre_mesures` | INTEGER | Nombre de mesures |

---

### 4. Météo

#### Table `meteo`
Données météorologiques actuelles.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `region_id` | UUID | Référence région |
| `parcelle_id` | UUID | Référence parcelle |
| `temperature` | DECIMAL | Température (°C) |
| `humidite_air` | DECIMAL | Humidité air (%) |
| `pression` | DECIMAL | Pression (hPa) |
| `vitesse_vent` | DECIMAL | Vent (km/h) |
| `direction_vent` | INTEGER | Direction (degrés) |
| `precipitations` | DECIMAL | Précipitations (mm) |
| `rayonnement_solaire` | DECIMAL | Rayonnement (W/m²) |
| `indice_uv` | DECIMAL | Indice UV |
| `source` | VARCHAR(50) | Source (openweathermap) |
| `observation_at` | TIMESTAMP | Date d'observation |

#### Table `previsions_meteo`
Prévisions météo (10 jours).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `region_id` | UUID | Référence région |
| `parcelle_id` | UUID | Référence parcelle |
| `date_prevision` | DATE | Date prévue |
| `heure_prevision` | INTEGER | Heure (0-23) |
| `temperature_min/max` | DECIMAL | Températures |
| `humidite` | DECIMAL | Humidité prévue |
| `probabilite_pluie` | DECIMAL | Probabilité pluie % |
| `precipitations_prevues` | DECIMAL | Précipitations (mm) |
| `alerte_secheresse` | BOOLEAN | Alerte sécheresse |
| `alerte_pluie_intense` | BOOLEAN | Alerte pluie |
| `alerte_vent_violent` | BOOLEAN | Alerte vent |
| `alerte_temperature_extreme` | BOOLEAN | Alerte température |

---

### 5. Alertes et Recommandations

#### Table `alertes`
Alertes générées par le système.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Destinataire |
| `parcelle_id` | UUID | Parcelle concernée |
| `capteur_id` | UUID | Capteur source |
| `niveau` | alert_level | info, important, critique |
| `titre` | VARCHAR(200) | Titre |
| `message` | TEXT | Message |
| `message_local` | TEXT | Message en langue locale |
| `categorie` | VARCHAR(50) | irrigation, maladie, meteo, sol, maintenance |
| `valeur_declencheur` | DECIMAL | Valeur ayant déclenché |
| `seuil_reference` | DECIMAL | Seuil de référence |
| `donnees_contexte` | JSONB | Données additionnelles |
| `action_recommandee` | TEXT | Action recommandée |
| `status` | alert_status | nouvelle, lue, traitee, ignoree |
| `envoye_sms` | BOOLEAN | Envoyé par SMS |
| `envoye_whatsapp` | BOOLEAN | Envoyé par WhatsApp |
| `envoye_push` | BOOLEAN | Envoyé en push |
| `lu_at` | TIMESTAMP | Date de lecture |
| `traite_at` | TIMESTAMP | Date de traitement |
| `traite_par` | UUID | Traité par |

#### Table `recommandations`
Recommandations générées par l'IA.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Destinataire |
| `parcelle_id` | UUID | Parcelle concernée |
| `type` | VARCHAR(50) | irrigation, fertilisation, culture, traitement, recolte |
| `titre` | VARCHAR(200) | Titre |
| `description` | TEXT | Description |
| `description_locale` | TEXT | Description en langue locale |
| `donnees_source` | JSONB | Données ayant généré la recommandation |
| `action` | TEXT | Action à effectuer |
| `quantite` | DECIMAL | Quantité |
| `unite` | VARCHAR(50) | Unité |
| `frequence` | VARCHAR(100) | Fréquence |
| `periode_application` | VARCHAR(100) | Période d'application |
| `priorite` | INTEGER | Priorité 1-5 |
| `valide_du` | TIMESTAMP | Début validité |
| `valide_jusqu_au` | TIMESTAMP | Fin validité |
| `appliquee` | BOOLEAN | Appliquée |
| `date_application` | TIMESTAMP | Date d'application |
| `note_utilisateur` | INTEGER | Note 1-5 |
| `commentaire_utilisateur` | TEXT | Commentaire |
| `genere_par` | VARCHAR(50) | systeme, ia, conseiller |
| `modele_ia_version` | VARCHAR(50) | Version du modèle IA |

#### Table `previsions_irrigation`
Prévisions d'irrigation calculées.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `parcelle_id` | UUID | Parcelle |
| `plantation_id` | UUID | Plantation |
| `date_prevision` | DATE | Date |
| `besoin_eau_mm` | DECIMAL | Besoin en mm |
| `besoin_eau_litres` | DECIMAL | Besoin en litres |
| `evapotranspiration_mm` | DECIMAL | Évapotranspiration |
| `precipitations_prevues_mm` | DECIMAL | Précipitations prévues |
| `humidite_sol_actuelle` | DECIMAL | Humidité actuelle |
| `humidite_sol_cible` | DECIMAL | Humidité cible |
| `irrigation_recommandee` | BOOLEAN | Irrigation recommandée |
| `moment_optimal` | VARCHAR(50) | matin, soir |
| `duree_minutes` | INTEGER | Durée recommandée |
| `confiance_prevision` | DECIMAL | Niveau de confiance % |

---

### 6. Maladies

#### Table `maladies`
Référentiel des maladies des cultures.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `nom` | VARCHAR(150) | Nom de la maladie |
| `nom_scientifique` | VARCHAR(200) | Nom scientifique |
| `nom_local` | VARCHAR(150) | Nom local |
| `cultures_affectees` | UUID[] | Cultures affectées |
| `description` | TEXT | Description |
| `symptomes` | TEXT | Symptômes |
| `causes` | TEXT | Causes |
| `temperature_favorable_min/max` | DECIMAL | Températures favorables |
| `humidite_favorable_min/max` | DECIMAL | Humidités favorables |
| `traitement_preventif` | TEXT | Prévention |
| `traitement_curatif` | TEXT | Traitement |
| `produits_recommandes` | TEXT[] | Produits recommandés |
| `niveau_gravite` | INTEGER | Gravité 1-5 |
| `images_symptomes` | VARCHAR(500)[] | URLs images |

#### Table `detections_maladies`
Détections de maladies (manuelles ou IA).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Utilisateur |
| `parcelle_id` | UUID | Parcelle |
| `plantation_id` | UUID | Plantation |
| `maladie_id` | UUID | Maladie détectée |
| `source` | VARCHAR(50) | ia_image, ia_donnees, manuel |
| `image_url` | VARCHAR(500) | Image analysée |
| `confiance_detection` | DECIMAL | Confiance 0-100% |
| `autres_diagnostics` | JSONB | Autres maladies possibles |
| `latitude` | DECIMAL | Position GPS |
| `longitude` | DECIMAL | Position GPS |
| `zone_affectee_m2` | DECIMAL | Zone affectée |
| `est_confirmee` | BOOLEAN | Confirmée |
| `confirme_par` | UUID | Confirmé par |
| `traitement_applique` | TEXT | Traitement appliqué |
| `resultat_traitement` | VARCHAR(50) | efficace, partiel, inefficace |

---

### 7. Marketplace

#### Table `marketplace_produits`
Produits en vente sur le marketplace.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `vendeur_id` | UUID | Vendeur |
| `nom` | VARCHAR(200) | Nom du produit |
| `description` | TEXT | Description |
| `categorie` | VARCHAR(50) | semences, engrais, recoltes, equipement |
| `prix` | DECIMAL(12,2) | Prix |
| `devise` | VARCHAR(10) | Devise (XOF) |
| `unite` | VARCHAR(50) | Unité (kg, sac, unite) |
| `quantite_disponible` | DECIMAL | Quantité disponible |
| `region_id` | UUID | Région |
| `lieu_retrait` | TEXT | Lieu de retrait |
| `livraison_possible` | BOOLEAN | Livraison possible |
| `frais_livraison` | DECIMAL | Frais de livraison |
| `zone_livraison` | TEXT | Zone de livraison |
| `images` | VARCHAR(500)[] | Images |
| `est_actif` | BOOLEAN | Actif |
| `vues` | INTEGER | Nombre de vues |

#### Table `marketplace_commandes`
Commandes passées sur le marketplace.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `acheteur_id` | UUID | Acheteur |
| `vendeur_id` | UUID | Vendeur |
| `produit_id` | UUID | Produit |
| `quantite` | DECIMAL | Quantité commandée |
| `prix_unitaire` | DECIMAL | Prix unitaire |
| `prix_total` | DECIMAL | Prix total |
| `statut` | VARCHAR(50) | en_attente, confirmee, livree, annulee |
| `mode_livraison` | VARCHAR(50) | retrait, livraison |
| `adresse_livraison` | TEXT | Adresse |
| `date_livraison_prevue` | DATE | Date prévue |
| `date_livraison_effective` | TIMESTAMP | Date effective |
| `mode_paiement` | VARCHAR(50) | mobile_money, especes, virement |
| `reference_paiement` | VARCHAR(100) | Référence |
| `paiement_confirme` | BOOLEAN | Paiement confirmé |
| `note_acheteur` | INTEGER | Note 1-5 |
| `commentaire_acheteur` | TEXT | Commentaire |

---

### 8. Formations

#### Table `formations`
Contenus de formation disponibles.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `titre` | VARCHAR(200) | Titre |
| `description` | TEXT | Description |
| `categorie` | VARCHAR(50) | culture, irrigation, maladie, sol, application |
| `type` | VARCHAR(20) | video, pdf, article |
| `url` | VARCHAR(500) | URL du contenu |
| `duree_minutes` | INTEGER | Durée |
| `langue` | VARCHAR(20) | Langue (fr, baoule, etc.) |
| `cultures_id` | UUID[] | Cultures concernées |
| `vues` | INTEGER | Nombre de vues |
| `est_actif` | BOOLEAN | Actif |

#### Table `user_formations`
Progression des utilisateurs dans les formations.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Utilisateur |
| `formation_id` | UUID | Formation |
| `progression` | DECIMAL | Progression 0-100% |
| `complete` | BOOLEAN | Terminée |
| `date_completion` | TIMESTAMP | Date de complétion |
| `note` | INTEGER | Note 1-5 |

---

### 9. Messagerie

#### Table `messages`
Messages entre utilisateurs.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Expéditeur |
| `destinataire_id` | UUID | Destinataire |
| `cooperative_id` | UUID | Coopérative (si message groupe) |
| `est_public` | BOOLEAN | Message public |
| `contenu` | TEXT | Contenu |
| `type` | VARCHAR(20) | texte, image, audio |
| `media_url` | VARCHAR(500) | URL média |
| `parcelle_id` | UUID | Parcelle concernée |
| `alerte_id` | UUID | Alerte liée |
| `lu` | BOOLEAN | Lu |
| `lu_at` | TIMESTAMP | Date de lecture |

---

### 10. Administration

#### Table `audit_logs`
Journal d'audit des actions.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Utilisateur |
| `ip_address` | VARCHAR(45) | Adresse IP |
| `user_agent` | TEXT | User Agent |
| `action` | VARCHAR(100) | Action effectuée |
| `entite` | VARCHAR(100) | Entité concernée |
| `entite_id` | UUID | ID de l'entité |
| `donnees_avant` | JSONB | État avant |
| `donnees_apres` | JSONB | État après |
| `succes` | BOOLEAN | Succès |
| `message_erreur` | TEXT | Message d'erreur |

#### Table `configuration`
Configuration système.

| Colonne | Type | Description |
|---------|------|-------------|
| `cle` | VARCHAR(100) | Clé (PK) |
| `valeur` | TEXT | Valeur |
| `description` | TEXT | Description |
| `type` | VARCHAR(20) | string, number, boolean, json |
| `modifiable` | BOOLEAN | Modifiable |

---

## Types Énumérés

### user_role
```sql
CREATE TYPE user_role AS ENUM ('producteur', 'conseiller', 'admin', 'partenaire');
```
- **producteur** : Agriculteur utilisant le système
- **conseiller** : Agent technique agricole
- **admin** : Administrateur système
- **partenaire** : Partenaire externe (ONG, ministère)

### user_status
```sql
CREATE TYPE user_status AS ENUM ('actif', 'inactif', 'suspendu', 'en_attente');
```

### soil_type
```sql
CREATE TYPE soil_type AS ENUM ('argileux', 'sablonneux', 'limono_argileux', 'limoneux', 'argilo_sableux');
```

### sensor_type
```sql
CREATE TYPE sensor_type AS ENUM ('humidite', 'temperature', 'ph', 'npk', 'meteo', 'camera');
```

### sensor_status
```sql
CREATE TYPE sensor_status AS ENUM ('actif', 'inactif', 'maintenance', 'defaillant');
```

### alert_level
```sql
CREATE TYPE alert_level AS ENUM ('info', 'important', 'critique');
```

### alert_status
```sql
CREATE TYPE alert_status AS ENUM ('nouvelle', 'lue', 'traitee', 'ignoree');
```

### crop_category
```sql
CREATE TYPE crop_category AS ENUM ('cereales', 'legumineuses', 'tubercules', 'legumes', 'fruits', 'oleagineux');
```

### parcel_status
```sql
CREATE TYPE parcel_status AS ENUM ('active', 'en_repos', 'preparee', 'ensemencee', 'en_croissance', 'recolte');
```

---

## Relations entre Tables

### Diagramme des Relations Principales

```
users ──────────────────┬──── parcelles ────┬──── stations ────── capteurs ────── mesures
  │                     │         │         │
  ├── sessions          │         │         └──── alertes
  ├── otp_codes         │         │
  ├── messages          │         └──── plantations ──── cultures
  ├── recommandations   │
  ├── alertes           └──── detections_maladies ──── maladies
  │
  └── marketplace_produits ──── marketplace_commandes

cooperatives ──── regions

formations ──── user_formations ──── users
```

### Clés Étrangères Importantes

| Table Source | Colonne | Table Cible | Description |
|-------------|---------|-------------|-------------|
| users | region_id | regions | Région de l'utilisateur |
| users | cooperative_id | cooperatives | Coopérative de l'utilisateur |
| parcelles | user_id | users | Propriétaire de la parcelle |
| stations | parcelle_id | parcelles | Parcelle de la station |
| capteurs | station_id | stations | Station du capteur |
| mesures | capteur_id | capteurs | Capteur source |
| alertes | user_id | users | Destinataire de l'alerte |
| recommandations | parcelle_id | parcelles | Parcelle concernée |

---

## Vues et Fonctions

### Vues

#### v_dernieres_mesures
Dernière mesure de chaque capteur.

```sql
SELECT * FROM v_dernieres_mesures;
```

#### v_etat_parcelles
État actuel des parcelles avec dernières mesures.

```sql
SELECT * FROM v_etat_parcelles;
```

### Fonctions

#### update_updated_at_column()
Met à jour automatiquement la colonne `updated_at`.

```sql
-- Trigger appliqué sur: users, parcelles, stations, capteurs, cultures, plantations
```

---

## Données Initiales

### Régions (5)
| Nom | Code | Chef-lieu |
|-----|------|-----------|
| Poro | PORO | Korhogo |
| Gbêkê | GBEKE | Bouaké |
| Gôh | GOH | Gagnoa |
| Haut-Sassandra | HTSASS | Daloa |
| Sud-Comoé | SUDCOM | Aboisso |

### Cultures (5)
| Nom | Catégorie | Cycle (jours) | Rendement (t/ha) |
|-----|-----------|---------------|------------------|
| Riz | Céréales | 120 | 2.2 |
| Maïs | Céréales | 90 | 3.5 |
| Manioc | Tubercules | 365 | 15.0 |
| Tomate | Légumes | 90 | 25.0 |
| Arachide | Oléagineux | 120 | 1.5 |

### Maladies (4)
| Nom | Cultures | Gravité |
|-----|----------|---------|
| Mildiou de la tomate | Tomate | 4/5 |
| Striga | Maïs, Sorgho | 5/5 |
| Mosaïque du manioc | Manioc | 4/5 |
| Pyriculariose du riz | Riz | 4/5 |

### Configuration (8 paramètres)
| Clé | Valeur | Description |
|-----|--------|-------------|
| seuil_humidite_critique_bas | 20 | Seuil humidité bas (%) |
| seuil_humidite_critique_haut | 90 | Seuil humidité haut (%) |
| seuil_temperature_critique_bas | 10 | Seuil température bas (°C) |
| seuil_temperature_critique_haut | 45 | Seuil température haut (°C) |
| seuil_ph_critique_bas | 4.5 | Seuil pH bas |
| seuil_ph_critique_haut | 8.5 | Seuil pH haut |
| intervalle_agregation_heures | 1 | Intervalle agrégation (h) |
| retention_mesures_jours | 365 | Rétention mesures (jours) |

---

## Accès et Gestion

### Connexion via Docker

```bash
# Connexion directe à PostgreSQL
docker exec -it agrismart_postgres psql -U postgres -d agrismart_ci

# Exécuter une requête
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "SELECT * FROM users;"
```

### Connexion via PgAdmin

1. Accéder à http://localhost:5050
2. Login : admin@agrismart.ci / admin123
3. Ajouter un serveur :
   - Host: postgres
   - Port: 5432
   - Database: agrismart_ci
   - User: postgres
   - Password: agrismart_secure_2024

### Connexion depuis l'application

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});
```

### Commandes Utiles

```bash
# Lister les tables
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "\dt"

# Décrire une table
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "\d users"

# Compter les enregistrements
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "SELECT COUNT(*) FROM users;"

# Exporter en CSV
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "\COPY users TO '/tmp/users.csv' CSV HEADER"
```

---

## Maintenance et Sauvegarde

### Sauvegarde

```bash
# Sauvegarde complète
docker exec agrismart_postgres pg_dump -U postgres agrismart_ci > backup_$(date +%Y%m%d).sql

# Sauvegarde avec compression
docker exec agrismart_postgres pg_dump -U postgres agrismart_ci | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restauration

```bash
# Restauration
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < backup.sql

# Depuis un fichier compressé
gunzip -c backup.sql.gz | docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci
```

### Nettoyage

```bash
# Supprimer les anciennes mesures (> 1 an)
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "
DELETE FROM mesures WHERE mesure_at < NOW() - INTERVAL '1 year';
"

# Vacuum et analyse
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "VACUUM ANALYZE;"
```

### Monitoring

```bash
# Taille de la base
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "
SELECT pg_size_pretty(pg_database_size('agrismart_ci'));
"

# Taille par table
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
"

# Connexions actives
docker exec agrismart_postgres psql -U postgres -c "
SELECT count(*) FROM pg_stat_activity WHERE datname = 'agrismart_ci';
"
```

---

## FAQ

### Q: Comment réinitialiser la base de données ?

```bash
# Supprimer et recréer
docker exec agrismart_postgres psql -U postgres -c "DROP DATABASE IF EXISTS agrismart_ci;"
docker exec agrismart_postgres psql -U postgres -c "CREATE DATABASE agrismart_ci;"
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < src/database/schema.sql
```

### Q: Comment ajouter une nouvelle culture ?

```sql
INSERT INTO cultures (nom, nom_scientifique, categorie, temperature_min, temperature_max, 
                      humidite_sol_min, humidite_sol_max, ph_min, ph_max, duree_cycle_jours, 
                      rendement_moyen, besoin_eau_total, sols_compatibles)
VALUES ('Igname', 'Dioscorea', 'tubercules', 20, 35, 50, 80, 5.5, 7.0, 240, 10.0, 900, 
        ARRAY['limoneux', 'argilo_sableux']::soil_type[]);
```

### Q: Comment modifier les seuils d'alerte ?

```sql
UPDATE configuration SET valeur = '15' WHERE cle = 'seuil_humidite_critique_bas';
```

### Q: Comment voir les mesures d'un capteur ?

```sql
SELECT * FROM mesures 
WHERE capteur_id = 'uuid-du-capteur' 
ORDER BY mesure_at DESC 
LIMIT 100;
```

### Q: Comment exporter les données d'une parcelle ?

```sql
\COPY (
  SELECT m.mesure_at, c.type, m.valeur, m.unite
  FROM mesures m
  JOIN capteurs c ON m.capteur_id = c.id
  WHERE m.parcelle_id = 'uuid-parcelle'
  ORDER BY m.mesure_at DESC
) TO '/tmp/export_parcelle.csv' CSV HEADER;
```

### Q: Quelle est la performance attendue ?

- **Lectures** : < 50ms pour 99% des requêtes
- **Écritures** : Support de 1000 mesures/seconde
- **Connexions** : Pool de 20 connexions max
- **Stockage** : ~1 Go/an pour 100 capteurs

---

## Changelog

| Version | Date | Modifications |
|---------|------|---------------|
| 1.0.0 | 2025-12-04 | Version initiale - 27 tables |

---

*Documentation générée le 4 décembre 2025 pour AgriSmart CI v1.0.0*
