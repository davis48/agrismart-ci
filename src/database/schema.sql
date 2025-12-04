-- =====================================================
-- AGRISMART CI - Schéma de Base de Données PostgreSQL
-- Système Agricole Intelligent - Côte d'Ivoire
-- =====================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TYPES ÉNUMÉRÉS
-- =====================================================

-- Rôles utilisateurs (RBAC)
CREATE TYPE user_role AS ENUM ('producteur', 'conseiller', 'admin', 'partenaire');

-- Statut utilisateur
CREATE TYPE user_status AS ENUM ('actif', 'inactif', 'suspendu', 'en_attente');

-- Types de sol
CREATE TYPE soil_type AS ENUM ('argileux', 'sablonneux', 'limono_argileux', 'limoneux', 'argilo_sableux');

-- Types de capteurs
CREATE TYPE sensor_type AS ENUM ('humidite', 'temperature', 'ph', 'npk', 'meteo', 'camera');

-- Statut capteur
CREATE TYPE sensor_status AS ENUM ('actif', 'inactif', 'maintenance', 'defaillant');

-- Niveaux d'alerte
CREATE TYPE alert_level AS ENUM ('info', 'important', 'critique');

-- Statut alerte
CREATE TYPE alert_status AS ENUM ('nouvelle', 'lue', 'traitee', 'ignoree');

-- Catégories de culture
CREATE TYPE crop_category AS ENUM ('cereales', 'legumineuses', 'tubercules', 'legumes', 'fruits', 'oleagineux');

-- Statut parcelle
CREATE TYPE parcel_status AS ENUM ('active', 'en_repos', 'preparee', 'ensemencee', 'en_croissance', 'recolte');

-- =====================================================
-- TABLE: RÉGIONS
-- =====================================================
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    chef_lieu VARCHAR(100),
    superficie_km2 DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: COOPÉRATIVES
-- =====================================================
CREATE TABLE cooperatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(200) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    region_id UUID REFERENCES regions(id),
    adresse TEXT,
    telephone VARCHAR(20),
    email VARCHAR(100),
    nombre_membres INTEGER DEFAULT 0,
    date_creation DATE,
    est_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: UTILISATEURS
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Informations personnelles
    nom VARCHAR(100) NOT NULL,
    prenoms VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    telephone VARCHAR(20) UNIQUE NOT NULL,
    
    -- Authentification
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'producteur',
    status user_status DEFAULT 'en_attente',
    
    -- OTP
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Localisation
    region_id UUID REFERENCES regions(id),
    cooperative_id UUID REFERENCES cooperatives(id),
    village VARCHAR(100),
    
    -- Préférences
    langue_preferee VARCHAR(20) DEFAULT 'fr', -- fr, baoule, malinke, senoufo
    notifications_sms BOOLEAN DEFAULT true,
    notifications_whatsapp BOOLEAN DEFAULT false,
    notifications_push BOOLEAN DEFAULT true,
    
    -- Métadonnées
    derniere_connexion TIMESTAMP WITH TIME ZONE,
    tentatives_connexion INTEGER DEFAULT 0,
    compte_verrouille_jusqu_a TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche rapide
