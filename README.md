# AgriSmart CI - Backend API

> Système Agricole Intelligent pour la Côte d'Ivoire

## 📋 Description

AgriSmart CI est une plateforme agricole intelligente conçue pour améliorer la productivité agricole en Côte d'Ivoire. Elle intègre des capteurs IoT, l'intelligence artificielle pour la détection de maladies, et fournit des recommandations personnalisées aux producteurs.

## 🚀 Fonctionnalités

- **Gestion des Parcelles** - Suivi des parcelles agricoles avec géolocalisation
- **Capteurs IoT** - Intégration LoRaWAN/4G pour la collecte de données en temps réel
- **Alertes Intelligentes** - Notifications automatiques basées sur les seuils configurés
- **Détection de Maladies** - Analyse d'images par IA pour identifier les pathologies
- **Recommandations** - Suggestions personnalisées basées sur les conditions météo et sol
- **Marketplace** - Plateforme de vente de produits agricoles entre producteurs
- **Formations** - Modules de formation en ligne pour les producteurs
- **Messagerie** - Communication entre producteurs et conseillers agricoles

## 🛠️ Technologies

- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Base de données**: PostgreSQL 15
- **Cache**: Redis 7
- **Temps réel**: Socket.IO
- **Authentification**: JWT + OTP
- **SMS**: Twilio
- **Météo**: OpenWeatherMap

## 📦 Installation

### Prérequis

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optionnel)

### Installation locale

```bash
# Cloner le repository
git clone https://github.com/agrismart/backend.git
cd backend

# Installer les dépendances
npm install

# Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Créer la base de données
createdb agrismart
psql -d agrismart -f src/database/schema.sql

# Démarrer en mode développement
npm run dev
```

### Installation avec Docker

```bash
# Développement (avec PgAdmin)
docker-compose --profile dev up -d

# Production (avec Nginx)
docker-compose --profile production up -d
```

## ⚙️ Configuration

Créez un fichier `.env` basé sur `.env.example`:

```env
# Serveur
NODE_ENV=development
PORT=3000

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agrismart
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Twilio (SMS/WhatsApp)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Météo
OPENWEATHER_API_KEY=your_api_key
```

## 📚 API Documentation

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/verify-otp` | Vérification OTP |
| POST | `/api/auth/refresh` | Rafraîchir le token |
| POST | `/api/auth/logout` | Déconnexion |

### Parcelles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/parcelles` | Liste des parcelles |
| POST | `/api/parcelles` | Créer une parcelle |
| GET | `/api/parcelles/:id` | Détails d'une parcelle |
| PUT | `/api/parcelles/:id` | Modifier une parcelle |
| DELETE | `/api/parcelles/:id` | Supprimer une parcelle |

### Capteurs & Mesures

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/capteurs` | Liste des capteurs |
| POST | `/api/mesures/ingest` | Ingestion données IoT |
| GET | `/api/mesures/parcelle/:id` | Mesures d'une parcelle |

### Alertes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/alertes` | Liste des alertes |
| PUT | `/api/alertes/:id/acknowledge` | Acquitter une alerte |

### Marketplace

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/marketplace/produits` | Liste des produits |
| POST | `/api/marketplace/produits` | Publier un produit |
| POST | `/api/marketplace/commandes` | Passer une commande |

## 🔐 Rôles et Permissions

| Rôle | Description | Permissions |
|------|-------------|-------------|
| `producteur` | Agriculteur | CRUD sur ses propres ressources |
| `conseiller` | Conseiller agricole | Lecture + Recommandations |
| `admin` | Administrateur | Accès complet |
| `partenaire` | Partenaire externe | Accès limité API |

## 🧪 Tests

```bash
# Exécuter tous les tests
npm test

# Tests avec couverture
npm run test:coverage

# Tests en mode watch
npm run test:watch
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/api/health
```

### Logs

Les logs sont stockés dans le dossier `logs/`:
- `error.log` - Erreurs uniquement
- `combined.log` - Tous les logs

## 🚀 Déploiement

### Production

1. Configurer les variables d'environnement de production
2. Générer les certificats SSL
3. Lancer avec Docker Compose:

```bash
docker-compose --profile production up -d
```

### Scripts utiles

```bash
# Démarrer
npm start

# Développement avec hot-reload
npm run dev

# Linter
npm run lint

# Migration base de données
npm run db:migrate

# Seed données de test
npm run db:seed
```

## 📁 Structure du Projet

```
backend/
├── src/
│   ├── config/          # Configuration
│   ├── controllers/     # Contrôleurs
│   ├── database/        # Schéma SQL
│   ├── middlewares/     # Middlewares Express
│   ├── routes/          # Routes API
│   ├── services/        # Services métier
│   ├── utils/           # Utilitaires
│   └── server.js        # Point d'entrée
├── uploads/             # Fichiers uploadés
├── logs/                # Logs application
├── docker-compose.yml   # Configuration Docker
├── Dockerfile           # Image Docker
└── package.json
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajouter nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 📞 Support

- Email: support@agrismart.ci
- Documentation: https://docs.agrismart.ci
- Issues: https://github.com/agrismart/backend/issues

---

Développé avec ❤️ pour les agriculteurs ivoiriens 🇨🇮
