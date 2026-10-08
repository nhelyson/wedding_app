const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const db = require('./db');
const { generateInvitationPdf } = require('./pdfGenerator');
const { generateGuestListPdf } = require('./guestListPdfGenerator');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rate limiter pour prévenir les abus sur les formulaires
const rateLimitMap = new Map();
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 20;

  const current = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
  if (now > current.resetTime) {
    current.count = 1;
    current.resetTime = now + windowMs;
  } else {
    current.count++;
  }
  rateLimitMap.set(ip, current);

  if (current.count > maxRequests) {
    return res.status(429).json({ error: 'Trop de requêtes. Veuillez patienter un instant.' });
  }
  next();
}

// Nettoyage basique des entrées utilisateur pour prévenir les failles XSS
function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/[<>]/g, '');
}

// Middleware d'authentification administrateur
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '') || String(req.query.token || req.query.auth || '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
  }

  const isValid = await db.verifyAdminToken(token);
  if (!isValid) {
    return res.status(403).json({ error: 'Session invalide ou expirée.' });
  }

  next();
}

// Helper pour générer le QR Code officiel DataURL (encodant uniquement le token opaque)
async function generateQrDataUrl(opaqueToken) {
  try {
    return await QRCode.toDataURL(opaqueToken, {
      width: 380,
      margin: 1,
      color: {
        dark: '#1C1613',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('Erreur génération QR Code DataURL:', err.message);
    return `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(opaqueToken)}`;
  }
}

// -------------------------------------------------------------
// ROUTES PUBLIQUES DU MARIAGE
// -------------------------------------------------------------

// Page d'administration
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Récupération de la configuration générale du mariage
app.get('/api/marriage', async (req, res) => {
  try {
    const marriage = await db.getMarriage();
    res.json(marriage || {});
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des informations du mariage.' });
  }
});

// Confirmation de présence (Connecté directement à wedding_d.guests & invitations)
app.post(['/api/confirm', '/api/guests', '/api/guests/confirm'], rateLimiter, async (req, res) => {
  try {
    const lastName = sanitize(req.body.lastName || req.body.name);
    const firstName = sanitize(req.body.firstName || req.body.firstname);
    const phone = sanitize(req.body.phone);
    const attendance = (req.body.attendance === 'no' || req.body.attendance === 'declined') ? 'declined' : 'confirmed';
    const numberOfGuests = parseInt(req.body.numberOfGuests || req.body.guestsCount, 10) || 1;
    const ceremony = req.body.ceremony !== false;
    const reception = req.body.reception !== false;
    const diet = sanitize(req.body.diet);
    const message = sanitize(req.body.message);

    if (!lastName) {
      return res.status(400).json({ error: 'Le nom de famille est obligatoire.' });
    }

    const { guest, isUpdate } = await db.confirmAttendance({
      lastName,
      firstName,
      phone,
      attendance,
      numberOfGuests,
      ceremony,
      reception,
      diet,
      message
    });

    const qrCodeUrl = await generateQrDataUrl(guest.qrToken || guest.invitationId);

    // Ne renvoyer que les données nécessaires au frontend (aucune donnée sensible d'autres invités)
    res.json({
      success: true,
      isUpdate,
      guest: {
        guestId: guest.invitationId,
        invitationId: guest.invitationId,
        displayName: guest.displayName,
        firstName: guest.firstName,
        lastName: guest.lastName,
        numberOfGuests: guest.numberOfGuests,
        attendance: guest.attendance,
        ceremony: guest.ceremony,
        reception: guest.reception,
        qrCodeUrl
      }
    });
  } catch (err) {
    console.error('Erreur confirmation présence :', err.message);
    res.status(500).json({ error: err.message || 'Une erreur est survenue lors de l\'enregistrement.' });
  }
});

// Consultation publique d'une invitation par son invitationId ou token opaque
app.get(['/api/invitation/:identifier', '/api/guests/invitation/:identifier'], async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier) return res.status(400).json({ error: 'Identifiant requis.' });

    const guest = await db.findGuestById(identifier);
    if (!guest) {
      return res.status(404).json({ error: 'Invitation introuvable pour cet identifiant.' });
    }

    const qrCodeUrl = await generateQrDataUrl(guest.qrToken || guest.invitationId);

    res.json({
      guestId: guest.invitationId,
      invitationId: guest.invitationId,
      displayName: guest.displayName,
      firstName: guest.firstName,
      lastName: guest.lastName,
      attendance: guest.attendance,
      numberOfGuests: guest.numberOfGuests,
      ceremony: guest.ceremony,
      reception: guest.reception,
      qrCodeUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'invitation.' });
  }
});

