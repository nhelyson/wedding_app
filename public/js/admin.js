// ==============================================================
// Mariage Don-Alpha & Serge — Administration & Scanner Caméra
// ==============================================================

const API_BASE = '/api/admin';
let currentToken = localStorage.getItem('wedding_admin_token') || '';
let guestsList = [];
let html5QrCode = null;
let isScannerActive = false;

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initSearchAndFilter();
  initCheckinScanner();

  
  const btnDownloadPdf = document.getElementById('btn-download-pdf');
  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', downloadOfficialPdf);
  }

  const btnDownload = document.getElementById('btn-download-csv');
  if (btnDownload) {
    btnDownload.addEventListener('click', exportGuestsToCsv);
  }
  const btnPrint = document.getElementById('btn-print-list');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => window.print());
  }

});

// Authentication
function initAuth() {
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const btnLogout = document.getElementById('btn-logout');

  if (!currentToken) {
    loginModal.classList.remove('hidden');
    loginModal.classList.add('flex');
  } else {
    loadDashboard();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('admin-password').value.trim();
      try {
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (res.ok && data.token) {
          currentToken = data.token;
          localStorage.setItem('wedding_admin_token', currentToken);
          loginModal.classList.add('hidden');
          loginModal.classList.remove('flex');
          loadDashboard();
        } else {
          document.getElementById('login-error').innerText = data.error || 'Code d\'accès incorrect.';
          document.getElementById('login-error').classList.remove('hidden');
        }
      } catch (err) {
        alert('Erreur réseau lors de la connexion.');
      }
    });
  }

  const doLogout = () => {
    localStorage.removeItem('wedding_admin_token');
    window.location.reload();
  };

  if (btnLogout) {
    btnLogout.addEventListener('click', doLogout);
  }
  const btnLogoutDesktop = document.getElementById('btn-logout-desktop');
  if (btnLogoutDesktop) {
    btnLogoutDesktop.addEventListener('click', doLogout);
  }
}

