# 📚 Documentation API AgriSmart CI

## 🌐 Informations Générales

**Base URL:** `http://localhost:3000/api/v1`

**Headers requis pour toutes les requêtes authentifiées:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 🔐 Authentification

### 1. Inscription
**POST** `/auth/register`

Crée un nouveau compte utilisateur.

**Corps de la requête:**
```json
{
  "email": "producteur@agrismart.ci",
  "telephone": "+2250707070707",
  "password": "MotDePasse123!",
  "nom": "Kouassi",
  "prenoms": "Jean-Baptiste",
  "langue_preferee": "fr"
}
```

**Réponse (201):**
```json
{
  "success": true,
  "message": "Inscription réussie. Un code de vérification a été envoyé.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "producteur@agrismart.ci",
      "telephone": "+2250707070707",
      "nom": "Kouassi",
      "prenom": "Jean-Baptiste"
    }
  }
}
```

**Règles de validation:**
- `email`: Format email valide, max 255 caractères
- `telephone`: Format `+225XXXXXXXXXX` ou `XXXXXXXXXX`
- `password`: Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
- `nom`: 2-100 caractères
- `prenoms`: 2-100 caractères
- `langue_preferee`: `fr`, `dioula`, `baoule`, `bete`

---

### 2. Connexion (Étape 1)
**POST** `/auth/login`

Envoie un code OTP par SMS.

**Corps de la requête:**
```json
{
  "identifier": "producteur@agrismart.ci",
  "password": "MotDePasse123!"
}
```

**Réponse (200):**
```json
{
  "success": true,
  "message": "Code de vérification envoyé",
  "data": {
    "userId": "uuid",
    "maskedPhone": "+225****0707"
  }
}
```

---

### 3. Vérification OTP (Étape 2)
**POST** `/auth/verify-otp`

Valide le code OTP et retourne les tokens.

**Corps de la requête:**
```json
{
  "identifier": "producteur@agrismart.ci",
  "otp": "123456"
}
```

**Réponse (200):**
```json
{
  "success": true,
  "message": "Connexion réussie",
  "data": {
    "user": {
      "id": "uuid",
      "email": "producteur@agrismart.ci",
      "telephone": "+2250707070707",
      "nom": "Kouassi",
      "prenom": "Jean-Baptiste",
      "role": "producteur",
      "langue": "fr"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 4. Rafraîchir le Token
**POST** `/auth/refresh`

**Corps de la requête:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Réponse (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "nouveau_token..."
  }
}
```

---

### 5. Déconnexion
**POST** `/auth/logout` 🔒

**Réponse (200):**
```json
{
  "success": true,
  "message": "Déconnexion réussie"
}
```

---

### 6. Mot de passe oublié
**POST** `/auth/forgot-password`

```json
{
  "identifier": "producteur@agrismart.ci"
}
```

---

### 7. Réinitialiser le mot de passe
**POST** `/auth/reset-password`

```json
{
  "identifier": "producteur@agrismart.ci",
  "otp": "123456",
  "newPassword": "NouveauMotDePasse123!"
}
```

---

### 8. Profil utilisateur
**GET** `/auth/me` 🔒

Retourne les informations de l'utilisateur connecté.