CREATE INDEX idx_users_telephone ON users(telephone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_region ON users(region_id);

-- =====================================================
-- TABLE: SESSIONS (Refresh Tokens)
-- =====================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    device_info TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(refresh_token);

-- =====================================================
-- TABLE: PARCELLES
-- =====================================================
CREATE TABLE parcelles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Identification
    nom VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    
    -- Localisation GPS
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    altitude DECIMAL(6, 2),
    polygon_geojson JSONB, -- Délimitation précise
    
    -- Caractéristiques
    superficie_hectares DECIMAL(8, 4) NOT NULL,
    type_sol soil_type,
    description TEXT,
    
    -- Statut
    status parcel_status DEFAULT 'active',
    
    -- Historique
    date_acquisition DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_parcelles_user ON parcelles(user_id);
CREATE INDEX idx_parcelles_status ON parcelles(status);
CREATE INDEX idx_parcelles_coords ON parcelles(latitude, longitude);

-- =====================================================
-- TABLE: CULTURES (Référentiel)
-- =====================================================
CREATE TABLE cultures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    nom VARCHAR(100) NOT NULL,
    nom_scientifique VARCHAR(150),
    nom_local_baoule VARCHAR(100),
    nom_local_malinke VARCHAR(100),
    nom_local_senoufo VARCHAR(100),
    
    -- Classification
    categorie crop_category NOT NULL,
    
    -- Conditions optimales
    temperature_min DECIMAL(4, 2),
    temperature_max DECIMAL(4, 2),
    humidite_sol_min DECIMAL(5, 2),
    humidite_sol_max DECIMAL(5, 2),
    ph_min DECIMAL(3, 1),
    ph_max DECIMAL(3, 1),
    
    -- Besoins en nutriments (kg/ha)
    besoin_azote DECIMAL(6, 2),
    besoin_phosphore DECIMAL(6, 2),
    besoin_potassium DECIMAL(6, 2),
    
    -- Cycle de culture
    duree_cycle_jours INTEGER,
    saison_plantation VARCHAR(100),
    
    -- Rendement attendu (tonnes/ha)
    rendement_moyen DECIMAL(6, 2),
    rendement_optimal DECIMAL(6, 2),
    
    -- Besoins en eau (mm/cycle)
    besoin_eau_total INTEGER,
    
    -- Sols compatibles
    sols_compatibles soil_type[],
    
    -- Image de référence
    image_url VARCHAR(500),
    
    description TEXT,
    conseils_culture TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: PLANTATIONS (Culture sur parcelle)
-- =====================================================
CREATE TABLE plantations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcelle_id UUID REFERENCES parcelles(id) ON DELETE CASCADE,
    culture_id UUID REFERENCES cultures(id),
    
    -- Période
    date_semis DATE NOT NULL,
    date_recolte_prevue DATE,
    date_recolte_effective DATE,
    
    -- Surface
    superficie_plantee DECIMAL(8, 4),
    
    -- Rendement
    rendement_obtenu DECIMAL(8, 2), -- tonnes
    rendement_par_hectare DECIMAL(6, 2),
    
    -- Statut
    est_active BOOLEAN DEFAULT true,
    
    -- Notes
    observations TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plantations_parcelle ON plantations(parcelle_id);
CREATE INDEX idx_plantations_culture ON plantations(culture_id);
CREATE INDEX idx_plantations_date ON plantations(date_semis);

-- =====================================================
-- TABLE: STATIONS IoT
-- =====================================================
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    code VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(100),
    
    -- Localisation
    parcelle_id UUID REFERENCES parcelles(id),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Configuration
    intervalle_transmission_minutes INTEGER DEFAULT 15,
    
    -- Énergie
    niveau_batterie DECIMAL(5, 2),
    panneau_solaire_watts DECIMAL(5, 2) DEFAULT 20,
    derniere_charge TIMESTAMP WITH TIME ZONE,
    
    -- Connectivité
    type_connexion VARCHAR(20) DEFAULT 'lorawan', -- lorawan, 4g, wifi
    signal_force INTEGER, -- dBm
    
    -- Statut
    status sensor_status DEFAULT 'actif',
    derniere_transmission TIMESTAMP WITH TIME ZONE,
    
    -- Maintenance
    date_installation DATE,
    prochaine_maintenance DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stations_parcelle ON stations(parcelle_id);
CREATE INDEX idx_stations_status ON stations(status);

-- =====================================================
-- TABLE: CAPTEURS
-- =====================================================
CREATE TABLE capteurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
    
    -- Identification
    code VARCHAR(50) UNIQUE NOT NULL,
    type sensor_type NOT NULL,
    modele VARCHAR(100),
    fabricant VARCHAR(100),
    
    -- Configuration
    unite_mesure VARCHAR(20),
    precision_mesure DECIMAL(8, 4),
    valeur_min DECIMAL(10, 2),
    valeur_max DECIMAL(10, 2),
    
    -- Pour capteurs multi-profondeur
    profondeur_cm INTEGER, -- Profondeur dans le sol
    
    -- Calibration
    derniere_calibration DATE,
    prochaine_calibration DATE,
    facteur_correction DECIMAL(8, 4) DEFAULT 1.0,
    
    -- Statut
    status sensor_status DEFAULT 'actif',
    
    -- Durée de vie
    date_installation DATE,
    duree_vie_estimee_mois INTEGER DEFAULT 60,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_capteurs_station ON capteurs(station_id);
CREATE INDEX idx_capteurs_type ON capteurs(type);
CREATE INDEX idx_capteurs_status ON capteurs(status);

-- =====================================================
-- TABLE: MESURES (Données des capteurs)
-- =====================================================
CREATE TABLE mesures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capteur_id UUID REFERENCES capteurs(id) ON DELETE CASCADE,
    station_id UUID REFERENCES stations(id),
    parcelle_id UUID REFERENCES parcelles(id),
    
    -- Données
    valeur DECIMAL(12, 4) NOT NULL,
    unite VARCHAR(20),
    
    -- Qualité des données
    qualite_signal INTEGER, -- 0-100%
    est_valide BOOLEAN DEFAULT true,
    est_anomalie BOOLEAN DEFAULT false,
    
    -- Horodatage
    mesure_at TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Partitionnement par date pour performances (optionnel mais recommandé)
CREATE INDEX idx_mesures_capteur_date ON mesures(capteur_id, mesure_at DESC);
CREATE INDEX idx_mesures_parcelle_date ON mesures(parcelle_id, mesure_at DESC);
CREATE INDEX idx_mesures_date ON mesures(mesure_at DESC);

-- =====================================================
-- TABLE: DONNÉES AGRÉGÉES (Résumés horaires/journaliers)
-- =====================================================
CREATE TABLE mesures_agregees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capteur_id UUID REFERENCES capteurs(id) ON DELETE CASCADE,
    parcelle_id UUID REFERENCES parcelles(id),
    
    -- Période
    periode_debut TIMESTAMP WITH TIME ZONE NOT NULL,
    periode_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    type_agregation VARCHAR(20) NOT NULL, -- 'horaire', 'journalier', 'hebdomadaire'
    
    -- Statistiques
    valeur_moyenne DECIMAL(12, 4),
    valeur_min DECIMAL(12, 4),
    valeur_max DECIMAL(12, 4),
    ecart_type DECIMAL(12, 4),
    nombre_mesures INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agregees_capteur_periode ON mesures_agregees(capteur_id, periode_debut DESC);

-- =====================================================
-- TABLE: DONNÉES MÉTÉO
-- =====================================================
CREATE TABLE meteo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID REFERENCES regions(id),
    parcelle_id UUID REFERENCES parcelles(id),
    
    -- Localisation
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Données actuelles
    temperature DECIMAL(5, 2),
    humidite_air DECIMAL(5, 2),
    pression DECIMAL(7, 2),
    vitesse_vent DECIMAL(6, 2),
    direction_vent INTEGER,
    precipitations DECIMAL(6, 2),
    rayonnement_solaire DECIMAL(8, 2),
    indice_uv DECIMAL(4, 2),
    
    -- Conditions
    description VARCHAR(100),
    icone VARCHAR(50),
    
    -- Source
    source VARCHAR(50) DEFAULT 'openweathermap',
    
    -- Horodatage
    observation_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meteo_region_date ON meteo(region_id, observation_at DESC);
CREATE INDEX idx_meteo_parcelle_date ON meteo(parcelle_id, observation_at DESC);

-- =====================================================
-- TABLE: PRÉVISIONS MÉTÉO
-- =====================================================
CREATE TABLE previsions_meteo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID REFERENCES regions(id),
    parcelle_id UUID REFERENCES parcelles(id),
    
    -- Période de prévision
    date_prevision DATE NOT NULL,
    heure_prevision INTEGER, -- 0-23, NULL si prévision journalière
    
    -- Données prévues
    temperature_min DECIMAL(5, 2),
    temperature_max DECIMAL(5, 2),
    humidite DECIMAL(5, 2),
    probabilite_pluie DECIMAL(5, 2),
    precipitations_prevues DECIMAL(6, 2),
    vitesse_vent DECIMAL(6, 2),
    
    -- Conditions
    description VARCHAR(100),
    icone VARCHAR(50),
    
    -- Alertes météo
    alerte_secheresse BOOLEAN DEFAULT false,
    alerte_pluie_intense BOOLEAN DEFAULT false,
    alerte_vent_violent BOOLEAN DEFAULT false,
    alerte_temperature_extreme BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_previsions_region_date ON previsions_meteo(region_id, date_prevision);

-- =====================================================
-- TABLE: ALERTES
-- =====================================================
CREATE TABLE alertes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Destinataire
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parcelle_id UUID REFERENCES parcelles(id),
    capteur_id UUID REFERENCES capteurs(id),
    
    -- Contenu
    niveau alert_level NOT NULL,
    titre VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    message_local TEXT, -- Message en langue locale
    
    -- Catégorie
    categorie VARCHAR(50) NOT NULL, -- 'irrigation', 'maladie', 'meteo', 'sol', 'maintenance'
    
    -- Données associées
    valeur_declencheur DECIMAL(12, 4),
    seuil_reference DECIMAL(12, 4),
    donnees_contexte JSONB,
    
    -- Recommandation
    action_recommandee TEXT,
    
    -- Statut
    status alert_status DEFAULT 'nouvelle',
    
    -- Notification
    envoye_sms BOOLEAN DEFAULT false,
    envoye_whatsapp BOOLEAN DEFAULT false,
    envoye_push BOOLEAN DEFAULT false,
    date_envoi TIMESTAMP WITH TIME ZONE,
    
    -- Traitement
    lu_at TIMESTAMP WITH TIME ZONE,
    traite_at TIMESTAMP WITH TIME ZONE,
    traite_par UUID REFERENCES users(id),
    commentaire_traitement TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alertes_user ON alertes(user_id);
CREATE INDEX idx_alertes_parcelle ON alertes(parcelle_id);
CREATE INDEX idx_alertes_niveau ON alertes(niveau);
CREATE INDEX idx_alertes_status ON alertes(status);
CREATE INDEX idx_alertes_date ON alertes(created_at DESC);

-- =====================================================
-- TABLE: MALADIES (Référentiel)
-- =====================================================
CREATE TABLE maladies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    nom VARCHAR(150) NOT NULL,
    nom_scientifique VARCHAR(200),
    nom_local VARCHAR(150),
    
    -- Cultures affectées
    cultures_affectees UUID[], -- IDs des cultures
    
    -- Description
    description TEXT,
    symptomes TEXT,
    causes TEXT,
    
    -- Conditions favorables
    temperature_favorable_min DECIMAL(4, 2),
    temperature_favorable_max DECIMAL(4, 2),
    humidite_favorable_min DECIMAL(5, 2),
    humidite_favorable_max DECIMAL(5, 2),
    
    -- Traitement
    traitement_preventif TEXT,
    traitement_curatif TEXT,
    produits_recommandes TEXT[],
    
    -- Gravité
    niveau_gravite INTEGER CHECK (niveau_gravite BETWEEN 1 AND 5),
    
    -- Images de référence
    images_symptomes VARCHAR(500)[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: DÉTECTIONS DE MALADIES
-- =====================================================
CREATE TABLE detections_maladies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contexte
    user_id UUID REFERENCES users(id),
    parcelle_id UUID REFERENCES parcelles(id),
    plantation_id UUID REFERENCES plantations(id),
    maladie_id UUID REFERENCES maladies(id),
    
    -- Source de détection
    source VARCHAR(50) NOT NULL, -- 'ia_image', 'ia_donnees', 'manuel'
    
    -- Image analysée
    image_url VARCHAR(500),
    
    -- Résultat IA
    confiance_detection DECIMAL(5, 2), -- 0-100%
    autres_diagnostics JSONB, -- Autres maladies possibles avec confiance
    
    -- Localisation dans la parcelle
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    zone_affectee_m2 DECIMAL(10, 2),
    
    -- Suivi
    est_confirmee BOOLEAN,
    confirme_par UUID REFERENCES users(id),
    date_confirmation TIMESTAMP WITH TIME ZONE,
    
    -- Traitement appliqué
    traitement_applique TEXT,
    date_traitement DATE,
    resultat_traitement VARCHAR(50), -- 'efficace', 'partiel', 'inefficace'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_detections_user ON detections_maladies(user_id);
CREATE INDEX idx_detections_parcelle ON detections_maladies(parcelle_id);
CREATE INDEX idx_detections_maladie ON detections_maladies(maladie_id);

-- =====================================================
-- TABLE: RECOMMANDATIONS
-- =====================================================
CREATE TABLE recommandations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Destinataire
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parcelle_id UUID REFERENCES parcelles(id),
    
    -- Type
    type VARCHAR(50) NOT NULL, -- 'irrigation', 'fertilisation', 'culture', 'traitement', 'recolte'
    
    -- Contenu
    titre VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    description_locale TEXT,
    
    -- Données de base
    donnees_source JSONB, -- Mesures ayant généré la recommandation
    
    -- Action recommandée
    action TEXT,
    quantite DECIMAL(10, 2),
    unite VARCHAR(50),
    frequence VARCHAR(100),
    periode_application VARCHAR(100),
    
    -- Priorité
    priorite INTEGER CHECK (priorite BETWEEN 1 AND 5) DEFAULT 3,
    
    -- Validité
    valide_du TIMESTAMP WITH TIME ZONE,
    valide_jusqu_au TIMESTAMP WITH TIME ZONE,
    
    -- Feedback utilisateur
    appliquee BOOLEAN,
    date_application TIMESTAMP WITH TIME ZONE,
    note_utilisateur INTEGER CHECK (note_utilisateur BETWEEN 1 AND 5),
    commentaire_utilisateur TEXT,
    
    -- Génération
    genere_par VARCHAR(50) DEFAULT 'systeme', -- 'systeme', 'ia', 'conseiller'
    modele_ia_version VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recommandations_user ON recommandations(user_id);
CREATE INDEX idx_recommandations_parcelle ON recommandations(parcelle_id);
CREATE INDEX idx_recommandations_type ON recommandations(type);

-- =====================================================
-- TABLE: PRÉVISIONS D'IRRIGATION
-- =====================================================
CREATE TABLE previsions_irrigation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    parcelle_id UUID REFERENCES parcelles(id) ON DELETE CASCADE,
    plantation_id UUID REFERENCES plantations(id),
    
    -- Période
    date_prevision DATE NOT NULL,
    
    -- Besoins calculés
    besoin_eau_mm DECIMAL(8, 2) NOT NULL,
    besoin_eau_litres DECIMAL(12, 2),
    
    -- Facteurs pris en compte
    evapotranspiration_mm DECIMAL(8, 2),
    precipitations_prevues_mm DECIMAL(8, 2),
    humidite_sol_actuelle DECIMAL(5, 2),
    humidite_sol_cible DECIMAL(5, 2),
    
    -- Recommandation
    irrigation_recommandee BOOLEAN,
    moment_optimal VARCHAR(50), -- 'matin', 'soir'
    duree_minutes INTEGER,
    
    -- Confiance
    confiance_prevision DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_irrigation_parcelle_date ON previsions_irrigation(parcelle_id, date_prevision);

-- =====================================================
-- TABLE: MARKETPLACE - PRODUITS
-- =====================================================
CREATE TABLE marketplace_produits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Vendeur
    vendeur_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Produit
    nom VARCHAR(200) NOT NULL,
    description TEXT,
    categorie VARCHAR(50) NOT NULL, -- 'semences', 'engrais', 'recoltes', 'equipement'
    
    -- Prix
    prix DECIMAL(12, 2) NOT NULL,
    devise VARCHAR(10) DEFAULT 'XOF',
    unite VARCHAR(50), -- 'kg', 'sac', 'unite', 'hectare'
    quantite_disponible DECIMAL(10, 2),
    
    -- Localisation
    region_id UUID REFERENCES regions(id),
    lieu_retrait TEXT,
    
    -- Livraison
    livraison_possible BOOLEAN DEFAULT false,
    frais_livraison DECIMAL(10, 2),
    zone_livraison TEXT,
    
    -- Médias
    images VARCHAR(500)[],
    
    -- Statut
    est_actif BOOLEAN DEFAULT true,
    
    -- Statistiques
    vues INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marketplace_vendeur ON marketplace_produits(vendeur_id);
CREATE INDEX idx_marketplace_categorie ON marketplace_produits(categorie);
CREATE INDEX idx_marketplace_region ON marketplace_produits(region_id);

-- =====================================================
-- TABLE: MARKETPLACE - COMMANDES
-- =====================================================
CREATE TABLE marketplace_commandes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parties
    acheteur_id UUID REFERENCES users(id),
    vendeur_id UUID REFERENCES users(id),
    produit_id UUID REFERENCES marketplace_produits(id),
    
    -- Commande
    quantite DECIMAL(10, 2) NOT NULL,
    prix_unitaire DECIMAL(12, 2) NOT NULL,
    prix_total DECIMAL(12, 2) NOT NULL,
    
    -- Statut
    statut VARCHAR(50) DEFAULT 'en_attente', -- 'en_attente', 'confirmee', 'livree', 'annulee'
    
    -- Livraison
    mode_livraison VARCHAR(50), -- 'retrait', 'livraison'
    adresse_livraison TEXT,
    date_livraison_prevue DATE,
    date_livraison_effective TIMESTAMP WITH TIME ZONE,
    
    -- Paiement
    mode_paiement VARCHAR(50), -- 'mobile_money', 'especes', 'virement'
    reference_paiement VARCHAR(100),
    paiement_confirme BOOLEAN DEFAULT false,
    
    -- Notes
    note_acheteur INTEGER CHECK (note_acheteur BETWEEN 1 AND 5),
    commentaire_acheteur TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: MESSAGES (Chat communautaire)
-- =====================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Expéditeur
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Destinataire ou groupe
    destinataire_id UUID REFERENCES users(id),
    cooperative_id UUID REFERENCES cooperatives(id),
    est_public BOOLEAN DEFAULT false,
    
    -- Contenu
    contenu TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'texte', -- 'texte', 'image', 'audio'
    media_url VARCHAR(500),
    
    -- Contexte
    parcelle_id UUID REFERENCES parcelles(id),
    alerte_id UUID REFERENCES alertes(id),
    
    -- Statut
    lu BOOLEAN DEFAULT false,
    lu_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_messages_destinataire ON messages(destinataire_id);
CREATE INDEX idx_messages_cooperative ON messages(cooperative_id);

-- =====================================================
-- TABLE: FORMATIONS
-- =====================================================
CREATE TABLE formations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contenu
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    categorie VARCHAR(50), -- 'culture', 'irrigation', 'maladie', 'sol', 'application'
    
    -- Médias
    type VARCHAR(20) NOT NULL, -- 'video', 'pdf', 'article'
    url VARCHAR(500),
    duree_minutes INTEGER,
    
    -- Multilingue
    langue VARCHAR(20) DEFAULT 'fr',
    
    -- Cultures concernées
    cultures_id UUID[],
    
    -- Statistiques
    vues INTEGER DEFAULT 0,
    
    est_actif BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: HISTORIQUE FORMATIONS UTILISATEUR
-- =====================================================
CREATE TABLE user_formations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    formation_id UUID REFERENCES formations(id) ON DELETE CASCADE,
    
    -- Progression
    progression DECIMAL(5, 2) DEFAULT 0, -- 0-100%
    complete BOOLEAN DEFAULT false,
    date_completion TIMESTAMP WITH TIME ZONE,
    
    -- Évaluation
    note INTEGER CHECK (note BETWEEN 1 AND 5),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, formation_id)
);

