# ❓ FAQ et Dépannage - AgriSmart CI

## Table des Matières

1. [Questions Fréquentes](#questions-fréquentes)
2. [Problèmes d'Installation](#problèmes-dinstallation)
3. [Problèmes de Base de Données](#problèmes-de-base-de-données)
4. [Problèmes d'API](#problèmes-dapi)
5. [Problèmes d'Authentification](#problèmes-dauthentification)
6. [Problèmes Docker](#problèmes-docker)
7. [Performances](#performances)
8. [Contact Support](#contact-support)

---

## Questions Fréquentes

### Q: Comment obtenir le code OTP pour les tests ?

**R:** En mode développement, le code OTP est retourné dans la réponse de l'API et également stocké en base. Pour le récupérer :

```bash
# Via l'API (mode dev)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"telephone": "+2250701234567", "nom": "Test", "prenoms": "User", "password": "Test123!"}'

# Récupérer depuis la BDD
docker exec agrismart_postgres psql -U postgres -d agrismart_ci \
  -c "SELECT code FROM otp_codes WHERE user_id = 'uuid' ORDER BY created_at DESC LIMIT 1;"
```

---

### Q: Quels sont les rôles disponibles ?

**R:** 4 rôles sont définis :

| Rôle | Description | Permissions |
|------|-------------|-------------|
| `producteur` | Agriculteur | Ses ressources propres |
| `conseiller` | Agent technique | Lecture + recommandations région |
| `admin` | Administrateur | Accès complet |
| `partenaire` | ONG/Ministère | Statistiques |

---

### Q: Comment ajouter un nouvel utilisateur admin ?

**R:** Via SQL directement :

```sql
-- Créer un admin
INSERT INTO users (nom, prenoms, telephone, password_hash, role, status)
VALUES ('Admin', 'System', '+2250700000000', 
        '$2b$12$xxxxx', -- Hash bcrypt du mot de passe
        'admin', 'actif');
```

Ou via l'API en modifiant le rôle après inscription.

---

### Q: Comment accéder à PgAdmin ?

**R:**
- URL: http://localhost:5050
- Email: `admin@agrismart.ci`
- Mot de passe: `admin123`

Pour ajouter le serveur PostgreSQL :
- Host: `postgres` (nom du service Docker)
- Port: `5432`
- Database: `agrismart_ci`
- User: `postgres`
- Password: `agrismart_secure_2024`

---

### Q: Comment voir les logs de l'API ?

**R:**

```bash
# Logs en temps réel
docker compose logs -f api

# Derniers 100 logs
docker compose logs --tail=100 api

# Logs d'un service spécifique
docker logs agrismart_api
```

---

### Q: Quels types de capteurs sont supportés ?

**R:** 6 types :

| Type | Code | Unité | Description |
|------|------|-------|-------------|
| Humidité sol | `humidite` | % | Pourcentage 0-100 |
| Température | `temperature` | °C | -10 à 60°C |
| pH sol | `ph` | - | 0 à 14 |
| NPK | `npk` | mg/kg | Nutriments |
| Météo | `meteo` | multiple | Station météo |
| Caméra | `camera` | - | Images |

---

### Q: Comment modifier les seuils d'alerte ?

**R:** Via la table `configuration` :

```sql
-- Voir les seuils actuels
SELECT * FROM configuration WHERE cle LIKE 'seuil%';

-- Modifier un seuil
UPDATE configuration SET valeur = '15' WHERE cle = 'seuil_humidite_critique_bas';
```

---

## Problèmes d'Installation

### Erreur: "npm: command not found"

**Cause:** Node.js n'est pas installé ou pas dans le PATH.

**Solution:**

```bash
# macOS avec Homebrew
brew install node

# Linux
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérifier
node --version
npm --version
```

---

### Erreur: "docker: command not found"

**Cause:** Docker n'est pas installé.

**Solution:**
1. Télécharger Docker Desktop depuis https://docker.com
2. Installer et lancer Docker Desktop
3. Vérifier : `docker --version`

---

### Erreur: "EACCES: permission denied"

**Cause:** Problème de permissions npm.

**Solution:**

```bash
# Reconfigurer npm pour éviter sudo
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

---

## Problèmes de Base de Données

### Erreur: "FATAL: database 'agrismart_ci' does not exist"

**Cause:** La base n'a pas été créée.

**Solution:**

```bash
# Recréer avec Docker
docker compose down -v
docker compose up -d

# Ou manuellement
docker exec agrismart_postgres createdb -U postgres agrismart_ci
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < src/database/schema.sql
```

---

### Erreur: "relation 'users' does not exist"

**Cause:** Les tables n'ont pas été créées.

**Solution:**

```bash
# Réinitialiser le schéma
docker exec -i agrismart_postgres psql -U postgres -d agrismart_ci < src/database/schema.sql
```

---

### Erreur: "invalid input value for enum"

**Cause:** Valeur non autorisée pour un type ENUM.

**Solution:** Vérifier les valeurs autorisées :

```sql
-- Voir les types ENUM
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'soil_type'::regtype;

-- Types de sol valides: argileux, sablonneux, limono_argileux, limoneux, argilo_sableux
-- Types de capteurs: humidite, temperature, ph, npk, meteo, camera
-- Niveaux d'alerte: info, important, critique
```

---

### Erreur: "connection refused" PostgreSQL

**Cause:** PostgreSQL n'est pas démarré ou mauvaise configuration.

**Solution:**

```bash
# Vérifier que PostgreSQL tourne
docker compose ps

# Si le conteneur n'est pas là
docker compose up -d postgres

# Vérifier la connexion
docker exec agrismart_postgres pg_isready -U postgres
```

---

### Erreur: "too many connections"

**Cause:** Pool de connexions épuisé.

**Solution:**

```bash
# Voir les connexions actives
docker exec agrismart_postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Terminer les connexions inactives
docker exec agrismart_postgres psql -U postgres -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND datname = 'agrismart_ci';"
```

---

## Problèmes d'API

### Erreur 401: "Token manquant"

**Cause:** Header Authorization absent.

**Solution:**

```bash
# Ajouter le header
curl http://localhost:3000/api/v1/parcelles \
  -H "Authorization: Bearer VOTRE_TOKEN_JWT"
```

---

### Erreur 401: "Token invalide ou expiré"

**Cause:** Token JWT expiré ou mal formé.

**Solution:**
1. Se reconnecter pour obtenir un nouveau token
2. Utiliser le refresh token si disponible

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "votre_refresh_token"}'
```

---

### Erreur 403: "Accès refusé pour ce rôle"

**Cause:** L'utilisateur n'a pas les permissions requises.

**Solution:** Vérifier le rôle de l'utilisateur :

```sql
SELECT role FROM users WHERE id = 'uuid-utilisateur';
```

---

### Erreur 422: "Données invalides"

**Cause:** Validation échouée.

**Solution:** Vérifier le format des données selon la documentation API. Exemples courants :

```json
// Types de sol valides
"type_sol": "argileux" | "sablonneux" | "limono_argileux" | "limoneux" | "argilo_sableux"

// Types de capteurs valides  
"type": "humidite" | "temperature" | "ph" | "npk" | "meteo" | "camera"

// Format téléphone
"telephone": "+2250701234567"  // Avec indicatif +225
```

---

### Erreur 500: "Erreur interne du serveur"

**Cause:** Erreur côté serveur (BDD, code, etc.)

**Solution:**
1. Vérifier les logs : `docker compose logs -f api`
2. Vérifier que tous les services sont UP : `docker compose ps`
3. Redémarrer si nécessaire : `docker compose restart api`

---

## Problèmes d'Authentification

### OTP non reçu par SMS

**Cause:** Twilio non configuré ou crédit épuisé.

**Solution en développement:**

```bash
# Le code OTP est dans la BDD
docker exec agrismart_postgres psql -U postgres -d agrismart_ci \
  -c "SELECT code, expires_at FROM otp_codes ORDER BY created_at DESC LIMIT 1;"
```

---

### Compte verrouillé

**Cause:** Trop de tentatives de connexion échouées (5 max).

**Solution:**

```sql
-- Déverrouiller le compte
UPDATE users 
SET tentatives_connexion = 0, compte_verrouille_jusqu_a = NULL 
WHERE telephone = '+2250701234567';
```

---

### OTP expiré

**Cause:** Le code a plus de 10 minutes.

**Solution:** Renvoyer un nouveau code :

```bash
curl -X POST http://localhost:3000/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"telephone": "+2250701234567"}'
```

---

## Problèmes Docker

### Conteneur qui redémarre en boucle

**Cause:** Erreur au démarrage (config, dépendances).

**Solution:**

```bash
# Voir les logs d'erreur
docker logs agrismart_api --tail=50

# Causes courantes:
# - .env manquant ou incorrect
# - PostgreSQL pas prêt (depends_on ne suffit pas toujours)
# - Port déjà utilisé
```

---

### "port is already allocated"

**Cause:** Un autre service utilise le port.

**Solution:**

```bash
# Trouver le processus
lsof -i :3000  # ou :5432, :6379, :5050

# Tuer le processus
kill -9 <PID>

# Ou changer le port dans docker-compose.yml
```

---

### Volumes corrompus

**Cause:** Arrêt brutal, disque plein.

**Solution:**

```bash
# Supprimer tous les volumes et recréer
docker compose down -v
docker compose up -d

# ⚠️ Attention: cela supprime toutes les données!
```

---

### Images obsolètes

**Cause:** Changements dans le code non pris en compte.

**Solution:**

```bash
# Reconstruire les images
docker compose build --no-cache
docker compose up -d
```

---

## Performances

### API lente

**Causes possibles:**
1. Pas d'index sur les colonnes filtrées
2. Requêtes N+1
3. Cache Redis non utilisé

**Solutions:**

```bash
# Vérifier les requêtes lentes
docker exec agrismart_postgres psql -U postgres -d agrismart_ci \
  -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Vérifier les index
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "\di"

# Vérifier Redis
docker exec agrismart_redis redis-cli INFO stats
```

---

### Base de données lente

**Solution:**

```bash
# Vacuum et analyse
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "VACUUM ANALYZE;"

# Voir la taille des tables
docker exec agrismart_postgres psql -U postgres -d agrismart_ci -c "
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;"
```

---

### Mémoire insuffisante

**Solution:**

```bash
# Vérifier l'utilisation mémoire Docker
docker stats

# Augmenter la mémoire dans docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 1G
```

---

## Contact Support

### Avant de contacter le support

1. ✅ Vérifier les logs : `docker compose logs -f`
2. ✅ Vérifier que tous les services sont UP : `docker compose ps`
3. ✅ Consulter cette FAQ
4. ✅ Reproduire le problème avec les étapes exactes

### Informations à fournir

- Version du projet (commit ou tag)
- Système d'exploitation
- Version de Docker
- Logs d'erreur complets
- Étapes pour reproduire

### Canaux de support

- 📧 Email: support@agrismart.ci
- 💬 WhatsApp: +225 07 01 23 45 67
- 📖 Documentation: https://docs.agrismart.ci
- 🐛 Issues GitHub: https://github.com/agrismart/backend/issues

---

*Dernière mise à jour: 4 décembre 2025*
