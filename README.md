# Mariage Don-Alpha & Serge — 14 Novembre 2026

Plateforme officielle de célébration nuptiale, gestion des réservations (RSVP), émargement par QR Code et livre d'or pour le mariage solennel de Don-Alpha & Serge à Brazzaville (Palais des Congrès).

## Fonctionnalités
- **RSVP & Confirmation en direct** : Enregistrement des invités avec attribution d'identifiant unique (`INV-XXXXXX`).
- **QR Code d'accès sécurisé** : QR token opaque vérifié en temps réel via MongoDB Atlas Cloud.
- **Espace Organisation & Protocole (/admin)** :
  - Scanner de QR Code par caméra directe le jour J.
  - Registre officiel d'émargement en PDF Haute Définition (A4 Paysage).
  - Exportation complète des données sous Excel (CSV UTF-8).
  - Tableau de bord statistique en temps réel.
- **Livre d'or interactif** : Vœux et messages chaleureux pour les mariés.

## Déploiement en Production (Render.com)
Variables d'environnement requises :
- `PORT` : 4000 (ou fourni par Render)
- `MONGODB_URI` : URI de connexion MongoDB Atlas
- `MONGODB_DB_NAME` : `wedding_d`
- `ADMIN_TOKEN` : Token d'accès au tableau de bord administrateur
