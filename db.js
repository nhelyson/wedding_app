const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Charger les variables d'environnement depuis .env ou env sans écraser
const envFiles = [
  path.join(__dirname, '.env'),
  path.join(__dirname, 'env')
];

for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

/**
 * Assainit l'URI MongoDB en encodant les caractères spéciaux dans le mot de passe (comme @ ou #)
 */
function sanitizeMongoUri(uri) {
  if (!uri) return '';
  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
  if (!schemeMatch) return uri;

  const scheme = schemeMatch[1];
  const rest = schemeMatch[2];
  const lastAtIndex = rest.lastIndexOf('@');
  if (lastAtIndex === -1) return uri;

  const userInfo = rest.substring(0, lastAtIndex);
  const hostAndQuery = rest.substring(lastAtIndex + 1);

  const colonIndex = userInfo.indexOf(':');
  if (colonIndex === -1) return uri;

  const username = userInfo.substring(0, colonIndex);
  const password = userInfo.substring(colonIndex + 1);

  // Encode le nom d'utilisateur et le mot de passe pour respecter la RFC 3986
  const encodedPassword = encodeURIComponent(decodeURIComponent(password));
  const encodedUsername = encodeURIComponent(decodeURIComponent(username));

  return `${scheme}${encodedUsername}:${encodedPassword}@${hostAndQuery}`;
}

const DB_NAME = process.env.MONGODB_DB_NAME || 'wedding_d';
const RAW_URI = process.env.MONGODB_URI || '';
const CLEAN_URI = sanitizeMongoUri(RAW_URI);

// ----------------------------------------------------------------------
// SCHÉMAS MONGODB
// ----------------------------------------------------------------------

// 1. Collection 'marriage' : Informations générales du mariage
const MarriageSchema = new mongoose.Schema({
  couple: {
    name: { type: String, default: 'Don-Alpha & Serge' },
    partner1: { type: String, default: 'Don-Alpha' },
    partner2: { type: String, default: 'Serge' }
  },
  date: { type: String, default: '2026-11-14T10:00:00+01:00' },
  formattedDate: { type: String, default: 'Samedi 14 Novembre 2026' },
  location: { type: String, default: 'Brazzaville, République du Congo' },
  quote: { type: String, default: 'Deux histoires, un seul chemin...' },
  loveMessage: { 
    type: String, 
    default: 'Deux âmes, un amour éternel. Votre présence à nos côtés sera la plus belle note de bonheur pour sceller cette journée inoubliable.' 
  },
  venues: [{
    name: String,
    event: String,
    time: String,
    details: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'marriage' });

// 2. Collection 'guests' : Invités et confirmations
const GuestSchema = new mongoose.Schema({
  invitationId: { type: String, required: true, unique: true, index: true },
  qrToken: { type: String, required: true, unique: true, index: true },
  firstName: { type: String, trim: true, default: '' },
  lastName: { type: String, required: true, trim: true },
  displayName: { type: String, trim: true },
  phone: { type: String, trim: true, index: true, default: '' },
  numberOfGuests: { type: Number, default: 1, min: 1, max: 10 },
  attendance: { 
    type: String, 
    enum: ['pending', 'confirmed', 'declined'], 
    default: 'confirmed',
    index: true 
  },
  ceremony: { type: Boolean, default: true },
  reception: { type: Boolean, default: true },
  diet: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  message: { type: String, trim: true, default: '' },
  checkedIn: { type: Boolean, default: false, index: true },
  checkedInAt: { type: Date, default: null },
  confirmedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'guests' });

// 3. Collection 'invitations' : Métadonnées de l'invitation personnalisée
const InvitationSchema = new mongoose.Schema({
  invitationId: { type: String, required: true, unique: true, index: true },
  guestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', required: true, index: true },
  qrToken: { type: String, required: true, index: true },
  status: { type: String, enum: ['ready', 'sent', 'archived'], default: 'ready' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'invitations' });

// 4. Collection 'admins' : Comptes et tokens d'organisation
const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  token: { type: String, required: true },
  role: { type: String, default: 'organizer' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'admins' });

// 5. Collection 'wishes' : Livre d'or
const WishSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  relation: { type: String, trim: true, default: 'Proche des mariés' },
  message: { type: String, required: true, trim: true },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'wishes' });

// Modèles
let MarriageModel, GuestModel, InvitationModel, AdminModel, WishModel;

