/* ═══════════════════════════════════════
   HOMEFIX SMART SERVICES – app.js
   Connects to: localhost:5000
   ═══════════════════════════════════════ */

const API = 'http://localhost:5000';

// ── Service metadata (icons + descriptions to enrich DB data) ──
const SVC_META = {
  'AC Service & Repair':     { icon:'❄️', tags:['Same Day','Certified'],      fallbackPrice:'From ₹399' },
  'Plumbing':                { icon:'🔧', tags:['24/7 Emergency','Warranty'],  fallbackPrice:'From ₹149' },
  'Electrician':             { icon:'⚡', tags:['Licensed','Safe'],            fallbackPrice:'From ₹149' },
  'Electrical':              { icon:'⚡', tags:['Licensed','Safe'],            fallbackPrice:'From ₹149' },
  'Cleaning & Pest Control': { icon:'🧹', tags:['Eco-Friendly','Insured'],    fallbackPrice:'From ₹299' },
  'Cleaning':                { icon:'🧹', tags:['Eco-Friendly','Insured'],    fallbackPrice:'From ₹299' },
  'Painting':                { icon:'🎨', tags:['Quality Paint','Neat Work'], fallbackPrice:'From ₹8/sqft' },
  'Carpenter':               { icon:'🪚', tags:['Skilled','Quality Wood'],    fallbackPrice:'From ₹399' },
  'Carpentry':               { icon:'🪚', tags:['Skilled','Quality Wood'],    fallbackPrice:'From ₹399' },
  'Appliance Repair':        { icon:'🔌', tags:['All Brands','Warranty'],     fallbackPrice:'From ₹299' },
  'Water Purifier':          { icon:'💧', tags:['RO Expert','Certified'],     fallbackPrice:'From ₹299' },
};

// ── State ──────────────────────────────
let STATE = {
  user: null,
  token: localStorage.getItem('hfs_token') || null,
  services: [],
  currentService: null,
  currentServiceId: null,
  selectedSubService: null,
  selectedSubPrice: null,
};

// ── Init ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initScroll();
  setMinDate();
  loadServices();
  if (STATE.token) restoreSession();
});

function initScroll() {
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 30);
  });
}

function setMinDate() {
  const d = document.getElementById('bookDate');
  if (d) d.min = new Date().toISOString().split('T')[0];
}

// ── City sync across all dropdowns ─────
function syncCity(city) {
  ['globalCity','heroCity','bookCity'].forEach(id => {
    const el = document.getElementById(id);
    if (el && city) el.value = city;
  });
  if (city) showToast(`📍 City set to ${city}`, 'info');
}
function syncCityFromHero(city) { syncCity(city); }
function pickCity(city) {
  syncCity(city);
  document.getElementById('services').scrollIntoView({ behavior: 'smooth' });
  showToast(`📍 Showing services for ${city}`, 'info');
}
function goToServices() {
  const city = document.getElementById('heroCity').value;
  if (city) syncCity(city);
  document.getElementById('services').scrollIntoView({ behavior: 'smooth' });
}

// ── Mobile menu ────────────────────────
function toggleMobile() {
  document.getElementById('mobileMenu').classList.toggle('hidden');
}

// ── Overlay click to close ─────────────
function handleOverlayClick(e, id) {
  if (e.target.id === id) {
    document.getElementById(id).classList.add('hidden');
  }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['authModal','bookingModal','bookingsModal'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
  }
});

// ══════════════════════════════════════
// LOAD SERVICES FROM API
// ══════════════════════════════════════
async function loadServices() {
  const grid = document.getElementById('servicesGrid');
  const statusEl = document.getElementById('apiStatus');

  try {
    const res = await fetch(`${API}/api/services`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Deduplicate by name
    const seen = new Set();
    STATE.services = data.filter(s => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });

    statusEl.classList.add('hidden');
    renderServices(STATE.services);

    // Update API live indicator
    document.getElementById('apiLive').textContent = '● Live';
    document.getElementById('apiLive').classList.remove('offline');

    // Update contact form service list dynamically
    const cSvc = document.getElementById('cService');
    if (cSvc && STATE.services.length) {
      cSvc.innerHTML = STATE.services.map(s => `<option>${s.name}</option>`).join('');
    }

  } catch (err) {
    console.error('API Error:', err);
    document.getElementById('apiLive').textContent = '● Offline';
    document.getElementById('apiLive').classList.add('offline');
    statusEl.className = 'api-status warning';
    statusEl.innerHTML = '⚠️ Could not reach backend. Make sure your server is running on port 5000. Showing sample services.';
    statusEl.classList.remove('hidden');
    renderFallbackServices();
  }
}