// Load Dashboard Data
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/guests`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('wedding_admin_token');
      window.location.reload();
      return;
    }

    const data = await res.json();
    guestsList = data.guests || [];

    // Render Stats
    if (data.stats) {
      document.getElementById('stat-total-invites').innerText = data.stats.totalInvitations;
      document.getElementById('stat-confirmed').innerText = data.stats.confirmed;
      document.getElementById('stat-pending').innerText = data.stats.pending;
      document.getElementById('stat-declined').innerText = data.stats.declined;
      document.getElementById('stat-people').innerText = data.stats.totalExpectedPeople;
      document.getElementById('stat-checkedin').innerText = data.stats.checkedInCount;
    }

    renderTable(guestsList);
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// Render Table (Desktop) & Cards (Mobile)
function renderTable(list) {
  const tbody = document.getElementById('guests-table-body');
  const cardsContainer = document.getElementById('guests-cards-container');

  if (list.length === 0) {
    const emptyMsg = 'Aucun invité ne correspond à votre recherche.';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-stone-400 italic">${emptyMsg}</td></tr>`;
    }
    if (cardsContainer) {
      cardsContainer.innerHTML = `<div class="py-8 text-center text-stone-400 italic text-sm">${emptyMsg}</div>`;
    }
    return;
  }

  // Helper for badges
  function getBadges(g) {
    const attendance = g.attendance || g.status || 'confirmed';
    let statusBadge = '';
    if (attendance === 'confirmed') {
      statusBadge = `<span class="badge-status badge-confirmed">● Confirmé</span>`;
    } else if (attendance === 'declined') {
      statusBadge = `<span class="badge-status badge-declined">✕ Décliné</span>`;
    } else {
      statusBadge = `<span class="badge-status badge-pending">⏳ En attente</span>`;
    }

    const checkInBadge = g.checkedIn 
      ? `<span class="badge-status badge-checkedin" title="Arrivé à ${g.checkedInAt ? new Date(g.checkedInAt).toLocaleTimeString() : ''}">✓ Émargé</span>` 
      : `<span class="badge-status text-stone-400 bg-stone-50 border border-stone-200">Non émargé</span>`;

    return { statusBadge, checkInBadge };
  }

  // 1. Desktop Table
  if (tbody) {
    tbody.innerHTML = list.map(g => {
      const id = g.invitationId || g.guestId || '';
      const places = g.numberOfGuests || g.guestsCount || 1;
      const { statusBadge, checkInBadge } = getBadges(g);

      return `
        <tr class="table-row-hover border-b border-stone-100 transition">
          <td class="py-4 px-4">
            <div class="font-serif-luxury font-bold text-stone-900 text-base">${escapeHtml(g.displayName)}</div>
            <div class="text-xs text-stone-400 font-mono">${id}</div>
          </td>
          <td class="py-4 px-4 text-xs text-stone-600">
            ${escapeHtml(g.phone || '—')}
          </td>
          <td class="py-4 px-4 text-center font-bold text-stone-800 text-sm">
            ${places}
          </td>
          <td class="py-4 px-4 text-center">
            ${statusBadge}
          </td>
          <td class="py-4 px-4 text-center">
            ${checkInBadge}
          </td>
          <td class="py-4 px-4 text-right space-x-2 whitespace-nowrap">
            <a href="/api/invitation/${id}/pdf" target="_blank" class="inline-block text-xs bg-stone-100 hover:bg-[#c5a880] hover:text-white px-3 py-1.5 rounded-lg border border-stone-200 transition font-medium">
              PDF 📄
            </a>
            <button onclick="openCheckInModal('${id}')" class="text-xs bg-[#c5a880] text-white hover:bg-[#96774e] px-3 py-1.5 rounded-lg transition font-medium">
              Émarger
            </button>
            <button onclick="deleteGuest('${id}')" class="text-xs text-red-500 hover:text-red-700 px-2 py-1.5 transition" title="Supprimer">
              ✕
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 2. Mobile Cards
  if (cardsContainer) {
    cardsContainer.innerHTML = list.map(g => {
      const id = g.invitationId || g.guestId || '';
      const places = g.numberOfGuests || g.guestsCount || 1;
      const { statusBadge, checkInBadge } = getBadges(g);

      return `
        <div class="p-4 space-y-3 bg-white hover:bg-stone-50/50 transition">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="font-serif-luxury font-bold text-stone-900 text-lg leading-tight truncate">
                ${escapeHtml(g.displayName)}
              </div>
              <div class="text-xs text-stone-400 font-mono mt-0.5">${id}</div>
            </div>
            <div class="shrink-0">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#faf7f2] border border-[#c5a880]/30 text-[#96774e]">
                ${places} ${places > 1 ? 'places' : 'place'}
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs">
            ${statusBadge}
            ${checkInBadge}
            ${g.phone ? `<span class="text-stone-500 font-mono text-[11px] bg-stone-50 px-2 py-0.5 rounded border border-stone-200">📞 ${escapeHtml(g.phone)}</span>` : ''}
          </div>

          <div class="pt-2 flex items-center justify-between gap-2 border-t border-stone-100">
            <div class="flex items-center gap-2">
              <a href="/api/invitation/${id}/pdf" target="_blank" class="inline-flex items-center gap-1 text-xs bg-stone-100 hover:bg-[#c5a880] hover:text-white px-3 py-2 rounded-xl border border-stone-200 transition font-medium">
                📄 PDF
              </a>
              <button onclick="deleteGuest('${id}')" class="text-xs text-red-500 hover:text-red-700 p-2 rounded-xl hover:bg-red-50 transition" title="Supprimer">
                ✕
              </button>
            </div>

            <button onclick="openCheckInModal('${id}')" class="flex-1 max-w-[170px] text-center text-xs bg-[#c5a880] text-white hover:bg-[#96774e] px-4 py-2 rounded-xl transition font-semibold tracking-wider uppercase shadow-xs">
              ${g.checkedIn ? 'Re-Émarger' : 'Émarger'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Search & Filter
function initSearchAndFilter() {
  const searchInput = document.getElementById('search-input');
  const tabs = document.querySelectorAll('.filter-tab');

  let activeFilter = 'all';

  function applyFilter() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const filtered = guestsList.filter(g => {
      const id = (g.invitationId || g.guestId || '').toLowerCase();
      const name = (g.displayName || '').toLowerCase();
      const phone = (g.phone || '').toLowerCase();

      const matchQuery = !q || name.includes(q) || id.includes(q) || phone.includes(q);
      if (!matchQuery) return false;

      const attendance = g.attendance || g.status || 'confirmed';

      if (activeFilter === 'all') return true;
      if (activeFilter === 'confirmed') return attendance === 'confirmed';
      if (activeFilter === 'pending') return attendance === 'pending';
      if (activeFilter === 'declined') return attendance === 'declined';
      if (activeFilter === 'checkedin') return g.checkedIn === true;
      return true;
    });

    renderTable(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilter);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('bg-[#c5a880]', 'text-white'));
      tabs.forEach(t => t.classList.add('bg-white', 'text-stone-700'));
      tab.classList.remove('bg-white', 'text-stone-700');
      tab.classList.add('bg-[#c5a880]', 'text-white');

      activeFilter = tab.getAttribute('data-filter');
      applyFilter();
    });
  });
}

