// ── STATE ──
let S = {
  contacts: [], events: [], scripts: [],
  archive: [],
  bizTypes: ['Restaurante','Tienda','Salón de belleza','Clínica','Gimnasio','Hotel','Farmacia','Taller','Abogado','Contador'],
  callsToday: 0, notifications: [],
  editContact: null, editEvent: null, editScript: null,
  activeScript: null, view: 'list',
  selDate: new Date(), calDate: new Date(),
};

// ── DEBUG (disabled) ──
const _dbg = () => {};

// ── BUSINESS TYPE COLORS & ICONS ──
const BIZ_STYLES = {
  'Restaurante':       { color:'#FF8C42', bg:'rgba(255,140,66,0.14)',  icon:'fa-solid fa-utensils'         },
  'Tienda':            { color:'#4F8EFF', bg:'rgba(79,142,255,0.14)',  icon:'fa-solid fa-bag-shopping'     },
  'Salón de belleza':  { color:'#F472B6', bg:'rgba(244,114,182,0.14)', icon:'fa-solid fa-scissors'         },
  'Clínica':           { color:'#22D98A', bg:'rgba(34,217,138,0.14)',  icon:'fa-solid fa-stethoscope'      },
  'Gimnasio':          { color:'#A855F7', bg:'rgba(168,85,247,0.14)',  icon:'fa-solid fa-dumbbell'         },
  'Hotel':             { color:'#FFD166', bg:'rgba(255,209,102,0.14)', icon:'fa-solid fa-hotel'            },
  'Farmacia':          { color:'#34D399', bg:'rgba(52,211,153,0.14)',  icon:'fa-solid fa-pills'            },
  'Taller':            { color:'#A16207', bg:'rgba(161,98,7,0.22)',    icon:'fa-solid fa-wrench'           },
  'Abogado':           { color:'#94A3B8', bg:'rgba(148,163,184,0.14)', icon:'fa-solid fa-scale-balanced'   },
  'Contador':          { color:'#38BDF8', bg:'rgba(56,189,248,0.14)',  icon:'fa-solid fa-calculator'       },
  // extras comunes
  'Barbería':          { color:'#92400E', bg:'rgba(146,64,14,0.22)',   icon:'fa-solid fa-scissors'         },
  'Peluquería':        { color:'#92400E', bg:'rgba(146,64,14,0.22)',   icon:'fa-solid fa-scissors'         },
  'Spa':               { color:'#F9A8D4', bg:'rgba(249,168,212,0.14)', icon:'fa-solid fa-spa'              },
  'Dental':            { color:'#67E8F9', bg:'rgba(103,232,249,0.14)', icon:'fa-solid fa-tooth'            },
  'Veterinaria':       { color:'#86EFAC', bg:'rgba(134,239,172,0.14)', icon:'fa-solid fa-paw'              },
  'Escuela':           { color:'#FCD34D', bg:'rgba(252,211,77,0.14)',  icon:'fa-solid fa-graduation-cap'   },
  'Agencia':           { color:'#818CF8', bg:'rgba(129,140,248,0.14)', icon:'fa-solid fa-bullhorn'         },
};
const DEFAULT_BIZ = { color:'#7A8BA8', bg:'rgba(122,139,168,0.12)', icon:'fa-solid fa-store' };

function getBizStyle(type) {
  return BIZ_STYLES[type] || DEFAULT_BIZ;
}
const uid = () => Math.random().toString(36).substr(2,9);
const fmtDate = d => d.toISOString().split('T')[0];

// ── FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey: "AIzaSyA6iP1pgz_ZQUPeSpMD7ZjlA8n8Ppopj7g",
  authDomain: "ventaspro-crm.firebaseapp.com",
  projectId: "ventaspro-crm",
  storageBucket: "ventaspro-crm.firebasestorage.app",
  messagingSenderId: "415905262883",
  appId: "1:415905262883:web:a10ddd40f75d1542917096"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

let _currentUser = null;

// ── SAVE — local + Firestore ──
const save = () => {
  localStorage.setItem('vp_crm', JSON.stringify(S));
  if(!_currentUser) return;
  const uid2 = _currentUser.uid;
  // Show sync indicator
  const ind = document.getElementById('syncIndicator');
  if(ind) { ind.className = 'sync-indicator syncing'; ind.title = 'Guardando...'; }
  const toSave = {
    contacts:   S.contacts,
    events:     S.events,
    scripts:    S.scripts,
    archive:    S.archive   || [],
    bizTypes:   S.bizTypes,
    callsToday: S.callsToday,
    notifications: S.notifications,
    retos:      S.retos     || {},
    updatedAt:  Date.now()
  };
  db.collection('users').doc(uid2).set(toSave, { merge: true })
    .then(() => {
      if(ind) { ind.className = 'sync-indicator'; ind.title = 'Sincronizado ✓'; }
    })
    .catch(e => {
      console.warn('Firestore save error:', e);
      if(ind) { ind.className = 'sync-indicator error'; ind.title = 'Error al sincronizar'; }
    });
};

// ── LOAD — from Firestore, fallback to localStorage ──
const load = () => {
  try {
    const d = localStorage.getItem('vp_crm');
    if(d) {
      const p = JSON.parse(d);
      S = { ...S, ...p };
      S.selDate = new Date(S.selDate || new Date());
      S.calDate = new Date(S.calDate || new Date());
    }
  } catch(e) {}
};

async function loadFromFirestore(uid2) {
  // Timeout de 5s — si Firestore no responde (VPN/red lenta) usamos localStorage
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Firestore timeout')), 5000)
  );
  try {
    const doc = await Promise.race([
      db.collection('users').doc(uid2).get(),
      timeout
    ]);
    if(doc.exists) {
      const p = doc.data();
      S.contacts     = p.contacts     || S.contacts;
      S.events       = p.events       || S.events;
      S.scripts      = p.scripts      || S.scripts;
      S.archive      = p.archive      || S.archive;
      S.bizTypes     = p.bizTypes     || S.bizTypes;
      S.callsToday   = p.callsToday   || S.callsToday;
      S.notifications= p.notifications|| S.notifications;
      S.retos        = p.retos        || S.retos;
      S.selDate      = new Date();
      S.calDate      = new Date();
      localStorage.setItem('vp_crm', JSON.stringify(S));
    }
  } catch(e) {
    console.warn('Firestore load error (usando localStorage):', e.message);
    // La app sigue funcionando con los datos del localStorage ya cargados en load()
  }
}

// ── AVATAR COLORS ──
const avatarColors = [
  '#4F8EFF','#A855F7','#1ED98A','#FF8C42','#FF4D6A',
  '#FFD166','#06B6D4','#EC4899','#F97316','#14B8A6',
  '#8B5CF6','#EF4444','#10B981','#F59E0B','#3B82F6','#E879F9'
];
const getColor = name => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return avatarColors[hash % avatarColors.length];
};

// ── LOADER & AUTH ──
window.addEventListener('load', () => {
  _dbg('window load - isMobile: ' + /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  _dbg('pendingRedirect: ' + sessionStorage.getItem('pendingGoogleRedirect'));
  const savedTheme = localStorage.getItem('vp_theme') || 'dark';
  applyTheme(savedTheme, false);

  load();

  // Siempre ocultar loader después de 4s como máximo
  const hideLoader = () => {
    _dbg('hideLoader called');
    const loader = document.getElementById('loader');
    if(!loader) return;
    loader.classList.add('hide');
    setTimeout(() => {
      if(loader.parentNode) loader.parentNode.removeChild(loader);
    }, 700);
    document.getElementById('app').style.opacity = '1';
  };
  const loaderTimeout = setTimeout(() => { _dbg('loaderTimeout fired', '#ff0'); hideLoader(); }, 4000);


  // Login con email/contraseña
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');

  function getLoginFields() {
    return {
      email:    (document.getElementById('loginEmail')    || {}).value || '',
      password: (document.getElementById('loginPassword') || {}).value || '',
      note:     document.getElementById('loginNote')
    };
  }

  if(loginBtn) {
    loginBtn.addEventListener('click', () => {
      const { email, password, note } = getLoginFields();
      if(!email || !password) { note.textContent = 'Ingresa tu correo y contraseña'; return; }
      note.textContent = 'Entrando...';
      loginBtn.disabled = true;
      auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
          note.textContent = err.code === 'auth/user-not-found'    ? 'Usuario no encontrado' :
                             err.code === 'auth/wrong-password'    ? 'Contraseña incorrecta' :
                             err.code === 'auth/invalid-credential'? 'Correo o contraseña incorrectos' :
                             err.code === 'auth/invalid-email'     ? 'Correo inválido' : err.message;
          loginBtn.disabled = false;
        });
    });
  }

  if(registerBtn) {
    registerBtn.addEventListener('click', () => {
      const { email, password, note } = getLoginFields();
      if(!email || !password) { note.textContent = 'Ingresa correo y contraseña'; return; }
      if(password.length < 6) { note.textContent = 'Contraseña mínimo 6 caracteres'; return; }
      note.textContent = 'Creando cuenta...';
      registerBtn.disabled = true;
      auth.createUserWithEmailAndPassword(email, password)
        .catch(err => {
          note.textContent = err.code === 'auth/email-already-in-use' ? 'Ya existe — usa "Entrar"' :
                             err.code === 'auth/invalid-email'        ? 'Correo inválido' : err.message;
          registerBtn.disabled = false;
        });
    });
  }

  // Enter en campo contraseña
  const pwField = document.getElementById('loginPassword');
  if(pwField) pwField.addEventListener('keydown', e => { if(e.key==='Enter' && loginBtn) loginBtn.click(); });

  // Google login — popup en todos los dispositivos
  // (redirect falla en Cuba/VPN porque la conexión se interrumpe durante el proceso)
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  const googleBtn = document.getElementById('loginGoogleBtn');
  if(googleBtn) {
    googleBtn.addEventListener('click', () => {
      const note = document.getElementById('loginNote');
      note.textContent = 'Conectando con Google...';
      googleBtn.disabled = true;
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider)
        .then(() => { note.textContent = ''; })
        .catch(err => {
          console.error('Google auth error:', err.code, err.message);
          note.textContent = err.code + ': ' + err.message;
          googleBtn.disabled = false;
        });
    });
  }

  // Auth state — esperamos getRedirectResult primero para evitar
  // el flash de login en móvil después de un redirect de Google
  let _redirectHandled = false;
  const _pendingRedirect = false; // ya no usamos redirect
  sessionStorage.removeItem('pendingGoogleRedirect'); // limpiar flags viejos

  auth.getRedirectResult().then(result => {
    _dbg('getRedirectResult OK - user: ' + (result && result.user ? result.user.email : 'none'));
    _redirectHandled = true;
    sessionStorage.removeItem('pendingGoogleRedirect');
  }).catch(err => {
    _dbg('getRedirectResult ERR: ' + err.code, '#f88');
    _redirectHandled = true;
    sessionStorage.removeItem('pendingGoogleRedirect');
    if(err.code && err.code !== 'auth/no-current-user' && err.code !== 'auth/network-request-failed') {
      const note = document.getElementById('loginNote');
      if(note) note.textContent = err.message;
    }
  });

  // Auth state
  auth.onAuthStateChanged(async user => {
    clearTimeout(loaderTimeout);
    _dbg('onAuthStateChanged - user: ' + (user ? user.email : 'null'));
    if(user) {
      _currentUser = user;

      const nameEl   = document.querySelector('.sb-user-name');
      const avatarEl = document.querySelector('.sb-user-avatar');
      if(nameEl)   nameEl.textContent   = user.displayName || user.email;
      if(avatarEl) avatarEl.textContent = (user.displayName || user.email).charAt(0).toUpperCase();

      const loginScreen = document.getElementById('loginScreen');
      if(loginScreen) loginScreen.style.display = 'none';
      setTimeout(() => {
        if(loginScreen && loginScreen.parentNode) loginScreen.parentNode.removeChild(loginScreen);
      }, 500);

      _dbg('iniciando app...');
      if(!window._appInited) {
        window._appInited = true;
        try { initAll(); _dbg('initAll OK', '#0ff'); } catch(e) { _dbg('initAll ERR: ' + e.message, '#f00'); console.error('initAll:', e); }
      } else {
        try { renderAll(); _dbg('renderAll OK', '#0ff'); } catch(e) { _dbg('renderAll ERR: ' + e.message, '#f00'); console.error('renderAll:', e); }
      }
      hideLoader();

      _dbg('sync Firestore bg...');
      loadFromFirestore(user.uid).then(() => {
        _dbg('Firestore sync OK', '#0f0');
        try { renderAll(); } catch(e) {}
      }).catch(e => { _dbg('Firestore ERR: ' + e.message, '#f88'); });

    } else {
      _currentUser = null;
      window._appInited = false;
      _dbg('user null - pendingRedirect: ' + _pendingRedirect, '#ff0');
      if(_pendingRedirect) return;
      hideLoader();
      document.getElementById('loginScreen').style.display = 'flex';
    }
  });

  // Logout
  window.logout = () => {
    if(!confirm('¿Cerrar sesión?')) return;
    auth.signOut().then(() => {
      localStorage.removeItem('vp_crm');
      window._appInited = false;
      location.reload();
    });
  };
});

// ── INIT ──
function initAll() {
  initNav(); initContactModal(); initCalendar();
  initScripts(); initSettings(); initFilters();
  initNotifications(); initDetailPanel(); initCallPicker();
  initRetos(); initPasteModal(); initPostCallModal();
  document.getElementById('titleDate').textContent = new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  // Botón de datos de prueba en dashboard
  document.getElementById('dashLoadSample').addEventListener('click', loadSampleData);
  renderAll();
}

function renderAll() {
  try { renderDashboard(); } catch(e) { console.error('renderDashboard:', e); }
  try { renderContacts(); } catch(e) { console.error('renderContacts:', e); }
  try { renderCalendar(); } catch(e) { console.error('renderCalendar:', e); }
  try { renderMetrics(); } catch(e) { console.error('renderMetrics:', e); }
  try { renderScripts(); } catch(e) { console.error('renderScripts:', e); }
  try { renderSettings(); } catch(e) { console.error('renderSettings:', e); }
  try { renderRetos(); } catch(e) { console.error('renderRetos:', e); }
  try { renderHistorial(); } catch(e) { console.error('renderHistorial:', e); }
  updateNotifBadge(); updateSidebarBadge();
}

