/* ═══════════════════════════════════════════════════
   HOMEFIX SMART SERVICES – app.js
   Features: Dynamic city pricing + Sub-services fix
   ═══════════════════════════════════════════════════ */

const API = 'https://hfix.in';

/* ══════════════════════════════════════
   CITY TIER PRICING SYSTEM
   Tier 1 Metro   → 1.30x  (Chennai, Coimbatore)
   Tier 2 City    → 1.00x  (Madurai, Salem etc.)
   Tier 3 District→ 0.85x  (Sivagangai etc.)
══════════════════════════════════════ */
const CITY_TIERS = {
  'Chennai':         { tier:1, label:'Metro City',  factor:1.30, badge:'🏙️ Metro'    },
  'Coimbatore':      { tier:1, label:'Metro City',  factor:1.20, badge:'🏙️ Metro'    },
  'Madurai':         { tier:2, label:'Major City',  factor:1.00, badge:'🌆 City'     },
  'Tiruchirappalli': { tier:2, label:'Major City',  factor:1.00, badge:'🌆 City'     },
  'Salem':           { tier:2, label:'Major City',  factor:1.00, badge:'🌆 City'     },
  'Tirunelveli':     { tier:2, label:'Major City',  factor:0.95, badge:'🌆 City'     },
  'Erode':           { tier:2, label:'Major City',  factor:0.95, badge:'🌆 City'     },
  'Vellore':         { tier:2, label:'Major City',  factor:0.95, badge:'🌆 City'     },
  'Thoothukudi':     { tier:2, label:'Major City',  factor:0.95, badge:'🌆 City'     },
  'Sivagangai':      { tier:3, label:'District',    factor:0.85, badge:'🏘️ District' },
};

function getCityTier(city) {
  return CITY_TIERS[city] || { tier:2, label:'City', factor:1.0, badge:'🌆 City' };
}
function getDynamicPrice(base, city) {
  if (!base || !city) return base;
  return Math.round(base * getCityTier(city).factor / 10) * 10;
}
function getDynamicSubPrice(base, city) {
  if (!base || !city) return base;
  return Math.round(base * getCityTier(city).factor / 5) * 5;
}

/* ══════════════════════════════════════
   SERVICE METADATA
══════════════════════════════════════ */
const SVC_META = {
  'AC Service & Repair':     { icon:'❄️', tags:['Same Day','Certified']      },
  'Cleaning & Pest Control': { icon:'🧹', tags:['Eco-Friendly','Insured']    },
  'Electrician':             { icon:'⚡', tags:['Licensed','Safe']            },
  'Electrical':              { icon:'⚡', tags:['Licensed','Safe']            },
  'Plumbing':                { icon:'🔧', tags:['24/7 Emergency','Warranty']  },
  'Painting':                { icon:'🎨', tags:['Quality Paint','Neat Work']  },
  'Carpenter':               { icon:'🪚', tags:['Skilled','Quality Wood']    },
  'Carpentry':               { icon:'🪚', tags:['Skilled','Quality Wood']    },
  'Appliance Repair':        { icon:'🔌', tags:['All Brands','Warranty']     },
  'Water Purifier':          { icon:'💧', tags:['RO Expert','Certified']     },
};

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let STATE = {
  user: null,
  token: localStorage.getItem('hfs_token') || null,
  services: [],
  currentService: null,
  currentServiceId: null,
  currentServiceObj: null,
  selectedSubService: null,
  selectedSubPrice: null,
  selectedCity: '',
};

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initScroll();
  setMinDate();
  loadServices();
  if (STATE.token) restoreSession();
  // Watch booking city change
  document.getElementById('bookCity')?.addEventListener('change', e => {
    const city = e.target.value;
    STATE.selectedCity = city;
    syncCity(city);
    if (STATE.currentServiceObj) {
      buildSubServices(STATE.currentServiceObj, city);
      STATE.selectedSubService = null;
      STATE.selectedSubPrice = null;
      document.getElementById('priceDisplay').classList.add('hidden');
      if (city) showToast(`${getCityTier(city).badge} pricing applied for ${city}`, 'info');
    }
  });
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