// CAMERA SCANNER & CHECK-IN MODAL
function initCheckinScanner() {
  const btnScan = document.getElementById('btn-open-scanner');
  const modal = document.getElementById('checkin-modal');
  const btnClose = document.getElementById('btn-close-checkin');
  const tabCamera = document.getElementById('tab-camera-mode');
  const tabManual = document.getElementById('tab-manual-mode');
  const sectionCamera = document.getElementById('camera-scanner-section');
  const sectionManual = document.getElementById('manual-scanner-section');
  const form = document.getElementById('checkin-form');

  if (btnScan) {
    btnScan.addEventListener('click', () => {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      startCameraScanner();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      stopCameraScanner();
      document.getElementById('checkin-result').classList.add('hidden');
    });
  }

  // Switch tabs
  if (tabCamera && tabManual) {
    tabCamera.addEventListener('click', () => {
      tabCamera.classList.add('border-b-2', 'border-[#c5a880]', 'text-[#c5a880]');
      tabManual.classList.remove('border-b-2', 'border-[#c5a880]', 'text-[#c5a880]');
      tabManual.classList.add('text-stone-400');
      sectionCamera.classList.remove('hidden');
      sectionManual.classList.add('hidden');
      startCameraScanner();
    });

    tabManual.addEventListener('click', () => {
      tabManual.classList.add('border-b-2', 'border-[#c5a880]', 'text-[#c5a880]');
      tabCamera.classList.remove('border-b-2', 'border-[#c5a880]', 'text-[#c5a880]');
      tabCamera.classList.add('text-stone-400');
      sectionManual.classList.remove('hidden');
      sectionCamera.classList.add('hidden');
      stopCameraScanner();
      document.getElementById('checkin-query').focus();
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = document.getElementById('checkin-query').value.trim();
      if (!query) return;
      lookupGuest(query, false);
    });
  }
}

async function startCameraScanner() {
  if (typeof Html5Qrcode === 'undefined') {
    console.warn('Html5Qrcode non chargé, utilisation saisie manuelle.');
    return;
  }

  if (isScannerActive) return;

  const readerDiv = document.getElementById('qr-reader');
  if (!readerDiv) return;

  try {
    html5QrCode = new Html5Qrcode("qr-reader");
    isScannerActive = true;

    await html5QrCode.start(
      { facingMode: "environment" },
      { 
        fps: 10, 
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(160, Math.floor(edge * 0.7));
          return { width: boxSize, height: boxSize };
        }
      },
      (decodedText) => {
        playBeep();
        stopCameraScanner();
        lookupGuest(decodedText, false);
      },
      (errorMessage) => {
        // scan régulier
      }
    );
  } catch (err) {
    console.error('Caméra non disponible:', err);
    document.getElementById('camera-scanner-section').innerHTML += `
      <div class="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-3 text-center">
        Caméra non disponible ou permission refusée. Utilisez la saisie manuelle.
      </div>
    `;
  }
}

