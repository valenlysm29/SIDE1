/* SIDE 3D — simulador de tienda mejorado con ciudad, cola en caja y atención manual. */
(() => {
  const rootId = 'simulator3d';
  let THREE = null, renderer = null, scene = null, camera = null, clock = null, raf = 0;
  const MODEL_ASSETS = {};
  const modelMixers = [];
  let modelAnimations = null;
  let initialized = false, running = false, locked = false;
  let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0, jumpQueued = false;
  let keys = {}, dynamicGroup = null, npcGroup = null, interactables = [], npcs = [], colliders = [];
  let animatedActors = [], checkoutQueue = [], queueDecor = [];
  let simSales = 0, simVisitors = 0, lastSpawn = 0, lastAutoRestock = 0;
  let registerMesh = null, restockMesh = null, inventoryDisplayGroup = null;
  let productInteractables = [], productInspectOpen = false;
  let inventory = null, gameSession = null;
  let audioCtx = null, ambientTimer = null, storeMusicTimer = null, audioEnabled = true, nextAutoServeAt = 0, nextManagerBoostAt = 0;
  let entryDoorLeft = null, entryDoorRight = null, entryDoorProgress = 0;
  let perfMode = 'auto', renderScale = 1.15, perfAccum = 0, perfFrames = 0, perfLastCheck = 0;
  let lastHudTick = 0, lastPromptTick = 0, lastLightTick = 0;
  let hemiLight = null, sunLight = null, checkoutOpen = false, checkoutScanned = false, checkoutPayment = 'cash';
  let adminMesh = null, adminOpen = false, businessState = null, nextEventAt = 0, nextProductionAt = 0, supplierDeliveryAt = 0, tutorialIndex = 0, secondRegisterMesh = null;
  let focusedInteractable = null, interactionRaycaster = null, interactionPointer = null, interactionScratch = null;
  let checkoutBagMesh = null, checkoutBagTarget = null, checkoutBagRemoveAt = 0;
  let settingsOpen = false, settingsResumeRunning = false, mouseSensitivity = 1, baseFov = 74, nextFootstepAt = 0, lastAutoSaveAt = 0;
  let deliveryVan = null, deliveryActor = null;

  const PRODUCTS = [
    { id: 'esencial', name: 'Bolso Esencial', price: 75, color: 0xc46b59, accent: '#ff9b89' },
    { id: 'urbano', name: 'Bolso Urbano', price: 95, color: 0x6a8ec9, accent: '#84bdff' },
    { id: 'premium', name: 'Bolso Premium', price: 125, color: 0xd7b653, accent: '#ffe07c' }
  ];


  const CUSTOMER_ARCHETYPES = [
    { id: 'express', label: 'Express', patience: 10, speed: 1.15, bonus: 0, pref: 'esencial' },
    { id: 'urbano', label: 'Urbano', patience: 15, speed: 1.0, bonus: 8, pref: 'urbano' },
    { id: 'premium', label: 'Premium', patience: 20, speed: 0.92, bonus: 18, pref: 'premium' },
    { id: 'turista', label: 'Turista', patience: 17, speed: 0.96, bonus: 12, pref: 'premium' }
  ];

  const player = { x: 0, y: 1.72, z: 11.4, radius: 0.36, baseY: 1.72, vx: 0, vz: 0, vy: 0, grounded: true, bob: 0, speed: 0 };
  const bounds = { minX: -18.5, maxX: 18.5, minZ: -10.2, maxZ: 24.5 };
  const queueSlots = [
    { x: -8.35, z: 7.55 },
    { x: -8.35, z: 8.85 },
    { x: -8.35, z: 10.15 },
    { x: -8.35, z: 11.45 }
  ];

  const SHOPPING_SPOTS = [
    { x: -4.6, z: 2.65, zone: 'mesa' }, { x: 0.0, z: 2.15, zone: 'mesa' }, { x: 4.6, z: 2.65, zone: 'mesa' },
    { x: -10.2, z: -6.9, zone: 'mural' }, { x: -6.1, z: -6.9, zone: 'mural' }, { x: -2.0, z: -6.9, zone: 'mural' },
    { x: 2.1, z: -6.9, zone: 'mural' }, { x: 6.2, z: -6.9, zone: 'mural' }, { x: 10.1, z: 1.0, zone: 'exhibidor' },
    { x: 10.1, z: 3.0, zone: 'exhibidor' }, { x: 10.1, z: 5.0, zone: 'exhibidor' }
  ];

  const $3 = (id) => document.getElementById(id);
  const fmt = (n) => 'S/ ' + Math.round(Number(n) || 0).toLocaleString('es-PE');
  const bridge = () => window.SIDE_GAME_BRIDGE || {};
  const companyName = () => String(bridge().companyName?.() || 'MI EMPRESA').trim() || 'MI EMPRESA';
  const saved = (id) => bridge().decisions?.[id] || null;
  const sum = (o = {}) => Object.values(o).reduce((a, b) => a + (Number(b) || 0), 0);
  const allPurchases = (entry) => { let t = 0; Object.values(entry?.purchases || {}).forEach(row => t += sum(row || {})); return t; };
  const optSelected = (id, opt) => Boolean(saved(id)?.optionIds?.includes(opt));
  const qty = (id) => sum(saved(id)?.quantities || {});
  const owned = (id) => allPurchases(saved(id));
  const currentRoundSafe = () => bridge().currentRound?.() || (typeof window.currentRound === 'function' ? window.currentRound() : 1);
  const decisionCash = () => bridge().cash?.() || (typeof window.cashBalance === 'function' ? window.cashBalance() : 100000);
  const simLedgerKey = () => `${currentRoundSafe()}:SIM_VENTAS`;
  const salesLedger = () => Number(bridge().ledger?.[simLedgerKey()] || 0);

  function storageContext() {
    const code = ($3('lobbyCode')?.textContent || 'SIDE').replace(/\s+/g, '_');
    const company = companyName().replace(/[^a-z0-9_-]+/gi, '_').slice(0, 36) || 'EMPRESA';
    return `${code}_${company}_${currentRoundSafe()}`;
  }

  function salesCountKey() { return `side3d_sales_count_${storageContext()}`; }
  function inventoryKey() { return `side3d_inventory_${storageContext()}`; }
  function dayKey() { return `side3d_day_${storageContext()}`; }
  function audioKey() { return `side3d_audio_${storageContext()}`; }
  function businessKey() { return `side3d_business_${storageContext()}`; }

  function createBusinessState() {
    return {
      reputation: 80,
      expenses: 0,
      returns: 0,
      supplierDelay: false,
      rushBoostUntil: 0,
      prices: { esencial: 75, urbano: 95, premium: 125 },
      upgrades: { display: 0, checkout: 0, warehouse: 0 },
      production: { producedToday: 0, stage: 0 },
      logs: ['Empresa preparada para operar.'],
      tutorialDone: false,
      defects: 0,
      graphics: 'auto',
      controls: { sensitivity: 1, fov: 74 }
    };
  }

  function saveBusinessState() {
    if (!businessState) return;
    localStorage.setItem(businessKey(), JSON.stringify(businessState));
  }

  function loadBusinessState() {
    try { businessState = JSON.parse(localStorage.getItem(businessKey()) || 'null'); } catch { businessState = null; }
    if (!businessState) businessState = createBusinessState();
    businessState.prices ||= { esencial: 75, urbano: 95, premium: 125 };
    businessState.upgrades ||= { display: 0, checkout: 0, warehouse: 0 };
    businessState.production ||= { producedToday: 0, stage: 0 };
    businessState.logs ||= [];
    businessState.controls ||= { sensitivity: 1, fov: 74 };
    mouseSensitivity = Math.max(0.45, Math.min(1.8, Number(businessState.controls.sensitivity || 1)));
    baseFov = Math.max(62, Math.min(88, Number(businessState.controls.fov || 74)));
    PRODUCTS.forEach(p => { p.price = Math.max(1, Number(businessState.prices[p.id] || p.price)); });
    perfMode = businessState.graphics || 'auto';
    renderScale = ({low:.72,medium:1.0,high:1.30,auto:1.05}[perfMode] || 1.05);
    saveBusinessState();
    return businessState;
  }

  function addBusinessLog(text) {
    if (!businessState) loadBusinessState();
    businessState.logs.unshift(`${new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})} · ${text}`);
    businessState.logs = businessState.logs.slice(0, 12);
    saveBusinessState();
    refreshAdminUI();
  }

  function operationalCash() {
    return decisionCash() - Number(businessState?.expenses || 0);
  }

  function applyExpense(amount, reason) {
    if (!businessState) loadBusinessState();
    const a = Math.max(0, Number(amount) || 0);
    businessState.expenses += a;
    saveBusinessState();
    showCashFx(`− ${fmt(a)}`);
    addBusinessLog(`${reason}: −${fmt(a)}`);
    updateHUD();
  }

  function updateReputation(delta, reason='') {
    if (!businessState) loadBusinessState();
    businessState.reputation = Math.max(0, Math.min(100, Number(businessState.reputation || 80) + delta));
    if (reason) addBusinessLog(`${reason} · reputación ${delta >= 0 ? '+' : ''}${delta}`);
    saveBusinessState();
    refreshAdminUI();
  }

  function syncSalesFromLedger() {
    const stored = Number(localStorage.getItem(salesCountKey()) || 0);
    simSales = Math.max(0, stored);
    updateHUD();
  }

  function saveInventory() {
    if (!inventory) return;
    localStorage.setItem(inventoryKey(), JSON.stringify(inventory));
  }

  function targetProduction() { return Math.max(0, Math.round(Number(saved('PRODUCCION_META')?.value || 0))); }

  function createInitialInventory() {
    const total = Math.max(9, targetProduction() || 24);
    const split = [Math.ceil(total * 0.4), Math.ceil(total * 0.35), 0];
    split[2] = Math.max(0, total - split[0] - split[1]);
    const display = {}, reserve = {};
    PRODUCTS.forEach((product, i) => {
      const show = Math.min(4, split[i]);
      display[product.id] = show;
      reserve[product.id] = Math.max(0, split[i] - show);
    });
    return { totalTarget: total, display, reserve, sold: { esencial: 0, urbano: 0, premium: 0 } };
  }

  function loadInventory() {
    try { inventory = JSON.parse(localStorage.getItem(inventoryKey()) || 'null'); } catch { inventory = null; }
    if (!inventory || !inventory.display || !inventory.reserve) inventory = createInitialInventory();
    const desired = Math.max(9, targetProduction() || inventory.totalTarget || 24);
    const currentUnits = PRODUCTS.reduce((n, p) => n + Number(inventory.display[p.id] || 0) + Number(inventory.reserve[p.id] || 0) + Number(inventory.sold?.[p.id] || 0), 0);
    if (desired > currentUnits) {
      let extra = desired - currentUnits;
      let i = 0;
      while (extra-- > 0) { const product = PRODUCTS[i++ % PRODUCTS.length]; inventory.reserve[product.id] = Number(inventory.reserve[product.id] || 0) + 1; }
    }
    inventory.totalTarget = Math.max(inventory.totalTarget || 0, desired);
    inventory.sold = inventory.sold || { esencial: 0, urbano: 0, premium: 0 };
    saveInventory();
    return inventory;
  }

  function productById(id) { return PRODUCTS.find(p => p.id === id) || PRODUCTS[0]; }
  function displayStock(id) { return Number(inventory?.display?.[id] || 0); }
  function reserveStock(id) { return Number(inventory?.reserve?.[id] || 0); }
  function totalDisplayStock() { return PRODUCTS.reduce((n,p)=>n+displayStock(p.id),0); }
  function totalReserveStock() { return PRODUCTS.reduce((n,p)=>n+reserveStock(p.id),0); }

  function loadDay() { return Math.max(1, Number(localStorage.getItem(dayKey()) || 1)); }
  function saveDay(day) { localStorage.setItem(dayKey(), String(Math.max(1, day))); }
  function loadAudioSetting() {
    const raw = localStorage.getItem(audioKey());
    audioEnabled = raw !== '0';
    const btn = $3('sim3dAudioBtn');
    if (btn) btn.textContent = audioEnabled ? 'AUDIO: ON' : 'AUDIO: OFF';
  }

  function ensureAudio() {
    if (!audioEnabled) return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume?.();
    return audioCtx;
  }

  function playTone(freq = 440, duration = 0.12, type = 'sine', volume = 0.03, when = 0) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.03);
  }

  function playSfx(kind) {
    if (!audioEnabled) return;
    if (kind === 'sale') { playTone(660, 0.08, 'triangle', 0.035, 0); playTone(880, 0.12, 'triangle', 0.03, 0.06); }
    else if (kind === 'restock') { playTone(420, 0.08, 'square', 0.025, 0); playTone(520, 0.08, 'square', 0.02, 0.07); }
    else if (kind === 'lost') { playTone(260, 0.18, 'sawtooth', 0.024, 0); }
    else if (kind === 'start') { playTone(392, 0.08, 'triangle', 0.03, 0); playTone(523, 0.12, 'triangle', 0.03, 0.07); playTone(659, 0.16, 'triangle', 0.025, 0.14); }
    else if (kind === 'endWin') { playTone(523, 0.1, 'triangle', 0.03, 0); playTone(659, 0.12, 'triangle', 0.03, 0.08); playTone(784, 0.18, 'triangle', 0.03, 0.16); }
    else if (kind === 'endLose') { playTone(392, 0.14, 'sine', 0.024, 0); playTone(294, 0.18, 'sine', 0.024, 0.12); }
  }


  function playFootstep(sprinting = false) {
    if (!audioEnabled) return;
    const base = sprinting ? 135 : 112;
    playTone(base + Math.random() * 18, 0.045, 'triangle', sprinting ? 0.010 : 0.007, 0);
    playTone(72 + Math.random() * 12, 0.055, 'sine', 0.004, 0.01);
  }

  function startAmbient() {
    if (ambientTimer) clearInterval(ambientTimer);
    if (storeMusicTimer) clearInterval(storeMusicTimer);
    if (!audioEnabled) return;
    ensureAudio();
    ambientTimer = setInterval(() => {
      if (!running || !audioEnabled || !gameSession || gameSession.shiftEnded) return;
      playTone(196, 1.6, 'sine', 0.005, 0);
      playTone(246, 1.4, 'triangle', 0.0035, 0.18);
    }, 3200);
    playStoreMusicLoop();
    storeMusicTimer = setInterval(() => {
      if (!running || !audioEnabled || !gameSession || gameSession.shiftEnded) return;
      playStoreMusicLoop();
    }, 4200);
  }

  function stopAmbient() {
    if (ambientTimer) clearInterval(ambientTimer);
    ambientTimer = null;
    if (storeMusicTimer) clearInterval(storeMusicTimer);
    storeMusicTimer = null;
  }

  function playStoreMusicLoop() {
    if (!audioEnabled) return;
    const seq = [
      [392, 0], [494, 0.22], [587, 0.44], [494, 0.66],
      [440, 0.95], [523, 1.17], [659, 1.39], [523, 1.61]
    ];
    seq.forEach(([f, t], i) => {
      playTone(f, 0.18, 'triangle', 0.012, t);
      if (i % 2 === 0) playTone(f / 2, 0.24, 'sine', 0.006, t);
    });
  }

  function randomArchetype() {
    const roll = Math.random();
    if (roll < 0.28) return CUSTOMER_ARCHETYPES[0];
    if (roll < 0.58) return CUSTOMER_ARCHETYPES[1];
    if (roll < 0.82) return CUSTOMER_ARCHETYPES[2];
    return CUSTOMER_ARCHETYPES[3];
  }

  function customerStyle(archetype) {
    const casual = [0x20242a,0x394d69,0x6a4f78,0x5b765f,0xa26059,0xc38b5c,0xd7d7d2];
    const premium = [0x1d2736,0x283047,0x473c50,0x846d5c];
    const palette = archetype?.id === 'premium' ? premium : casual;
    return {
      gender: Math.random() < 0.5 ? 'female' : 'male',
      shirt: palette[Math.floor(Math.random()*palette.length)],
      pants: [0x202a36,0x2c3440,0x40506b,0x61574d][Math.floor(Math.random()*4)],
      skin: [0xe1b88d,0xcd946d,0xa96f4d,0x7e5139][Math.floor(Math.random()*4)],
      hair: [0x1c1a1a,0x51392c,0x8b633f,0xb08a62][Math.floor(Math.random()*4)],
      formal: archetype?.id === 'premium' && Math.random() < 0.45,
      tie: 0x315f9c,
      bodyScale: 0.92 + Math.random()*0.16
    };
  }

  function customerPatienceBoost() {
    let boost = 0;
    if (optSelected('JEFATURA', 'si_jefatura')) boost += 2;
    if (saved('INV_RRHH')?.label) boost += 1;
    return boost;
  }

  function hasManager() { return optSelected('JEFATURA', 'si_jefatura'); }
  function hasAnalyst() { return optSelected('ANALISTA_COMPRAS', 'si_analista'); }


  function createDailyMissions(day = 1) {
    const premiumGoal = Math.max(1, Math.min(4, Math.ceil(day / 2)));
    const serveGoal = Math.max(4, 4 + day * 2);
    const satisfactionGoal = Math.max(72, 88 - Math.min(12, (day - 1) * 2));
    return [
      { id: 'serve', label: `Atiende ${serveGoal} clientes`, target: serveGoal },
      { id: 'premium', label: `Vende ${premiumGoal} Premium`, target: premiumGoal },
      { id: 'satisfaction', label: `Mantén ${satisfactionGoal}% de satisfacción`, target: satisfactionGoal }
    ];
  }

  function missionValue(mission) {
    if (!gameSession) return 0;
    if (mission.id === 'serve') return gameSession.served;
    if (mission.id === 'premium') return Math.max(0, Number(inventory?.sold?.premium || 0) - Number(gameSession.startPremiumSold || 0));
    if (mission.id === 'satisfaction') return Math.round(gameSession.satisfaction);
    return 0;
  }

  function missionComplete(mission) {
    const value = missionValue(mission);
    return value >= mission.target;
  }

  function updateMissionUI() {
    const list = $3('simMissionList');
    if (!list || !gameSession) return;
    const done = gameSession.missions.filter(missionComplete).length;
    if ($3('simMissionHeadline')) $3('simMissionHeadline').textContent = `DÍA ${gameSession.day} · ${done}/${gameSession.missions.length}`;
    list.innerHTML = gameSession.missions.map(m => {
      const value = missionValue(m);
      const complete = missionComplete(m);
      const progress = m.id === 'satisfaction' ? `${value}% / ${m.target}%` : `${Math.min(value,m.target)} / ${m.target}`;
      return `<div class="${complete ? 'done' : ''}"><span>${complete ? '✓' : '•'}</span><p><b>${m.label}</b><small>${progress}</small></p></div>`;
    }).join('');
  }

  function makeLocalLabel(text, color = '#ffd329', scale = 1) {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 150;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(4,10,18,.88)';
    ctx.fillRect(6, 8, 628, 132);
    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.strokeRect(8, 10, 624, 128);
    ctx.fillStyle = '#fff'; ctx.font = '700 42px Montserrat,Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(text).slice(0, 34), 320, 74);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent:true, depthWrite:false}));
    sp.position.set(0, 2.15, 0); sp.scale.set(2.7*scale, .64*scale, 1);
    return sp;
  }

  function showReceipt(npc) {
    const box = $3('sim3dReceipt');
    if (!box || !npc) return;
    const product = productById(npc.productId);
    const ticketNo = String((gameSession?.served || 0) + 1).padStart(4,'0');
    $3('receiptTicket').textContent = npc.isReturn ? `DEVOLUCIÓN #${ticketNo}` : `TICKET #${ticketNo}`;
    $3('receiptCustomer').textContent = npc.archetype?.label || 'Cliente';
    $3('receiptProduct').textContent = product.name;
    $3('receiptPrice').textContent = `${npc.isReturn ? '− ' : ''}${fmt(npc.productPrice)}`;
    $3('receiptDay').textContent = `Día ${gameSession?.day || 1}`;
    box.classList.add('show');
    clearTimeout(showReceipt.t);
    showReceipt.t = setTimeout(()=>box.classList.remove('show'), 2600);
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
    const m = Math.floor(safe / 60);
    const s = String(safe % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function resetGameSession(resetInventory = false, advanceDay = false) {
    loadBusinessState();
    let day = loadDay();
    if (advanceDay) day += 1;
    saveDay(day);
    if (resetInventory) {
      inventory = createInitialInventory();
      saveInventory();
      simSales = 0;
      localStorage.setItem(salesCountKey(), '0');
    }
    const channelCount = saved('CANALES')?.optionIds?.length || 1;
    const demandBase = Math.max(6, Math.round((targetProduction() || 24) / 4));
    const duration = Math.max(210, Math.round(300 - Math.min(80, (day - 1) * 8)));
    const difficulty = 1 + (day - 1) * 0.18;
    gameSession = {
      day,
      difficulty,
      duration,
      timeLeft: duration,
      targetRevenue: Math.max(500, Math.round(demandBase * (70 + channelCount * 10) * (1 + (day - 1) * 0.22))),
      revenue: 0,
      served: 0,
      lost: 0,
      satisfaction: Math.max(76, 100 - (day - 1) * 2),
      shiftEnded: false,
      shiftStarted: true,
      combo: 0,
      bestCombo: 0,
      startPremiumSold: Number(inventory?.sold?.premium || 0),
      missions: createDailyMissions(day),
      shownTeacherEvents: []
    };
    businessState.expenses = 0;
    businessState.production.producedToday = 0;
    businessState.production.stage = 0;
    businessState.supplierDelay = false;
    saveBusinessState();
    gameSession.satisfaction = Math.max(55, Math.min(100, gameSession.satisfaction + (businessState.reputation - 80) * 0.12));
    nextAutoServeAt = 0;
    nextManagerBoostAt = 12;
    nextEventAt = performance.now() + 25000 + Math.random() * 18000;
    nextProductionAt = performance.now() + 7000;
    supplierDeliveryAt = 0;
    hideSummaryOverlay();
    loadAudioSetting();
    updateHUD();
    updateMissionUI();
  }

  function adjustSatisfaction(delta) {
    if (!gameSession) return;
    gameSession.satisfaction = Math.max(0, Math.min(100, gameSession.satisfaction + delta));
    updateHUD();
  }

  function markLostCustomer(reason = '') {
    if (!gameSession) return;
    gameSession.lost += 1;
    gameSession.combo = 0;
    adjustSatisfaction(reason === 'queue' ? -5 : -3);
    playSfx('lost');
    updateReputation(reason === 'queue' ? -1.2 : -0.8);
  }

  function showCashFx(text) {
    const fx = document.getElementById('cashFx');
    if (!fx) return;
    const span = fx.querySelector('span');
    if (span) span.textContent = text;
    fx.classList.add('show');
    clearTimeout(showCashFx.t);
    showCashFx.t = setTimeout(() => fx.classList.remove('show'), 1100);
  }

  function hideSummaryOverlay() {
    $3('sim3dSummary')?.classList.add('hidden');
  }

  function showSummaryOverlay() {
    const wrap = $3('sim3dSummary');
    if (!wrap || !gameSession) return;
    const met = gameSession.revenue >= gameSession.targetRevenue;
    const stars = Math.max(1, Math.min(5, Math.round((gameSession.satisfaction / 20) + (met ? 0.6 : 0) + (gameSession.served > gameSession.lost ? 0.4 : 0))));
    const textStars = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    const missionDone = gameSession.missions?.filter(missionComplete).length || 0;
    $3('summaryTitle').textContent = met ? `¡Día ${gameSession.day} completado!` : `Fin del Día ${gameSession.day}`;
    $3('summarySubtitle').textContent = met ? `Meta alcanzada · Misiones ${missionDone}/${gameSession.missions.length}. Desbloqueaste el siguiente día.` : `Misiones ${missionDone}/${gameSession.missions.length}. Revisa resultados y vuelve a intentarlo.`;
    $3('summaryStars').textContent = textStars;
    $3('summaryRevenue').textContent = `${fmt(gameSession.revenue)} / ${fmt(gameSession.targetRevenue)}`;
    $3('summaryServed').textContent = String(gameSession.served);
    $3('summaryLost').textContent = String(gameSession.lost);
    $3('summarySatisfaction').textContent = `${Math.round(gameSession.satisfaction)}%`;
    if($3('summaryProfit')) $3('summaryProfit').textContent=fmt(gameSession.revenue-Number(businessState?.expenses||0));
    if($3('summaryReputation')) $3('summaryReputation').textContent=`${Math.round(businessState?.reputation||80)}%`;
    if($3('summaryReturns')) $3('summaryReturns').textContent=String(businessState?.returns||0);
    const replay = $3('sim3dReplayBtn'); if (replay) replay.textContent = met ? 'JUGAR SIGUIENTE DÍA' : 'REINTENTAR DÍA';
    wrap.classList.remove('hidden');
  }

  function endShift() {
    if (!gameSession || gameSession.shiftEnded) return;
    gameSession.shiftEnded = true;
    running = false;
    document.exitPointerLock?.();
    stopAmbient();
    const success=gameSession.revenue >= gameSession.targetRevenue;
    updateReputation(success ? 3 : -2, success ? 'Jornada exitosa' : 'Meta no alcanzada');
    addBusinessLog(`Cierre Día ${gameSession.day}: ingresos ${fmt(gameSession.revenue)}, utilidad ${fmt(gameSession.revenue-businessState.expenses)}.`);
    showSummaryOverlay();
    playSfx(success ? 'endWin' : 'endLose');
    message(gameSession.revenue >= gameSession.targetRevenue ? 'Se cerró la tienda: alcanzaste la meta del día.' : 'Se cerró la tienda: no llegaste a la meta.');
  }

  function message(text) {
    const el = $3('sim3dMessage');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(message.t);
    message.t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function updateHUD() {
    if (!$3('simCash')) return;
    $3('simCash').textContent = fmt(operationalCash());
    $3('simRound').textContent = gameSession ? `C${currentRoundSafe()} · Día ${gameSession.day}` : ('Ciclo ' + currentRoundSafe());
    $3('simVisitors').textContent = String(simVisitors);
    $3('simSales').textContent = String(simSales);
    PRODUCTS.forEach(p => {
      const stockEl = $3(`stock-${p.id}`);
      const reserveEl = $3(`reserve-${p.id}`);
      const priceEl = $3(`price-${p.id}`);
      if (stockEl) stockEl.textContent = String(displayStock(p.id));
      if (reserveEl) reserveEl.textContent = String(reserveStock(p.id));
      if (priceEl) priceEl.textContent = fmt(p.price);
    });
    const totalStockEl = $3('simTotalStock');
    if (totalStockEl) totalStockEl.textContent = String(totalDisplayStock() + totalReserveStock());
    if ($3('simTime')) $3('simTime').textContent = gameSession ? formatTime(gameSession.timeLeft) : '5:00';
    if ($3('simRating')) $3('simRating').textContent = gameSession ? `${Math.round(gameSession.satisfaction)}%` : `${Math.round(businessState?.reputation || 80)}%`;
    if ($3('simRevenue')) $3('simRevenue').textContent = gameSession ? `${fmt(gameSession.revenue)} / ${fmt(gameSession.targetRevenue)}` : fmt(0);
    const target = Number(saved('PRODUCCION_META')?.value || 0);
    const channels = saved('CANALES')?.optionIds?.length || 0;
    const queueText = checkoutQueue.length ? ` · Cola: ${checkoutQueue.length}` : '';
    const stockText = inventory ? ` · Stock: ${totalDisplayStock()} tienda / ${totalReserveStock()} almacén` : '';
    const shiftText = gameSession ? ` · Tiempo restante: ${formatTime(gameSession.timeLeft)} · Satisfacción: ${Math.round(gameSession.satisfaction)}% · Combo: x${Math.max(1, gameSession.combo || 0)}` : '';
    $3('simObjectiveText').textContent = gameSession
      ? `Día ${gameSession.day} · Dificultad ${(gameSession.difficulty || 1).toFixed(1)} · Meta del turno: ${fmt(gameSession.targetRevenue)} · Ingresos: ${fmt(gameSession.revenue)}${queueText}${stockText}${shiftText}.`
      : (target
        ? `Meta: ${target} unidades · ${channels} canal(es)${queueText}${stockText}. Repón exhibidores y cobra en caja.`
        : `Gestiona inventario, exhibición y caja${queueText}${stockText}.`);
    updateMissionUI();
  }

  async function loadThree() {
    if (THREE) return true;
    try {
      THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
      return true;
    } catch (err) {
      console.error(err);
      message('No se pudo cargar el motor 3D. Revisa la conexión a Internet.');
      return false;
    }
  }

  function gltfComponents(type) {
    return ({ SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 })[type] || 1;
  }

  function gltfArrayCtor(componentType) {
    return ({5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array})[componentType] || Float32Array;
  }

  async function loadSimpleGLB(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GLB ${response.status}: ${url}`);
    const buffer = await response.arrayBuffer();
    const dv = new DataView(buffer);
    if (dv.getUint32(0,true) !== 0x46546c67) throw new Error('Archivo GLB inválido');
    let offset = 12, json = null, bin = null;
    while (offset < buffer.byteLength) {
      const len = dv.getUint32(offset,true), type = dv.getUint32(offset+4,true); offset += 8;
      const chunk = buffer.slice(offset, offset+len); offset += len;
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk).replace(/\u0000+$/,''));
      if (type === 0x004E4942) bin = chunk;
    }
    if (!json || !bin) throw new Error('GLB sin JSON/BIN');

    const materials = (json.materials || []).map((m, i) => {
      const pbr = m.pbrMetallicRoughness || {};
      const f = pbr.baseColorFactor || [1,1,1,1];
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(f[0],f[1],f[2]),
        opacity: f[3] ?? 1,
        transparent: (f[3] ?? 1) < 0.999,
        roughness: pbr.roughnessFactor ?? .7,
        metalness: pbr.metallicFactor ?? .05,
        side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide
      });
      material.name = m.name || `Material_${i}`;
      if (/Glass/i.test(material.name)) { material.transparent=true; material.opacity=.58; material.roughness=.08; material.metalness=.12; }
      if (/WarmLight|LampGlow/i.test(material.name)) { material.emissive=material.color.clone(); material.emissiveIntensity=1.15; }
      if (/ScannerGlass|ScreenFace/i.test(material.name)) { material.emissive=material.color.clone(); material.emissiveIntensity=.55; }
      return material;
    });

    function accessorData(index) {
      const a = json.accessors[index], bv = json.bufferViews[a.bufferView];
      const Ctor = gltfArrayCtor(a.componentType), comps = gltfComponents(a.type);
      const byteOffset = (bv.byteOffset || 0) + (a.byteOffset || 0);
      const count = a.count * comps;
      if (bv.byteStride && bv.byteStride !== Ctor.BYTES_PER_ELEMENT * comps) {
        const out = new Ctor(count), src = new Uint8Array(bin);
        const scratch = new DataView(src.buffer, src.byteOffset, src.byteLength);
        const getters = {5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'};
        const getter = getters[a.componentType], size = Ctor.BYTES_PER_ELEMENT;
        for (let n=0;n<a.count;n++) for (let c=0;c<comps;c++) out[n*comps+c] = scratch[getter](byteOffset+n*bv.byteStride+c*size,true);
        return {array:out, comps, normalized:Boolean(a.normalized)};
      }
      const arr = new Ctor(bin, byteOffset, count);
      return {array:arr.slice ? arr.slice() : new Ctor(arr), comps, normalized:Boolean(a.normalized)};
    }

    const meshTemplates = (json.meshes || []).map((def, mi) => {
      const group = new THREE.Group(); group.name = def.name || `Mesh_${mi}`;
      (def.primitives || []).forEach((prim, pi) => {
        const geo = new THREE.BufferGeometry();
        const pos = accessorData(prim.attributes.POSITION);
        geo.setAttribute('position', new THREE.BufferAttribute(pos.array, pos.comps, pos.normalized));
        if (prim.attributes.NORMAL !== undefined) {
          const nor = accessorData(prim.attributes.NORMAL);
          geo.setAttribute('normal', new THREE.BufferAttribute(nor.array,nor.comps,nor.normalized));
        }
        if (prim.indices !== undefined) {
          const idx = accessorData(prim.indices);
          geo.setIndex(new THREE.BufferAttribute(idx.array,1,idx.normalized));
        }
        if (!geo.getAttribute('normal')) geo.computeVertexNormals();
        geo.computeBoundingBox(); geo.computeBoundingSphere();
        const material = materials[prim.material || 0] || new THREE.MeshStandardMaterial({color:0xcccccc,roughness:.7});
        const m = new THREE.Mesh(geo, material); m.name = `${group.name}_primitive_${pi}`;
        m.castShadow = false; m.receiveShadow = false;
        group.add(m);
      });
      return group;
    });

    const nodes = (json.nodes || []).map((def, i) => {
      const o = def.mesh !== undefined ? meshTemplates[def.mesh].clone(true) : new THREE.Group();
      o.name = def.name || `Node_${i}`;
      if (def.matrix) {
        const matrix = new THREE.Matrix4().fromArray(def.matrix);
        matrix.decompose(o.position,o.quaternion,o.scale);
      } else {
        if (def.translation) o.position.fromArray(def.translation);
        if (def.rotation) o.quaternion.fromArray(def.rotation);
        if (def.scale) o.scale.fromArray(def.scale);
      }
      o.traverse(ch => { if (ch.isMesh) ch.name = `${o.name}_mesh`; });
      return o;
    });
    (json.nodes || []).forEach((def, i) => (def.children || []).forEach(ci => nodes[i].add(nodes[ci])));
    const root = new THREE.Group(); root.name='GLBRoot';
    const sceneDef = (json.scenes || [])[json.scene || 0] || {nodes:[0]};
    (sceneDef.nodes || [0]).forEach(i => root.add(nodes[i]));
    root.userData.sourceUrl = url;
    return root;
  }

  function cloneModel(key) {
    const src = MODEL_ASSETS[key];
    if (!src) return null;
    const cloned = src.clone(true);
    cloned.traverse(o => {
      if (o.isMesh && o.material) { o.material = o.material.clone(); o.userData.sharedGLBGeometry = true; }
    });
    return cloned;
  }

  function tintPersonModel(root, cfg, female) {
    const skin = cfg.skin ?? [0xd8ab7e,0xc8956c,0x9f6a4a,0xe2b98d][Math.floor(Math.random()*4)];
    const shirt = cfg.shirt ?? (female ? 0xb76f63 : 0x315a91);
    const pants = cfg.pants ?? [0x233041,0x283746,0x30333a,0x485366][Math.floor(Math.random()*4)];
    const shoes = cfg.shoes ?? 0x4e392c;
    const hair = cfg.hair ?? [0x37281f,0x6f5038,0x1f2023,0x9a7046][Math.floor(Math.random()*4)];
    root.traverse(o => {
      if (!o.isMesh) return;
      const n = o.name || '';
      if (/Head|Neck|Forearm|Hand/.test(n)) o.material.color.setHex(skin);
      else if (/Torso|Arm_/.test(n)) o.material.color.setHex(shirt);
      else if (/Hips|Leg_|Thigh|Calf|Knee/.test(n)) o.material.color.setHex(pants);
      else if (/Shoe/.test(n)) o.material.color.setHex(shoes);
      else if (/Hair/.test(n)) o.material.color.setHex(hair);
      else if (/Tie/.test(n)) o.material.color.setHex(cfg.tie ?? 0x2f67c2);
    });
  }

  function qValues(axis, angles) {
    const vals=[];
    angles.forEach(a => { const q=new THREE.Quaternion().setFromAxisAngle(axis,a); vals.push(q.x,q.y,q.z,q.w); });
    return vals;
  }

  function ensureModelAnimations() {
    if (modelAnimations) return modelAnimations;
    const times=[0,.25,.5,.75,1];
    const X=new THREE.Vector3(1,0,0), Y=new THREE.Vector3(0,1,0);
    const walkTracks=[
      new THREE.QuaternionKeyframeTrack('Arm_L.quaternion',times,qValues(X,[.62,-.58,.62,-.58,.62])),
      new THREE.QuaternionKeyframeTrack('Arm_R.quaternion',times,qValues(X,[-.58,.62,-.58,.62,-.58])),
      new THREE.QuaternionKeyframeTrack('Forearm_L.quaternion',times,qValues(X,[-.10,.34,-.10,.34,-.10])),
      new THREE.QuaternionKeyframeTrack('Forearm_R.quaternion',times,qValues(X,[.34,-.10,.34,-.10,.34])),
      new THREE.QuaternionKeyframeTrack('Leg_L.quaternion',times,qValues(X,[-.44,.40,-.44,.40,-.44])),
      new THREE.QuaternionKeyframeTrack('Leg_R.quaternion',times,qValues(X,[.40,-.44,.40,-.44,.40])),
      new THREE.QuaternionKeyframeTrack('Knee_L.quaternion',times,qValues(X,[.12,.34,.12,.34,.12])),
      new THREE.QuaternionKeyframeTrack('Knee_R.quaternion',times,qValues(X,[.34,.12,.34,.12,.34])),
      new THREE.QuaternionKeyframeTrack('Head.quaternion',times,qValues(Y,[0,.035,0,-.035,0]))
    ];
    const idleTimes=[0,1.2,2.4];
    const idleTracks=[new THREE.QuaternionKeyframeTrack('Head.quaternion',idleTimes,qValues(Y,[-.04,.04,-.04]))];
    modelAnimations={walk:new THREE.AnimationClip('walk',1,walkTracks),idle:new THREE.AnimationClip('idle',2.4,idleTracks)};
    return modelAnimations;
  }

  function setupPersonMixer(root) {
    const clips=ensureModelAnimations();
    const mixer=new THREE.AnimationMixer(root);
    const idle=mixer.clipAction(clips.idle), walk=mixer.clipAction(clips.walk);
    idle.play(); walk.play(); idle.setEffectiveWeight(1); walk.setEffectiveWeight(0);
    root.userData.modelMixer=mixer; root.userData.modelActions={idle,walk}; root.userData.modelAnimState='idle';
    modelMixers.push({root,mixer});
  }

  function updateModelMixers(dt) {
    for (let i=modelMixers.length-1;i>=0;i--) {
      const entry=modelMixers[i];
      if (!entry.root || (!entry.root.parent && entry.root !== scene)) { modelMixers.splice(i,1); continue; }
      entry.mixer.update(dt);
    }
  }

  async function loadModelAssets() {
    const specs={
      npc_male:'assets/models3d/npc_male.glb', npc_female:'assets/models3d/npc_female.glb', npc_staff:'assets/models3d/npc_staff.glb',
      bag_esencial:'assets/models3d/bag_esencial.glb', bag_urbano:'assets/models3d/bag_urbano.glb', bag_premium:'assets/models3d/bag_premium.glb',
      checkout:'assets/models3d/checkout.glb', shelf:'assets/models3d/shelf.glb', sofa:'assets/models3d/sofa.glb',
      car_sedan:'assets/models3d/car_sedan.glb', streetlamp:'assets/models3d/streetlamp.glb'
    };
    const results=await Promise.allSettled(Object.entries(specs).map(async ([key,url])=>{ MODEL_ASSETS[key]=await loadSimpleGLB(url); return key; }));
    const ok=results.filter(r=>r.status==='fulfilled').length;
    console.info(`[SIDE 3D] Modelos locales cargados: ${ok}/${results.length}`);
    return ok;
  }

  function placeModel(key,x=0,y=0,z=0,scale=1,rotationY=0) {
    const model=cloneModel(key); if (!model) return null;
    model.position.set(x,y,z); model.scale.setScalar(scale); model.rotation.y=rotationY;
    return model;
  }

  function mat(color, rough = 0.72, metal = 0.05, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  }

  function mesh(geometry, material) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }

  function box(w, h, d, color, x, y, z, rough = 0.72, metal = 0.05) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough, metal));
    m.position.set(x, y, z);
    return m;
  }

  function cylinder(rt, rb, h, color, x, y, z, segments = 12, rough = 0.72, metal = 0.05) {
    const m = mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mat(color, rough, metal));
    m.position.set(x, y, z);
    return m;
  }

  function plane(w, h, color, x, y, z, rx = -Math.PI / 2, ry = 0, rough = 0.9, metal = 0.01) {
    const p = mesh(new THREE.PlaneGeometry(w, h), mat(color, rough, metal, { side: THREE.DoubleSide }));
    p.position.set(x, y, z);
    p.rotation.set(rx, ry, 0);
    return p;
  }

  const patternCache = {};
  function patternTexture(kind) {
    if (patternCache[kind]) return patternCache[kind];
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    if (kind === 'road') {
      ctx.fillStyle = '#30363d'; ctx.fillRect(0,0,256,256);
      for (let i=0;i<420;i++) { const v=42+Math.floor(Math.random()*28); ctx.fillStyle=`rgba(${v},${v},${v},${.07+Math.random()*.08})`; ctx.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*2,1+Math.random()*2); }
      ctx.strokeStyle='rgba(15,18,21,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,150);ctx.bezierCurveTo(70,140,150,166,256,150);ctx.stroke();
    } else if (kind === 'sidewalk') {
      ctx.fillStyle='#aeb5bc';ctx.fillRect(0,0,256,256);ctx.strokeStyle='rgba(70,78,86,.26)';ctx.lineWidth=2;
      for(let x=0;x<=256;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
      for(let y=0;y<=256;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
      for(let i=0;i<90;i++){ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(Math.random()*256,Math.random()*256,2,2);}
    } else {
      ctx.fillStyle='#9b7758';ctx.fillRect(0,0,256,256);
      const plank=48;
      for(let y=-48;y<304;y+=24){
        for(let x=-48;x<304;x+=plank){
          const offset=((Math.floor(y/24)&1)?24:0);
          ctx.save();ctx.translate(x+offset,y);ctx.rotate((Math.floor((x+y)/24)&1)?Math.PI/4:-Math.PI/4);
          const tone=145+Math.floor(Math.random()*25);ctx.fillStyle=`rgb(${tone+24},${tone},${tone-28})`;ctx.fillRect(-22,-9,44,18);
          ctx.strokeStyle='rgba(55,32,19,.28)';ctx.lineWidth=1;ctx.strokeRect(-22,-9,44,18);ctx.restore();
        }
      }
      for(let i=0;i<120;i++){ctx.strokeStyle='rgba(50,28,16,.08)';ctx.beginPath();ctx.moveTo(Math.random()*256,Math.random()*256);ctx.lineTo(Math.random()*256,Math.random()*256);ctx.stroke();}
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    patternCache[kind]=tex; return tex;
  }

  function texturedPlane(w,h,kind,x,y,z,repeatX=8,repeatY=8) {
    const tex=patternTexture(kind).clone(); tex.needsUpdate=true; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(repeatX,repeatY);
    const p=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.94,metalness:.01,side:THREE.DoubleSide}));
    p.position.set(x,y,z);p.rotation.x=-Math.PI/2;return p;
  }

  function texturedFloorBox(w,h,d,kind,x,y,z) {
    const tex=patternTexture(kind).clone();tex.needsUpdate=true;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(Math.max(1,w/2),Math.max(1,d/2));
    const material=new THREE.MeshStandardMaterial({map:tex,roughness:.82,metalness:.01});
    const m=mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);return m;
  }

  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }

  function addTextLabel(text, x, y, z, color = '#ffffff', scale = 1, bg = 'rgba(3,8,14,.80)') {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = bg;
    ctx.fillRect(16, 18, 992, 220);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.strokeRect(18, 20, 988, 216);
    ctx.fillStyle = '#fff';
    ctx.font = '700 88px Montserrat,Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text).slice(0, 30), 512, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.position.set(x, y, z);
    sp.scale.set(4.8 * scale, 1.2 * scale, 1);
    return sp;
  }

  function proceduralHandbag(x, y, z, color = 0xb98a58, scale = 1, rotate = 0) {
    const g = new THREE.Group();
    const variant = Math.abs(Math.round(Number(color) || 0)) % 3;
    if (variant === 0) {
      const body = box(0.86 * scale, 0.54 * scale, 0.34 * scale, color, 0, 0.26 * scale, 0, 0.42, 0.05);
      const flap = box(0.88 * scale, 0.10 * scale, 0.30 * scale, color, 0, 0.48 * scale, 0.03 * scale, 0.35, 0.08);
      const strapL = box(0.10 * scale, 0.38 * scale, 0.06 * scale, 0xa16e3a, -0.26 * scale, 0.30 * scale, 0.16 * scale, 0.4, 0.1);
      const strapR = box(0.10 * scale, 0.38 * scale, 0.06 * scale, 0xa16e3a, 0.26 * scale, 0.30 * scale, 0.16 * scale, 0.4, 0.1);
      const buckleL = box(0.10 * scale, 0.08 * scale, 0.03 * scale, 0xd8bf67, -0.26 * scale, 0.26 * scale, 0.18 * scale, 0.25, 0.7);
      const buckleR = box(0.10 * scale, 0.08 * scale, 0.03 * scale, 0xd8bf67, 0.26 * scale, 0.26 * scale, 0.18 * scale, 0.25, 0.7);
      const handle = mesh(new THREE.TorusGeometry(0.28 * scale, 0.04 * scale, 10, 20, Math.PI), mat(0x9c6733, 0.5, 0.12));
      handle.rotation.z = Math.PI;
      handle.position.y = 0.60 * scale;
      g.add(body, flap, strapL, strapR, buckleL, buckleR, handle);
    } else if (variant === 1) {
      const body = box(0.92 * scale, 0.58 * scale, 0.42 * scale, color, 0, 0.28 * scale, 0, 0.4, 0.05);
      const baseL = box(0.22 * scale, 0.16 * scale, 0.40 * scale, 0xb28a58, -0.34 * scale, 0.10 * scale, 0, 0.4, 0.05);
      const baseR = box(0.22 * scale, 0.16 * scale, 0.40 * scale, 0xb28a58, 0.34 * scale, 0.10 * scale, 0, 0.4, 0.05);
      const zip = box(0.60 * scale, 0.04 * scale, 0.04 * scale, 0xdfe5ee, 0, 0.43 * scale, 0.22 * scale, 0.18, 0.8);
      const handleL = mesh(new THREE.TorusGeometry(0.17 * scale, 0.03 * scale, 10, 20, Math.PI), mat(0x9c6733, 0.5, 0.12));
      const handleR = mesh(new THREE.TorusGeometry(0.17 * scale, 0.03 * scale, 10, 20, Math.PI), mat(0x9c6733, 0.5, 0.12));
      handleL.rotation.z = Math.PI; handleR.rotation.z = Math.PI;
      handleL.position.set(-0.17 * scale, 0.63 * scale, 0); handleR.position.set(0.17 * scale, 0.63 * scale, 0);
      g.add(body, baseL, baseR, zip, handleL, handleR);
    } else {
      const body = box(0.84 * scale, 0.58 * scale, 0.28 * scale, color, 0, 0.26 * scale, 0, 0.46, 0.05);
      const flap = box(0.44 * scale, 0.46 * scale, 0.08 * scale, 0xefe7da, 0, 0.24 * scale, 0.16 * scale, 0.32, 0.08);
      const button = cylinder(0.05 * scale, 0.05 * scale, 0.04 * scale, 0xd9c65d, 0, 0.23 * scale, 0.19 * scale, 14, 0.2, 0.7);
      button.rotation.x = Math.PI / 2;
      const loopL = mesh(new THREE.TorusGeometry(0.08 * scale, 0.02 * scale, 8, 14), mat(0xd9c65d, 0.2, 0.7));
      const loopR = mesh(new THREE.TorusGeometry(0.08 * scale, 0.02 * scale, 8, 14), mat(0xd9c65d, 0.2, 0.7));
      loopL.position.set(-0.28 * scale, 0.50 * scale, 0); loopR.position.set(0.28 * scale, 0.50 * scale, 0);
      const handle = mesh(new THREE.TorusGeometry(0.36 * scale, 0.035 * scale, 10, 22, Math.PI), mat(0x1c2f44, 0.5, 0.12));
      handle.rotation.z = Math.PI; handle.position.y = 0.72 * scale;
      g.add(body, flap, button, loopL, loopR, handle);
    }
    g.position.set(x, y, z);
    g.rotation.y = rotate;
    return g;
  }

  function proceduralPerson(style = 0x5aa9ff) {
    const cfg = typeof style === 'object' ? style : { shirt: style };
    const g = new THREE.Group();
    const skin = cfg.skin ?? [0xd8ab7e, 0xc8956c, 0x9f6a4a, 0xe2b98d][Math.floor(Math.random()*4)];
    const groundShadow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.17,depthWrite:false}));
    groundShadow.rotation.x = -Math.PI/2; groundShadow.position.y = .012; groundShadow.renderOrder = -1; g.add(groundShadow);
    const shirt = cfg.shirt ?? 0x5aa9ff;
    const pants = cfg.pants ?? [0x233041,0x283746,0x30333a,0x485366][Math.floor(Math.random()*4)];
    const shoes = cfg.shoes ?? 0x4e392c;
    const hairColor = cfg.hair ?? [0x37281f,0x6f5038,0x1f2023,0x9a7046][Math.floor(Math.random()*4)];
    const female = cfg.gender === 'female' || (!cfg.gender && Math.random() < 0.48);
    const formal = Boolean(cfg.formal);
    const bodyScale = cfg.bodyScale ?? (female ? 0.94 + Math.random()*0.08 : 0.98 + Math.random()*0.08);

    const torsoW = female ? 0.40 : 0.45;
    const torso = box(torsoW, 0.58, 0.24, shirt, 0, 1.10, 0, 0.48, 0.02);
    const hips = box(female ? 0.38 : 0.35, 0.17, 0.23, pants, 0, 0.74, 0, 0.55, 0.04);
    const head = mesh(new THREE.SphereGeometry(0.18, 14, 10), mat(skin, 0.88, 0.0));
    head.position.y = 1.63;
    head.scale.y = female ? 1.04 : 1.0;
    const neck = cylinder(0.047, 0.05, 0.10, skin, 0, 1.46, 0, 12, 0.9, 0.0);

    const hair = mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), mat(hairColor, 0.78, 0.02));
    hair.position.set(0, 1.70, -0.01);
    if (female && Math.random() < 0.55) {
      const backHair = box(0.30, 0.30, 0.10, hairColor, 0, 1.56, -0.10, 0.72, 0.01);
      g.add(backHair);
    }

    const eyeMat = mat(0x1a1715, 0.6, 0.0);
    const eyeL = mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMat); eyeL.position.set(-0.062,1.65,0.166);
    const eyeR = mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMat); eyeR.position.set(0.062,1.65,0.166);
    const nose = box(0.025,0.04,0.035,skin,0,1.60,0.178,0.8,0);

    const armL = box(0.115, 0.37, 0.12, shirt, -0.30, 1.12, 0, 0.52, 0.02);
    const armR = box(0.115, 0.37, 0.12, shirt, 0.30, 1.12, 0, 0.52, 0.02);
    const foreL = box(0.095, 0.29, 0.10, skin, -0.30, 0.78, 0, 0.72, 0.0);
    const foreR = box(0.095, 0.29, 0.10, skin, 0.30, 0.78, 0, 0.72, 0.0);
    const handL = box(0.095, 0.10, 0.08, skin, -0.30, 0.58, 0, 0.72, 0.0);
    const handR = box(0.095, 0.10, 0.08, skin, 0.30, 0.58, 0, 0.72, 0.0);
    const legL = box(0.14, 0.58, 0.14, pants, -0.11, 0.40, 0, 0.6, 0.02);
    const legR = box(0.14, 0.58, 0.14, pants, 0.11, 0.40, 0, 0.6, 0.02);
    const shoeL = box(0.16, 0.08, 0.28, shoes, -0.11, 0.04, 0.04, 0.48, 0.02);
    const shoeR = box(0.16, 0.08, 0.28, shoes, 0.11, 0.04, 0.04, 0.48, 0.02);

    g.add(torso, hips, head, neck, hair, eyeL, eyeR, nose, armL, armR, foreL, foreR, handL, handR, legL, legR, shoeL, shoeR);

    if (formal) {
      const collarL = box(0.10,0.04,0.02,0xf5f5f4,-0.055,1.38,0.13,0.4,0.01); collarL.rotation.z=-0.35;
      const collarR = box(0.10,0.04,0.02,0xf5f5f4,0.055,1.38,0.13,0.4,0.01); collarR.rotation.z=0.35;
      const tie = box(0.055, 0.30, 0.02, cfg.tie ?? 0x2f67c2, 0, 1.10, 0.13, 0.4, 0.08);
      g.add(collarL,collarR,tie);
      g.userData.tie = tie;
    }
    if (female && !formal && Math.random() < 0.4) {
      const jacket = box(0.44,0.36,0.025,cfg.jacket ?? 0x7652a8,0,1.12,0.132,0.5,0.01);
      g.add(jacket);
    }

    g.scale.setScalar(bodyScale);
    g.userData.parts = { torso, hips, head, armL, armR, foreL, foreR, handL, handR, legL, legR, shoeL, shoeR };
    g.userData.gender = female ? 'female' : 'male';
    return g;
  }

  function handbag(x, y, z, color = 0xb98a58, scale = 1, rotate = 0) {
    let key='bag_esencial';
    const distances=PRODUCTS.map(p=>Math.abs(Number(color)-Number(p.color)));
    const idx=distances.indexOf(Math.min(...distances));
    if (idx===1) key='bag_urbano'; else if (idx===2) key='bag_premium';
    const model=cloneModel(key);
    if (!model) return proceduralHandbag(x,y,z,color,scale,rotate);
    model.position.set(x,y,z); model.scale.setScalar(scale); model.rotation.y=rotate;
    model.userData.isLocalGLB=true; model.userData.modelKey=key;
    return model;
  }

  function person(style = 0x5aa9ff) {
    const cfg=typeof style==='object' ? {...style} : {shirt:style};
    const female=cfg.gender==='female' || (!cfg.gender && Math.random()<.48);
    const key=cfg.formal ? 'npc_staff' : (female ? 'npc_female' : 'npc_male');
    const model=cloneModel(key);
    if (!model) return proceduralPerson(style);
    tintPersonModel(model,cfg,female);
    const bodyScale=cfg.bodyScale ?? (female ? .94+Math.random()*.08 : .98+Math.random()*.08);
    model.scale.setScalar(bodyScale);
    const contact=new THREE.Mesh(new THREE.CircleGeometry(.27,18),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.18,depthWrite:false}));
    contact.rotation.x=-Math.PI/2;contact.position.y=.012;contact.scale.set(1,.68,1);model.add(contact);
    model.userData.gender=female?'female':'male'; model.userData.isLocalGLB=true; model.userData.modelKey=key;
    setupPersonMixer(model);
    return model;
  }

  function setPersonPose(g, cycle = 0, moving = false) {
    if (g?.userData?.modelActions) {
      const next=moving?'walk':'idle';
      if (g.userData.modelAnimState!==next) {
        g.userData.modelAnimState=next;
        g.userData.modelActions.walk.setEffectiveWeight(moving?1:0);
        g.userData.modelActions.idle.setEffectiveWeight(moving?0:1);
        g.userData.modelActions.walk.timeScale=moving?Math.max(.75,Math.min(1.45,Math.abs(cycle)%1.5+0.75)):1;
      }
      return;
    }
    const parts = g.userData.parts;
    if (!parts) return;
    const swing = moving ? Math.sin(cycle) * 0.58 : Math.sin(cycle * 0.5) * 0.06;
    const elbow = moving ? Math.sin(cycle + 0.25) * 0.16 : 0.02;
    parts.armL.rotation.z = swing * 0.78;
    parts.armR.rotation.z = -swing * 0.78;
    parts.foreL.rotation.z = swing * 0.42 + elbow;
    parts.foreR.rotation.z = -swing * 0.42 - elbow;
    parts.handL.rotation.z = parts.foreL.rotation.z * 0.55;
    parts.handR.rotation.z = parts.foreR.rotation.z * 0.55;
    parts.legL.rotation.z = -swing * 0.42;
    parts.legR.rotation.z = swing * 0.42;
    parts.head.position.y = 1.63 + (moving ? Math.abs(Math.sin(cycle * 0.7)) * 0.012 : 0.006 * Math.sin(cycle * 0.3));
    parts.torso.position.y = 1.10 + (moving ? Math.abs(Math.sin(cycle)) * 0.012 : 0.006 * Math.sin(cycle * 0.35));
    parts.hips.position.y = 0.74 + (moving ? Math.abs(Math.sin(cycle)) * 0.008 : 0);
  }

  function attachBagToNpc(npc) {
    if (npc.obj.userData.heldBag) return;
    const product = productById(npc.productId);
    const hand = npc.obj.getObjectByName?.('Hand_R');
    const bag = hand
      ? handbag(0.02, -0.15, 0.05, product.color, 0.31, Math.PI / 2.1)
      : handbag(0.28, 0.78, 0, product.color, 0.36, Math.PI / 2.2);
    (hand || npc.obj).add(bag);
    npc.obj.userData.heldBag = bag;
    if (!npc.obj.userData.orderLabel) {
      const product = productById(npc.productId);
      const label = makeLocalLabel(`${npc.archetype?.label || 'Cliente'} · ${product.name}`, product.accent, .82);
      npc.obj.add(label);
      npc.obj.userData.orderLabel = label;
    }
  }

  function chooseProductForCustomer(archetype = null) {
    if (!inventory) loadInventory();
    const available = PRODUCTS.filter(p => displayStock(p.id) > 0);
    if (!available.length) return null;
    const segment = String(saved('SEGMENTO')?.label || '').toLowerCase();
    const pref = archetype?.pref;
    const weights = available.map(p => {
      let w = p.id === 'urbano' ? 1.35 : 1;
      if (segment.includes('premium') && p.id === 'premium') w += 1.1;
      if ((segment.includes('estándar') || segment.includes('estandar')) && p.id === 'esencial') w += 0.45;
      if (p.id === 'premium' && salesStaff() > 1) w += 0.25;
      if (pref && p.id === pref) w += 1.25;
      if (hasAnalyst() && p.id === 'urbano') w += 0.2;
      return w;
    });
    let r = Math.random() * weights.reduce((a,b)=>a+b,0);
    for (let i=0;i<available.length;i++) { r -= weights[i]; if (r <= 0) return available[i]; }
    return available[available.length-1];
  }

  function reserveProductForNpc(npc, product) {
    if (!product || displayStock(product.id) <= 0) return false;
    inventory.display[product.id] -= 1;
    npc.productId = product.id;
    npc.productPrice = product.price;
    saveInventory();
    renderInventoryDisplays();
    updateHUD();
    return true;
  }

  function restockDisplays(manual = true) {
    if (!inventory) loadInventory();
    let moved = 0;
    PRODUCTS.forEach(product => {
      const cap = displayCapacity();
      const need = Math.max(0, cap - displayStock(product.id));
      const move = Math.min(need, reserveStock(product.id));
      if (move > 0) {
        inventory.display[product.id] += move;
        inventory.reserve[product.id] -= move;
        moved += move;
      }
    });
    if (moved) {
      saveInventory();
      renderInventoryDisplays();
      updateHUD();
      if (manual) { message(`Reposición completada: ${moved} bolso(s) pasaron del almacén a exhibición.`); playSfx('restock'); }
    } else if (manual) {
      message(totalReserveStock() ? 'Los exhibidores ya están completos.' : 'No queda stock en almacén para reponer.');
    }
    return moved;
  }

  function displayCapacity() { return 4 + Math.min(3, Number(businessState?.upgrades?.display || 0)) * 2; }
  function warehouseCapacity() { return Math.round((targetProduction() || 24) * (1.15 + Number(businessState?.upgrades?.warehouse || 0) * 0.25)); }
  function productionIntervalMs() {
    const machines = Math.max(1, owned('ENSAMBLE') + owned('ACABADOS'));
    const workers = Math.max(1, qty('PERS_CORTE') + qty('PERS_ENSAMBLE') + qty('PERS_ACABADO'));
    const expansion = 1 + Number(businessState?.upgrades?.warehouse || 0) * 0.18;
    return Math.max(5000, 14500 / Math.min(2.8, (0.6 + machines * .12 + workers * .08) * expansion));
  }

  function refreshAdminUI() {
    if (!businessState) return;
    const rev = Number(gameSession?.revenue || 0), exp = Number(businessState.expenses || 0);
    if ($3('adminReputation')) $3('adminReputation').textContent = `Reputación ${Math.round(businessState.reputation)}%`;
    if ($3('adminRevenue')) $3('adminRevenue').textContent = fmt(rev);
    if ($3('adminExpenses')) $3('adminExpenses').textContent = fmt(exp);
    if ($3('adminProfit')) $3('adminProfit').textContent = fmt(rev - exp);
    if ($3('adminRepMetric')) $3('adminRepMetric').textContent = `${Math.round(businessState.reputation)}%`;
    PRODUCTS.forEach(p => { const el=$3(`price-${p.id}-input`); if(el && document.activeElement!==el) el.value=String(p.price); });
    const rows=$3('adminStockRows');
    if(rows && inventory) rows.innerHTML=PRODUCTS.map(p=>`<div><strong>${p.name}</strong><span>Exhibición ${displayStock(p.id)}</span><span>Almacén ${reserveStock(p.id)}</span></div>`).join('');
    if ($3('adminProductionText')) $3('adminProductionText').textContent = `Producidas hoy: ${businessState.production.producedToday} · Capacidad de almacén: ${warehouseCapacity()} · Próxima unidad automática durante el turno.`;
    const log=$3('adminLogList'); if(log) log.innerHTML=(businessState.logs||[]).map(x=>`<div>${x}</div>`).join('') || '<div>Sin actividad todavía.</div>';
    document.querySelectorAll('[data-quality]').forEach(b=>b.classList.toggle('active',b.dataset.quality===perfMode));
    const up=businessState.upgrades||{};
    if($3('upgradeDisplayBtn')) $3('upgradeDisplayBtn').disabled=Number(up.display||0)>=3;
    if($3('upgradeCheckoutBtn')) $3('upgradeCheckoutBtn').disabled=Number(up.checkout||0)>=1;
    if($3('upgradeWarehouseBtn')) $3('upgradeWarehouseBtn').disabled=Number(up.warehouse||0)>=2;
  }

  function openAdmin() {
    adminOpen=true; running=false; document.exitPointerLock?.();
    refreshAdminUI();
    $3('simAdmin')?.classList.remove('hidden');
  }
  function closeAdmin() {
    adminOpen=false; $3('simAdmin')?.classList.add('hidden'); running=true; clock?.getDelta();
  }

  function showEvent(title,text) {
    if($3('eventTitle')) $3('eventTitle').textContent=title;
    if($3('eventText')) $3('eventText').textContent=text;
    const el=$3('simEventToast'); el?.classList.remove('hidden'); clearTimeout(showEvent.t); showEvent.t=setTimeout(()=>el?.classList.add('hidden'),5000);
  }

  function spawnReturnCustomer() {
    if(!THREE || !npcGroup || checkoutQueue.length>=queueCapacity()) return;
    const archetype=randomArchetype();
    const p=person(customerStyle(archetype));
    const spawnX=-1.5+Math.random()*3;
    p.position.set(spawnX,0,20.8);
    npcGroup.add(p);
    const prod=PRODUCTS[Math.floor(Math.random()*PRODUCTS.length)];
    const npc={obj:p,spawnX,route:[[spawnX,11.2],[-4.9,7.2],[queueSlots[Math.min(checkoutQueue.length,queueSlots.length-1)].x,queueSlots[Math.min(checkoutQueue.length,queueSlots.length-1)].z]],routeIndex:0,phase:'queueing',wait:0,buy:false,speed:1.0,walkCycle:0,queueIndex:checkoutQueue.length,dead:false,archetype,patienceLimit:22,isReturn:true,productId:prod.id,productPrice:prod.price};
    attachBagToNpc(npc); checkoutQueue.push(npc); npcs.push(npc); simVisitors++; updateHUD();
  }

  function triggerRandomEvent(now) {
    if(!gameSession || gameSession.shiftEnded || now < nextEventAt) return;
    nextEventAt = now + 42000;
    const active = Array.isArray(bridge().activeEvents?.()) ? bridge().activeEvents() : [];
    const pending = active.filter(ev=>!gameSession.shownTeacherEvents.includes(ev.id));
    if(!pending.length) return;
    const ev=pending[0]; gameSession.shownTeacherEvents.push(ev.id);
    const rev=Number(ev.effect?.revenuePct||0), cost=Number(ev.effect?.costPct||0);
    if(rev>0){businessState.rushBoostUntil=now+22000;updateReputation(1)}
    if(rev<0){adjustSatisfaction(-3);nextAutoServeAt+=5}
    if(cost>0)nextProductionAt+=7000;
    if(cost<0)nextProductionAt=Math.max(now+1500,nextProductionAt-3500);
    if(/devoluci|defecto/i.test(`${ev.title} ${ev.description}`) && simSales>0)spawnReturnCustomer();
    showEvent(ev.title, `${ev.implication} · ${ev.scope==='group'?'Evento grupal':'Evento individual'}.`);
    addBusinessLog(`Evento del ciclo: ${ev.title}.`);
  }

  function tickProduction(now) {
    if(!gameSession || gameSession.shiftEnded || now < nextProductionAt) return;
    nextProductionAt = now + productionIntervalMs();
    if(totalReserveStock()+totalDisplayStock() >= warehouseCapacity()) return;
    const p=PRODUCTS[businessState.production.producedToday % PRODUCTS.length];
    inventory.reserve[p.id]=(inventory.reserve[p.id]||0)+1;
    businessState.production.producedToday+=1; businessState.production.stage=(businessState.production.stage+1)%5;
    saveInventory(); saveBusinessState(); renderInventoryDisplays(); refreshAdminUI(); updateHUD();
  }

  function spawnSupplierVan() {
    if (!scene || deliveryVan) return;
    deliveryVan = buildCar(-25, 13.55, 0xe9ecef, 1);
    deliveryVan.scale.set(1.12, 1.18, 1.12);
    scene.add(deliveryVan);
    deliveryActor = registerAnimatedActor({ type:'supplierVan', obj:deliveryVan, state:'inbound', speed:6.2, stopX:-3.2, dead:false });
  }

  function dismissSupplierVan() {
    if (deliveryActor) deliveryActor.state = 'outbound';
  }

  function orderSupplierStock() {
    if(supplierDeliveryAt) { message('Ya existe un pedido en camino.'); return; }
    if(operationalCash()<360) { message('No hay caja suficiente para este pedido.'); return; }
    applyExpense(360,'Pedido a proveedor');
    supplierDeliveryAt=performance.now()+(businessState.supplierDelay?24000:12000);
    spawnSupplierVan();
    addBusinessLog('Pedido de 12 unidades enviado al proveedor.');
    message(businessState.supplierDelay?'Pedido enviado: llegará con retraso.':'Pedido enviado: mercancía en camino.');
  }

  function tickSupplier(now) {
    if(!supplierDeliveryAt || now<supplierDeliveryAt) return;
    supplierDeliveryAt=0; businessState.supplierDelay=false;
    PRODUCTS.forEach(p=>inventory.reserve[p.id]=(inventory.reserve[p.id]||0)+4);
    saveInventory(); saveBusinessState(); renderInventoryDisplays(); refreshAdminUI(); updateHUD(); playSfx('restock');
    showEvent('Proveedor entregó mercancía','Llegaron 12 bolsos nuevos al almacén.'); addBusinessLog('Proveedor entregó 12 unidades.'); dismissSupplierVan();
  }

  function buyUpgrade(type,cost,max) {
    loadBusinessState(); const current=Number(businessState.upgrades[type]||0);
    if(current>=max) { message('Esta mejora ya está al máximo.'); return; }
    if(operationalCash()<cost) { message('No hay caja suficiente para esta expansión.'); return; }
    businessState.upgrades[type]=current+1; applyExpense(cost,`Expansión: ${type}`); saveBusinessState();
    rebuildDynamicWorld(); refreshAdminUI();
    message('Expansión aplicada. Ya puedes verla en la tienda.');
  }

  function setGraphicsQuality(mode) {
    perfMode=mode; businessState.graphics=mode; saveBusinessState();
    const map={low:.72,medium:1.0,high:Math.min(devicePixelRatio,1.35),auto:1.05}; renderScale=map[mode]||1.05;
    renderer?.setPixelRatio(Math.min(devicePixelRatio,renderScale)); resize(); refreshAdminUI(); message(`Calidad gráfica: ${mode.toUpperCase()}`);
  }

  const TUTORIAL_STEPS=[
    [`Bienvenida a ${companyName()}`,'Muévete con WASD y mira con el mouse. La tienda abre y cierra por jornadas.'],
    ['Atiende la caja','Acércate al POS y presiona E. Escanea el producto y después cobra.'],
    ['Controla el stock','Acércate al almacén y repón los exhibidores. El personal también ayuda automáticamente.'],
    ['Administra la empresa','Busca la computadora de administración. Allí cambias precios, pides stock y amplías la tienda.'],
    ['Cumple los objetivos','Completa misiones, protege la reputación y alcanza la meta de ingresos antes de cerrar.']
  ];
  function showTutorialStep() {
    if(businessState?.tutorialDone) return;
    const el=$3('simTutorial3d'); if(!el) return; el.classList.remove('hidden');
    const step=TUTORIAL_STEPS[tutorialIndex]||TUTORIAL_STEPS[0];
    $3('tutorialStepLabel').textContent=`TUTORIAL ${tutorialIndex+1}/${TUTORIAL_STEPS.length}`; $3('tutorialStepTitle').textContent=step[0]; $3('tutorialStepText').textContent=step[1];
    $3('tutorialNextBtn').textContent=tutorialIndex===TUTORIAL_STEPS.length-1?'TERMINAR':'SIGUIENTE';
  }
  function nextTutorial() {
    tutorialIndex++;
    if(tutorialIndex>=TUTORIAL_STEPS.length){businessState.tutorialDone=true;saveBusinessState();$3('simTutorial3d')?.classList.add('hidden');return;}
    showTutorialStep();
  }

  function updateMinimap() {
    const dot=$3('miniPlayer'); if(!dot) return;
    const nx=Math.max(0,Math.min(1,(player.x+13)/26)); const nz=Math.max(0,Math.min(1,(9-player.z)/18));
    dot.style.left=`${7+nx*86}%`; dot.style.top=`${8+nz*78}%`;
  }

  function registerAnimatedActor(def) {
    animatedActors.push(def);
    return def;
  }

  function buildStreetLamp(x, z) {
    const model=placeModel('streetlamp',x,0,z,1,0);
    if (model) return model;
    const g = new THREE.Group();
    g.add(cylinder(0.08, 0.11, 4.6, 0x2f3843, 0, 2.3, 0, 10, 0.55, 0.18));
    const arm = box(0.95, 0.06, 0.06, 0x2f3843, 0.42, 4.3, 0, 0.5, 0.18);
    const lampMat = new THREE.MeshStandardMaterial({color:0xffe6a8,roughness:.22,metalness:.02,emissive:0x6d5422,emissiveIntensity:.8});
    const lightBox = mesh(new THREE.BoxGeometry(0.28,0.14,0.28),lampMat); lightBox.position.set(0.83,4.18,0); g.add(arm, lightBox);
    g.position.set(x,0,z); return g;
  }

  function buildTree(x, z) {
    const g = new THREE.Group();
    g.add(cylinder(0.13, 0.17, 1.0, 0x6d4a2f, 0, 0.5, 0, 10, 1, 0));
    const leaves1 = mesh(new THREE.SphereGeometry(0.58, 16, 14), mat(0x3b7d48, 0.9, 0.0));
    const leaves2 = mesh(new THREE.SphereGeometry(0.44, 16, 14), mat(0x4d9156, 0.86, 0.0));
    leaves1.position.set(0, 1.45, 0);
    leaves2.position.set(0.16, 1.82, -0.08);
    g.add(leaves1, leaves2);
    g.position.set(x, 0, z);
    return g;
  }

  function buildBench(x, z) {
    const g = new THREE.Group();
    g.add(box(1.6, 0.09, 0.35, 0x6f4e2f, 0, 0.54, 0, 0.55, 0.05));
    g.add(box(1.6, 0.09, 0.18, 0x6f4e2f, 0, 0.94, -0.12, 0.55, 0.05));
    [-0.65, 0.65].forEach((lx) => {
      g.add(box(0.07, 0.55, 0.07, 0x353f49, lx, 0.25, -0.1, 0.52, 0.2));
      g.add(box(0.07, 0.55, 0.07, 0x353f49, lx, 0.25, 0.1, 0.52, 0.2));
    });
    g.position.set(x, 0, z);
    return g;
  }

  function buildCar(x, z, color = 0xb14646, dir = 1) {
    const model=placeModel('car_sedan',x,0,z,1,dir<0?Math.PI:0);
    if (model) {
      model.traverse(o=>{ if(o.isMesh && /CarBody|CarCabin/.test(o.name)){o.material=o.material.clone();o.material.color.setHex(color);o.material.roughness=.30;o.material.metalness=.34;} });
      const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.15,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.18,depthWrite:false}));
      shadow.scale.set(1,.46,1);shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;model.add(shadow);
      return model;
    }
    const g = new THREE.Group();
    const body = box(2.45, 0.62, 1.16, color, 0, 0.52, 0, 0.35, 0.22); g.add(body); g.position.set(x,0,z); g.rotation.y=dir<0?Math.PI:0; return g;
  }

  function buildBuilding(x, z, w, d, h, color = 0x394b64) {
    const g=new THREE.Group();
    const body=box(w,h,d,color,0,h/2,0,.82,.04);g.add(body);
    const trim=mat(0x252f3a,.55,.12);
    const roof=mesh(new THREE.BoxGeometry(w+.16,.18,d+.16),trim);roof.position.y=h+.09;g.add(roof);
    const floorCount=Math.max(3,Math.floor(h/1.45));
    const colCount=Math.max(2,Math.floor(w/1.55));
    const winMat=new THREE.MeshStandardMaterial({color:0x84b9d5,roughness:.12,metalness:.28,emissive:0x142c3c,emissiveIntensity:.28});
    const litMat=new THREE.MeshStandardMaterial({color:0xf3d8a0,roughness:.18,metalness:.05,emissive:0x6d4d20,emissiveIntensity:.65});
    for(let r=0;r<floorCount;r++){
      const yy=.85+r*1.34;
      const ledge=box(w-.35,.055,.16,0x2a3541,0,yy-.50,d/2+.07,.45,.12);g.add(ledge);
      for(let c=0;c<colCount;c++){
        const xx=-w/2+.82+c*((w-1.64)/Math.max(1,colCount-1));
        const wm=((r+c)%7===0)?litMat:winMat;
        const panel=mesh(new THREE.BoxGeometry(.68,.72,.035),wm);panel.position.set(xx,yy,d/2+.025);g.add(panel);
        const sill=box(.78,.045,.12,0x303b46,xx,yy-.42,d/2+.08,.42,.15);g.add(sill);
      }
    }
    const entrance=box(Math.min(2.4,w*.38),1.65,.10,0x182b39,0,.83,d/2+.07,.18,.32);g.add(entrance);
    const canopy=box(Math.min(3.0,w*.45),.12,.72,0x293846,0,1.78,d/2+.38,.35,.12);g.add(canopy);
    g.position.set(x,0,z);return g;
  }

  function addCeilingLight(x, z, warm = true, realLight = false) {
    const rail = box(1.15, 0.06, 0.10, 0x1c252e, x, 4.28, z, 0.32, 0.2);
    const fixtureMat = new THREE.MeshStandardMaterial({color:warm?0xffe8c7:0xe4f2ff,roughness:.25,metalness:.05,emissive:warm?0x6b4b22:0x29485d,emissiveIntensity:.7});
    const fixture = mesh(new THREE.CylinderGeometry(0.10,0.12,0.20,10),fixtureMat);
    fixture.position.set(x,4.14,z);
    scene.add(rail, fixture);
    if (realLight) {
      const light = new THREE.SpotLight(warm ? 0xffe1b3 : 0xd9f0ff, warm ? 1.7 : 1.3, 14, Math.PI / 4.8, 0.48, 1.2);
      light.position.set(x, 4.04, z);
      light.target.position.set(x, 0.4, z);
      light.castShadow = false;
      scene.add(light, light.target);
    }
  }

  function buildQueueDecor() {
    queueDecor = [];
    const guideMat = new THREE.MeshStandardMaterial({ color: 0xd7bd72, roughness: 0.7, metalness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    const slots = [
      [-8.35, 7.55], [-8.35, 8.85], [-8.35, 10.15], [-8.35, 11.45]
    ];
    slots.forEach(([x,z],i) => {
      const ring = mesh(new THREE.RingGeometry(0.28, 0.34, 24), guideMat.clone());
      ring.rotation.x = -Math.PI/2;
      ring.position.set(x, 0.055, z);
      scene.add(ring);
      queueDecor.push({ ring });
    });
    const arrow = mesh(new THREE.PlaneGeometry(0.9,0.18), guideMat.clone());
    arrow.rotation.x = -Math.PI/2;
    arrow.position.set(-8.35,0.056,6.95);
    scene.add(arrow);
    queueDecor.push({ arrow });
  }

  function buildBoutiqueDecor() {
    const decor = new THREE.Group();
    // Wall shelves: modelos GLB locales reutilizables.
    [-10.4,-7.2,-4.0,-0.8,2.4,5.6].forEach((x,i)=>{
      const shelfModel=placeModel('shelf',x,0,-8.35,.88,0);
      if (shelfModel) decor.add(shelfModel);
      else {
        const shelf = box(2.3,0.10,0.52,0x5d4938,x,1.55,-8.45,0.42,0.08);
        const upper = box(2.3,0.09,0.52,0x5d4938,x,2.55,-8.45,0.42,0.08);
        decor.add(shelf,upper);
      }
      decor.add(handbag(x-.55,.55,-8.00,PRODUCTS[i%3].color,.55,.08));
      decor.add(handbag(x+.52,1.28,-8.00,PRODUCTS[(i+1)%3].color,.55,-.08));
    });
    // Lounge area con sofá GLB local.
    const sofaModel=placeModel('sofa',5.5,0,6.25,1,0);
    if (sofaModel) decor.add(sofaModel);
    else {
      const bench = box(3.0,0.42,0.78,0x26384d,5.5,0.35,6.25,0.78,0.02);
      const benchBack = box(3.0,0.78,0.18,0x2e435b,5.5,0.82,6.60,0.78,0.02);
      decor.add(bench,benchBack);
    }
    const tableTop = cylinder(0.58,0.58,0.08,0xc5b9aa,7.4,0.48,6.0,28,0.38,0.05);
    const tableLeg = cylinder(0.10,0.16,0.46,0x2b3138,7.4,0.23,6.0,16,0.5,0.2);
    decor.add(tableTop,tableLeg);
    addCollider(3.8,7.0,5.65,6.9);
    addCollider(6.75,8.05,5.35,6.65);
    // Decorative mirror on left wall.
    const mirror = mesh(new THREE.PlaneGeometry(2.3,2.7),new THREE.MeshStandardMaterial({color:0xaed4e7,roughness:0.08,metalness:0.55,side:THREE.DoubleSide}));
    mirror.position.set(-12.82,2.05,1.8); mirror.rotation.y=Math.PI/2; decor.add(mirror);
    const frameTop=box(0.08,0.08,2.5,0xd1b06a,-12.79,3.43,1.8,0.28,0.55); frameTop.rotation.y=Math.PI/2; decor.add(frameTop);

    // Vitrinas frontales: visuales, delgadas y fuera del pasillo central.
    [-10.5,10.5].forEach((x,idx)=>{
      const plinth=box(1.55,0.62,0.72,0xe7e9ea,x,0.31,7.78,0.34,0.02);
      const glass=mesh(new THREE.BoxGeometry(1.65,1.35,0.82),new THREE.MeshPhysicalMaterial({color:0xd9f2ff,roughness:0.05,metalness:0,transparent:true,opacity:0.17,transmission:0.35,thickness:0.04}));
      glass.position.set(x,1.18,7.78);
      const bag=handbag(x,0.77,7.78,PRODUCTS[idx?2:1].color,0.88,idx?-.18:.18);
      decor.add(plinth,glass,bag);
    });
    scene.add(decor);
  }

  function buildSkyDome() {
    const geo=new THREE.SphereGeometry(110,32,18);
    const matSky=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x4f8fc2)},bottom:{value:new THREE.Color(0xd8e8ef)}},vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform vec3 top;uniform vec3 bottom;varying vec3 vWorld;void main(){float h=normalize(vWorld).y;float t=smoothstep(-.12,.72,h);gl_FragColor=vec4(mix(bottom,top,t),1.0);}`});
    const sky=new THREE.Mesh(geo,matSky);sky.renderOrder=-100;return sky;
  }

  function buildStaticWorld() {
    interactables = [];
    colliders = [];
    npcs = [];
    animatedActors = animatedActors.filter(a => a.type === 'traffic' || a.type === 'pedestrian' || a.type === 'supplierVan');
    checkoutQueue = [];
    queueDecor = [];
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd8e8);
    scene.fog = new THREE.Fog(0xbfd8e8, 55, 125);
    scene.add(buildSkyDome());

    camera = new THREE.PerspectiveCamera(74, 1, 0.08, 160);
    camera.rotation.order = 'YXZ';
    yaw = 0;
    pitch = -0.04;

    renderer = new THREE.WebGLRenderer({ canvas: $3('side3dCanvas'), antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, renderScale));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    hemiLight = new THREE.HemisphereLight(0xe8f4ff, 0x59675e, 1.35);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff0d2, 2.45);
    sunLight.position.set(16, 22, 10);
    sunLight.castShadow = false;
    scene.add(sunLight);

    scene.add(plane(180, 180, 0x95ad7f, 0, -0.02, 18, -Math.PI / 2, 0, 1, 0));
    scene.add(texturedPlane(42, 38, 'road', 0, 0.01, 16, 12, 10));
    scene.add(texturedPlane(42, 4.3, 'sidewalk', 0, 0.02, 10.8, 14, 2));
    scene.add(texturedPlane(42, 4.3, 'sidewalk', 0, 0.02, 21.2, 14, 2));
    scene.add(plane(34, 0.22, 0xf2df7a, 0, 0.03, 16, -Math.PI / 2, 0, 0.4, 0.0));
    for (let i = -14; i <= 14; i += 4) scene.add(plane(2.1, 0.16, 0xfff4cf, i, 0.04, 16, -Math.PI / 2));
    for (let i = -14; i <= 14; i += 4.6) {
      scene.add(plane(1.55, 0.1, 0xffffff, i, 0.04, 12.9, -Math.PI / 2));
      scene.add(plane(1.55, 0.1, 0xffffff, i, 0.04, 19.1, -Math.PI / 2));
    }

    [-16, -8, 0, 8, 16].forEach((x) => { scene.add(buildStreetLamp(x, 10.0)); scene.add(buildStreetLamp(x, 22.1)); });
    [-17.2, -7.6, 7.6, 17.2].forEach((x) => { scene.add(buildTree(x, 23.45)); });
    scene.add(buildBench(-10, 9.1));
    scene.add(buildBench(10.8, 22.9));
    scene.add(buildCar(-8.3, 15.6, 0xb84e4e, 1));
    scene.add(buildCar(7.4, 16.8, 0x446ea2, -1));
    const traffic1 = buildCar(-25, 14.6, 0x8c3cb5, 1);
    const traffic2 = buildCar(25, 17.5, 0x4d9c74, -1);
    scene.add(traffic1, traffic2);
    registerAnimatedActor({ type: 'traffic', obj: traffic1, speed: 3.8, dir: 1, minX: -26, maxX: 26, laneZ: 14.6 });
    registerAnimatedActor({ type: 'traffic', obj: traffic2, speed: 4.1, dir: -1, minX: -26, maxX: 26, laneZ: 17.5 });
    const ped1 = person(0xcc7c5c); ped1.position.set(-16, 0, 9.6); ped1.scale.set(0.9,0.9,0.9); scene.add(ped1);
    const ped2 = person(0x68a1df); ped2.position.set(16, 0, 22.7); ped2.scale.set(0.9,0.9,0.9); scene.add(ped2);
    registerAnimatedActor({ type: 'pedestrian', obj: ped1, speed: 1.0, dir: 1, minX: -16, maxX: 16, baseZ: 9.6, phase: Math.random() * 6.28 });
    registerAnimatedActor({ type: 'pedestrian', obj: ped2, speed: 1.15, dir: -1, minX: -16, maxX: 16, baseZ: 22.7, phase: Math.random() * 6.28 });

    // Ciudad: dejamos una zona de exclusión amplia alrededor de la empresa para que ningún edificio atraviese la tienda.
    const buildingSpecs = [
      [-25, -4, 8, 11, 15, 0x4f5f76], [-25, 8, 8, 9, 12, 0x55616e], [-25, 29, 9, 9, 14, 0x5a6778],
      [25, -4, 8, 11, 14, 0x3f516c], [25, 8, 8, 9, 11, 0x596779], [25, 29, 9, 9, 15, 0x47556a],
      [-13, -25, 10, 10, 14, 0x4b5663], [0, -27, 10, 11, 17, 0x516274], [13, -25, 10, 10, 13, 0x596273],
      [-15, 32, 9, 9, 12, 0x536475], [-5, 33, 8, 9, 10, 0x48586b], [5, 33, 8, 9, 11, 0x556779], [15, 32, 9, 9, 13, 0x4a5c70]
    ];
    buildingSpecs.forEach(([x, z, w, d, h, c]) => scene.add(buildBuilding(x, z, w, d, h, c)));

    const storeFloor = texturedFloorBox(26, 0.16, 18.4, 'wood', 0, -0.08, -0.05);
    scene.add(storeFloor);
    const curb = box(26, 0.24, 0.6, 0xb8bcc3, 0, 0.12, 8.98, 0.8, 0.02);
    scene.add(curb);
    const sidewalkStore = texturedFloorBox(26, 0.1, 4.0, 'sidewalk', 0, 0.05, 10.9);
    scene.add(sidewalkStore);

    const backWall = box(26, 4.8, 0.28, 0x313d4c, 0, 2.4, -9.2, 0.84, 0.04);
    const leftWall = box(0.28, 4.8, 18.4, 0x313d4c, -13.0, 2.4, -0.05, 0.84, 0.04);
    const rightWall = box(0.28, 4.8, 18.4, 0x313d4c, 13.0, 2.4, -0.05, 0.84, 0.04);
    const ceiling = box(26, 0.18, 18.4, 0xf0f1f2, 0, 4.6, -0.05, 0.95, 0.0);
    scene.add(backWall, leftWall, rightWall, ceiling);
    addCollider(-13.35, 13.35, -9.45, -8.95);
    addCollider(-13.35, -12.65, -9.2, 9.05);
    addCollider(12.65, 13.35, -9.2, 9.05);

    const frontLeft = box(8.6, 4.8, 0.24, 0x2d3945, -8.7, 2.4, 9.0, 0.74, 0.08);
    const frontRight = box(8.6, 4.8, 0.24, 0x2d3945, 8.7, 2.4, 9.0, 0.74, 0.08);
    const frontBeam = box(26, 0.28, 0.4, 0x1e2730, 0, 4.62, 9.0, 0.55, 0.1);
    scene.add(frontLeft, frontRight, frontBeam);
    addCollider(-13.2, -4.25, 8.7, 9.25);
    addCollider(4.25, 13.2, 8.7, 9.25);
    const glassMat = new THREE.MeshPhysicalMaterial({color:0xbfe8ff,roughness:.08,metalness:.08,transparent:true,opacity:.34,transmission:.12,clearcoat:.7,clearcoatRoughness:.12});
    const glassL = mesh(new THREE.BoxGeometry(8.2, 4.2, 0.05), glassMat); glassL.position.set(-8.7, 2.1, 8.9);
    const glassR = mesh(new THREE.BoxGeometry(8.2, 4.2, 0.05), glassMat); glassR.position.set(8.7, 2.1, 8.9);
    scene.add(glassL, glassR);
    const doorMat = new THREE.MeshPhysicalMaterial({color:0xc8e8ff,roughness:.05,metalness:.08,transparent:true,opacity:.38,transmission:.16,clearcoat:.8,clearcoatRoughness:.08});
    entryDoorLeft = mesh(new THREE.BoxGeometry(1.75, 4.0, 0.05), doorMat);
    entryDoorRight = mesh(new THREE.BoxGeometry(1.75, 4.0, 0.05), doorMat);
    entryDoorLeft.position.set(-0.92, 2.0, 8.90);
    entryDoorRight.position.set(0.92, 2.0, 8.90);
    scene.add(entryDoorLeft, entryDoorRight);
    // Marcos, tiradores y zócalos para que la fachada deje de verse como un bloque.
    [-12.75,-4.35,4.35,12.75].forEach(x=>scene.add(box(.10,4.15,.12,0x202a34,x,2.05,8.82,.32,.35)));
    scene.add(box(25.4,.10,.15,0x26333f,0,.13,8.84,.35,.22));
    const handleL=cylinder(.025,.025,.72,0xc6cbd0,-.18,2.0,8.80,12,.20,.85);handleL.rotation.x=Math.PI/2;
    const handleR=cylinder(.025,.025,.72,0xc6cbd0,.18,2.0,8.80,12,.20,.85);handleR.rotation.x=Math.PI/2;scene.add(handleL,handleR);
    const awning = box(12.2, 0.18, 1.8, 0x111820, 0, 4.18, 9.82, 0.48, 0.12);
    scene.add(awning);
    scene.add(addTextLabel(companyName(), 0, 4.85, 10.05, '#ffd329', 1.28, 'rgba(3,8,14,.88)'));
    scene.add(addTextLabel('BOUTIQUE · TALLER · EXPERIENCIA 3D', 0, 4.12, 8.72, '#7dffb2', 0.72, 'rgba(3,8,14,.78)'));
    scene.add(addTextLabel('PUERTA AUTOMÁTICA', 0, 3.25, 9.28, '#9ed6ff', 0.42, 'rgba(8,21,34,.55)'));

    scene.add(addTextLabel('ÁREA DE VENTAS', 0, 3.15, 8.15, '#f7f8fb', 0.72, 'rgba(31,44,61,.58)'));
    const warehouseHeader = box(12.4, 0.16, 0.36, 0x17222d, 0, 4.08, -4.35, 0.45, 0.08);
    scene.add(warehouseHeader);
    scene.add(addTextLabel('ALMACÉN Y PRODUCCIÓN', 0, 4.48, -4.35, '#7dffb2', 0.68, 'rgba(7,20,16,.72)'));

    const rug = box(10.6, 0.02, 5.6, 0x2f4156, 0, 0.03, 4.2, 0.82, 0.0);
    scene.add(rug);
    [[-4.6, 2.6], [0, 2.1], [4.6, 2.6]].forEach(([x, z], i) => {
      const tableTop = box(3.2, 0.12, 1.28, i === 1 ? 0x77593f : 0x5e4432, x, 0.80, z, 0.46, 0.08);
      const base = cylinder(0.28, 0.36, 0.72, 0x202830, x, 0.38, z, 16, 0.62, 0.15);
      scene.add(tableTop, base);
      scene.add(handbag(x - 0.92, 0.88, z - 0.15, [0xc46b59, 0x6a8ec9, 0xd7b653][i % 3], 0.78, 0.25));
      scene.add(handbag(x, 0.88, z + 0.12, [0x8d5bb8, 0x5d9078, 0xbd8854][i % 3], 0.76, -0.18));
      scene.add(handbag(x + 0.92, 0.88, z - 0.10, [0x57679f, 0xb96c51, 0x6c8db8][i % 3], 0.76, 0.12));
      addCollider(x - 1.75, x + 1.75, z - 0.9, z + 0.9);
    });

    [-10.2, -6.1, -2.0, 2.1, 6.2, 10.3].forEach((x, i) => {
      const shelfModel=placeModel('shelf',x,0,-8.38,.96,0);
      if (shelfModel) scene.add(shelfModel);
      else scene.add(box(2.5,1.82,.52,0x5a4636,x,.91,-8.4,.58,.05));
      scene.add(handbag(x-.48,.52,-7.98,[0xb95050,0x456eaa,0xc59a45][i%3],.62,.12));
      scene.add(handbag(x+.48,1.24,-7.98,[0x456eaa,0xc59a45,0xb95050][i%3],.62,-.12));
      addCollider(x - 1.3, x + 1.3, -8.75, -7.85);
    });

    const stand1 = box(0.42, 1.00, 0.42, 0x28303a, 10.7, 0.50, 3.9, 0.46, 0.05);
    const stand2 = box(0.42, 1.00, 0.42, 0x28303a, 10.1, 0.50, 5.2, 0.46, 0.05);
    scene.add(stand1, stand2);
    scene.add(handbag(10.7, 1.12, 3.9, 0xcaa27f, 0.82, -0.12));
    scene.add(handbag(10.1, 1.12, 5.2, 0xe5dfd3, 0.82, 0.18));

    const checkoutModel=placeModel('checkout',-8.2,0,6.65,1,0);
    if (checkoutModel) {
      scene.add(checkoutModel);
      registerMesh=checkoutModel.getObjectByName('Scanner') || checkoutModel;
    } else {
      const counterBase = box(4.8, 0.98, 1.24, 0x20262f, -8.2, 0.49, 6.65, 0.42, 0.08);
      const counterTop = box(4.95, 0.08, 1.30, 0xe8edf2, -8.2, 1.02, 6.65, 0.18, 0.15);
      const scanner = box(0.46, 0.16, 0.42, 0x252d35, -8.12, 1.14, 6.38, 0.18, 0.32);
      scene.add(counterBase,counterTop,scanner);
      registerMesh=scanner;
    }
    addCollider(-10.35, -6.05, 6.34, 7.18);
    interactables.push({ mesh: registerMesh, type: 'register', label: 'Cobrar cliente en caja' });

    const terminal = box(0.48, 0.34, 0.08, 0x111924, -10.65, 1.22, 6.55, 0.16, 0.22);
    terminal.rotation.x = -0.16;
    scene.add(terminal);
    interactables.push({ mesh: terminal, type: 'decisions', label: 'Abrir terminal de decisiones' });

    restockMesh = box(1.42, 1.20, 1.12, 0x4d5d55, 10.4, 0.60, -7.25, 0.62, 0.05);
    scene.add(restockMesh);
    interactables.push({ mesh: restockMesh, type: 'restock', label: 'Reponer exhibidores desde almacén' });

    const adminDesk = box(2.1, 0.78, 0.72, 0x34414d, 9.5, 0.39, -2.6, 0.52, 0.08);
    const adminScreen = box(0.72, 0.48, 0.06, 0x0d151e, 9.5, 1.10, -2.87, 0.14, 0.25);
    const adminStand = box(0.08, 0.35, 0.08, 0x1a222b, 9.5, 0.83, -2.78, 0.28, 0.2);
    scene.add(adminDesk, adminScreen, adminStand);
    adminMesh = adminScreen;
    interactables.push({ mesh: adminMesh, type: 'admin', label: 'Abrir administración' });

    const welcome = box(0.08, 0.08, 0.08, 0x00ff88, 0, 0.04, 10.2, 0.3, 0);
    welcome.visible = false;
    scene.add(welcome);

    scene.add(plane(9.8, 4.2, 0xd8efff, -8.7, 2.15, 8.82, 0, 0, 0.05, 0.02));
    scene.add(plane(9.8, 4.2, 0xd8efff, 8.7, 2.15, 8.82, 0, 0, 0.05, 0.02));

    const prodFloor = texturedFloorBox(25.4, 0.06, 8.2, 'sidewalk', 0, 0.03, -5.9);
    scene.add(prodFloor);
    const warehouseStrip = box(25.6, 0.18, 0.28, 0x1d2a35, 0, 0.09, -4.25, 0.6, 0.04);
    scene.add(warehouseStrip);

    buildBoutiqueDecor();
    buildQueueDecor();
    [-9.2,-5.6,-2.0,2.0,5.6,9.2].forEach((x) => addCeilingLight(x, 5.2, true, false));
    [-9.2,-5.6,-2.0,2.0,5.6,9.2].forEach((x) => addCeilingLight(x, -5.8, false, false));
    [-7.5,0,7.5].forEach((x) => addCeilingLight(x, 1.0, true, false));
    addCeilingLight(-6.0, 3.8, true, true);
    addCeilingLight(0.0, 3.3, true, true);
    addCeilingLight(6.0, 3.8, true, true);
    addCeilingLight(0.0, -6.0, false, true);

    dynamicGroup = new THREE.Group();
    npcGroup = new THREE.Group();
    scene.add(dynamicGroup, npcGroup);
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      child.traverse?.((c) => {
        if (!c.userData?.sharedGLBGeometry) c.geometry?.dispose?.();
        if (c.material) Array.isArray(c.material) ? c.material.forEach(m => m.dispose?.()) : c.material.dispose?.();
      });
    }
  }

  function makeMachine(x, z, type = 'assembly', tier = 1) {
    const g = new THREE.Group();
    const palette = tier === 3 ? [0x315f72, 0xe4b638] : tier === 2 ? [0x4d5963, 0x79b2c6] : [0x666d72, 0xc9d0d6];
    const base = box(type === 'assembly' ? 1.16 : 1.0, 0.82, 0.84, palette[0], 0, 0.41, 0, 0.42, 0.24);
    const top = box(0.75, 0.15, 0.55, 0x1a2025, 0, 0.94, 0, 0.18, 0.25);
    g.add(base, top);
    if (type === 'assembly') {
      const arm = box(0.12, 0.82, 0.12, palette[1], 0.32, 1.22, 0, 0.34, 0.4);
      const arm2 = box(0.44, 0.08, 0.08, palette[1], 0.48, 1.58, 0, 0.34, 0.4);
      g.add(arm, arm2);
      g.userData.anim = { type: 'machineArm', arm, phase: Math.random() * 6.28 };
    } else {
      const wheel = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 20), mat(0x202327, 0.7, 0.2));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0.22, 1.10, 0);
      g.add(wheel);
      g.userData.anim = { type: 'machineWheel', wheel, phase: Math.random() * 6.28 };
    }
    g.position.set(x, 0, z);
    return g;
  }

  function addWorkers(count, color, startX, startZ, role = 'worker') {
    for (let i = 0; i < Math.min(count, 8); i++) {
      const p = person({shirt:color,pants:0x2b3440,formal:false,gender:i%3===0?'female':'male'});
      p.position.set(startX + (i % 4) * 1.28, 0, startZ + Math.floor(i / 4) * 1.56);
      p.rotation.y = Math.PI;
      dynamicGroup.add(p);
      registerAnimatedActor({ type: role, obj: p, baseY: 0, phase: Math.random() * 6.28, speed: 1.8 + Math.random() * 0.7 });
    }
  }

  function renderInventoryDisplays() {
    if (!dynamicGroup || !THREE) return;
    interactables = interactables.filter(it => it.type !== 'product');
    productInteractables = [];
    if (inventoryDisplayGroup) {
      dynamicGroup.remove(inventoryDisplayGroup);
      inventoryDisplayGroup.traverse?.(o => { if (!o.userData?.sharedGLBGeometry) o.geometry?.dispose?.(); if (o.material) Array.isArray(o.material) ? o.material.forEach(m=>m.dispose?.()) : o.material.dispose?.(); });
    }
    inventoryDisplayGroup = new THREE.Group();
    const locations = [
      { x: 10.1, z: 0.7 }, { x: 10.1, z: 2.8 }, { x: 10.1, z: 4.9 }
    ];
    PRODUCTS.forEach((product, i) => {
      const loc = locations[i];
      const shelfModel=placeModel('shelf',loc.x,0,loc.z,.92,0);
      const shelf = shelfModel || box(2.4,0.10,0.74,0x4b4239,loc.x,.70,loc.z,.46,.08);
      inventoryDisplayGroup.add(shelf);
      const pi = { mesh: shelf, type: 'product', productId: product.id, label: product.name };
      productInteractables.push(pi); interactables.push(pi);
      const count = Math.min(displayCapacity(), displayStock(product.id));
      for (let n = 0; n < count; n++) inventoryDisplayGroup.add(handbag(loc.x - 0.75 + n * 0.5, 0.50 + (n%2)*0.72, loc.z + .28, product.color, 0.50, 0.05));
    });
    const reserveTotal = totalReserveStock();
    for (let i = 0; i < Math.min(24, reserveTotal); i++) {
      const px = 7.5 + (i % 6) * 0.58;
      const pz = -8.25 + Math.floor(i / 6) * 0.52;
      inventoryDisplayGroup.add(box(0.50, 0.34, 0.46, 0x8a6748, px, 0.17, pz, 0.78, 0.02));
    }
    dynamicGroup.add(inventoryDisplayGroup);
  }

  function buildSalesStaff() {
    const staff = Math.min(3, salesStaff());
    for (let i=0;i<staff;i++) {
      const p = person({shirt:0xf3f5f7,pants:0x25384e,formal:true,tie:0x245f9e,gender:i%2?'female':'male',hair:i%2?0x403026:0x6b4a32});
      p.position.set(6.4 + i * 1.25, 0, 6.1 - (i%2)*1.0);
      dynamicGroup.add(p);
      registerAnimatedActor({ type: 'salesperson', obj: p, baseY: 0, baseX: p.position.x, baseZ: p.position.z, phase: Math.random()*6.28, speed: 1.7 + i*0.15 });
    }
  }

  function rebuildDynamicWorld() {
    if (!dynamicGroup) return;
    clearGroup(dynamicGroup);
    animatedActors = animatedActors.filter(a => a.type === 'traffic' || a.type === 'pedestrian' || a.type === 'supplierVan');
    checkoutQueue = [];
    npcs = [];
    clearGroup(npcGroup);
    loadInventory();

    const tables = owned('MESA_CORTE');
    for (let i = 0; i < Math.min(Math.max(2, tables), 6); i++) dynamicGroup.add(box(2.00, 0.76, 0.96, 0x64513f, -8.0 + (i % 3) * 4.0, 0.38, -4.9 + Math.floor(i / 3) * 1.25, 0.46, 0.07));

    const assEntry = saved('ENSAMBLE');
    let ass = [];
    Object.values(assEntry?.purchases || {}).forEach(row => Object.entries(row || {}).forEach(([k, v]) => { for (let i = 0; i < Number(v || 0); i++) ass.push(k); }));
    ass.slice(0, 6).forEach((k, i) => {
      const m = makeMachine(-9.2 + (i % 3) * 2.8, -7.3 + Math.floor(i / 3) * 1.7, 'assembly', k.includes('ind') ? 3 : k.includes('semi') ? 2 : 1);
      dynamicGroup.add(m);
      if (m.userData.anim) registerAnimatedActor({ ...m.userData.anim });
    });

    const finEntry = saved('ACABADOS');
    let fins = [];
    Object.values(finEntry?.purchases || {}).forEach(row => Object.entries(row || {}).forEach(([k, v]) => { for (let i = 0; i < Number(v || 0); i++) fins.push(k); }));
    fins.slice(0, 6).forEach((k, i) => {
      const m = makeMachine(0.4 + (i % 3) * 2.8, -7.3 + Math.floor(i / 3) * 1.7, 'finish', k.includes('ind') ? 3 : k.includes('semi') ? 2 : 1);
      dynamicGroup.add(m);
      if (m.userData.anim) registerAnimatedActor({ ...m.userData.anim });
    });

    if (saved('MOLDE')?.label) {
      const moldTier = optSelected('MOLDE', 'molde_3') ? 3 : optSelected('MOLDE', 'molde_2') ? 2 : 1;
      dynamicGroup.add(box(1.10, 0.18, 0.74, moldTier === 3 ? 0xd0a83e : moldTier === 2 ? 0x7f92a6 : 0x8b6a4b, -11.2, 0.88, -7.1, 0.38, 0.4));
    }

    const materialTotal = qty('CUERO') + qty('ACCESORIOS') + qty('HILO');
    for (let i = 0; i < Math.min(28, Math.max(6, Math.ceil(materialTotal / 8))); i++) dynamicGroup.add(box(0.56, 0.46, 0.56, 0x6e4c32, 7.2 + (i % 5) * 0.64, 0.23, -7.8 + Math.floor(i / 5) * 0.62, 0.8, 0.04));

    addWorkers(qty('PERS_CORTE'), 0xf3f4f5, -10.0, -6.0, 'worker');
    addWorkers(qty('PERS_ENSAMBLE'), 0xe8eef6, -1.2, -6.0, 'worker');
    addWorkers(qty('PERS_ACABADO'), 0xdfe7ef, 7.0, -6.0, 'worker');

    if (optSelected('JEFATURA', 'si_jefatura')) {
      const boss = person({shirt:0xf2f2ef,pants:0x1f2e42,formal:true,tie:0x315fa4,gender:'male',hair:0x70513a}); boss.scale.set(1.04, 1.04, 1.04); boss.position.set(11.0, 0, -5.8); dynamicGroup.add(boss);
      registerAnimatedActor({ type: 'manager', obj: boss, baseY: 0, phase: Math.random() * 6.28, speed: 1.45 });
    }

    const target = Math.min(24, Math.ceil(Number(saved('PRODUCCION_META')?.value || 0) / 5));
    for (let i = 0; i < target; i++) dynamicGroup.add(box(0.68, 0.42, 0.54, 0x9b6f43, 8.2 + (i % 4) * 0.76, 0.21, -5.0 + Math.floor(i / 4) * 0.60, 0.78, 0.02));

    const ups=businessState?.upgrades||{};
    for(let i=0;i<Number(ups.display||0);i++){
      const x=-4.8+i*4.8;
      const extraShelf=placeModel('shelf',x,0,0.1,.90,0);
      if(extraShelf) dynamicGroup.add(extraShelf); else dynamicGroup.add(box(3.2,0.10,0.68,0x4b4239,x,0.74,0.1,0.45,0.08));
      dynamicGroup.add(handbag(x-.58,.50,.35,PRODUCTS[i%3].color,.52,.04));
      dynamicGroup.add(handbag(x+.05,1.20,.35,PRODUCTS[(i+1)%3].color,.52,-.04));
      dynamicGroup.add(handbag(x+.60,1.90,.35,PRODUCTS[(i+2)%3].color,.52,.02));
    }
    if(Number(ups.checkout||0)>0){
      const reg2=placeModel('checkout',-4.8,0,6.7,.50,0);
      if(reg2){ dynamicGroup.add(reg2); secondRegisterMesh=reg2; }
      else { const fallback=box(1.4,.78,.72,0x252e38,-4.8,.39,6.7,.42,.08); dynamicGroup.add(fallback); secondRegisterMesh=fallback; }
    } else secondRegisterMesh=null;
    if(Number(ups.warehouse||0)>0){
      for(let i=0;i<8*Number(ups.warehouse);i++) dynamicGroup.add(box(0.48,0.34,0.44,0x7a5d45,10.5+(i%4)*0.55,0.17,-8.0+Math.floor(i/4)*0.46,0.8,0.02));
    }

    buildSalesStaff();
    renderInventoryDisplays();
    updateHUD();
  }

  function npcDemandScore() {
    const channels = saved('CANALES')?.optionIds || [];
    let s = channels.includes('web') ? 0.6 : 0;
    s += channels.includes('los_olivos') ? 1.0 : 0;
    s += channels.includes('miraflores') ? 1.25 : 0;
    s += channels.includes('sjl') ? 1.1 : 0;
    s += optSelected('INV_MARKETING', 'mkt_baja') ? 0.2 : optSelected('INV_MARKETING', 'mkt_media') ? 0.55 : optSelected('INV_MARKETING', 'mkt_alta') ? 0.95 : 0;
    return Math.max(0.35, s);
  }

  function salesStaff() {
    const channels=saved('CANALES')?.optionIds||[];
    const itemIds=['los_olivos','miraflores','sjl'];
    return channels.filter(id=>itemIds.includes(id)).length; // 1 vendedor básico automático por tienda física
  }

  function queueCapacity() { return queueSlots.length; }

  function reflowQueue() {
    checkoutQueue = checkoutQueue.filter(n => !n.dead);
    checkoutQueue.forEach((n, i) => {
      n.queueIndex = i;
      n.phase = 'queueing';
      n.route = [[queueSlots[i].x, queueSlots[i].z]];
      n.routeIndex = 0;
    });
    updateHUD();
  }

  function removeFromQueue(n) {
    const idx = checkoutQueue.indexOf(n);
    if (idx >= 0) {
      checkoutQueue.splice(idx, 1);
      reflowQueue();
    }
  }

  function tryJoinQueue(n) {
    if (checkoutQueue.length >= queueCapacity()) return false;
    n.queueIndex = checkoutQueue.length;
    n.phase = 'queueing';
    n.route = [[-4.9, 7.2], [queueSlots[n.queueIndex].x, queueSlots[n.queueIndex].z]];
    n.routeIndex = 0;
    checkoutQueue.push(n);
    updateHUD();
    return true;
  }

  function makeShoppingRoute(spawnX) {
    const count = 2 + Math.floor(Math.random() * 3);
    const pool = SHOPPING_SPOTS.slice();
    const route = [[spawnX, 11.4], [0, 9.8]];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const spot = pool.splice(idx, 1)[0];
      route.push([spot.x + (Math.random() - .5) * .35, spot.z + (Math.random() - .5) * .30]);
    }
    return route;
  }

  function npcSay(npc, text, color = '#d9efff', duration = 1400) {
    if (!npc?.obj || npc.dead) return;
    const now = performance.now();
    if (npc.lastBubbleAt && now - npc.lastBubbleAt < 2400) return;
    npc.lastBubbleAt = now;
    const old = npc.obj.userData.chatBubble;
    if (old) npc.obj.remove(old);
    const bubble = makeLocalLabel(text, color, .52);
    bubble.position.y = 2.05;
    npc.obj.add(bubble);
    npc.obj.userData.chatBubble = bubble;
    setTimeout(() => {
      if (npc.obj?.userData?.chatBubble === bubble) {
        npc.obj.remove(bubble);
        npc.obj.userData.chatBubble = null;
      }
    }, duration);
  }

  function computeNpcAvoidance(npc) {
    let ax = 0, az = 0;
    for (const other of npcs) {
      if (other === npc || other.dead || !other.obj) continue;
      const dx = npc.obj.position.x - other.obj.position.x;
      const dz = npc.obj.position.z - other.obj.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= 0.0001 || d2 > 0.72 * 0.72) continue;
      const d = Math.sqrt(d2);
      const push = (0.72 - d) / 0.72;
      ax += (dx / d) * push;
      az += (dz / d) * push;
    }
    return [ax, az];
  }

  function spawnNpc(now) {
    const score = npcDemandScore();
    const dayBoost = gameSession?.difficulty || 1;
    const rush = businessState?.rushBoostUntil > now ? 1.65 : 1;
    const interval = Math.max(1500, 8200 / (score * dayBoost * rush));
    if (now - lastSpawn < interval || npcs.length >= 8) return;
    lastSpawn = now;
    const archetype = randomArchetype();
    const p = person(customerStyle(archetype));
    const spawnX = (Math.random() - 0.5) * 8;
    p.position.set(spawnX, 0, 20.8 + Math.random() * 1.8);
    npcGroup.add(p);
    const npc = {
      obj: p,
      spawnX,
      route: makeShoppingRoute(spawnX),
      routeIndex: 0,
      phase: 'shopping',
      wait: 0,
      buy: false,
      speed: (0.95 + Math.random() * 0.35) * archetype.speed,
      walkCycle: Math.random() * 6.28,
      queueIndex: -1,
      dead: false,
      shoppingPasses: 0,
      browseLooks: 0,
      lastBubbleAt: 0,
      archetype,
      patienceLimit: archetype.patience + customerPatienceBoost() + (hasManager() ? 1 : 0)
    };
    npcs.push(npc);
    simVisitors++;
    updateHUD();
  }

  function recordSale(productId, price) {
    const product = productById(productId);
    const salePrice = Math.max(0, Number(price || product.price));
    simSales++;
    localStorage.setItem(salesCountKey(), String(simSales));
    if (inventory) {
      inventory.sold[product.id] = Number(inventory.sold[product.id] || 0) + 1;
      saveInventory();
    }
    if (gameSession) {
      gameSession.revenue += salePrice;
      gameSession.served += 1;
      gameSession.combo = Number(gameSession.combo || 0) + 1;
      gameSession.bestCombo = Math.max(gameSession.bestCombo || 0, gameSession.combo);
      adjustSatisfaction(1.2 + Math.min(1, gameSession.combo * 0.08));
    }
    bridge().recordSimulatedSale?.(salePrice);
    updateHUD();
    showCashFx(`+ ${fmt(salePrice)}`);
    playSfx('sale');
    updateReputation(0.35);
    if (simSales % 3 === 0) addBusinessLog(`Venta: ${product.name} por ${fmt(salePrice)}.`);
    if (simSales % 5 === 0) message(`¡${simSales} ventas! La tienda está agarrando ritmo.`);
  }

  function clearCheckoutBag(delay = 0) {
    if (!checkoutBagMesh) return;
    if (delay > 0) { checkoutBagRemoveAt = performance.now() + delay; return; }
    dynamicGroup?.remove(checkoutBagMesh);
    checkoutBagMesh = null;
    checkoutBagTarget = null;
    checkoutBagRemoveAt = 0;
  }

  function showCheckoutBag(npc) {
    clearCheckoutBag();
    const product = productById(npc.productId);
    checkoutBagMesh = handbag(-7.38, 1.06, 6.46, product.color, .54, .12);
    checkoutBagTarget = { x: -7.72, y: 1.06, z: 6.43, r: .12 };
    dynamicGroup?.add(checkoutBagMesh);
  }

  function animateCheckoutBag(dt) {
    if (!checkoutBagMesh || !checkoutBagTarget) return;
    const k = 1 - Math.exp(-9 * dt);
    checkoutBagMesh.position.x += (checkoutBagTarget.x - checkoutBagMesh.position.x) * k;
    checkoutBagMesh.position.y += (checkoutBagTarget.y - checkoutBagMesh.position.y) * k;
    checkoutBagMesh.position.z += (checkoutBagTarget.z - checkoutBagMesh.position.z) * k;
    checkoutBagMesh.rotation.y += (checkoutBagTarget.r - checkoutBagMesh.rotation.y) * k;
    if (checkoutBagRemoveAt && performance.now() >= checkoutBagRemoveAt) clearCheckoutBag();
  }

  function openCheckout() {
    const npc = checkoutQueue[0];
    if (!npc) { message('No hay clientes en la cola de caja.'); return; }
    checkoutOpen = true;
    checkoutScanned = false;
    checkoutPayment = 'cash';
    document.exitPointerLock?.();
    const product = productById(npc.productId);
    $3('checkoutCustomer').textContent = npc.archetype?.label || 'Cliente';
    $3('checkoutProduct').textContent = product.name;
    $3('checkoutPrice').textContent = fmt(npc.productPrice);
    $3('checkoutStatus').textContent = npc.isReturn ? 'DEVOLUCIÓN · Escanea el producto para reembolsar' : 'Producto pendiente de escaneo';
    $3('checkoutScanBtn').disabled = false;
    $3('checkoutChargeBtn').disabled = true;
    $3('checkoutChargeBtn').textContent = npc.isReturn ? `REEMBOLSAR ${fmt(npc.productPrice)}` : `COBRAR ${fmt(npc.productPrice)}`;
    $3('payCashBtn')?.classList.add('active'); $3('payCardBtn')?.classList.remove('active');
    $3('simCheckout')?.classList.remove('hidden');
    showCheckoutBag(npc);
  }

  function closeCheckout(resume = true) {
    checkoutOpen = false;
    checkoutScanned = false;
    $3('simCheckout')?.classList.add('hidden');
    if (resume && running) setTimeout(()=>$3('side3dCanvas')?.requestPointerLock?.(),60);
  }

  function scanCheckoutProduct() {
    if (!checkoutOpen || !checkoutQueue.length) return;
    checkoutScanned = true;
    $3('checkoutStatus').textContent = 'Producto escaneado correctamente';
    $3('checkoutScanBtn').disabled = true;
    $3('checkoutChargeBtn').disabled = false;
    checkoutBagTarget = { x: -8.10, y: 1.08, z: 6.40, r: -.08 };
    playTone(980,.06,'square',.022,0); playTone(1200,.04,'square',.016,.05);
  }

  function confirmCheckout() {
    if (!checkoutOpen || !checkoutScanned) return;
    checkoutBagTarget = { x: -8.52, y: 1.08, z: 6.48, r: -.16 };
    clearCheckoutBag(520);
    closeCheckout(false);
    serveNextQueuedCustomer(false);
    setTimeout(()=>$3('side3dCanvas')?.requestPointerLock?.(),80);
  }

  function serveNextQueuedCustomer(autoServed = false) {
    if (!checkoutQueue.length) {
      message('No hay clientes en la cola de caja.');
      return;
    }
    const npc = checkoutQueue.shift();
    attachBagToNpc(npc);
    showReceipt(npc);
    if (npc.obj.userData.orderLabel) { npc.obj.remove(npc.obj.userData.orderLabel); npc.obj.userData.orderLabel = null; }
    npc.phase = 'leaving';
    npc.route = [[-4.7, 7.15], [0, 10.2], [npc.spawnX, 21.6]];
    npc.routeIndex = 0;
    npc.wait = 0.35;
    npc.obj.rotation.y = Math.PI;
    const product = productById(npc.productId);
    if(npc.isReturn){
      const refund=Number(npc.productPrice||product.price);
      businessState.returns=Number(businessState.returns||0)+1; businessState.expenses=Number(businessState.expenses||0)+refund;
      inventory.reserve[product.id]=(inventory.reserve[product.id]||0)+1; saveInventory(); saveBusinessState(); renderInventoryDisplays();
      updateReputation(-2,'Devolución procesada'); showCashFx(`− ${fmt(refund)}`); playSfx('lost');
      message(`Reembolso procesado: ${product.name} · ${fmt(refund)}.`);
      addBusinessLog(`Devolución de ${product.name}: −${fmt(refund)}.`);
    } else {
      recordSale(npc.productId, npc.productPrice);
      const who = autoServed ? 'Tu equipo atendió' : 'Cobraste';
      npcSay(npc, '¡Gracias!', '#a9f0c5', 1100);
      message(`${who}: ${product.name} por ${fmt(npc.productPrice)} · ${checkoutPayment==='card'?'tarjeta':'efectivo'}.`);
    }
    reflowQueue();
  }

  function prepareNpcNextStep(n) {
    if (n.phase === 'shopping') {
      if (n.routeIndex >= 1) {
        n.wait = 0.75 + Math.random() * 1.55;
        n.browseLooks = Number(n.browseLooks || 0) + 1;
        if (Math.random() < 0.18) npcSay(n, ['Estoy comparando','Voy a mirar otro modelo','Se ve interesante'][Math.floor(Math.random()*3)], '#bfe7ff', 1150);
      }
      if (n.routeIndex < n.route.length - 1) {
        n.routeIndex++;
        return;
      }
      const marketingBoost = optSelected('INV_MARKETING', 'mkt_alta') ? 0.18 : optSelected('INV_MARKETING', 'mkt_media') ? 0.1 : 0;
      const preferred = productById(n.archetype?.pref || 'urbano');
      const pricePenalty = Math.max(-0.12, Math.min(0.28, (preferred.price - ({esencial:75,urbano:95,premium:125}[preferred.id])) / 220));
      const repBoost = ((businessState?.reputation || 80)-80)/160;
      n.buy = Math.random() < Math.max(0.12, Math.min(0.94, 0.34 + salesStaff() * 0.06 + marketingBoost + repBoost - pricePenalty));
      const product = n.buy ? chooseProductForCustomer(n.archetype) : null;
      if (product && checkoutQueue.length < queueCapacity() && reserveProductForNpc(n, product) && tryJoinQueue(n)) {
        attachBagToNpc(n);
        n.wait = 0.45;
        n.queueWait = 0;
        return;
      }
      if (n.buy) {
        npcSay(n, product ? 'La cola está llena' : 'No encontré stock', product ? '#ffd18b' : '#ff9c9c', 1500);
        markLostCustomer(product ? 'queue' : 'stock');
      } else if (Math.random() < .35) {
        npcSay(n, 'Seguiré buscando', '#b7c9d9', 1200);
      }
      n.phase = 'leaving';
      n.route = [[0, 10.4], [n.spawnX, 21.6]];
      n.routeIndex = 0;
      return;
    }
    if (n.phase === 'queueing') {
      if (n.routeIndex < n.route.length - 1) {
        n.routeIndex++;
      } else {
        n.phase = 'queued';
      }
      return;
    }
    if (n.phase === 'leaving') {
      if (n.routeIndex < n.route.length - 1) {
        n.routeIndex++;
      } else {
        npcGroup.remove(n.obj);
        n.dead = true;
      }
    }
  }

  function moveNpc(n, dt) {
    if (n.dead) return;
    if (n.phase === 'queued') {
      n.queueWait = (n.queueWait || 0) + dt;
      if (n.queueWait > (n.patienceLimit || 16)) {
        removeFromQueue(n);
        if (n.productId && inventory) {
          inventory.display[n.productId] = Math.min(4, Number(inventory.display[n.productId] || 0) + 1);
          saveInventory();
          renderInventoryDisplays();
        }
        if (n.obj.userData.heldBag) { n.obj.userData.heldBag.removeFromParent?.(); n.obj.userData.heldBag = null; }
        if (n.obj.userData.orderLabel) { n.obj.remove(n.obj.userData.orderLabel); n.obj.userData.orderLabel = null; }
        n.phase = 'leaving';
        n.route = [[0, 10.6], [n.spawnX, 21.6]];
        n.routeIndex = 0;
        markLostCustomer('queue');
        updateHUD();
        npcSay(n, 'Esperé demasiado', '#ff9f9f', 1600);
        message('Un cliente abandonó la cola por demora y devolvió el producto.');
      }
      setPersonPose(n.obj, n.walkCycle += dt * 2.2, false);
      return;
    }
    if (n.wait > 0) {
      n.wait -= dt;
      if (n.phase === 'shopping') n.obj.rotation.y += Math.sin(n.walkCycle) * 0.003;
      setPersonPose(n.obj, n.walkCycle += dt * 2.4, false);
      return;
    }
    const target = n.route[n.routeIndex];
    if (!target) return;
    const dx = target[0] - n.obj.position.x;
    const dz = target[1] - n.obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.12) {
      prepareNpcNextStep(n);
      setPersonPose(n.obj, n.walkCycle += dt * 2.4, false);
      return;
    }
    n.walkCycle += dt * 7.0;
    setPersonPose(n.obj, n.walkCycle, true);
    const [avoidX, avoidZ] = computeNpcAvoidance(n);
    let moveX = dx / dist + avoidX * 0.72;
    let moveZ = dz / dist + avoidZ * 0.72;
    const ml = Math.hypot(moveX, moveZ) || 1;
    moveX /= ml; moveZ /= ml;
    n.obj.position.x += moveX * n.speed * dt;
    n.obj.position.z += moveZ * n.speed * dt;
    n.obj.rotation.y = Math.atan2(moveX, moveZ);
  }

  function animateActors(time, dt = 0.016) {
    animatedActors.forEach((a) => {
      if (a.type === 'worker' || a.type === 'cashier' || a.type === 'manager' || a.type === 'analyst' || a.type === 'salesperson') {
        a.obj.position.y = a.baseY + Math.sin(time * a.speed + a.phase) * 0.012;
        if (a.type === 'salesperson') {
          a.obj.position.x = a.baseX + Math.sin(time * 0.6 + a.phase) * 0.28;
          a.obj.position.z = a.baseZ + Math.cos(time * 0.6 + a.phase) * 0.22;
          a.obj.rotation.y = Math.atan2(Math.cos(time * 0.6 + a.phase), Math.sin(time * 0.6 + a.phase));
          setPersonPose(a.obj, time * 4.0 + a.phase, true);
        } else {
          setPersonPose(a.obj, time * (a.type === 'cashier' ? 3.0 : 2.2) + a.phase, false);
        }
        if (a.type === 'cashier') a.obj.rotation.y = Math.PI + Math.sin(time * 0.8 + a.phase) * 0.1;
      } else if (a.type === 'machineArm') {
        a.arm.rotation.z = Math.sin(time * 2.8 + a.phase) * 0.45;
      } else if (a.type === 'machineWheel') {
        a.wheel.rotation.x += 0.06;
      } else if (a.type === 'traffic') {
        a.obj.position.x += a.speed * a.dir * dt;
        if (a.dir > 0 && a.obj.position.x > a.maxX) a.obj.position.x = a.minX;
        if (a.dir < 0 && a.obj.position.x < a.minX) a.obj.position.x = a.maxX;
      } else if (a.type === 'supplierVan') {
        if (a.state === 'inbound') {
          a.obj.position.x = Math.min(a.stopX, a.obj.position.x + a.speed * dt);
        } else if (a.state === 'outbound') {
          a.obj.position.x += (a.speed + 1.4) * dt;
          if (a.obj.position.x > 26) { scene.remove(a.obj); a.dead = true; if (deliveryActor === a) { deliveryActor = null; deliveryVan = null; } }
        }
      } else if (a.type === 'pedestrian') {
        a.obj.position.x += a.speed * a.dir * dt;
        if (a.dir > 0 && a.obj.position.x > a.maxX) a.obj.position.x = a.minX;
        if (a.dir < 0 && a.obj.position.x < a.minX) a.obj.position.x = a.maxX;
        a.obj.position.z = a.baseZ + Math.sin(time * 0.6 + a.phase) * 0.02;
        a.obj.rotation.y = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        setPersonPose(a.obj, time * 4.0 + a.phase, true);
      }
    });
    animatedActors = animatedActors.filter(a => !a.dead);
    if (salesStaff() > 0 && time - lastAutoRestock > Math.max(10, 22 - salesStaff() * 3)) {
      lastAutoRestock = time;
      restockDisplays(false);
    }
    if ((salesStaff() > 1 || Number(businessState?.upgrades?.checkout||0)>0) && checkoutQueue.length && time > nextAutoServeAt) {
      const checkoutBoost=Number(businessState?.upgrades?.checkout||0)>0?4:0;
      nextAutoServeAt = time + Math.max(4.5, 15 - salesStaff() * 1.5 - checkoutBoost);
      serveNextQueuedCustomer(true);
    }
    if (hasManager() && gameSession && !gameSession.shiftEnded && time > nextManagerBoostAt) {
      nextManagerBoostAt = time + 18;
      adjustSatisfaction(1.5);
    }
  }

  function updateEntryDoors(dt) {
    if (!entryDoorLeft || !entryDoorRight) return;
    let open = !gameSession?.shiftEnded && Math.abs(player.x) < 2.6 && player.z > 6.4 && player.z < 12.4;
    if (!open) open = npcs.some(n => !n.dead && n.obj && Math.abs(n.obj.position.x) < 2.6 && n.obj.position.z > 6.4 && n.obj.position.z < 12.4);
    const target = open ? 1 : 0;
    entryDoorProgress += (target - entryDoorProgress) * (1 - Math.exp(-6 * dt));
    entryDoorLeft.position.x = -0.92 - entryDoorProgress * 0.82;
    entryDoorRight.position.x = 0.92 + entryDoorProgress * 0.82;
  }

  const SKY_DAY_HEX = 0xa6c8ea, SKY_DUSK_HEX = 0x5c6f8d;
  let skyDayColor = null, skyDuskColor = null;

  function updateDayLighting(dt) {
    if (!gameSession || !scene) return;
    if (!skyDayColor) { skyDayColor = new THREE.Color(SKY_DAY_HEX); skyDuskColor = new THREE.Color(SKY_DUSK_HEX); }
    const progress = 1 - Math.max(0, Math.min(1, gameSession.timeLeft / Math.max(1, gameSession.duration || 300)));
    const dusk = Math.max(0, (progress - 0.62) / 0.38);
    scene.background.lerpColors(skyDayColor, skyDuskColor, dusk * 0.82);
    if (scene.fog) scene.fog.color.copy(scene.background);
    if (sunLight) {
      sunLight.intensity = 2.1 - dusk * 1.15;
      sunLight.color.setRGB(1.0, 0.94 - dusk * 0.10, 0.84 - dusk * 0.18);
      sunLight.position.y = 22 - progress * 8;
      sunLight.position.x = 16 - progress * 12;
    }
    if (hemiLight) hemiLight.intensity = 1.95 - dusk * 0.65;
  }

  function collision(x, z) {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return true;
    return colliders.some(c => x > c.minX - player.radius && x < c.maxX + player.radius && z > c.minZ - player.radius && z < c.maxZ + player.radius);
  }

  function updatePlayer(dt) {
    if (checkoutOpen || productInspectOpen) { player.vx *= 0.7; player.vz *= 0.7; return; }
    const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const inputLen = Math.hypot(forward, side);
    const sprinting = Boolean((keys.ShiftLeft || keys.ShiftRight) && inputLen > 0);
    const maxSpeed = sprinting ? 6.8 : 4.4;
    const accel = sprinting ? 24 : 20;
    const decel = 13;

    let desiredX = 0, desiredZ = 0;
    if (inputLen > 0) {
      const f = forward / inputLen, s = side / inputLen;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      desiredX = (s * cos - f * sin) * maxSpeed;
      desiredZ = (-f * cos - s * sin) * maxSpeed;
    }

    const blend = 1 - Math.exp(-(inputLen ? accel : decel) * dt);
    player.vx += (desiredX - player.vx) * blend;
    player.vz += (desiredZ - player.vz) * blend;
    player.speed = Math.hypot(player.vx, player.vz);

    const nx = player.x + player.vx * dt;
    const nz = player.z + player.vz * dt;
    if (!collision(nx, player.z)) player.x = nx; else player.vx *= -0.08;
    if (!collision(player.x, nz)) player.z = nz; else player.vz *= -0.08;

    if (jumpQueued && player.grounded) {
      player.vy = 5.1;
      player.grounded = false;
      playTone(330, .07, 'triangle', .012, 0);
    }
    jumpQueued = false;
    if (!player.grounded) {
      player.vy -= 14.5 * dt;
      player.y += player.vy * dt;
      if (player.y <= player.baseY) {
        player.y = player.baseY;
        player.vy = 0;
        player.grounded = true;
      }
    }

    if (player.grounded && player.speed > .15) player.bob += dt * (5.8 + player.speed * .75);
    const bobAmount = player.grounded ? Math.min(.045, player.speed * .009) : 0;
    player.headBobY = Math.sin(player.bob * 2) * bobAmount;
    player.headBobX = Math.cos(player.bob) * bobAmount * .45;
    const nowMs = performance.now();
    if (player.grounded && player.speed > 1.1 && nowMs >= nextFootstepAt) {
      playFootstep(sprinting);
      nextFootstepAt = nowMs + (sprinting ? 255 : 390);
    }

    if (camera) {
      const targetFov = sprinting ? Math.min(92, baseFov + 4) : baseFov;
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-7 * dt));
      camera.updateProjectionMatrix();
    }
  }

  function openProductInspect(productId) {
    const product = productById(productId);
    const wrap = $3('simProductInspect');
    if (!wrap || !product) return;
    productInspectOpen = true;
    document.exitPointerLock?.();
    $3('inspectProductName').textContent = product.name;
    $3('inspectProductPrice').textContent = fmt(product.price);
    $3('inspectProductStock').textContent = `${displayStock(product.id)} en exhibición · ${reserveStock(product.id)} en almacén`;
    const descriptions={esencial:'Modelo esencial de entrada, accesible y de rotación rápida.',urbano:'Modelo versátil para uso diario y segmento urbano.',ejecutivo:'Diseño sobrio para oficina y clientes profesionales.',premium:'Modelo premium con mayor margen y clientes más exigentes.',limited:'Colección limitada de alto valor, baja rotación y mayor prestigio.'};
    $3('inspectProductDesc').textContent = descriptions[product.id]||`Producto ${companyName()}.`;
    const swatch=$3('inspectProductSwatch'); if(swatch) swatch.style.background=product.accent;
    wrap.classList.remove('hidden');
  }

  function closeProductInspect() {
    productInspectOpen = false;
    $3('simProductInspect')?.classList.add('hidden');
    if (running) setTimeout(()=>$3('side3dCanvas')?.requestPointerLock?.(),60);
  }

  function nearestInteractable() {
    if (!THREE || !camera) return null;
    interactionRaycaster ||= new THREE.Raycaster();
    interactionPointer ||= new THREE.Vector2(0, 0);
    interactionScratch ||= new THREE.Vector3();
    interactionRaycaster.setFromCamera(interactionPointer, camera);
    const roots = interactables.map(it => it.mesh).filter(Boolean);
    const hits = roots.length ? interactionRaycaster.intersectObjects(roots, true) : [];
    for (const hit of hits) {
      if (hit.distance > 3.25) break;
      let node = hit.object;
      while (node) {
        const match = interactables.find(it => it.mesh === node);
        if (match) return match;
        node = node.parent;
      }
    }
    let best = null, dist = 1.75;
    interactables.forEach((it) => {
      it.mesh.getWorldPosition(interactionScratch);
      const d = Math.hypot(player.x - interactionScratch.x, player.z - interactionScratch.z);
      if (d < dist) { dist = d; best = it; }
    });
    return best;
  }

  function updatePrompt() {
    const p = $3('sim3dPrompt');
    const it = nearestInteractable();
    focusedInteractable = it;
    $3('simulator3d')?.classList.toggle('has-focus-target', Boolean(it));
    if (!p) return;
    if (it?.type === 'decisions') {
      p.innerHTML = '<kbd>E</kbd> Abrir terminal de decisiones';
      p.classList.add('show');
      return;
    }
    if (it?.type === 'register') {
      const next = checkoutQueue[0];
      const detail = next ? `${next.archetype?.label || 'Cliente'} · ${productById(next.productId).name} · ${fmt(next.productPrice)}` : 'Sin clientes';
      p.innerHTML = `<kbd>E</kbd> Abrir caja · ${detail}${checkoutQueue.length ? ` · ${checkoutQueue.length} en cola` : ''}`;
      p.classList.add('show');
      return;
    }
    if (it?.type === 'restock') {
      p.innerHTML = `<kbd>E</kbd> Reponer exhibidores · ${totalReserveStock()} unidades en almacén`;
      p.classList.add('show');
      return;
    }
    if (it?.type === 'product') {
      const product = productById(it.productId);
      p.innerHTML = `<kbd>E</kbd> Ver ${product.name} · ${fmt(product.price)}`;
      p.classList.add('show');
      return;
    }
    if (it?.type === 'admin') {
      p.innerHTML = '<kbd>E</kbd> Abrir computadora de administración';
      p.classList.add('show');
      return;
    }
    p.classList.remove('show');
  }

  function interact() {
    const it = nearestInteractable();
    if (!it) return;
    if (it.type === 'decisions') openDecisionsFrom3D();
    else if (it.type === 'register') openCheckout();
    else if (it.type === 'restock') restockDisplays(true);
    else if (it.type === 'product') openProductInspect(it.productId);
    else if (it.type === 'admin') openAdmin();
  }

  function openDecisionsFrom3D() {
    running = false;
    document.exitPointerLock?.();
    stopAmbient();
    window.__SIDE_RETURN_TO_3D = true;
    if (typeof window.openDecisionMenu === 'function') window.openDecisionMenu();
  }

  function syncSettingsUI() {
    const sens = $3('simSensitivity');
    const fov = $3('simFov');
    if (sens) { sens.value = String(mouseSensitivity); $3('simSensitivityValue').textContent = `${mouseSensitivity.toFixed(2)}×`; }
    if (fov) { fov.value = String(baseFov); $3('simFovValue').textContent = `${Math.round(baseFov)}°`; }
    document.querySelectorAll('[data-sim-quality]').forEach(btn => btn.classList.toggle('active', btn.dataset.simQuality === perfMode));
  }

  function openSettings() {
    settingsOpen = true;
    settingsResumeRunning = running;
    running = false;
    document.exitPointerLock?.();
    syncSettingsUI();
    $3('simSettings')?.classList.remove('hidden');
  }

  function closeSettings(resume = true) {
    settingsOpen = false;
    $3('simSettings')?.classList.add('hidden');
    if (resume && settingsResumeRunning) {
      running = true;
      clock?.getDelta();
      setTimeout(() => $3('side3dCanvas')?.requestPointerLock?.(), 70);
    }
    settingsResumeRunning = false;
  }

  function autoSave3D(now = performance.now()) {
    if (now - lastAutoSaveAt < 30000) return;
    lastAutoSaveAt = now;
    saveInventory(); saveBusinessState();
    const el = $3('simSaveIndicator');
    if (el) { el.classList.add('show'); clearTimeout(autoSave3D.t); autoSave3D.t = setTimeout(()=>el.classList.remove('show'), 1500); }
  }

  function resize() {
    if (!renderer || !camera) return;
    const c = $3('side3dCanvas');
    const w = c.clientWidth || innerWidth;
    const h = c.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }


  function updateAdaptiveQuality(dt, now) {
    if (!renderer || perfMode !== 'auto') return;
    perfAccum += dt;
    perfFrames += 1;
    if (now - perfLastCheck < 2500) return;
    const fps = perfFrames / Math.max(0.001, perfAccum);
    perfAccum = 0; perfFrames = 0; perfLastCheck = now;
    let next = renderScale;
    if (fps < 38) next = Math.max(0.78, renderScale - 0.18);
    else if (fps < 48) next = Math.max(0.90, renderScale - 0.10);
    else if (fps > 57) next = Math.min(1.25, renderScale + 0.06);
    if (Math.abs(next - renderScale) >= 0.04) {
      renderScale = next;
      renderer.setPixelRatio(Math.min(devicePixelRatio, renderScale));
      resize();
    }
  }

  function frame(now = performance.now()) {
    if (!initialized) return;
    const dt = Math.min(0.04, clock.getDelta());
    const time = performance.now() * 0.001;
    if (running) {
      if (gameSession && !gameSession.shiftEnded) {
        gameSession.timeLeft -= dt;
        if (gameSession.timeLeft <= 0) {
          gameSession.timeLeft = 0;
          updateHUD();
          endShift();
        }
      }
      yaw += (targetYaw - yaw) * (1 - Math.exp(-24 * dt));
      pitch += (targetPitch - pitch) * (1 - Math.exp(-24 * dt));
      updatePlayer(dt);
      const sideBobX = player.headBobX || 0;
      camera.position.set(player.x + Math.cos(yaw) * sideBobX, player.y + (player.headBobY || 0), player.z - Math.sin(yaw) * sideBobX);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
      if (!gameSession?.shiftEnded) {
        spawnNpc(now);
        triggerRandomEvent(now);
        tickProduction(now);
        tickSupplier(now);
        npcs.forEach((n) => moveNpc(n, dt));
        npcs = npcs.filter((n) => !n.dead);
      }
      animateActors(time, dt);
      animateCheckoutBag(dt);
      autoSave3D(now);
      updateEntryDoors(dt);
      if (now - lastLightTick > 250) { updateDayLighting(dt); lastLightTick = now; }
      if (now - lastPromptTick > 100) { updatePrompt(); lastPromptTick = now; }
      if (now - lastHudTick > 220) { updateHUD(); updateMinimap(); if(adminOpen) refreshAdminUI(); lastHudTick = now; }
    } else {
      animateActors(time, dt);
      animateCheckoutBag(dt);
      updateEntryDoors(dt);
      if (now - lastLightTick > 350) { updateDayLighting(dt); lastLightTick = now; }
      if (now - lastHudTick > 350) { updateHUD(); lastHudTick = now; }
    }
    updateAdaptiveQuality(dt, now);
    updateModelMixers(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function bind() {
    const canvas = $3('side3dCanvas');
    canvas.addEventListener('click', () => { if (running) canvas.requestPointerLock?.(); });
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
    document.addEventListener('mousemove', (e) => {
      if (!running || !locked) return;
      targetYaw -= e.movementX * 0.00215 * mouseSensitivity;
      targetPitch -= e.movementY * 0.00185 * mouseSensitivity;
      targetPitch = Math.max(-1.3, Math.min(1.3, targetPitch));
    });
    document.addEventListener('keydown', (e) => {
      if ($3(rootId)?.classList.contains('hidden')) return;
      if (settingsOpen) { if(e.code==='Escape'||e.code==='KeyP') closeSettings(true); return; }
      if (e.code==='KeyP' && !checkoutOpen && !productInspectOpen && !adminOpen) { openSettings(); e.preventDefault(); return; }
      if (adminOpen) { if(e.code==='Escape') closeAdmin(); return; }
      if (productInspectOpen && e.code !== 'Escape') return;
      if (productInspectOpen && e.code === 'Escape') { closeProductInspect(); return; }
      keys[e.code] = true;
      if (checkoutOpen) {
        if (e.code === 'KeyE' || e.code === 'Enter') { checkoutScanned ? confirmCheckout() : scanCheckoutProduct(); e.preventDefault(); }
        if (e.code === 'Escape') { closeCheckout(true); e.preventDefault(); }
        return;
      }
      if (productInspectOpen && e.code === 'Escape') { closeProductInspect(); e.preventDefault(); return; }
      if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
      if (e.code === 'KeyE') interact();
      if (e.code === 'Escape') document.exitPointerLock?.();
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });
    $3('inspectCloseBtn')?.addEventListener('click', closeProductInspect);
    $3('payCashBtn')?.addEventListener('click',()=>{checkoutPayment='cash';$3('payCashBtn').classList.add('active');$3('payCardBtn').classList.remove('active');});
    $3('payCardBtn')?.addEventListener('click',()=>{checkoutPayment='card';$3('payCardBtn').classList.add('active');$3('payCashBtn').classList.remove('active');});
    $3('checkoutCloseBtn')?.addEventListener('click', () => closeCheckout(true));
    $3('checkoutScanBtn')?.addEventListener('click', scanCheckoutProduct);
    $3('checkoutChargeBtn')?.addEventListener('click', confirmCheckout);
    $3('sim3dSettingsBtn')?.addEventListener('click', openSettings);
    $3('simSettingsClose')?.addEventListener('click', () => closeSettings(true));
    $3('simSensitivity')?.addEventListener('input', (e) => {
      mouseSensitivity = Math.max(.45, Math.min(1.8, Number(e.target.value) || 1));
      businessState.controls.sensitivity = mouseSensitivity; saveBusinessState(); syncSettingsUI();
    });
    $3('simFov')?.addEventListener('input', (e) => {
      baseFov = Math.max(62, Math.min(88, Number(e.target.value) || 74));
      businessState.controls.fov = baseFov; saveBusinessState(); syncSettingsUI();
    });
    document.querySelectorAll('[data-sim-quality]').forEach(btn => btn.addEventListener('click', () => {
      setGraphicsQuality(btn.dataset.simQuality); syncSettingsUI();
    }));
    $3('sim3dStartBtn')?.addEventListener('click', () => {
      resetGameSession(false);
      running = true;
      $3('sim3dStart').classList.add('hidden');
      hideSummaryOverlay();
      startAmbient();
      playSfx('start');
      canvas.requestPointerLock?.();
      message('La tienda ya está abierta. Gestiona el turno, atiende caja, repón stock y alcanza la meta del día.');
      tutorialIndex=0; showTutorialStep();
    });
    $3('sim3dReplayBtn')?.addEventListener('click', () => {
      const advance = Boolean(gameSession && gameSession.revenue >= gameSession.targetRevenue);
      resetGameSession(true, advance);
      rebuildDynamicWorld();
      running = true;
      hideSummaryOverlay();
      startAmbient();
      playSfx('start');
      canvas.requestPointerLock?.();
      message(`${advance ? 'Nuevo día desbloqueado' : 'Día reiniciado'}. Bienvenida al Día ${gameSession?.day || 1}.`);
    });
    $3('sim3dSummaryLobbyBtn')?.addEventListener('click', () => {
      hideSummaryOverlay();
      stopAmbient();
      if (typeof window.showScreen === 'function') window.showScreen('studentLobby');
    });
    $3('sim3dAudioBtn')?.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      localStorage.setItem(audioKey(), audioEnabled ? '1' : '0');
      loadAudioSetting();
      if (audioEnabled) { ensureAudio(); startAmbient(); playTone(520, 0.08, 'triangle', 0.03, 0); }
      else stopAmbient();
    });
    $3('adminCloseBtn')?.addEventListener('click', closeAdmin);
    document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b===btn));
      document.querySelectorAll('[data-admin-page]').forEach(pg=>pg.classList.toggle('active',pg.dataset.adminPage===btn.dataset.adminTab));
      refreshAdminUI();
    }));
    $3('savePricesBtn')?.addEventListener('click',()=>{
      PRODUCTS.forEach(p=>{
        const el=$3(`price-${p.id}-input`); const min=p.id==='esencial'?40:p.id==='urbano'?50:70; const max=p.id==='premium'?450:300;
        const v=Math.max(min,Math.min(max,Number(el?.value)||p.price)); p.price=Math.round(v); businessState.prices[p.id]=p.price;
      });
      saveBusinessState(); renderInventoryDisplays(); refreshAdminUI(); updateHUD(); addBusinessLog('Precios de venta actualizados.'); message('Precios actualizados. La demanda responderá a los nuevos valores.');
    });
    $3('orderStockBtn')?.addEventListener('click',orderSupplierStock);
    $3('upgradeDisplayBtn')?.addEventListener('click',()=>buyUpgrade('display',650,3));
    $3('upgradeCheckoutBtn')?.addEventListener('click',()=>buyUpgrade('checkout',1200,1));
    $3('upgradeWarehouseBtn')?.addEventListener('click',()=>buyUpgrade('warehouse',1500,2));
    document.querySelectorAll('[data-quality]').forEach(btn=>btn.addEventListener('click',()=>setGraphicsQuality(btn.dataset.quality)));
    $3('tutorialNextBtn')?.addEventListener('click',nextTutorial);
    $3('sim3dDecisionsBtn')?.addEventListener('click', openDecisionsFrom3D);
    $3('sim3dLobbyBtn')?.addEventListener('click', () => {
      running = false;
      document.exitPointerLock?.();
      stopAmbient();
      if (typeof window.showScreen === 'function') window.showScreen('studentLobby');
    });
    window.addEventListener('resize', resize);
  }

  async function init() {
    if (initialized) return true;
    if (!await loadThree()) return false;
    loadBusinessState();
    await loadModelAssets();
    buildStaticWorld();
    loadAudioSetting();
    clock = new THREE.Clock();
    bind();
    initialized = true;
    resize();
    rebuildDynamicWorld();
    syncSalesFromLedger();
    camera.position.set(player.x, player.y, player.z);
    frame();
    return true;
  }

  async function prepare() { return await init(); }

  async function enter(options = {}) {
    if (bridge().canStartSimulation && !bridge().canStartSimulation()) {
      if (typeof window.openDecisionMenu === 'function') window.openDecisionMenu();
      if (typeof window.toast === 'function') window.toast('Completa y envía las decisiones obligatorias antes de entrar al simulador 3D.');
      return false;
    }
    if (typeof window.loadDecisionState === 'function') window.loadDecisionState();
    if (!await init()) return false;
    const autoStart = options === true || Boolean(options?.autoStart);
    if (typeof window.showScreen === 'function') window.showScreen(rootId);
    document.querySelector('.sim3d-brand strong') && (document.querySelector('.sim3d-brand strong').textContent = companyName());
    document.querySelector('.receipt-brand') && (document.querySelector('.receipt-brand').textContent = companyName());
    document.querySelector('.sim-checkout-kicker') && (document.querySelector('.sim-checkout-kicker').textContent = `CAJA ${companyName().toUpperCase()}`);
    document.querySelector('.mini-title') && (document.querySelector('.mini-title').textContent = companyName());
    document.querySelector('.admin-head h2') && (document.querySelector('.admin-head h2').textContent = `${companyName()} · Panel operativo`);
    if ($3('sim3dStartBtn')) $3('sim3dStartBtn').textContent = `ABRIR ${companyName().toUpperCase()}`;
    if (autoStart) $3('sim3dStart')?.classList.add('hidden');
    resetGameSession(false);
    running = autoStart || $3('sim3dStart')?.classList.contains('hidden') || false;
    keys = {};
    player.x = 0; player.z = 11.4; player.y = player.baseY; player.vx = 0; player.vz = 0; player.vy = 0; player.grounded = true; player.bob = 0; yaw = 0; pitch = -0.04; targetYaw = yaw; targetPitch = pitch;
    rebuildDynamicWorld();
    syncSalesFromLedger();
    updateHUD();
    clock.getDelta();
    if (autoStart) { startAmbient(); playSfx('start'); message(`${companyName()} está abierta. Haz clic dentro del juego para controlar la cámara y completar el turno.`); }
    setTimeout(() => { resize(); $3('side3dCanvas')?.focus?.(); }, 40);
    return true;
  }

  function returnFromDecisions() {
    if (typeof window.loadDecisionState === 'function') window.loadDecisionState();
    if (typeof window.showScreen === 'function') window.showScreen(rootId);
    rebuildDynamicWorld();
    syncSalesFromLedger();
    if (!gameSession) resetGameSession(false);
    running = true;
    startAmbient();
    clock?.getDelta();
    message('Cambios aplicados: la boutique, el taller y la atención en caja fueron actualizados con tus decisiones.');
  }

  window.SIDE3D = { prepare, enter, returnFromDecisions, rebuild: rebuildDynamicWorld };
})();