/* ══════════════════════════════════════
   CITY SYNC
══════════════════════════════════════ */
function syncCity(city) {
  STATE.selectedCity = city;
  ['globalCity','heroCity','bookCity'].forEach(id => {
    const el = document.getElementById(id);
    if (el && city) el.value = city;
  });
  if (city) {
    updatePricingBadge(city);
    if (STATE.services.length) renderServices(STATE.services);
  }
}

function updatePricingBadge(city) {
  const tier = getCityTier(city);
  let badge = document.getElementById('pricingBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'pricingBadge';
    document.querySelector('.nav-actions')?.prepend(badge);
  }
  const msgs = { 1:'Metro rates', 2:'Standard rates', 3:'District rates' };
  badge.className = `pricing-badge tier${tier.tier}`;
  badge.innerHTML = `${tier.badge} <span>${msgs[tier.tier]}</span>`;
}

function syncCityFromHero(city) { syncCity(city); }
function pickCity(city) {
  syncCity(city);
  showToast(`📍 ${city} — ${getCityTier(city).badge} pricing applied`, 'info');
  document.getElementById('services').scrollIntoView({ behavior:'smooth' });
}
function goToServices() {
  const city = document.getElementById('heroCity').value;
  if (city) syncCity(city);
  document.getElementById('services').scrollIntoView({ behavior:'smooth' });
}
function toggleMobile() {
  document.getElementById('mobileMenu').classList.toggle('hidden');
}
function handleOverlayClick(e, id) {
  if (e.target.id === id) document.getElementById(id).classList.add('hidden');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    ['authModal','bookingModal','bookingsModal'].forEach(id =>
      document.getElementById(id)?.classList.add('hidden'));
});