// ── NAV ──
function initNav() {
  const sectionLabels = {
    dashboard:'Dashboard', contactos:'Contactos', calendario:'Calendario',
    metricas:'Métricas', guiones:'Guiones', retos:'Retos',
    historial:'Historial', ajustes:'Ajustes'
  };

  function navigateTo(sec) {
    document.querySelectorAll('.sb-item').forEach(n => n.classList.remove('active'));
    const sbItem = document.querySelector(`.sb-item[data-section="${sec}"]`);
    if(sbItem) sbItem.classList.add('active');

    document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
    const mobItem = document.querySelector(`.mobile-nav-item[data-section="${sec}"]`);
    if(mobItem) mobItem.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + sec).classList.add('active');
    document.getElementById('headerTitle').querySelector('.title-text').textContent = sectionLabels[sec] || sec;

    if(sec==='dashboard') renderDashboard();
    if(sec==='contactos') renderContacts();
    if(sec==='calendario') renderCalendar();
    if(sec==='metricas') renderMetrics();
    if(sec==='guiones') renderScripts();
    if(sec==='retos') renderRetos();
    if(sec==='historial') renderHistorial();
    if(sec==='ajustes') renderSettings();
    if(window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
  }

  document.querySelectorAll('.sb-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.section); });
  });

  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.section));
  });

  // Collapse button
  document.getElementById('collapseBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Mobile hamburger
  document.getElementById('menuToggle').addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    if(window.innerWidth < 768) sb.classList.toggle('open');
    else sb.classList.toggle('collapsed');
  });

  updateSidebarBadge();
}

// ── DASHBOARD ──
let chartCalls, chartSales;
function renderDashboard() {
  const total = S.contacts.length;
  // Mostrar/ocultar banner de bienvenida
  const banner = document.getElementById('emptyBanner');
  if(banner) banner.classList.toggle('hidden', total > 0);

  const closed = S.contacts.filter(c=>c.status==='Cerrado').length;
  const revenue = S.contacts.filter(c=>c.status==='Cerrado').reduce((a,c)=>a+(c.value||0),0);
  animateNum('kpiTotal', total);
  animateNum('kpiCalls', S.callsToday);
  animateNum('kpiClosed', closed);
  document.getElementById('kpiRevenue').textContent = '$' + revenue.toLocaleString();

  // Pipeline
  const statuses = ['Nuevo','Llamado','Interesado','Cerrado','No interesado'];
  const colors = ['#4F8EFF','#FFD166','#A855F7','#1ED98A','#FF4D6A'];
  const pv = document.getElementById('pipelineView');
  document.getElementById('pipeTotal').textContent = total + ' contactos';
  pv.innerHTML = statuses.map((s,i) => {
    const count = S.contacts.filter(c=>c.status===s).length;
    const pct = total ? Math.round(count/total*100) : 0;
    const c = colors[i];
    return `<div class="pipe-row" style="background:linear-gradient(105deg,${c}18 0%,${c}06 40%,rgba(8,12,18,0.5) 100%);border-color:${c}22;">
      <div class="pipe-dot" style="background:${c};box-shadow:0 0 8px ${c}88"></div>
      <div class="pipe-name">${s}</div>
      <div class="pipe-track"><div class="pipe-fill" style="width:${pct}%;background:linear-gradient(90deg,${c},${c}99);box-shadow:0 0 8px ${c}66"></div></div>
      <div class="pipe-count" style="color:${c}">${count}</div>
    </div>`;
  }).join('');

  // Followups
  const today = fmtDate(new Date());
  const tomorrow = fmtDate(new Date(Date.now()+86400000));
  const upcoming = S.events.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
  const fl = document.getElementById('followupsList');
  const urgencyColor = { red:'#FF4D6A', yellow:'#FFD166', green:'#1ED98A' };
  fl.innerHTML = upcoming.length ? upcoming.map(e => {
    const urgency = e.date===today ? 'red' : e.date===tomorrow ? 'yellow' : 'green';
    const label = e.date===today ? 'Hoy' : e.date===tomorrow ? 'Mañana' : e.date;
    const uc = urgencyColor[urgency];
    return `<div class="timeline-item" style="border-left:3px solid ${uc};background:linear-gradient(105deg,${uc}10 0%,rgba(8,12,18,0.6) 60%);">
      <div class="tl-dot ${urgency}"></div>
      <div class="tl-info"><div class="tl-name">${e.title}</div><div class="tl-time">${e.time||'Sin hora'} · ${e.type}</div></div>
      <span class="tl-badge ${urgency==='red'?'hoy':urgency==='yellow'?'manana':'futuro'}">${label}</span>
    </div>`;
  }).join('') : '<div class="tl-empty"><i class="fa-solid fa-calendar-check"></i><span>Sin seguimientos pendientes</span></div>';

  // Charts
  const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const callData = [3,5,4,7,6,2,S.callsToday||1];
  const salesData = [1,2,1,3,2,1,closed||1];

  const tooltipStyle = {
    backgroundColor: 'rgba(8,12,18,0.95)',
    titleColor: '#EEF2FF',
    bodyColor: '#7A8BA8',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    padding: 12,
    cornerRadius: 10,
    displayColors: false,
    titleFont: { size: 12, weight: '700' },
    bodyFont: { size: 11 }
  };
  const scaleStyle = {
    x: { ticks:{ color:'rgba(176,191,218,0.45)', font:{size:10}, padding:6 }, grid:{ color:'rgba(255,255,255,0.03)', drawBorder:false } },
    y: { ticks:{ color:'rgba(176,191,218,0.45)', font:{size:10}, padding:8 }, grid:{ color:'rgba(255,255,255,0.04)', drawBorder:false } }
  };

  if(chartCalls) chartCalls.destroy();
  chartCalls = new Chart(document.getElementById('callsChart'), {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        data: callData,
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          g.addColorStop(0, 'rgba(79,142,255,0.85)');
          g.addColorStop(1, 'rgba(79,142,255,0.1)');
          return g;
        },
        borderColor: '#4F8EFF',
        borderWidth: 0,
        borderRadius: 10,
        borderSkipped: false,
        hoverBackgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          g.addColorStop(0, 'rgba(130,174,255,1)');
          g.addColorStop(1, 'rgba(79,142,255,0.3)');
          return g;
        }
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { legend:{ display:false }, tooltip: tooltipStyle },
      scales: scaleStyle
    }
  });

  if(chartSales) chartSales.destroy();
  chartSales = new Chart(document.getElementById('salesChart'), {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        data: salesData,
        borderColor: '#1ED98A',
        borderWidth: 2.5,
        fill: true,
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 180);
          g.addColorStop(0, 'rgba(30,217,138,0.28)');
          g.addColorStop(0.6, 'rgba(30,217,138,0.06)');
          g.addColorStop(1, 'rgba(30,217,138,0)');
          return g;
        },
        tension: 0.45,
        pointBackgroundColor: '#1ED98A',
        pointBorderColor: 'rgba(8,12,18,0.8)',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#4EEAAA',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      animation: { duration: 1000, easing: 'easeOutQuart' },
      plugins: { legend:{ display:false }, tooltip: tooltipStyle },
      scales: scaleStyle
    }
  });
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  if(!el) return;
  let start = 0; const dur = 600; const step = 16;
  const inc = target / (dur/step);
  const timer = setInterval(() => {
    start = Math.min(start+inc, target);
    el.textContent = Math.round(start);
    if(start >= target) clearInterval(timer);
  }, step);
}

// ── CONTACTS ──
let activeFilterStatus = '';
let activeFilterTag = '';