-- =====================================================
-- TABLE: JOURNAL D'AUDIT
-- =====================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Acteur
    user_id UUID REFERENCES users(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Action
    action VARCHAR(100) NOT NULL,
    entite VARCHAR(100),
    entite_id UUID,
    
    -- Données
    donnees_avant JSONB,
    donnees_apres JSONB,
    
    -- Résultat
    succes BOOLEAN DEFAULT true,
    message_erreur TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_date ON audit_logs(created_at DESC);

-- =====================================================
-- TABLE: CONFIGURATION SYSTÈME
-- =====================================================
CREATE TABLE configuration (
    cle VARCHAR(100) PRIMARY KEY,
    valeur TEXT NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    modifiable BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- FONCTIONS ET TRIGGERS
-- =====================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Application des triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parcelles_updated_at BEFORE UPDATE ON parcelles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capteurs_updated_at BEFORE UPDATE ON capteurs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cultures_updated_at BEFORE UPDATE ON cultures 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plantations_updated_at BEFORE UPDATE ON plantations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VUES
-- =====================================================

-- Vue: Dernières mesures par capteur
CREATE VIEW v_dernieres_mesures AS
SELECT DISTINCT ON (capteur_id)
    m.id,
    m.capteur_id,
    c.type AS type_capteur,
    c.code AS code_capteur,
    m.valeur,
    m.unite,
    m.mesure_at,
    m.parcelle_id,
    p.nom AS nom_parcelle,
    s.code AS code_station
FROM mesures m
JOIN capteurs c ON m.capteur_id = c.id
JOIN stations s ON c.station_id = s.id
LEFT JOIN parcelles p ON m.parcelle_id = p.id
ORDER BY capteur_id, mesure_at DESC;

-- Vue: État des parcelles avec dernières mesures
CREATE VIEW v_etat_parcelles AS
SELECT 
    p.id,
    p.nom,
    p.user_id,
    p.superficie_hectares,
    p.type_sol,
    p.status,
    (SELECT valeur FROM mesures m 
     JOIN capteurs c ON m.capteur_id = c.id 
     WHERE m.parcelle_id = p.id AND c.type = 'humidite' 
     ORDER BY m.mesure_at DESC LIMIT 1) AS derniere_humidite,
    (SELECT valeur FROM mesures m 
     JOIN capteurs c ON m.capteur_id = c.id 
     WHERE m.parcelle_id = p.id AND c.type = 'temperature' 
     ORDER BY m.mesure_at DESC LIMIT 1) AS derniere_temperature,
    (SELECT valeur FROM mesures m 
     JOIN capteurs c ON m.capteur_id = c.id 
     WHERE m.parcelle_id = p.id AND c.type = 'ph' 
     ORDER BY m.mesure_at DESC LIMIT 1) AS dernier_ph,
    (SELECT COUNT(*) FROM alertes a 
     WHERE a.parcelle_id = p.id AND a.status = 'nouvelle') AS alertes_non_lues
FROM parcelles p;

-- =====================================================
-- DONNÉES INITIALES
-- =====================================================

-- Configurations par défaut
INSERT INTO configuration (cle, valeur, description, type) VALUES
('seuil_humidite_critique_bas', '20', 'Seuil humidité sol critique bas (%)', 'number'),
('seuil_humidite_critique_haut', '90', 'Seuil humidité sol critique haut (%)', 'number'),
('seuil_temperature_critique_bas', '10', 'Seuil température sol critique bas (°C)', 'number'),
('seuil_temperature_critique_haut', '45', 'Seuil température sol critique haut (°C)', 'number'),
('seuil_ph_critique_bas', '4.5', 'Seuil pH sol critique bas', 'number'),
('seuil_ph_critique_haut', '8.5', 'Seuil pH sol critique haut', 'number'),
('intervalle_agregation_heures', '1', 'Intervalle agrégation données (heures)', 'number'),
('retention_mesures_jours', '365', 'Durée conservation mesures détaillées (jours)', 'number');

-- Régions de Côte d'Ivoire (exemples zones pilotes)
INSERT INTO regions (nom, code, chef_lieu) VALUES
('Poro', 'PORO', 'Korhogo'),
('Gbêkê', 'GBEKE', 'Bouaké'),
('Gôh', 'GOH', 'Gagnoa'),
('Haut-Sassandra', 'HTSASS', 'Daloa'),
('Sud-Comoé', 'SUDCOM', 'Aboisso');

-- Cultures principales
INSERT INTO cultures (nom, nom_scientifique, categorie, temperature_min, temperature_max, humidite_sol_min, humidite_sol_max, ph_min, ph_max, duree_cycle_jours, rendement_moyen, besoin_eau_total, sols_compatibles) VALUES
('Riz', 'Oryza sativa', 'cereales', 20, 35, 60, 80, 5.5, 7.0, 120, 2.2, 1200, ARRAY['argileux', 'limono_argileux']::soil_type[]),
('Maïs', 'Zea mays', 'cereales', 18, 32, 50, 70, 5.8, 7.5, 90, 3.5, 600, ARRAY['limono_argileux', 'limoneux', 'argilo_sableux']::soil_type[]),
('Manioc', 'Manihot esculenta', 'tubercules', 20, 35, 40, 70, 5.0, 7.0, 365, 15.0, 800, ARRAY['sablonneux', 'argilo_sableux', 'limoneux']::soil_type[]),
('Tomate', 'Solanum lycopersicum', 'legumes', 18, 30, 60, 80, 6.0, 7.0, 90, 25.0, 500, ARRAY['limono_argileux', 'limoneux']::soil_type[]),
('Arachide', 'Arachis hypogaea', 'oleagineux', 20, 35, 40, 60, 5.5, 7.0, 120, 1.5, 500, ARRAY['sablonneux', 'argilo_sableux']::soil_type[]);

-- Maladies courantes
INSERT INTO maladies (nom, nom_scientifique, description, symptomes, niveau_gravite, traitement_preventif, traitement_curatif) VALUES
('Mildiou de la tomate', 'Phytophthora infestans', 'Maladie fongique affectant les tomates', 'Taches brunes sur feuilles, fruits pourris', 4, 'Rotation des cultures, drainage adéquat', 'Fongicides à base de cuivre'),
('Striga', 'Striga hermonthica', 'Plante parasite du maïs et sorgho', 'Jaunissement, rabougrissement des plants', 5, 'Variétés résistantes, rotation', 'Arrachage manuel, herbicides'),
('Mosaïque du manioc', 'Cassava mosaic virus', 'Virus transmis par mouches blanches', 'Déformation des feuilles, marbrure jaune-vert', 4, 'Boutures saines, contrôle vecteurs', 'Élimination des plants infectés'),
('Pyriculariose du riz', 'Magnaporthe oryzae', 'Maladie fongique du riz', 'Taches en losange sur feuilles', 4, 'Variétés résistantes, gestion azote', 'Fongicides systémiques');

COMMIT;