// ----------------------------------------------------------------------
// GESTIONNAIRE DE CONNEXION SINGLETON
// ----------------------------------------------------------------------
let isConnecting = false;
let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;
  if (isConnecting) {
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(mongoose.connection));
      mongoose.connection.once('error', reject);
    });
  }

  isConnecting = true;

  if (!CLEAN_URI) {
    console.warn('⚠️ AVERTISSEMENT : MONGODB_URI est manquant dans les variables d\'environnement.');
    isConnecting = false;
    return null;
  }

  try {
    // Connexion avec options de robustesse
    await mongoose.connect(CLEAN_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });

    isConnected = true;
    isConnecting = false;
    console.log(`🍃 MongoDB Atlas connecté avec succès à la base "${DB_NAME}".`);

    // Initialisation des modèles
    MarriageModel = mongoose.model('Marriage', MarriageSchema);
    GuestModel = mongoose.model('Guest', GuestSchema);
    InvitationModel = mongoose.model('Invitation', InvitationSchema);
    AdminModel = mongoose.model('Admin', AdminSchema);
    WishModel = mongoose.model('Wish', WishSchema);

    // Initialisation conditionnelle non destructive
    await initializeCollectionsDefaults();

    return mongoose.connection;
  } catch (err) {
    isConnecting = false;
    isConnected = false;
    // Log sécurisé : ne JAMAIS afficher de mot de passe ou URI complète
    console.error('❌ Échec de connexion à MongoDB Atlas :', err.message);
    throw err;
  }
}

/**
 * Initialise les données par défaut dans MongoDB sans jamais écraser ou drop les données existantes
 */
async function initializeCollectionsDefaults() {
  try {
    // 1. Collection 'marriage' : si vide, insérer la configuration officielle de Don-Alpha & Serge
    const marriageCount = await MarriageModel.countDocuments();
    if (marriageCount === 0) {
      await MarriageModel.create({
        couple: {
          name: 'Don-Alpha & Serge',
          partner1: 'Don-Alpha',
          partner2: 'Serge'
        },
        date: '2026-11-14T10:00:00+01:00',
        formattedDate: 'Samedi 14 Novembre 2026',
        location: 'Brazzaville, République du Congo',
        quote: 'Deux histoires, un seul chemin...',
        loveMessage: 'Deux âmes, un amour éternel. Votre présence à nos côtés sera la plus belle note de bonheur pour sceller cette journée inoubliable.',
        venues: [
          {
            name: 'Mairie Centrale de Brazzaville',
            event: 'Union Civile Solennelle',
            time: '10h00',
            details: 'Échange des consentements solennels et signature des registres officiels.'
          },
          {
            name: 'Parvis de la Mairie Centrale',
            event: 'Séance Photo Souvenir',
            time: '11h40',
            details: 'Photographies officielles avec les mariés.'
          },
          {
            name: 'Ville de Brazzaville',
            event: 'Tour de Ville du Cortège',
            time: '14h20',
            details: 'Cortège nuptial et défilé d\'honneur à travers la ville.'
          },
          {
            name: 'Salle Aquarium — Palais des Congrès',
            event: 'Accueil des Invités & Émargement',
            time: '15h40',
            details: 'Accueil officiel et scan du QR Code d\'invitation.'
          },
          {
            name: 'Salle Aquarium — Palais des Congrès',
            event: 'Banquet Royal & Festivités',
            time: '16h10',
            details: 'Toast d\'honneur, banquet gastronomique et ouverture du bal des mariés.'
          }
        ]
      });
      console.log('✨ Collection "marriage" initialisée avec les informations officielles.');
    }

    // 2. Collection 'admins' : si vide, créer le compte organisateur officiel
    const adminCount = await AdminModel.countDocuments();
    if (adminCount === 0) {
      const defaultToken = process.env.ADMIN_TOKEN || 'serge-alpha-2026';
      await AdminModel.create({
        username: 'organisateur',
        token: defaultToken,
        role: 'superadmin'
      });
      console.log('🔐 Collection "admins" initialisée avec l\'accès organisation.');
    }
  } catch (err) {
    console.warn('Note sur l\'initialisation des collections :', err.message);
  }
}

// ----------------------------------------------------------------------
// UTILITAIRES D'IDENTIFIANTS & TOKENS
// ----------------------------------------------------------------------

/**
 * Génère un identifiant unique opaque de format INV-XXXXXX imprévisible
 */