function renderContacts() {
  populateTypeFilter();
  const search = document.getElementById('searchInput').value.toLowerCase();
  const tf = document.getElementById('filterType').value;

  let list = S.contacts.filter(c => {
    const ms = !search || c.name.toLowerCase().includes(search) || c.phone.includes(search) || (c.location||'').toLowerCase().includes(search);
    const mStatus = !activeFilterStatus || c.status === activeFilterStatus;
    const mTag = !activeFilterTag || (c.tags||[]).includes(activeFilterTag);
    return ms && mStatus && mTag && (!tf || c.type === tf);
  });

  // Summary bar
  const summary = document.getElementById('ctSummary');
  const total = S.contacts.length;
  const revenue = S.contacts.filter(c=>c.status==='Cerrado').reduce((a,c)=>a+(c.value||0),0);
  const hot = S.contacts.filter(c=>c.status==='Interesado').length;
  summary.innerHTML = `
    <div class="ct-sum-item"><div class="ct-sum-dot" style="background:#A855F7"></div>Interesados: <span class="ct-sum-val">${hot}</span></div>
    <div class="ct-sum-divider"></div>
    <div class="ct-sum-item"><div class="ct-sum-dot" style="background:#22D98A"></div>Cerrados: <span class="ct-sum-val">${S.contacts.filter(c=>c.status==='Cerrado').length}</span></div>
    <div class="ct-sum-divider"></div>
    <div class="ct-sum-item"><div class="ct-sum-dot" style="background:#4F8EFF"></div>Total: <span class="ct-sum-val">${total}</span></div>
    <div class="ct-sum-income"><i class="fa-solid fa-dollar-sign"></i>Ingresos: <span class="ct-sum-income-val">${revenue.toLocaleString()}</span></div>
  `;

  const grid = document.getElementById('contactsGrid');
  grid.className = 'ct-grid list-mode';

  if (!list.length) {
    grid.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text2)">
      <i class="fa-solid fa-users-slash" style="font-size:2.5rem;opacity:0.15;display:block;margin-bottom:14px"></i>
      <div style="font-weight:600;margin-bottom:6px">Sin contactos</div>
      <div style="font-size:0.8rem">Prueba con otro filtro o agrega un contacto</div>
    </div>`;
    return;
  }

  grid.innerHTML = `
    <div class="cr-header">
      <div class="cr-header-accent"></div>
      <div class="cr-header-col">Negocio</div>
      <div class="cr-header-col">Estado</div>
      <div class="cr-header-col cr-header-center">Valor</div>
      <div class="cr-header-col">Tipo / Web</div>
      <div class="cr-header-col">Actividad</div>
      <div class="cr-header-col cr-header-right">Acciones</div>
    </div>
  ` + list.map(c => buildCard(c)).join('');

  // Events
  grid.querySelectorAll('.cr').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.cr-btn-call') || e.target.closest('.cr-btn-wa') || e.target.closest('.cr-btn-edit')) return;
      openDP(row.dataset.id);
    });
  });
  grid.querySelectorAll('.cr-btn-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); editContact(btn.dataset.id); });
  });
  grid.querySelectorAll('.cr-btn-call').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      if (window.innerWidth < 768) {
        showCallPicker(id);
      } else {
        openDP(id);
        const c = S.contacts.find(x => x.id === id);
        if(c) setTimeout(() => { logCall(id); window.location.href = 'tel:' + c.phone; }, 300);
      }
    });
  });
}

function buildCard(c) {
  const color = getColor(c.name);
  const initial = c.name.charAt(0).toUpperCase();
  const statusKey = c.status.toLowerCase().replace(' ', '-');
  const accentColors = { 'Nuevo':'#4F8EFF','Llamado':'#FFD166','Interesado':'#A855F7','Cerrado':'#22D98A','No interesado':'#FF4D6A' };
  const accentColor = accentColors[c.status] || '#4F8EFF';
  const isHighValue = (c.value || 0) >= 10000;
  const isMidValue = (c.value || 0) >= 5000;
  const valueClass = isHighValue ? 'high' : isMidValue ? 'mid' : 'low';
  const daysSince = c.createdAt ? Math.floor((Date.now()-c.createdAt)/86400000) : 0;
  const priorityTags = (c.tags||[]).filter(t=>['urgente','premium'].includes(t));

  return `<div class="cr state-${statusKey}${isHighValue?' high-value':''}" data-id="${c.id}" data-status="${c.status}" data-color="${color}" style="background:linear-gradient(105deg,${color}28 0%,${color}10 35%,rgba(8,12,18,0.92) 70%);border-color:${color}22;">
    <div class="cr-accent" style="background:${accentColor}"></div>

    <!-- COL 1: Avatar + Nombre -->
    <div class="cr-col cr-col-name">
      <div class="cr-avatar" style="background:linear-gradient(135deg,${color},${color}99);color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.4)">${initial}</div>
      <div class="cr-info">
        <div class="cr-name">${c.name}</div>
        <div class="cr-location"><i class="fa-solid fa-location-dot"></i>${c.location||'Sin ubicación'}</div>
      </div>
    </div>

    <!-- COL 2: Estado + Tags -->
    <div class="cr-col cr-col-status">
      <span class="cr-status ${statusKey}">${c.status}</span>
      ${priorityTags.map(t=>`<span class="cr-tag ${t}">${t==='urgente'?'🔥':'💎'}</span>`).join('')}
    </div>

    <!-- COL 3: Valor -->
    <div class="cr-col cr-col-value">
      ${c.value ? `<span class="cr-value ${valueClass}">$${c.value.toLocaleString()}</span>` : `<span class="cr-value-empty">—</span>`}
    </div>

    <!-- COL 4: Tipo + Web -->
    <div class="cr-col cr-col-type">
      <span class="cr-type-label" style="color:${getBizStyle(c.type).color};background:${getBizStyle(c.type).bg};border-color:${getBizStyle(c.type).color}30"><i class="${getBizStyle(c.type).icon}"></i>${c.type||'Sin tipo'}</span>
      <span class="cr-web ${c.website==='Sí'?'yes':'no'}">${c.website==='Sí'?'✓ Web':'✗ Sin web'}</span>
    </div>

    <!-- COL 5: Actividad -->
    <div class="cr-col cr-col-activity">
      <span class="cr-calls"><i class="fa-solid fa-phone"></i>${c.calls||0} llamada${(c.calls||0)!==1?'s':''}</span>
      <span class="cr-last">${(()=>{
        const h = (c.callHistory||[])[0];
        if(!h) return 'Sin contacto';
        const today = fmtDate(new Date());
        const yesterday = fmtDate(new Date(Date.now()-86400000));
        const when = h.date===today?'Hoy':h.date===yesterday?'Ayer':`${h.date}`;
        const col = {'Interesado':'#A855F7','Cerrado':'#22D98A','No contestó':'#4F8EFF','No interesado':'#FF4D6A','Llamar luego':'#FFD166'}[h.result]||'#7A8BA8';
        return `<span style="color:${col}">${when}</span>`;
      })()}</span>
    </div>

    <!-- COL 6: Acciones -->
    <div class="cr-col cr-col-actions">
      <button class="cr-btn-call" data-id="${c.id}"><i class="fa-solid fa-phone"></i> Llamar</button>
      <a href="https://wa.me/${c.phone.replace(/\D/g,'')}" target="_blank" class="cr-btn-wa"><i class="fa-brands fa-whatsapp"></i></a>
      <button class="cr-btn-edit" data-id="${c.id}"><i class="fa-solid fa-pen"></i></button>
    </div>
  </div>`;
}

function populateTypeFilter() {
  const sel = document.getElementById('filterType');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos los tipos</option>' +
    S.bizTypes.map(t => {
      const bs = getBizStyle(t);
      return `<option value="${t}" ${cur===t?'selected':''} style="color:${bs.color}">${t}</option>`;
    }).join('');
}

function logCall(id) {
  const c = S.contacts.find(x=>x.id===id);
  if(c){ c.calls=(c.calls||0)+1; if(c.status==='Nuevo') c.status='Llamado'; }
  S.callsToday++;
  save();
  // Show post-call modal after a short delay (lets the phone app open first)
  setTimeout(() => showPostCallModal(id), 1800);
}

// ── POST-CALL MODAL ──
let _pcContactId = null;
let _pcResult    = null;

function showPostCallModal(id) {
  const c = S.contacts.find(x=>x.id===id);
  if(!c) return;
  _pcContactId = id;
  _pcResult    = null;

  const color = getColor(c.name);
  document.getElementById('pcAvatar').textContent  = c.name.charAt(0).toUpperCase();
  document.getElementById('pcAvatar').style.background = `linear-gradient(135deg,${color},${color}88)`;
  document.getElementById('pcName').textContent  = c.name;
  document.getElementById('pcPhone').textContent = c.phone;

  // Reset to step 1
  document.getElementById('pcStep1').style.display = '';
  document.getElementById('pcStep2').style.display = 'none';

  openModal('postCallModal');
}

function initPostCallModal() {
  // Option buttons
  document.getElementById('pcOptions').addEventListener('click', e => {
    const btn = e.target.closest('.pc-opt');
    if(!btn) return;
    handlePostCallResult(btn.dataset.result);
  });

  document.getElementById('pcSkip').addEventListener('click', () => {
    applyPostCallResult('Llamado', null);
    closeModal('postCallModal');
    showToast('Llamada registrada', 'success');
  });

  document.getElementById('pcSkipSchedule').addEventListener('click', () => {
    applyPostCallResult(_pcResult, null);
    closeModal('postCallModal');
    showToast('Resultado guardado', 'success');
  });

  document.getElementById('pcConfirmSchedule').addEventListener('click', () => {
    const date = document.getElementById('pcDate').value;
    const time = document.getElementById('pcTime').value;
    const note = document.getElementById('pcNote').value.trim();
    if(!date) { showToast('Selecciona una fecha', 'error'); return; }
    applyPostCallResult(_pcResult, { date, time, note });
    closeModal('postCallModal');
    showToast('Agendado y guardado ✓', 'success');
  });

  // Close on backdrop
  document.getElementById('postCallModal').addEventListener('click', e => {
    if(e.target === document.getElementById('postCallModal')) {
      applyPostCallResult('Llamado', null);
      closeModal('postCallModal');
    }
  });
}

function handlePostCallResult(result) {
  _pcResult = result;
  const c = S.contacts.find(x=>x.id===_pcContactId);
  if(!c) return;

  // Results that need scheduling
  if(result === 'Llamar luego' || result === 'Interesado') {
    // Pre-fill date: tomorrow for "llamar luego", today for "interesado"
    const tomorrow = new Date(Date.now() + 86400000);
    document.getElementById('pcDate').value = fmtDate(result === 'Llamar luego' ? tomorrow : new Date());
    document.getElementById('pcTime').value = '10:00';
    document.getElementById('pcNote').value = '';

    const icons = { 'Llamar luego':'fa-solid fa-clock-rotate-left', 'Interesado':'fa-solid fa-fire' };
    const colors = { 'Llamar luego':'#FFD166', 'Interesado':'#A855F7' };
    const titles = { 'Llamar luego':'Agendar reintento', 'Interesado':'Agendar seguimiento' };
    const subs   = { 'Llamar luego':`Programa cuándo volver a llamar a ${c.name}`, 'Interesado':`Agenda el seguimiento con ${c.name}` };

    const icon = document.getElementById('pcStep2Icon');
    icon.innerHTML = `<i class="${icons[result]}"></i>`;
    icon.style.background = colors[result] + '22';
    icon.style.color = colors[result];
    document.getElementById('pcStep2Title').textContent = titles[result];
    document.getElementById('pcStep2Sub').textContent   = subs[result];

    document.getElementById('pcStep1').style.display = 'none';
    document.getElementById('pcStep2').style.display = '';
    return;
  }

  // All other results: apply immediately
  applyPostCallResult(result, null);
  closeModal('postCallModal');

  const msgs = {
    'No contestó':      'Sin respuesta — registrado',
    'No interesado':    'Marcado como No interesado',
    'Número incorrecto':'Número marcado como incorrecto',
    'Cerrado':          '🎉 ¡Venta cerrada! Felicidades',
  };
  showToast(msgs[result] || 'Resultado guardado', result === 'Cerrado' ? 'success' : '');
}

function applyPostCallResult(result, schedule) {
  const c = S.contacts.find(x=>x.id===_pcContactId);
  if(!c) return;

  // Status mapping
  const statusMap = {
    'Interesado':        'Interesado',
    'Llamar luego':      'Llamado',
    'No contestó':       c.status === 'Nuevo' ? 'Llamado' : c.status,
    'No interesado':     'No interesado',
    'Número incorrecto': 'No interesado',
    'Cerrado':           'Cerrado',
  };
  if(statusMap[result]) c.status = statusMap[result];

  // Log call history entry on the contact
  if(!c.callHistory) c.callHistory = [];
  c.callHistory.unshift({
    date: fmtDate(new Date()),
    time: new Date().toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}),
    result,
    note: (schedule && schedule.note) ? schedule.note : ''
  });

  // Schedule event if provided
  if(schedule) {
    const typeMap = { 'Llamar luego':'llamada', 'Interesado':'seguimiento' };
    S.events.push({
      id: uid(),
      title: `${result === 'Interesado' ? 'Seguimiento' : 'Llamar'}: ${c.name}`,
      date: schedule.date,
      time: schedule.time,
      type: typeMap[result] || 'llamada',
      notes: schedule.note || ''
    });
  }

  // ── ARCHIVE on Cerrado ──
  if(result === 'Cerrado') {
    if(!S.archive) S.archive = [];
    S.archive.unshift({
      ...c,
      archivedAt: Date.now(),
      archivedDate: fmtDate(new Date()),
      finalResult: 'Cerrado'
    });
    S.contacts = S.contacts.filter(x => x.id !== c.id);
    closeDP();
  }

  save();
  renderContacts();
  if(result !== 'Cerrado' &&
     document.getElementById('detailPanel').classList.contains('open') &&
     S.editContact === _pcContactId) {
    openDP(_pcContactId);
  }
}

// ── DETAIL PANEL ──
function initDetailPanel() {
  document.getElementById('detailClose').addEventListener('click', closeDP);
  document.getElementById('panelOverlay').addEventListener('click', closeDP);
  document.getElementById('dEdit').addEventListener('click', () => { closeDP(); editContact(S.editContact); });
  document.getElementById('dDelete').addEventListener('click', () => {
    if (!confirm('¿Eliminar este contacto?')) return;
    S.contacts = S.contacts.filter(c => c.id !== S.editContact);
    save(); closeDP(); renderContacts(); showToast('Contacto eliminado');
  });
  document.getElementById('dStatus').addEventListener('change', e => {
    const c = S.contacts.find(x => x.id === S.editContact);
    if (c) { c.status = e.target.value; save(); renderContacts(); showToast('Estado actualizado', 'success'); }
  });
}

function openDP(id) {
  S.editContact = id;
  const c = S.contacts.find(x => x.id === id);
  if (!c) return;
  const color = getColor(c.name);

  document.getElementById('dAvatar').textContent = c.name.charAt(0).toUpperCase();
  document.getElementById('dAvatar').style.background = `linear-gradient(135deg, ${color}, ${color}88)`;
  document.getElementById('dName').textContent = c.name;
  const bs = getBizStyle(c.type);
  document.getElementById('dType').innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;background:${bs.bg};color:${bs.color};border:1px solid ${bs.color}30;padding:2px 9px;border-radius:20px;font-size:0.72rem;font-weight:700"><i class="${bs.icon}" style="font-size:0.65rem"></i>${c.type||'Sin tipo'}</span> <span style="color:var(--text2);font-size:0.78rem">· ${c.location||'Sin ubicación'}</span>`;
  document.getElementById('dValueBadge').textContent = c.value ? '$' + c.value.toLocaleString() + ' estimado' : '';
  document.getElementById('dCall').href = 'tel:' + c.phone;
  document.getElementById('dCall').onclick = (e) => {
    if (window.innerWidth < 768) { e.preventDefault(); showCallPicker(id); }
    else logCall(id);
  };
  document.getElementById('dWA').href = 'https://wa.me/' + c.phone.replace(/\D/g, '');
  document.getElementById('dLocation').textContent = c.location || '—';
  document.getElementById('dWebsite').textContent = 'Sitio web: ' + (c.website || 'No');
  document.getElementById('dPhone').textContent = c.phone;
  document.getElementById('dValue').textContent = c.value ? '$' + c.value.toLocaleString() : '—';

  // Status select
  const dSel = document.getElementById('dStatus');
  dSel.innerHTML = ['Nuevo','Llamado','Interesado','Cerrado','No interesado'].map(s => `<option ${c.status===s?'selected':''}>${s}</option>`).join('');

  // Next action
  const nextEv = S.events.filter(e => e.date >= fmtDate(new Date())).find(e => e.title.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
  document.getElementById('dNextActionText').textContent = nextEv ? `${nextEv.title} — ${nextEv.date} ${nextEv.time||''}` : 'Sin seguimiento programado';

  // Probability
  const probMap = { 'Nuevo':15, 'Llamado':30, 'Interesado':70, 'Cerrado':100, 'No interesado':5 };
  const prob = probMap[c.status] || 0;
  const probColors = { 'Nuevo':'#4F8EFF','Llamado':'#FFD166','Interesado':'#A855F7','Cerrado':'#22D98A','No interesado':'#FF4D6A' };
  document.getElementById('dProbBar').style.cssText = `width:${prob}%;background:${probColors[c.status]}`;
  document.getElementById('dProbLabel').textContent = `${prob}% probabilidad de cierre`;
  document.getElementById('dProbLabel').style.color = probColors[c.status];

  // Tags
  document.getElementById('dTags').innerHTML = (c.tags||[]).length
    ? (c.tags||[]).map(t => `<span class="dp-tag">${t}</span>`).join('')
    : '<span style="color:var(--text2);font-size:0.8rem">Sin etiquetas</span>';

  // Notes
  document.getElementById('dNotes').textContent = c.notes || 'Sin notas';

  // History — use callHistory if available, fallback to call count
  const resultColors = {
    'Interesado':'#A855F7','Llamar luego':'#FFD166','No contestó':'#4F8EFF',
    'No interesado':'#FF4D6A','Número incorrecto':'#FF8C42','Cerrado':'#22D98A','Llamado':'#7A8BA8'
  };
  const resultIcons = {
    'Interesado':'fa-fire','Llamar luego':'fa-clock-rotate-left','No contestó':'fa-phone-slash',
    'No interesado':'fa-xmark','Número incorrecto':'fa-triangle-exclamation','Cerrado':'fa-handshake','Llamado':'fa-phone'
  };
  const hist = c.callHistory || [];
  const calls = c.calls || 0;
  document.getElementById('dHistory').innerHTML = hist.length > 0
    ? hist.slice(0,6).map(h => {
        const col = resultColors[h.result] || '#7A8BA8';
        const ico = resultIcons[h.result] || 'fa-phone';
        return `<div class="dp-hist-item">
          <div class="dp-hist-icon" style="background:${col}18;color:${col}"><i class="fa-solid ${ico}"></i></div>
          <div style="flex:1;min-width:0">
            <div class="dp-hist-title" style="color:${col}">${h.result}</div>
            <div class="dp-hist-time">${h.date} ${h.time||''}${h.note?` · ${h.note}`:''}</div>
          </div>
        </div>`;
      }).join('')
    : calls > 0
      ? `<div class="dp-hist-item"><div class="dp-hist-icon" style="background:rgba(79,142,255,0.12);color:#4F8EFF"><i class="fa-solid fa-phone"></i></div><div><div class="dp-hist-title">${calls} llamada${calls!==1?'s':''} registrada${calls!==1?'s':''}</div><div class="dp-hist-time">Sin detalle de resultado</div></div></div>`
      : '<div style="color:var(--text2);font-size:0.8rem;padding:8px 0">Sin historial de llamadas</div>';

  document.getElementById('detailPanel').classList.add('open');
  document.getElementById('panelOverlay').classList.add('show');
}

function closeDP() {
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('panelOverlay').classList.remove('show');
}

// ── CONTACT MODAL ──
function initContactModal() {
  document.getElementById('quickAddBtn').addEventListener('click', openAddContact);
  document.getElementById('fabBtn').addEventListener('click', openAddContact);
  document.getElementById('fPhone').addEventListener('input', () => {
    window._dupConfirmed = false;
    const warn = document.getElementById('phoneDupWarn');
    if(warn){ warn.style.display='none'; }
  });
  document.getElementById('closeContactModal').addEventListener('click', ()=>{ window._dupConfirmed=false; closeModal('contactModal'); });
  document.getElementById('cancelContact').addEventListener('click', ()=>{ window._dupConfirmed=false; closeModal('contactModal'); });
  document.getElementById('saveContact').addEventListener('click', saveContact);
}

function openAddContact() {
  S.editContact = null;
  window._dupConfirmed = false;
  const warn = document.getElementById('phoneDupWarn');
  if(warn){ warn.style.display='none'; }
  document.getElementById('modalTitle').textContent = 'Nuevo Contacto';
  const sub = document.querySelector('.modal-subtitle');
  if(sub) sub.textContent = 'Completa los datos del negocio';
  const icon = document.querySelector('.contact-modal-hd-icon i');
  if(icon) { icon.className = 'fa-solid fa-user-plus'; }
  ['fName','fPhone','fLocation','fTags','fNotes','fValue'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fWebsite').value='No';
  document.getElementById('fStatus').value='Nuevo';
  populateTypeSelect('');
  openModal('contactModal');
}

function editContact(id) {
  S.editContact = id;
  window._dupConfirmed = false;
  const warn = document.getElementById('phoneDupWarn');
  if(warn){ warn.style.display='none'; }
  const c = S.contacts.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('modalTitle').textContent = 'Editar Contacto';
  const sub = document.querySelector('.modal-subtitle');
  if(sub) sub.textContent = 'Modifica los datos del negocio';
  const icon = document.querySelector('.contact-modal-hd-icon i');
  if(icon) icon.className = 'fa-solid fa-pen';
  document.getElementById('fName').value = c.name||'';
  document.getElementById('fPhone').value = c.phone||'';
  document.getElementById('fLocation').value = c.location||'';
  document.getElementById('fWebsite').value = c.website||'No';
  document.getElementById('fStatus').value = c.status||'Nuevo';
  document.getElementById('fNotes').value = c.notes||'';
  document.getElementById('fTags').value = (c.tags||[]).join(', ');
  document.getElementById('fValue').value = c.value||'';
  populateTypeSelect(c.type);
  openModal('contactModal');
}

function populateTypeSelect(sel) {
  document.getElementById('fType').innerHTML = S.bizTypes.map(t => {
    const bs = getBizStyle(t);
    return `<option value="${t}" ${sel===t?'selected':''} style="color:${bs.color}">${t}</option>`;
  }).join('');
}

function saveContact() {
  const name = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  if(!name||!phone){ showToast('Nombre y teléfono requeridos','error'); return; }

  // ── Duplicate phone check ──
  const normalizePhone = p => p.replace(/\D/g,'');
  const duplicate = S.contacts.find(c =>
    c.id !== S.editContact &&
    normalizePhone(c.phone) === normalizePhone(phone)
  );
  if(duplicate && !window._dupConfirmed) {
    const warn = document.getElementById('phoneDupWarn');
    warn.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" style="font-size:1.1rem;flex-shrink:0"></i>
      <div style="flex:1">
        <div style="font-weight:700;color:var(--text);margin-bottom:3px">Número duplicado</div>
        <div style="font-size:0.75rem;opacity:0.85">Este número ya está en: <strong>${duplicate.name}</strong></div>
      </div>
      <button onclick="window._dupConfirmed=true;saveContact()" style="background:rgba(255,209,102,0.15);border:1px solid rgba(255,209,102,0.35);color:var(--yellow);padding:7px 12px;border-radius:9px;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit">Guardar igual</button>`;
    warn.style.display = 'flex';
    warn.scrollIntoView({ behavior:'smooth', block:'nearest' });
    showToast('Número duplicado — revisa el aviso', 'error');
    return;
  }
  window._dupConfirmed = false;
  const warn = document.getElementById('phoneDupWarn');
  if(warn){ warn.style.display='none'; }

  const data = { name, phone, location:document.getElementById('fLocation').value.trim(), type:document.getElementById('fType').value, website:document.getElementById('fWebsite').value, status:document.getElementById('fStatus').value, notes:document.getElementById('fNotes').value.trim(), tags:document.getElementById('fTags').value.split(',').map(t=>t.trim()).filter(Boolean), value:parseFloat(document.getElementById('fValue').value)||0 };
  if(S.editContact) {
    const idx = S.contacts.findIndex(c=>c.id===S.editContact);
    if(idx>=0) S.contacts[idx]={...S.contacts[idx],...data};
    showToast('Contacto actualizado','success');
  } else {
    S.contacts.unshift({id:uid(),calls:0,createdAt:Date.now(),...data});
    showToast('Contacto agregado','success');
  }
  save(); closeModal('contactModal'); renderContacts();
}

// ── CALENDAR ──
function initCalendar() {
  document.getElementById('prevMonth').addEventListener('click',()=>{ S.calDate.setMonth(S.calDate.getMonth()-1); renderCalendar(); });
  document.getElementById('nextMonth').addEventListener('click',()=>{ S.calDate.setMonth(S.calDate.getMonth()+1); renderCalendar(); });
  document.getElementById('addEventBtn').addEventListener('click', openAddEvent);
  document.getElementById('closeEventModal').addEventListener('click',()=>closeModal('eventModal'));
  document.getElementById('cancelEvent').addEventListener('click',()=>closeModal('eventModal'));
  document.getElementById('saveEvent').addEventListener('click', saveEvent);

  // Today button
  const todayBtn = document.getElementById('gcalTodayBtn');
  if(todayBtn) todayBtn.addEventListener('click',()=>{ S.calDate=new Date(); S.selDate=new Date(); renderCalendar(); });

  // Popup close
  document.getElementById('gcalPopupClose').addEventListener('click', gcalClosePopup);
  document.getElementById('gcalPopupOverlay').addEventListener('click', gcalClosePopup);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') gcalClosePopup(); });
}

function openCalModal() {
  renderCalModal();
  const overlay = document.getElementById('calModalOverlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCalModal() {
  document.getElementById('calModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCalModal() {
  const d = S.calDate, year=d.getFullYear(), month=d.getMonth();
  document.getElementById('calModalTitle').textContent = d.toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  const first = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const today = fmtDate(new Date()), sel = fmtDate(S.selDate);
  let html = '';
  for(let i=0;i<first;i++) html += `<div class="cal-modal-cell other"></div>`;
  for(let day=1;day<=daysInMonth;day++){
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const evs = S.events.filter(e=>e.date===ds);
    const dots = [...new Set(evs.map(e=>e.type))].slice(0,4).map(t=>`<span class="cal-dot ${t}"></span>`).join('');
    const evList = evs.slice(0,3).map(e=>`<div class="cal-modal-ev ${e.type}">${e.time?e.time+' ':''} ${e.title}</div>`).join('');
    html += `<div class="cal-modal-cell ${ds===today?'today':''} ${ds===sel?'selected':''}" onclick="selectCalDateModal('${ds}')">
      <div class="cal-modal-num">${day}</div>
      <div class="cal-modal-events">${evList}</div>
      ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
    </div>`;
  }
  document.getElementById('calModalGrid').innerHTML = html;
}

function selectCalDateModal(ds) {
  S.selDate = new Date(ds+'T12:00:00');
  renderCalModal();
  renderCalendar();
  closeCalModal();
}

function renderCalendar() {
  if(window.innerWidth < 768) { renderCalendarMobile(); return; }

  const d = S.calDate, year = d.getFullYear(), month = d.getMonth();
  const monthName = d.toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  document.getElementById('calTitle').textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const first = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const today = fmtDate(new Date());
  const sel   = fmtDate(S.selDate);

  const typeColors = { llamada:'#4F8EFF', seguimiento:'#FFD166', reunion:'#22D98A', tarea:'#A855F7' };
  const typeLabels = { llamada:'Llamada', seguimiento:'Seguimiento', reunion:'Cierre', tarea:'Tarea' };

  let html = '';
  for(let i=0;i<first;i++) html += '<div class="gcal-cell gcal-cell-other"></div>';

  for(let day=1;day<=daysInMonth;day++){
    const ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    const evs = S.events.filter(e=>e.date===ds).sort((a,b)=>(a.time||'00:00').localeCompare(b.time||'00:00'));
    const isToday = ds===today;
    const isSel   = ds===sel;
    const pending = evs.filter(e=>!e.done).length;

    let evHtml = '';
    evs.slice(0,3).forEach(e=>{
      const col = typeColors[e.type]||'#4F8EFF';
      const timeStr = e.time ? e.time+' · ' : '';
      const shortTitle = e.title.length>22 ? e.title.slice(0,22)+'…' : e.title;
      const doneStyle = e.done ? 'opacity:0.45;text-decoration:line-through;' : '';
      evHtml += `<div class="gcal-ev" style="background:linear-gradient(105deg,${col}28 0%,${col}0a 100%);border-left-color:${col};${doneStyle};box-shadow:inset 0 0 0 1px ${col}18;"
        onclick="event.stopPropagation();gcalOpenPopup('${e.id}','${ds}')">
        <span class="gcal-ev-time">${timeStr}</span><span class="gcal-ev-name">${shortTitle}</span>
      </div>`;
    });
    if(evs.length>3) evHtml += `<div class="gcal-ev-more">+${evs.length-3} más</div>`;

    html += `<div class="gcal-cell${isToday?' gcal-today':''}${isSel?' gcal-selected':''}" onclick="selectCalDate('${ds}')">
      <div class="gcal-cell-top">
        <span class="gcal-day-num${isToday?' gcal-day-today':''}">${day}</span>
        ${pending>0?`<span class="gcal-day-count">${pending}</span>`:''}
      </div>
      <div class="gcal-cell-events">${evHtml}</div>
    </div>`;
  }

  const total = first + daysInMonth;
  const remainder = total % 7;
  if(remainder>0){ for(let i=0;i<7-remainder;i++) html+='<div class="gcal-cell gcal-cell-other"></div>'; }

  document.getElementById('calGrid').innerHTML = html;
  renderDayEvents();
}

// ── MOBILE CALENDAR — agenda view ──
function renderCalendarMobile() {
  const today = fmtDate(new Date());
  const sel   = fmtDate(S.selDate);
  const d     = S.calDate;
  const year  = d.getFullYear(), month = d.getMonth();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const typeColors = { llamada:'#4F8EFF', seguimiento:'#FFD166', reunion:'#22D98A', tarea:'#A855F7' };
  const typeIcons  = { llamada:'fa-phone', seguimiento:'fa-clock-rotate-left', reunion:'fa-handshake', tarea:'fa-check' };
  const typeLabels = { llamada:'Llamada', seguimiento:'Seguimiento', reunion:'Cierre', tarea:'Tarea' };
  const dayNames   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  // Update title
  const monthName = d.toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  document.getElementById('calTitle').textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // ── Week strip: show 7 days centered on selected ──
  const selD = new Date(sel+'T12:00:00');
  let stripHtml = '';
  for(let i=-3; i<=3; i++){
    const dd = new Date(selD); dd.setDate(selD.getDate()+i);
    const ds = fmtDate(dd);
    const isT = ds===today, isS = ds===sel;
    const hasEv = S.events.some(e=>e.date===ds);
    stripHtml += `<div class="mob-cal-strip-day${isT?' is-today':''}${isS?' is-sel':''}" onclick="selectCalDate('${ds}')">
      <div class="mob-cal-strip-name">${dayNames[dd.getDay()]}</div>
      <div class="mob-cal-strip-num">${dd.getDate()}</div>
      ${hasEv?'<div class="mob-cal-strip-dot"></div>':'<div class="mob-cal-strip-dot empty"></div>'}
    </div>`;
  }

  // ── Agenda list for selected day ──
  const evs = S.events.filter(e=>e.date===sel).sort((a,b)=>(a.time||'00:00').localeCompare(b.time||'00:00'));
  const selLabel = new Date(sel+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  const selLabelCap = selLabel.charAt(0).toUpperCase()+selLabel.slice(1);

  let agendaHtml = '';
  if(evs.length === 0){
    agendaHtml = `<div class="mob-cal-empty">
      <i class="fa-regular fa-calendar"></i>
      <span>Sin tareas este día</span>
      <button class="mob-cal-empty-btn" onclick="openAddEvent()"><i class="fa-solid fa-plus"></i> Agregar tarea</button>
    </div>`;
  } else {
    agendaHtml = evs.map(e=>{
      const col = typeColors[e.type]||'#4F8EFF';
      const ico = typeIcons[e.type]||'fa-check';
      const lbl = typeLabels[e.type]||'Tarea';
      const done = e.done;
      return `<div class="mob-cal-ev-row${done?' done':''}" onclick="gcalOpenPopup('${e.id}','${sel}')" style="border-left-color:${col}">
        <div class="mob-cal-ev-icon" style="background:${col}18;color:${col}">
          <i class="fa-solid ${ico}"></i>
        </div>
        <div class="mob-cal-ev-body">
          <div class="mob-cal-ev-title">${e.title}</div>
          <div class="mob-cal-ev-meta">
            <span class="mob-cal-ev-type" style="color:${col}">${lbl}</span>
            ${e.time?`<span class="mob-cal-ev-time"><i class="fa-solid fa-clock"></i>${e.time}</span>`:''}
            ${e.notes?`<span class="mob-cal-ev-note">${e.notes.slice(0,40)}${e.notes.length>40?'…':''}</span>`:''}
          </div>
        </div>
        <div class="mob-cal-ev-status">
          ${done
            ? `<span class="mob-cal-ev-done"><i class="fa-solid fa-check-double"></i></span>`
            : `<i class="fa-solid fa-chevron-right" style="color:rgba(255,255,255,0.15);font-size:0.75rem"></i>`}
        </div>
      </div>`;
    }).join('');
  }

  // ── Month mini-dots row ──
  let monthDots = '';
  for(let day=1; day<=daysInMonth; day++){
    const ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    const hasEv = S.events.some(e=>e.date===ds);
    const isT = ds===today, isS = ds===sel;
    monthDots += `<div class="mob-cal-month-dot${isT?' today':''}${isS?' sel':''}" onclick="selectCalDate('${ds}')" title="${day}">
      ${hasEv?'<span></span>':''}
    </div>`;
  }

  const grid = document.getElementById('calGrid');
  grid.innerHTML = `
    <div class="mob-cal-wrap">

      <!-- Week strip -->
      <div class="mob-cal-strip">${stripHtml}</div>

      <!-- Selected day header -->
      <div class="mob-cal-day-header">
        <div class="mob-cal-day-label">${selLabelCap}</div>
        <div class="mob-cal-day-count">${evs.length} tarea${evs.length!==1?'s':''}</div>
        <button class="mob-cal-add-btn" onclick="openAddEvent()"><i class="fa-solid fa-plus"></i></button>
      </div>

      <!-- Agenda list -->
      <div class="mob-cal-agenda">${agendaHtml}</div>

      <!-- Month mini navigator -->
      <div class="mob-cal-month-nav">
        <div class="mob-cal-month-title">${monthName.charAt(0).toUpperCase()+monthName.slice(1)}</div>
        <div class="mob-cal-month-grid">${monthDots}</div>
      </div>

    </div>`;

  // Hide desktop elements
  document.querySelector('.gcal-weekdays').style.display = 'none';
}

function selectCalDate(ds) {
  S.selDate = new Date(ds+'T12:00:00');
  // If mobile and different month, update calDate too
  if(window.innerWidth < 768){
    S.calDate = new Date(ds+'T12:00:00');
  }
  renderCalendar();
}

function renderDayEvents() {
  // Grid-based calendar — no separate day list needed
  // Update hidden elements for compatibility
  const ds = fmtDate(S.selDate);
  const todayDs = fmtDate(new Date());
  const evs = S.events.filter(e=>e.date===ds);
  const pending = evs.filter(e=>!e.done).length;
  const el = document.getElementById('calDayTitle');
  if(el) el.textContent = S.selDate.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  const sub = document.getElementById('agendaDaySub');
  if(sub) sub.textContent = pending ? pending+' tarea'+(pending!==1?'s':'')+' pendiente'+(pending!==1?'s':'') : '';
}

// ── GCAL POPUP ──
let _gcalCurrentEventId = null;

function gcalOpenPopup(eventId, ds) {
  const e = S.events.find(x=>x.id===eventId);
  if(!e) return;
  _gcalCurrentEventId = eventId;

  const typeColors = { llamada:'#4F8EFF', seguimiento:'#FFD166', reunion:'#22D98A', tarea:'#A855F7' };
  const typeLabels = { llamada:'Llamada', seguimiento:'Seguimiento', reunion:'Cierre', tarea:'Tarea' };
  const col = typeColors[e.type]||'#4F8EFF';
  const lbl = typeLabels[e.type]||'Tarea';

  const rc = S.contacts.find(c=>e.title.toLowerCase().includes(c.name.toLowerCase().split(' ')[0].toLowerCase()));

  document.getElementById('gcalPopupType').textContent = lbl;
  document.getElementById('gcalPopupType').style.color = col;
  document.getElementById('gcalPopupType').style.background = col+'18';
  document.getElementById('gcalPopupTitle').textContent = e.title;

  let meta = '';
  if(e.time) meta += '<i class="fa-solid fa-clock"></i> '+e.time;
  if(rc) meta += (meta?' · ':'')+'<i class="fa-solid fa-store"></i> '+(rc.type||'')+(rc.location?' · '+rc.location:'');
  if(e.notes) meta += '<div style="margin-top:6px;opacity:0.7">'+e.notes+'</div>';
  document.getElementById('gcalPopupMeta').innerHTML = meta;

  const valEl = document.getElementById('gcalPopupValue');
  if(rc && rc.value){ valEl.textContent = '$'+rc.value.toLocaleString()+' potencial'; valEl.style.display='block'; }
  else { valEl.style.display='none'; }

  const callBtn = document.getElementById('gcalPopupCall');
  if(rc){ callBtn.href='tel:'+rc.phone; callBtn.onclick=()=>{ openDP(rc.id); logCall(rc.id); }; callBtn.style.display='flex'; }
  else { callBtn.style.display='none'; }

  const doneBtn = document.getElementById('gcalPopupDone');
  doneBtn.innerHTML = e.done
    ? '<i class="fa-solid fa-rotate-left"></i> Reabrir'
    : '<i class="fa-solid fa-check"></i> Completar';
  doneBtn.onclick = () => { markEventDone(eventId); gcalClosePopup(); renderCalendar(); };

  const detailBtn = document.getElementById('gcalPopupDetail');
  if(rc){ detailBtn.onclick=()=>{ gcalClosePopup(); openDP(rc.id); }; detailBtn.style.display='flex'; }
  else { detailBtn.style.display='none'; }

  document.getElementById('gcalPopup').classList.add('open');
  document.getElementById('gcalPopupOverlay').classList.add('open');
}

function gcalClosePopup() {
  document.getElementById('gcalPopup').classList.remove('open');
  document.getElementById('gcalPopupOverlay').classList.remove('open');
  _gcalCurrentEventId = null;
}

function markEventDone(id) {
  const e = S.events.find(x => x.id === id);
  if(!e) return;
  e.done = !e.done;
  save();
  renderDayEvents();
  showToast(e.done ? '✓ Tarea completada' : 'Tarea reabierta', 'success');
}

function openAddEvent() {
  S.editEvent = null;
  document.getElementById('eventModalTitle').textContent = 'Nuevo Evento';
  document.getElementById('eTitle').value='';
  document.getElementById('eDate').value=fmtDate(S.selDate);
  document.getElementById('eTime').value='';
  document.getElementById('eType').value='llamada';
  document.getElementById('eNotes').value='';
  openModal('eventModal');
}

function editEvent(id) {
  S.editEvent = id;
  const e = S.events.find(x=>x.id===id);
  if(!e) return;
  document.getElementById('eventModalTitle').textContent = 'Editar Evento';
  document.getElementById('eTitle').value=e.title;
  document.getElementById('eDate').value=e.date;
  document.getElementById('eTime').value=e.time||'';
  document.getElementById('eType').value=e.type;
  document.getElementById('eNotes').value=e.notes||'';
  openModal('eventModal');
}

function deleteEvent(id) {
  S.events = S.events.filter(e=>e.id!==id);
  save(); renderCalendar(); showToast('Evento eliminado');
}

function saveEvent() {
  const title = document.getElementById('eTitle').value.trim();
  if(!title){ showToast('El título es requerido','error'); return; }
  const data = { title, date:document.getElementById('eDate').value, time:document.getElementById('eTime').value, type:document.getElementById('eType').value, notes:document.getElementById('eNotes').value.trim() };
  if(S.editEvent) {
    const idx = S.events.findIndex(e=>e.id===S.editEvent);
    if(idx>=0) S.events[idx]={...S.events[idx],...data};
    showToast('Evento actualizado','success');
  } else {
    S.events.push({id:uid(),...data});
    showToast('Evento creado','success');
  }
  save(); closeModal('eventModal'); renderCalendar();
}

// ── METRICS ──
let chartConv, chartIncome, chartActivity;
function renderMetrics() {
  if(!S.archive) S.archive = [];

  // ── Real data from both active contacts AND archive ──
  const allContacts   = [...S.contacts, ...S.archive];
  const total         = S.contacts.length;
  const totalEver     = allContacts.length;
  const closed        = S.archive.filter(c=>c.finalResult==='Cerrado').length +
                        S.contacts.filter(c=>c.status==='Cerrado').length;
  const totalCalls    = allContacts.reduce((a,c)=>a+(c.calls||0),0);
  const revenue       = allContacts.filter(c=>c.status==='Cerrado'||c.finalResult==='Cerrado')
                          .reduce((a,c)=>a+(c.value||0),0);
  const conv          = totalEver ? Math.round(closed/totalEver*100) : 0;
  const avgTicket     = closed > 0 ? Math.round(revenue/closed) : 0;

  // ── KPIs ──
  document.getElementById('mRevenue').textContent = '$' + revenue.toLocaleString();
  document.getElementById('mIncomeTotal').textContent = '$' + revenue.toLocaleString() + ' acumulado';
  animateMetric('mCalls', totalCalls);
  animateMetric('mClosed', closed);
  document.getElementById('mConv').textContent = conv + '%';
  document.getElementById('donutPct').textContent = conv + '%';

  const convTrend = document.getElementById('mConvTrend');
  convTrend.textContent = conv > 0 ? `↑ ${conv}%` : '—';
  convTrend.className = 'm-kpi-mini-trend ' + (conv > 0 ? 'up' : '');

  // ── FUNNEL — uses active contacts ──
  const stages = [
    { label:'Nuevo',      hex:'#4F8EFF', key:'Nuevo' },
    { label:'Llamado',    hex:'#FFD166', key:'Llamado' },
    { label:'Interesado', hex:'#A855F7', key:'Interesado' },
    { label:'Cerrado',    hex:'#1ED98A', key:'Cerrado' },
  ];
  const maxCount = Math.max(total, 1);
  const fv = document.getElementById('funnelView');
  fv.innerHTML = stages.map((s, i) => {
    const count = S.contacts.filter(c=>c.status===s.key).length +
                  (s.key==='Cerrado' ? S.archive.filter(c=>c.finalResult==='Cerrado').length : 0);
    const pct = Math.round(count / Math.max(totalEver,1) * 100);
    const arrow = i < stages.length-1 ? `<div class="m-funnel-arrow"><i class="fa-solid fa-chevron-down"></i></div>` : '';
    return `<div class="m-funnel-row" style="background:linear-gradient(105deg,${s.hex}18 0%,${s.hex}06 40%,rgba(8,12,18,0.5) 100%);border-color:${s.hex}20;">
      <div class="m-funnel-label" style="color:${s.hex}cc">${s.label}</div>
      <div class="m-funnel-track">
        <div class="m-funnel-fill" style="width:0%;background:linear-gradient(90deg,${s.hex}99,${s.hex});box-shadow:0 0 8px ${s.hex}66" data-target="${pct}">${count}</div>
      </div>
      <div class="m-funnel-pct" style="color:${s.hex}">${pct}%</div>
    </div>${arrow}`;
  }).join('');
  setTimeout(() => {
    fv.querySelectorAll('.m-funnel-fill').forEach(bar => { bar.style.width = bar.dataset.target + '%'; });
  }, 100);

  // ── DONUT ──
  const statLabels = ['Nuevo','Llamado','Interesado','Cerrado','No interesado'];
  const statCounts = [
    S.contacts.filter(c=>c.status==='Nuevo').length,
    S.contacts.filter(c=>c.status==='Llamado').length,
    S.contacts.filter(c=>c.status==='Interesado').length,
    closed,
    S.contacts.filter(c=>c.status==='No interesado').length + S.archive.filter(c=>c.finalResult==='No interesado').length,
  ];
  const statColors = ['#4F8EFF','#FFD166','#A855F7','#22D98A','#FF4D6A'];

  if(chartConv) chartConv.destroy();
  chartConv = new Chart(document.getElementById('convChart'), {
    type: 'doughnut',
    data: { labels: statLabels, datasets: [{ data: statCounts, backgroundColor: statColors.map(c=>c+'CC'), borderWidth: 0, hoverOffset: 10, borderRadius: 4 }] },
    options: {
      responsive: false, cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor:'rgba(8,12,18,0.95)', titleColor:'#EEF2FF', bodyColor:'#7A8BA8', borderColor:'rgba(255,255,255,0.1)', borderWidth:1, padding:12, cornerRadius:10, displayColors:true, boxWidth:8, boxHeight:8 }
      },
      animation: { animateRotate: true, duration: 1000, easing: 'easeOutQuart' }
    }
  });
  document.getElementById('donutLegend').innerHTML = statLabels.map((l,i) =>
    `<div class="m-donut-leg-item">
      <div class="m-donut-leg-dot" style="background:${statColors[i]}"></div>
      <div class="m-donut-leg-name">${l}</div>
      <div class="m-donut-leg-val">${statCounts[i]}</div>
    </div>`).join('');

  // ── INCOME CHART — real data by month from archive ──
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const now = new Date();
  // Build last 6 months of real revenue from archive
  const incomeByMonth = {};
  S.archive.filter(c=>c.finalResult==='Cerrado' && c.archivedAt).forEach(c => {
    const d = new Date(c.archivedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    incomeByMonth[key] = (incomeByMonth[key]||0) + (c.value||0);
  });
  S.contacts.filter(c=>c.status==='Cerrado' && c.createdAt).forEach(c => {
    const d = new Date(c.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    incomeByMonth[key] = (incomeByMonth[key]||0) + (c.value||0);
  });
  const incomeLabels = [], incomeData = [];
  for(let i=5; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    incomeLabels.push(months[d.getMonth()]);
    incomeData.push(incomeByMonth[key]||0);
  }

  if(chartIncome) chartIncome.destroy();
  chartIncome = new Chart(document.getElementById('incomeChart'), {
    type: 'line',
    data: {
      labels: incomeLabels,
      datasets: [{
        data: incomeData,
        borderColor: '#1ED98A',
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0,0,0,200);
          g.addColorStop(0,'rgba(30,217,138,0.28)'); g.addColorStop(0.6,'rgba(30,217,138,0.06)'); g.addColorStop(1,'rgba(30,217,138,0)');
          return g;
        },
        borderWidth: 2.5, fill: true, tension: 0.45,
        pointBackgroundColor: '#1ED98A', pointRadius: 5, pointHoverRadius: 8,
        pointBorderColor: 'rgba(8,12,18,0.8)', pointBorderWidth: 2,
        pointHoverBackgroundColor: '#4EEAAA', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      animation: { duration: 1000, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor:'rgba(8,12,18,0.95)', titleColor:'#EEF2FF', bodyColor:'#7A8BA8', borderColor:'rgba(30,217,138,0.25)', borderWidth:1, padding:12, cornerRadius:10, displayColors:false, callbacks:{ label: ctx => '$' + ctx.parsed.y.toLocaleString() } }
      },
      scales: {
        x: { ticks:{ color:'rgba(176,191,218,0.45)', font:{size:10}, padding:6 }, grid:{ color:'rgba(255,255,255,0.03)', drawBorder:false } },
        y: { ticks:{ color:'rgba(176,191,218,0.45)', font:{size:10}, padding:8, callback: v=>'$'+v.toLocaleString() }, grid:{ color:'rgba(255,255,255,0.04)', drawBorder:false } }
      }
    }
  });

  // ── ACTIVITY CHART — real daily calls from retos history (last 30 days) ──
  const actLabels = [], actData = [], goalData = [];
  const retosH = (S.retos && S.retos.history) ? S.retos.history : {};
  const goal   = (S.retos && S.retos.goal) ? S.retos.goal : 20;
  for(let i=29; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = fmtDate(d);
    const dayData = retosH[key] || { calls:0, goal };
    // Short label: day/month for every 5th, else just day number
    actLabels.push(i % 5 === 0 ? `${d.getDate()}/${d.getMonth()+1}` : '');
    actData.push(dayData.calls || 0);
    goalData.push(dayData.goal || goal);
  }

  if(chartActivity) chartActivity.destroy();
  chartActivity = new Chart(document.getElementById('activityChart'), {
    type: 'line',
    data: {
      labels: actLabels,
      datasets: [
        {
          label: 'Llamadas',
          data: actData,
          borderColor: '#4F8EFF',
          backgroundColor: ctx => {
            const g = ctx.chart.ctx.createLinearGradient(0,0,0,220);
            g.addColorStop(0,'rgba(79,142,255,0.35)'); g.addColorStop(0.5,'rgba(79,142,255,0.08)'); g.addColorStop(1,'rgba(79,142,255,0)');
            return g;
          },
          borderWidth: 2.5, fill: true, tension: 0.35,
          pointBackgroundColor: ctx => {
            const v = actData[ctx.dataIndex];
            const g = goalData[ctx.dataIndex];
            return v >= g ? '#22D98A' : v > 0 ? '#4F8EFF' : 'transparent';
          },
          pointRadius: ctx => actData[ctx.dataIndex] > 0 ? 4 : 0,
          pointHoverRadius: 7,
          pointBorderColor: 'rgba(8,12,18,0.8)', pointBorderWidth: 2,
          pointHoverBackgroundColor: '#82AEFF', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        },
        {
          label: 'Meta',
          data: goalData,
          borderColor: 'rgba(34,217,138,0.4)',
          borderWidth: 1.5,
          borderDash: [5,4],
          fill: false, tension: 0,
          pointRadius: 0, pointHoverRadius: 0,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode:'index', intersect:false },
      animation: { duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor:'rgba(8,12,18,0.95)', titleColor:'#EEF2FF', bodyColor:'#7A8BA8',
          borderColor:'rgba(79,142,255,0.3)', borderWidth:1, padding:12, cornerRadius:10,
          callbacks: {
            title: items => {
              const i = items[0].dataIndex;
              const d = new Date(); d.setDate(d.getDate()-(29-i));
              return d.toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'});
            },
            label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + (ctx.dataset.label==='Llamadas'?' llamadas':' meta')
          }
        }
      },
      scales: {
        x: { ticks:{ color:'rgba(176,191,218,0.4)', font:{size:9}, padding:4, maxRotation:0 }, grid:{ color:'rgba(255,255,255,0.03)', drawBorder:false } },
        y: { min:0, ticks:{ color:'rgba(176,191,218,0.45)', font:{size:10}, padding:8, stepSize:5 }, grid:{ color:'rgba(255,255,255,0.04)', drawBorder:false } }
      }
    }
  });

  // ── INSIGHTS — real data ──
  const topClient = allContacts.filter(c=>c.status==='Cerrado'||c.finalResult==='Cerrado')
    .sort((a,b)=>(b.value||0)-(a.value||0))[0];
  document.getElementById('insightTopClient').textContent = topClient
    ? topClient.name + ' ($' + (topClient.value||0).toLocaleString() + ')' : 'Sin ventas aún';
  document.getElementById('insightAvgTicket').textContent = '$' + avgTicket.toLocaleString();

  // Best day from retos history
  let bestDayStr = 'Sin datos';
  if(S.retos && S.retos.history) {
    const best = Object.entries(S.retos.history).sort((a,b)=>b[1].calls-a[1].calls)[0];
    if(best && best[1].calls > 0) {
      const bd = new Date(best[0]+'T12:00:00');
      bestDayStr = bd.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'short'}) + ` (${best[1].calls} llamadas)`;
    }
  }
  document.getElementById('insightBestDay').textContent = bestDayStr;
}

function animateMetric(id, target) {
  const el = document.getElementById(id);
  if(!el) return;
  let v = 0; const step = target / 30;
  const t = setInterval(() => { v = Math.min(v+step, target); el.textContent = Math.round(v); if(v>=target) clearInterval(t); }, 20);
}

// ── SCRIPTS ──
function initScripts() {
  document.getElementById('addScriptBtn').addEventListener('click',()=>openModal('scriptModal'));
  document.getElementById('closeScriptModal').addEventListener('click',()=>closeModal('scriptModal'));
  document.getElementById('cancelScript').addEventListener('click',()=>closeModal('scriptModal'));
  document.getElementById('saveScript').addEventListener('click',()=>{
    const title=document.getElementById('sTitle').value.trim();
    const content=document.getElementById('sContent').value.trim();
    if(!title||!content){ showToast('Título y contenido requeridos','error'); return; }
    S.scripts.push({id:uid(),title,category:document.getElementById('sCategory').value,content,fav:false});
    save(); closeModal('scriptModal'); renderScripts();
    document.getElementById('sTitle').value=''; document.getElementById('sContent').value='';
    showToast('Guion creado','success');
  });
  document.getElementById('scriptSearch').addEventListener('input', renderScripts);
}

function renderScripts() {
  const q = document.getElementById('scriptSearch').value.toLowerCase();
  const list = S.scripts.filter(s=>!q||s.title.toLowerCase().includes(q)||s.category.toLowerCase().includes(q));
  const cats = ['Primer contacto','Seguimiento','Cierre','Objeciones'];
  const container = document.getElementById('scriptsList');
    const catColorMap = {'Primer contacto':'#4F8EFF','Seguimiento':'#FFD166','Cierre':'#1ED98A','Objeciones':'#FF4D6A'};
  container.innerHTML = list.length ? list.map((s,i)=>`
    <div class="script-card ${S.activeScript===s.id?'active':''}" data-cat="${s.category}"
      style="animation-delay:${i*0.05}s"
      onclick="viewScript('${s.id}')">
      <div class="sc-title">${s.fav?'<i class="fa-solid fa-star sc-fav"></i>':''} ${s.title}</div>
      <div class="sc-cat" style="color:${catColorMap[s.category]||'var(--text2)'}88">${s.category}</div>
    </div>`).join('')
    : '<div class="script-empty" style="height:120px"><i class="fa-solid fa-scroll"></i><p>Sin guiones</p></div>';
}

function viewScript(id) {
  S.activeScript = id;
  const s = S.scripts.find(x=>x.id===id);
  if(!s) return;
  const catColorMap = {'Primer contacto':'#4F8EFF','Seguimiento':'#FFD166','Cierre':'#1ED98A','Objeciones':'#FF4D6A'};
  const c = catColorMap[s.category] || '#A855F7';
  const viewer = document.getElementById('scriptViewer');
  const isMobile = window.innerWidth < 768;
  if(isMobile) document.querySelector('.scripts-layout').classList.add('script-open');
  viewer.innerHTML = `<div class="glass-card script-view" style="background:linear-gradient(160deg,${c}0d 0%,rgba(8,12,18,0.85) 50%);border-color:${c}22;">
    <div class="sv-header">
      <div style="display:flex;align-items:center;gap:10px">
        ${isMobile ? `<button onclick="closeScriptViewer()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text2);width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.85rem;flex-shrink:0"><i class="fa-solid fa-arrow-left"></i></button>` : ''}
        <div>
          <div class="sv-title">${s.title}</div>
          <div class="sv-cat" style="color:${c}99">${s.category}</div>
        </div>
      </div>
      <div class="sv-actions">
        <button class="btn-ghost" style="padding:7px 12px;font-size:0.78rem" onclick="toggleFav('${s.id}')"><i class="fa-${s.fav?'solid':'regular'} fa-star" style="color:var(--yellow)"></i></button>
        <button class="btn-ghost" style="padding:7px 12px;font-size:0.78rem" onclick="copyScript('${s.id}')"><i class="fa-solid fa-copy"></i> Copiar</button>
        <button class="btn-primary" style="padding:7px 14px;font-size:0.78rem" onclick="editScriptInline('${s.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
        <button class="btn-ghost" style="padding:7px 12px;font-size:0.78rem;color:var(--red)" onclick="deleteScript('${s.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
    <div class="sv-content">${s.content}</div>
  </div>`;
  renderScripts();
}

function closeScriptViewer() {
  document.querySelector('.scripts-layout').classList.remove('script-open');
  document.getElementById('scriptViewer').innerHTML = '<div class="script-empty"><i class="fa-solid fa-scroll"></i><p>Selecciona un guion</p></div>';
  S.activeScript = null;
}

function editScriptInline(id) {
  const s = S.scripts.find(x=>x.id===id);
  if(!s) return;
  document.getElementById('scriptViewer').innerHTML = `<div class="glass-card script-view">
    <div class="sv-header">
      <input id="editSTitle" value="${s.title}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:9px;font-size:0.95rem;font-weight:700;outline:none;flex:1;font-family:inherit">
      <div class="sv-actions">
        <button class="btn-primary" style="padding:7px 14px;font-size:0.78rem" onclick="saveScriptInline('${s.id}')"><i class="fa-solid fa-check"></i> Guardar</button>
        <button class="btn-ghost" style="padding:7px 12px;font-size:0.78rem" onclick="viewScript('${s.id}')">Cancelar</button>
      </div>
    </div>
    <textarea class="sv-content-edit" id="editSContent">${s.content}</textarea>
  </div>`;
}

function saveScriptInline(id) {
  const s = S.scripts.find(x=>x.id===id);
  if(!s) return;
  s.title = document.getElementById('editSTitle').value.trim()||s.title;
  s.content = document.getElementById('editSContent').value;
  save(); viewScript(id); showToast('Guion guardado','success');
}

function copyScript(id) {
  const s = S.scripts.find(x=>x.id===id);
  if(!s) return;
  navigator.clipboard.writeText(s.content).then(()=>showToast('Copiado al portapapeles','success'));
}

function toggleFav(id) {
  const s = S.scripts.find(x=>x.id===id);
  if(s){ s.fav=!s.fav; save(); viewScript(id); }
}

function deleteScript(id) {
  if(!confirm('¿Eliminar este guion?')) return;
  S.scripts = S.scripts.filter(s=>s.id!==id);
  S.activeScript = null;
  document.getElementById('scriptViewer').innerHTML = '<div class="script-empty"><i class="fa-solid fa-scroll"></i><p>Selecciona un guion</p></div>';
  save(); renderScripts(); showToast('Guion eliminado');
}

// ── SETTINGS ──
function initSettings() {
  document.getElementById('addBizTypeBtn').addEventListener('click',()=>{
    const val=document.getElementById('newBizType').value.trim();
    if(val&&!S.bizTypes.includes(val)){ S.bizTypes.push(val); save(); renderSettings(); document.getElementById('newBizType').value=''; }
  });
  document.getElementById('exportCSV').addEventListener('click', exportCSV);
  document.getElementById('importCSV').addEventListener('change', importCSV);
  document.getElementById('clearData').addEventListener('click',()=>{
    if(confirm('¿Eliminar TODOS los datos?')){ S.contacts=[]; S.events=[]; S.callsToday=0; S.notifications=[]; save(); renderAll(); showToast('Datos eliminados'); }
  });
  document.getElementById('loadSample').addEventListener('click', loadSampleData);
}

// ── THEME ──
function applyTheme(theme, save = true) {
  document.body.classList.toggle('light', theme === 'light');
  if(save) localStorage.setItem('vp_theme', theme);
  // Update toggle UI
  const dark = document.getElementById('themeOptDark');
  const light = document.getElementById('themeOptLight');
  if(dark)  dark.classList.toggle('active',  theme === 'dark');
  if(light) light.classList.toggle('active', theme === 'light');
}
function setTheme(theme) { applyTheme(theme, true); }

function renderSettings() {
  applyTheme(localStorage.getItem('vp_theme') || 'dark', false);
  document.getElementById('bizTypesList').innerHTML = S.bizTypes.map(t => {
    const bs = getBizStyle(t);
    return `<div class="chip" style="background:${bs.bg};border-color:${bs.color}30;color:${bs.color}"><i class="${bs.icon}" style="font-size:0.7rem;margin-right:4px"></i>${t}<button onclick="removeBizType('${t}')" style="color:${bs.color};opacity:0.7"><i class="fa-solid fa-xmark"></i></button></div>`;
  }).join('');
}

function removeBizType(t){ S.bizTypes=S.bizTypes.filter(x=>x!==t); save(); renderSettings(); }

function exportCSV() {
  const rows = S.contacts.map(c=>[c.name,c.phone,c.location||'',c.type||'',c.website||'',c.status,(c.tags||[]).join(';'),c.notes||'',c.value||0].map(v=>`"${v}"`).join(','));
  const csv = ['Nombre,Teléfono,Ubicación,Tipo,Web,Estado,Etiquetas,Notas,Valor',...rows].join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='contactos.csv'; a.click();
  showToast('CSV exportado','success');
}

function importCSV(e) {
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const lines=ev.target.result.split('\n').slice(1); let count=0;
    lines.forEach(line=>{ const cols=line.split(',').map(c=>c.replace(/^"|"$/g,'').trim()); if(cols[0]&&cols[1]){ S.contacts.push({id:uid(),name:cols[0],phone:cols[1],location:cols[2]||'',type:cols[3]||'',website:cols[4]||'No',status:cols[5]||'Nuevo',tags:cols[6]?cols[6].split(';'):[],notes:cols[7]||'',value:parseFloat(cols[8])||0,calls:0,createdAt:Date.now()}); count++; } });
    save(); renderContacts(); showToast(`${count} contactos importados`,'success');
  };
  reader.readAsText(file); e.target.value='';
}

// ── NOTIFICATIONS ──
function initNotifications() {
  document.getElementById('notifBtn').addEventListener('click',()=>{
    document.getElementById('notifList').innerHTML = S.notifications.length
      ? S.notifications.map(n=>`<div class="notif-item"><i class="fa-solid fa-bell"></i><div><div>${n.text}</div><div style="font-size:0.73rem;color:var(--text2);margin-top:2px">${n.time}</div></div></div>`).join('')
      : '<div style="padding:24px;text-align:center;color:var(--text2)"><i class="fa-solid fa-bell-slash" style="font-size:1.5rem;opacity:0.2;display:block;margin-bottom:8px"></i>Sin notificaciones</div>';
    openModal('notifModal');
  });
  document.getElementById('closeNotif').addEventListener('click',()=>closeModal('notifModal'));
  checkReminders();
}

function checkReminders() {
  const today = fmtDate(new Date());
  S.events.filter(e=>e.date===today).forEach(e=>{
    if(!S.notifications.find(n=>n.text.includes(e.title)))
      S.notifications.push({id:uid(),text:`Recordatorio: ${e.title}`,time:`Hoy ${e.time||''}`});
  });
  updateNotifBadge();
}

function updateNotifBadge() {
  const dot = document.getElementById('notifDot');
  dot.classList.toggle('show', S.notifications.length > 0);
}

function updateSidebarBadge() {
  const badge = document.getElementById('sbContactBadge');
  const mobBadge = document.getElementById('mobContactBadge');
  const count = S.contacts.length;
  if(badge) { badge.textContent = count > 99 ? '99+' : count; badge.classList.toggle('show', count > 0); }
  if(mobBadge) { mobBadge.textContent = count > 99 ? '99+' : count; mobBadge.classList.toggle('show', count > 0); }
}

// ── FILTERS ──
function initFilters() {
  document.getElementById('searchInput').addEventListener('input', renderContacts);
  document.getElementById('filterType').addEventListener('change', renderContacts);

  // Chips
  document.getElementById('filterChips').addEventListener('click', e => {
    const chip = e.target.closest('.ct-chip');
    if (!chip) return;
    document.querySelectorAll('.ct-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilterStatus = chip.dataset.status !== undefined ? chip.dataset.status : '';
    activeFilterTag = chip.dataset.tag || '';
    renderContacts();
  });

  // Historial filters
  document.getElementById('histSearch').addEventListener('input', renderHistorial);
  document.getElementById('histFilterResult').addEventListener('change', renderHistorial);
  document.getElementById('histFilterType').addEventListener('change', () => renderHistorial());
}

// ── MODAL HELPERS ──
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-bg').forEach(bg=>bg.addEventListener('click',e=>{ if(e.target===bg) bg.classList.remove('open'); }));

// ── TOAST ──
function showToast(msg, type='') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast show '+type;
  setTimeout(()=>t.className='toast',2800);
}

// ══════════════════════════════
// HISTORIAL DE LLAMADAS
// ══════════════════════════════
function renderHistorial() {
  if(!S.archive) S.archive = [];
  const container = document.getElementById('historialList');
  if(!container) return;

  // Populate type filter
  const htf = document.getElementById('histFilterType');
  if(htf) {
    const cur = htf.value;
    htf.innerHTML = '<option value="">Todos los tipos</option>' +
      S.bizTypes.map(t => `<option value="${t}" ${cur===t?'selected':''}>${t}</option>`).join('');
  }

  const search = document.getElementById('histSearch') ? document.getElementById('histSearch').value.toLowerCase() : '';
  const filterResult = document.getElementById('histFilterResult') ? document.getElementById('histFilterResult').value : '';
  const filterType   = htf ? htf.value : '';

  let list = S.archive.filter(c => {
    const ms = !search || c.name.toLowerCase().includes(search) ||
               c.phone.includes(search) || (c.location||'').toLowerCase().includes(search);
    const mr = !filterResult || (c.callHistory||[]).some(h=>h.result===filterResult) || c.finalResult===filterResult;
    const mt = !filterType || c.type === filterType;
    return ms && mr && mt;
  });

  // Stats bar
  const total = S.archive.length;
  const closed = S.archive.filter(c=>c.finalResult==='Cerrado').length;
  const revenue = S.archive.filter(c=>c.finalResult==='Cerrado').reduce((a,c)=>a+(c.value||0),0);
  document.getElementById('histStats').innerHTML = `
    <div class="hist-stat"><i class="fa-solid fa-book" style="color:var(--blue2)"></i><span>${total}</span><label>Total archivados</label></div>
    <div class="hist-stat-div"></div>
    <div class="hist-stat"><i class="fa-solid fa-handshake" style="color:var(--green)"></i><span style="color:var(--green)">${closed}</span><label>Cerrados</label></div>
    <div class="hist-stat-div"></div>
    <div class="hist-stat"><i class="fa-solid fa-dollar-sign" style="color:var(--yellow)"></i><span style="color:var(--yellow)">$${revenue.toLocaleString()}</span><label>Ingresos</label></div>
  `;

  if(!list.length) {
    container.innerHTML = `<div class="hist-empty">
      <i class="fa-solid fa-book-open"></i>
      <div>${total === 0 ? 'El historial está vacío — los contactos cerrados aparecerán aquí' : 'Sin resultados para ese filtro'}</div>
    </div>`;
    return;
  }

  const resultColors = {
    'Cerrado':'#22D98A','Interesado':'#A855F7','No interesado':'#FF4D6A',
    'No contestó':'#4F8EFF','Llamar luego':'#FFD166','Número incorrecto':'#FF8C42','Llamado':'#7A8BA8'
  };

  container.innerHTML = list.map((c,i) => {
    const bs = getBizStyle(c.type);
    const lastCall = (c.callHistory||[])[0];
    const totalCalls = c.calls || 0;
    const finalColor = resultColors[c.finalResult] || '#7A8BA8';
    const color = getColor(c.name);
    return `<div class="hist-row" style="animation-delay:${i*0.03}s">
      <div class="hist-avatar" style="background:linear-gradient(135deg,${color},${color}88)">${c.name.charAt(0).toUpperCase()}</div>
      <div class="hist-main">
        <div class="hist-name">${c.name}</div>
        <div class="hist-meta">
          <span class="hist-type" style="color:${bs.color};background:${bs.bg}"><i class="${bs.icon}"></i>${c.type||'Sin tipo'}</span>
          ${c.location ? `<span class="hist-loc"><i class="fa-solid fa-location-dot"></i>${c.location}</span>` : ''}
        </div>
      </div>
      <div class="hist-phone">
        <div class="hist-phone-num">${c.phone}</div>
        <div class="hist-calls"><i class="fa-solid fa-phone"></i>${totalCalls} llamada${totalCalls!==1?'s':''}</div>
      </div>
      <div class="hist-result">
        <span class="hist-badge" style="color:${finalColor};background:${finalColor}18;border-color:${finalColor}30">${c.finalResult||'Archivado'}</span>
        <div class="hist-date">${c.archivedDate||''}</div>
      </div>
      <div class="hist-actions">
        <button class="hist-btn-restore" onclick="restoreContact('${c.id}')" title="Restaurar a contactos activos"><i class="fa-solid fa-rotate-left"></i></button>
        <button class="hist-btn-delete" onclick="deleteArchived('${c.id}')" title="Eliminar permanentemente"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function restoreContact(id) {
  if(!S.archive) return;
  const c = S.archive.find(x=>x.id===id);
  if(!c) return;
  const { archivedAt, archivedDate, finalResult, ...contact } = c;
  contact.status = 'Nuevo';
  S.contacts.unshift(contact);
  S.archive = S.archive.filter(x=>x.id!==id);
  save(); renderContacts(); renderHistorial();
  showToast(`${c.name} restaurado a contactos`, 'success');
}

function deleteArchived(id) {
  if(!confirm('¿Eliminar permanentemente del historial?')) return;
  S.archive = (S.archive||[]).filter(x=>x.id!==id);
  save(); renderHistorial();
  showToast('Eliminado del historial');
}

// ══════════════════════════════
// RETOS DIARIOS
// ══════════════════════════════
const LEVELS = [
  { name:'Novato',      icon:'fa-solid fa-seedling',          color:'#7A8BA8', xpNeeded:0   },
  { name:'Prospector',  icon:'fa-solid fa-magnifying-glass',  color:'#4F8EFF', xpNeeded:200 },
  { name:'Vendedor',    icon:'fa-solid fa-handshake',         color:'#A855F7', xpNeeded:500 },
  { name:'Lobo',        icon:'fa-solid fa-wolf-pack-battalion',color:'#FF8C42',xpNeeded:1000},
  { name:'Leyenda',     icon:'fa-solid fa-crown',             color:'#FFD166', xpNeeded:2000},
];
const ACHIEVEMENTS = [
  { id:'first_call',   name:'Primera llamada', desc:'Registra tu primera llamada',        icon:'fa-solid fa-phone',          bg:'rgba(79,142,255,0.15)',  color:'#4F8EFF',  check: s => s.retos.totalCalls >= 1 },
  { id:'ten_day',      name:'10 en un día',    desc:'Haz 10 llamadas en un día',          icon:'fa-solid fa-fire',           bg:'rgba(255,140,66,0.15)', color:'#FF8C42',  check: s => s.retos.bestDay >= 10 },
  { id:'goal_hit',     name:'Meta cumplida',   desc:'Completa tu meta diaria',            icon:'fa-solid fa-bullseye',       bg:'rgba(30,217,138,0.15)', color:'#1ED98A',  check: s => s.retos.goalsHit >= 1 },
  { id:'streak3',      name:'Racha x3',        desc:'3 días consecutivos con meta',       icon:'fa-solid fa-bolt-lightning', bg:'rgba(255,209,102,0.15)',color:'#FFD166',  check: s => s.retos.streak >= 3 },
  { id:'streak7',      name:'Semana perfecta', desc:'7 días consecutivos con meta',       icon:'fa-solid fa-star',           bg:'rgba(168,85,247,0.15)', color:'#A855F7',  check: s => s.retos.streak >= 7 },
  { id:'level2',       name:'Prospector',      desc:'Alcanza el nivel Prospector',        icon:'fa-solid fa-magnifying-glass',bg:'rgba(79,142,255,0.15)',color:'#4F8EFF',  check: s => s.retos.xp >= 200 },
  { id:'level3',       name:'Vendedor Pro',    desc:'Alcanza el nivel Vendedor',          icon:'fa-solid fa-handshake',      bg:'rgba(168,85,247,0.15)', color:'#A855F7',  check: s => s.retos.xp >= 500 },
  { id:'hundred',      name:'100 llamadas',    desc:'Acumula 100 llamadas totales',       icon:'fa-solid fa-trophy',         bg:'rgba(255,209,102,0.15)',color:'#FFD166',  check: s => s.retos.totalCalls >= 100 },
];

function initRetos() {
  if(!S.retos) S.retos = { xp:0, totalCalls:0, bestDay:0, streak:0, goalsHit:0, goal:20, history:{}, lastDate:'' };
  // Reset daily calls if new day
  const today = fmtDate(new Date());
  if(S.retos.lastDate !== today) {
    // Check if yesterday's goal was hit for streak
    const yesterday = fmtDate(new Date(Date.now()-86400000));
    const yData = S.retos.history[yesterday];
    if(S.retos.lastDate === yesterday && yData && yData.calls >= yData.goal) {
      S.retos.streak = (S.retos.streak||0) + 1;
    } else if(S.retos.lastDate && S.retos.lastDate !== yesterday) {
      S.retos.streak = 0; // broke streak
    }
    if(!S.retos.history[today]) S.retos.history[today] = { calls:0, goal: S.retos.goal };
    S.retos.lastDate = today;
    save();
  }
}

function renderRetos() {
  initRetos();
  const today = fmtDate(new Date());
  const todayData = S.retos.history[today] || { calls:0, goal: S.retos.goal };
  const calls = todayData.calls;
  const goal = S.retos.goal;

  // ── Level ──
  let levelIdx = 0;
  for(let i = LEVELS.length-1; i >= 0; i--) {
    if(S.retos.xp >= LEVELS[i].xpNeeded) { levelIdx = i; break; }
  }
  const level = LEVELS[levelIdx];
  const nextLevel = LEVELS[levelIdx+1];
  const xpInLevel = S.retos.xp - level.xpNeeded;
  const xpNeeded = nextLevel ? nextLevel.xpNeeded - level.xpNeeded : 1;
  const xpPct = nextLevel ? Math.min(100, Math.round(xpInLevel/xpNeeded*100)) : 100;

  document.getElementById('retosLevelName').textContent = level.name;
  document.getElementById('retosLevelNum').textContent = `Nivel ${levelIdx+1}`;
  document.getElementById('retosLevelIcon').innerHTML = `<i class="${level.icon}"></i>`;
  document.getElementById('retosLevelIcon').style.background = `linear-gradient(135deg, ${level.color}, ${level.color}88)`;
  document.getElementById('retosXpFill').style.width = xpPct + '%';
  document.getElementById('retosXpLabel').textContent = nextLevel
    ? `${xpInLevel} / ${xpNeeded} XP → ${nextLevel.name}`
    : `${S.retos.xp} XP — Nivel máximo`;
  document.getElementById('retosTotalXp').textContent = S.retos.xp.toLocaleString();
  document.getElementById('retosStreak').innerHTML = `<i class="fa-solid fa-fire" style="color:var(--orange)"></i> ${S.retos.streak}`;
  document.getElementById('retosBestDay').textContent = S.retos.bestDay;

  // ── Daily date ──
  document.getElementById('retosDailyDate').textContent = new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('retosGoalNum').textContent = goal;
  document.getElementById('retosRingGoal').textContent = goal;
  document.getElementById('retosCallsDone').textContent = calls;

  // ── Ring ──
  const circumference = 327;
  const pct = goal > 0 ? Math.min(1, calls/goal) : 0;
  document.getElementById('retosRingFill').style.strokeDashoffset = circumference - (circumference * pct);

  // ── Dots grid ──
  const grid = document.getElementById('retosCallsGrid');
  grid.innerHTML = Array.from({length: goal}, (_,i) => `
    <div class="retos-call-dot ${i < calls ? 'done' : 'empty'}" style="${i < calls ? `animation-delay:${i*0.03}s` : ''}">
      ${i < calls ? '<i class="fa-solid fa-check" style="font-size:0.6rem"></i>' : ''}
    </div>`).join('');

  // ── Call button ──
  const btn = document.getElementById('retosCallBtn');
  if(calls >= goal) {
    btn.classList.add('done');
    btn.innerHTML = `<i class="fa-solid fa-check-double"></i><span>¡Meta completada!</span><div class="retos-call-btn-xp">+5 XP</div>`;
  } else {
    btn.classList.remove('done');
    btn.innerHTML = `<i class="fa-solid fa-phone"></i><span>Registrar llamada</span><div class="retos-call-btn-xp">+10 XP</div>`;
  }

  // ── Week grid ──
  const weekGrid = document.getElementById('retosWeekGrid');
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let weekXp = 0;
  weekGrid.innerHTML = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (6-i));
    const key = fmtDate(d);
    const data = S.retos.history[key] || {calls:0, goal: S.retos.goal};
    const pct = data.goal > 0 ? Math.min(100, Math.round(data.calls/data.goal*100)) : 0;
    const isToday = key === today;
    const complete = data.calls >= data.goal && data.calls > 0;
    const partial = data.calls > 0 && !complete;
    const barColor = complete ? 'var(--green)' : partial ? 'var(--orange)' : 'rgba(255,255,255,0.15)';
    if(data.calls > 0) weekXp += data.calls * 10;
    return `<div class="retos-week-day ${isToday?'today':''} ${complete?'complete':''} ${partial?'partial':''}">
      <div class="retos-week-label">${days[d.getDay()]}</div>
      <div class="retos-week-num" style="color:${complete?'var(--green)':partial?'var(--orange)':'var(--text2)'}">${data.calls}</div>
      <div class="retos-week-bar"><div class="retos-week-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
    </div>`;
  }).join('');
  document.getElementById('retosWeekXp').textContent = weekXp + ' XP ganados esta semana';

  // ── Achievements ──
  const achGrid = document.getElementById('retosAchievements');
  achGrid.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = a.check(S);
    return `<div class="retos-achievement ${unlocked?'unlocked':'locked'}">
      <div class="retos-ach-icon" style="${unlocked?`background:${a.bg};color:${a.color}`:''}">
        <i class="${a.icon}"></i>
      </div>
      <div class="retos-ach-name">${a.name}</div>
      <div class="retos-ach-desc">${a.desc}</div>
    </div>`;
  }).join('');
}