// Téléchargement du document PDF d'invitation personnalisée (4 pages haute papeterie)
app.get('/api/invitation/:identifier/pdf', async (req, res) => {
  try {
    const { identifier } = req.params;
    const guest = await db.findGuestById(identifier);
    if (!guest) return res.status(404).send('Invitation introuvable.');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invitation-${guest.invitationId}.pdf"`);

    await generateInvitationPdf(guest, res);
  } catch (err) {
    console.error('Erreur génération PDF :', err.message);
    res.status(500).send('Erreur lors de la génération de l\'invitation PDF.');
  }
});

// Livre d'or public
app.get('/api/wishes', async (req, res) => {
  try {
    const wishes = await db.getWishes();
    res.json(wishes);
  } catch (err) {
    res.status(500).json({ error: 'Erreur chargement des vœux.' });
  }
});

app.post('/api/wishes', rateLimiter, async (req, res) => {
  try {
    const name = sanitize(req.body.name);
    const relation = sanitize(req.body.relation || 'Proche des mariés');
    const message = sanitize(req.body.message);

    if (!name || !message) {
      return res.status(400).json({ error: 'Le nom et le message sont requis.' });
    }

    const newWish = await db.saveWish({ name, relation, message });
    res.json({ success: true, wish: newWish });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du vœu.' });
  }
});

// -------------------------------------------------------------
// ROUTES DE L'ESPACE ORGANISATION & ADMINISTRATION
// -------------------------------------------------------------

// Connexion de l'organisateur
app.post('/api/admin/login', async (req, res) => {
  const { password, token } = req.body;
  const provided = password || token;

  const isValid = await db.verifyAdminToken(provided);
  if (isValid) {
    res.json({ success: true, token: provided });
  } else {
    res.status(401).json({ error: 'Code d\'accès organisateur incorrect.' });
  }
});

// Liste des invités et métriques pour le tableau de bord

// Export CSV officiel de la liste des invités pour Excel

// Téléchargement du Registre Officiel des Invités en PDF Haute Définition
app.get(['/api/admin/guests-pdf', '/api/admin/export/pdf'], requireAdmin, async (req, res) => {
  try {
    const { guests } = await db.getAdminGuests();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Registre_Officiel_Invites_DonAlpha_Serge.pdf"');
    generateGuestListPdf(guests, res);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la génération du registre PDF officiel.' });
  }
});