async function stopCameraScanner() {
  if (html5QrCode && isScannerActive) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (e) {
      console.warn('Error stopping scanner:', e);
    }
    isScannerActive = false;
  }
}

window.openCheckInModal = function(id) {
  const modal = document.getElementById('checkin-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lookupGuest(id, false);
};

async function lookupGuest(query, autoConfirm = false) {
  const resultDiv = document.getElementById('checkin-result');
  resultDiv.classList.remove('hidden');
  resultDiv.innerHTML = `<div class="py-4 text-center text-xs text-stone-500">Recherche de l'invitation dans MongoDB Atlas...</div>`;

  try {
    const res = await fetch(`${API_BASE}/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ query, confirmCheckIn: autoConfirm })
    });

    const data = await res.json();

    if (!res.ok || !data.guest) {
      resultDiv.innerHTML = `
        <div class="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-center text-sm">
          <strong>Introuvable :</strong> ${data.error || 'Aucune invitation trouvée pour ce QR Code.'}
        </div>
      `;
      return;
    }

    const g = data.guest;
    const places = g.numberOfGuests || g.guestsCount || 1;
    const id = g.invitationId || g.guestId;

    resultDiv.innerHTML = `
      <div class="p-4 sm:p-6 bg-[#faf7f2] rounded-2xl border border-[#c5a880]/40 text-center space-y-3 sm:space-y-4">
        <span class="text-xs uppercase tracking-widest text-[#96774e] font-semibold block">Invitation Officielle Validée</span>
        <h4 class="font-serif-luxury font-bold text-xl sm:text-2xl text-stone-900">${escapeHtml(g.displayName)}</h4>
        
        <div class="inline-block px-3 py-1 bg-white rounded-full border border-stone-200 text-xs font-mono text-stone-600">
          ${id}
        </div>

        <div class="flex justify-center gap-6 text-sm text-stone-700 py-2 border-y border-stone-200/60">
          <div>
            <span class="text-[10px] uppercase text-stone-400 block font-semibold">Places réservées</span>
            <strong class="text-stone-900">${places} personne(s)</strong>
          </div>
          <div>
            <span class="text-[10px] uppercase text-stone-400 block font-semibold">Statut</span>
            <strong class="${g.checkedIn ? 'text-blue-600' : 'text-emerald-600'}">
              ${g.checkedIn ? 'Déjà Émargé' : 'En attente d\'entrée'}
            </strong>
          </div>
        </div>

        ${!g.checkedIn ? `
          <button onclick="confirmCheckInAction('${id}')" class="w-full bg-[#c5a880] hover:bg-[#96774e] text-white py-3 rounded-xl font-semibold text-xs uppercase tracking-wider transition shadow-md">
            Valider l'Émargement d'Accès ✓
          </button>
        ` : `
          <div class="p-3 bg-blue-50 text-blue-800 text-xs font-semibold rounded-xl border border-blue-200">
            ✓ Cet invité a déjà été émargé à l'accueil.
          </div>
        `}
      </div>
    `;

    loadDashboard();
  } catch (err) {
    resultDiv.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-2xl text-center text-xs">Erreur de communication avec le serveur.</div>`;
  }
}

window.confirmCheckInAction = function(id) {
  lookupGuest(id, true);
};

window.deleteGuest = async function(id) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer cette invitation (${id}) ? Cette action est irréversible.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/guests/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (res.ok) {
      loadDashboard();
    } else {
      alert('Erreur lors de la suppression.');
    }
  } catch (err) {
    alert('Erreur réseau.');
  }
};

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    // audio feedback facultatif
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ==============================================================
// TÉLÉCHARGEMENT DE LA LISTE DES INVITÉS (CSV / EXCEL UTF-8)
// ==============================================================
function exportGuestsToCsv() {
  if (!guestsList || guestsList.length === 0) {
    alert('Aucun invité enregistré à exporter pour le moment.');
    return;
  }

  const headers = [
    'N°',
    'Référence Invitation',
    'Nom & Prénom',
    'Téléphone',
    'Places Réservées',
    'Statut Présence',
    'Cérémonie Civile (Mairie)',
    'Soirée Réception (Palais des Congrès)',
    'Régime / Préférences',
    'Émargement Jour J',
    'Heure Émargement',
    'Message aux Mariés',
    'Date Inscription'
  ];

  const rows = guestsList.map((g, index) => {
    const ref = g.invitationId || '';
    const fullName = (g.displayName || ((g.firstName || '') + ' ' + (g.lastName || ''))).trim();
    const phone = g.phone || 'Non renseigné';
    const places = g.numberOfGuests || g.guestsCount || 1;
    const status = g.attendance === 'confirmed' ? 'Confirmé' : (g.attendance === 'declined' ? 'Décliné' : 'En attente');
    const ceremony = g.ceremony !== false ? 'Oui' : 'Non';
    const reception = g.reception !== false ? 'Oui' : 'Non';
    const diet = g.diet || 'Standard';
    const checkedIn = g.checkedIn ? 'Émargé' : 'Non émargé';
    const checkedInAt = g.checkedInAt ? new Date(g.checkedInAt).toLocaleString('fr-FR') : '';
    const message = (g.message || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
    const createdAt = (g.createdAt || g.confirmedAt) ? new Date(g.createdAt || g.confirmedAt).toLocaleDateString('fr-FR') : '';

    return [
      index + 1,
      `"${ref}"`,
      `"${fullName.replace(/"/g, '""')}"`,
      `"${phone}"`,
      places,
      `"${status}"`,
      `"${ceremony}"`,
      `"${reception}"`,
      `"${diet}"`,
      `"${checkedIn}"`,
      `"${checkedInAt}"`,
      `"${message}"`,
      `"${createdAt}"`
    ].join(';');
  });

  // BOM UTF-8 (\uFEFF) pour compatibilité native avec Excel français
  const csvContent = '\uFEFF' + headers.join(';') + '\r\n' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `Liste_Invites_Mariage_DonAlpha_Serge_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


// Téléchargement du Registre Officiel PDF Haute Définition
// Téléchargement du Registre Officiel PDF Haute Définition
// Téléchargement du Registre Officiel PDF Haute Définition
async function downloadOfficialPdf() {
  const btn = document.getElementById('btn-download-pdf');
  const originalHtml = btn ? btn.innerHTML : '';
  const token = currentToken || localStorage.getItem('wedding_admin_token') || 'serge-alpha-2026';

  try {
    if (btn) {
      btn.innerHTML = '<span>⏳</span><span>Génération...</span>';
      btn.disabled = true;
    }

    const res = await fetch(`/api/admin/guests-pdf?token=${encodeURIComponent(token)}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true'
      }
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/pdf')) {
      const errText = await res.text();
      console.warn('Réponse non-PDF du serveur :', errText);
      throw new Error(errText || `Erreur serveur (${res.status})`);
    }

    const blob = await res.blob();
    if (blob.size < 500) {
      throw new Error('Fichier PDF trop petit ou vide reçu');
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Registre_Officiel_Invites_DonAlpha_Serge.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (err) {
    console.warn('Téléchargement direct via window.location :', err);
    window.location.href = `/api/admin/guests-pdf?token=${encodeURIComponent(token)}`;
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
}