function retosLogCall() {
  initRetos();
  const today = fmtDate(new Date());
  if(!S.retos.history[today]) S.retos.history[today] = { calls:0, goal: S.retos.goal };

  const prevXp = S.retos.xp;
  let prevLevelIdx = 0;
  for(let i = LEVELS.length-1; i >= 0; i--) { if(prevXp >= LEVELS[i].xpNeeded) { prevLevelIdx = i; break; } }

  S.retos.history[today].calls++;
  S.retos.totalCalls++;
  S.retos.xp += 10;

  const calls = S.retos.history[today].calls;
  const goal  = S.retos.goal;

  // Bonus XP on goal completion
  if(calls === goal) {
    S.retos.xp += 50;
    S.retos.goalsHit++;
    showToast('¡Meta diaria completada! +50 XP bonus 🎯', 'success');
  }

  // Best day
  if(calls > S.retos.bestDay) S.retos.bestDay = calls;

  // Level up check
  let newLevelIdx = 0;
  for(let i = LEVELS.length-1; i >= 0; i--) { if(S.retos.xp >= LEVELS[i].xpNeeded) { newLevelIdx = i; break; } }
  if(newLevelIdx > prevLevelIdx) {
    showLevelUp(LEVELS[newLevelIdx]);
  }

  save();
  renderRetos();
}

