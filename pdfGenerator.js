const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Génère le document PDF d'invitation officielle en 4 pages d'exception
 * 1. Couverture
 * 2. Carton officiel d'invitation au format royal
 * 3. Souvenir et mots d'amour des mariés
 * 4. Programme du mariage & QR Code unique d'accès
 */
async function generateInvitationPdf(guest, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Invitation de Mariage — Don-Alpha & Serge — ${guest.displayName}`,
      Author: 'Don-Alpha & Serge',
      Subject: 'Invitation Officielle de Mariage',
      Keywords: 'Mariage, Don-Alpha, Serge, Brazzaville, 2026'
    }
  });

  doc.pipe(stream);

  const couplePhotoPath = path.join(__dirname, 'public', 'images', 'photo_maries_ronde_HD.png');
  const hasPhoto = fs.existsSync(couplePhotoPath);

  // Helper pour dessiner le fond ivoire vergeuré et l'encadrement doré
  function drawPageBackgroundAndBorders() {
    // Fond ivoire vergeuré
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FAF7F2');

    // Double filet doré de haute papeterie
    doc.lineWidth(1.5).strokeColor('#C5A880');
    doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();

    doc.lineWidth(0.5).strokeColor('#C5A880');
    doc.rect(36, 36, doc.page.width - 72, doc.page.height - 72).stroke();
  }

  // ==============================================================
  // PAGE 1 : COUVERTURE
  // ==============================================================
  drawPageBackgroundAndBorders();

  doc.y = 140;

  // Sceau Monogramme DAS
  doc.fillColor('#96774E').fontSize(18).text('D  A  S', { align: 'center', characterSpacing: 8 });
  doc.moveDown(0.5);

  doc.fillColor('#7D7065').fontSize(9).text('CÉLÉBRATION D\'UNION', { align: 'center', characterSpacing: 5 });
  doc.moveDown(1.5);

  // Noms du Couple
  doc.fillColor('#201A16').fontSize(36).text('Don-Alpha & Serge', { align: 'center' });
  doc.moveDown(0.6);

  // Citation poétique
  doc.fillColor('#4A3E35').fontSize(14).text('« Deux histoires, un seul chemin... »', { align: 'center' });
  doc.moveDown(1);

  // Date solennelle
  doc.fillColor('#96774E').fontSize(10).text('SAMEDI 14 NOVEMBRE 2026', { align: 'center', characterSpacing: 4 });
  doc.moveDown(0.3);
  doc.fillColor('#7D7065').fontSize(9).text('BRAZZAVILLE • RÉPUBLIQUE DU CONGO', { align: 'center', characterSpacing: 2 });

  doc.y = doc.page.height - 130;
  doc.fillColor('#96774E').fontSize(9).text('INVITATION OFFICIELLE', { align: 'center', characterSpacing: 6 });

  // ==============================================================
  // PAGE 2 : CARTON OFFICIEL D'INVITATION
  // ==============================================================
  doc.addPage();
  drawPageBackgroundAndBorders();

  doc.y = 80;
  doc.fillColor('#96774E').fontSize(14).text('D  A  S', { align: 'center', characterSpacing: 6 });
  doc.moveDown(0.3);
  doc.fillColor('#7D7065').fontSize(8.5).text('CARTON OFFICIEL D\'INVITATION', { align: 'center', characterSpacing: 4 });
  doc.moveDown(1.2);

  doc.fillColor('#201A16').fontSize(30).text('Don-Alpha & Serge', { align: 'center' });
  doc.moveDown(0.4);

  doc.fillColor('#4A3E35').fontSize(11).text('Ont l\'honneur et la joie de vous convier à célébrer leur union', { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor('#96774E').fontSize(11).text('Le Samedi 14 Novembre 2026 à Brazzaville', { align: 'center' });
  doc.moveDown(1.5);

  // Cartouche Nominatif de l'Invité d'Honneur
  const boxY = doc.y;
  const boxW = doc.page.width - 160;
  doc.rect(80, boxY, boxW, 85).fill('#FFFFFF');
  doc.lineWidth(0.6).strokeColor('#C5A880').rect(80, boxY, boxW, 85).stroke();

  doc.fillColor('#96774E').fontSize(8.5).text('INVITÉ D\'HONNEUR', 80, boxY + 14, { align: 'center', width: boxW, characterSpacing: 3 });
  doc.fillColor('#201A16').fontSize(19).text(guest.displayName || 'Invité d\'Honneur', 80, boxY + 32, { align: 'center', width: boxW });

  const places = (guest.attendance === 'confirmed' || guest.attendance === 'yes')
    ? `${guest.numberOfGuests || 1} Place(s) réservée(s)`
    : 'Participation déclinée';
  doc.fillColor('#7D7065').fontSize(9.5).text(places, 80, boxY + 60, { align: 'center', width: boxW });

  doc.y = boxY + 115;

  doc.fillColor('#4A3E35').fontSize(10.5).text(
    'Votre présence à nos côtés sera un témoignage précieux de l\'affection que vous nous portez et scellera la solennité de ce moment d\'exception.',
    100, doc.y, { align: 'center', width: doc.page.width - 200, lineGap: 4 }
  );

  doc.y = doc.page.height - 110;
  doc.fillColor('#96774E').fontSize(9).text(`RÉFÉRENCE D'INVITATION : ${guest.invitationId}`, { align: 'center', characterSpacing: 3 });

  // ==============================================================
  // PAGE 3 : SOUVENIR ET MOTS D'AMOUR DES MARIÉS
  // ==============================================================
  doc.addPage();
  drawPageBackgroundAndBorders();

  doc.y = 80;
  doc.fillColor('#96774E').fontSize(8.5).text('SOUVENIR & MOTS D\'AMOUR', { align: 'center', characterSpacing: 4 });
  doc.moveDown(0.8);

  doc.fillColor('#201A16').fontSize(22).text('« Deux âmes, un amour éternel. »', { align: 'center' });
  doc.moveDown(1);

  // Insertion de la photo souvenir officielle si présente
  if (hasPhoto) {
    const photoSize = 160;
    const photoX = (doc.page.width - photoSize) / 2;
    doc.image(couplePhotoPath, photoX, doc.y, { width: photoSize });
    doc.y += photoSize + 25;
  } else {
    doc.moveDown(3);
  }

  doc.fillColor('#4A3E35').fontSize(11).text(
    'Votre présence à nos côtés sera la plus belle note de bonheur pour sceller cette journée inoubliable.',
    100, doc.y, { align: 'center', width: doc.page.width - 200, lineGap: 4 }
  );
  doc.moveDown(0.8);

  doc.fillColor('#4A3E35').fontSize(11).text(
    'Nous avons hâte de célébrer cet amour et d\'écrire cette nouvelle page avec chacun d\'entre vous !',
    100, doc.y, { align: 'center', width: doc.page.width - 200, lineGap: 4 }
  );
  doc.moveDown(1.5);

  doc.fillColor('#96774E').fontSize(22).text('Don-Alpha & Serge', { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor('#7D7065').fontSize(9).text('Samedi 14 Novembre 2026', { align: 'center' });

  // ==============================================================
  // PAGE 4 : PROGRAMME DU MARIAGE & QR CODE UNIQUE D'ACCÈS
  // ==============================================================
  doc.addPage();
  drawPageBackgroundAndBorders();

  doc.y = 70;
  doc.fillColor('#96774E').fontSize(8.5).text('DÉROULEMENT SOLENNEL DU MARIAGE', { align: 'center', characterSpacing: 4 });
  doc.moveDown(0.4);

  doc.fillColor('#201A16').fontSize(22).text('Samedi 14 Novembre 2026', { align: 'center' });
  doc.moveDown(1);

  // Colonnes du programme
  const progY = doc.y;
  const colW = (doc.page.width - 160) / 3;

  doc.fillColor('#201A16').fontSize(12).text('10h00', 80, progY, { width: colW, align: 'center' });
  doc.fillColor('#96774E').fontSize(8).text('MAIRIE CENTRALE', 80, progY + 18, { width: colW, align: 'center', characterSpacing: 1 });
  doc.fillColor('#4A3E35').fontSize(8.5).text('Célébration Civile', 80, progY + 30, { width: colW, align: 'center' });

  doc.fillColor('#201A16').fontSize(12).text('14h20', 80 + colW, progY, { width: colW, align: 'center' });
  doc.fillColor('#96774E').fontSize(8).text('CORTÈGE D\'HONNEUR', 80 + colW, progY + 18, { width: colW, align: 'center', characterSpacing: 1 });
  doc.fillColor('#4A3E35').fontSize(8.5).text('Tour de Ville', 80 + colW, progY + 30, { width: colW, align: 'center' });

  doc.fillColor('#201A16').fontSize(12).text('15h40', 80 + colW * 2, progY, { width: colW, align: 'center' });
  doc.fillColor('#96774E').fontSize(8).text('PALAIS DES CONGRÈS', 80 + colW * 2, progY + 18, { width: colW, align: 'center', characterSpacing: 1 });
  doc.fillColor('#4A3E35').fontSize(8.5).text('Banquet & Fête Royale', 80 + colW * 2, progY + 30, { width: colW, align: 'center' });

  doc.y = progY + 70;

  // QR Code officiel encodant uniquement le token opaque
  const tokenToEncode = guest.qrToken || guest.invitationId;
  const qrBuffer = await QRCode.toBuffer(tokenToEncode, {
    width: 150,
    margin: 1,
    color: {
      dark: '#1C1613',
      light: '#FFFFFF'
    }
  });

  const qrSize = 140;
  const qrX = (doc.page.width - qrSize) / 2;
  doc.image(qrBuffer, qrX, doc.y, { width: qrSize });
  doc.y += qrSize + 15;

  // Identifiant sous le QR Code
  doc.fillColor('#96774E').fontSize(11).text(`IDENTIFIANT : ${guest.invitationId}`, { align: 'center', characterSpacing: 3 });
  doc.moveDown(0.4);

  doc.fillColor('#7D7065').fontSize(8.5).text(
    'Ce QR Code officiel d\'accès est strictement personnel. Veuillez présenter ce document ou le scanner sur votre téléphone à l\'accueil de la Salle Aquarium (Palais des Congrès).',
    100, doc.y, { align: 'center', width: doc.page.width - 200, lineGap: 3 }
  );

  doc.end();
}

module.exports = {
  generateInvitationPdf
};