**Réponse (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "producteur@agrismart.ci",
    "telephone": "+2250707070707",
    "nom": "Kouassi",
    "prenoms": "Jean-Baptiste",
    "role": "producteur",
    "status": "actif",
    "langue_preferee": "fr",
    "photo_url": null,
    "adresse": null,
    "localisation": null,
    "created_at": "2024-12-04T08:00:00.000Z",
    "derniere_connexion": "2024-12-04T08:00:00.000Z"
  }
}
```

---

### 9. Mettre à jour le profil
**PUT** `/auth/me` 🔒

```json
{
  "nom": "Nouveau Nom",
  "prenoms": "Nouveaux Prénoms",
  "langue_preferee": "baoule",
  "adresse": "Abidjan, Cocody"
}
```

---

### 10. Changer le mot de passe
**PUT** `/auth/change-password` 🔒

```json
{
  "currentPassword": "AncienMotDePasse123!",
  "newPassword": "NouveauMotDePasse456!"
}
```

---

## 👥 Utilisateurs (Admin)

### 1. Liste des utilisateurs
**GET** `/users` 🔒 Admin

**Paramètres de requête:**
- `page`: Numéro de page (défaut: 1)
- `limit`: Éléments par page (défaut: 20, max: 100)
- `role`: Filtrer par rôle (`producteur`, `conseiller`, `admin`, `partenaire`)
- `status`: Filtrer par statut (`actif`, `en_attente`, `suspendu`)
- `search`: Recherche par nom, prénom, email ou téléphone

**Exemple:** `GET /users?role=producteur&status=actif&page=1&limit=20`

---

### 2. Statistiques utilisateurs
**GET** `/users/stats` 🔒 Admin

**Réponse (200):**
```json
{
  "success": true,
  "data": {
    "total": 60,
    "producteurs": 50,
    "conseillers": 5,
    "admins": 3,
    "partenaires": 2,
    "actifs": 55,
    "en_attente": 3,
    "suspendus": 2,
    "actifs_7j": 40,
    "nouveaux_30j": 10
  }
}
```

---

### 3. Liste des producteurs
**GET** `/users/producteurs` 🔒 Admin/Conseiller

Inclut le nombre de parcelles et la superficie totale.

---

### 4. Détail utilisateur
**GET** `/users/:id` 🔒 Admin

---

### 5. Créer un utilisateur
**POST** `/users` 🔒 Admin

```json
{
  "email": "nouveau@agrismart.ci",
  "telephone": "+2250909090909",
  "password": "MotDePasse123!",
  "nom": "Nouveau",
  "prenoms": "Utilisateur",
  "role": "conseiller",
  "langue_preferee": "fr"
}
```

---

### 6. Modifier un utilisateur
**PUT** `/users/:id` 🔒 Admin

---

### 7. Changer le statut
**PATCH** `/users/:id/status` 🔒 Admin

```json
{
  "status": "suspendu"
}
```

---

### 8. Supprimer un utilisateur
**DELETE** `/users/:id` 🔒 Admin

Soft delete (change le statut en "supprimé")

---

## 🌾 Parcelles

### 1. Liste des parcelles
**GET** `/parcelles` 🔒

**Paramètres:**
- `page`, `limit`: Pagination
- `proprietaire_id`: Filtrer par propriétaire
- `type_sol`: Filtrer par type de sol

---

### 2. Détail d'une parcelle
**GET** `/parcelles/:id` 🔒

Inclut: stations, capteurs, culture active, statistiques.

---

### 3. Créer une parcelle
**POST** `/parcelles` 🔒

```json
{
  "nom": "Parcelle Cacao Nord",
  "superficie": 5.5,
  "latitude": 6.8185,
  "longitude": -5.2757,
  "adresse": "Daloa, Zone rurale",
  "type_sol": "argileux"
}
```

**Types de sol:** `argileux`, `sableux`, `limoneux`, `calcaire`, `humifere`

---

### 4. Modifier une parcelle
**PUT** `/parcelles/:id` 🔒

---

### 5. Supprimer une parcelle
**DELETE** `/parcelles/:id` 🔒

---

### 6. Statistiques d'une parcelle
**GET** `/parcelles/:id/stats` 🔒

```json
{
  "success": true,
  "data": {
    "superficie": 5.5,
    "nb_stations": 3,
    "nb_capteurs": 12,
    "culture_active": "Cacao",
    "derniere_mesure": "2024-12-04T08:00:00.000Z",
    "alertes_actives": 2,
    "moyennes_24h": {
      "temperature": 28.5,
      "humidite": 65,
      "luminosite": 45000
    }
  }
}
```

---

## 📡 Capteurs

### 1. Liste des capteurs
**GET** `/capteurs` 🔒

---

### 2. Créer une station
**POST** `/capteurs/stations` 🔒

```json
{
  "nom": "Station Nord",
  "parcelle_id": "uuid",
  "latitude": 6.8185,
  "longitude": -5.2757
}
```

---

### 3. Créer un capteur
**POST** `/capteurs` 🔒

```json
{
  "station_id": "uuid",
  "type": "humidite_sol",
  "modele": "SMTEC RS485",
  "numero_serie": "SN-2024-001"
}
```

**Types:** `temperature`, `humidite_sol`, `humidite_air`, `luminosite`, `pluviometrie`, `ph_sol`, `niveau_eau`

---

### 4. État des capteurs
**GET** `/capteurs/status` 🔒

---

### 5. Configurer un capteur
**PATCH** `/capteurs/:id/config` 🔒

```json
{
  "seuil_min": 30,
  "seuil_max": 80,
  "frequence_lecture": 300
}
```

---

## 📊 Mesures

### 1. Envoyer une mesure (IoT)
**POST** `/mesures`

```json
{
  "capteur_id": "uuid",
  "valeur": 65.5,
  "unite": "%",
  "timestamp": "2024-12-04T08:00:00.000Z"
}
```

---

### 2. Envoi groupé (IoT)
**POST** `/mesures/batch`

```json
{
  "mesures": [
    {"capteur_id": "uuid1", "valeur": 65.5, "unite": "%"},
    {"capteur_id": "uuid2", "valeur": 28.3, "unite": "°C"}
  ]
}
```

---

### 3. Historique des mesures
**GET** `/mesures` 🔒

**Paramètres:**
- `capteur_id`: Filtrer par capteur
- `parcelle_id`: Filtrer par parcelle
- `type`: Type de capteur
- `date_debut`, `date_fin`: Période
- `page`, `limit`: Pagination

---

### 4. Dernières mesures
**GET** `/mesures/latest` 🔒

Retourne les dernières mesures par capteur.

---

### 5. Statistiques
**GET** `/mesures/stats` 🔒

```json
{
  "success": true,
  "data": {
    "temperature": {"avg": 28.5, "min": 22, "max": 35},
    "humidite_sol": {"avg": 62, "min": 45, "max": 78}
  }
}
```

---

## 🚨 Alertes

### 1. Liste des alertes
**GET** `/alertes` 🔒

**Paramètres:**
- `niveau`: `info`, `warning`, `critical`
- `type`: Type d'alerte
- `lue`: `true`/`false`
- `resolue`: `true`/`false`
- `parcelle_id`: Filtrer par parcelle

---

### 2. Alertes non lues
**GET** `/alertes/unread` 🔒

---

### 3. Créer une alerte (système)
**POST** `/alertes`

```json
{
  "user_id": "uuid",
  "parcelle_id": "uuid",
  "type": "humidite_basse",
  "niveau": "warning",
  "titre": "Humidité critique",
  "message": "L'humidité du sol est descendue à 25%"
}
```

---

### 4. Marquer comme lue
**PATCH** `/alertes/:id/read` 🔒

---

### 5. Résoudre une alerte
**PATCH** `/alertes/:id/resolve` 🔒

---

### 6. Statistiques alertes
**GET** `/alertes/stats` 🔒

---

## 🌱 Cultures

### 1. Liste des cultures
**GET** `/cultures`

Types de cultures disponibles avec informations agronomiques.

---

### 2. Détail d'une culture
**GET** `/cultures/:id`

Inclut: besoins en eau, température optimale, cycle de croissance.

---

### 3. Créer une culture (admin)
**POST** `/cultures` 🔒 Admin

```json
{
  "nom": "Cacao",
  "nom_scientifique": "Theobroma cacao",
  "description": "Culture principale de Côte d'Ivoire...",
  "cycle_jours": 365,
  "temperature_min": 18,
  "temperature_max": 32,
  "humidite_min": 70,
  "humidite_max": 100,
  "ph_min": 5.0,
  "ph_max": 7.5
}
```

---

### 4. Plantations actives
**GET** `/cultures/plantations` 🔒

---

### 5. Créer une plantation
**POST** `/cultures/plantations` 🔒

```json
{
  "parcelle_id": "uuid",
  "culture_id": "uuid",
  "date_plantation": "2024-01-15",
  "date_recolte_prevue": "2024-12-15",
  "quantite_plants": 1000
}
```

---

## 🦠 Maladies

### 1. Liste des maladies
**GET** `/maladies`

---

### 2. Détail d'une maladie
**GET** `/maladies/:id`

Inclut: symptômes, traitements recommandés.

---

### 3. Créer une maladie (admin)
**POST** `/maladies` 🔒 Admin

---

### 4. Signaler une maladie
**POST** `/maladies/signalements` 🔒

```json
{
  "parcelle_id": "uuid",
  "maladie_id": "uuid",
  "description": "Taches noires sur les feuilles",
  "photos": ["url1", "url2"]
}
```

---

### 5. Détection IA
**POST** `/maladies/detect` 🔒

Upload d'image pour détection automatique.

```
Content-Type: multipart/form-data
photo: <fichier image>
```

---

## 💡 Recommandations

### 1. Liste des recommandations
**GET** `/recommandations` 🔒

---

### 2. Recommandations par parcelle
**GET** `/recommandations/parcelle/:parcelleId` 🔒

---

### 3. Créer une recommandation (conseiller)
**POST** `/recommandations` 🔒 Conseiller/Admin

```json
{
  "parcelle_id": "uuid",
  "type": "irrigation",
  "titre": "Augmenter l'arrosage",
  "contenu": "Suite aux mesures d'humidité basse...",
  "priorite": "haute"
}
```

---

### 4. Marquer comme appliquée
**PATCH** `/recommandations/:id/apply` 🔒

---

## 🛒 Marketplace

### 1. Liste des produits
**GET** `/marketplace`

**Paramètres:**
- `categorie`: Filtrer par catégorie
- `region_id`: Filtrer par région
- `prix_min`, `prix_max`: Fourchette de prix
- `search`: Recherche texte

---

### 2. Détail d'un produit
**GET** `/marketplace/:id`

---

### 3. Créer une annonce
**POST** `/marketplace` 🔒

```json
{
  "titre": "Cacao Grade 1",
  "description": "Fèves de cacao premium...",
  "categorie": "recoltes",
  "prix": 1500,
  "unite_prix": "kg",
  "quantite_disponible": 500,
  "region_id": "uuid",
  "photos": ["url1", "url2"]
}
```

---

### 4. Modifier une annonce
**PUT** `/marketplace/:id` 🔒

---

### 5. Mes annonces
**GET** `/marketplace/mes-annonces` 🔒

---

### 6. Contacter le vendeur
**POST** `/marketplace/:id/contact` 🔒

```json
{
  "message": "Je suis intéressé par votre offre..."
}
```

---

## 📚 Formations

### 1. Liste des formations
**GET** `/formations`

**Paramètres:**
- `type`: `video`, `article`, `guide`
- `categorie`: Catégorie
- `niveau`: `debutant`, `intermediaire`, `avance`

---

### 2. Détail d'une formation
**GET** `/formations/:id`

---

### 3. Créer une formation (admin)
**POST** `/formations` 🔒 Admin

```json
{
  "titre": "Les bases de la cacaoculture",
  "description": "Formation complète...",
  "type": "video",
  "categorie": "culture",
  "niveau": "debutant",
  "duree_minutes": 45,
  "contenu_url": "https://...",
  "langue": "fr"
}
```

---

### 4. Suivre une formation
**POST** `/formations/:id/progress` 🔒

```json
{
  "progression": 75,
  "complete": false
}
```

---

### 5. Ma progression
**GET** `/formations/progression` 🔒

---

## 💬 Messages

### 1. Mes conversations
**GET** `/messages` 🔒

---

### 2. Détail d'une conversation
**GET** `/messages/conversations/:userId` 🔒

---

### 3. Envoyer un message
**POST** `/messages` 🔒

```json
{
  "destinataire_id": "uuid",
  "contenu": "Bonjour, j'aurais besoin de conseils..."
}
```

---

### 4. Marquer comme lu
**PATCH** `/messages/:id/read` 🔒

---

### 5. Messages non lus
**GET** `/messages/unread` 🔒

---

## 📊 WebSocket (Temps réel)

**URL:** `ws://localhost:3000`

