# 🚀 Guide d'Utilisation du Backend AgriSmart CI

Ce guide explique comment configurer, lancer et utiliser le backend AgriSmart CI en local et avec Docker.

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Lancement avec Docker](#lancement-avec-docker)
5. [Lancement en local (développement)](#lancement-en-local)
6. [Tester le Backend](#tester-le-backend)
7. [Collaboration avec Docker](#collaboration-avec-docker)
8. [Structure du Projet](#structure-du-projet)
9. [Commandes Utiles](#commandes-utiles)
10. [Dépannage](#dépannage)

---

## 🔧 Prérequis

### Obligatoire

- **Node.js** 20+ LTS : [https://nodejs.org](https://nodejs.org)
- **Docker Desktop** : [https://docker.com/products/docker-desktop](https://docker.com/products/docker-desktop)
- **Git** : [https://git-scm.com](https://git-scm.com)

### Optionnel (développement local sans Docker)

- **PostgreSQL** 15+ : [https://postgresql.org](https://postgresql.org)
- **Redis** 7+ : [https://redis.io](https://redis.io)

### Vérification des prérequis

```bash
node --version    # v20.x.x
docker --version  # Docker version 24.x.x ou +
git --version     # git version 2.x.x
```

---

## 📦 Installation

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd agriculture/backend
```

### 2. Installer les dépendances (mode développement local)

```bash
npm install
```

---

## ⚙️ Configuration

### 1. Créer le fichier d'environnement

```bash
cp .env.example .env
```

### 2. Configurer les variables

Éditer le fichier `.env` :

```env
# Environnement
NODE_ENV=development
PORT=3000

# Base de données PostgreSQL
DB_HOST=localhost       # ou 'postgres' avec Docker
DB_PORT=5432
DB_NAME=agrismart_ci
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe_securise

# JWT (générer une clé secrète forte)
JWT_SECRET=votre_cle_secrete_tres_longue_et_complexe
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# OTP
OTP_EXPIRES_MINUTES=10
OTP_MAX_ATTEMPTS=3

# Redis (optionnel, utilisé pour le cache)
REDIS_URL=redis://localhost:6379

# Twilio SMS (optionnel pour les tests)
TWILIO_ACCOUNT_SID=votre_sid
TWILIO_AUTH_TOKEN=votre_token
TWILIO_PHONE_NUMBER=+1234567890

# Email SMTP (optionnel pour les tests)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre_email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_app
```

> 💡 **Astuce** : Pour les tests locaux, les services SMS et email sont optionnels. L'OTP sera affiché dans les logs.

---

## 🐳 Lancement avec Docker

### Méthode recommandée pour la collaboration

### 1. Démarrer tous les services

```bash
cd backend

# Démarrer PostgreSQL, Redis, l'API et PgAdmin
docker compose up -d
```

### 2. Vérifier que tout fonctionne

```bash
# Voir l'état des conteneurs
docker ps

# Résultat attendu :
# NAMES              STATUS            PORTS
# agrismart_api      Up (healthy)      0.0.0.0:3000->3000/tcp
# agrismart_postgres Up (healthy)      0.0.0.0:5432->5432/tcp
# agrismart_redis    Up (healthy)      0.0.0.0:6379->6379/tcp
# agrismart_pgadmin  Up                0.0.0.0:5050->80/tcp
```

### 3. Tester l'API

```bash
# Health check
curl http://localhost:3000/health

# Info API
curl http://localhost:3000/api/v1
```

### 4. Initialiser la base de données (première fois)

```bash
# Le schéma est appliqué automatiquement au démarrage
# Pour réinitialiser manuellement :
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < src/database/schema.sql
```

### 5. Accéder à PgAdmin

- URL : http://localhost:5050
- Email : admin@agrismart.ci
- Mot de passe : agrismart2024

Pour ajouter le serveur PostgreSQL dans PgAdmin :
- Host : postgres
- Port : 5432
- Database : agrismart_ci
- Username : postgres
- Password : (voir .env)

### 6. Arrêter les services

```bash
# Arrêter sans supprimer les données
docker compose stop

# Arrêter et supprimer les conteneurs (les données persistent)
docker compose down

# Arrêter et supprimer TOUT (inclus les données)
docker compose down -v
```

---

## 💻 Lancement en Local (Développement)

Pour développer sans Docker (base de données PostgreSQL requise localement).

### 1. Configurer la base de données

```bash
# Créer la base de données
createdb agrismart_ci

# Appliquer le schéma
psql -d agrismart_ci -f src/database/schema.sql
```

### 2. Démarrer en mode développement

```bash
# Avec rechargement automatique (nodemon)
npm run dev

# Ou en mode production
npm start
```

### 3. Vérifier

```bash
curl http://localhost:3000/health
```

---

## 🧪 Tester le Backend

### Tests manuels avec cURL

#### 1. Inscription

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@agrismart.ci",
    "telephone": "+2250707070707",
    "password": "MotDePasse123!",
    "nom": "Kouassi",
    "prenoms": "Jean-Baptiste",
    "langue_preferee": "fr"
  }'
```

#### 2. Connexion

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@agrismart.ci",
    "password": "MotDePasse123!"
  }'
```

#### 3. Vérification OTP

```bash
# Récupérer l'OTP dans les logs Docker
docker logs agrismart_api --tail 50 | grep OTP

# Vérifier l'OTP
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@agrismart.ci",
    "otp": "123456"
  }'
```

#### 4. Requêtes authentifiées

```bash
# Sauvegarder le token
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Profil utilisateur
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Créer une parcelle
curl -X POST http://localhost:3000/api/v1/parcelles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Parcelle Cacao",
    "superficie": 5.5,
    "latitude": 6.8185,
    "longitude": -5.2757,
    "type_sol": "argileux"
  }'
```

### Utiliser Postman ou Insomnia

Importez la collection depuis `docs/postman_collection.json` (à créer).

---

## 👥 Collaboration avec Docker

### Pour votre collègue Frontend

#### 1. Installation initiale

```bash
# Cloner le projet
git clone <url-du-repo>
cd agriculture/backend

# Copier la configuration
cp .env.example .env

# Démarrer les services
docker compose up -d

# Vérifier
curl http://localhost:3000/api/v1
```

#### 2. Utilisation quotidienne

```bash
# Matin : démarrer les services
docker compose up -d

# Vérifier l'état
docker ps

# Soir : arrêter (optionnel)
docker compose stop
```

#### 3. Après un git pull (mise à jour du backend)

```bash
# Mettre à jour et reconstruire
docker compose up -d --build
```

### Partage de données

Pour partager une base de données avec des données de test :

```bash
# Export de la base
docker exec agrismart_postgres pg_dump -U postgres agrismart_ci > backup.sql

# Import (sur une autre machine)
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < backup.sql
```

---

## 📁 Structure du Projet

```
backend/
├── src/
│   ├── config/           # Configuration (database, env)
│   │   ├── database.js   # Connexion PostgreSQL
│   │   └── index.js      # Variables de configuration
│   │
│   ├── controllers/      # Logique métier
│   │   ├── authController.js
│   │   ├── usersController.js
│   │   ├── parcellesController.js
│   │   ├── capteursController.js
│   │   ├── mesuresController.js
│   │   ├── alertesController.js
│   │   ├── culturesController.js
│   │   ├── maladiesController.js
│   │   ├── recommandationsController.js
│   │   ├── marketplaceController.js
│   │   ├── formationsController.js
│   │   └── messagesController.js
│   │
│   ├── middlewares/      # Middlewares Express
│   │   ├── auth.js       # JWT & authentification
│   │   ├── rbac.js       # Contrôle d'accès par rôle
│   │   ├── validation.js # Validation des requêtes
│   │   └── errorHandler.js
│   │
│   ├── routes/           # Routes API
│   │   ├── index.js      # Agrégateur de routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── parcelles.js
│   │   └── ...
│   │
│   ├── services/         # Services externes
│   │   ├── smsService.js     # Twilio SMS/WhatsApp
│   │   ├── emailService.js   # Nodemailer
│   │   ├── alerteService.js  # Génération d'alertes
│   │   ├── notificationService.js
│   │   └── weatherService.js
│   │
│   ├── database/
│   │   └── schema.sql    # Schéma PostgreSQL complet
│   │
│   ├── utils/
│   │   └── logger.js     # Winston logging
│   │
│   └── server.js         # Point d'entrée
│
├── docs/
│   ├── API_DOCUMENTATION.md
│   └── GUIDE_UTILISATION.md
│
├── uploads/              # Fichiers uploadés
├── logs/                 # Logs applicatifs
│
├── .env.example          # Template de configuration
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── package.json
```

---

## 🛠️ Commandes Utiles

### Docker

```bash
# Démarrer tous les services
docker compose up -d

# Reconstruire l'API après modifications
docker compose up -d --build api

# Voir les logs de l'API
docker logs -f agrismart_api

# Voir les logs de tous les services
docker compose logs -f

# Entrer dans le conteneur PostgreSQL
docker exec -it agrismart_postgres psql -U postgres -d agrismart_ci

# Entrer dans le conteneur API
docker exec -it agrismart_api sh

# Redémarrer un service
docker compose restart api

# État des conteneurs
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Nettoyer (attention: supprime les données!)
docker compose down -v
```

### Base de données

```bash
# Appliquer le schéma
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < src/database/schema.sql

# Exporter la base
docker exec agrismart_postgres pg_dump -U postgres agrismart_ci > backup.sql

# Requête SQL directe
docker exec -it agrismart_postgres psql -U postgres -d agrismart_ci -c "SELECT * FROM users;"
```

### NPM (développement local)

```bash
npm install           # Installer les dépendances
npm run dev           # Démarrer en mode développement
npm start             # Démarrer en mode production
npm test              # Lancer les tests
npm run lint          # Vérifier le code
```

---

## 🔧 Dépannage

### L'API ne démarre pas

```bash
# Vérifier les logs
docker logs agrismart_api

# Problèmes courants :
# - Base de données non prête : attendre quelques secondes
# - Erreur de schéma : réappliquer le schéma SQL
# - Variables d'environnement manquantes : vérifier .env
```

### Erreur "Route.get() requires a callback"

Le contrôleur a une méthode manquante. Vérifier que toutes les méthodes exportées existent.

### Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est démarré
docker ps | grep postgres

# Vérifier la connexion
docker exec -it agrismart_postgres psql -U postgres -c "SELECT 1"

# Vérifier les credentials dans .env
```

### Erreur de colonnes inexistantes

Le schéma n'a pas été appliqué ou a été modifié. Réappliquer :

```bash
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < src/database/schema.sql
```

### Fichiers macOS (._*) bloquent Docker

```bash
# Nettoyer les fichiers métadonnées macOS
find . -name "._*" -delete
find . -name ".DS_Store" -delete

# Puis reconstruire
docker compose up -d --build
```

### Port déjà utilisé

```bash
# Identifier le processus
lsof -i :3000

# Tuer le processus ou changer le port dans .env
```

### Redis ne se connecte pas

```bash
# Vérifier Redis
docker logs agrismart_redis

# L'application fonctionne sans Redis (cache désactivé)
```

---

## 📞 Support

- **Documentation API** : `docs/API_DOCUMENTATION.md`
- **Email** : dev@agrismart.ci
- **Issues GitHub** : <url-du-repo>/issues

---

## 🔄 Mise à jour

Après un `git pull` avec des changements backend :

```bash
# Reconstruire et redémarrer
docker compose down
docker compose up -d --build

# Si le schéma a changé
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < src/database/schema.sql
```

---

Bon développement ! 🌱