/* ══════════════════════════════════════
   LOAD SERVICES
══════════════════════════════════════ */
async function loadServices() {
  const statusEl = document.getElementById('apiStatus');
  try {
    const res = await fetch(`${API}/api/services`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Deduplicate by name
    const map = new Map();
    data.forEach(s => map.set(s.name, s));
    STATE.services = Array.from(map.values());

    statusEl.classList.add('hidden');
    renderServices(STATE.services);
    document.getElementById('apiLive').textContent = '● Live';
    document.getElementById('apiLive').classList.remove('offline');

    const cSvc = document.getElementById('cService');
    if (cSvc) cSvc.innerHTML = STATE.services.map(s=>`<option>${s.name}</option>`).join('');

  } catch (err) {
    console.error('API Error:', err);
    document.getElementById('apiLive').textContent = '● Offline';
    document.getElementById('apiLive').classList.add('offline');
    statusEl.className = 'api-status warning';
    statusEl.innerHTML = '⚠️ Could not reach backend on port 5000. Showing sample data.';
    statusEl.classList.remove('hidden');
    renderFallbackServices();
  }
}

function renderServices(services) {
  const grid = document.getElementById('servicesGrid');
  const city = STATE.selectedCity;
  grid.innerHTML = '';

  services.forEach((svc, i) => {
    const meta = SVC_META[svc.name] || { icon:'🔨', tags:['Certified'] };
    const base = svc.basePrice || 0;
    const final = city ? getDynamicPrice(base, city) : base;
    const diff = final - base;
    const diffHtml = city && base && diff !== 0
      ? (diff > 0 ? `<span class="price-up"> ▲₹${diff}</span>` : `<span class="price-down"> ▼₹${Math.abs(diff)}</span>`)
      : '';
    const priceLabel = final ? `From ₹${final}${diffHtml}` : 'Call for price';
    const subCount = (svc.subServices||[]).filter(s=>s.isActive!==false).length;
    const tierInfo = city ? getCityTier(city) : null;

    const card = document.createElement('div');
    card.className = 'service-card';
    card.style.animationDelay = `${i*0.06}s`;
    card.innerHTML = `
      <span class="svc-icon">${meta.icon}</span>
      <h3>${svc.name}</h3>
      <div class="svc-tags">
        ${meta.tags.map(t=>`<span class="svc-tag">${t}</span>`).join('')}
        ${tierInfo ? `<span class="svc-tag tier-tag">${tierInfo.badge}</span>` : ''}
      </div>
      <p>${svc.description||'Professional home service by certified expert technicians.'}</p>
      ${subCount ? `<p class="svc-sub-count">📋 ${subCount} sub-service${subCount>1?'s':''} available</p>` : ''}
      <div class="svc-footer">
        <div class="svc-price-wrap">
          <span class="svc-price">${priceLabel}</span>
          <span class="svc-city-note">${city ? `for ${city}` : 'Select city for price'}</span>
        </div>
        <button class="svc-book-btn" onclick="openBooking('${esc(svc.name)}','${svc._id}')">Book Now →</button>
      </div>`;
    grid.appendChild(card);
  });
}

function renderFallbackServices() {
  STATE.services = Object.entries(SVC_META).map(([name,meta],i) => ({
    name, _id:`fallback_${i}`,
    description: 'Professional home service by certified expert technicians.',
    basePrice: 499,
    subServices: [
      { name:'Standard Service', price:499, duration:'1-2 hours', isActive:true },
      { name:'Premium Service',  price:999, duration:'2-3 hours', isActive:true },
    ]
  }));
  renderServices(STATE.services);
}

function esc(str) {
  return str.replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════
   AUTH
══════════════════════════════════════ */
function openAuth(tab='login') {
  clearFormErrors();
  document.getElementById('authModal').classList.remove('hidden');
  switchTab(tab);
}
function closeAuth() { document.getElementById('authModal').classList.add('hidden'); }
function switchTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab==='login');
  document.getElementById('tabRegister').classList.toggle('active', tab==='register');
  document.getElementById('loginForm').classList.toggle('hidden', tab!=='login');
  document.getElementById('registerForm').classList.toggle('hidden', tab!=='register');
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');
  errEl.classList.add('hidden');
  btn.textContent = 'Signing in...'; btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        email:    document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value
      })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      STATE.token = data.token; STATE.user = data.user;
      localStorage.setItem('hfs_token', data.token);
      updateUserUI(); closeAuth();
      showToast(`👋 Welcome back, ${data.user.name}!`, 'success');
    } else {
      showFieldError(errEl, data.message || 'Login failed. Check email and password.');
    }
  } catch { showFieldError(errEl, '❌ Cannot connect. Is backend running on port 5000?'); }
  finally { btn.textContent = 'Sign In'; btn.disabled = false; }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('regError');
  const btn   = document.getElementById('registerBtn');
  errEl.classList.add('hidden');
  const password = document.getElementById('regPassword').value;
  if (password.length < 6) { showFieldError(errEl,'Password must be at least 6 characters.'); return; }
  btn.textContent = 'Creating account...'; btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        name:    document.getElementById('regName').value.trim(),
        email:   document.getElementById('regEmail').value.trim(),
        phone:   document.getElementById('regPhone').value.trim(),
        address: document.getElementById('regAddress').value.trim(),
        password
      })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      STATE.token = data.token; STATE.user = data.user;
      localStorage.setItem('hfs_token', data.token);
      updateUserUI(); closeAuth();
      showToast(`🎉 Welcome to HomeFix, ${data.user.name}!`, 'success');
    } else {
      showFieldError(errEl, data.message || 'Registration failed. Please try again.');
    }
  } catch { showFieldError(errEl, '❌ Cannot connect. Is backend running on port 5000?'); }
  finally { btn.textContent = 'Create Account'; btn.disabled = false; }
}

async function restoreSession() {
  try {
    const res = await fetch(`${API}/api/bookings`, { headers:{ Authorization:`Bearer ${STATE.token}` } });
    if (res.ok) {
      const stored = localStorage.getItem('hfs_user');
      if (stored) { STATE.user = JSON.parse(stored); updateUserUI(); }
      else logout(true);
    } else logout(true);
  } catch { /* offline */ }
}

