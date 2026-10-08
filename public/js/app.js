// ==============================================================
// Mariage Don-Alpha & Serge — Haute Papeterie & Invitation
// ==============================================================

document.addEventListener('DOMContentLoaded', () => {
  initEditorialScroll();
  initCountdown();
  initPetalsEffect();
  initConfirmationForm();
  initDirectInvitationLink();
  initWishes();
  initAudioAmbient();
  initMobileMenu();
});

// 1. SCROLL REVEAL ANIMATIONS ÉDITORIALES
function initEditorialScroll() {
  const elements = document.querySelectorAll('.reveal-editorial, .reveal-left, .reveal-right');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

// 2. COMPTE À REBOURS DU 14 NOVEMBRE 2026 (BRAZZAVILLE)
function initCountdown() {
  const weddingDate = new Date('2026-11-14T10:00:00+01:00').getTime();

  function update() {
    const now = new Date().getTime();
    const difference = weddingDate - now;

    const elDays = document.getElementById('days');
    const elHours = document.getElementById('hours');
    const elMinutes = document.getElementById('minutes');
    const elSeconds = document.getElementById('seconds');

    if (difference <= 0) {
      if (elDays) elDays.innerText = '00';
      if (elHours) elHours.innerText = '00';
      if (elMinutes) elMinutes.innerText = '00';
      if (elSeconds) elSeconds.innerText = '00';
      return;
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    const pad = (n) => String(n).padStart(2, '0');

    if (elDays) elDays.innerText = pad(days);
    if (elHours) elHours.innerText = pad(hours);
    if (elMinutes) elMinutes.innerText = pad(minutes);
    if (elSeconds) elSeconds.innerText = pad(seconds);
  }

  update();
  setInterval(update, 1000);
}

// 3. CONFIRMATION DE PRÉSENCE & SORTIE INVITATION PERSONNALISÉE
function initConfirmationForm() {
  const form = document.getElementById('form-confirmation');
  const btnSubmit = document.getElementById('btn-submit-confirmation');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('conf-name').value.trim();
    const firstname = document.getElementById('conf-firstname').value.trim();
    const phone = document.getElementById('conf-phone').value.trim();
    const attendance = document.querySelector('input[name="conf-attendance"]:checked')?.value || 'yes';
    const guestsCount = document.getElementById('conf-guests').value;
    const ceremony = document.getElementById('conf-ceremony')?.checked ?? true;
    const reception = document.getElementById('conf-reception')?.checked ?? true;
    const diet = document.getElementById('conf-diet').value.trim();
    const message = document.getElementById('conf-message').value.trim();

    if (!name) {
      alert('Veuillez renseigner votre nom.');
      return;
    }

    btnSubmit.disabled = true;
    const initialText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = `
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Enregistrement de votre invitation...
    `;

    try {
      const res = await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          firstname,
          phone,
          attendance,
          guestsCount,
          ceremony,
          reception,
          diet,
          message
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la confirmation.');

      renderPersonalInvitation(data.guest);

      const section = document.getElementById('section-invitation-personnelle');
      if (section) {
        section.classList.remove('hidden');
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      const gId = data.guest?.guestId || data.guest?.invitationId;
      if (gId && gId !== 'undefined') {
        const newUrl = `${window.location.pathname}?invitation=${gId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
      }

      loadWishes();
    } catch (err) {
      alert('Une erreur est survenue : ' + err.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = initialText;
    }
  });
}

function renderPersonalInvitation(guest) {
  const container = document.getElementById('section-invitation-personnelle');
  if (!container) return;

  const elGreeting = document.getElementById('personal-greeting-name');
  const elCardName = document.getElementById('personal-card-name');
  const elPlaces = document.getElementById('personal-places-count');
  const elQr = document.getElementById('personal-qr-image');
  const elId = document.getElementById('personal-guest-id');
  const btnPdf = document.getElementById('btn-download-pdf');

  const greetingName = guest.firstname ? guest.firstname : guest.displayName;

  if (elGreeting) elGreeting.innerText = greetingName;
  if (elCardName) elCardName.innerText = guest.displayName;
  if (elPlaces) elPlaces.innerText = (guest.attendance === 'yes' || guest.attendance === 'confirmed') ? `${guest.numberOfGuests || guest.guestsCount || 1} Place(s) réservée(s)` : 'Participation déclinée';
  if (elId) elId.innerText = guest.guestId;
  if (elQr && guest.qrCodeUrl) elQr.src = guest.qrCodeUrl;
  if (btnPdf) btnPdf.href = `/api/invitation/${guest.guestId}/pdf`;

  container.classList.remove('hidden');
}

// 4. ACCÈS DIRECT PAR LIEN D'INVITATION (ex: ?invitation=INV-XXXXXX)
async function initDirectInvitationLink() {
  const params = new URLSearchParams(window.location.search);
  const guestId = params.get('invitation');
  if (!guestId || guestId === 'undefined' || guestId === 'null') return;

  try {
    const res = await fetch(`/api/invitation/${guestId}`);
    if (res.ok) {
      const guest = await res.json();
      renderPersonalInvitation(guest);
      const section = document.getElementById('section-invitation-personnelle');
      if (section) {
        section.classList.remove('hidden');
        setTimeout(() => {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
      }
    }
  } catch (err) {
    console.error('Erreur chargement invitation:', err);
  }
}

// 5. LIVRE D'OR (VŒUX)
async function initWishes() {
  await loadWishes();

  const form = document.getElementById('form-wishes');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('wish-name').value.trim();
    const relation = document.getElementById('wish-relation').value.trim();
    const message = document.getElementById('wish-message').value.trim();

    if (!name || !message) return;

    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, relation, message })
      });
      if (res.ok) {
        form.reset();
        await loadWishes();
        const toast = document.getElementById('wish-feedback');
        if (toast) {
          toast.classList.remove('hidden');
          setTimeout(() => toast.classList.add('hidden'), 4000);
        }
      }
    } catch (err) {
      console.error(err);
    }
  });
}

async function loadWishes() {
  const container = document.getElementById('wishes-list');
  if (!container) return;

  try {
    const res = await fetch('/api/wishes');
    const wishes = await res.json();

    if (!Array.isArray(wishes) || wishes.length === 0) {
      container.innerHTML = `<p class="text-stone-500 italic text-center col-span-full">Partagez votre premier mot doux pour les mariés.</p>`;
      return;
    }

    container.innerHTML = wishes.slice(0, 9).map(w => `
      <div class="paper-sheet p-8 rounded-2xl relative border border-stone-200/80 shadow-xs">
        <div class="flex items-center justify-between mb-4 border-b border-stone-100 pb-3">
          <div>
            <h4 class="font-serif-luxury font-bold text-lg text-stone-900">${escapeHtml(w.name)}</h4>
            <span class="text-[11px] uppercase tracking-wider text-[#96774e] font-semibold">${escapeHtml(w.relation || 'Proche')}</span>
          </div>
          <span class="text-xs text-stone-400 font-light">${w.date || 'Récemment'}</span>
        </div>
        <p class="text-stone-700 font-serif-luxury italic text-base leading-relaxed">
          « ${escapeHtml(w.message)} »
        </p>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load wishes:', err);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 6. AMBIENT AUDIO HARP / PIANO SYNTH
function initAudioAmbient() {
  const audioBtn = document.getElementById('btn-audio-toggle');
  if (!audioBtn) return;

  let isPlaying = false;
  let audioCtx = null;
  let intervalId = null;

  const notes = [
    261.63, 329.63, 392.00, 493.88, 523.25,
    220.00, 261.63, 329.63, 392.00, 440.00,
    174.61, 220.00, 261.63, 349.23, 440.00,
    196.00, 246.94, 293.66, 392.00, 440.00
  ];

  function playNote(freq) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, audioCtx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 3.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 3.4);
  }

  audioBtn.addEventListener('click', () => {
    if (!isPlaying) {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      isPlaying = true;
      audioBtn.classList.add('bg-[#c5a880]', 'text-white');
      audioBtn.classList.remove('bg-white/95', 'text-stone-700');
      document.getElementById('icon-play').classList.add('hidden');
      document.getElementById('icon-pause').classList.remove('hidden');

      let idx = 0;
      intervalId = setInterval(() => {
        const note = notes[idx % notes.length];
        playNote(note);
        if (Math.random() > 0.55) {
          setTimeout(() => playNote(notes[(idx + 2) % notes.length] * 1.5), 240);
        }
        idx++;
      }, 800);
    } else {
      isPlaying = false;
      clearInterval(intervalId);
      audioBtn.classList.remove('bg-[#c5a880]', 'text-white');
      audioBtn.classList.add('bg-white/95', 'text-stone-700');
      document.getElementById('icon-play').classList.remove('hidden');
      document.getElementById('icon-pause').classList.add('hidden');
    }
  });
}

// 7. AMBIENT DUST / PETALS CANVAS
function initPetalsEffect() {
  const canvas = document.getElementById('petals-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const petals = [];
  const petalCount = 18;

  for (let i = 0; i < petalCount; i++) {
    petals.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 3.5 + 2.5,
      speedX: Math.random() * 0.4 - 0.2,
      speedY: Math.random() * 0.4 + 0.2,
      rotation: Math.random() * 360,
      rotSpeed: Math.random() * 1.0 - 0.5,
      opacity: Math.random() * 0.3 + 0.1,
      color: Math.random() > 0.5 ? 'rgba(197, 168, 128, ' : 'rgba(235, 219, 198, '
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    petals.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = `${p.color}${p.opacity})`;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(p.size, -p.size, p.size * 2, 0);
      ctx.quadraticCurveTo(p.size, p.size, 0, 0);
      ctx.fill();

      ctx.restore();

      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;

      if (p.y > height + 20) {
        p.y = -20;
        p.x = Math.random() * width;
      }
      if (p.x > width + 20) p.x = -20;
      if (p.x < -20) p.x = width + 20;
    });

    requestAnimationFrame(render);
  }

  render();
}

// 8. MOBILE MENU TOGGLE
function initMobileMenu() {
  const btn = document.getElementById('btn-mobile-menu');
  const drawer = document.getElementById('mobile-menu-drawer');
  if (!btn || !drawer) return;

  btn.addEventListener('click', () => {
    drawer.classList.toggle('hidden');
  });

  const links = drawer.querySelectorAll('.mobile-nav-link');
  links.forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.add('hidden');
    });
  });
}

// 9. HEADER DYNAMIC SCROLL (TRANSPARENT ON HERO)
function initHeaderScroll() {
  const header = document.getElementById('main-header');
  if (!header) return;

  function updateHeader() {
    if (window.scrollY > 50) {
      header.classList.remove('at-top');
    } else {
      header.classList.add('at-top');
    }
  }

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
}