function retosResetDay() {
  if(!confirm('¿Reiniciar el contador de hoy? El historial y XP se mantienen.')) return;
  initRetos();
  const today = fmtDate(new Date());
  if(S.retos.history[today]) {
    S.retos.history[today].calls = 0;
  }
  save();
  renderRetos();
  showToast('Contador del día reiniciado', '');
}

function changeGoal(delta) {
  initRetos();
  S.retos.goal = Math.max(5, Math.min(100, (S.retos.goal||20) + delta));
  const today = fmtDate(new Date());
  if(S.retos.history[today]) S.retos.history[today].goal = S.retos.goal;
  save();
  renderRetos();
}

function showLevelUp(level) {
  let toast = document.getElementById('levelupToast');
  if(!toast) {
    toast = document.createElement('div');
    toast.id = 'levelupToast';
    toast.className = 'levelup-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="${level.icon}"></i> ¡Subiste a ${level.name}! 🎉`;
  toast.classList.add('show');
  document.getElementById('retosLevelIcon').style.animation = 'levelUp 0.6s ease';
  setTimeout(() => {
    toast.classList.remove('show');
    document.getElementById('retosLevelIcon').style.animation = '';
  }, 3500);
}

// ══════════════════════════════
// PEGADO INTELIGENTE
// ══════════════════════════════
function initPasteModal() {
  document.getElementById('pasteBtn').addEventListener('click', openPasteModal);
  document.getElementById('closePasteModal').addEventListener('click', closePasteModal);
  document.getElementById('cancelPaste1').addEventListener('click', closePasteModal);
  document.getElementById('cancelPaste2').addEventListener('click', closePasteModal);
  document.getElementById('analyzePasteBtn').addEventListener('click', analyzePasteText);
  document.getElementById('pasteBackBtn').addEventListener('click', () => {
    document.getElementById('pasteStep1').style.display = '';
    document.getElementById('pasteStep2').style.display = 'none';
  });
  document.getElementById('confirmPasteBtn').addEventListener('click', confirmPasteSave);
  document.getElementById('pasteDupConfirmBtn').addEventListener('click', () => {
    window._pasteDupConfirmed = true;
    document.getElementById('pasteDupWarn').style.display = 'none';
    confirmPasteSave();
  });
  document.getElementById('pfPhone').addEventListener('input', () => {
    window._pasteDupConfirmed = false;
    document.getElementById('pasteDupWarn').style.display = 'none';
    document.getElementById('pasteNoPhoneWarn').style.display =
      document.getElementById('pfPhone').value.trim() ? 'none' : 'flex';
  });
  // Close on backdrop
  document.getElementById('pasteModal').addEventListener('click', e => {
    if(e.target === document.getElementById('pasteModal')) closePasteModal();
  });
}

function openPasteModal() {
  window._pasteDupConfirmed = false;
  document.getElementById('pasteRawText').value = '';
  document.getElementById('pasteStep1').style.display = '';
  document.getElementById('pasteStep2').style.display = 'none';
  document.getElementById('pasteNoPhoneWarn').style.display = 'none';
  document.getElementById('pasteDupWarn').style.display = 'none';
  openModal('pasteModal');
  setTimeout(() => document.getElementById('pasteRawText').focus(), 120);
}

function closePasteModal() {
  closeModal('pasteModal');
  window._pasteDupConfirmed = false;
}

// ── PARSER ──
function parseBusinessText(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { name:'', phone:'', location:'', type:'', confidence:{} };

  // ── Phone: international formats ──
  const phoneRx = /(\+?[\d\s\-().]{7,20})/g;
  for(const line of lines) {
    const m = line.match(/(\+?[\d][\d\s\-().]{6,18}[\d])/);
    if(m) {
      const digits = m[1].replace(/\D/g,'');
      if(digits.length >= 7 && digits.length <= 15) {
        result.phone = m[1].trim();
        result.confidence.phone = 'high';
        break;
      }
    }
  }

  // ── Name: first non-phone, non-rating, non-address line ──
  const ratingRx = /^\d[\d.,]*\s*[★✩⭐*]/;
  const addressRx = /\b(av\.|avenida|calle|col\.|colonia|blvd|boulevard|carretera|km\b|#\d|no\.\s*\d|\d{3,})/i;
  const hoursRx = /abierto|cierra|horario|lunes|martes|miércoles|jueves|viernes|sábado|domingo/i;
  const webRx = /^https?:\/\/|www\./i;
  const metaRx = /reseñas|calificaci|rating|opiniones/i;

  for(const line of lines) {
    if(line === result.phone) continue;
    if(ratingRx.test(line)) continue;
    if(hoursRx.test(line)) continue;
    if(webRx.test(line)) continue;
    if(metaRx.test(line)) continue;
    if(/^\d[\d.,]*\s*(★|estrellas|\()/i.test(line)) continue;
    if(line.replace(/\D/g,'').length > line.length * 0.6) continue; // mostly digits
    if(line.length < 3) continue;
    result.name = line;
    result.confidence.name = 'high';
    break;
  }

  // ── Location: lines with address keywords or city patterns ──
  const locKeywords = /\b(col\.|colonia|av\.|avenida|calle|blvd|cdmx|ciudad de méxico|guadalajara|monterrey|puebla|cancún|tijuana|estado|municipio|cp\s*\d|c\.p\.|delegaci|alcaldía|km\b|carretera|#\s*\d|\d{4,5})/i;
  for(const line of lines) {
    if(line === result.name || line === result.phone) continue;
    if(ratingRx.test(line) || hoursRx.test(line) || webRx.test(line)) continue;
    if(locKeywords.test(line) || (line.includes(',') && line.length > 10 && !line.match(/^\+?\d/))) {
      // Clean: remove postal codes at end, trim
      result.location = line.replace(/,?\s*C\.?P\.?\s*\d{4,6}/i,'').replace(/,?\s*México$/i,'').trim();
      result.confidence.location = 'medium';
      break;
    }
  }

  // ── Type detection from name/text ──
  const typeMap = [
    { keys:['restaurante','taquería','taqueria','fonda','comida','cocina','mariscos','sushi','pizza','burger','café','cafetería','panadería','pastelería'], type:'Restaurante' },
    { keys:['salón','salon','belleza','estética','estetica','spa','uñas','peluquería','barbería','barberia'], type:'Salón de belleza' },
    { keys:['clínica','clinica','médico','medico','dental','dentista','doctor','hospital','farmacia','laboratorio'], type:'Clínica' },
    { keys:['farmacia','droguería'], type:'Farmacia' },
    { keys:['gym','gimnasio','fitness','crossfit','yoga','pilates'], type:'Gimnasio' },
    { keys:['hotel','hostal','motel','posada','airbnb','hospedaje'], type:'Hotel' },
    { keys:['taller','mecánica','mecanica','automotriz','refacciones','llantería'], type:'Taller' },
    { keys:['abogado','notaría','notaria','jurídico','juridico','despacho legal'], type:'Abogado' },
    { keys:['contador','contabilidad','fiscal','despacho contable'], type:'Contador' },
    { keys:['tienda','abarrotes','minisuper','papelería','ferretería','boutique','ropa','calzado'], type:'Tienda' },
  ];
  const fullText = raw.toLowerCase();
  for(const entry of typeMap) {
    if(entry.keys.some(k => fullText.includes(k))) {
      result.type = entry.type;
      result.confidence.type = 'medium';
      break;
    }
  }

  return result;
}

function confBadge(level) {
  if(!level) return '';
  const map = { high:'✓ Detectado', medium:'~ Estimado' };
  const cls = { high:'paste-conf-high', medium:'paste-conf-med' };
  return `<span class="${cls[level]||''}">${map[level]||''}</span>`;
}

function analyzePasteText() {
  const raw = document.getElementById('pasteRawText').value.trim();
  if(!raw) { showToast('Pega texto primero', 'error'); return; }

  const parsed = parseBusinessText(raw);

  // Populate type select
  const pfType = document.getElementById('pfType');
  pfType.innerHTML = S.bizTypes.map(t => {
    const bs = getBizStyle(t);
    return `<option value="${t}" ${parsed.type===t?'selected':''} style="color:${bs.color}">${t}</option>`;
  }).join('');

  document.getElementById('pfName').value = parsed.name;
  document.getElementById('pfPhone').value = parsed.phone;
  document.getElementById('pfLocation').value = parsed.location;
  document.getElementById('pfNameConf').innerHTML = confBadge(parsed.confidence.name);
  document.getElementById('pfPhoneConf').innerHTML = confBadge(parsed.confidence.phone);
  document.getElementById('pfLocationConf').innerHTML = confBadge(parsed.confidence.location);
  document.getElementById('pfTypeConf').innerHTML = confBadge(parsed.confidence.type);
  document.getElementById('pasteRawPreview').textContent = raw;

  // Warnings
  document.getElementById('pasteNoPhoneWarn').style.display = parsed.phone ? 'none' : 'flex';
  document.getElementById('pasteDupWarn').style.display = 'none';

  document.getElementById('pasteStep1').style.display = 'none';
  document.getElementById('pasteStep2').style.display = '';

  // Focus first empty required field
  if(!parsed.name) document.getElementById('pfName').focus();
  else if(!parsed.phone) document.getElementById('pfPhone').focus();
}

function confirmPasteSave() {
  const name  = document.getElementById('pfName').value.trim();
  const phone = document.getElementById('pfPhone').value.trim();
  if(!name)  { showToast('El nombre es requerido', 'error'); document.getElementById('pfName').focus(); return; }
  if(!phone) { showToast('El teléfono es requerido', 'error'); document.getElementById('pfPhone').focus(); return; }

  const normalizePhone = p => p.replace(/\D/g,'');
  const dup = S.contacts.find(c => normalizePhone(c.phone) === normalizePhone(phone));
  if(dup && !window._pasteDupConfirmed) {
    const warn = document.getElementById('pasteDupWarn');
    document.getElementById('pasteDupWarnText').textContent = `Este número ya está en: ${dup.name}`;
    warn.style.display = 'flex';
    warn.scrollIntoView({ behavior:'smooth', block:'nearest' });
    showToast('Número duplicado — revisa el aviso', 'error');
    return;
  }

  const location = document.getElementById('pfLocation').value.trim();
  const type     = document.getElementById('pfType').value;

  S.contacts.unshift({
    id: uid(), calls: 0, createdAt: Date.now(),
    name, phone, location, type,
    website: 'No', status: 'Nuevo',
    notes: '', tags: [], value: 0
  });
  save();
  closePasteModal();
  renderContacts();
  showToast(`✓ ${name} agregado`, 'success');
  window._pasteDupConfirmed = false;
}

// ── CALL PICKER ──
const CALL_APPS = [
  { id:'tel',     label:'Teléfono',  sub:'Llamada normal',         icon:'fa-solid fa-phone',        color:'#22D98A', bg:'rgba(34,217,138,0.12)',  scheme:'tel:' },
  { id:'wa',      label:'WhatsApp',  sub:'Llamada por WhatsApp',   icon:'fa-brands fa-whatsapp',    color:'#25D366', bg:'rgba(37,211,102,0.12)',  scheme:'https://wa.me/' },
  { id:'yolla',   label:'Yolla',     sub:'Llamada internacional',  icon:'fa-solid fa-satellite-dish',color:'#FF8C42', bg:'rgba(255,140,66,0.12)', scheme:'yolla://call?number=' },
  { id:'rebtel',  label:'Rebtel',    sub:'Llamada barata',         icon:'fa-solid fa-tower-broadcast',color:'#4F8EFF',bg:'rgba(79,142,255,0.12)', scheme:'rebtel://call?number=' },
];

let _callPickerPhone = '';

function showCallPicker(contactId) {
  const c = S.contacts.find(x => x.id === contactId);
  if (!c) return;
  _callPickerPhone = c.phone.replace(/\D/g, '');

  document.getElementById('callPickerName').textContent = c.name;
  document.getElementById('callPickerPhone').textContent = c.phone;

  const opts = document.getElementById('callPickerOptions');
  opts.innerHTML = CALL_APPS.map(app => `
    <a class="call-picker-opt" href="${app.scheme}${app.id === 'wa' ? _callPickerPhone : c.phone}" onclick="logCall('${contactId}')">
      <div class="call-picker-opt-icon" style="background:${app.bg};color:${app.color}">
        <i class="${app.icon}"></i>
      </div>
      <div class="call-picker-opt-info">
        <div class="call-picker-opt-label">${app.label}</div>
        <div class="call-picker-opt-sub">${app.sub}</div>
      </div>
      <i class="fa-solid fa-chevron-right" style="color:rgba(255,255,255,0.2);font-size:0.75rem"></i>
    </a>`).join('');

  document.getElementById('callPickerOverlay').classList.add('show');
  document.getElementById('callPicker').classList.add('show');
}

function hideCallPicker() {
  document.getElementById('callPickerOverlay').classList.remove('show');
  document.getElementById('callPicker').classList.remove('show');
}

function initCallPicker() {
  document.getElementById('callPickerCancel').addEventListener('click', hideCallPicker);
  document.getElementById('callPickerOverlay').addEventListener('click', hideCallPicker);
}

// ── SAMPLE DATA ──
function loadSampleData() {
  S.contacts = [
    {id:uid(),name:'Restaurante El Buen Sabor',phone:'+52 55 1234 5678',location:'CDMX, México',type:'Restaurante',website:'No',status:'Interesado',notes:'Muy interesado en página web con menú digital. Llamar el martes.',tags:['urgente','premium'],value:8500,calls:2,createdAt:Date.now()-86400000*3},
    {id:uid(),name:'Salón Belleza Glamour',phone:'+52 55 9876 5432',location:'Guadalajara, Jalisco',type:'Salón de belleza',website:'No',status:'Llamado',notes:'Llamar de nuevo el martes por la tarde.',tags:['seguimiento'],value:5000,calls:1,createdAt:Date.now()-86400000*2},
    {id:uid(),name:'Clínica Dental Sonrisa',phone:'+52 33 4567 8901',location:'Monterrey, NL',type:'Clínica',website:'Sí',status:'Nuevo',notes:'Tiene web pero muy desactualizada. Oportunidad de rediseño.',tags:[],value:12000,calls:0,createdAt:Date.now()-86400000},
    {id:uid(),name:'Gym FitPower',phone:'+52 81 2345 6789',location:'Puebla, México',type:'Gimnasio',website:'No',status:'Cerrado',notes:'¡Cerrado! Pago inicial recibido. Proyecto en curso.',tags:['cliente'],value:9500,calls:4,createdAt:Date.now()-86400000*7},
    {id:uid(),name:'Farmacia San José',phone:'+52 55 8765 4321',location:'CDMX, México',type:'Farmacia',website:'No',status:'No interesado',notes:'No tiene presupuesto por ahora. Volver a contactar en 3 meses.',tags:[],value:0,calls:2,createdAt:Date.now()-86400000*5},
    {id:uid(),name:'Hotel Vista Mar',phone:'+52 998 123 4567',location:'Cancún, QR',type:'Hotel',website:'Sí',status:'Interesado',notes:'Quiere rediseño completo + SEO + reservas online.',tags:['premium','urgente'],value:25000,calls:3,createdAt:Date.now()-86400000*4},
  ];
  S.callsToday = 5;
  S.scripts = [
    {id:uid(),title:'Apertura de llamada',category:'Primer contacto',fav:true,content:'Hola, buenos días/tardes. ¿Estoy hablando con el dueño o encargado de [NEGOCIO]?\n\nMi nombre es [TU NOMBRE] y te llamo porque encontré tu negocio en Google Maps y noté que aún no tienes una página web profesional.\n\n¿Tienes un momento para que te cuente cómo podemos ayudarte a conseguir más clientes?'},
    {id:uid(),title:'Seguimiento post-interés',category:'Seguimiento',fav:false,content:'Hola [NOMBRE], te llamo de vuelta como quedamos.\n\nQuería saber si tuviste oportunidad de pensar en la propuesta que te envié.\n\n¿Tienes alguna pregunta o duda que pueda resolver?'},
    {id:uid(),title:'Cierre de venta',category:'Cierre',fav:true,content:'Perfecto [NOMBRE], me alegra que te haya convencido.\n\nPara proceder necesito:\n1. Tu correo electrónico\n2. Nombre oficial del negocio\n3. Método de pago preferido\n\n¿Empezamos hoy mismo?'},
    {id:uid(),title:'Objeción: precio alto',category:'Objeciones',fav:false,content:'Entiendo perfectamente tu preocupación con el precio.\n\nPero piénsalo así: si tu página web te trae aunque sea 2-3 clientes nuevos al mes, ¿cuánto vale eso para tu negocio?\n\nAdemás, ofrecemos pagos en mensualidades para que no sientas el impacto de una sola vez.'},
  ];
  const today = new Date();
  S.events = [
    {id:uid(),title:'Llamada Restaurante El Buen Sabor',date:fmtDate(today),time:'10:00',type:'llamada',notes:'Confirmar propuesta enviada'},
    {id:uid(),title:'Seguimiento Hotel Vista Mar',date:fmtDate(today),time:'14:30',type:'seguimiento',notes:'Revisar diseño propuesto'},
  ];
  S.notifications = [
    {id:uid(),text:'Seguimiento pendiente: Salón Belleza Glamour',time:'Hoy 10:00'},
    {id:uid(),text:'Nuevo contacto: Hotel Vista Mar',time:'Ayer'},
  ];
  save(); renderAll(); showToast('Datos de ejemplo cargados','success');
}

setInterval(save, 30000);