function logout(silent=false) {
  STATE.token = null; STATE.user = null;
  localStorage.removeItem('hfs_token'); localStorage.removeItem('hfs_user');
  updateUserUI();
  if (!silent) showToast('👋 Logged out successfully', 'info');
}

function updateUserUI() {
  const show = id => document.getElementById(id)?.classList.remove('hidden');
  const hide = id => document.getElementById(id)?.classList.add('hidden');
  if (STATE.user) {
    localStorage.setItem('hfs_user', JSON.stringify(STATE.user));
    hide('authButtons'); show('userMenu'); hide('mobileAuth'); show('mobileUser');
    const name = STATE.user.name || 'Customer';
    document.getElementById('userGreeting').textContent = name.split(' ')[0];
    document.getElementById('userAvatar').textContent   = name.charAt(0).toUpperCase();
  } else {
    show('authButtons'); hide('userMenu'); show('mobileAuth'); hide('mobileUser');
  }
}

/* ══════════════════════════════════════
   BOOKING — Dynamic prices + Sub-services
══════════════════════════════════════ */
function openBooking(serviceName, serviceId) {
  if (!STATE.user) {
    showToast('🔒 Please login to book a service', 'error');
    openAuth('login'); return;
  }
  const svc = STATE.services.find(s => s._id === serviceId || s.name === serviceName);
  if (!svc) { showToast('Service not found. Please refresh.', 'error'); return; }

  STATE.currentService    = serviceName;
  STATE.currentServiceId  = serviceId;
  STATE.currentServiceObj = svc;
  STATE.selectedSubService = null;
  STATE.selectedSubPrice   = null;

  const meta = SVC_META[serviceName] || { icon:'🔧' };
  const city = STATE.selectedCity || document.getElementById('globalCity').value || '';

  document.getElementById('bookingServiceIcon').textContent = meta.icon;
  document.getElementById('bookingServiceName').textContent = serviceName;
  document.getElementById('bookingServiceDesc').textContent = svc.description || 'Select requirements below';
  if (city) { document.getElementById('bookCity').value = city; STATE.selectedCity = city; }

  buildSubServices(svc, city);

  document.getElementById('bookingStep1').classList.remove('hidden');
  document.getElementById('bookingSuccess').classList.add('hidden');
  document.getElementById('priceDisplay').classList.add('hidden');
  document.getElementById('bookError').classList.add('hidden');
  document.getElementById('bookingModal').classList.remove('hidden');
}

function buildSubServices(svc, city) {
  const list = document.getElementById('subServiceList');
  const subs = (svc.subServices || []).filter(s => s.isActive !== false);

  if (!subs.length) {
    list.innerHTML = `
      <button class="sub-btn" onclick="selectSub(this,'Standard Service',${getDynamicSubPrice(499,city)})">
        <strong>Standard Service</strong><small>₹${getDynamicSubPrice(499,city)} · 1-2 hours</small>
      </button>
      <button class="sub-btn" onclick="selectSub(this,'Premium Service',${getDynamicSubPrice(999,city)})">
        <strong>Premium Service</strong><small>₹${getDynamicSubPrice(999,city)} · 2-3 hours</small>
      </button>`;
    return;
  }

  list.innerHTML = subs.map(sub => {
    const dynPrice = city ? getDynamicSubPrice(sub.price, city) : sub.price;
    const diff = city && sub.price && dynPrice !== sub.price ? dynPrice - sub.price : 0;
    const diffHtml = diff > 0
      ? `<span class="price-up"> ▲₹${diff}</span>`
      : diff < 0
        ? `<span class="price-down"> ▼₹${Math.abs(diff)}</span>`
        : '';
    return `
      <button class="sub-btn" onclick="selectSub(this,'${esc(sub.name)}',${dynPrice||0})">
        <strong>${sub.name}</strong>
        <small>${dynPrice ? `₹${dynPrice}${diffHtml}` : 'Call for price'}${sub.duration ? ' · '+sub.duration : ''}</small>
      </button>`;
  }).join('');
}