async function generateUniqueInvitationId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let unique = false;
  let id = '';

  while (!unique) {
    let randomPart = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(bytes[i] % chars.length);
    }
    id = `INV-${randomPart}`;

    const existing = await GuestModel.findOne({ invitationId: id }).lean();
    if (!existing) {
      unique = true;
    }
  }

  return id;
}

/**
 * Génère un token cryptographique opaque pour le QR code
 */
function generateOpaqueQrToken(invitationId) {
  return `${invitationId}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Normalise un numéro de téléphone pour la déduplication
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

// ----------------------------------------------------------------------
// MÉTHODES MÉTIER (SERVICE LAYER MONGODB ATLAS)
// ----------------------------------------------------------------------

const db = {
  connect: connectDB,

  /**
   * Récupère la configuration générale du mariage
   */
  async getMarriage() {
    await connectDB();
    const doc = await MarriageModel.findOne({}).lean();
    return doc || null;
  },

  /**
   * Trouve un invité par invitationId, qrToken, ou _id
   */
  async findGuestById(identifier) {
    await connectDB();
    if (!identifier) return null;

    const trimmed = String(identifier).trim();
    let query = {
      $or: [
        { invitationId: trimmed.toUpperCase() },
        { qrToken: trimmed }
      ]
    };

    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      query.$or.push({ _id: trimmed });
    }

    const guest = await GuestModel.findOne(query).lean();
    return guest;
  },

  /**
   * Recherche un invité par téléphone (pour éviter les doublons)
   */
  async findGuestByPhone(phone) {
    await connectDB();
    const norm = normalizePhone(phone);
    if (!norm) return null;
    return await GuestModel.findOne({ phone: norm }).lean();
  },

  /**
   * Enregistre ou met à jour une confirmation de présence (Anti-doublon)
   */
  async confirmAttendance(data) {
    await connectDB();

    const lastName = String(data.lastName || data.name || '').trim();
    const firstName = String(data.firstName || data.firstname || '').trim();
    const phone = normalizePhone(data.phone || '');
    const guestsCount = Math.max(1, Math.min(10, parseInt(data.numberOfGuests || data.guestsCount, 10) || 1));
    const attendance = (data.attendance === 'no' || data.attendance === 'declined') ? 'declined' : 'confirmed';
    const ceremony = data.ceremony !== false;
    const reception = data.reception !== false;
    const diet = String(data.diet || '').trim();
    const message = String(data.message || '').trim();
    const displayName = firstName ? `${firstName} ${lastName}` : lastName;

    if (!lastName) {
      throw new Error('Le nom de famille est obligatoire.');
    }

    // 1. Stratégie de déduplication : rechercher par téléphone ou par nom+prénom
    let existingGuest = null;
    if (phone && phone.length >= 6) {
      existingGuest = await GuestModel.findOne({ phone });
    }

    if (!existingGuest) {
      // Recherche par nom et prénom exacts
      existingGuest = await GuestModel.findOne({
        lastName: new RegExp(`^${lastName}$`, 'i'),
        firstName: firstName ? new RegExp(`^${firstName}$`, 'i') : { $in: ['', null] }
      });
    }

    let guest;
    let isUpdate = false;

    if (existingGuest) {
      // Mise à jour propre de l'invité existant
      isUpdate = true;
      existingGuest.firstName = firstName;
      existingGuest.lastName = lastName;
      existingGuest.displayName = displayName;
      if (phone) existingGuest.phone = phone;
      existingGuest.numberOfGuests = guestsCount;
      existingGuest.attendance = attendance;
      existingGuest.ceremony = ceremony;
      existingGuest.reception = reception;
      if (diet) existingGuest.diet = diet;
      if (message) existingGuest.message = message;
      existingGuest.confirmedAt = new Date();
      existingGuest.updatedAt = new Date();

      await existingGuest.save();
      guest = existingGuest.toObject();

      // Assurer que l'invitation liée existe
      await InvitationModel.findOneAndUpdate(
        { invitationId: guest.invitationId },
        {
          guestId: guest._id,
          qrToken: guest.qrToken,
          status: 'ready',
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    } else {
      // Nouvel invité : génération de l'ID d'invitation et du token opaque
      const invitationId = await generateUniqueInvitationId();
      const qrToken = generateOpaqueQrToken(invitationId);

      const newGuestDoc = new GuestModel({
        invitationId,
        qrToken,
        firstName,
        lastName,
        displayName,
        phone,
        numberOfGuests: guestsCount,
        attendance,
        ceremony,
        reception,
        diet,
        message,
        checkedIn: false,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newGuestDoc.save();
      guest = newGuestDoc.toObject();

      // Création de l'enregistrement correspondant dans la collection 'invitations'
      await InvitationModel.create({
        invitationId: guest.invitationId,
        guestId: guest._id,
        qrToken: guest.qrToken,
        status: 'ready',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Si un mot doux a été laissé, l'enregistrer dans le livre d'or
    if (message && message.length >= 3) {
      await WishModel.create({
        name: displayName,
        relation: 'Invité confirmé',
        message: message,
        date: new Date().toISOString().split('T')[0]
      });
    }

    return { guest, isUpdate };
  },

  /**
   * Récupère la liste des invités pour l'administration avec calcul des statistiques
   */
  async getAdminGuests() {
    await connectDB();

    const guests = await GuestModel.find({}).sort({ createdAt: -1 }).lean();

    const totalInvitations = guests.length;
    const confirmed = guests.filter(g => g.attendance === 'confirmed').length;
    const pending = guests.filter(g => g.attendance === 'pending').length;
    const declined = guests.filter(g => g.attendance === 'declined').length;
    const totalExpectedPeople = guests
      .filter(g => g.attendance === 'confirmed')
      .reduce((sum, g) => sum + (parseInt(g.numberOfGuests, 10) || 1), 0);
    const checkedInCount = guests.filter(g => g.checkedIn).length;

    return {
      stats: {
        totalInvitations,
        confirmed,
        pending,
        declined,
        totalExpectedPeople,
        checkedInCount
      },
      guests
    };
  },

  /**
   * Met à jour un invité par son invitationId ou _id
   */
  async updateGuest(identifier, updates) {
    await connectDB();

    const query = mongoose.Types.ObjectId.isValid(identifier)
      ? { $or: [{ _id: identifier }, { invitationId: identifier }] }
      : { invitationId: identifier };

    updates.updatedAt = new Date();
    const updated = await GuestModel.findOneAndUpdate(query, { $set: updates }, { new: true }).lean();
    return updated;
  },

  /**
   * Supprime un invité et son invitation associée
   */
  async deleteGuest(identifier) {
    await connectDB();

    const guest = await this.findGuestById(identifier);
    if (!guest) return false;

    await GuestModel.deleteOne({ _id: guest._id });
    await InvitationModel.deleteOne({ invitationId: guest.invitationId });
    return true;
  },

  /**
   * Émargement le jour J via QR token ou ID d'invitation
   */
  async checkIn(rawQuery, confirm = false) {
    await connectDB();
    if (!rawQuery) return null;

    const trimmed = String(rawQuery).trim();
    let searchId = trimmed.toUpperCase();
    const matchInv = trimmed.match(/INV-[A-Z0-9]{6}/i);
    if (matchInv) {
      searchId = matchInv[0].toUpperCase();
    }

    const guest = await GuestModel.findOne({
      $or: [
        { invitationId: searchId },
        { qrToken: trimmed },
        { displayName: new RegExp(trimmed, 'i') }
      ]
    });

    if (!guest) return null;

    if (confirm) {
      guest.checkedIn = true;
      guest.checkedInAt = new Date();
      guest.updatedAt = new Date();
      await guest.save();
    }

    return guest.toObject();
  },

  /**
   * Vérifie le token de l'administrateur
   */
  async verifyAdminToken(token) {
    await connectDB();
    if (!token) return false;

    // Vérifie d'abord dans la collection 'admins'
    const admin = await AdminModel.findOne({ token }).lean();
    if (admin) return true;

    // Fallback variable d'environnement
    const envToken = process.env.ADMIN_TOKEN || 'serge-alpha-2026';
    return token === envToken;
  },

  /**
   * Récupère les messages du livre d'or
   */
  async getWishes() {
    await connectDB();
    return await WishModel.find({}).sort({ createdAt: -1 }).limit(50).lean();
  },

  /**
   * Enregistre un message dans le livre d'or
   */
  async saveWish(wishData) {
    await connectDB();
    const newWish = await WishModel.create({
      name: wishData.name,
      relation: wishData.relation || 'Proche des mariés',
      message: wishData.message,
      date: new Date().toISOString().split('T')[0]
    });
    return newWish.toObject();
  }
};

module.exports = db;