function renderServices(services) {
  const grid = document.getElementById('servicesGrid');
  grid.innerHTML = '';

  services.forEach((svc, i) => {
    const meta = SVC_META[svc.name] || { icon:'🔨', tags:['Certified'], fallbackPrice:'Call for price' };
    const price = svc.basePrice ? `From ₹${svc.basePrice}` : meta.fallbackPrice;
    const subCount = svc.subServices?.length || 0;

    const card = document.createElement('div');
    card.className = 'service-card';
    card.style.animationDelay = `${i * 0.07}s`;
    card.innerHTML = `
      <span class="svc-icon">${meta.icon}</span>
      <h3>${svc.name}</h3>
      <div class="svc-tags">${meta.tags.map(t=>`<span class="svc-tag">${t}</span>`).join('')}</div>
      <p>${svc.description || 'Professional home service by certified expert technicians.'}</p>
      ${subCount ? `<p class="svc-sub-count">📋 ${subCount} sub-service${subCount>1?'s':''} available</p>` : ''}
      <div class="svc-footer">
        <span class="svc-price">${price}</span>
        <button class="svc-book-btn" onclick="openBooking('${esc(svc.name)}','${svc._id}')">Book Now →</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderFallbackServices() {
  const fallback = Object.entries(SVC_META).map(([name, meta], i) => ({
    name, _id: `fallback_${i}`,
    description: 'Professional home service by certified expert technicians.',
    basePrice: null,
    subServices: [
      { name: 'Standard Service', price: 499 },
      { name: 'Premium Service', price: 999 }
    ]
  }));
  STATE.services = fallback;
  renderServices(fallback);
}

function esc(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ══════════════════════════════════════
// AUTH
// ══════════════════════════════════════
function openAuth(tab = 'login') {
  clearFormErrors();
  document.getElementById('authModal').classList.remove('hidden');
  switchTab(tab);
}
function closeAuth() {
  document.getElementById('authModal').classList.add('hidden');
}
function switchTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
}

// LOGIN — uses email + password (matches your backend)
async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errEl.classList.add('hidden');
  btn.textContent = 'Signing in...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value
      })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      STATE.token = data.token;
      STATE.user = data.user;
      localStorage.setItem('hfs_token', data.token);
      updateUserUI();
      closeAuth();
      showToast(`👋 Welcome back, ${data.user.name}!`, 'success');
    } else {
      showFieldError(errEl, data.message || 'Login failed. Check your email and password.');
    }
  } catch (err) {
    showFieldError(errEl, '❌ Cannot connect to server. Is your backend running on port 5000?');
  } finally {
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}

// REGISTER — uses name, email, password, phone, address (matches your backend exactly)
async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('regError');
  const btn = document.getElementById('registerBtn');
  errEl.classList.add('hidden');

  const password = document.getElementById('regPassword').value;
  if (password.length < 6) {
    showFieldError(errEl, 'Password must be at least 6 characters.');
    return;
  }

  btn.textContent = 'Creating account...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        phone: document.getElementById('regPhone').value.trim(),
        address: document.getElementById('regAddress').value.trim(),
        password
      })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      STATE.token = data.token;
      STATE.user = data.user;
      localStorage.setItem('hfs_token', data.token);
      updateUserUI();
      closeAuth();
      showToast(`🎉 Welcome to HomeFix, ${data.user.name}!`, 'success');
    } else {
      showFieldError(errEl, data.message || 'Registration failed. Please try again.');
    }
  } catch (err) {
    showFieldError(errEl, '❌ Cannot connect to server. Is your backend running on port 5000?');
  } finally {
    btn.textContent = 'Create Account';
    btn.disabled = false;
  }
}

async function restoreSession() {
  try {
    // Try to verify token by fetching bookings (no /me endpoint in your backend)
    const res = await fetch(`${API}/api/bookings`, {
      headers: { Authorization: `Bearer ${STATE.token}` }
    });
    if (res.ok) {
      // Token is valid — restore from localStorage
      const stored = localStorage.getItem('hfs_user');
      if (stored) {
        STATE.user = JSON.parse(stored);
        updateUserUI();
      } else {
        // Token valid but no cached user — clear
        logout(true);
      }
    } else {
      logout(true); // Token expired
    }
  } catch (e) {
    // Offline — keep token but don't crash
  }
}

function logout(silent = false) {
  STATE.token = null;
  STATE.user = null;
  localStorage.removeItem('hfs_token');
  localStorage.removeItem('hfs_user');
  updateUserUI();
  if (!silent) showToast('👋 Logged out successfully', 'info');
}

function updateUserUI() {
  const authBtns = document.getElementById('authButtons');
  const userMenu = document.getElementById('userMenu');
  const mobileAuth = document.getElementById('mobileAuth');
  const mobileUser = document.getElementById('mobileUser');
  const greeting = document.getElementById('userGreeting');
  const avatar = document.getElementById('userAvatar');

  if (STATE.user) {
    localStorage.setItem('hfs_user', JSON.stringify(STATE.user));
    authBtns.classList.add('hidden');
    userMenu.classList.remove('hidden');
    mobileAuth.classList.add('hidden');
    mobileUser.classList.remove('hidden');
    const name = STATE.user.name || 'Customer';
    greeting.textContent = name.split(' ')[0]; // First name only
    avatar.textContent = name.charAt(0).toUpperCase();
  } else {
    authBtns.classList.remove('hidden');
    userMenu.classList.add('hidden');
    mobileAuth.classList.remove('hidden');
    mobileUser.classList.add('hidden');
  }
}

// ══════════════════════════════════════
// BOOKING
// ══════════════════════════════════════
function openBooking(serviceName, serviceId) {
  if (!STATE.user) {
    showToast('🔒 Please login to book a service', 'error');
    openAuth('login');
    return;
  }

  STATE.currentService = serviceName;
  STATE.currentServiceId = serviceId;
  STATE.selectedSubService = null;
  STATE.selectedSubPrice = null;

  // Find service data
  const svc = STATE.services.find(s => s._id === serviceId || s.name === serviceName);
  const meta = SVC_META[serviceName] || { icon: '🔧' };

  // Set modal header
  document.getElementById('bookingServiceIcon').textContent = meta.icon;
  document.getElementById('bookingServiceName').textContent = serviceName;
  document.getElementById('bookingServiceDesc').textContent =
    svc?.description || 'Select your requirements below';

  // Build sub-service buttons
  const list = document.getElementById('subServiceList');
  const subServices = svc?.subServices?.filter(s => s.isActive !== false) || [];

  if (subServices.length) {
    list.innerHTML = subServices.map(sub => `
      <button class="sub-btn" onclick="selectSub(this,'${esc(sub.name)}',${sub.price||0})">
        <strong>${sub.name}</strong>
        ${sub.price ? `<small>₹${sub.price}${sub.duration ? ' · ' + sub.duration : ''}</small>` : ''}
      </button>
    `).join('');
  } else {
    list.innerHTML = `
      <button class="sub-btn" onclick="selectSub(this,'Standard Service',499)"><strong>Standard Service</strong><small>₹499</small></button>
      <button class="sub-btn" onclick="selectSub(this,'Premium Service',999)"><strong>Premium Service</strong><small>₹999</small></button>
    `;
  }

  // Pre-fill city
  const city = document.getElementById('globalCity').value;
  if (city) document.getElementById('bookCity').value = city;

  // Reset steps
  document.getElementById('bookingStep1').classList.remove('hidden');
  document.getElementById('bookingSuccess').classList.add('hidden');
  document.getElementById('priceDisplay').classList.add('hidden');
  document.getElementById('bookError').classList.add('hidden');

  document.getElementById('bookingModal').classList.remove('hidden');
}

function selectSub(btn, name, price) {
  document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  STATE.selectedSubService = name;
  STATE.selectedSubPrice = price;

  if (price) {
    document.getElementById('priceValue').textContent = `₹${price}`;
    document.getElementById('priceDisplay').classList.remove('hidden');
  }
}

function closeBooking() {
  document.getElementById('bookingModal').classList.add('hidden');
}

async function submitBooking() {
  const errEl = document.getElementById('bookError');
  const btn = document.getElementById('confirmBookBtn');
  errEl.classList.add('hidden');

  // Validate
  if (!STATE.selectedSubService) { showFieldError(errEl,'Please select a sub-service above.'); return; }
  const city = document.getElementById('bookCity').value;
  const date = document.getElementById('bookDate').value;
  const time = document.getElementById('bookTime').value;
  const address = document.getElementById('bookAddress').value.trim();
  if (!city)    { showFieldError(errEl,'Please select your city.'); return; }
  if (!date)    { showFieldError(errEl,'Please select a date.'); return; }
  if (!time)    { showFieldError(errEl,'Please select a time slot.'); return; }
  if (!address) { showFieldError(errEl,'Please enter the service address.'); return; }

  btn.textContent = 'Confirming...';
  btn.disabled = true;

  const payload = {
    serviceId: STATE.currentServiceId,
    subServiceId: STATE.selectedSubService,
    city,
    area: document.getElementById('bookArea').value.trim(),
    date,
    time,
    address,
    notes: document.getElementById('bookNotes').value.trim(),
    price: STATE.selectedSubPrice,
    totalAmount: STATE.selectedSubPrice,
    status: 'pending'
  };

  try {
    const res = await fetch(`${API}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      showBookingSuccess(data.booking || data, payload);
    } else {
      showFieldError(errEl, data.message || 'Booking failed. Please try again.');
    }
  } catch (err) {
    showFieldError(errEl, '❌ Cannot connect to server. Is your backend running on port 5000?');
  } finally {
    btn.textContent = 'Confirm Booking →';
    btn.disabled = false;
  }
}

