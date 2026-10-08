const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Génère le Registre Officiel des Invités en PDF Haute Couture A4 Paysage
 * Format : A4 Landscape (841.89 x 595.28 pt)
 * Avec polices TrueType intégrées pour un rendu 100% vectoriel sans bug d'encodage
 */
function generateGuestListPdf(guests, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    bufferPages: true,
    info: {
      Title: 'Mariage Don-Alpha & Serge — Registre Officiel des Invités',
      Author: 'Comité d\'Organisation Don-Alpha & Serge',
      Subject: 'Liste Officielle d\'Émargement et Protocole d\'Accueil',
      Keywords: 'Mariage, Don-Alpha, Serge, Registre, Invités, 2026'
    }
  });

  doc.pipe(stream);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Enregistrement des polices TrueType si présentes
  const fontsDir = path.join(__dirname, 'fonts');
  const hasCustomFonts = fs.existsSync(path.join(fontsDir, 'Cinzel-Bold.ttf'));

  if (hasCustomFonts) {
    doc.registerFont('F_TITLE_BOLD', path.join(fontsDir, 'Cinzel-Bold.ttf'));
    doc.registerFont('F_TITLE', path.join(fontsDir, 'Cinzel-Regular.ttf'));
    doc.registerFont('F_SERIF_BOLD', path.join(fontsDir, 'CormorantGaramond-Bold.ttf'));
    doc.registerFont('F_SERIF', path.join(fontsDir, 'CormorantGaramond-Regular.ttf'));
    doc.registerFont('F_SERIF_ITALIC', path.join(fontsDir, 'CormorantGaramond-Italic.ttf'));
    doc.registerFont('F_SANS_BOLD', path.join(fontsDir, 'Montserrat-0.ttf'));
    doc.registerFont('F_SCRIPT', path.join(fontsDir, 'GreatVibes-Regular.ttf'));
  } else {
    doc.registerFont('F_TITLE_BOLD', 'Helvetica-Bold');
    doc.registerFont('F_TITLE', 'Helvetica');
    doc.registerFont('F_SERIF_BOLD', 'Times-Bold');
    doc.registerFont('F_SERIF', 'Times-Roman');
    doc.registerFont('F_SERIF_ITALIC', 'Times-Italic');
    doc.registerFont('F_SANS_BOLD', 'Helvetica-Bold');
    doc.registerFont('F_SCRIPT', 'Times-BoldItalic');
  }

  // Couleurs de la charte de prestige
  const C_BG = '#FAF8F5';        // Ivoire vergeuré chaud
  const C_GOLD_DARK = '#8C6D3F';  // Or profond impérial
  const C_GOLD = '#C5A880';       // Or royal
  const C_GOLD_LIGHT = '#EADECC'; // Or doux filet
  const C_TEXT = '#1C1917';       // Ébène noble
  const C_MUTED = '#6E675F';      // Sépia doux
  const C_ROW_ALT = '#F6F1EB';    // Ligne alternée ivoire

  function drawDecorativeBorders() {
    // Fond ivoire vergeuré
    doc.rect(0, 0, pageWidth, pageHeight).fill(C_BG);

    // Double filet d'encadrement or royal
    doc.lineWidth(1.4).strokeColor(C_GOLD);
    doc.rect(20, 20, pageWidth - 40, pageHeight - 40).stroke();

    doc.lineWidth(0.6).strokeColor(C_GOLD_LIGHT);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48).stroke();

    // Fleurons d'angle dorés
    const corners = [
      [24, 24],
      [pageWidth - 24, 24],
      [24, pageHeight - 24],
      [pageWidth - 24, pageHeight - 24]
    ];
    doc.save();
    doc.lineWidth(0.8).strokeColor(C_GOLD_DARK);
    corners.forEach(([cx, cy]) => {
      doc.circle(cx, cy, 3).stroke();
      doc.circle(cx, cy, 1).fillColor(C_GOLD_DARK).fill();
    });
    doc.restore();
  }

  // Page 1
  drawDecorativeBorders();

  // 1. EN-TÊTE DE PRESTIGE
  // Monogramme D & S
  doc.save();
  doc.lineWidth(1.2).strokeColor(C_GOLD);
  doc.circle(pageWidth / 2, 44, 16).stroke();
  doc.fillColor(C_GOLD_DARK)
     .font('F_TITLE_BOLD')
     .fontSize(11)
     .text('D & S', pageWidth / 2 - 16, 39, { width: 32, align: 'center', lineBreak: false });
  doc.restore();

  // Titres
  doc.fillColor(C_GOLD_DARK)
     .font('F_TITLE_BOLD')
     .fontSize(8.5)
     .text('MARIAGE SOLENNEL DE DON-ALPHA & SERGE', 30, 66, { width: pageWidth - 60, align: 'center', characterSpacing: 2.5, lineBreak: false });

  doc.fillColor(C_TEXT)
     .font('F_TITLE_BOLD')
     .fontSize(14)
     .text('REGISTRE OFFICIEL D\'ACCÈS & LISTE D\'ÉMARGEMENT', 30, 80, { width: pageWidth - 60, align: 'center', characterSpacing: 1, lineBreak: false });

  doc.fillColor(C_MUTED)
     .font('F_SERIF_ITALIC')
     .fontSize(11)
     .text('Samedi 14 Novembre 2026   ·   Palais des Congrès de Brazzaville — Salle Aquarium', 30, 98, { width: pageWidth - 60, align: 'center', lineBreak: false });

  // Ligne dorée ornée
  doc.lineWidth(0.8).strokeColor(C_GOLD);
  doc.moveTo(pageWidth / 2 - 150, 114).lineTo(pageWidth / 2 + 150, 114).stroke();
  doc.circle(pageWidth / 2, 114, 2).fillColor(C_GOLD_DARK).fill();

  // 2. BANDEAU DE STATISTIQUES RÉSUMÉ
  const safeGuests = Array.isArray(guests) ? guests : [];
  const totalInvites = safeGuests.length;
  const totalPlaces = safeGuests.reduce((sum, g) => sum + (g.numberOfGuests || 1), 0);
  const totalEmarges = safeGuests.filter(g => g.checkedIn).length;
  const placesEmargees = safeGuests.filter(g => g.checkedIn).reduce((sum, g) => sum + (g.numberOfGuests || 1), 0);

  const statsY = 124;
  const statsBoxWidth = pageWidth - 64;
  const tableX = 32;

  doc.rect(tableX, statsY, statsBoxWidth, 22).fill('#EFE8DC');
  doc.lineWidth(0.6).strokeColor(C_GOLD).rect(tableX, statsY, statsBoxWidth, 22).stroke();

  doc.fillColor(C_TEXT).font('F_TITLE_BOLD').fontSize(7.5);
  const statText = `TOTAL INVITATIONS : ${totalInvites}     |     TOTAL CONVIVES ATTENDUS : ${totalPlaces} PERSONNES     |     ÉMARGÉS JOUR J : ${totalEmarges} (${placesEmargees} convives)     |     REGISTRE CERTIFIÉ CONFORME`;
  doc.text(statText, tableX, statsY + 7, { width: statsBoxWidth, align: 'center', characterSpacing: 0.5, lineBreak: false });

  // 3. TABLEAU DES INVITÉS
  let currentY = 154;

  const cols = [
    { title: 'N°', width: 30, align: 'center' },
    { title: 'RÉFÉRENCE', width: 78, align: 'center' },
    { title: 'INVITÉ D\'HONNEUR', width: 185, align: 'left' },
    { title: 'CONTACT', width: 95, align: 'left' },
    { title: 'CONVIVES', width: 55, align: 'center' },
    { title: 'CÉRÉMONIE', width: 58, align: 'center' },
    { title: 'RÉCEPTION', width: 58, align: 'center' },
    { title: 'OBSERVATIONS', width: 105, align: 'left' },
    { title: 'ÉMARGEMENT / SIGNATURE', width: 113.89, align: 'center' }
  ];

  function drawTableHeader(y) {
    doc.rect(tableX, y, statsBoxWidth, 26).fill(C_GOLD_DARK);
    let xOffset = tableX;
    doc.fillColor('#FFFFFF').font('F_TITLE_BOLD').fontSize(7);
    cols.forEach(c => {
      doc.text(c.title, xOffset + 4, y + 9, { width: c.width - 8, align: c.align, lineBreak: false });
      xOffset += c.width;
    });
    return y + 26;
  }

  currentY = drawTableHeader(currentY);

  // Lignes du tableau
  safeGuests.forEach((g, idx) => {
    if (currentY > pageHeight - 80) {
      doc.addPage();
      drawDecorativeBorders();
      currentY = 40;
      currentY = drawTableHeader(currentY);
    }

    const rowHeight = 25;
    const isAlt = idx % 2 === 1;

    doc.rect(tableX, currentY, statsBoxWidth, rowHeight).fill(isAlt ? C_ROW_ALT : '#FFFFFF');
    doc.lineWidth(0.4).strokeColor(C_GOLD_LIGHT);
    doc.moveTo(tableX, currentY + rowHeight).lineTo(tableX + statsBoxWidth, currentY + rowHeight).stroke();

    let xOffset = tableX;

    // N°
    doc.fillColor(C_MUTED).font('F_SERIF').fontSize(10);
    doc.text(String(idx + 1), xOffset + 2, currentY + 7, { width: cols[0].width - 4, align: 'center', lineBreak: false });
    xOffset += cols[0].width;

    // Référence
    doc.fillColor(C_GOLD_DARK).font('F_TITLE_BOLD').fontSize(8);
    doc.text(g.invitationId || '—', xOffset + 2, currentY + 8, { width: cols[1].width - 4, align: 'center', lineBreak: false });
    xOffset += cols[1].width;

    // Nom
    const fullName = (g.displayName || ((g.firstName || '') + ' ' + (g.lastName || ''))).trim();
    doc.fillColor(C_TEXT).font('F_SERIF_BOLD').fontSize(11);
    doc.text(fullName, xOffset + 6, currentY + 6.5, { width: cols[2].width - 12, lineBreak: false });
    xOffset += cols[2].width;

    // Contact
    doc.fillColor(C_MUTED).font('F_SERIF').fontSize(9.5);
    doc.text(g.phone || 'Non renseigné', xOffset + 4, currentY + 7, { width: cols[3].width - 8, lineBreak: false });
    xOffset += cols[3].width;

    // Places
    const places = g.numberOfGuests || 1;
    doc.fillColor(C_TEXT).font('F_SERIF_BOLD').fontSize(10);
    doc.text(`${places} place${places > 1 ? 's' : ''}`, xOffset + 2, currentY + 7, { width: cols[4].width - 4, align: 'center', lineBreak: false });
    xOffset += cols[4].width;

    // Cérémonie
    const mairieOk = g.ceremony !== false;
    doc.fillColor(mairieOk ? '#15803d' : '#9ca3af').font('F_TITLE_BOLD').fontSize(7.5);
    doc.text(mairieOk ? 'CONFIRMÉ' : '—', xOffset + 2, currentY + 8, { width: cols[5].width - 4, align: 'center', lineBreak: false });
    xOffset += cols[5].width;

    // Soirée
    const soireeOk = g.reception !== false;
    doc.fillColor(soireeOk ? '#15803d' : '#9ca3af').font('F_TITLE_BOLD').fontSize(7.5);
    doc.text(soireeOk ? 'CONFIRMÉ' : '—', xOffset + 2, currentY + 8, { width: cols[6].width - 4, align: 'center', lineBreak: false });
    xOffset += cols[6].width;

    // Observations
    const obs = g.diet || (g.message ? g.message.substring(0, 22) + '...' : 'Standard');
    doc.fillColor(C_MUTED).font('F_SERIF_ITALIC').fontSize(9.5);
    doc.text(obs, xOffset + 4, currentY + 7, { width: cols[7].width - 8, lineBreak: false });
    xOffset += cols[7].width;

    // Émargement / Signature
    if (g.checkedIn) {
      doc.fillColor('#1d4ed8').font('F_TITLE_BOLD').fontSize(7.5);
      const heure = g.checkedInAt ? new Date(g.checkedInAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      doc.text(`ÉMARGÉ (${heure})`, xOffset + 4, currentY + 8, { width: cols[8].width - 8, align: 'center', lineBreak: false });
    } else {
      doc.lineWidth(0.7).strokeColor(C_GOLD);
      doc.rect(xOffset + (cols[8].width / 2) - 14, currentY + 5.5, 28, 14).stroke();
    }

    currentY += rowHeight;
  });

  // Cadre global du tableau
  doc.lineWidth(0.8).strokeColor(C_GOLD).rect(tableX, 154, statsBoxWidth, currentY - 154).stroke();

  // 4. PIED DE PAGE ET NUMÉROTATION
  const footerY = pageHeight - 38;
  doc.lineWidth(0.5).strokeColor(C_GOLD_LIGHT);
  doc.moveTo(32, footerY).lineTo(pageWidth - 32, footerY).stroke();

  doc.fillColor(C_MUTED).font('F_SERIF_ITALIC').fontSize(9);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Document officiel de protocole édité le ${dateFormatted}  ·  Mariage Don-Alpha & Serge  ·  Palais des Congrès de Brazzaville`, 32, footerY + 6, { lineBreak: false });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fillColor(C_GOLD_DARK).font('F_TITLE_BOLD').fontSize(8);
    doc.text(`Page ${i + 1} / ${range.count}`, pageWidth - 96, footerY + 6, { width: 64, align: 'right', lineBreak: false });
  }

  doc.end();
}

module.exports = { generateGuestListPdf };