### Événements

**Connexion:**
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'votre_access_token' }
});
```

**Événements reçus:**
- `nouvelle_mesure`: Nouvelle mesure d'un capteur
- `nouvelle_alerte`: Nouvelle alerte
- `alerte_resolue`: Alerte marquée comme résolue
- `nouveau_message`: Nouveau message reçu

**Exemple:**
```javascript
socket.on('nouvelle_alerte', (data) => {
  console.log('Alerte:', data);
  // { id, type, niveau, titre, message, parcelle_id }
});
```

---

## 🔐 Codes d'erreur

| Code | Signification |
|------|---------------|
| 400 | Requête invalide (données manquantes/incorrectes) |
| 401 | Non authentifié (token manquant/expiré) |
| 403 | Accès refusé (permissions insuffisantes) |
| 404 | Ressource non trouvée |
| 409 | Conflit (données dupliquées) |
| 422 | Erreur de validation |
| 429 | Trop de requêtes (rate limiting) |
| 500 | Erreur serveur |

**Format des erreurs:**
```json
{
  "success": false,
  "message": "Description de l'erreur",
  "code": "CODE_ERREUR",
  "errors": [
    {"field": "email", "message": "Email invalide"}
  ]
}
```

---

## 📝 Rôles et permissions

| Ressource | Producteur | Conseiller | Admin | Partenaire |
|-----------|------------|------------|-------|------------|
| Parcelles | Ses propres | Lecture | Tout | - |
| Capteurs | Ses propres | Lecture | Tout | - |
| Alertes | Ses propres | Lecture | Tout | - |
| Recommandations | Lecture | Créer | Tout | - |
| Marketplace | Créer/Modifier | Lecture | Tout | Créer/Modifier |
| Formations | Lecture | Créer | Tout | - |
| Utilisateurs | - | Producteurs | Tout | - |

---

## 🔄 Pagination

Toutes les listes supportent la pagination:

```
GET /endpoint?page=1&limit=20
```

**Réponse:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 📞 Support

Pour toute question technique:
- Email: dev@agrismart.ci
- Documentation complète: https://docs.agrismart.ci