function showBookingSuccess(booking, payload) {
  const bookingId = booking._id || booking.bookingId || 'HFS' + Date.now();
  const shortId = String(bookingId).slice(-8).toUpperCase();

  document.getElementById('bookingConfirmCard').innerHTML = `
    <div style="margin-bottom:6px">📋 <strong>Booking ID:</strong> #${shortId}</div>
    <div style="margin-bottom:6px">🔧 <strong>Service:</strong> ${STATE.currentService} — ${STATE.selectedSubService}</div>
    <div style="margin-bottom:6px">📍 <strong>City:</strong> ${payload.city}</div>
    <div style="margin-bottom:6px">🗓️ <strong>Date & Time:</strong> ${payload.date} at ${payload.time}</div>
    ${STATE.selectedSubPrice ? `<div>💰 <strong>Amount:</strong> ₹${STATE.selectedSubPrice}</div>` : ''}
  `;

  document.getElementById('bookingStep1').classList.add('hidden');
  document.getElementById('bookingSuccess').classList.remove('hidden');
  showToast('✅ Booking confirmed! Technician will contact you soon.', 'success');
}

function openMyBookings() {
  if (!STATE.user) { openAuth('login'); return; }
  document.getElementById('bookingsModal').classList.remove('hidden');
  fetchMyBookings();
}

