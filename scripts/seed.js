/**
 * Script de Seed - Données de démonstration
 * AgriSmart CI - Système Agricole Intelligent
 */

const db = require('./src/config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('🌱 Démarrage du seed...\n');

  try {
    // Créer les utilisateurs de démonstration
    console.log('👤 Création des utilisateurs...');
    
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const users = [
      {
        id: uuidv4(),
        telephone: '+2250101010101',
        email: 'admin@agrismart.ci',
        nom: 'Kouassi',
        prenom: 'Admin',
        role: 'admin',
        localisation: 'Abidjan'
      },
      {
        id: uuidv4(),
        telephone: '+2250102020202',
        email: 'conseiller@agrismart.ci',
        nom: 'Koné',
        prenom: 'Ibrahim',
        role: 'conseiller',
        localisation: 'Bouaké'
      },
      {
        id: uuidv4(),
        telephone: '+2250103030303',
        email: 'producteur1@agrismart.ci',
        nom: 'Tra',
        prenom: 'Bi',
        role: 'producteur',
        localisation: 'Daloa'
      },
      {
        id: uuidv4(),
        telephone: '+2250104040404',
        email: 'producteur2@agrismart.ci',
        nom: 'Yao',
        prenom: 'Kouadio',
        role: 'producteur',
        localisation: 'Yamoussoukro'
      }
    ];

    for (const user of users) {
      await db.query(`
        INSERT INTO users (id, telephone, email, mot_de_passe, nom, prenom, role, localisation, verifie)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (telephone) DO NOTHING
      `, [user.id, user.telephone, user.email, hashedPassword, user.nom, user.prenom, user.role, user.localisation]);
    }
    console.log(`   ✅ ${users.length} utilisateurs créés`);

    // Récupérer les IDs des producteurs
    const producteurs = await db.query(`SELECT id FROM users WHERE role = 'producteur'`);
    
    // Créer des parcelles
    console.log('\n🌾 Création des parcelles...');
    
    const parcelles = [];
    for (let i = 0; i < producteurs.rows.length; i++) {
      const parcelleId = uuidv4();
      parcelles.push(parcelleId);
      
      await db.query(`
        INSERT INTO parcelles (id, proprietaire_id, nom, superficie, coordonnees_gps, type_sol, systeme_irrigation)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        parcelleId,
        producteurs.rows[i].id,
        `Parcelle ${i + 1} - ${['Cacao', 'Café', 'Hévéa'][i % 3]}`,
        (Math.random() * 5 + 1).toFixed(2),
        JSON.stringify({ lat: 5.36 + Math.random() * 2, lon: -4.01 + Math.random() * 2 }),
        ['argileux', 'sableux', 'limoneux'][i % 3],
        ['goutte_a_goutte', 'aspersion', 'manuel'][i % 3]
      ]);
    }
    console.log(`   ✅ ${parcelles.length} parcelles créées`);

    // Créer des stations et capteurs
    console.log('\n📡 Création des stations et capteurs...');
    
    let capteurCount = 0;
    for (const parcelleId of parcelles) {
      const stationId = uuidv4();
      
      await db.query(`
        INSERT INTO stations (id, parcelle_id, nom, modele, protocole, statut)
        VALUES ($1, $2, $3, $4, $5, 'actif')
      `, [stationId, parcelleId, 'Station IoT Alpha', 'SensorHub v2', 'lorawan']);

      // Ajouter des capteurs à chaque station
      const capteurTypes = ['humidite_sol', 'temperature_air', 'humidite_air', 'luminosite'];
      for (const type of capteurTypes) {
        await db.query(`
          INSERT INTO capteurs (id, station_id, parcelle_id, type, modele, seuil_min, seuil_max)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(), stationId, parcelleId, type, 'Generic Sensor',
          type === 'temperature_air' ? 15 : 20,
          type === 'temperature_air' ? 40 : 80
        ]);
        capteurCount++;
      }
    }
    console.log(`   ✅ ${parcelles.length} stations et ${capteurCount} capteurs créés`);

    // Ajouter des mesures de démonstration
    console.log('\n📊 Création des mesures...');
    
    const capteurs = await db.query(`SELECT id, type FROM capteurs`);
    let mesureCount = 0;
    
    for (const capteur of capteurs.rows) {
      // Générer des mesures sur les 7 derniers jours
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour += 4) {
          const timestamp = new Date();
          timestamp.setDate(timestamp.getDate() - day);
          timestamp.setHours(hour, 0, 0, 0);
          
          let valeur;
          switch (capteur.type) {
            case 'temperature_air':
              valeur = 25 + Math.random() * 10;
              break;
            case 'humidite_air':
            case 'humidite_sol':
              valeur = 40 + Math.random() * 40;
              break;
            case 'luminosite':
              valeur = hour >= 6 && hour <= 18 ? 500 + Math.random() * 500 : Math.random() * 100;
              break;
            default:
              valeur = Math.random() * 100;
          }

          await db.query(`
            INSERT INTO mesures (capteur_id, valeur, unite, timestamp)
            VALUES ($1, $2, $3, $4)
          `, [capteur.id, valeur.toFixed(2), 
              capteur.type === 'temperature_air' ? '°C' : capteur.type === 'luminosite' ? 'lux' : '%',
              timestamp]);
          mesureCount++;
        }
      }
    }
    console.log(`   ✅ ${mesureCount} mesures créées`);

    // Créer des cultures
    console.log('\n🌿 Création des cultures...');
    
    const cultures = [
      { nom: 'Cacao', type: 'perenne', cycle_jours: 1825, temp_ideale_min: 21, temp_ideale_max: 32, humidite_ideale_min: 70, humidite_ideale_max: 90 },
      { nom: 'Café Robusta', type: 'perenne', cycle_jours: 1095, temp_ideale_min: 20, temp_ideale_max: 30, humidite_ideale_min: 60, humidite_ideale_max: 85 },
      { nom: 'Hévéa', type: 'perenne', cycle_jours: 2555, temp_ideale_min: 20, temp_ideale_max: 35, humidite_ideale_min: 75, humidite_ideale_max: 100 },
      { nom: 'Manioc', type: 'annuelle', cycle_jours: 365, temp_ideale_min: 25, temp_ideale_max: 35, humidite_ideale_min: 50, humidite_ideale_max: 80 },
      { nom: 'Igname', type: 'annuelle', cycle_jours: 270, temp_ideale_min: 25, temp_ideale_max: 30, humidite_ideale_min: 60, humidite_ideale_max: 75 },
      { nom: 'Maïs', type: 'annuelle', cycle_jours: 120, temp_ideale_min: 18, temp_ideale_max: 32, humidite_ideale_min: 50, humidite_ideale_max: 70 }
    ];

    for (const culture of cultures) {
      await db.query(`
        INSERT INTO cultures (id, nom, type, cycle_jours, temp_ideale_min, temp_ideale_max, humidite_ideale_min, humidite_ideale_max)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [uuidv4(), culture.nom, culture.type, culture.cycle_jours, 
          culture.temp_ideale_min, culture.temp_ideale_max, 
          culture.humidite_ideale_min, culture.humidite_ideale_max]);
    }
    console.log(`   ✅ ${cultures.length} cultures créées`);

    // Créer des maladies
    console.log('\n🦠 Création des maladies...');
    
    const maladies = [
      { nom: 'Pourriture brune', type: 'fongique', cultures_affectees: ['Cacao'], symptomes: ['taches brunes', 'fruits pourris', 'moisissure blanche'] },
      { nom: 'Swollen Shoot', type: 'virale', cultures_affectees: ['Cacao'], symptomes: ['gonflement tiges', 'feuilles déformées', 'baisse rendement'] },
      { nom: 'Rouille orangée', type: 'fongique', cultures_affectees: ['Café'], symptomes: ['pustules oranges', 'chute feuilles', 'jaunissement'] },
      { nom: 'Anthracnose', type: 'fongique', cultures_affectees: ['Manioc', 'Igname'], symptomes: ['taches noires', 'nécroses', 'dépérissement'] },
      { nom: 'Mosaïque du manioc', type: 'virale', cultures_affectees: ['Manioc'], symptomes: ['marbrure feuilles', 'déformation', 'nanisme'] }
    ];

    for (const maladie of maladies) {
      await db.query(`
        INSERT INTO maladies (id, nom, type, cultures_affectees, symptomes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [uuidv4(), maladie.nom, maladie.type, maladie.cultures_affectees, maladie.symptomes]);
    }
    console.log(`   ✅ ${maladies.length} maladies créées`);

    // Créer des formations
    console.log('\n📚 Création des formations...');
    
    const conseillerId = (await db.query(`SELECT id FROM users WHERE role = 'conseiller' LIMIT 1`)).rows[0]?.id;
    
    const formations = [
      { titre: 'Introduction à l\'agriculture intelligente', type: 'video', niveau: 'debutant', duree: 60 },
      { titre: 'Gestion de l\'irrigation', type: 'tutoriel', niveau: 'intermediaire', duree: 45 },
      { titre: 'Détection des maladies du cacao', type: 'tutoriel', niveau: 'avance', duree: 90 },
      { titre: 'Utilisation des capteurs IoT', type: 'pratique', niveau: 'intermediaire', duree: 120 }
    ];

    for (const formation of formations) {
      await db.query(`
        INSERT INTO formations (id, createur_id, titre, description, type, niveau, duree_estimee, statut)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'publiee')
      `, [uuidv4(), conseillerId, formation.titre, 
          `Description de la formation: ${formation.titre}`,
          formation.type, formation.niveau, formation.duree]);
    }
    console.log(`   ✅ ${formations.length} formations créées`);

    // Créer des produits marketplace
    console.log('\n🛒 Création des produits marketplace...');
    
    const produits = [
      { nom: 'Cacao séché premium', categorie: 'recolte', prix: 1500, unite: 'kg', quantite: 500 },
      { nom: 'Café torréfié artisanal', categorie: 'recolte', prix: 3000, unite: 'kg', quantite: 100 },
      { nom: 'Semences de maïs hybride', categorie: 'semences', prix: 5000, unite: 'sac', quantite: 50 },
      { nom: 'Engrais NPK 15-15-15', categorie: 'intrants', prix: 25000, unite: 'sac', quantite: 30 }
    ];

    for (let i = 0; i < produits.length; i++) {
      const produit = produits[i];
      const vendeurId = producteurs.rows[i % producteurs.rows.length].id;
      
      await db.query(`
        INSERT INTO produits_marketplace (id, vendeur_id, nom, description, categorie, prix, unite, quantite_disponible, localisation)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Côte d''Ivoire')
      `, [uuidv4(), vendeurId, produit.nom, `${produit.nom} de qualité supérieure`,
          produit.categorie, produit.prix, produit.unite, produit.quantite]);
    }
    console.log(`   ✅ ${produits.length} produits créés`);

    console.log('\n✨ Seed terminé avec succès!\n');
    console.log('📋 Utilisateurs de test:');
    console.log('   Admin:      +2250101010101 / password123');
    console.log('   Conseiller: +2250102020202 / password123');
    console.log('   Producteur: +2250103030303 / password123');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    throw error;
  } finally {
    await db.end();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  seed().catch(console.error);
}

module.exports = seed;
