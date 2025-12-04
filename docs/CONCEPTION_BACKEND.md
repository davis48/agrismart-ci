# 🏗️ Document de Conception Backend - AgriSmart CI

## Table des Matières

1. [Introduction](#1-introduction)
2. [Architecture Globale](#2-architecture-globale)
3. [Stack Technologique](#3-stack-technologique)
4. [Structure du Projet](#4-structure-du-projet)
5. [Authentification et Sécurité](#5-authentification-et-sécurité)
6. [Système de Rôles (RBAC)](#6-système-de-rôles-rbac)
7. [API REST](#7-api-rest)
8. [WebSocket et Temps Réel](#8-websocket-et-temps-réel)
9. [Gestion des Capteurs IoT](#9-gestion-des-capteurs-iot)
10. [Intelligence Artificielle](#10-intelligence-artificielle)
11. [Cache et Performance](#11-cache-et-performance)
12. [Containerisation Docker](#12-containerisation-docker)
13. [Tests et Qualité](#13-tests-et-qualité)
14. [Déploiement](#14-déploiement)
15. [Questions/Réponses Anticipées](#15-questionsréponses-anticipées)

---

## 1. Introduction

### 1.1 Objectif du Document

Ce document décrit l'architecture technique et les choix de conception du backend AgriSmart CI, un système intelligent de gestion agricole pour la Côte d'Ivoire.

### 1.2 Périmètre

Le backend couvre :

- Gestion des utilisateurs et authentification
- Gestion des parcelles et cultures
- Collecte et analyse des données IoT
- Génération de recommandations intelligentes
- Marketplace agricole
- Système de formation
- Messagerie entre utilisateurs

### 1.3 Contexte Ivoirien

Le système est conçu pour le contexte de la Côte d'Ivoire :

- **Langues supportées** : Français, Baoulé, Malinké, Sénoufo
- **Connectivité variable** : Support mode hors-ligne envisagé
- **Notifications multicanal** : SMS, WhatsApp, Push
- **Paiements** : Mobile Money (Orange Money, MTN, Moov)

---

## 2. Architecture Globale

### 2.1 Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│   │ App Mobile  │   │   Web App   │   │   IoT ESP32 │   │  Partenaires│    │
│   │   Flutter   │   │   Next.js   │   │   Capteurs  │   │   (API ext) │    │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘    │
└──────────┼─────────────────┼─────────────────┼─────────────────┼────────────┘
           │                 │                 │                 │
           └─────────────────┴────────┬────────┴─────────────────┘
                                      │
                              ┌───────▼────────┐
                              │  NGINX / CDN   │
                              │ (Load Balancer)│
                              └───────┬────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
    ┌──────▼──────┐           ┌───────▼───────┐          ┌───────▼───────┐
    │   REST API  │           │   WebSocket   │          │   IoT MQTT    │
    │   Express   │           │   Socket.IO   │          │    Broker     │
    │    :3000    │           │    :3000      │          │    :1883      │
    └──────┬──────┘           └───────┬───────┘          └───────┬───────┘
           │                          │                          │
           └──────────────────────────┼──────────────────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
    ┌──────▼──────┐           ┌───────▼───────┐          ┌───────▼───────┐
    │  PostgreSQL │           │     Redis     │          │ Services IA   │
    │    :5432    │           │    :6379      │          │  (TensorFlow) │
    └─────────────┘           └───────────────┘          └───────────────┘
```

### 2.2 Principes Architecturaux

1. **Architecture en Couches** : Séparation claire entre routes, contrôleurs, services
2. **API RESTful** : Respect des conventions REST pour l'API
3. **Stateless** : Pas d'état côté serveur, tout est dans les tokens JWT
4. **Event-Driven** : Utilisation d'événements pour le temps réel
5. **Cache-First** : Utilisation de Redis pour les données fréquentes

---

## 3. Stack Technologique

### 3.1 Langages et Frameworks

| Composant | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| **Runtime** | Node.js | 20 LTS | Performance, écosystème npm, async |
| **Framework** | Express.js | 4.21+ | Maturité, flexibilité, middleware |
| **Temps Réel** | Socket.IO | 4.8+ | WebSocket avec fallback |
| **ORM** | pg (node-postgres) | 8.13+ | Contrôle SQL, performance |
| **Validation** | express-validator | 7.2+ | Validation robuste |
| **Auth** | jsonwebtoken | 9.0+ | JWT standard |

### 3.2 Base de Données

| Composant | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| **SGBD Principal** | PostgreSQL | 15 Alpine | ACID, JSONB, extensions |
| **Cache** | Redis | 7 Alpine | Performance, Pub/Sub |
| **Extensions** | uuid-ossp, pgcrypto | - | UUID, hachage |

### 3.3 Infrastructure

| Composant | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| **Containerisation** | Docker | 24+ | Isolation, reproductibilité |
| **Orchestration** | Docker Compose | 2.x | Dev/staging, simplicité |
| **Reverse Proxy** | NGINX | 1.25+ | SSL, load balancing |

### 3.4 Dépendances NPM Principales

```json
{
  "dependencies": {
    "express": "^4.21.2",          // Framework HTTP
    "pg": "^8.13.1",               // PostgreSQL client
    "ioredis": "^5.4.2",           // Redis client
    "socket.io": "^4.8.1",         // WebSocket
    "jsonwebtoken": "^9.0.2",      // JWT
    "bcryptjs": "^2.4.3",          // Hash mots de passe
    "express-validator": "^7.2.1", // Validation
    "express-rate-limit": "^7.5.0",// Rate limiting
    "cors": "^2.8.5",              // CORS
    "helmet": "^8.0.0",            // Sécurité headers
    "winston": "^3.17.0",          // Logging
    "uuid": "^11.0.3"              // Génération UUID
  }
}
```

---

## 4. Structure du Projet

### 4.1 Arborescence

```
backend/
├── src/
│   ├── config/                 # Configuration
│   │   ├── database.js         # Config PostgreSQL
│   │   ├── redis.js            # Config Redis
│   │   └── socket.js           # Config Socket.IO
│   │
│   ├── middlewares/            # Middlewares Express
│   │   ├── auth.js             # Authentification JWT
│   │   ├── rbac.js             # Contrôle d'accès par rôles
│   │   ├── validation.js       # Schémas de validation
│   │   └── rateLimit.js        # Rate limiting
│   │
│   ├── controllers/            # Contrôleurs (logique métier)
│   │   ├── authController.js
│   │   ├── parcellesController.js
│   │   ├── capteursController.js
│   │   ├── mesuresController.js
│   │   ├── alertesController.js
│   │   ├── recommandationsController.js
│   │   ├── marketplaceController.js
│   │   ├── formationsController.js
│   │   └── messagesController.js
│   │
│   ├── routes/                 # Routes Express
│   │   ├── index.js            # Router principal
│   │   ├── auth.js
│   │   ├── parcelles.js
│   │   ├── cultures.js
│   │   ├── capteurs.js
│   │   ├── mesures.js
│   │   ├── alertes.js
│   │   ├── recommandations.js
│   │   ├── marketplace.js
│   │   ├── formations.js
│   │   └── messages.js
│   │
│   ├── database/               # Scripts SQL
│   │   ├── schema.sql          # Structure complète
│   │   └── init.sql            # Point d'entrée Docker
│   │
│   ├── utils/                  # Utilitaires
│   │   ├── logger.js           # Winston logger
│   │   └── helpers.js          # Fonctions helper
│   │
│   └── app.js                  # Point d'entrée
│
├── docs/                       # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── BASE_DE_DONNEES.md
│   ├── CONCEPTION_BACKEND.md
│   ├── GUIDE_UTILISATION.md
│   └── VERIFICATION_CAHIER_CHARGES.md
│
├── docker-compose.yml          # Orchestration Docker
├── Dockerfile                  # Image API
├── package.json
├── .env.example
└── README.md
```

### 4.2 Flux de Traitement d'une Requête

```
Requête HTTP
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                    EXPRESS MIDDLEWARES                   │
├─────────────────────────────────────────────────────────┤
│  1. helmet()           → Headers sécurité               │
│  2. cors()             → Contrôle CORS                  │
│  3. rateLimit()        → Protection DDoS                │
│  4. express.json()     → Parse body JSON                │
│  5. logger             → Log requête                    │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                    ROUTE MIDDLEWARES                     │
├─────────────────────────────────────────────────────────┤
│  1. authenticate       → Vérifie JWT                    │
│  2. checkRole([])      → Vérifie permissions            │
│  3. validate()         → Valide les données             │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                      CONTROLLER                          │
├─────────────────────────────────────────────────────────┤
│  - Logique métier                                        │
│  - Appels BDD via pool PostgreSQL                       │
│  - Cache Redis si applicable                            │
│  - Émission événements Socket.IO si nécessaire          │
└─────────────────────────────────────────────────────────┘
    │
    ▼
Réponse JSON
```

---

## 5. Authentification et Sécurité

### 5.1 Flow d'Authentification

```
┌─────────────┐                                  ┌─────────────┐
│   Client    │                                  │   Backend   │
└──────┬──────┘                                  └──────┬──────┘
       │                                                │
       │  1. POST /auth/register                        │
       │  {telephone, nom, prenoms, password}           │
       │ ──────────────────────────────────────────────▶│
       │                                                │
       │                         Génère OTP (6 digits)  │
       │                         Stocke OTP en BDD      │
       │                         Envoie SMS/WhatsApp    │
       │                                                │
       │  ◀──────────────────────────────────────────── │
       │  201 Created {message: "OTP envoyé"}           │
       │                                                │
       │  2. POST /auth/verify-otp                      │
       │  {telephone, otp}                              │
       │ ──────────────────────────────────────────────▶│
       │                                                │
       │                         Vérifie OTP            │
       │                         Active le compte       │
       │                         Génère JWT + Refresh   │
       │                                                │
       │  ◀──────────────────────────────────────────── │
       │  200 OK {accessToken, refreshToken, user}      │
       │                                                │
       │  3. GET /api/v1/parcelles                      │
       │  Authorization: Bearer <accessToken>           │
       │ ──────────────────────────────────────────────▶│
       │                                                │
       │                         Vérifie JWT            │
       │                         Extrait userId, role   │
       │                         Exécute requête        │
       │                                                │
       │  ◀──────────────────────────────────────────── │
       │  200 OK {parcelles: [...]}                     │
       │                                                │
```

### 5.2 Structure JWT

**Access Token** (durée : 7 jours)

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "uuid-v4",
    "role": "producteur",
    "iat": 1764861827,
    "exp": 1765466627
  }
}
```

### 5.3 Hashage des Mots de Passe

```javascript
// Hashage avec bcrypt (12 rounds)
const salt = await bcrypt.genSalt(12);
const passwordHash = await bcrypt.hash(password, salt);

// Vérification
const isValid = await bcrypt.compare(password, passwordHash);
```

### 5.4 Mesures de Sécurité

| Mesure | Implémentation | Description |
|--------|----------------|-------------|
| **Rate Limiting** | express-rate-limit | 100 req/15min par IP |
| **Helmet** | helmet() | Headers sécurité (CSP, XSS, etc.) |
| **CORS** | cors() | Origines autorisées |
| **SQL Injection** | Paramètres préparés | `$1, $2, ...` |
| **XSS** | Validation entrées | express-validator |
| **Verrouillage compte** | 5 tentatives max | 15 min de verrouillage |
| **OTP** | 6 chiffres, 10 min | 3 tentatives max |

---

## 6. Système de Rôles (RBAC)

### 6.1 Rôles Définis

| Rôle | Description | Permissions principales |
|------|-------------|------------------------|
| **producteur** | Agriculteur | Ses parcelles, capteurs, mesures, marketplace |
| **conseiller** | Agent technique | Lecture parcelles région, recommandations |
| **admin** | Administrateur | Toutes les ressources |
| **partenaire** | ONG, Ministère | Statistiques, rapports |

### 6.2 Matrice des Permissions

| Ressource | producteur | conseiller | admin | partenaire |
|-----------|------------|------------|-------|------------|
| **Parcelles (siennes)** | CRUD | R | CRUD | R |
| **Parcelles (autres)** | - | R (région) | CRUD | R |
| **Capteurs** | CRUD | R | CRUD | R |
| **Mesures** | R | R | R | R |
| **Alertes** | R (siennes) | R (région) | CRUD | R |
| **Recommandations** | R | CRU | CRUD | R |
| **Marketplace** | CRUD | R | CRUD | R |
| **Formations** | R | CRU | CRUD | R |
| **Utilisateurs** | - | R | CRUD | R |
| **Configuration** | - | - | CRUD | - |

### 6.3 Middleware RBAC

```javascript
// Middleware de vérification des rôles
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Accès refusé pour ce rôle' 
      });
    }
    
    next();
  };
};

// Utilisation
router.get('/admin/users', 
  authenticate, 
  checkRole(['admin']), 
  usersController.list
);
```

---

## 7. API REST

### 7.1 Conventions

- **Base URL** : `/api/v1`
- **Format** : JSON
- **Codes HTTP** : Standards REST
- **Pagination** : `?page=1&limit=20`
- **Filtrage** : `?field=value`
- **Tri** : `?sort=field&order=asc|desc`

### 7.2 Endpoints par Module

#### Authentification (`/auth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/register` | Inscription |
| POST | `/auth/login` | Connexion |
| POST | `/auth/verify-otp` | Vérifier OTP |
| POST | `/auth/resend-otp` | Renvoyer OTP |
| POST | `/auth/refresh` | Rafraîchir token |
| POST | `/auth/logout` | Déconnexion |
| GET | `/auth/me` | Profil utilisateur |

#### Parcelles (`/api/v1/parcelles`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/parcelles` | Liste parcelles |
| POST | `/parcelles` | Créer parcelle |
| GET | `/parcelles/:id` | Détail parcelle |
| PUT | `/parcelles/:id` | Modifier parcelle |
| DELETE | `/parcelles/:id` | Supprimer parcelle |
| GET | `/parcelles/:id/capteurs` | Capteurs de la parcelle |
| GET | `/parcelles/:id/mesures` | Mesures de la parcelle |

#### Cultures (`/api/v1/cultures`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/cultures` | Liste cultures |
| GET | `/cultures/:id` | Détail culture |

#### Capteurs (`/api/v1/capteurs`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/capteurs` | Liste capteurs |
| POST | `/capteurs` | Créer capteur |
| GET | `/capteurs/:id` | Détail capteur |
| PUT | `/capteurs/:id` | Modifier capteur |
| DELETE | `/capteurs/:id` | Supprimer capteur |
| GET | `/capteurs/:id/mesures` | Mesures du capteur |

#### Mesures (`/api/v1/mesures`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/mesures` | Liste mesures |
| POST | `/mesures` | Créer mesure |
| GET | `/mesures/latest` | Dernières mesures |

#### Alertes (`/api/v1/alertes`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/alertes` | Liste alertes |
| GET | `/alertes/:id` | Détail alerte |
| PUT | `/alertes/:id/read` | Marquer comme lue |
| PUT | `/alertes/:id/process` | Marquer comme traitée |

#### Recommandations (`/api/v1/recommandations`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/recommandations` | Liste recommandations |
| GET | `/recommandations/:id` | Détail |
| POST | `/recommandations/:id/apply` | Appliquer |

#### Marketplace (`/api/v1/marketplace`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/marketplace/produits` | Liste produits |
| POST | `/marketplace/produits` | Créer produit |
| GET | `/marketplace/produits/:id` | Détail produit |
| PUT | `/marketplace/produits/:id` | Modifier produit |
| DELETE | `/marketplace/produits/:id` | Supprimer produit |
| POST | `/marketplace/commandes` | Passer commande |
| GET | `/marketplace/commandes` | Mes commandes |

#### Formations (`/api/v1/formations`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/formations` | Liste formations |
| GET | `/formations/:id` | Détail formation |
| POST | `/formations/:id/progress` | Mise à jour progression |

#### Messages (`/api/v1/messages`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/messages` | Liste messages |
| POST | `/messages` | Envoyer message |
| GET | `/messages/:id` | Détail message |
| PUT | `/messages/:id/read` | Marquer comme lu |

### 7.3 Format des Réponses

**Succès (200, 201)**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

**Erreur (4xx, 5xx)**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Données invalides",
    "details": [
      { "field": "email", "message": "Email invalide" }
    ]
  }
}
```

---

## 8. WebSocket et Temps Réel

### 8.1 Configuration Socket.IO

```javascript
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(','),
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});
```

### 8.2 Événements Émis

| Événement | Données | Description |
|-----------|---------|-------------|
| `mesure:nouvelle` | `{capteur_id, valeur, type}` | Nouvelle mesure reçue |
| `alerte:nouvelle` | `{id, niveau, message}` | Nouvelle alerte |
| `alerte:critique` | `{id, message}` | Alerte critique |
| `capteur:status` | `{id, status}` | Changement statut capteur |

### 8.3 Rooms (Canaux)

- `user:{userId}` : Notifications personnelles
- `parcelle:{parcelleId}` : Données d'une parcelle
- `cooperative:{coopId}` : Messages coopérative
- `region:{regionId}` : Alertes régionales

### 8.4 Exemple d'Émission

```javascript
// Lors d'une nouvelle mesure
io.to(`parcelle:${parcelle_id}`).emit('mesure:nouvelle', {
  capteur_id,
  valeur,
  type,
  mesure_at: new Date()
});

// Alerte critique
io.to(`user:${user_id}`).emit('alerte:critique', {
  id: alerte.id,
  message: alerte.message,
  niveau: 'critique'
});
```

---

## 9. Gestion des Capteurs IoT

### 9.1 Architecture IoT

```
┌─────────────────────────────────────────────────────────────────┐
│                        TERRAIN                                   │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐                   │
│   │Capteur 1│     │Capteur 2│     │Capteur n│                   │
│   │Humidité │     │Temp/pH  │     │ NPK     │                   │
│   └────┬────┘     └────┬────┘     └────┬────┘                   │
│        └───────────────┼───────────────┘                        │
│                        ▼                                         │
│               ┌────────────────┐                                 │
│               │  Station ESP32 │  (Agrégation, LoRaWAN/4G)      │
│               │  + Panneau 20W │                                 │
│               └───────┬────────┘                                 │
└───────────────────────┼─────────────────────────────────────────┘
                        │ HTTPS / MQTT
                        ▼
               ┌────────────────┐
               │   Backend API  │
               │ POST /mesures  │
               └───────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │Stockage │   │ Analyse │   │ Alertes │
   │PostgreSQL│  │   IA    │   │WebSocket│
   └─────────┘   └─────────┘   └─────────┘
```

### 9.2 Types de Capteurs Supportés

| Type | Code | Unité | Plage | Précision |
|------|------|-------|-------|-----------|
| Humidité sol | `humidite` | % | 0-100 | ±2% |
| Température | `temperature` | °C | -10 à 60 | ±0.5°C |
| pH sol | `ph` | - | 0-14 | ±0.1 |
| NPK | `npk` | mg/kg | 0-1000 | ±5% |
| Météo | `meteo` | multiple | - | - |
| Caméra | `camera` | - | - | - |

### 9.3 Réception des Mesures

```javascript
// POST /api/v1/mesures
{
  "capteur_id": "uuid-capteur",
  "valeur": 45.2,
  "qualite_signal": 85,
  "mesure_at": "2025-12-04T10:30:00Z"
}
```

### 9.4 Validation et Détection d'Anomalies

```javascript
// Vérification cohérence
const validateMesure = (type, valeur) => {
  const ranges = {
    humidite: { min: 0, max: 100 },
    temperature: { min: -10, max: 60 },
    ph: { min: 0, max: 14 }
  };
  
  const range = ranges[type];
  if (!range) return true;
  
  return valeur >= range.min && valeur <= range.max;
};
```

---

## 10. Intelligence Artificielle

### 10.1 Modèles Prévus

| Modèle | Fonction | Input | Output |
|--------|----------|-------|--------|
| Irrigation | Prévision besoin eau | Météo, sol, culture | Litres/jour |
| Maladies | Détection visuelle | Image feuille | Maladie + confiance |
| Rendement | Prévision récolte | Historique, conditions | Tonnes/ha |
| Prix | Prévision marché | Historique prix | Prix FCFA |

### 10.2 Génération des Recommandations

```javascript
// Logique simplifiée de recommandation d'irrigation
const generateIrrigationRecommendation = async (parcelle) => {
  // 1. Récupérer dernières mesures
  const humidite = await getLatestMesure(parcelle.id, 'humidite');
  const temperature = await getLatestMesure(parcelle.id, 'temperature');
  
  // 2. Récupérer seuils de la culture
  const culture = await getCultureActive(parcelle.id);
  
  // 3. Calculer besoin
  const deficit = culture.humidite_sol_optimale - humidite.valeur;
  
  if (deficit > 10) {
    return {
      type: 'irrigation',
      action: `Irriguer ${deficit * 10} litres/m²`,
      priorite: deficit > 30 ? 5 : 3
    };
  }
  
  return null;
};
```

### 10.3 Alertes Automatiques

Déclenchées quand :

- Humidité < 20% ou > 90%
- Température < 10°C ou > 45°C
- pH < 4.5 ou > 8.5
- Capteur sans transmission > 1h
- Détection maladie confiance > 80%

---

## 11. Cache et Performance

### 11.1 Stratégie de Cache Redis

| Donnée | TTL | Clé | Justification |
|--------|-----|-----|---------------|
| Profil utilisateur | 1h | `user:{id}` | Lecture fréquente |
| Liste cultures | 24h | `cultures:all` | Rarement modifié |
| Dernière mesure | 5min | `mesure:latest:{capteurId}` | Actualité |
| Session | 7j | `session:{token}` | Validation JWT |
| Rate limit | 15min | `ratelimit:{ip}` | Protection DDoS |

### 11.2 Exemple d'Utilisation

```javascript
const getCultures = async () => {
  const cacheKey = 'cultures:all';
  
  // Essayer le cache
  let cultures = await redis.get(cacheKey);
  if (cultures) {
    return JSON.parse(cultures);
  }
  
  // Sinon, BDD
  const result = await pool.query('SELECT * FROM cultures WHERE est_active = true');
  
  // Mettre en cache
  await redis.setex(cacheKey, 86400, JSON.stringify(result.rows));
  
  return result.rows;
};
```

### 11.3 Optimisations SQL

- **Index** sur colonnes fréquemment filtrées
- **EXPLAIN ANALYZE** pour analyser les requêtes
- **Pagination** obligatoire sur les listes
- **Agrégation** des mesures anciennes (> 1 mois)

---

## 12. Containerisation Docker

### 12.1 Services Docker Compose

```yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    environment:
      - NODE_ENV=development
      - POSTGRES_HOST=postgres
      - REDIS_HOST=redis
    
  postgres:
    image: postgres:15-alpine
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/database/init.sql:/docker-entrypoint-initdb.d/init.sql
    
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    
  pgadmin:
    image: dpage/pgadmin4:latest
    ports: ["5050:80"]
```

### 12.2 Dockerfile API

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Dépendances système
RUN apk add --no-cache python3 make g++

# Installation dépendances
COPY package*.json ./
RUN npm ci --only=production

# Code source
COPY src/ ./src/

# Utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
CMD ["node", "src/app.js"]
```

### 12.3 Commandes Utiles

```bash
# Démarrer tous les services
docker compose up -d

# Voir les logs
docker compose logs -f api

# Reconstruire après modifications
docker compose up -d --build

# Arrêter et nettoyer
docker compose down -v
```

---

## 13. Tests et Qualité

### 13.1 Stratégie de Tests (Prévu)

| Type | Outil | Couverture |
|------|-------|------------|
| Unitaires | Jest | Services, helpers |
| Intégration | Supertest | API endpoints |
| E2E | Cypress | Scénarios utilisateur |
| Load | k6 | Performance |

### 13.2 Exemple de Test API

```javascript
describe('POST /auth/register', () => {
  it('should create user and send OTP', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        telephone: '+2250701234567',
        nom: 'Test',
        prenoms: 'User',
        password: 'SecurePass123!'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('OTP');
  });
});
```

### 13.3 Linting et Formatage

```json
// .eslintrc
{
  "extends": ["airbnb-base"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error"
  }
}
```

---

## 14. Déploiement

### 14.1 Environnements

| Environnement | URL | Usage |
|---------------|-----|-------|
| Development | localhost:3000 | Développement local |
| Staging | staging.agrismart.ci | Tests pré-prod |
| Production | api.agrismart.ci | Production |

### 14.2 Variables d'Environnement Production

```env
NODE_ENV=production
PORT=3000

# Database
POSTGRES_HOST=db.agrismart.ci
POSTGRES_PORT=5432
POSTGRES_DB=agrismart_ci
POSTGRES_USER=agrismart_prod
POSTGRES_PASSWORD=<strong-password>

# Redis
REDIS_HOST=cache.agrismart.ci
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>

# JWT
JWT_SECRET=<256-bit-random-key>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGINS=https://agrismart.ci,https://app.agrismart.ci
```

### 14.3 Checklist Déploiement

- [ ] Variables d'environnement configurées
- [ ] SSL/TLS activé
- [ ] Rate limiting ajusté
- [ ] Logs centralisés (CloudWatch, ELK)
- [ ] Monitoring (Prometheus, Grafana)
- [ ] Backups automatisés
- [ ] CI/CD configuré

---

## 15. Questions/Réponses Anticipées

### Q1: Pourquoi Node.js et pas Python/Django ?

**Réponse** : Node.js offre :

- Excellentes performances I/O (async/await)
- Même langage que le frontend potentiel
- Large écosystème npm
- WebSocket natif avec Socket.IO
- Idéal pour les applications temps réel (IoT)

### Q2: Pourquoi PostgreSQL plutôt que MongoDB ?

**Réponse** : PostgreSQL car :

- Données relationnelles (utilisateurs ↔ parcelles ↔ capteurs)
- ACID pour l'intégrité des données financières (marketplace)
- Support JSONB pour données semi-structurées
- Extensions géospatiales (PostGIS si besoin)
- Performances éprouvées en production

### Q3: Comment le système gère-t-il la connectivité intermittente ?

**Réponse** :

- Les stations IoT ont un buffer local (24h de données)
- L'API accepte les mesures avec `mesure_at` passé
- L'app mobile peut stocker localement et synchroniser
- Redis permet une reprise rapide après coupure

### Q4: Comment sont sécurisées les données ?

**Réponse** :

- **Transport** : HTTPS/TLS obligatoire
- **Stockage** : Mots de passe hashés (bcrypt 12 rounds)
- **Accès** : JWT avec expiration, RBAC par rôle
- **Protection** : Rate limiting, Helmet, CORS strict
- **Audit** : Logs de toutes les actions sensibles

### Q5: Quelle est la capacité de traitement ?

**Réponse** :

- **API** : ~1000 req/sec par instance (scalable)
- **Mesures** : ~10 000/min (agrégation automatique)
- **WebSocket** : ~10 000 connexions simultanées
- **Base** : Pool de 20 connexions, extensible

### Q6: Comment ajouter une nouvelle culture ?

**Réponse** :

1. INSERT dans la table `cultures` avec tous les paramètres
2. Associer les maladies via `cultures_affectees`
3. Le système génère automatiquement les recommandations

### Q7: Comment fonctionne la détection de maladies ?

**Réponse** :

1. Photo uploadée via app mobile
2. Image envoyée au modèle TensorFlow (prévu)
3. Retour : maladie détectée + confiance (%)
4. Si confiance > 80% → Alerte + recommandation traitement

### Q8: Comment intégrer un nouveau type de capteur ?

**Réponse** :

1. Ajouter le type dans l'ENUM `sensor_type`
2. Définir les seuils dans la table `configuration`
3. Adapter la logique d'alerte si nécessaire
4. Documenter l'unité et la plage de mesure

### Q9: Comment monitorer la santé du système ?

**Réponse** :

```bash
# Santé des containers
docker compose ps

# Logs en temps réel
docker compose logs -f

# Métriques PostgreSQL
docker exec agrismart_postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# Métriques Redis
docker exec agrismart_redis redis-cli INFO
```

### Q10: Comment sauvegarder les données ?

**Réponse** :

```bash
# Backup complet
docker exec agrismart_postgres pg_dump -U postgres agrismart_ci > backup.sql

# Restauration
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < backup.sql
```

### Q11: Quelles sont les évolutions futures ?

**Réponse** :

1. **v1.1** : Intégration IA complète (TensorFlow)
2. **v1.2** : App mobile Flutter
3. **v1.3** : Mode hors-ligne
4. **v2.0** : Drones de surveillance
5. **v2.1** : Blockchain traçabilité

### Q12: Comment contribuer au projet ?

**Réponse** :

1. Cloner le repository
2. Créer une branche feature/xxx
3. Développer avec tests
4. Soumettre une Pull Request
5. Review et merge

---

## Annexes

### A. Glossaire

| Terme | Définition |
|-------|------------|
| **JWT** | JSON Web Token - Token d'authentification |
| **OTP** | One-Time Password - Code à usage unique |
| **RBAC** | Role-Based Access Control - Contrôle d'accès par rôles |
| **IoT** | Internet of Things - Capteurs connectés |
| **NPK** | Azote, Phosphore, Potassium - Nutriments sol |
| **FCFA** | Franc CFA - Monnaie locale |

### B. Références

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [JWT.io](https://jwt.io/)

---

*Document de conception technique - AgriSmart CI v1.0.0*
*Dernière mise à jour : 4 décembre 2025*