app.get(['/api/admin/guests-export', '/api/admin/export/csv'], requireAdmin, async (req, res) => {
  try {
    const { guests } = await db.getAdminGuests();
    const headers = [
      'N°',
      'Référence Invitation',
      'Nom Complet',
      'Téléphone',
      'Places',
      'Statut Présence',
      'Cérémonie Mairie',
      'Soirée Palais des Congrès',
      'Régime Alimentaire',
      'Émargement Jour J',
      'Date/Heure Émargement',
      'Message aux Mariés',
      'Date Inscription'
    ];

    const rows = (guests || []).map((g, idx) => [
      idx + 1,
      `"${g.invitationId || ''}"`,
      `"${(g.displayName || (g.firstName + ' ' + g.lastName) || '').replace(/"/g, '""')}"`,
      `"${g.phone || ''}"`,
      g.numberOfGuests || 1,
      `"${g.attendance === 'confirmed' ? 'Confirmé' : (g.attendance === 'declined' ? 'Décliné' : 'En attente')}"`,
      `"${g.ceremony !== false ? 'Oui' : 'Non'}"`,
      `"${g.reception !== false ? 'Oui' : 'Non'}"`,
      `"${(g.diet || 'Standard').replace(/"/g, '""')}"`,
      `"${g.checkedIn ? 'Émargé' : 'Non émargé'}"`,
      `"${g.checkedInAt ? new Date(g.checkedInAt).toLocaleString('fr-FR') : ''}"`,
      `"${(g.message || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
      `"${g.createdAt ? new Date(g.createdAt).toLocaleDateString('fr-FR') : ''}"`
    ].join(';'));

    const csvData = '\uFEFF' + headers.join(';') + '\r\n' + rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Liste_Invites_DonAlpha_Serge.csv"');
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la génération de l export CSV.' });
  }
});

app.get(['/api/admin/guests', '/api/guests'], requireAdmin, async (req, res) => {
  try {
    const { stats, guests } = await db.getAdminGuests();
    res.json({ stats, guests });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des invités.' });
  }
});

// Consultation du détail d'un invité
app.get('/api/admin/guests/:id', requireAdmin, async (req, res) => {
  try {
    const guest = await db.findGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: 'Invité non trouvé.' });
    res.json(guest);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Mise à jour d'un invité (statut, nombre de places, notes...)
app.all(['/api/admin/guests/:id', '/api/guests/:id'], requireAdmin, async (req, res, next) => {
  if (req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'DELETE') {
    return next();
  }

  if (req.method === 'DELETE') {
    try {
      const deleted = await db.deleteGuest(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Invité non trouvé.' });
      return res.json({ success: true, message: 'Invité et invitation supprimés avec succès.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur lors de la suppression.' });
    }
  }

  // PUT / PATCH
  try {
    const updates = {};
    if (req.body.attendance) updates.attendance = req.body.attendance;
    if (req.body.numberOfGuests !== undefined) updates.numberOfGuests = parseInt(req.body.numberOfGuests, 10) || 1;
    if (req.body.diet !== undefined) updates.diet = sanitize(req.body.diet);
    if (req.body.notes !== undefined) updates.notes = sanitize(req.body.notes);
    if (req.body.phone !== undefined) updates.phone = sanitize(req.body.phone);

    const updated = await db.updateGuest(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Invité non trouvé.' });
    res.json({ success: true, guest: updated });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

// Émargement le jour J via QR Code ou saisie manuelle
app.post(['/api/admin/checkin', '/api/guests/checkin'], requireAdmin, async (req, res) => {
  try {
    const rawQuery = String(req.body.query || req.body.identifier || req.body.token || '').trim();
    if (!rawQuery) {
      return res.status(400).json({ error: 'Token ou identifiant requis.' });
    }

    const confirm = req.body.confirmCheckIn === true || req.body.confirm === true;
    const guest = await db.checkIn(rawQuery, confirm);

    if (!guest) {
      return res.status(404).json({ error: `Aucune invitation trouvée pour "${rawQuery}".` });
    }

    res.json({
      success: true,
      guest: {
        guestId: guest.invitationId,
        invitationId: guest.invitationId,
        displayName: guest.displayName,
        phone: guest.phone,
        numberOfGuests: guest.numberOfGuests,
        attendance: guest.attendance,
        checkedIn: guest.checkedIn,
        checkedInAt: guest.checkedInAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du scan d\'émargement.' });
  }
});

// -------------------------------------------------------------
// DÉMARRAGE DU SERVEUR
// -------------------------------------------------------------
db.connect()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log('💍 Mariage Don-Alpha & Serge — MongoDB Atlas Connecté');
      console.log(`✨ Serveur actif sur : http://localhost:${PORT}`);
      console.log(`🔐 Espace Organisation : http://localhost:${PORT}/admin`);
      console.log('====================================================');
    });

    // Arrêt propre du serveur
    function handleShutdown(signal) {
      console.log(`\nSignal ${signal} reçu. Fermeture propre du serveur...`);
      server.close(async () => {
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        console.log('Connexion MongoDB fermée. Serveur arrêté.');
        process.exit(0);
      });
    }

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  })
  .catch(err => {
    console.error('Impossible de démarrer le serveur : échec de connexion initiale à MongoDB Atlas.');
    process.exit(1);
  });