async function fetchMyBookings() {
  const list = document.getElementById('bookingsList');
  list.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:14px;color:#888">Loading...</p></div>';

  try {
    const res = await fetch(`${API}/api/bookings`, {
      headers: { Authorization: `Bearer ${STATE.token}` }
    });
    const bookings = await res.json();

    if (!Array.isArray(bookings) || bookings.length === 0) {
      list.innerHTML = `<div class="no-bookings">📋<br/><br/>No bookings yet.<br/><small>Your booked services will appear here.</small></div>`;
      return;
    }

    list.innerHTML = bookings.map(b => {
      const svc = STATE.services.find(s => s._id === b.serviceId) || {};
      const meta = SVC_META[svc.name] || { icon: '🔧' };
      const statusClass = `status-${b.status || 'pending'}`;
      const shortId = String(b._id).slice(-6).toUpperCase();
      return `
        <div class="booking-item">
          <div class="booking-item-icon">${meta.icon || '🔧'}</div>
          <div class="booking-item-info">
            <strong>${svc.name || 'Home Service'} — ${b.subServiceId || ''}</strong>
            <p>📅 ${b.date || 'N/A'} at ${b.time || 'N/A'}<br/>
               📍 ${b.city || ''} ${b.area ? '· ' + b.area : ''}<br/>
               🏠 ${b.address || ''}<br/>
               ${b.totalAmount ? `💰 ₹${b.totalAmount}` : ''}</p>
          </div>
          <div>
            <span class="booking-status ${statusClass}">${b.status || 'Pending'}</span>
            <div style="font-size:11px;color:#666;margin-top:6px;text-align:right">#${shortId}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="no-bookings">❌ Could not load bookings.<br/><small>Check your connection.</small></div>`;
  }
}

// ══════════════════════════════════════
// CONTACT FORM
// ══════════════════════════════════════
async function submitContact(e) {
  e.preventDefault();
  const successEl = document.getElementById('contactSuccess');
  successEl.classList.add('hidden');

  // Just show success (no contact endpoint in your backend — add one later)
  setTimeout(() => {
    successEl.classList.remove('hidden');
    e.target.reset();
    showToast('✅ Message received! We\'ll call you soon.', 'success');
  }, 600);
}

// ══════════════════════════════════════
// UTILS
// ══════════════════════════════════════
function showFieldError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearFormErrors() {
  ['loginError','regError','bookError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

let toastTimer = null;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}