function selectSub(btn, name, price) {
  document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  STATE.selectedSubService = name;
  STATE.selectedSubPrice   = price;
  if (price) {
    const city = STATE.selectedCity;
    const tier = city ? getCityTier(city) : null;
    document.getElementById('priceValue').innerHTML =
      `₹${price}${tier ? ` <span class="price-tier-label">${tier.badge}</span>` : ''}`;
    document.getElementById('priceDisplay').classList.remove('hidden');
  }
}

function closeBooking() { document.getElementById('bookingModal').classList.add('hidden'); }

async function submitBooking() {
  const errEl = document.getElementById('bookError');
  const btn   = document.getElementById('confirmBookBtn');
  errEl.classList.add('hidden');

  if (!STATE.selectedSubService) { showFieldError(errEl,'Please select a sub-service above.'); return; }
  const city    = document.getElementById('bookCity').value;
  const date    = document.getElementById('bookDate').value;
  const time    = document.getElementById('bookTime').value;
  const address = document.getElementById('bookAddress').value.trim();
  if (!city)    { showFieldError(errEl,'Please select your city.'); return; }
  if (!date)    { showFieldError(errEl,'Please select a date.'); return; }
  if (!time)    { showFieldError(errEl,'Please select a time slot.'); return; }
  if (!address) { showFieldError(errEl,'Please enter the service address.'); return; }

  btn.textContent = 'Confirming...'; btn.disabled = true;
  const tier = getCityTier(city);
  const payload = {
    serviceId:    STATE.currentServiceId,
    subServiceId: STATE.selectedSubService,
    city, area: document.getElementById('bookArea').value.trim(),
    date, time, address,
    notes:        document.getElementById('bookNotes').value.trim(),
    price:        STATE.selectedSubPrice,
    totalAmount:  STATE.selectedSubPrice,
    cityTier:     tier.label,
    status:       'pending'
  };
  try {
    const res = await fetch(`${API}/api/bookings`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${STATE.token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) showBookingSuccess(data.booking || data, payload);
    else showFieldError(errEl, data.message || 'Booking failed. Please try again.');
  } catch { showFieldError(errEl,'❌ Cannot connect. Is backend running on port 5000?'); }
  finally { btn.textContent = 'Confirm Booking →'; btn.disabled = false; }
}

function showBookingSuccess(booking, payload) {
  const shortId = String(booking._id || 'HFS'+Date.now()).slice(-8).toUpperCase();
  const tier    = getCityTier(payload.city);
  document.getElementById('bookingConfirmCard').innerHTML = `
    <div>📋 <strong>Booking ID:</strong> #${shortId}</div>
    <div>🔧 <strong>Service:</strong> ${STATE.currentService}</div>
    <div>🛠️ <strong>Sub-service:</strong> ${STATE.selectedSubService}</div>
    <div>📍 <strong>City:</strong> ${payload.city} <em style="color:#888;font-size:11px">${tier.badge}</em></div>
    <div>🗓️ <strong>Date & Time:</strong> ${payload.date} at ${payload.time}</div>
    ${payload.totalAmount ? `<div>💰 <strong>Amount:</strong> ₹${payload.totalAmount} (${tier.label} pricing)</div>` : ''}`;
  document.getElementById('bookingStep1').classList.add('hidden');
  document.getElementById('bookingSuccess').classList.remove('hidden');
  showToast('✅ Booking confirmed! Technician will contact you soon.', 'success');
}

/* ══════════════════════════════════════
   MY BOOKINGS
══════════════════════════════════════ */
function openMyBookings() {
  if (!STATE.user) { openAuth('login'); return; }
  document.getElementById('bookingsModal').classList.remove('hidden');
  fetchMyBookings();
}

async function fetchMyBookings() {
  const list = document.getElementById('bookingsList');
  list.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:14px;color:#888">Loading...</p></div>';
  try {
    const res = await fetch(`${API}/api/bookings`, { headers:{ Authorization:`Bearer ${STATE.token}` } });
    const bookings = await res.json();
    if (!Array.isArray(bookings) || !bookings.length) {
      list.innerHTML = `<div class="no-bookings">📋<br/><br/>No bookings yet.<br/><small>Book a service to see it here.</small></div>`;
      return;
    }
    list.innerHTML = bookings.map(b => {
      const svc  = STATE.services.find(s => s._id === String(b.serviceId)) || {};
      const meta = SVC_META[svc.name] || { icon:'🔧' };
      const tier = b.city ? getCityTier(b.city) : null;
      const sc   = `status-${(b.status||'pending').toLowerCase()}`;
      const sid  = String(b._id).slice(-6).toUpperCase();
      return `
        <div class="booking-item">
          <div class="booking-item-icon">${meta.icon||'🔧'}</div>
          <div class="booking-item-info">
            <strong>${svc.name||'Home Service'} — ${b.subServiceId||''}</strong>
            <p>📅 ${b.date||'N/A'} at ${b.time||'N/A'}<br/>
               📍 ${b.city||''}${b.area?' · '+b.area:''}${tier?` <em style="font-size:11px;color:#888">${tier.badge}</em>`:''}<br/>
               🏠 ${b.address||''}<br/>
               ${b.totalAmount?`💰 ₹${b.totalAmount}`:''}</p>
          </div>
          <div style="text-align:right">
            <span class="booking-status ${sc}">${b.status||'Pending'}</span>
            <div style="font-size:11px;color:#666;margin-top:6px">#${sid}</div>
          </div>
        </div>`;
    }).join('');
  } catch {
    list.innerHTML = `<div class="no-bookings">❌ Could not load bookings.</div>`;
  }
}

/* ══════════════════════════════════════
   CONTACT
══════════════════════════════════════ */
async function submitContact(e) {
  e.preventDefault();
  const el = document.getElementById('contactSuccess');
  el.classList.add('hidden');
  setTimeout(() => {
    el.classList.remove('hidden');
    e.target.reset();
    showToast("✅ Message received! We'll call you soon.", 'success');
  }, 600);
}

/* ══════════════════════════════════════
   UTILS
══════════════════════════════════════ */
function showFieldError(el, msg) {
  el.textContent = msg; el.classList.remove('hidden');
  el.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
function clearFormErrors() {
  ['loginError','regError','bookError'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden'));
}
let toastTimer = null;
function showToast(msg, type='info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

/* ══════════════════════════════════════
   TECHNICIANS
══════════════════════════════════════ */
async function loadTechnicians() {
  const grid = document.getElementById('techniciansGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/api/technicians`);
    if (!res.ok) throw new Error();
    const techs = await res.json();
    if (!techs.length) { grid.innerHTML = '<p style="text-align:center;color:#888;grid-column:1/-1">No technicians found.</p>'; return; }
    grid.innerHTML = techs.map(t => {
      const initials = t.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
      const stars = '⭐'.repeat(Math.round(t.rating||5));
      const city = t.city || (t.cities && t.cities[0]) || 'Tamil Nadu';
      return `
        <div class="tech-card">
          <div class="tech-avatar">
            ${initials}
            <div class="tech-available"></div>
          </div>
          <h3>${t.name}</h3>
          <div class="tech-specialization">${t.specialization}</div>
          <div class="tech-rating">${stars} ${t.rating||5}.0</div>
          <div class="tech-stats">
            <div class="tech-stat"><strong>${t.experience||'3 yrs'}</strong><span>Experience</span></div>
            <div class="tech-stat-sep"></div>
            <div class="tech-stat"><strong>${t.completedJobs||0}+</strong><span>Jobs Done</span></div>
          </div>
          <div class="tech-city">📍 ${city}</div>
        </div>`;
    }).join('');
  } catch {
    grid.innerHTML = '<p style="text-align:center;color:#888;grid-column:1/-1;padding:40px">Could not load technicians.</p>';
  }
}

// Call loadTechnicians on page load
document.addEventListener('DOMContentLoaded', () => { loadTechnicians(); });
