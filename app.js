// ===== SHEETS/SUPABASE — funciones definidas en supabase_sync.js =====
// sheetsEnviar, sheetsImportar, sheetsExportarTodo, etc. → supabase_sync.js

// ===== FIN SHEETS/SUPABASE (todo en supabase_sync.js) =====

/* =====================================================================
   DESPENSA ECONÓMICA — Motor IndexedDB
   Migración automática desde localStorage si hay datos previos.
   Todos los datos se guardan en IndexedDB. localStorage ya no se usa.
   ===================================================================== */

const APP_SCHEMA_VERSION = 4;
const DB_NAME    = 'DespensaEconomicaDB';
const DB_VERSION = 2;          // v2: agrega object store offline_queue
const KV_STORE   = 'kv';
const OQ_STORE   = 'offline_queue'; // cola de operaciones pendientes sin conexión

// ===== 1. CAPA IndexedDB =====

let _db = null;
let _dbPromise = null; // evitar múltiples opens simultáneos

function getDB() {
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;
  _dbPromise = _abrirIDB(0).then(db => { _dbPromise = null; return db; })
                             .catch(e => { _dbPromise = null; throw e; });
  return _dbPromise;
}

function _setupUpgrade(db) {
  if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
  if (!db.objectStoreNames.contains(OQ_STORE)) {
    const s = db.createObjectStore(OQ_STORE, { keyPath: 'id' });
    s.createIndex('by_ts', 'ts', { unique: false });
  }
}

function _abrirIDB(intento) {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch(e) { return reject(e); }

    req.onupgradeneeded = (e) => {
      try { _setupUpgrade(e.target.result); } catch(ue) {}
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      // Al detectar que otra pestaña quiere actualizar la versión → cerrar limpiamente
      _db.onversionchange = () => { _db.close(); _db = null; };
      // Al detectar error inesperado en transacción → resetear
      _db.onerror = () => { _db = null; };
      resolve(_db);
    };

    req.onerror = (e) => {
      const msg = (e.target.error || {}).message || 'error desconocido';
      console.warn('[IDB] Error intento ' + intento + ':', msg);
      if (intento < 4) {
        setTimeout(() => _abrirIDB(intento + 1).then(resolve).catch(reject), 500 * (intento + 1));
      } else {
        // Último recurso: borrar la BD corrupta y empezar de cero
        console.warn('[IDB] Intentando recuperación — borrando BD...');
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = () => _abrirIDB(0).then(resolve).catch(reject);
        del.onerror   = () => reject(e.target.error);
      }
    };

    req.onblocked = () => {
      console.warn('[IDB] Bloqueado intento ' + intento + ' — esperando cierre de pestaña anterior...');
      // Esperar más tiempo porque hay otra pestaña/tab con la BD abierta
      if (intento < 6) {
        setTimeout(() => _abrirIDB(intento + 1).then(resolve).catch(reject), 800 * (intento + 1));
      } else {
        reject(new Error('IDB bloqueado persistente'));
      }
    };
  });
}

async function idbGet(key) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const req = db.transaction(KV_STORE, 'readonly').objectStore(KV_STORE).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

async function idbSet(key, value) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const req = db.transaction(KV_STORE, 'readwrite').objectStore(KV_STORE).put(value, key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function idbSetMany(entries) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx    = db.transaction(KV_STORE, 'readwrite');
    const store = tx.objectStore(KV_STORE);
    entries.forEach(([k, v]) => store.put(v, k));
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

async function idbGetMany(keys) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx      = db.transaction(KV_STORE, 'readonly');
    const store   = tx.objectStore(KV_STORE);
    const results = {};
    let pending   = keys.length;
    if (!pending) { res(results); return; }
    keys.forEach(k => {
      const req = store.get(k);
      req.onsuccess = () => {
        results[k] = req.result;
        if (--pending === 0) res(results);
      };
      req.onerror = () => rej(req.error);
    });
  });
}

// ===== 1b. COLA OFFLINE — operaciones pendientes cuando no hay internet =====

async function oqPush(operacion, datos) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const entry = { id: 'oq_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), ts: Date.now(), operacion, datos };
    const req = db.transaction(OQ_STORE, 'readwrite').objectStore(OQ_STORE).add(entry);
    req.onsuccess = () => res(entry.id);
    req.onerror   = () => rej(req.error);
  });
}

async function oqGetAll() {
  const db = await getDB();
  return new Promise((res, rej) => {
    const req = db.transaction(OQ_STORE, 'readonly').objectStore(OQ_STORE).index('by_ts').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}

async function oqDelete(id) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const req = db.transaction(OQ_STORE, 'readwrite').objectStore(OQ_STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function oqCount() {
  const db = await getDB();
  return new Promise((res, rej) => {
    const req = db.transaction(OQ_STORE, 'readonly').objectStore(OQ_STORE).count();
    req.onsuccess = () => res(req.result || 0);
    req.onerror   = () => rej(req.error);
  });
}

async function migrarDesdeLocalStorage() {
  // Si ya migramos antes, no repetir
  const yaMigrado = await idbGet('_migrated_from_ls');
  if (yaMigrado) return false;

  const lsKeys = [
    'vpos_productos','vpos_ventasDia','vpos_ventasSem','vpos_ventasMes',
    'vpos_historial','vpos_pagos','vpos_ventasDiarias','vpos_restockLog',
    'vpos_efectivoInicial','vpos_inventarioInicial',
    'vpos_ultimoBackup','vpos_pagina','vpos_tabGasto','vpos_schemaVersion'
  ];

  const hayDatos = lsKeys.some(k => localStorage.getItem(k) !== null);
  if (!hayDatos) {
    // Sin datos en LS, marcar igual para no volver a intentar
    await idbSet('_migrated_from_ls', true);
    return false;
  }

  setLoadingMsg('Migrando datos desde almacenamiento anterior…');

  const entries = [['_migrated_from_ls', true]];
  lsKeys.forEach(k => {
    const raw = localStorage.getItem(k);
    if (raw === null) return;
    try {
      entries.push([k, JSON.parse(raw)]);
    } catch {
      entries.push([k, raw]);
    }
  });

  await idbSetMany(entries);

  // Limpiar localStorage después de migración exitosa
  lsKeys.forEach(k => localStorage.removeItem(k));
  localStorage.setItem('vpos_migrated_to_idb', '1');

  console.log('[IDB] Migración desde localStorage completada.');
  return true;
}

// ===== VALIDACIÓN DE FECHA DE REPORTES =====
// ventasDia/Sem/Mes se guardan en IDB sin fecha. Si el dispositivo
// no se usó en un día, al abrir mostraría datos viejos.
// Esta función valida y resetea los reportes si el período cambió.

function _validarFechaReportes() {
  const ahora    = new Date();
  const hoyStr   = ahora.toDateString();           // "Mon Jan 06 2025"
  const mesStr   = ahora.getFullYear() + '-' + ahora.getMonth(); // "2025-0"
  const lunesStr = _lunesDeLaSemanaStr();

  const guardado = {
    dia:  localStorage.getItem('vpos_reporteFechaDia'),
    sem:  localStorage.getItem('vpos_reporteFechaSem'),
    mes:  localStorage.getItem('vpos_reporteFechaMes'),
  };

  let cambio = false;
  if (guardado.dia !== hoyStr) {
    ventasDia = {};
    localStorage.setItem('vpos_reporteFechaDia', hoyStr);
    // ── FIX: nuevo día natural → limpiar timestamp de reset manual ──
    localStorage.removeItem('vpos_reinicioDiaTs');
    localStorage.removeItem('vpos_reinicioDiaFecha');
    cambio = true;
    console.log('[Fecha] Nuevo día — ventasDia reseteado');
  }
  if (guardado.sem !== lunesStr) {
    ventasSem = {};
    localStorage.setItem('vpos_reporteFechaSem', lunesStr);
    cambio = true;
    console.log('[Fecha] Nueva semana — ventasSem reseteado');
  }
  if (guardado.mes !== mesStr) {
    ventasMes = {};
    localStorage.setItem('vpos_reporteFechaMes', mesStr);
    cambio = true;
    console.log('[Fecha] Nuevo mes — ventasMes reseteado');
  }
  return cambio;
}

function _lunesDeLaSemanaStr() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toDateString();
}

// Recalcular ventasDia/Sem/Mes desde el historial en memoria (fuente de verdad)
// ── FIX: helper para leer el timestamp del último reset manual del día ──
function _getReinicioDiaTs() {
  const ts    = localStorage.getItem('vpos_reinicioDiaTs');
  const fecha = localStorage.getItem('vpos_reinicioDiaFecha');
  // Solo aplica si el reset fue hoy (no de un día anterior)
  if (!ts || !fecha || fecha !== new Date().toDateString()) return null;
  return new Date(ts);
}

function _recalcularReportesDesdeHistorial() {
  const ahora      = new Date();
  const hoy        = ahora.toDateString();
  const lunes      = typeof _lunesDeLaSemana === 'function' ? _lunesDeLaSemana() : new Date();
  // ── FIX: respetar corte del reset manual ──
  const resetTs    = _getReinicioDiaTs();
  ventasDia = {}; ventasSem = {}; ventasMes = {};
  (historial || []).forEach(v => {
    if (!v.fechaISO && !v.fecha) return;
    const fecha  = new Date(v.fechaISO || v.fecha);
    const esHoy  = fecha.toDateString() === hoy;
    const esSem  = fecha >= lunes;
    const esMes  = fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
    // Si hay reset manual hoy, ignorar ventas anteriores al corte en ventasDia
    const pasaCorte = !esHoy || !resetTs || fecha >= resetTs;
    (v.items || []).forEach(it => {
      const pid  = String(it.id || ''); if (!pid || pid === 'null') return;
      const cant = Number(it.cant || 0);
      const tot  = cant * Number(it.precio || 0);
      const base = { id: pid, nom: it.nom || '', cat: it.cat || '', cant: 0, total: 0 };
      if (esHoy && pasaCorte) { if (!ventasDia[pid]) ventasDia[pid] = {...base}; ventasDia[pid].cant += cant; ventasDia[pid].total += tot; }
      if (esSem) { if (!ventasSem[pid]) ventasSem[pid] = {...base}; ventasSem[pid].cant += cant; ventasSem[pid].total += tot; }
      if (esMes) { if (!ventasMes[pid]) ventasMes[pid] = {...base}; ventasMes[pid].cant += cant; ventasMes[pid].total += tot; }
    });
  });
  if (typeof normalizeReport === 'function') {
    ventasDia = normalizeReport(ventasDia);
    ventasSem = normalizeReport(ventasSem);
    ventasMes = normalizeReport(ventasMes);
  }
}

let productos     = [];
let ventasDia     = {};
let ventasSem     = {};
let ventasMes     = {};
let historial     = [];
let pagos         = [];
let ventasDiarias = [];
let restockLog    = []; // registro de entradas de stock para fusión correcta
let carrito       = [];
let cobroDigits   = '';
let productosEliminados = []; // IDs de productos borrados — evita que vuelvan al fusionar
let pagosEliminados     = []; // IDs de pagos/gastos borrados — evita que vuelvan desde Supabase

let efectivoInicial   = 0;
let inventarioInicial = 0;
let tabGasto          = 'mes';
let _paginaActual     = 'pgDash';
let _ultimoBackup     = null;
let _backupNum        = 0;    // contador auto-incremental de backups
let _datosAFusionar   = null;

let facturaNum    = 0;  // contador de facturas digitales

let _destPeriodo = 'semana1';
const PERIODOS_DEST = {
  semana1: { label: 'Última semana',   dias: 7  },
  semana2: { label: 'Últimas 2 semanas', dias: 14 },
  semana3: { label: 'Últimas 3 semanas', dias: 21 },
  mes:     { label: 'Último mes',       dias: 30 }
};

// ===== 4. PERSISTENCIA =====

let _salvarTimer = null;
function salvar(doRender = true) {
  clearTimeout(_salvarTimer);
  _salvarTimer = setTimeout(() => {
    // ── 1. Supabase: tablas individuales (ventas, productos, pagos…) ──
    if (typeof syncAhora === 'function') syncAhora('todo');

    // ── 2. Snapshot automático — mismo mecanismo que "Enviar mis datos" ──
    if (typeof _autoEnviarSnapshot === 'function') _autoEnviarSnapshot();

    // ── 3. IDB como caché offline en paralelo ──
    const _ahora = new Date();
    // Actualizar marcas de fecha para que _validarFechaReportes sepa que estos datos son de hoy
    localStorage.setItem('vpos_reporteFechaDia', _ahora.toDateString());
    localStorage.setItem('vpos_reporteFechaMes', _ahora.getFullYear() + '-' + _ahora.getMonth());
    idbSetMany([
      ['vpos_productos',           productos],
      ['vpos_ventasDia',           ventasDia],
      ['vpos_ventasSem',           ventasSem],
      ['vpos_ventasMes',           ventasMes],
      ['vpos_historial',           historial],
      ['vpos_pagos',               pagos],
      ['vpos_ventasDiarias',       ventasDiarias],
      ['vpos_restockLog',          restockLog],
      ['vpos_productosEliminados', productosEliminados],
      ['vpos_pagosEliminados',     pagosEliminados],
    ]).catch(err => {
      console.warn('[IDB caché] Error:', err);
    });
  }, 80);

  if (doRender) actualizarTodo();
}

function salvarSesion() {
  idbSet('vpos_tabGasto', tabGasto).catch(console.error);
  const pg = document.querySelector('.page.active');
  if (pg) {
    _paginaActual = pg.id;
    idbSet('vpos_pagina', pg.id).catch(console.error);
  }
}

// ===== 5. CARGA =====

// Carga datos de sesión/UI desde IDB (no van a Supabase)
async function _cargarMetadatosIDB() {
  const keys = [
    'vpos_efectivoInicial','vpos_inventarioInicial',
    'vpos_ultimoBackup','vpos_backupNum','vpos_pagina','vpos_tabGasto',
    'vpos_facturaNum'
  ];
  const data = await idbGetMany(keys);

  const ef = data['vpos_efectivoInicial'];
  efectivoInicial   = (ef !== undefined && ef !== null) ? parseFloat(ef) || 0 : 0;
  const inv = data['vpos_inventarioInicial'];
  inventarioInicial = (inv !== undefined && inv !== null) ? parseFloat(inv) || 0 : 0;
  _ultimoBackup = data['vpos_ultimoBackup'] || null;
  _backupNum    = Number(data['vpos_backupNum'] || 0);
  facturaNum    = Number(data['vpos_facturaNum'] || 0);
  _paginaActual = data['vpos_pagina']       || 'pgDash';
  tabGasto      = data['vpos_tabGasto']     || 'mes';
}

// Carga caché IDB como fallback offline (datos de negocio)
async function _cargarCacheIDB() {
  const keys = [
    'vpos_productos','vpos_ventasDia','vpos_ventasSem','vpos_ventasMes',
    'vpos_historial','vpos_pagos','vpos_ventasDiarias','vpos_restockLog',
    'vpos_productosEliminados','vpos_pagosEliminados'
  ];
  const data = await idbGetMany(keys);
  productos             = data['vpos_productos']           || [];
  ventasDia             = data['vpos_ventasDia']           || {};
  ventasSem             = data['vpos_ventasSem']           || {};
  ventasMes             = data['vpos_ventasMes']           || {};
  historial             = data['vpos_historial']           || [];
  pagos                 = data['vpos_pagos']               || [];
  ventasDiarias         = data['vpos_ventasDiarias']       || [];
  restockLog            = data['vpos_restockLog']          || [];
  productosEliminados   = data['vpos_productosEliminados'] || [];
  pagosEliminados       = data['vpos_pagosEliminados']     || [];
  ventasDia = normalizeReport(ventasDia);
  ventasSem = normalizeReport(ventasSem);
  ventasMes = normalizeReport(ventasMes);
  historial = normalizeHistorial(historial);
  pagos     = normalizePagos(pagos);

  // Validar fechas: si cambió el día/semana/mes, resetear el reporte correspondiente
  // Esto evita que aparezcan datos de ayer en la pantalla al abrir la app
  _validarFechaReportes();
}

async function cargarDatos() {
  // 1. Metadatos de sesión/UI siempre desde IDB (rápido, no van a Supabase)
  await _cargarMetadatosIDB();

  // 2. Si hay sesión activa → cargar datos desde Supabase (fuente de verdad)
  //    Si Supabase falla o no hay sesión → usar caché IDB como fallback
  const tieneSupabase = typeof _sbUrl === 'function' && _sbUrl() && _sbKey();
  const tieneSesion   = typeof _sesionActiva !== 'undefined' && _sesionActiva;

  if (tieneSupabase && tieneSesion) {
    try {
      // Supabase cargará los datos en _autoCargarDesdeSupa() al restaurar sesión.
      // Aquí precargamos IDB para que la UI no quede vacía mientras llega Supabase.
      await _cargarCacheIDB();
      console.log('[Carga] Cache IDB mostrado — Supabase cargará en segundo plano.');
    } catch(e) {
      console.warn('[Carga] Error leyendo caché IDB, UI vacía hasta que llegue Supabase:', e.message);
    }
  } else {
    // Sin sesión todavía: mostrar caché IDB (o vacío si primera vez)
    await _cargarCacheIDB();
  }

  // Persistir versión de schema
  idbSet('vpos_schemaVersion', String(APP_SCHEMA_VERSION)).catch(console.error);
}

async function migrateAndLoad() {
  await migrarDesdeLocalStorage();
  await cargarDatos();
}

// ===== 6. HELPERS GENERALES =====

function nowISO() { return new Date().toISOString(); }
// ===== SONIDO DE CARRITO (Web Audio API — sin archivos externos) =====
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
function sonidoCarrito() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    // Sonido de lector de código de barras:
    // Beep corto, agudo, con ataque casi instantáneo y caída rápida
    // Un solo tono puro ~1900Hz, duración ~80ms — igual que un lector Honeywell/Zebra
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';              // onda cuadrada: más "electrónico" que sine
    osc.frequency.setValueAtTime(1900, t);

    // Envolvente: ataque 2ms, sostenido 70ms, caída 15ms
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.002);
    gain.gain.setValueAtTime(0.28, t + 0.072);
    gain.gain.linearRampToValueAtTime(0, t + 0.087);

    osc.start(t);
    osc.stop(t + 0.09);
  } catch(e) {}
}
// ===== ACTUALIZACIÓN RÁPIDA DE STOCK EN TABLA (sin rerenderizar todo) =====
function actualizarStockFila(p) {
  // Solo si la página de inventario está visible
  const tbody = document.getElementById('tbodyInv');
  if (!tbody || !document.getElementById('pgInventario')?.classList.contains('active')) return;
  // Buscar la fila por el botón que tiene el id del producto
  const btns = tbody.querySelectorAll('button[onclick]');
  for (const btn of btns) {
    if (btn.getAttribute('onclick')?.includes(`editarProd(${p.id})`)) {
      const row = btn.closest('tr');
      if (!row) break;
      // Actualizar solo la celda de stock (columna 7, índice 6)
      const critico = (p.stock || 0) <= (p.min || 0);
      const celdaStock = row.cells[6];
      if (celdaStock) {
        celdaStock.innerHTML = critico
          ? `<span class="badge badge-red">! ${p.stock || 0}</span>`
          : `<span class="badge badge-green">${p.stock || 0}</span>`;
        if (critico) row.classList.add('row-critico');
      }
      // Actualizar celda de valor (columna 8, índice 7)
      const celdaVal = row.cells[7];
      if (celdaVal) celdaVal.innerHTML = `<span class="mono td-green" style="font-weight:900;">$${((p.venta||0)*(p.stock||0)).toFixed(2)}</span>`;
      break;
    }
  }
}

// ===== PANEL DE CAJA =====
function renderCajaPanel() {
  const grid    = document.getElementById('cajaGridPrincipal');
  const flujo   = document.getElementById('cajaFlujoMes');
  const balance = document.getElementById('cajaBalanceFinal');
  const fecha   = document.getElementById('cajaPanelFecha');
  if (!grid) return;

  // ── Datos base ──────────────────────────────────────────────────────────────
  const ahora              = new Date();
  const diasMes            = new Date(ahora.getFullYear(), ahora.getMonth()+1, 0).getDate();
  const diaActual          = ahora.getDate();
  const mesNombre          = ahora.toLocaleDateString('es-SV', {month:'long', year:'numeric'});
  const hoyISO             = ahora.toISOString().split('T')[0]; // "YYYY-MM-DD"

  // Inventario actual
  const { compra: invCompra, venta: invVenta } = calcValorInventario();

  // Ventas acumuladas del mes (del POS)
  const ventasMesTotal     = totalReporte(ventasMes);
  // Ventas de hoy (POS)
  const ventasHoyTotal     = totalReporte(ventasDia);

  // ── FUENTE ÚNICA DE VERDAD PARA CAPITAL: ventasDiarias ──
  // El historial y ventasDia son contadores de reporte — NUNCA tocan cajaActual ni capitalTotal
  const ventaDiariaHoy     = (ventasDiarias || []).find(v => v.fecha === hoyISO);
  const hoyYaRegistrado    = !!ventaDiariaHoy;
  const ventasHoyEnCaja    = hoyYaRegistrado ? Number(ventaDiariaHoy.monto || 0) : 0;
  // Suma de todos los días registrados formalmente en el mes actual
  const totalVentasDiariasDelMes = (ventasDiarias || [])
    .filter(v => esMesActual(v.fecha + 'T00:00:00'))
    .reduce((s, v) => s + Number(v.monto || 0), 0);
  // entroACaja = ventas confirmadas del mes (para mostrar en panel de flujo)
  const entroACaja         = totalVentasDiariasDelMes;

  // Promedio diario basado en días con ventas registradas
  const diasConVentas      = (ventasDiarias || []).filter(v => esMesActual(v.fecha + 'T00:00:00')).length;
  const promedioDiario     = diasConVentas > 0
    ? (ventasDiarias || []).filter(v => esMesActual(v.fecha + 'T00:00:00')).reduce((s,v) => s + Number(v.monto||0), 0) / diasConVentas
    : (ventasMesTotal > 0 && diaActual > 0 ? ventasMesTotal / diaActual : 0);

  // Gastos del mes (facturas + pagos)
  const gastosMes          = pagos.filter(g => esMesActual(g.fechaISO));
  const totalFacturas      = gastosMes.filter(g => g.cat === 'FACTURA').reduce((s,g) => s + Number(g.monto||0), 0);
  const totalGastosOtros   = gastosMes.filter(g => g.cat === 'GASTO').reduce((s,g) => s + Number(g.monto||0), 0);
  const totalEgresos       = totalFacturas + totalGastosOtros;

  // Inventario: lo que salió (a precio compra) vs lo que entró a caja
  const invSalido          = invCompra > 0
    ? Math.max(0, inventarioInicial - invCompra)   // reducción del valor de inventario
    : 0;

  // Caja actual = efectivo inicial + ventas formalmente registradas por día - egresos
  // El historial de cobros NO se suma aquí — ya está capturado en ventasDiarias al registrar cada día
  const cajaActual         = efectivoInicial + totalVentasDiariasDelMes - totalEgresos;

  const salioDeCaja        = totalEgresos;

  const comprasMes         = pagos.filter(g => esMesActual(g.fechaISO) && g.cat === 'COMPRA')
                               .reduce((s,g) => s + Number(g.monto||0), 0);
  // 📊 CAPITAL TOTAL = Caja (ef. inicial + ventasDiarias del mes − egresos) + Inventario a precio venta
  // Fuente única: ventasDiarias. Historial y ventasDia = solo reportes, nunca inflan el capital.
  const capitalTotal       = cajaActual + invVenta;
  const capitalInicial     = efectivoInicial + inventarioInicial;
  const ganancia           = capitalTotal - capitalInicial;
  const esGanancia         = ganancia >= 0;

  // Proyección al cierre del mes
  const proyeccionMes      = promedioDiario * diasMes;
  const diasRestantes      = diasMes - diaActual;

  // ── Actualizar fecha ────────────────────────────────────────────────────────
  if (fecha) fecha.textContent = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

  // ── Grid principal: 4 celdas clave ─────────────────────────────────────────
  const hoyPendienteTxt = !hoyYaRegistrado && ventasHoyTotal > 0
    ? `<div style="margin-top:5px;background:rgba(217,119,6,0.12);border:1px solid rgba(217,119,6,0.35);border-radius:7px;padding:4px 8px;font-size:11px;font-weight:800;color:#92400e;">⏳ Hoy $${ventasHoyTotal.toFixed(2)} pendiente — registra en Ventas por Día</div>`
    : (hoyYaRegistrado ? `<div style="margin-top:5px;background:rgba(22,163,74,0.10);border:1px solid rgba(22,163,74,0.3);border-radius:7px;padding:4px 8px;font-size:11px;font-weight:800;color:var(--green-dark);">✅ Hoy registrado: $${ventasHoyEnCaja.toFixed(2)}</div>` : '');

  grid.innerHTML = `
    <div class="caja-celda destacado positivo">
      <div class="caja-celda-lbl">💵 Dinero en Caja</div>
      <div class="caja-celda-val">$${cajaActual.toFixed(2)}</div>
      <div class="caja-celda-sub">Inicial $${efectivoInicial.toFixed(2)} + ventas confirmadas − gastos</div>
      ${hoyPendienteTxt}
    </div>
    <div class="caja-celda neutro">
      <div class="caja-celda-lbl">📦 Valor Inventario</div>
      <div class="caja-celda-val">$${invVenta.toFixed(2)}</div>
      <div class="caja-celda-sub">Precio venta × stock actual<br>A precio compra: $${invCompra.toFixed(2)}</div>
    </div>
    <div class="caja-celda positivo">
      <div class="caja-celda-lbl">📈 Entró a Caja</div>
      <div class="caja-celda-val">$${entroACaja.toFixed(2)}</div>
      <div class="caja-celda-sub">Ventas confirmadas del mes${hoyYaRegistrado ? ' · Hoy: $'+ventasHoyEnCaja.toFixed(2) : (ventasHoyTotal > 0 ? ' · Hoy aún sin registrar' : '')}</div>
    </div>
    <div class="caja-celda ${totalEgresos > 0 ? 'negativo' : 'neutro'}">
      <div class="caja-celda-lbl">📤 Salió de Caja</div>
      <div class="caja-celda-val">$${totalEgresos.toFixed(2)}</div>
      <div class="caja-celda-sub">Facturas $${totalFacturas.toFixed(2)} · Gastos $${totalGastosOtros.toFixed(2)}</div>
    </div>
  `;

  // ── Flujo del mes ───────────────────────────────────────────────────────────
  // Los componentes (efectivo inicial, inv. inicial, ventas, facturas) calculan
  // internamente pero solo mostramos los resultados finales
  flujo.innerHTML = `
    <div class="flujo-item" style="border-color:var(--border-mid);background:var(--green-light);">
      <div class="flujo-icono">💵</div>
      <div class="flujo-info">
        <div class="flujo-lbl">Caja Actual</div>
        <div class="flujo-val pos">$${cajaActual.toFixed(2)}</div>
      </div>
    </div>
    ${promedioDiario > 0 ? `
    <div class="flujo-item" style="border-color:#ddd6fe;background:#faf5ff;">
      <div class="flujo-icono">📅</div>
      <div class="flujo-info">
        <div class="flujo-lbl">Prom. diario</div>
        <div class="flujo-val" style="color:#7c3aed;">$${promedioDiario.toFixed(2)}</div>
      </div>
    </div>
    <div class="flujo-item" style="border-color:#ddd6fe;background:#faf5ff;">
      <div class="flujo-icono">🔮</div>
      <div class="flujo-info">
        <div class="flujo-lbl">Proyección mes</div>
        <div class="flujo-val" style="color:#7c3aed;">$${proyeccionMes.toFixed(2)}</div>
      </div>
    </div>` : ''}
  `;

  // ── Balance y resultado ─────────────────────────────────────────────────────
  balance.innerHTML = `
    <div>
      <div style="font-size:12px;font-weight:900;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">📊 Capital Total</div>
      <div style="font-family:'Space Mono',monospace;font-size:24px;font-weight:700;color:#0369a1;">$${capitalTotal.toFixed(2)}</div>
      <div style="font-size:11px;color:var(--text-muted);font-weight:700;margin-top:3px;">💵 Caja actual + 📦 Inventario actual (precio venta)</div>
    </div>
    <div class="balance-resultado">
      ${capitalInicial > 0 ? `
      <div style="text-align:center;">
        <div style="font-size:10px;font-weight:900;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">vs. Capital Inicial</div>
        <div class="balance-badge ${esGanancia ? 'pos' : 'neg'}">
          ${esGanancia ? '✅' : '🔴'} ${esGanancia ? 'GANANCIA' : 'PÉRDIDA'}: ${esGanancia ? '+' : ''}$${ganancia.toFixed(2)}
        </div>
        <div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-top:4px;">Capital inicial: $${capitalInicial.toFixed(2)}</div>
      </div>` : `<div style="font-size:12px;color:var(--text-muted);font-weight:700;">Ingresa efectivo e inventario inicial<br>en la sección Inventario para ver ganancia</div>`}
    </div>
  `;
}

// ===== DEBOUNCE HELPERS =====
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
const debounceBuscarV    = debounce(buscarV, 120);
const debounceRenderInv  = debounce(renderInv, 180);

// ===== requestAnimationFrame wrapper para renders costosos =====
function rafRender(fn) {
  if (window.requestAnimationFrame) requestAnimationFrame(fn);
  else fn();
}
function nowTS()  { return Date.now(); }
function uid() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : String(Date.now()) + '_' + Math.random().toString(16).slice(2);
}
function fmtP(n) {
  if (!n && n !== 0) return '0.00';
  const s = parseFloat(n).toFixed(3);
  return s.endsWith('0') ? parseFloat(n).toFixed(2) : s;
}
function hoyStr() {
  return new Date().toLocaleDateString('es-SV').replace(/\//g, '-');
}
function autoBackup(motivo) {
  // Solo actualiza el timestamp — las descargas automáticas están desactivadas
  // Para hacer backup manual usa el botón "Exportar" en la barra de respaldo
  setTimeout(() => {
    _backupNum += 1;
    idbSet('vpos_backupNum', _backupNum).catch(console.error);
    _ultimoBackup = nowISO();
    idbSet('vpos_ultimoBackup', _ultimoBackup).catch(console.error);
    actualizarSubtituloBackup();
  }, 400);
}

function descargarJSON(datos, filename) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function toast(msg, err = false, info = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : info ? ' info' : '');
  setTimeout(() => t.className = 'toast', 2600);
}
function esHoy(fechaISO) {
  try { const f = new Date(fechaISO); return f.toDateString() === new Date().toDateString(); }
  catch { return false; }
}
function esMesActual(fechaISO) {
  try {
    const f = new Date(fechaISO), n = new Date();
    return f.getMonth() === n.getMonth() && f.getFullYear() === n.getFullYear();
  } catch { return false; }
}
function isProbablyProductIdKey(k) {
  return /^[0-9]{9,}$/.test(String(k));
}

// ===== 7. NORMALIZACIÓN DE DATOS =====

function normalizeReport(reportObj) {
  const out = {};
  for (const k in (reportObj || {})) {
    const v = reportObj[k] || {};
    if (isProbablyProductIdKey(k)) {
      const pid = String(k);
      out[pid] = {
        id:    pid,
        nom:   v.nom   || (productos.find(p => String(p.id) === pid)?.nom) || '—',
        cat:   v.cat   || (productos.find(p => String(p.id) === pid)?.cat) || '',
        cant:  Number(v.cant  || 0),
        total: Number(v.total || 0)
      };
    } else {
      const name = String(k);
      const p    = productos.find(x => (x.nom || '') === name);
      if (p) {
        const pid = String(p.id);
        if (!out[pid]) out[pid] = { id: pid, nom: p.nom, cat: p.cat, cant: 0, total: 0 };
        out[pid].cant  += Number(v.cant  || 0);
        out[pid].total += Number(v.total || 0);
      } else {
        const lid = 'legacy:' + name;
        out[lid] = { id: lid, nom: name, cat: v.cat || 'SIN CATEGORÍA', cant: Number(v.cant || 0), total: Number(v.total || 0), legacy: true };
      }
    }
  }
  return out;
}

function normalizeHistorial(hist) {
  const out = (hist || []).map(v => {
    const id       = v.id || uid();
    const fechaISO = v.fechaISO || null;
    const ts       = Number(v.ts || (fechaISO ? Date.parse(fechaISO) : 0) || 0);
    const items    = (v.items || []).map(it => {
      const pid = it.id ? String(it.id) : null;
      if (pid) return { ...it, id: String(it.id) };
      const p = productos.find(p => p.nom === it.nom);
      return { ...it, id: p ? String(p.id) : null };
    });
    return {
      ...v, id, fechaISO, ts,
      fechaStr: v.fechaStr || v.fecha || (fechaISO ? new Date(fechaISO).toLocaleString('es-SV') : '—'),
      items
    };
  });
  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}

function normalizePagos(p) {
  const out = (p || []).map(g => ({
    ...g,
    id:       g.id || Date.now(),
    fechaISO: g.fechaISO || g.fecha || nowISO(),
    ts:       Number(g.ts || (g.fechaISO ? Date.parse(g.fechaISO) : Date.parse(g.fecha || '')) || 0),
    fechaStr: g.fechaStr || (g.fechaISO ? new Date(g.fechaISO).toLocaleString('es-SV') : (g.fechaStr || '—'))
  }));
  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}

// ===== 8. UI — Loading & IDB Status =====

function setLoadingMsg(msg) {
  const el = document.getElementById('loadingMsg');
  if (el) el.textContent = msg;
}
function setLoadingBadge(msg) {
  const el = document.getElementById('loadingBadge');
  if (el) el.textContent = msg;
}
function ocultarOverlay() {
  const o = document.getElementById('appLoadingOverlay');
  if (!o) return;
  o.classList.add('hidden');
  setTimeout(() => { o.style.display = 'none'; }, 450);
}
function setIDBStatus(ok) {
  const dot  = document.getElementById('idbDot');
  const text = document.getElementById('idbStatusText');
  if (dot)  dot.classList.toggle('err', !ok);
  if (text) text.textContent = ok ? 'IDB ✓' : 'IDB ✗';
}

// ===== 9. NAVEGACIÓN =====

function navTo(pgId, pushHistory = true) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const pgEl = document.getElementById(pgId);
  if (!pgEl) return;
  pgEl.classList.add('active');
  const ids    = ['pgDash', 'pgInventario', 'pgReportes', 'pgDestacados', 'pgVentasDiarias', 'pgSync', 'pgAdmin', 'pgFinanzasMes','pgCierreDia'];
  const tabIdx = ids.indexOf(pgId);
  if (tabIdx >= 0) { const tabs = document.querySelectorAll('.nav-tab'); if (tabs[tabIdx]) tabs[tabIdx].classList.add('active'); }
  ['dniVenta', 'dniInventario', 'dniReportes', 'dniDestacados', 'dniVentasDiarias', 'dniSync', 'dniAdmin'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', ids[i] === pgId);
  });
  if (pgId === 'pgDestacados') renderDestacados();
  if (pgId === 'pgVentasDiarias') { initVentasDiarias(); renderVentasDiarias(); }
  if (pgId === 'pgAdmin' && typeof renderAdminPanel === 'function') renderAdminPanel();
  if (pgId === 'pgFinanzasMes' && typeof renderFinanzasMes === 'function') renderFinanzasMes(pgId);
  if (pgId === 'pgCierreDia' && typeof renderCierreDia === 'function') renderCierreDia(pgId);
  idbSet('vpos_pagina', pgId).catch(console.error);
  _paginaActual = pgId;
  renderPagina(pgId);
  actualizarStats();
  // Historia de navegación para botón atrás del móvil
  if (pushHistory) {
    try {
      history.pushState({ pgId }, '', '#' + pgId);
    } catch(e) {}
  }
}

// ===== BOTÓN ATRÁS DEL MÓVIL — navegar entre páginas sin cerrar la app =====
window.addEventListener('popstate', (e) => {
  // Si hay algún modal abierto, cerrarlo primero
  const openModal = document.querySelector('.modal.open');
  if (openModal) { openModal.classList.remove('open'); history.pushState({}, '', location.href); return; }
  const pgId = e.state?.pgId || 'pgDash';
  const validas = ['pgDash','pgInventario','pgReportes','pgDestacados','pgVentasDiarias','pgSync','pgAdmin','pgFinanzasMes','pgCierreDia'];
  navTo(validas.includes(pgId) ? pgId : 'pgDash', false);
});

function toggleDrawer() {
  const drawer = document.getElementById('navDrawer');
  const btn    = document.getElementById('hamburgerBtn');
  drawer.classList.contains('open') ? cerrarDrawer() : (drawer.classList.add('open'), btn.classList.add('open'), document.body.style.overflow = 'hidden');
}
function cerrarDrawer() {
  document.getElementById('navDrawer').classList.remove('open');
  document.getElementById('hamburgerBtn').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== 10. STATS =====

function totalReporte(rep) { return Object.values(rep || {}).reduce((s, v) => s + Number(v.total || 0), 0); }
function totalCantReporte(rep) { return Object.values(rep || {}).reduce((s, v) => s + Number(v.cant || 0), 0); }

function actualizarStats() {
  document.getElementById('statProds').innerHTML  = `Productos: <b>${productos.length}</b>`;
  const totalHoy = totalReporte(ventasDia);
  document.getElementById('statVentas').innerHTML = `Hoy: <b>$${totalHoy.toFixed(2)}</b>`;

  const totalMes   = totalReporte(ventasMes);
  const itemsHoy   = totalCantReporte(ventasDia);
  const criticos   = productos.filter(p => p.stock <= p.min).length;
  const gastosMes  = pagos.filter(g => esMesActual(g.fechaISO)).reduce((s, g) => s + Number(g.monto || 0), 0);

  ['drawerStatProds', 'drawerStatVentas', 'drawerStatMes', 'drawerStatCrit'].forEach((id, i) => {
    const el = document.getElementById(id); if (!el) return;
    el.textContent = [productos.length, '$' + totalHoy.toFixed(2), '$' + totalMes.toFixed(2), criticos][i];
    if (i === 3) el.style.color = criticos > 0 ? '#f87171' : '#86efac';
  });

  const html = `
    <div class="stat-box"><div class="s-lbl">Venta Hoy</div><div class="s-val">$${totalHoy.toFixed(2)}</div></div>
    <div class="stat-box"><div class="s-lbl">Ítems Hoy</div><div class="s-val">${itemsHoy}</div></div>
    <div class="stat-box"><div class="s-lbl">Venta Mes</div><div class="s-val">$${totalMes.toFixed(2)}</div></div>
    <div class="stat-box"><div class="s-lbl">Cobros</div><div class="s-val">${historial.length}</div></div>
    <div class="stat-box"><div class="s-lbl">Gastos Mes</div><div class="s-val" style="color:var(--red)">$${gastosMes.toFixed(2)}</div></div>
    <div class="stat-box"><div class="s-lbl">Stock Crit.</div><div class="s-val" style="color:${criticos > 0 ? 'var(--red)' : 'var(--green)'}">${criticos}</div></div>
  `;
  ['statsRowDash', 'statsRow'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}

// ===== 11. INVENTARIO =====

function guardarEfectivoInicial() {
  efectivoInicial = parseFloat(document.getElementById('inpEfectivoInicial').value) || 0;
  idbSet('vpos_efectivoInicial', efectivoInicial).catch(console.error);
  renderInvTotales();
  if (typeof syncAhora === 'function') syncAhora('config');
}
function guardarInventarioInicial() {
  inventarioInicial = parseFloat(document.getElementById('inpInventarioInicial').value) || 0;
  idbSet('vpos_inventarioInicial', inventarioInicial).catch(console.error);
  renderInvTotales();
  if (typeof syncAhora === 'function') syncAhora('config');
}

function calcValorInventario() {
  let compra = 0, venta = 0;
  productos.forEach(p => {
    const lotStock  = (p.lotes || []).reduce((s, l) => s + (l.stockRestante || 0), 0);
    const mainStock = Math.max(0, (p.stock || 0) - lotStock);
    compra += mainStock * (p.compra || 0);
    venta  += mainStock * (p.venta  || 0);
    (p.lotes || []).forEach(l => {
      compra += (l.stockRestante || 0) * (l.compra || 0);
      venta  += (l.stockRestante || 0) * (p.venta  || 0);
    });
  });
  return { compra, venta };
}

function renderInvTotales() {
  const panel = document.getElementById('invTotalesPanel'); if (!panel) return;
  const { compra: totalInvCompra, venta: totalInvVenta } = calcValorInventario();
  const totalVentasMesPOS = totalReporte(ventasMes);
  const totalGastosMes    = pagos.filter(g => esMesActual(g.fechaISO)).reduce((s, g) => s + Number(g.monto || 0), 0);
  // FUENTE ÚNICA: ventasDiarias — el historial/ventasDia NO alimentan cajaActual
  const hoyISOInv          = new Date().toISOString().split('T')[0];
  const ventasConfirmadas  = (ventasDiarias || [])
    .filter(v => esMesActual(v.fecha + 'T00:00:00'))
    .reduce((s, v) => s + Number(v.monto || 0), 0);
  const cajaActual         = efectivoInicial + ventasConfirmadas - totalGastosMes;
  const totalCapCompra     = totalInvCompra + cajaActual;
  const totalCapVenta      = totalInvVenta  + cajaActual;

  // Vars necesarias para punto equilibrio
  const ahoraInv   = new Date();
  const diasMesInv = new Date(ahoraInv.getFullYear(), ahoraInv.getMonth()+1, 0).getDate();
  const diaActInv  = ahoraInv.getDate();
  const diasConVentasInv = (ventasDiarias || []).filter(v => esMesActual(v.fecha + 'T00:00:00')).length;
  const promedioVtaDiariaInv = diasConVentasInv > 0
    ? (ventasDiarias || []).filter(v => esMesActual(v.fecha + 'T00:00:00')).reduce((s,v) => s + Number(v.monto||0), 0) / diasConVentasInv
    : 0;

  const peBox  = document.getElementById('puntoEquilibrio');
  const peGrid = document.getElementById('peGrid');
  const hayPE  = efectivoInicial > 0 || inventarioInicial > 0;

  if (peBox && peGrid) {
    if (hayPE) {
      peBox.style.display = 'block';

      // Punto equilibrio = capital inicial (efectivo + inventario al costo)
      const puntoEq       = efectivoInicial + inventarioInicial;
      // Capital actual = misma fórmula que Estado de Caja:
      // efectivo inicial + inventario inicial + ventas confirmadas - gastos
      const comprasMesInv  = pagos.filter(g => esMesActual(g.fechaISO) && g.cat === 'COMPRA')
                               .reduce((s,g) => s + Number(g.monto||0), 0);
      const capitalActual = efectivoInicial + inventarioInicial + ventasConfirmadas + comprasMesInv - totalGastosMes;
      const diferencia    = capitalActual - puntoEq;
      const estaArriba    = diferencia >= 0;
      const colorDif      = estaArriba ? 'var(--green)' : 'var(--red)';
      const bgDif         = estaArriba ? 'var(--green-light)' : 'rgba(220,38,38,0.07)';
      const borderDif     = estaArriba ? 'var(--green)' : 'rgba(220,38,38,0.4)';
      const pctMes        = Math.round((diaActInv / diasMesInv) * 100);
      const ventasNecesarias = diasMesInv > 0 ? (puntoEq + totalGastosMes) / diasMesInv : 0;

      peGrid.innerHTML = `
        <div class="stat-box" style="border-color:var(--green);"><div class="s-lbl" style="color:var(--green);">💵 Efectivo Inicial</div><div class="s-val" style="color:var(--green);font-size:18px;">$${efectivoInicial.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">al inicio del mes</div></div>
        <div class="stat-box" style="border-color:#f59e0b;"><div class="s-lbl" style="color:#d97706;">📦 Inventario Inicial</div><div class="s-val" style="color:#d97706;font-size:18px;">$${inventarioInicial.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">valor costo al inicio</div></div>
        <div class="stat-box" style="border-color:#a855f7;background:#faf5ff;"><div class="s-lbl" style="color:#7c3aed;">⚖️ Punto de Equilibrio</div><div class="s-val" style="color:#7c3aed;font-size:20px;font-weight:900;">$${puntoEq.toFixed(2)}</div><div style="font-size:11px;color:#7c3aed;margin-top:2px;">capital mínimo a recuperar</div></div>
        <div class="stat-box" style="border-color:rgba(29,78,216,0.3);background:rgba(29,78,216,0.04);"><div class="s-lbl" style="color:var(--blue);">📊 Capital Actual</div><div class="s-val" style="color:var(--blue);font-size:18px;">$${capitalActual.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Ef.Ini + Inv.Ini + Ventas − Gastos</div></div>
        <div class="stat-box" style="border-color:${borderDif};background:${bgDif};grid-column:span 2;">
          <div class="s-lbl" style="color:${colorDif};font-size:13px;">${estaArriba ? '✅ POR ENCIMA — El mes va bien' : '🔴 ALERTA — Aún no recuperas la inversión'}</div>
          <div class="s-val" style="color:${colorDif};font-size:22px;">${estaArriba ? '+' : ''}$${diferencia.toFixed(2)}</div>
          <div style="font-size:11px;color:${colorDif};margin-top:3px;font-weight:700;">
            Día ${diaActInv} de ${diasMesInv} (${pctMes}% del mes)
            ${promedioVtaDiariaInv > 0 ? ` · Promedio diario: $${promedioVtaDiariaInv.toFixed(2)}` : ''}
            ${ventasNecesarias > 0 ? ` · Necesitas ~$${ventasNecesarias.toFixed(2)}/día para cubrir` : ''}
          </div>
        </div>
      `;
    } else peBox.style.display = 'none';
  }

  panel.innerHTML = `
    <div class="stat-box"><div class="s-lbl">Productos</div><div class="s-val" style="font-size:18px;">${productos.length}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">en inventario</div></div>
    <div class="stat-box" style="border-color:rgba(29,78,216,0.3);"><div class="s-lbl" style="color:var(--blue);">Valor Compra</div><div class="s-val" style="color:var(--blue);font-size:18px;">$${totalInvCompra.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">precio compra × stock</div></div>
    <div class="stat-box"><div class="s-lbl">Valor Venta</div><div class="s-val" style="font-size:18px;">$${totalInvVenta.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">precio venta × stock</div></div>
    <div class="stat-box"><div class="s-lbl" style="color:var(--amber);">💵 Caja Actual</div><div class="s-val" style="color:var(--amber);font-size:18px;">$${cajaActual.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">ef. inicial + ventas − gastos</div></div>
    <div class="stat-box" style="border-color:rgba(29,78,216,0.3);background:rgba(29,78,216,0.04);"><div class="s-lbl" style="color:var(--blue);">Capital (costo)</div><div class="s-val" style="color:var(--blue);font-size:18px;">$${totalCapCompra.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">caja + inv. compra</div></div>
    <div class="stat-box" style="border-color:var(--green);background:var(--green-light);"><div class="s-lbl" style="color:var(--green-dark);">Capital (venta)</div><div class="s-val" style="font-size:20px;">$${totalCapVenta.toFixed(2)}</div><div style="font-size:11px;color:var(--green-dark);margin-top:2px;">caja + inv. venta</div></div>
  `;
}

function guardarProducto(e) {
  e.preventDefault();
  if (typeof _puedeHacer === 'function' && !_puedeHacer('inventario')) { toast('No tienes permiso para editar inventario', true); return; }
  const id        = document.getElementById('editId').value;
  const newCod    = document.getElementById('inpCod').value.trim();
  const newAbrev  = document.getElementById('inpAbrev').value.toUpperCase().trim();
  const newNom    = document.getElementById('inpNom').value.toUpperCase().trim();
  const newCat    = document.getElementById('inpCat').value.toUpperCase().trim();
  const newCompra = parseFloat(document.getElementById('inpCompra').value) || 0;
  const newVenta  = parseFloat(document.getElementById('inpVenta').value)  || 0;
  const newStock  = parseInt(document.getElementById('inpStock').value)    || 0;
  const newMin    = parseInt(document.getElementById('inpMin').value)      || 0;
  const newImg    = _imagenPendiente !== undefined ? _imagenPendiente : (id ? (productos.find(x => String(x.id) === String(id))?.img || null) : null);

  if (id) {
    const existing   = productos.find(x => String(x.id) === String(id));
    let lotesActuales = existing ? (existing.lotes || []) : [];
    if (existing && (existing.stock || 0) > 0) {
      const compraChanged = Math.abs(newCompra - (existing.compra || 0)) > 0.001;
      const ventaChanged  = Math.abs(newVenta  - (existing.venta  || 0)) > 0.001;
      if (compraChanged || ventaChanged) {
        lotesActuales = [...lotesActuales, { compra: existing.compra || 0, ventaOrig: existing.venta || 0, stockInicial: existing.stock || 0, stockRestante: existing.stock || 0, fecha: new Date().toLocaleString('es-SV') }];
        toast('Precios actualizados — stock anterior registrado como lote', false, true);
      }
    }
    productos = productos.map(x => String(x.id) === String(id) ? { id: Number(id), cod: newCod, nom: newNom, cat: newCat, abrev: newAbrev, compra: newCompra, venta: newVenta, stock: newStock, min: newMin, lotes: lotesActuales, paquetes: existing ? (existing.paquetes || []) : [], img: newImg, _ts: Date.now() } : x);
  } else {
    productos.push({ id: Date.now(), cod: newCod, nom: newNom, cat: newCat, abrev: newAbrev, compra: newCompra, venta: newVenta, stock: newStock, min: newMin, lotes: [], paquetes: [], img: newImg, _ts: Date.now() });
  }
  // Capturar el ID del producto ANTES de cancelarEdicion (resetea el form)
  const _broadcastId = id || (productos.length > 0 ? String(productos[productos.length - 1].id) : null);
  cancelarEdicion();
  salvar();
  toast(id ? 'Producto actualizado' : 'Producto guardado');
  autoBackup(id ? 'Producto_editado' : 'Producto_nuevo');
  if (typeof _registrarAccion === 'function') _registrarAccion(id ? 'editar_producto' : 'nuevo_producto', newNom || '');
  // Sincronizar productos a Supabase inmediatamente
  if (typeof syncAhora === 'function') syncAhora('productos');
  // Enviar snapshot para que otros dispositivos reciban el producto nuevo/editado
  if (typeof _autoEnviarSnapshot === 'function') setTimeout(_autoEnviarSnapshot, 800);
  // Broadcast instantáneo con los datos correctos capturados antes del reset
  if (typeof _broadcast === 'function' && _broadcastId) {
    const savedProdB = productos.find(x => String(x.id) === _broadcastId);
    if (savedProdB) {
      // URLs son pequeñas (~100 chars) — se pueden enviar directamente.
      // Solo eliminar las imágenes base64 (que pesan ~100KB y saturan el canal)
      const imgBroadcast = (savedProdB.img && savedProdB.img.startsWith('http')) ? savedProdB.img : null;
      _broadcast('producto', { ...savedProdB, img: imgBroadcast });
    }
  }
  // Sync img inmediatamente — tanto al poner imagen como al borrarla
  if (typeof syncImgProducto === 'function') {
    const savedProd = productos.find(x => String(x.id) === String(id || ''));
    if (savedProd) {
      setTimeout(() => syncImgProducto(savedProd), 300);
    } else if (!id && newImg) {
      // producto nuevo con img — buscar por img
      const np = productos.find(x => x.img === newImg);
      if (np) setTimeout(() => syncImgProducto(np), 300);
    }
  }
}

function renderInv() {
  const filtro = (document.getElementById('filtroInv')?.value || '').toUpperCase();
  const lista  = productos.filter(p => !filtro || (p.nom || '').includes(filtro) || (p.cod || '').includes(filtro) || (p.cat || '').includes(filtro));
  const cnt    = document.getElementById('cntProds');
  if (cnt) cnt.textContent = `${lista.length} / ${productos.length}`;

  const inpEf = document.getElementById('inpEfectivoInicial');
  if (inpEf && inpEf.value === '') inpEf.value = efectivoInicial > 0 ? efectivoInicial : '';
  const inpInvR = document.getElementById('inpInventarioInicial');
  if (inpInvR && inpInvR.value === '') inpInvR.value = inventarioInicial > 0 ? inventarioInicial : '';

  renderInvTotales();

  const tbody = document.getElementById('tbodyInv'); if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty"><span class="empty-icon">📦</span>${filtro ? 'Sin resultados' : 'Sin productos registrados'}</div></td></tr>`;
    document.getElementById('tfootInv').innerHTML = '';
    return;
  }

  // Usar una sola asignación de string — más rápido que múltiples DOM ops
  const rows = lista.map(p => {
    const critico       = (p.stock || 0) <= (p.min || 0);
    const m             = (p.compra || 0) > 0 ? Math.round(((p.venta - p.compra) / p.compra) * 100) + '%' : '—';
    const lotesActivos  = (p.lotes || []).filter(l => (l.stockRestante || 0) > 0);
    const loteBadge     = lotesActivos.map(l => `<span class="lote-badge">${l.stockRestante} @ $${fmtP(l.compra)}</span>`).join('');
    const numPkgs       = (p.paquetes || []).length;
    const pkgBadge      = numPkgs > 0 ? `<span class="badge badge-green" style="font-size:10px;">${numPkgs} paq.</span>` : `<span style="font-size:11px;color:var(--text-muted);font-weight:700;">—</span>`;
    const imgCell       = p.img ? `<img src="${p.img}" loading="lazy" style="width:36px;height:36px;border-radius:7px;object-fit:cover;display:block;">` : `<div style="width:36px;height:36px;border-radius:7px;background:var(--green-light);display:flex;align-items:center;justify-content:center;font-size:18px;">${(p.cat||'?').charAt(0)}</div>`;
    return `<tr class="${critico ? 'row-critico' : ''}">
      <td style="text-align:center;padding:6px 8px;">${imgCell}</td>
      <td style="padding:8px 10px;"><code style="font-size:11px;color:var(--text-muted);letter-spacing:0.3px;">${p.cod || '—'}</code></td>
      <td class="td-bold" style="padding:8px 10px;">${p.nom}${lotesActivos.length ? '<br><span style="font-size:11px;">' + loteBadge + '</span>' : ''}</td>
      <td style="padding:8px 10px;font-size:12px;color:var(--text-muted);">${p.cat || ''}</td>
      <td class="mono" style="text-align:right;color:var(--text-muted);padding:8px 10px;">$${fmtP(p.compra || 0)}</td>
      <td style="text-align:right;padding:8px 10px;"><span class="mono td-green" style="font-weight:900;">$${fmtP(p.venta || 0)}</span><br><span class="badge badge-amber" style="font-size:9px;">${m}</span></td>
      <td style="text-align:center;padding:8px 6px;">${critico ? `<span class="badge badge-red" style="font-size:12px;">⚠ ${p.stock || 0}</span>` : `<span class="badge badge-green" style="font-size:12px;">${p.stock || 0}</span>`}</td>
      <td class="mono td-green" style="text-align:right;font-weight:900;padding:8px 10px;font-size:12px;">$${((p.venta || 0) * (p.stock || 0)).toFixed(2)}</td>
      <td style="text-align:center;padding:8px 6px;"><button class="btn-pkg" onclick="abrirGestionPaquetes('${p.id}')" title="Ver y editar presentaciones" style="font-size:11px;padding:5px 8px;">📦 ${pkgBadge}</button></td>
      <td style="padding:6px 8px;"><div style="display:flex;gap:4px;justify-content:center;">
        <button class="btn btn-green" style="padding:5px 7px;font-size:11px;" onclick="abrirRestock('${p.id}')" title="Agregar stock">+📦</button>
        <button class="btn btn-info" style="padding:5px 8px;font-size:13px;" onclick="editarProd('${p.id}')" title="Editar">✎</button>
        <button class="btn btn-danger" style="padding:5px 8px;font-size:13px;" onclick="borrarProd('${p.id}')" title="Eliminar">✕</button>
      </div></td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');

  const tfoot          = document.getElementById('tfootInv');
  const totalVentaLista = lista.reduce((s, p) => s + (p.venta || 0) * (p.stock || 0), 0);
  const totalVentaTodos = productos.reduce((s, p) => s + (p.venta || 0) * (p.stock || 0), 0);
  const esFiltered     = lista.length < productos.length;
  tfoot.innerHTML = `<tr style="background:var(--green-light);border-top:2px solid var(--border-mid);">
    <td colspan="7" style="text-align:right;font-size:12px;font-weight:900;color:var(--green-dark);padding:10px 10px;">
      💰 TOTAL${esFiltered ? ' (filtrado)' : ' INVENTARIO'}
      ${esFiltered ? `<span style="font-size:11px;color:var(--text-muted);margin-left:6px;font-weight:700;">· Total general: $${totalVentaTodos.toFixed(2)}</span>` : ''}
    </td>
    <td class="mono" style="font-size:15px;font-weight:900;color:var(--green);padding:10px 10px;text-align:right;">$${totalVentaLista.toFixed(2)}</td>
    <td colspan="2"></td>
  </tr>`;
}

let _imagenPendiente = undefined; // undefined = sin cambio, null = borrar, string = nueva imagen

function previsualizarImagen(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // ── Comprimir SIEMPRE a máximo 400px y ~100KB para que Supabase lo guarde sin cortes ──
      const MAX_B64 = 120 * 1024; // 120 KB en base64 ≈ 90KB real
      const maxDim  = 400;        // max 400px — suficiente para thumbnail de producto
      const canvas  = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        const f = maxDim / Math.max(w, h);
        w = Math.round(w * f); h = Math.round(h * f);
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      let quality = 0.82;
      let dataURL = canvas.toDataURL('image/jpeg', quality);
      while (dataURL.length > MAX_B64 && quality > 0.25) {
        quality -= 0.08;
        dataURL = canvas.toDataURL('image/jpeg', quality);
      }
      const kb = Math.round(dataURL.length * 0.75 / 1024);
      toast(`✓ Imagen lista (~${kb} KB)`);
      _imagenPendiente = dataURL;
      const prev = document.getElementById('imgPreview');
      prev.innerHTML = `<img src="${dataURL}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`;
      prev.style.border = '2px solid var(--green)';
      document.getElementById('btnQuitarImg').style.display = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function quitarImagen() {
  _imagenPendiente = null;
  document.getElementById('imgPreview').innerHTML = '📷';
  document.getElementById('imgPreview').style.border = '2px dashed #7dd3fc';
  document.getElementById('inpImagen').value = '';
  document.getElementById('btnQuitarImg').style.display = 'none';
  const inpUrl = document.getElementById('inpImgUrl');
  if (inpUrl) inpUrl.value = '';
}

function previsualizarImagenUrl(url) {
  url = (url || '').trim();
  const prev  = document.getElementById('imgPreview');
  const btnQ  = document.getElementById('btnQuitarImg');
  if (!url) {
    // Solo limpiar si la imagen actual viene de URL (no de archivo)
    if (_imagenPendiente && _imagenPendiente.startsWith('http')) {
      _imagenPendiente = undefined;
      prev.innerHTML = '📷';
      prev.style.border = '2px dashed #7dd3fc';
      if (btnQ) btnQ.style.display = 'none';
    }
    return;
  }
  // Validar que sea una URL razonable
  if (!url.startsWith('http')) { toast('La URL debe comenzar con http', true); return; }
  _imagenPendiente = url;
  prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;"
    onerror="this.parentElement.innerHTML='❌';toast('No se pudo cargar la imagen — verifica la URL',true);">`;
  prev.style.border = '2px solid var(--green)';
  if (btnQ) btnQ.style.display = '';
  toast('✓ Imagen desde URL lista');
}

function editarProd(id) {
  const p = productos.find(x => String(x.id) === String(id)); if (!p) return;
  ['editId','inpCod','inpAbrev','inpNom','inpCat','inpCompra','inpVenta','inpStock','inpMin'].forEach((fid, i) => {
    document.getElementById(fid).value = [p.id, p.cod||'', p.abrev||'', p.nom||'', p.cat||'', p.compra||0, p.venta||0, p.stock||0, p.min||0][i];
  });
  // Cargar imagen si existe
  _imagenPendiente = undefined;
  const prev = document.getElementById('imgPreview');
  const btnQ = document.getElementById('btnQuitarImg');
  const inpUrl = document.getElementById('inpImgUrl');
  if (inpUrl) inpUrl.value = p.img && p.img.startsWith('http') ? p.img : '';
  if (p.img) {
    prev.innerHTML = `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`;
    prev.style.border = '2px solid var(--green)';
    if (btnQ) btnQ.style.display = '';
  } else {
    prev.innerHTML = '📷';
    prev.style.border = '2px dashed #7dd3fc';
    if (btnQ) btnQ.style.display = 'none';
  }
  document.getElementById('formTitulo').textContent = '✎ Editando: ' + p.nom;
  document.getElementById('btnGuardar').textContent = '✔ ACTUALIZAR PRODUCTO';
  document.getElementById('btnCancelarEdit').style.display = 'inline-flex';
  navTo('pgInventario');
  // Auto-open the register/edit dropdown
  const dropContent = document.getElementById('dropRegistrar');
  const dropBtn     = document.getElementById('dropBtnRegistrar');
  if (dropContent && !dropContent.classList.contains('open')) {
    document.querySelectorAll('.inv-dropdown-content').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.inv-dropdown-btn').forEach(el => el.classList.remove('open'));
    dropContent.classList.add('open');
    if (dropBtn) dropBtn.classList.add('open');
  }
  setTimeout(() => { const el = document.getElementById('dropBtnRegistrar'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }, 120);
}
// ===== RESTOCK — Agregar cantidades compradas =====
function abrirRestock(id) {
  const p = productos.find(x => String(x.id) === String(id)); if (!p) return;
  document.getElementById('restockProdId').value   = id;
  document.getElementById('restockCantidad').value  = '';
  document.getElementById('restockPrecioCompra').value = '';
  document.getElementById('restockResumen').style.display = 'none';

  // Imagen
  const imgEl = document.getElementById('restockProdImg');
  imgEl.innerHTML = p.img
    ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`
    : (p.cat||'📦')[0];

  document.getElementById('restockProdNom').textContent   = p.nom;
  document.getElementById('restockProdStock').textContent = `Stock actual: ${p.stock || 0} uds  ·  Mín: ${p.min || 0}`;

  // Actualizar resumen en tiempo real
  const cantInput   = document.getElementById('restockCantidad');
  const precioInput = document.getElementById('restockPrecioCompra');
  function actualizarResumen() {
    const cant   = parseInt(cantInput.value) || 0;
    const precio = parseFloat(precioInput.value) || null;
    const resEl  = document.getElementById('restockResumen');
    if (cant <= 0) { resEl.style.display = 'none'; return; }
    const stockNuevo = (p.stock || 0) + cant;
    const costoTotal = precio ? (cant * precio).toFixed(2) : null;
    resEl.style.display = 'block';
    resEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>Stock actual</span><span class="mono">${p.stock || 0} uds</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>+ Agregar</span><span class="mono" style="color:var(--green);">+${cant} uds</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:900;color:var(--green-dark);border-top:1px solid var(--border);padding-top:6px;margin-top:2px;">
        <span>Nuevo stock total</span><span class="mono">${stockNuevo} uds</span>
      </div>
      ${costoTotal ? `<div style="display:flex;justify-content:space-between;margin-top:4px;color:var(--blue);"><span>Costo de compra</span><span class="mono">$${costoTotal}</span></div>` : ''}
    `;
  }
  cantInput.oninput   = actualizarResumen;
  precioInput.oninput = actualizarResumen;

  abrirModal('modalRestock');
  setTimeout(() => cantInput.focus(), 80);
}

function confirmarRestock() {
  const id   = parseInt(document.getElementById('restockProdId').value);
  const cant = parseInt(document.getElementById('restockCantidad').value) || 0;
  const nuevoPrecio = parseFloat(document.getElementById('restockPrecioCompra').value) || null;
  if (cant <= 0) { toast('Ingresa una cantidad válida', true); return; }
  const p = productos.find(x => String(x.id) === String(id)); if (!p) return;

  // Si cambió el precio de compra, registrar lote anterior
  if (nuevoPrecio && Math.abs(nuevoPrecio - (p.compra || 0)) > 0.001 && (p.stock || 0) > 0) {
    if (!p.lotes) p.lotes = [];
    p.lotes.push({ compra: p.compra || 0, ventaOrig: p.venta || 0, stockInicial: p.stock || 0, stockRestante: p.stock || 0, fecha: new Date().toLocaleString('es-SV') });
    p.compra = nuevoPrecio;
  } else if (nuevoPrecio) {
    p.compra = nuevoPrecio;
  }

  p.stock = (p.stock || 0) + cant;

  // Registrar entrada en restockLog para fusión correcta
  restockLog.push({
    id: uid(),
    ts: nowTS(),
    prodId: String(p.id),
    cant: cant,
    precioCompra: nuevoPrecio || p.compra || 0,
    fechaStr: new Date().toLocaleString('es-SV')
  });

  salvar();
  cerrarModal('modalRestock');
  toast(`✓ +${cant} uds agregadas a ${p.nom}  →  Stock: ${p.stock}`);
  autoBackup('Stock_agregado');
  // Sync en tiempo real (restock = productos + restock_log)
  if (typeof syncAhora === 'function') syncAhora('restock');
}

function cancelarEdicion() {
  document.getElementById('formProd').reset();
  document.getElementById('editId').value = '';
  document.getElementById('inpAbrev').value = '';
  document.getElementById('formTitulo').textContent = 'Registrar Producto';
  document.getElementById('btnGuardar').textContent = '+ GUARDAR PRODUCTO';
  document.getElementById('btnCancelarEdit').style.display = 'none';
  _imagenPendiente = undefined;
  const prev = document.getElementById('imgPreview');
  if (prev) { prev.innerHTML = '📷'; prev.style.border = '2px dashed #7dd3fc'; }
  const btnQ = document.getElementById('btnQuitarImg');
  if (btnQ) btnQ.style.display = 'none';
  const inpImg = document.getElementById('inpImagen');
  if (inpImg) inpImg.value = '';
  const inpUrl = document.getElementById('inpImgUrl');
  if (inpUrl) inpUrl.value = '';
}
function borrarProd(id) {
  if (typeof _puedeHacer === 'function' && !_puedeHacer('inventario')) { toast('No tienes permiso para eliminar productos', true); return; }
  if (confirm('¿Eliminar este producto?')) {
    productos = productos.filter(p => String(p.id) !== String(id));
    const idStr = String(id);
    if (!productosEliminados.includes(idStr)) productosEliminados.push(idStr);
    // Broadcast instantáneo del borrado a todos los dispositivos conectados
    if (typeof _broadcast === 'function') _broadcast('producto_borrado', { id: idStr });
    salvar(); renderInv(); toast('Producto eliminado', true);
    if (typeof syncBorrarProducto === 'function') syncBorrarProducto(id);
    // Re-enviar snapshot inmediatamente con productosEliminados actualizado
    if (typeof _autoEnviarSnapshot === 'function') setTimeout(_autoEnviarSnapshot, 500);
  }
}

// ===== 12. VENTA =====

function abrirModalVenta() {
  document.getElementById('busquedaVenta').value = '';
  const s = document.getElementById('sugVenta');
  s.style.display = 'none'; s.innerHTML = '';
  renderCarrito();
  abrirModal('modalVenta');
  setTimeout(() => document.getElementById('busquedaVenta')?.focus(), 50);
}
function cerrarVenta() {
  carrito.forEach(i => {
    const p = productos.find(x => x.id === i.id);
    if (p) p.stock += i.cant * (i.stockPorCant || 1);
  });
  carrito = [];
  renderCarrito();
  cerrarModal('modalVenta');
  renderInv();
  salvarSesion();
}
function buscarV() {
  const txt = document.getElementById('busquedaVenta').value.toUpperCase().trim();
  const sug = document.getElementById('sugVenta');
  sug.innerHTML = '';
  if (!txt) { sug.style.display = 'none'; return; }
  const m = productos.filter(p => {
    const nom = (p.nom||'').toUpperCase(), abrev = (p.abrev||'').toUpperCase(), cod = (p.cod||'').toUpperCase();
    return nom.startsWith(txt) || abrev === txt || abrev.startsWith(txt) || cod.startsWith(txt);
  });
  if (!m.length) {
    sug.innerHTML = `<div style="text-align:center;padding:18px;color:var(--text-muted);font-weight:700;font-size:13px;background:#fff;border-radius:12px;border:1px solid var(--border);">Sin coincidencias para "${txt}"</div>`;
    sug.style.display = 'block'; return;
  }
  const grid = document.createElement('div');
  grid.className = 'sug-grid';
  m.forEach(p => {
    const sinStock = (p.stock || 0) <= 0;
    const stockBajo = !sinStock && (p.stock || 0) <= (p.min || 0);
    const stockColor = sinStock ? 'color:#dc2626' : stockBajo ? 'color:#d97706' : 'color:#4b7a5a';
    const stockTxt = sinStock ? 'Sin stock' : `Stock: ${p.stock}`;
    const hasImg = !!p.img;
    const d = document.createElement('div');
    d.className = 'sug-item' + (sinStock ? ' sin-stock' : '') + (hasImg ? ' has-img' : '');
    d.innerHTML = `
      ${hasImg
        ? `<img class="sug-item-img" src="${p.img}" alt="${p.nom}" loading="lazy">`
        : `<div class="sug-item-ph">${p.cat ? p.cat.charAt(0) : '🛒'}</div>`}
      <div class="sug-item-body">
        <div class="sug-item-cat">${p.cat || 'General'}</div>
        <div class="sug-name">${p.nom}</div>
        <div class="sug-price">$${fmtP(p.venta||0)}</div>
        ${sinStock
        ? '<div class="sug-stock-badge sug-stock-sin">✕ Sin stock</div>'
        : stockBajo
          ? `<div class="sug-stock-badge sug-stock-bajo">⚠ ${stockTxt}</div>`
          : `<div class="sug-stock-badge sug-stock-ok">● ${stockTxt}</div>`}
      </div>
      ${!sinStock ? '<div class="sug-tap-hint">＋ Toca para agregar</div>' : ''}
    `;
    if (!sinStock) {
      // touchstart: hacer blur INMEDIATO para que el teclado del teléfono empiece
      // a cerrarse antes de que llegue el evento click (~250ms después en iOS)
      d.addEventListener('touchstart', () => {
        const busq = document.getElementById('busquedaVenta');
        if (busq) busq.blur();
        if (document.activeElement && document.activeElement !== busq) {
          document.activeElement.blur();
        }
      }, { passive: true });

      d.addEventListener('click', () => {
        document.getElementById('busquedaVenta').value = '';
        sug.style.display = 'none'; sug.innerHTML = '';
        // Si el producto tiene paquetes con stock → mostrar picker primero
        const pkgsDisponibles = (p.paquetes || []).filter(pk => (p.stock || 0) >= pk.cant);
        if (pkgsDisponibles.length > 0) {
          abrirPickerPaquetes(p);
        } else {
          abrirTecladoCantidad({ p, mode: 'add' });
        }
      });
    }
    grid.appendChild(d);
  });
  sug.appendChild(grid);
  sug.style.display = 'block';
}
function vibrarFuerte(cant) {
  if (!navigator.vibrate) return;
  // Patrón: 1 pulso fuerte base + pulsos extra según cantidad
  const pulso = 80;
  const pausa = 60;
  let patron = [120]; // vibración inicial fuerte
  for (let i = 0; i < Math.min(cant, 10); i++) {
    patron.push(pausa, pulso);
  }
  navigator.vibrate(patron);
}
// ===== TECLADO NUMÉRICO DE CANTIDAD =====

function abrirTecladoCantidad(ctx) {
  window._tecladoCtx = ctx;
  window._tecladoValor = '';

  let modal = document.getElementById('modalTecladoCant');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalTecladoCant';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.innerHTML = `
    <div class="modal-box modal-sm" style="max-width:320px;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(5,46,22,0.35);animation-duration:0.08s;">
      <!-- Header verde del POS -->
      <div style="background:linear-gradient(135deg,var(--green),var(--green-dark));padding:16px 18px;display:flex;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;">🛒</div>
        <div style="flex:1;overflow:hidden;">
          <div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;">Cantidad</div>
          <div id="teclNomProd" style="font-size:13px;font-weight:900;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3;">Producto</div>
        </div>
        <button onclick="cerrarModal('modalTecladoCant')"
          style="width:32px;height:32px;border-radius:9px;border:none;background:rgba(255,255,255,0.18);color:#fff;font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
      </div>

      <div style="padding:16px;background:var(--surface);">
        <!-- Display -->
        <div id="teclDisplay"
          style="text-align:center;font-family:'Space Mono',monospace;font-size:52px;font-weight:700;
          background:var(--green-light);border:2px solid var(--border-mid);border-radius:16px;
          padding:18px 12px 14px;margin-bottom:14px;min-height:86px;
          display:flex;align-items:center;justify-content:center;
          color:var(--green-dark);letter-spacing:4px;
          box-shadow:inset 0 2px 8px rgba(22,163,74,0.1);">
          <span style="opacity:0.35;">0</span>
        </div>

        <!-- Grid numérico -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
          ${[7,8,9,4,5,6,1,2,3].map(n => `
          <button tabindex="-1" onclick="tecladoPush('${n}')"
            style="font-size:22px;font-weight:900;padding:17px 8px;border-radius:14px;
            border:1.5px solid var(--border-mid);background:var(--surface2);cursor:pointer;
            font-family:'Space Mono',monospace;color:var(--text);
            transition:all 0.08s;box-shadow:0 2px 0 var(--border-mid);"
            ontouchstart="this.style.transform='scale(0.93)';this.style.background='var(--green-light)'"
            ontouchend="this.style.transform='';this.style.background='var(--surface2)'"
            onmousedown="this.style.transform='scale(0.93)';this.style.background='var(--green-light)'"
            onmouseup="this.style.transform='';this.style.background='var(--surface2)'">${n}</button>
          `).join('')}
          <!-- Fila bottom: C / 0 / ⌫ -->
          <button tabindex="-1" onclick="tecladoClear()"
            style="font-size:13px;font-weight:900;padding:17px 8px;border-radius:14px;
            border:1.5px solid #fca5a5;background:#fff5f5;cursor:pointer;color:#dc2626;
            box-shadow:0 2px 0 #fca5a5;transition:all 0.08s;"
            ontouchstart="this.style.transform='scale(0.93)'"
            ontouchend="this.style.transform=''"
            onmousedown="this.style.transform='scale(0.93)'"
            onmouseup="this.style.transform=''">CLEAR</button>
          <button tabindex="-1" onclick="tecladoPush('0')"
            style="font-size:22px;font-weight:900;padding:17px 8px;border-radius:14px;
            border:1.5px solid var(--border-mid);background:var(--surface2);cursor:pointer;
            font-family:'Space Mono',monospace;color:var(--text);
            box-shadow:0 2px 0 var(--border-mid);transition:all 0.08s;"
            ontouchstart="this.style.transform='scale(0.93)';this.style.background='var(--green-light)'"
            ontouchend="this.style.transform='';this.style.background='var(--surface2)'"
            onmousedown="this.style.transform='scale(0.93)';this.style.background='var(--green-light)'"
            onmouseup="this.style.transform='';this.style.background='var(--surface2)'">0</button>
          <button tabindex="-1" onclick="tecladoBack()"
            style="font-size:22px;font-weight:900;padding:17px 8px;border-radius:14px;
            border:1.5px solid var(--border-mid);background:var(--surface2);cursor:pointer;color:var(--green-dark);
            box-shadow:0 2px 0 var(--border-mid);transition:all 0.08s;"
            ontouchstart="this.style.transform='scale(0.93)'"
            ontouchend="this.style.transform=''"
            onmousedown="this.style.transform='scale(0.93)'"
            onmouseup="this.style.transform=''">⌫</button>
        </div>

        <!-- Paquetes (si aplica) -->
        <div id="teclPkgRow" style="display:none;margin-bottom:8px;"></div>

        <!-- Botón confirmar -->
        <button tabindex="-1" onclick="tecladoConfirmar()"
          style="width:100%;padding:17px;border-radius:14px;border:none;
          background:linear-gradient(135deg,var(--green),var(--green-dark));
          color:#fff;font-size:17px;font-weight:900;cursor:pointer;
          box-shadow:0 4px 14px rgba(22,163,74,0.45);
          display:flex;align-items:center;justify-content:center;gap:8px;
          transition:all 0.12s;letter-spacing:0.3px;"
          ontouchstart="this.style.transform='scale(0.97)'"
          ontouchend="this.style.transform=''"
          onmousedown="this.style.transform='scale(0.97)'"
          onmouseup="this.style.transform=''">
          <span style="font-size:20px;">✓</span> CONFIRMAR
        </button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }

  const nomProd = ctx.nomProd || ctx.p?.nom || 'Editar cantidad';
  document.getElementById('teclNomProd').textContent = nomProd;
  tecladoClear();

  // Mostrar botones de paquete si el producto tiene paquetes, mode='add', y no viene de seleccionarPresentacion
  const pkgRow = document.getElementById('teclPkgRow');
  if (ctx.mode === 'add' && !ctx._skipPkgRow && ctx.p && (ctx.p.paquetes||[]).length > 0) {
    pkgRow.style.display = 'flex';
    pkgRow.style.gap = '6px';
    pkgRow.style.flexWrap = 'wrap';
    pkgRow.innerHTML = `<div style="width:100%;font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:4px;">📦 O elige paquete:</div>` +
      ctx.p.paquetes.map(pkg => `
        <button onclick="cerrarModal('modalTecladoCant');abrirPickerPaquetes(window._tecladoCtx.p)"
          style="flex:1;min-width:80px;padding:8px 6px;border-radius:10px;border:1.5px solid var(--border-mid);
          background:#f0fdf4;cursor:pointer;font-size:11px;font-weight:800;color:var(--green-dark);">
          ${pkg.cant} uds · $${fmtP(pkg.precio)}
        </button>`).join('');
  } else {
    pkgRow.style.display = 'none';
  }

  modal.classList.add('open');
  // Forzar blur de cualquier input activo para que el teclado del teléfono se cierre
  // antes de mostrar nuestro teclado numérico custom
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  // Doble seguro: también quitar foco del input de búsqueda explícitamente
  const busq = document.getElementById('busquedaVenta');
  if (busq) busq.blur();
}

function _tecladoActualizarDisplay() {
  const el = document.getElementById('teclDisplay');
  if (!el) return;
  const v = window._tecladoValor || '';
  el.innerHTML = v
    ? `<span>${v}</span>`
    : `<span style="opacity:0.35;">0</span>`;
}
function tecladoPush(d) {
  if ((window._tecladoValor || '').length >= 4) return;
  window._tecladoValor = (window._tecladoValor || '') + d;
  _tecladoActualizarDisplay();
}
function tecladoClear() {
  window._tecladoValor = '';
  _tecladoActualizarDisplay();
}
function tecladoBack() {
  window._tecladoValor = (window._tecladoValor || '').slice(0, -1);
  _tecladoActualizarDisplay();
}
function tecladoConfirmar() {
  const cantidad = parseInt(window._tecladoValor || '0');
  if (cantidad <= 0) { toast('Ingresa una cantidad mayor a 0', true); return; }
  const ctx = window._tecladoCtx;
  cerrarModal('modalTecladoCant');

  if (ctx.mode === 'add') {
    const p = ctx.p;
    if ((p.stock || 0) < cantidad) { toast(`Stock insuficiente — quedan ${p.stock} uds`, true); return; }
    const cartKey = p.id + '_unit';
    const item = carrito.find(c => c.cartKey === cartKey);
    if (item) item.cant += cantidad;
    else carrito.push({ cartKey, id: p.id, nom: p.nom, venta: p.venta, cant: cantidad, stockPorCant: 1, paqueteLabel: null });
    p.stock -= cantidad;
    renderCarrito(); salvarSesion(); actualizarStockFila(p);
    sonidoCarrito(); vibrarFuerte(cantidad);
    toast(`✓ ${p.nom} ×${cantidad}`);

  } else if (ctx.mode === 'add_pkg') {
    const p = ctx.p;
    const pkg = ctx.pkg;
    const stockNecesario = pkg.cant * cantidad;
    if ((p.stock || 0) < stockNecesario) { toast(`Stock insuficiente — quedan ${p.stock} uds (necesitas ${stockNecesario})`, true); return; }
    const cartKey = p.id + '_pkg_' + pkg.id;
    const item = carrito.find(c => c.cartKey === cartKey);
    if (item) item.cant += cantidad;
    else carrito.push({ cartKey, id: p.id, nom: p.nom, venta: pkg.precio, cant: cantidad, stockPorCant: pkg.cant, paqueteLabel: `${pkg.cant} × $${fmtP(pkg.precio)}` });
    p.stock -= stockNecesario;
    renderCarrito(); salvarSesion(); actualizarStockFila(p);
    sonidoCarrito(); vibrarFuerte(cantidad);
    toast(`✓ ${p.nom} — ${cantidad} paquete${cantidad > 1 ? 's' : ''} de ${pkg.cant} uds`);

  } else if (ctx.mode === 'edit') {
    const item = carrito.find(c => c.cartKey === ctx.cartKey);
    if (!item) return;
    const p = productos.find(x => x.id === item.id);
    const oldCant = item.cant;
    const diff = cantidad - oldCant;
    if (p && diff > 0 && (p.stock || 0) < diff * (item.stockPorCant || 1)) {
      toast(`Stock insuficiente — faltan ${diff * (item.stockPorCant || 1) - (p.stock || 0)} uds`, true); return;
    }
    if (p) p.stock -= diff * (item.stockPorCant || 1);
    item.cant = cantidad;
    if (item.cant <= 0) carrito = carrito.filter(c => c.cartKey !== ctx.cartKey);
    renderCarrito(); renderInv(); salvarSesion();
    vibrarFuerte(cantidad);
    toast(`✓ ${item.nom} — cantidad: ${cantidad}`);
  }
}

function addCarrito(p) {
  if ((p.stock || 0) <= 0) { toast('Sin stock disponible', true); return; }
  const cartKey = p.id + '_unit';
  const item = carrito.find(c => c.cartKey === cartKey);
  if (item) item.cant++;
  else carrito.push({ cartKey, id: p.id, nom: p.nom, venta: p.venta, cant: 1, stockPorCant: 1, paqueteLabel: null });
  p.stock--;
  renderCarrito(); salvarSesion();
  actualizarStockFila(p); // actualizar solo la fila del producto, no toda la tabla
  sonidoCarrito();
  const cantActual = carrito.find(c => c.cartKey === cartKey)?.cant || 1;
  vibrarFuerte(cantActual);
  toast(`✓ ${p.nom} — cantidad: ${cantActual}`);
}
function addCarritoConPaquete(p, pkg) {
  if ((p.stock || 0) < pkg.cant) { toast(`Stock insuficiente — quedan ${p.stock} uds`, true); return; }
  const cartKey = p.id + '_pkg_' + pkg.id;
  const item = carrito.find(c => c.cartKey === cartKey);
  if (item) { if ((p.stock || 0) < pkg.cant) { toast('Stock insuficiente', true); return; } item.cant++; }
  else carrito.push({ cartKey, id: p.id, nom: p.nom, venta: pkg.precio, cant: 1, stockPorCant: pkg.cant, paqueteLabel: `${pkg.cant} × $${fmtP(pkg.precio)}` });
  p.stock -= pkg.cant;
  renderCarrito(); salvarSesion();
  actualizarStockFila(p);
  sonidoCarrito();
  const cantActualPkg = carrito.find(c => c.cartKey === cartKey)?.cant || 1;
  vibrarFuerte(cantActualPkg);
  toast(`✓ ${p.nom} — paquete × ${cantActualPkg}`);
}
function cambiarCant(cartKey, delta) {
  const item  = carrito.find(c => c.cartKey === cartKey);
  const pOrig = productos.find(p => p.id === (item ? item.id : -1));
  if (!item || !pOrig) return;
  const spc = item.stockPorCant || 1;
  if (delta > 0) {
    if ((pOrig.stock || 0) < spc) { toast('Sin stock', true); return; }
    item.cant++; pOrig.stock -= spc;
    // Vibración fuerte al sumar: pulso largo + pulsos según cantidad actual
    if (navigator.vibrate) {
      const cant = item.cant;
      let patron = [100, 50];
      for (let i = 0; i < Math.min(cant, 8); i++) patron.push(80, 40);
      navigator.vibrate(patron);
    }
  } else {
    item.cant--; pOrig.stock += spc;
    if (item.cant <= 0) carrito = carrito.filter(c => c.cartKey !== cartKey);
    // Vibración fuerte al restar: 3 pulsos fuertes
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
  }
  renderCarrito(); renderInv(); salvarSesion();
}
function vaciarCarrito() {
  if (!carrito.length) return;
  carrito.forEach(i => { const p = productos.find(x => x.id === i.id); if (p) p.stock += i.cant * (i.stockPorCant || 1); });
  carrito = [];
  renderCarrito(); renderInv(); salvarSesion();
}
function renderCarrito() {
  const c = document.getElementById('carVenta');
  if (!carrito.length) {
    c.innerHTML = `<div class="empty"><span class="empty-icon">🛒</span>Carrito vacío — busca un producto arriba</div>`;
    document.getElementById('txtTotal').textContent = '$0.00';
    return;
  }
  let total = 0;
  c.innerHTML = [...carrito].reverse().map(i => {
    const sub = i.venta * i.cant; total += sub;
    const pkgBadge = i.paqueteLabel ? `<span class="cart-pkg-badge">📦 ${i.paqueteLabel}</span>` : '';
    const prod = productos.find(x => x.id === i.id);
    const imgEl = prod?.img
      ? `<img src="${prod.img}" class="cart-img" style="object-fit:cover;">`
      : `<div class="cart-img">${(prod?.cat||'🛒')[0]}</div>`;
    const precioLbl = i.paqueteLabel ? `$${fmtP(i.venta)}/paq` : `$${fmtP(i.venta)} c/u`;
    return `<div class="cart-item" onclick="abrirTecladoCantidad({cartKey:'${i.cartKey}',nomProd:'${i.nom.replace(/'/g,"\\'")}',mode:'edit'})" style="cursor:pointer;">
      ${imgEl}
      <div class="cart-info">
        <div class="cart-name">${i.nom}${pkgBadge}</div>
        <div class="cart-sub">${precioLbl}</div>
      </div>
      <div class="cart-controls">
        <div class="cart-total">$${sub.toFixed(2)}</div>
        <div class="qty-row">
          <button class="qty-btn minus" onclick="event.stopPropagation();cambiarCant('${i.cartKey}',-1)">−</button>
          <span class="qty-num">${i.cant}</span>
          <button class="qty-btn plus" onclick="event.stopPropagation();cambiarCant('${i.cartKey}',1)">+</button>
        </div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('txtTotal').textContent = '$' + total.toFixed(2);
}

// ===== 13. PAQUETES =====

let _pkgProdIdActivo = null;

function abrirGestionPaquetes(prodId) {
  const p = productos.find(x => String(x.id) === String(prodId)); if (!p) return;
  _pkgProdIdActivo = prodId;
  document.getElementById('pkgProdId').value  = prodId;
  document.getElementById('pkgProdNom').textContent = p.nom + ' · Stock: ' + (p.stock||0) + ' uds';
  document.getElementById('pkgUnitInfo').textContent = `1 unidad  →  $${fmtP(p.venta)}`;
  document.getElementById('pkgInpCant').value   = '';
  document.getElementById('pkgInpPrecio').value = '';
  document.getElementById('pkgPreviewBox').style.display = 'none';
  renderPkgLista(p);
  abrirModal('modalPaquetes');
}

function renderPkgLista(p) {
  const lista = document.getElementById('pkgLista');
  if (!p) p = productos.find(x => String(x.id) === String(_pkgProdIdActivo));
  if (!p) return;
  const paquetes = (p.paquetes || []).slice().sort((a,b) => b.cant - a.cant);

  if (!paquetes.length) {
    lista.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;font-weight:700;">Sin presentaciones — agrega una abajo</div>`;
    return;
  }

  // Calcular ventas por paquete desde el historial
  const ventasPorPkg = {};
  historial.forEach(v => {
    (v.items||[]).forEach(it => {
      if (String(it.id) !== String(p.id) || !it.paqueteLabel) return;
      const key = it.paqueteLabel;
      if (!ventasPorPkg[key]) ventasPorPkg[key] = { cant: 0, ingresos: 0 };
      ventasPorPkg[key].cant     += Number(it.cant || 0);
      ventasPorPkg[key].ingresos += Number(it.cant || 0) * Number(it.precio || 0);
    });
  });

  lista.innerHTML = paquetes.map((pk, i) => {
    const label    = `${pk.cant} × $${fmtP(pk.precio)}`;
    const stats    = ventasPorPkg[label] || { cant: 0, ingresos: 0 };
    const precioUd = pk.precio / pk.cant;
    const hayStock = (p.stock||0) >= pk.cant;
    return `
    <div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start;">
      <div>
        <!-- encabezado presentación -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="background:var(--green);color:#fff;border-radius:8px;padding:3px 10px;font-size:13px;font-weight:900;">${pk.cant} uds</span>
          <span style="font-family:'Space Mono',monospace;font-size:17px;font-weight:900;color:var(--green);">$${fmtP(pk.precio)}</span>
          ${!hayStock ? `<span class="badge badge-red" style="font-size:10px;">Sin stock</span>` : ''}
        </div>
        <!-- detalle -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;">💲 $${fmtP(precioUd)}/ud</div>
          <div style="font-size:11px;color:var(--blue);font-weight:700;">📦 Vendidas: ${stats.cant} uds</div>
          <div style="font-size:11px;color:var(--green-dark);font-weight:700;">💰 Ingresos: $${stats.ingresos.toFixed(2)}</div>
        </div>
      </div>
      <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" onclick="borrarPaquete(${i})">✕</button>
    </div>`;
  }).join('');
}

function pkgPreview() {
  const cant   = parseInt(document.getElementById('pkgInpCant').value)   || 0;
  const precio = parseFloat(document.getElementById('pkgInpPrecio').value) || 0;
  const box    = document.getElementById('pkgPreviewBox');
  if (cant < 1 || precio <= 0) { box.style.display='none'; return; }
  const p = productos.find(x => x.id === _pkgProdIdActivo);
  const precioUd = precio / cant;
  const base     = p ? p.venta : 0;
  const ahorro   = base > 0 ? (((base*cant - precio)/(base*cant))*100).toFixed(0) : null;
  box.style.display = 'block';
  box.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;">
      <span>📦 ${cant} uds por <b>$${fmtP(precio)}</b></span>
      <span>💲 $${fmtP(precioUd)} por unidad</span>
      ${ahorro ? `<span style="color:var(--green);">🏷 ${ahorro}% más barato que unidad</span>` : ''}
    </div>`;
}

function guardarPaquete() {
  const cant   = parseInt(document.getElementById('pkgInpCant').value)    || 0;
  const precio = parseFloat(document.getElementById('pkgInpPrecio').value) || 0;
  if (cant < 1)    { toast('La cantidad debe ser al menos 1', true); return; }
  if (precio <= 0) { toast('El precio debe ser mayor a 0', true);    return; }
  const p = productos.find(x => String(x.id) === String(_pkgProdIdActivo)); if (!p) return;
  if (!p.paquetes) p.paquetes = [];
  if (p.paquetes.find(pk => pk.cant === cant)) { toast('Ya existe una presentación de ' + cant + ' uds', true); return; }
  p.paquetes.push({ id: Date.now(), cant, precio });
  p.paquetes.sort((a,b) => a.cant - b.cant);
  document.getElementById('pkgInpCant').value   = '';
  document.getElementById('pkgInpPrecio').value = '';
  document.getElementById('pkgPreviewBox').style.display = 'none';
  salvar();
  renderPkgLista(p);
  toast(`✓ Presentación ${cant} uds por $${fmtP(precio)} guardada`);
  if (typeof syncAhora === 'function') syncAhora('productos');
  // Broadcast en tiempo real para otros dispositivos
  if (typeof _broadcast === 'function') _broadcast('producto', { ...p, img: undefined });
}

function borrarPaquete(idx) {
  const p = productos.find(x => String(x.id) === String(_pkgProdIdActivo)); if (!p) return;
  const pk = (p.paquetes||[]).slice().sort((a,b)=>b.cant-a.cant)[idx];
  if (!pk || !confirm(`¿Eliminar presentación de ${pk.cant} uds por $${fmtP(pk.precio)}?`)) return;
  p.paquetes = p.paquetes.filter(x => x.id !== pk.id);
  salvar(); renderPkgLista(p);
  toast('Presentación eliminada', true);
  if (typeof syncAhora === 'function') syncAhora('productos');
  // Broadcast en tiempo real para otros dispositivos
  if (typeof _broadcast === 'function') _broadcast('producto', { ...p, img: undefined });
}

function abrirPickerPaquetes(p) {
  document.getElementById('pickerProdNom').textContent = p.nom + ' · Stock: ' + (p.stock||0) + ' uds';
  const cont = document.getElementById('pickerOpciones');

  const opciones = [
    { label: '1 unidad', cant: 1, precio: p.venta, stockPorCant: 1, pkgId: null },
    ...(p.paquetes||[]).filter(pk => (p.stock||0) >= pk.cant)
      .sort((a,b) => b.cant - a.cant)
      .map(pk => ({ label: `${pk.cant} unidades`, cant: pk.cant, precio: pk.precio, stockPorCant: pk.cant, pkgId: pk.id }))
  ];

  cont.innerHTML = opciones.map((op, i) => {
    const precioUd   = (op.precio / op.cant).toFixed(3);
    const isBase     = op.pkgId === null;
    const border     = isBase ? 'var(--border-mid)' : 'var(--green)';
    const bg         = isBase ? '#fff' : 'var(--green-light)';
    return `
    <button onclick="seleccionarPresentacion(${p.id},${i})" style="background:${bg};border:2px solid ${border};border-radius:12px;padding:12px 16px;cursor:pointer;text-align:left;font-family:'Nunito',sans-serif;transition:all 0.12s;width:100%;" onmouseover="this.style.borderColor='var(--green)';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='${border}';this.style.transform=''">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:15px;font-weight:900;color:var(--text);">${op.label}</div>
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-top:2px;">$${fmtP(precioUd)} por unidad</div>
        </div>
        <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:900;color:var(--green);">$${fmtP(op.precio)}</div>
      </div>
    </button>`;
  }).join('');

  // guardar opciones temporalmente para selección
  window._pickerOpts = { p, opciones };
  abrirModal('modalPickerPkg');
}

function seleccionarPresentacion(prodId, idx) {
  cerrarModal('modalPickerPkg');
  const { p, opciones } = window._pickerOpts || {};
  if (!p || !opciones) return;
  const op = opciones[idx];
  if (!op) return;
  if (op.pkgId === null) {
    // Unidad base → abrir teclado de cantidad (sin mostrar botones de paquete dentro)
    abrirTecladoCantidad({ p, mode: 'add', _skipPkgRow: true });
  } else {
    // Paquete → abrir teclado para elegir cuántos paquetes
    const pkg = (p.paquetes||[]).find(pk => pk.id === op.pkgId);
    if (!pkg) return;
    abrirTecladoCantidad({
      p,
      mode: 'add_pkg',
      pkg,
      nomProd: `${p.nom} · Paquete ${pkg.cant} uds · $${fmtP(pkg.precio)}`
    });
  }
}

// ===== 14. COBRO =====

function abrirCobro() {
  if (!carrito.length) { toast('Carrito vacío', true); return; }
  cobroDigits = '';
  const total = carrito.reduce((a, i) => a + i.venta * i.cant, 0);
  document.getElementById('cobroMonto').textContent = '$' + total.toFixed(2);
  actualizarCobro();
  abrirModal('modalCobro');
}
function actualizarCobro() {
  let disp;
  if (!cobroDigits || cobroDigits === '.') disp = 'CABAL';
  else if (cobroDigits.includes('.')) {
    const [ent, dec = ''] = cobroDigits.split('.');
    disp = '$' + parseInt(ent || '0').toLocaleString('es-SV') + '.' + (dec + '00').substring(0, 2);
  } else disp = '$' + parseInt(cobroDigits).toLocaleString('es-SV') + '.00';
  const dispEl = document.getElementById('dispEfectivo');
  dispEl.textContent = disp;
  dispEl.classList.toggle('active', !!cobroDigits && cobroDigits !== '.');
  dispEl.classList.toggle('cabal', !cobroDigits || cobroDigits === '.');
  const total    = parseFloat(document.getElementById('cobroMonto').textContent.replace('$', '').replace(',', ''));
  const efectivo = cobroDigits ? (parseFloat(cobroDigits) || 0) : total;
  document.getElementById('cobroVuelto').textContent = '$' + Math.max(0, efectivo - total).toFixed(2);
}
function initKeypad() {
  const tn = document.getElementById('tecladoNum'); if (!tn) return;
  tn.innerHTML = '';
  ['7','8','9','4','5','6','1','2','3','.','0','C'].forEach(n => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key-n' + (n === 'C' ? ' clr' : n === '.' ? ' dot' : '');
    b.textContent = n === 'C' ? '⌫' : n;
    b.onclick = () => {
      if (n === 'C') cobroDigits = cobroDigits.slice(0, -1);
      else if (n === '.') { if (!cobroDigits.includes('.')) cobroDigits += '.'; }
      else {
        if (cobroDigits.includes('.')) { const dec = cobroDigits.split('.')[1]; if (dec.length < 2) cobroDigits += n; }
        else cobroDigits += n;
      }
      actualizarCobro();
    };
    tn.appendChild(b);
  });
}
function finalizarVenta() {
  const total    = parseFloat(document.getElementById('cobroMonto').textContent.replace('$', '').replace(',', ''));
  const efectivo = cobroDigits ? (parseFloat(cobroDigits) || 0) : total;
  if (efectivo < total) { toast('El pago no es suficiente', true); return; }
  const fechaISO = nowISO(), ts = nowTS();
  const venta = {
    id: uid(), ts, fechaISO,
    fechaStr: new Date(fechaISO).toLocaleString('es-SV'),
    items: carrito.map(i => { const p = productos.find(x => x.id === i.id); return { id: String(i.id), nom: i.nom, cant: i.cant * (i.stockPorCant || 1), precio: i.venta, cat: (p && p.cat) ? p.cat : '', paqueteLabel: i.paqueteLabel || null }; }),
    total: total.toFixed(2), pago: efectivo.toFixed(2), vuelto: Math.max(0, efectivo - total).toFixed(2)
  };
  historial.unshift(venta);

  // Validar que ventasDia/Sem/Mes sean del período actual antes de sumar
  if (typeof _validarFechaReportes === 'function') _validarFechaReportes();
  carrito.forEach(i => {
    const p   = productos.find(x => x.id === i.id);
    const pid = String(i.id);
    const realCant = i.cant * (i.stockPorCant || 1);
    [ventasDia, ventasSem, ventasMes].forEach(r => {
      if (!r[pid]) r[pid] = { id: pid, nom: i.nom, cat: p ? (p.cat || '') : '', cant: 0, total: 0 };
      r[pid].cant  += realCant;
      r[pid].total += i.venta * i.cant;
      if (p && p.cat) r[pid].cat = p.cat;
      if (p && p.nom) r[pid].nom = p.nom;
    });
    if (p && p.lotes && p.lotes.length > 0) {
      let restante = realCant;
      p.lotes.forEach(lot => { if (restante > 0 && (lot.stockRestante || 0) > 0) { const d = Math.min(restante, lot.stockRestante); lot.stockRestante -= d; restante -= d; } });
    }
  });
  carrito = []; cobroDigits = '';
  salvar(); renderCarrito(); cerrarModal('modalCobro'); cerrarModal('modalVenta');
  toast(`✓ Cobrado — $${venta.total}`);
  autoBackup('Venta');
  if (typeof _registrarAccion === 'function') _registrarAccion('venta', '$' + venta.total + ' — ' + (venta.items||[]).map(i=>i.cant+'x '+i.nom).join(', '));

  // ── Venta atómica: RPC en Supabase garantiza stock correcto entre múltiples cajas ──
  const _syncFallback = () => {
    if (typeof syncAhora === 'function') { syncAhora('venta', venta); syncAhora('historial'); syncAhora('productos'); }
    if (typeof _autoEnviarSnapshot === 'function') setTimeout(_autoEnviarSnapshot, 200);
  };
  // Broadcast instantáneo a otros dispositivos (<100ms)
  if (typeof _broadcast === 'function') {
    const ventaBroadcast = { ...venta, items_json: JSON.stringify(venta.items || []) };
    _broadcast('venta', ventaBroadcast);
  }
  if (typeof registrarVentaAtomica === 'function') {
    registrarVentaAtomica(venta).then(res => {
      if (res.ok) {
        // RPC exitosa → actualizar stock local con valores reales de Supabase
        (res.stocks || []).forEach(({ id, stock }) => {
          const p = productos.find(x => String(x.id) === String(id));
          if (p && typeof stock === 'number') { p.stock = stock; actualizarStockFila(p); }
        });
        if (typeof _autoEnviarSnapshot === 'function') setTimeout(_autoEnviarSnapshot, 200);
        if (typeof syncAhora === 'function') syncAhora('productos');
      } else {
        _syncFallback(); // offline o error → flujo normal
      }
    }).catch(_syncFallback);
  } else {
    _syncFallback();
  }
  abrirModalFactura(venta);
  if (typeof _hookTicketAlVender === "function") _hookTicketAlVender(venta);
  if (typeof renderDashboardPro === "function") setTimeout(renderDashboardPro, 400);
}

// ===== 14B. FACTURA DIGITAL =====

let _ventaParaFactura = null;

function abrirModalFactura(venta) {
  _ventaParaFactura = venta;
  facturaNum++;
  idbSet('vpos_facturaNum', facturaNum).catch(console.error);
  document.getElementById('factNumDisplay').textContent = '#' + facturaNum;
  document.getElementById('inpFactCliente').value = '';
  document.getElementById('inpFactContacto').value = '';
  // Render preview
  renderFacturaPreview(venta);
  abrirModal('modalFactura');
}

function renderFacturaPreview(venta) {
  const items = venta.items || [];
  let rows = '';
  items.forEach(it => {
    const sub = (it.precio * it.cant).toFixed(2);
    rows += `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-weight:700;">${it.nom}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;">${it.cant}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">$${Number(it.precio).toFixed(2)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;color:#16a34a;">$${sub}</td>
    </tr>`;
  });
  document.getElementById('factPreviewBody').innerHTML = rows;
  document.getElementById('factPreviewTotal').textContent = '$' + venta.total;
}

function generarFacturaPDF() {
  if (!_ventaParaFactura) return;
  const cliente  = document.getElementById('inpFactCliente').value.trim() || 'Cliente';
  const contacto = document.getElementById('inpFactContacto').value.trim();
  const num      = facturaNum;
  const venta    = _ventaParaFactura;
  const items    = venta.items || [];

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });

  const W = doc.internal.pageSize.getWidth();
  const VERDE = [22, 163, 74];
  const NEGRO = [5, 46, 22];
  const GRIS  = [100, 116, 139];

  // ── Encabezado ──
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  doc.text('Despensa Económica', 14, 12);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Ventas', 14, 18);

  // Número de factura (derecha)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(`#${num}`, W - 14, 14, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('FACTURA DIGITAL', W - 14, 20, { align: 'right' });

  let y = 36;

  // ── Datos del cliente ──
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(10, y - 5, W - 20, contacto ? 18 : 13, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NEGRO);
  doc.text('CLIENTE:', 14, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(cliente, 38, y);
  if (contacto) {
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text('Tel/Email:', 14, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...NEGRO);
    doc.text(contacto, 38, y);
  }
  y += 10;

  // Fecha
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
  doc.text('Fecha: ' + venta.fechaStr, 14, y); y += 8;

  // ── Tabla de productos ──
  const cabeceras = [['Producto', 'Cant.', 'Precio', 'Total']];
  const filas = items.map(it => [
    it.nom,
    String(it.cant),
    '$' + Number(it.precio).toFixed(2),
    '$' + (it.precio * it.cant).toFixed(2)
  ]);

  doc.autoTable({
    head: cabeceras,
    body: filas,
    startY: y,
    styles: { fontSize: 9, textColor: NEGRO, font: 'helvetica', fontStyle: 'normal' },
    headStyles: { fillColor: VERDE, textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right',  cellWidth: 22 },
      3: { halign: 'right',  cellWidth: 24, fontStyle: 'bold', textColor: VERDE }
    },
    margin: { left: 10, right: 10 },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Total general ──
  doc.setFillColor(...VERDE);
  doc.roundedRect(10, y, W - 20, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text('TOTAL GENERAL', 16, y + 9);
  doc.setFontSize(14);
  doc.text('$' + venta.total, W - 14, y + 9, { align: 'right' });
  y += 20;

  // Pago y vuelto
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
  doc.text(`Pagó: $${venta.pago}  |  Vuelto: $${venta.vuelto}`, 14, y); y += 8;

  // Pie de página
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRIS);
  doc.text('¡Gracias por su compra!', W / 2, y, { align: 'center' });

  doc.save(`Factura_${num}_${cliente.replace(/\s+/g, '_')}.pdf`);
  toast(`✓ Factura #${num} descargada`);

  // Redirigir según contacto ingresado
  const contactoVal = document.getElementById('inpFactContacto').value.trim();
  if (contactoVal) {
    setTimeout(() => {
      const esEmail = contactoVal.includes('@');
      if (esEmail) {
        // Abrir Gmail con el correo y mensaje
        const asunto = encodeURIComponent(`Factura #${num} — Despensa Económica`);
        const cuerpo = encodeURIComponent(
          `Hola ${cliente},\n\nAdjunto encontrará su factura #${num} por un total de $${venta.total}.\n\nFecha: ${venta.fechaStr}\n\nGracias por su compra.\n— Despensa Económica`
        );
        window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contactoVal)}&su=${asunto}&body=${cuerpo}`, '_blank');
      } else {
        // Limpiar número: quitar todo excepto dígitos y +
        const tel = contactoVal.replace(/[^\d+]/g, '');
        const msg = encodeURIComponent(
          `Hola ${cliente}, su factura #${num} es por un total de *$${venta.total}*.\nFecha: ${venta.fechaStr}\n_Gracias por su compra — Despensa Económica_ 🛒`
        );
        window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
      }
    }, 600);
  }

  cerrarModal('modalFactura');
}

// ===== 15. REPORTES =====

function actualizarCats() {
  const sel = document.getElementById('selCat'); if (!sel) return;
  const val = sel.value;
  sel.innerHTML = '<option value="todas">Todas</option>';
  const cats = [...new Set(productos.map(p => p.cat).filter(Boolean))].sort();
  cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
  sel.value = cats.includes(val) ? val : 'todas';
  // También poblar el selector de categoría para PDF por rango
  const selPdf = document.getElementById('pdfCategoria'); if (!selPdf) return;
  const valPdf = selPdf.value;
  selPdf.innerHTML = '<option value="todas">📦 Todas las categorías</option>';
  cats.forEach(c => selPdf.innerHTML += `<option value="${c}">${c}</option>`);
  selPdf.value = cats.includes(valPdf) ? valPdf : 'todas';
}
function renderVentas() {
  const f     = document.getElementById('selCat')?.value || 'todas';
  const tbody = document.getElementById('tbodyVentas'); if (!tbody) return;
  // Enriquecer categoria desde el array de productos si el reporte no la trae
  const rows = Object.values(ventasDia || {}).map(v => {
    const prod = productos.find(p => String(p.id) === String(v.id));
    return { ...v, cat: (prod && prod.cat) ? prod.cat : (v.cat || '') };
  }).filter(v => f === 'todas' || (v.cat || '') === f).sort((a, b) => (b.total || 0) - (a.total || 0));
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="4"><div class="empty"><span class="empty-icon">📊</span>Sin ventas registradas</div></td></tr>`; return; }
  tbody.innerHTML = rows.map(v => {
    const catLabel = v.cat || '—';
    return `<tr><td class="td-bold">${v.nom||'—'}</td><td><span class="badge badge-green" style="font-size:11px;">${catLabel}</span></td><td class="mono">${Number(v.cant||0)}</td><td class="mono td-green">$${Number(v.total||0).toFixed(2)}</td></tr>`;
  }).join('');
}
// ── Filtro de fecha para Historial de Cobros ──────────────────────────────────
function _histFechaToStr(fechaISO) {
  // Devuelve 'YYYY-MM-DD' en hora local a partir de un ISO string
  try { const d = new Date(fechaISO); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  catch(e) { return ''; }
}
function histFiltroPreset(preset) {
  const desdeEl  = document.getElementById('histDesde');
  const hastaEl  = document.getElementById('histHasta');
  const hoy      = new Date();
  const hoyStr   = _histFechaToStr(hoy.toISOString());
  // Resaltar botón activo
  ['histBtnHoy','histBtnSemana','histBtnMes','histBtnTodo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.remove('active');
  });
  if (preset === 'hoy') {
    if (desdeEl) desdeEl.value = hoyStr;
    if (hastaEl) hastaEl.value = hoyStr;
    const b = document.getElementById('histBtnHoy'); if (b) b.classList.add('active');
  } else if (preset === 'semana') {
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay()+6)%7));
    if (desdeEl) desdeEl.value = _histFechaToStr(lunes.toISOString());
    if (hastaEl) hastaEl.value = hoyStr;
    const b = document.getElementById('histBtnSemana'); if (b) b.classList.add('active');
  } else if (preset === 'mes') {
    const primeroDeMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    if (desdeEl) desdeEl.value = _histFechaToStr(primeroDeMes.toISOString());
    if (hastaEl) hastaEl.value = hoyStr;
    const b = document.getElementById('histBtnMes'); if (b) b.classList.add('active');
  } else if (preset === 'todo') {
    if (desdeEl) desdeEl.value = '';
    if (hastaEl) hastaEl.value = '';
    const b = document.getElementById('histBtnTodo'); if (b) b.classList.add('active');
  }
  // 'custom' no activa ningún botón (el usuario escribió fechas manualmente)
  renderHistorial();
}
function _histGetFiltro() {
  const desde = document.getElementById('histDesde')?.value || '';
  const hasta = document.getElementById('histHasta')?.value || '';
  return { desde, hasta };
}
// ──────────────────────────────────────────────────────────────────────────────
function renderHistorial() {
  const div      = document.getElementById('historialList'); if (!div) return;
  const acumEl   = document.getElementById('histAcum');
  const acumVal  = document.getElementById('histAcumVal');
  const contEl   = document.getElementById('histContador');

  // Aplicar filtro de fecha
  const { desde, hasta } = _histGetFiltro();
  const filtrado = historial.filter((v, _realIdx) => {
    if (!desde && !hasta) return true;
    const fechaStr = _histFechaToStr(v.fechaISO || '');
    if (!fechaStr) return true; // sin fecha → siempre mostrar
    if (desde && fechaStr < desde) return false;
    if (hasta && fechaStr > hasta) return false;
    return true;
  });

  // Contador de cobros visibles
  if (contEl) {
    if (desde || hasta) {
      contEl.textContent = `${filtrado.length} de ${historial.length} cobro${historial.length !== 1 ? 's' : ''}`;
    } else {
      contEl.textContent = historial.length ? `${historial.length} cobro${historial.length !== 1 ? 's' : ''}` : '';
    }
  }

  if (!filtrado.length) {
    div.innerHTML = historial.length
      ? `<div class="empty"><span class="empty-icon">🔍</span>Sin cobros en el rango de fechas seleccionado</div>`
      : `<div class="empty"><span class="empty-icon">🕓</span>Sin cobros registrados</div>`;
    if (acumEl) acumEl.style.display = 'none';
    return;
  }

  const totalAcum = filtrado.reduce((s, v) => s + parseFloat(v.total || 0), 0);
  if (acumEl) acumEl.style.display = 'flex';
  if (acumVal) acumVal.textContent = '$' + totalAcum.toFixed(2);

  div.innerHTML = filtrado.map((v) => {
    // Índice real en historial para editar correctamente
    const idx = historial.indexOf(v);
    // Formatear fecha
    let fechaMostrar = v.fechaStr || '—';
    if (fechaMostrar && fechaMostrar.includes('T') && fechaMostrar.includes('Z')) {
      try { fechaMostrar = new Date(fechaMostrar).toLocaleString('es-SV'); } catch(e) {}
    }
    const totalFmt  = parseFloat(v.total  || 0).toFixed(2);
    const pagoFmt   = parseFloat(v.pago   || 0).toFixed(2);
    const vueltoFmt = parseFloat(v.vuelto || 0).toFixed(2);
    return `
    <div class="hist-item">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div class="hist-date">📅 ${fechaMostrar}</div>
        <button class="btn btn-amber" style="padding:4px 10px;font-size:11px;" onclick="abrirEditarCobro(${idx})">✏️ Editar</button>
      </div>
      <div class="hist-prods">${(v.items||[]).map(i => `${i.cant}× ${i.nom}`).join(', ')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
        <span style="font-size:12px;color:var(--text-muted);">Pagó: $${pagoFmt} | Vuelto: $${vueltoFmt}</span>
        <span class="hist-total">$${totalFmt}</span>
      </div>
    </div>`;
  }).join('');
}
function renderCritico() {
  const tbody = document.getElementById('tbodyCritico'); if (!tbody) return;
  const lista = productos.filter(p => (p.stock || 0) <= (p.min || 0));
  if (!lista.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><span class="empty-icon">✅</span>Sin stock crítico</div></td></tr>`; return; }
  tbody.innerHTML = lista.map(p => `<tr class="row-critico"><td><code style="font-size:11px;">${p.cod||'—'}</code></td><td class="td-bold">${p.nom||'—'}</td><td>${p.cat||''}</td><td><span class="badge badge-red">⚠ ${p.stock||0}</span></td><td class="mono" style="color:var(--text-muted)">${p.min||0}</td></tr>`).join('');
}
function renderPagos() {
  const tbody   = document.getElementById('tbodyGastos');
  const resumen = document.getElementById('gastosResumen'); if (!tbody) return;
  const lista   = pagos.filter(g => esMesActual(g.fechaISO));
  const totalFacturas = lista.filter(g => g.cat === 'FACTURA').reduce((s, g) => s + Number(g.monto || 0), 0);
  const totalGastos   = lista.filter(g => g.cat === 'GASTO').reduce((s, g) => s + Number(g.monto || 0), 0);
  if (resumen) {
    resumen.innerHTML = `
      <div class="stat-box" style="border-color:rgba(29,78,216,0.3);"><div class="s-lbl" style="color:var(--blue);">🧾 Facturas</div><div class="s-val" style="color:var(--blue);font-size:18px;">$${totalFacturas.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${lista.filter(g=>g.cat==='FACTURA').length} pagos</div></div>
      <div class="stat-box" style="border-color:rgba(220,38,38,0.3);"><div class="s-lbl" style="color:var(--red);">💸 Gastos</div><div class="s-val" style="color:var(--red);font-size:18px;">$${totalGastos.toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${lista.filter(g=>g.cat==='GASTO').length} gastos</div></div>
      <div class="stat-box" style="border-color:rgba(220,38,38,0.4);background:rgba(220,38,38,0.03);"><div class="s-lbl" style="color:var(--red);">📊 Total Mes</div><div class="s-val" style="color:var(--red);font-size:18px;">$${(totalFacturas+totalGastos).toFixed(2)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${lista.length} registros</div></div>
    `;
  }
  if (!lista.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><span class="empty-icon">💸</span>Sin gastos este mes</div></td></tr>`; return; }
  tbody.innerHTML = lista.map(g => {
    const esFact = g.cat === 'FACTURA';
    return `<tr>
      <td style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${g.fechaStr||'—'}</td>
      <td class="td-bold">${g.concepto||'—'}</td>
      <td>${esFact ? `<span class="badge badge-blue">🧾 FACTURA</span>` : `<span class="badge badge-red">💸 GASTO</span>`}</td>
      <td class="mono td-red">$${Number(g.monto||0).toFixed(2)}</td>
      <td><button class="btn btn-danger" onclick="borrarGasto(${g.id})" style="padding:5px 8px;font-size:11px;">✕</button></td>
    </tr>`;
  }).join('');
}
function guardarGasto(e, tipo) {
  e.preventDefault();
  if (typeof _puedeHacer === 'function' && !_puedeHacer('gastos')) { toast('No tienes permiso para registrar gastos', true); return; }
  const descId  = tipo === 'FACTURA' ? 'inpFDesc' : 'inpGDesc';
  const montoId = tipo === 'FACTURA' ? 'inpFMonto' : 'inpGMonto';
  const monto   = parseFloat(document.getElementById(montoId).value) || 0;
  if (monto <= 0) { toast('Monto inválido', true); return; }
  const fechaISO = nowISO();
  pagos.unshift({ id: Date.now(), concepto: document.getElementById(descId).value.toUpperCase().trim(), cat: tipo, monto, fechaISO, ts: nowTS(), fechaStr: new Date(fechaISO).toLocaleString('es-SV') });
  e.target.reset();
  salvar();
  toast(`${tipo === 'FACTURA' ? '🧾 Factura' : '💸 Gasto'} registrado — $${monto.toFixed(2)}`);
  autoBackup(tipo === 'FACTURA' ? 'Factura' : 'Gasto');
  // Sync en tiempo real
  if (typeof syncAhora === 'function') syncAhora('pagos');
}
function borrarGasto(id) {
  if (confirm('¿Eliminar este registro?')) {
    // Registrar ID como eliminado para que no vuelva desde Supabase
    const idStr = String(id);
    if (!pagosEliminados.includes(idStr)) pagosEliminados.push(idStr);
    // FIX: comparar como string — Supabase devuelve IDs como string pero el botón
    // pasa un número. La comparación estricta (!==) fallaba y el pago no se borraba.
    pagos = pagos.filter(g => String(g.id) !== idStr); salvar(); toast('Registro eliminado', true);
    if (typeof syncBorrarPago === 'function') syncBorrarPago(id);
    // FIX: notificar a otros teléfonos conectados para que borren el pago en tiempo real
    if (typeof _broadcast === 'function') _broadcast('pago_borrado', { id: idStr });
  }
}
function renderBalance() {
  const card = document.getElementById('balanceMesCard');
  const lbl  = document.getElementById('balanceMesLabel'); if (!card) return;
  const now  = new Date();
  const mesNombre = now.toLocaleDateString('es-SV', { month: 'long', year: 'numeric' });
  if (lbl) lbl.textContent = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
  const totalIngresos = totalReporte(ventasMes);
  const totalGastos   = pagos.filter(g => esMesActual(g.fechaISO)).reduce((s, g) => s + Number(g.monto || 0), 0);
  const balance = totalIngresos - totalGastos;
  const esPos   = balance >= 0;
  card.innerHTML = `
    <div class="balance-item"><div class="b-lbl">💰 Ingresos del Mes</div><div class="b-val b-val-green">$${totalIngresos.toFixed(2)}</div><div class="b-sub">${Object.keys(ventasMes).length} producto(s) vendido(s)</div></div>
    <div class="balance-item"><div class="b-lbl">💸 Gastos del Mes</div><div class="b-val b-val-red">$${totalGastos.toFixed(2)}</div><div class="b-sub">${pagos.filter(g=>esMesActual(g.fechaISO)).length} gasto(s) registrado(s)</div></div>
    <div class="balance-item ${esPos ? 'net' : 'net-neg'}"><div class="b-lbl">${esPos ? '📈' : '📉'} Balance Neto</div><div class="b-val" style="color:${esPos?'var(--green)':'var(--red)'};">$${balance.toFixed(2)}</div><div class="b-sub" style="color:${esPos?'var(--green)':'var(--red)'};">${esPos ? '✓ Mes positivo' : '⚠ Mes en pérdida'}</div></div>
  `;
}

// ===== 16. PDF =====

function generarPDFInventarioActual() {
  if (!window.jspdf) { toast('jsPDF no disponible', true); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-SV') + ' ' + now.toLocaleTimeString('es-SV');

  // Header
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('INVENTARIO ACTUAL — DESPENSA ECONÓMICA', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(fechaStr, 297 - 14, 14, { align: 'right' });

  // Build table rows
  const filtro = (document.getElementById('filtroInv')?.value || '').toUpperCase();
  const lista  = filtro
    ? productos.filter(p => (p.nom||'').toUpperCase().includes(filtro) || (p.cod||'').toUpperCase().includes(filtro) || (p.cat||'').toUpperCase().includes(filtro))
    : [...productos];

  const body = lista.map(p => [
    p.cod || '—',
    p.nom || '—',
    p.cat || '—',
    `$${(p.compra||0).toFixed(2)}`,
    `$${(p.venta||0).toFixed(2)}`,
    String(p.stock || 0),
    `$${((p.venta||0)*(p.stock||0)).toFixed(2)}`
  ]);

  const totalVenta = lista.reduce((s, p) => s + (p.venta||0)*(p.stock||0), 0);

  doc.autoTable({
    head: [['Código','Nombre','Categoría','Compra','Venta','Stock','Total Venta']],
    body,
    startY: 28,
    styles: { fontSize: 9, textColor: [15, 23, 42] },
    headStyles: { fillColor: [22, 163, 74], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    columnStyles: {
      0: { cellWidth: 28 },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] }
    },
    foot: [[
      { content: `${lista.length} productos`, colSpan: 5, styles: { fontStyle: 'bold', fontSize: 10 } },
      { content: 'TOTAL:', styles: { fontStyle: 'bold', halign: 'right', fontSize: 10 } },
      { content: `$${totalVenta.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right', fontSize: 11, textColor: [22, 101, 52] } }
    ]],
    footStyles: { fillColor: [240, 253, 244], textColor: [15, 23, 42] }
  });

  doc.save(`Inventario_${now.toLocaleDateString('es-SV').replace(/\//g,'-')}.pdf`);
  toast('✓ PDF de inventario descargado');
}

function generarPDF(tipo) {
  const data   = tipo === 'mensual' ? ventasMes : tipo === 'semanal' ? ventasSem : ventasDia;
  const filtro = document.getElementById('selCat')?.value || 'todas';
  const { jsPDF } = window.jspdf; const doc = new jsPDF(); const now = new Date();
  doc.setFontSize(20); doc.setFont("helvetica","bold"); doc.setTextColor(22,163,74);
  doc.text(`REPORTE ${tipo.toUpperCase()}`, 14, 18);
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(100,116,139);
  doc.text(`${filtro} | ${now.toLocaleDateString('es-SV')} ${now.toLocaleTimeString('es-SV')}`, 14, 25);
  const cats = {}; let totalGlobal = 0;
  Object.values(data || {}).forEach(v => {
    if (filtro !== 'todas' && (v.cat || '') !== filtro) return;
    const cat = v.cat || 'SIN CATEGORÍA';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push([v.nom||'—', Number(v.cant||0), `$${Number(v.total||0).toFixed(2)}`]);
    totalGlobal += Number(v.total||0);
  });
  let y = 32;
  for (const c in cats) {
    doc.autoTable({ head: [[{content:'▸ '+c,colSpan:3,styles:{fillColor:[22,163,74],textColor:[255,255,255],fontStyle:'bold'}}],['Producto','Cant.','Total']], body: cats[c].sort((a,b)=>b[1]-a[1]), startY: y, styles:{fontSize:10,textColor:[15,23,42]}, headStyles:{fillColor:[240,253,244],textColor:[22,101,52],fontSize:9}, alternateRowStyles:{fillColor:[240,253,244]}, columnStyles:{2:{halign:'right',fontStyle:'bold'}} });
    y = doc.lastAutoTable.finalY + 8;
  }
  doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(22,163,74);
  doc.text(`TOTAL VENTAS: $${totalGlobal.toFixed(2)}`, 14, y + 4);
  doc.save(`Despensa_Economica_${tipo}_${now.toLocaleDateString('es-SV').replace(/\//g,'-')}.pdf`);
}

function generarPDFRango() {
  const desdeVal = document.getElementById('pdfFechaDesde').value;
  const hastaVal = document.getElementById('pdfFechaHasta').value;
  const catFiltro = document.getElementById('pdfCategoria')?.value || 'todas';
  if (!desdeVal || !hastaVal) { toast('Selecciona fecha de inicio y fin', true); return; }
  const desde = new Date(desdeVal + 'T00:00:00'), hasta = new Date(hastaVal + 'T23:59:59');
  if (desde > hasta) { toast('La fecha de inicio debe ser antes que la final', true); return; }
  const acum = {};
  historial.forEach(v => {
    const ts = v.ts || (v.fechaISO ? Date.parse(v.fechaISO) : 0);
    if (!ts || new Date(ts) < desde || new Date(ts) > hasta) return;
    (v.items || []).forEach(item => {
      const key = item.id ? String(item.id) : ('legacy:' + item.nom);
      // Buscar categoria siempre desde el array de productos para garantizar que se muestre
      const prodRef = item.id ? productos.find(p => String(p.id) === String(item.id)) : null;
      const catReal = (prodRef && prodRef.cat) ? prodRef.cat : (item.cat || '');
      if (!acum[key]) acum[key] = { nom: item.nom||'—', cat: catReal, cant: 0, total: 0 };
      else if (!acum[key].cat && catReal) acum[key].cat = catReal;
      acum[key].cant  += Number(item.cant||0);
      acum[key].total += Number(item.cant||0) * Number(item.precio||0);
    });
  });
  // Segunda pasada: asegurar categoria para cualquier producto que aun no la tenga
  for (const k in acum) {
    if (!acum[k].cat && !k.startsWith('legacy:')) {
      const p = productos.find(p => String(p.id) === k);
      if (p && p.cat) acum[k].cat = p.cat;
    }
    if (!acum[k].cat) acum[k].cat = 'SIN CATEGORÍA';
  }
  // Aplicar filtro de categoría
  const acumFiltrado = {};
  for (const k in acum) {
    const cat = acum[k].cat || 'SIN CATEGORÍA';
    if (catFiltro === 'todas' || cat === catFiltro) acumFiltrado[k] = acum[k];
  }
  const { jsPDF } = window.jspdf; const doc = new jsPDF(); const now = new Date();
  const rangoStr = `${desde.toLocaleDateString('es-SV')} al ${hasta.toLocaleDateString('es-SV')}`;
  const catLabel = catFiltro === 'todas' ? 'Todas las categorías' : catFiltro;
  doc.setFontSize(20); doc.setFont("helvetica","bold"); doc.setTextColor(22,163,74);
  doc.text('REPORTE POR PERÍODO', 14, 18);
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(100,116,139);
  doc.text(`Del ${rangoStr}`, 14, 25);
  doc.text(`Categoría: ${catLabel}`, 14, 30);
  if (!Object.keys(acumFiltrado).length) { doc.setFontSize(12); doc.setTextColor(220,38,38); doc.text('No hay ventas registradas en este período' + (catFiltro !== 'todas' ? ` para la categoría "${catFiltro}".` : '.'), 14, 42); doc.save(`Reporte_${desdeVal}_${hastaVal}${catFiltro !== 'todas' ? '_' + catFiltro : ''}.pdf`); toast('PDF generado (sin ventas en ese período)'); return; }
  // Ordenar categorias alfabeticamente
  const cats = {}; let totalGlobal = 0;
  for (const k in acumFiltrado) {
    const cat = acumFiltrado[k].cat || 'SIN CATEGORÍA';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push([acumFiltrado[k].nom, acumFiltrado[k].cant, `$${acumFiltrado[k].total.toFixed(2)}`]);
    totalGlobal += acumFiltrado[k].total;
  }
  const catsOrdenadas = Object.keys(cats).sort();
  const diasRango = Math.max(1, Math.round((hasta - desde) / (1000*60*60*24)) + 1);
  let y = 38;
  for (const c of catsOrdenadas) {
    doc.autoTable({
      head: [[{content: '▸ ' + c, colSpan: 3, styles: {fillColor:[22,163,74], textColor:[255,255,255], fontStyle:'bold', fontSize:11}}], ['Producto','Cant.','Total']],
      body: cats[c].sort((a,b) => b[1] - a[1]),
      startY: y,
      styles: {fontSize:10, textColor:[15,23,42]},
      headStyles: {fillColor:[240,253,244], textColor:[22,101,52], fontSize:9},
      alternateRowStyles: {fillColor:[240,253,244]},
      columnStyles: {2:{halign:'right', fontStyle:'bold'}}
    });
    y = doc.lastAutoTable.finalY + 8;
  }
  doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(22,163,74);
  doc.text(`TOTAL DEL PERÍODO: $${totalGlobal.toFixed(2)}`, 14, y + 4);
  doc.setFontSize(10); doc.setTextColor(100,116,139);
  doc.text(`Días: ${diasRango} | Promedio diario: $${(totalGlobal/diasRango).toFixed(2)}`, 14, y + 12);
  doc.save(`Reporte_${desdeVal}_${hastaVal}${catFiltro !== 'todas' ? '_' + catFiltro : ''}.pdf`);
  toast(`✓ PDF generado — ${rangoStr}${catFiltro !== 'todas' ? ' · ' + catFiltro : ''}`);
}

// ===== 17. DESTACADOS =====

function cambiarPeriodoDestacados(periodo) {
  _destPeriodo = periodo;
  ['semana1','semana2','semana3','mes'].forEach(p => {
    const btn = document.getElementById('destBtn_' + p); if (btn) btn.classList.toggle('active', p === periodo);
  });
  renderDestacados();
}
function obtenerVentasPorPeriodo(diasAtras) {
  const ahora = Date.now(), desde = ahora - diasAtras * 86400000;
  const acum = {};
  historial.forEach(v => {
    const ts = v.ts || (v.fechaISO ? Date.parse(v.fechaISO) : 0);
    if (!ts || ts < desde || ts > ahora) return;
    (v.items || []).forEach(it => {
      const key = it.id ? String(it.id) : ('legacy:' + it.nom);
      if (!acum[key]) acum[key] = { id: key, nom: it.nom, cat: it.cat || '', cant: 0, total: 0 };
      acum[key].cant  += Number(it.cant || 0);
      acum[key].total += Number(it.cant || 0) * Number(it.precio || 0);
    });
  });
  for (const k in acum) { if (!acum[k].cat && !k.startsWith('legacy:')) { const p = productos.find(p => String(p.id) === k); if (p) acum[k].cat = p.cat || ''; } }
  if (Object.keys(acum).length) return acum;
  return diasAtras <= 7 ? ventasSem : ventasMes;
}
function renderDestacados() {
  const conf  = PERIODOS_DEST[_destPeriodo];
  const datos = obtenerVentasPorPeriodo(conf.dias);
  const lbl   = document.getElementById('destPeriodoLabel'); if (lbl) lbl.textContent = conf.label;
  const lista = Object.values(datos || {}).map(v => ({ nom:v.nom||'—', cat:v.cat||'SIN CATEGORÍA', cant:Number(v.cant||0), total:Number(v.total||0) })).filter(x => x.cant > 0).sort((a,b) => b.cant - a.cant);
  const totalVentas = lista.reduce((s,x) => s+x.total, 0), totalItems = lista.reduce((s,x) => s+x.cant, 0);
  const cats = [...new Set(lista.map(x => x.cat))];
  const resGrid = document.getElementById('destResumenGrid');
  if (resGrid) resGrid.innerHTML = `
    <div class="stat-box"><div class="s-lbl">Total Vendido</div><div class="s-val">$${totalVentas.toFixed(2)}</div></div>
    <div class="stat-box"><div class="s-lbl">Ítems Vendidos</div><div class="s-val">${totalItems}</div></div>
    <div class="stat-box"><div class="s-lbl">Productos</div><div class="s-val">${lista.length}</div></div>
    <div class="stat-box"><div class="s-lbl">Categorías</div><div class="s-val">${cats.length}</div></div>
  `;
  const podio = document.getElementById('destPodio');
  if (podio) podio.innerHTML = !lista.length ? `<div class="empty" style="grid-column:1/-1"><span class="empty-icon">📊</span>Sin ventas en este período</div>` : lista.slice(0, 3).map((p, i) => `<div class="stat-box"><div class="s-lbl">${i===0?'🥇':'#'+(i+1)} ${p.nom}</div><div class="s-val">${p.cant}</div><div style="font-size:11px;color:var(--text-muted);font-weight:800;">${p.cat} · $${p.total.toFixed(2)}</div></div>`).join('');
  const catContainer = document.getElementById('destCategorias'); if (!catContainer) return;
  if (!lista.length) { catContainer.innerHTML = `<div class="empty"><span class="empty-icon">🏆</span>No hay ventas registradas en este período.</div>`; return; }
  const porCat = {};
  lista.forEach(i => { porCat[i.cat] ??= []; porCat[i.cat].push(i); });
  catContainer.innerHTML = Object.entries(porCat).sort((a,b) => b[1].reduce((s,x)=>s+x.cant,0) - a[1].reduce((s,x)=>s+x.cant,0)).map(([cat, items]) => `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-header"><div class="card-title"><div class="card-icon">📦</div>${cat}</div><span class="mono" style="color:var(--green);font-weight:900;">${items.reduce((s,x)=>s+x.cant,0)} uds</span></div>
      <div class="card-body">${items.slice(0,10).map((it,idx)=>`<div style="display:flex;justify-content:space-between;border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:#fff;margin-bottom:6px;"><div><div style="font-weight:900;color:var(--text);">${idx+1}. ${it.nom}</div><div style="font-size:11px;color:var(--text-muted);font-weight:800;">${it.cant} uds</div></div><div class="mono td-green">$${it.total.toFixed(2)}</div></div>`).join('')}</div>
    </div>
  `).join('');
}

// ===== 18. REINICIOS =====

function reiniciarDia() {
  if (typeof _puedeHacer === 'function' && !_puedeHacer('reiniciar')) { toast('Solo el Admin puede reiniciar', true); return; }
  if (!confirm('¿Reiniciar el reporte del día?\n\nSolo se borra el contador del día.\nEl historial de cobros, ventas del mes y pagos NO se tocan.')) return;

  // Solo resetear el acumulado diario — NO tocar historial, ventasMes ni pagos
  ventasDia = {};

  // ── FIX: guardar timestamp del reset para que el dashboard y el recálculo
  //         desde historial no restauren ventas anteriores al reset ──
  const tsReset = new Date().toISOString();
  localStorage.setItem('vpos_reinicioDiaTs', tsReset);
  localStorage.setItem('vpos_reinicioDiaFecha', new Date().toDateString());

  localStorage.setItem('vpos_reporteFechaDia', new Date().toDateString());
  salvar();
  actualizarTodo();
  toast('✓ Reporte del día reiniciado (cobros y mes intactos)');

  // ── FIX BUG 1 & 2: Avisar a TODOS los otros teléfonos vía broadcast ──
  // Así todos aplican el mismo reset al instante, sin doble conteo en capital total
  if (typeof _broadcast === 'function') {
    _broadcast('reinicio_dia', { ts: tsReset, fecha: new Date().toDateString() });
  }
  // Subir snapshot limpio para teléfonos que inicien sesión después
  // + snapshot_push para notificar a teléfonos que estaban desconectados al momento del reset
  setTimeout(() => {
    if (typeof _autoEnviarSnapshot === 'function') _autoEnviarSnapshot();
    if (typeof _broadcast === 'function') _broadcast('snapshot_push', { tienda: typeof _getTiendaId === 'function' ? _getTiendaId() : '' });
  }, 1000);
  // NO llamamos syncAhora('venta_diaria') aquí — evita que la fusión automática
  // traiga de vuelta ventasDiarias y confunda el capital total
}
function abrirModalReiniciarSemana() {
  if (typeof _puedeHacer === 'function' && !_puedeHacer('reiniciar')) { toast('Solo el Admin puede reiniciar', true); return; }
  const catsEnSem = {};
  Object.values(ventasSem || {}).forEach(v => { const cat = v.cat||'SIN CATEGORÍA'; catsEnSem[cat] ??= {cant:0,total:0}; catsEnSem[cat].cant+=Number(v.cant||0); catsEnSem[cat].total+=Number(v.total||0); });
  const grid = document.getElementById('catGridSem'); grid.innerHTML = '';
  if (!Object.keys(catsEnSem).length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="empty-icon">📊</span>No hay ventas registradas esta semana</div>`; abrirModal('modalReiniciarSem'); return; }
  const btnTodo = document.createElement('button'); btnTodo.className = 'btn btn-danger'; btnTodo.style.gridColumn = '1/-1'; btnTodo.textContent = '⚠️ REINICIAR TODAS LAS CATEGORÍAS';
  btnTodo.onclick = () => { if (confirm('¿Reiniciar TODA la semana?\n\nSolo se borra el contador semanal.\nEl historial de cobros, ventas del mes y pagos NO se tocan.')) { ventasSem = {}; salvar(); cerrarModal('modalReiniciarSem'); toast('✓ Semana reiniciada (cobros y mes intactos)'); if (typeof _broadcast === 'function') _broadcast('reinicio_sem', { ventasSem: {} }); if (typeof _autoEnviarSnapshot === 'function') setTimeout(_autoEnviarSnapshot, 800); } };
  grid.appendChild(btnTodo);
  Object.keys(catsEnSem).sort().forEach(cat => {
    const info = catsEnSem[cat]; const btn = document.createElement('button'); btn.className='btn btn-ghost'; btn.style.padding='12px'; btn.style.justifyContent='space-between';
    btn.innerHTML=`<span style="font-weight:900;">${cat}</span><span class="mono" style="color:var(--green);">$${info.total.toFixed(2)}</span>`;
    btn.onclick = () => { if (confirm(`¿Reiniciar la categoría "${cat}"?`)) { const nuevo={}; for(const pid in ventasSem){ if((ventasSem[pid].cat||'SIN CATEGORÍA')!==cat) nuevo[pid]=ventasSem[pid]; } ventasSem=nuevo; salvar(); cerrarModal('modalReiniciarSem'); toast(`✓ "${cat}" reiniciada`); if (typeof _broadcast === 'function') _broadcast('reinicio_sem', { ventasSem }); if (typeof _autoEnviarSnapshot === 'function') setTimeout(_autoEnviarSnapshot, 800); } };
    grid.appendChild(btn);
  });
  abrirModal('modalReiniciarSem');
}
function reiniciarHistorial() {
  if (typeof _puedeHacer === 'function' && !_puedeHacer('reiniciar')) { toast('Solo el Admin puede borrar el historial', true); return; }
  if (!confirm('¿Borrar todo el historial de cobros?')) return;

  // ── LIMPIAR historial y ventasDiarias — SIN restaurar stock al inventario ──
  // Para devolver unidades al stock, usa el botón "Devolver" dentro de cada cobro individual.
  historial = []; ventasDiarias = [];
  // FIX: recalcular ventasMes/ventasDia/ventasSem en este teléfono también
  if (typeof _recalcularReportesDesdeHistorial === 'function') _recalcularReportesDesdeHistorial();
  salvar();

  toast('Historial borrado');

  // 1️⃣ Broadcast instantáneo → teléfonos conectados actualizan en tiempo real
  // El payload incluye ventasDiarias:[] para que el otro teléfono las borre de una vez.
  if (typeof _broadcast === 'function') _broadcast('historial_actualizado', { historial: [], ventasDiarias: [] });
  // 2️⃣ Subir a Supabase (borra filas en DB) → teléfonos desconectados no cargan datos viejos al reconectar
  if (typeof syncAhora === 'function') { syncAhora('historial'); syncAhora('venta_diaria'); }
  // 3️⃣ Subir snapshot propio SOLO después de que Supabase procesó los DELETEs (5s de margen).
  // ── FIX LIMPIAR: NO emitir 'snapshot_push' aquí ──
  // snapshot_push causaba que el OTRO teléfono ejecutara _autoCargarDesdeSupa() antes
  // de que el DELETE de Supabase terminara, restaurando las ventasDiarias recién borradas.
  // El broadcast del paso 1 ya sincroniza los teléfonos conectados en <100ms.
  // El snapshot subido aquí cubrirá teléfonos que se reconecten más tarde.
  setTimeout(() => {
    if (typeof _autoEnviarSnapshot === 'function') _autoEnviarSnapshot();
  }, 5000);
}

// ===== 19. EDITAR COBRO =====

let _editCobroIdx = -1, _editCobroTemp = null;
function abrirEditarCobro(idx) { _editCobroIdx = idx; _editCobroTemp = (historial[idx].items||[]).map(i => ({...i, devuelto:false})); renderEditarCobro(); abrirModal('modalEditarCobro'); }
function renderEditarCobro() {
  const v = historial[_editCobroIdx];
  document.getElementById('editCobroFecha').textContent = '📅 ' + (v.fechaStr||'—');
  document.getElementById('editCobroItems').innerHTML = _editCobroTemp.map((item,i) => {
    if (item.devuelto) return `<div class="edit-cobro-item" style="opacity:0.5;"><div class="edit-cobro-info"><div class="edit-cobro-nom" style="text-decoration:line-through;">${item.nom}</div><div class="edit-cobro-meta">${item.cant} × $${Number(item.precio||0).toFixed(2)}</div></div><button class="btn btn-ghost" onclick="deshacer_devolucion(${i})" style="padding:5px 9px;font-size:11px;margin-left:8px;">↩ Deshacer</button></div>`;
    return `<div class="edit-cobro-item"><div class="edit-cobro-info"><div class="edit-cobro-nom">${item.nom}</div><div class="edit-cobro-meta">${item.cant} × $${Number(item.precio||0).toFixed(2)}</div></div><span class="edit-cobro-price">$${(Number(item.cant||0)*Number(item.precio||0)).toFixed(2)}</span><button class="btn btn-danger" onclick="marcarDevolucion(${i})" style="padding:5px 10px;font-size:12px;">✕ Devolver</button></div>`;
  }).join('');
  document.getElementById('editCobroTotal').textContent = '$' + _editCobroTemp.filter(i=>!i.devuelto).reduce((s,i)=>s+Number(i.cant||0)*Number(i.precio||0),0).toFixed(2);
}
function marcarDevolucion(i) { _editCobroTemp[i].devuelto = true; renderEditarCobro(); }
function deshacer_devolucion(i) { _editCobroTemp[i].devuelto = false; renderEditarCobro(); }
function guardarEdicionCobro() {
  const v = historial[_editCobroIdx];
  const devolver  = _editCobroTemp.filter(i => i.devuelto);
  const activos   = _editCobroTemp.filter(i => !i.devuelto);
  if (!devolver.length) { toast('No marcaste ningún producto para devolver', true); return; }

  // ── FIX: bloquear restauración de inventario si el día ya tiene venta diaria registrada ──
  const fechaVenta = v.fechaISO ? v.fechaISO.split('T')[0] : null;
  const diaYaRegistrado = fechaVenta && (ventasDiarias || []).some(vd => vd.fecha === fechaVenta);
  if (diaYaRegistrado) {
    const fechaStr = fechaVenta ? new Date(fechaVenta + 'T12:00:00').toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' }) : fechaVenta;
    if (!confirm(`⚠️ El día ${fechaStr} ya tiene ventas registradas en el historial diario.\n\nNo se puede devolver al inventario una venta de un día ya cerrado.\n\nSi necesitas ajustar el inventario, hazlo manualmente desde la sección Inventario.`)) return;
    // Solo corregir el historial, SIN restaurar stock
    if (!activos.length) {
      historial.splice(_editCobroIdx, 1);
    } else {
      const nuevoTotal = activos.reduce((s,i) => s+Number(i.cant||0)*Number(i.precio||0), 0);
      historial[_editCobroIdx] = { ...v, items: activos.map(i => { const {devuelto,...rest}=i; return rest; }), total: nuevoTotal.toFixed(2) };
    }
    salvar(); cerrarModal('modalEditarCobro'); toast('✓ Cobro corregido — inventario sin cambios (día ya registrado)', false, true);
    if (typeof syncAhora === 'function') syncAhora('productos');
    if (typeof _broadcast === 'function') _broadcast('historial_actualizado', { historial: historial.map(v => ({...v, img: undefined})) });
    return;
  }

  if (!activos.length) {
    if (!confirm('Se devolverán TODOS los productos. Esto eliminará el cobro completo. ¿Continuar?')) return;
    historial.splice(_editCobroIdx, 1);
  } else {
    const nuevoTotal = activos.reduce((s,i) => s+Number(i.cant||0)*Number(i.precio||0), 0);
    historial[_editCobroIdx] = { ...v, items: activos.map(i => { const {devuelto,...rest}=i; return rest; }), total: nuevoTotal.toFixed(2) };
  }

  // Restaurar stock y recolectar productos afectados para broadcast
  const productosAfectados = [];
  devolver.forEach(item => {
    const pid  = item.id ? String(item.id) : null;
    if (pid) {
      const prod = productos.find(p => String(p.id) === pid);
      if (prod) {
        prod.stock += Number(item.cant || 0);
        prod._ts = Date.now();
        if (!productosAfectados.some(p => String(p.id) === pid)) productosAfectados.push(prod);
      }
      [ventasDia, ventasSem, ventasMes].forEach(rep => {
        if (rep[pid]) { rep[pid].cant -= Number(item.cant||0); rep[pid].total -= Number(item.cant||0)*Number(item.precio||0); if(rep[pid].cant<=0) delete rep[pid]; }
      });
    } else {
      const prod = productos.find(p => p.nom === item.nom);
      if (prod) {
        prod.stock += Number(item.cant || 0);
        prod._ts = Date.now();
        if (!productosAfectados.some(p => p.nom === item.nom)) productosAfectados.push(prod);
      }
    }
  });

  salvar(); cerrarModal('modalEditarCobro'); toast('✓ Devolución registrada — stock restaurado');
  if (typeof syncAhora === 'function') syncAhora('productos');

  // ── FIX DESCUADRE: broadcast historial + productos afectados juntos ──
  // El evento 'historial_actualizado' incluye ahora los productos con stock actualizado
  // para que el otro teléfono los aplique sin depender del Supabase sync
  if (typeof _broadcast === 'function') {
    _broadcast('historial_actualizado', {
      historial: historial.map(v => ({...v, img: undefined})),
      productos_devolucion: productosAfectados.map(p => ({...p, img: undefined}))
    });
    // También broadcast individual por producto (doble seguridad)
    productosAfectados.forEach(prod => {
      _broadcast('producto', {...prod, img: undefined});
    });
  }
}

// ===== 20. BACKUP / IMPORT / FUSIÓN =====

function exportarDatos() {
  const datos = { version: APP_SCHEMA_VERSION, exportado: nowISO(), efectivoInicial, inventarioInicial, productos, ventasDia, ventasSem, ventasMes, historial, pagos, ventasDiarias, restockLog };
  descargarJSON(datos, `Despensa_Economica_backup_${hoyStr()}.json`);
  _ultimoBackup = nowISO();
  idbSet('vpos_ultimoBackup', _ultimoBackup).catch(console.error);
  actualizarSubtituloBackup();
  toast('✓ Backup exportado — guárdalo en un lugar seguro');
}

function importarDatos(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const datos = JSON.parse(e.target.result);
      if (!datos.productos || !Array.isArray(datos.productos)) { toast('Archivo inválido o corrupto', true); return; }
      if (!confirm(`¿Restaurar backup?\n\n• ${datos.productos.length} productos\n• ${(datos.historial||[]).length} cobros\n• ${(datos.pagos||[]).length} gastos\n\nEsto reemplazará TODOS los datos actuales.`)) { event.target.value = ''; return; }
      productos = datos.productos || [];
      ventasDia = datos.ventasDia || {}; ventasSem = datos.ventasSem || {}; ventasMes = datos.ventasMes || {};
      historial = datos.historial || []; pagos = datos.pagos || []; ventasDiarias = datos.ventasDiarias || [];
      restockLog = datos.restockLog || [];
      ventasDia = normalizeReport(ventasDia); ventasSem = normalizeReport(ventasSem); ventasMes = normalizeReport(ventasMes);
      historial = normalizeHistorial(historial); pagos = normalizePagos(pagos);
      // ── Restaurar efectivo e inventario inicial ──────────────────────────
      if (datos.efectivoInicial !== undefined && datos.efectivoInicial !== null) {
        efectivoInicial = parseFloat(datos.efectivoInicial) || 0;
        idbSet('vpos_efectivoInicial', efectivoInicial).catch(console.error);
      }
      if (datos.inventarioInicial !== undefined && datos.inventarioInicial !== null) {
        inventarioInicial = parseFloat(datos.inventarioInicial) || 0;
        idbSet('vpos_inventarioInicial', inventarioInicial).catch(console.error);
      }
      salvar(); event.target.value = ''; toast(`✓ Datos restaurados — ${datos.productos.length} productos cargados`);
    } catch { toast('Error al leer el archivo', true); event.target.value = ''; }
  };
  reader.readAsText(file);
}

function actualizarSubtituloBackup() {
  const sub   = document.getElementById('backupSubtitle');
  const alert = document.getElementById('backupAlert');
  if (!sub) return;
  const ultimo = _ultimoBackup;
  if (!ultimo) { sub.textContent = 'Nunca has exportado un backup'; if (alert && productos.length > 0) alert.style.display = 'flex'; return; }
  const fecha = new Date(ultimo), ahora = new Date();
  const diasDiff = Math.floor((ahora - fecha) / 86400000);
  if (diasDiff === 0)      sub.textContent = `Último backup: hoy ${fecha.toLocaleTimeString('es-SV', {hour:'2-digit',minute:'2-digit'})}`;
  else if (diasDiff === 1) sub.textContent = `Último backup: ayer ${fecha.toLocaleDateString('es-SV')}`;
  else                     sub.textContent = `Último backup: hace ${diasDiff} días (${fecha.toLocaleDateString('es-SV')})`;
  if (alert) alert.style.display = diasDiff >= 3 ? 'flex' : 'none';
}

function fusionarDatos(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const ext = JSON.parse(e.target.result);
      if (!ext.productos || !Array.isArray(ext.productos)) { toast('Archivo inválido', true); return; }
      _datosAFusionar = ext;

      // ── Preview detallado ────────────────────────────────────────────────
      const extNorm       = normalizeReport(ext.ventasDia || {});
      const nuevosPs      = (ext.productos || []).filter(ep => !productos.find(lp => String(lp.id) === String(ep.id))).length;
      const ventaDiaLocal = totalReporte(ventasDia);
      const ventaDiaExt   = totalReporte(extNorm);
      const ventaMesLocal = totalReporte(ventasMes);
      const ventaMesExt   = totalReporte(normalizeReport(ext.ventasMes || {}));
      const cobrosExt     = (ext.historial || []).filter(v => !historial.find(h => h.id === v.id)).length;
      const gastosExt     = (ext.pagos || []).filter(g => !pagos.find(p => p.id === g.id)).length;
      const restockExt    = (ext.restockLog || []).filter(r => !(restockLog||[]).find(lr => lr.id === r.id)).length;

      document.getElementById('fusionPreview').innerHTML = `
        <div style="background:rgba(29,78,216,0.06);border:1.5px solid rgba(29,78,216,0.2);border-radius:var(--r-sm);padding:12px 14px;font-size:12px;font-weight:800;color:var(--blue);margin-bottom:12px;">
          🔀 <b>Fusión inteligente:</b> el stock se recalculará automáticamente sumando todas las ventas y entradas de ambos teléfonos. No se perderá ningún dato.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div class="stat-box"><div class="s-lbl">💰 Venta día combinada</div><div class="s-val" style="color:var(--green);font-size:17px;">$${(ventaDiaLocal+ventaDiaExt).toFixed(2)}</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Este: $${ventaDiaLocal.toFixed(2)} + Otro: $${ventaDiaExt.toFixed(2)}</div></div>
          <div class="stat-box"><div class="s-lbl">📅 Venta mes combinada</div><div class="s-val" style="color:var(--green);font-size:17px;">$${(ventaMesLocal+ventaMesExt).toFixed(2)}</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Este: $${ventaMesLocal.toFixed(2)} + Otro: $${ventaMesExt.toFixed(2)}</div></div>
          <div class="stat-box"><div class="s-lbl">🧾 Cobros nuevos</div><div class="s-val">${cobrosExt}</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">sin duplicados</div></div>
          <div class="stat-box"><div class="s-lbl">📦 Productos nuevos</div><div class="s-val">${nuevosPs}</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">del otro teléfono</div></div>
          <div class="stat-box"><div class="s-lbl">💸 Gastos nuevos</div><div class="s-val">${gastosExt}</div></div>
          <div class="stat-box"><div class="s-lbl">📥 Entradas de stock</div><div class="s-val">${restockExt}</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">para recalcular stock</div></div>
        </div>
        <div style="background:var(--green-light);border:1px solid var(--border-mid);border-radius:var(--r-sm);padding:10px 13px;font-size:12px;font-weight:800;color:var(--green-dark);">
          ✅ El stock de cada producto quedará exacto: inventario base − todas las ventas de ambos teléfonos + todas las entradas registradas.
        </div>
      `;
      event.target.value = '';
      abrirModal('modalFusionar');
    } catch { toast('Error al leer el archivo', true); event.target.value = ''; }
  };
  reader.readAsText(file);
}
function fusionarReporte(a, b) {
  const out = { ...normalizeReport(a) };
  for (const k in normalizeReport(b)) { if (out[k]) { out[k].cant += Number(b[k]?.cant||0); out[k].total += Number(b[k]?.total||0); } else out[k] = { ...b[k] }; }
  return out;
}

function confirmarFusion() {
  if (!_datosAFusionar) return;
  const ext = _datosAFusionar;

  // ── 0. CAPTURAR IDs DEL HISTORIAL LOCAL ANTES DE FUSIONAR ───────────────
  // CRÍTICO: esto debe hacerse ANTES del paso 3 (fusión de historial)
  // para poder separar correctamente cobros locales vs externos al recalcular stock
  const idsCobrosLocalAntes = new Set(historial.map(v => v.id));
  const idsCobrosExtAntes   = new Set((ext.historial || []).map(v => v.id));

  // ── 1. PRODUCTOS: agregar los que no existen localmente ─────────────────
  const idsLocales = new Set(productos.map(p => String(p.id)));
  (ext.productos || []).forEach(ep => {
    if (!idsLocales.has(String(ep.id))) productos.push(ep);
  });

  // ── 2. VENTAS (reportes): sumar cant y total por producto ───────────────
  ventasDia = fusionarReporte(ventasDia, ext.ventasDia || {});
  ventasSem = fusionarReporte(ventasSem, ext.ventasSem || {});
  ventasMes = fusionarReporte(ventasMes, ext.ventasMes || {});

  // ── 3. HISTORIAL DE COBROS: unir sin duplicados ─────────────────────────
  const seenH = new Set(historial.map(v => v.id));
  (normalizeHistorial(ext.historial || [])).forEach(v => { if (!seenH.has(v.id)) historial.push(v); });
  historial.sort((a, b) => (b.ts||0) - (a.ts||0));

  // ── 4. GASTOS/PAGOS: unir sin duplicados ───────────────────────────────
  const seenP = new Set(pagos.map(g => g.id));
  (normalizePagos(ext.pagos || [])).forEach(g => { if (!seenP.has(g.id)) pagos.push(g); });
  pagos.sort((a, b) => (b.ts||0) - (a.ts||0));

  // ── 5. VENTAS DIARIAS MANUALES: unir, si misma fecha sumar montos ───────
  (ext.ventasDiarias || []).forEach(vExt => {
    const idx = ventasDiarias.findIndex(vL => vL.fecha === vExt.fecha);
    if (idx >= 0) {
      // Si la misma fecha existe en ambos, sumar los montos
      ventasDiarias[idx].monto = (Number(ventasDiarias[idx].monto||0) + Number(vExt.monto||0));
      ventasDiarias[idx].nota  = [ventasDiarias[idx].nota, vExt.nota].filter(Boolean).join(' | ') || '';
    } else {
      ventasDiarias.push({ ...vExt });
    }
  });
  ventasDiarias.sort((a,b) => a.fecha.localeCompare(b.fecha));

  // ── 6. RESTOCK LOG: unir sin duplicados ────────────────────────────────
  const seenR = new Set((restockLog||[]).map(r => r.id));
  (ext.restockLog || []).forEach(r => { if (!seenR.has(r.id)) restockLog.push(r); });
  restockLog.sort((a,b) => (a.ts||0) - (b.ts||0));

  // ── 7. RECALCULAR STOCK DE CADA PRODUCTO ────────────────────────────────
  // CORRECCIÓN: usamos idsCobrosLocalAntes / idsCobrosExtAntes capturados
  // ANTES de fusionar el historial (paso 3). Si se capturan después, todos
  // los IDs quedan mezclados y vendioExt resulta siempre 0, descontando
  // solo una venta cuando debería descontar las de ambos teléfonos.
  //
  // Ejemplo: 55 dianas, tel1 vendió 1 (stock→54), tel2 vendió 1 (stock→54)
  // stockBase = max(54+1, 54+1) = 55
  // stockFinal = 55 - 1 - 1 = 53 ✅

  productos.forEach(p => {
    const pid = String(p.id);

    const extProd    = (ext.productos || []).find(ep => String(ep.id) === pid);
    const stockLocal = p.stock || 0;
    const stockExt   = extProd ? (extProd.stock || 0) : 0;

    // Ventas del teléfono LOCAL: cobros que solo existían en el local
    let vendioLocal = 0;
    historial.forEach(v => {
      if (idsCobrosLocalAntes.has(v.id) && !idsCobrosExtAntes.has(v.id)) {
        (v.items||[]).forEach(it => { if (String(it.id) === pid) vendioLocal += Number(it.cant||0); });
      }
    });

    // Ventas del teléfono EXTERNO: cobros que solo existían en el externo
    let vendioExt = 0;
    (normalizeHistorial(ext.historial||[])).forEach(v => {
      if (idsCobrosExtAntes.has(v.id) && !idsCobrosLocalAntes.has(v.id)) {
        (v.items||[]).forEach(it => { if (String(it.id) === pid) vendioExt += Number(it.cant||0); });
      }
    });

    // Reconstruir inventario base desde cada teléfono y tomar el mayor por seguridad
    const stockBaseLocal = stockLocal + vendioLocal;
    const stockBaseExt   = extProd ? (stockExt + vendioExt) : stockBaseLocal;
    const stockBase      = Math.max(stockBaseLocal, stockBaseExt);

    // Stock final = inventario base − ventas de ambos teléfonos
    const stockFinal = Math.max(0, stockBase - vendioLocal - vendioExt);

    p.stock = stockFinal;
  });

  _datosAFusionar = null;
  salvar();
  cerrarModal('modalFusionar');
  toast('✅ Fusión completada — stock, ventas y entradas actualizados', false, true);
}

// ===== 21. REINICIAR MES =====

function abrirModalReiniciarMes() {
  if (typeof _puedeHacer === 'function' && !_puedeHacer('reiniciar')) { toast('Solo el Admin puede reiniciar el mes', true); return; }
  const now = new Date(), mesNombre = now.toLocaleDateString('es-SV', {month:'long',year:'numeric'});
  const totalV = totalReporte(ventasMes);
  const totalG = pagos.filter(g => esMesActual(g.fechaISO)).reduce((s,g) => s+Number(g.monto||0), 0);
  const balance = totalV - totalG;
  document.getElementById('modalReiniciarMesResumen').innerHTML = `
    <div style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:var(--r-sm);padding:12px 14px;margin-bottom:12px;">
      <div style="font-weight:900;color:var(--red);margin-bottom:6px;">Resumen del mes: ${mesNombre.charAt(0).toUpperCase()+mesNombre.slice(1)}</div>
      <div style="display:flex;justify-content:space-between;"><span>Total ventas</span><span class="mono">$${totalV.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Gastos</span><span class="mono" style="color:var(--red)">$${totalG.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Balance</span><span class="mono" style="color:${balance>=0?'var(--green)':'var(--red)'}">$${balance.toFixed(2)}</span></div>
    </div>
  `;
  abrirModal('modalReiniciarMes');
}
function ejecutarReiniciarMes() {
  if (!confirm('Se descargará un backup JSON y luego se reiniciará el mes. ¿Continuar?')) return;

  // Incluir datos de finanzas del mes en el backup
  const mesClave = new Date().toISOString().substring(0, 7);
  const fmDatosBackup = (typeof _fmDatos !== 'undefined') ? _fmDatos : null;

  descargarJSON({
    version: APP_SCHEMA_VERSION,
    exportado: nowISO(),
    tipo: 'cierre-de-mes',
    efectivoInicial, inventarioInicial,
    productos, ventasDia, ventasSem, ventasMes,
    historial, pagos, ventasDiarias, restockLog,
    finanzasMes: fmDatosBackup ? { mes: mesClave, datos: fmDatosBackup } : null
  }, `Backup_CierreMes_${hoyStr()}.json`);

  // Resetear datos del mes
  ventasDia = {}; ventasSem = {}; ventasMes = {};
  historial = []; pagos = []; ventasDiarias = []; restockLog = [];
  productos.forEach(p => { p.lotes = []; });
  efectivoInicial = 0; inventarioInicial = 0;
  idbSet('vpos_efectivoInicial', 0).catch(console.error);
  idbSet('vpos_inventarioInicial', 0).catch(console.error);
  const inpEf = document.getElementById('inpEfectivoInicial'); if (inpEf) inpEf.value = '';
  const inpInv = document.getElementById('inpInventarioInicial'); if (inpInv) inpInv.value = '';

  // Limpiar finanzas del mes actual en IDB y Supabase
  if (typeof idbSet === 'function') {
    idbSet(`fm_datos_${mesClave}`, null).catch(console.error);
  }
  if (typeof _sbDeleteFiltro === 'function' && typeof _getTiendaId === 'function') {
    const tid = _getTiendaId();
    if (tid) {
      _sbDeleteFiltro('finanzas_mes', { tienda_id: 'eq.' + tid, mes: 'eq.' + mesClave }).catch(() => {});
      // También limpiar cierres diarios del mes en Supabase
      const mesInicio = mesClave + '-01';
      const mesFin    = mesClave + '-31';
      _sbDeleteFiltro('cierre_diario', { tienda_id: 'eq.' + tid, fecha: 'gte.' + mesInicio, 'fecha.lte': mesFin }).catch(() => {});
    }
  }
  // Resetear estado en memoria del módulo finanzas
  if (typeof _fmDatos !== 'undefined') {
    // eslint-disable-next-line no-global-assign
    try {
      window._fmDatos = { efectivoInicial: 0, inventarioInicial: 0, ventas: [], facturas: [], gastos: [] };
    } catch(e) {}
  }

  salvar(); cerrarModal('modalReiniciarMes'); toast('Mes reiniciado — inventario intacto', false, true);

  // Borrar log de acciones del mes en Supabase SOLO para esta tienda
  if (typeof _sbDeleteFiltro === 'function' && typeof _getTiendaId === 'function') {
    const tid = _getTiendaId();
    if (tid) {
      _sbDeleteFiltro('acciones_log', { tienda_id: 'eq.' + tid }).catch(() => {});
    }
  }

  // 1️⃣ Broadcast instantáneo → todos los teléfonos conectados limpian sus datos en tiempo real
  if (typeof _broadcast === 'function') {
    _broadcast('reinicio_mes', {
      ts: new Date().toISOString(),
      efectivoInicial: 0,
      inventarioInicial: 0
    });
  }

  // 2️⃣ Subir datos vacíos a Supabase → al iniciar sesión, phone B carga datos limpios
  //    syncAhora('todo') llama a _subirHistorial (borra ventas), _subirPagos (borra pagos),
  //    _subirVentasDiarias (borra ventas_diarias) porque los arrays ahora están vacíos
  if (typeof syncAhora === 'function') syncAhora('todo');

  // 3️⃣ Subir snapshot con estado limpio + señal push para reconexiones
  setTimeout(() => {
    if (typeof _autoEnviarSnapshot === 'function') _autoEnviarSnapshot();
    if (typeof _broadcast === 'function') {
      _broadcast('snapshot_push', { tienda: typeof _getTiendaId === 'function' ? _getTiendaId() : '' });
    }
  }, 2000);
}

// ===== 22. MODAL =====

let _lastFocus = null;
function abrirModal(id) {
  const m = document.getElementById(id); if (!m) return;
  _lastFocus = document.activeElement;
  m.classList.add('open');
  setTimeout(() => { const f = m.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'); if (f) f.focus(); }, 20);
}
function cerrarModal(id) {
  const m = document.getElementById(id); if (!m) return;
  m.classList.remove('open');
  if (_lastFocus && typeof _lastFocus.focus === 'function') _lastFocus.focus();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const open = document.querySelector('.modal.open'); if (open) open.classList.remove('open'); } });

// ===== 23. VER CÓDIGO =====

function abrirModalCodigo() {
  document.getElementById('areaCodigo').value = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  abrirModal('modalCodigo');
}
function seleccionarTodoCodigo() {
  const area = document.getElementById('areaCodigo'); area.focus(); area.select();
  try { document.execCommand('copy'); toast('✓ Código copiado al portapapeles'); } catch { toast('Selecciona el texto manualmente y copia'); }
}
function descargarCodigoHTML() {
  const blob = new Blob(['<!DOCTYPE html>\n' + document.documentElement.outerHTML], {type:'text/html'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'Despensa_Economica_codigo.html';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  toast('✓ Archivo HTML descargado');
}

// ===== 24. SOFT RELOAD =====

async function softReload() {
  salvarSesion();
  if (carrito.length) { toast('Hay una venta en curso. Finaliza o cancela antes de recargar.', true); return; }

  const btn = document.getElementById('reloadBtn');
  if (btn) btn.classList.add('spin');

  // Cargar caché local primero (UI instantánea)
  await migrateAndLoad();
  const validas = ['pgDash','pgInventario','pgReportes','pgDestacados','pgVentasDiarias','pgSync','pgFinanzasMes','pgCierreDia'];
  navTo(validas.includes(_paginaActual) ? _paginaActual : 'pgDash');
  renderCarrito(); actualizarStats();
  const _pgActiva = document.querySelector('.page.active');
  if (_pgActiva) renderPagina(_pgActiva.id);
  actualizarSubtituloBackup();

  // Descargar datos frescos de Supabase si hay sesión activa
  if (typeof _sesionActiva !== 'undefined' && _sesionActiva && typeof _autoCargarDesdeSupa === 'function') {
    toast('🔄 Sincronizando con la nube…');
    await _autoCargarDesdeSupa();
    const _pgActiva2 = document.querySelector('.page.active');
    if (_pgActiva2) renderPagina(_pgActiva2.id);
    actualizarStats();
  }

  if (btn) setTimeout(() => btn.classList.remove('spin'), 500);
  toast('✓ App actualizada desde Supabase', false, true);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (carrito.length) return;
    // Al volver a la pestaña: mostrar caché local y luego bajar Supabase
    migrateAndLoad().then(async () => {
      actualizarTodo();
      if (typeof _sesionActiva !== 'undefined' && _sesionActiva && typeof _autoCargarDesdeSupa === 'function') {
        await _autoCargarDesdeSupa();
        actualizarTodo();
      }
    }).catch(console.error);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r')) { e.preventDefault(); softReload(); }
});

// ===== VD. VENTAS DIARIAS MANUALES =====

function initVentasDiarias() {
  // Poner fecha de hoy por defecto si el campo está vacío
  const inp = document.getElementById('vdFecha');
  if (inp && !inp.value) {
    inp.value = new Date().toISOString().split('T')[0];
  }
  // Llenar el selector de mes/año
  poblarFiltroMes();
}

function poblarFiltroMes() {
  const sel = document.getElementById('vdFiltroMes');
  if (!sel) return;
  const meses = new Set();
  (ventasDiarias || []).forEach(v => {
    if (v.fecha) meses.add(v.fecha.substring(0, 7)); // YYYY-MM
  });
  // Agregar mes actual siempre
  meses.add(new Date().toISOString().substring(0, 7));
  const sorted = [...meses].sort((a, b) => b.localeCompare(a));
  const prevVal = sel.value;
  sel.innerHTML = sorted.map(m => {
    const [y, mo] = m.split('-');
    const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString('es-SV', { month: 'long', year: 'numeric' });
    return `<option value="${m}">${label.charAt(0).toUpperCase() + label.slice(1)}</option>`;
  }).join('');
  if (prevVal && sorted.includes(prevVal)) sel.value = prevVal;
}

function guardarVentaDiaria() {
  const fecha  = document.getElementById('vdFecha').value;
  const monto  = parseFloat(document.getElementById('vdMonto').value);
  const nota   = document.getElementById('vdNota').value.trim();

  if (!fecha) { toast('Selecciona una fecha', true); return; }
  if (isNaN(monto) || monto < 0) { toast('Ingresa un monto válido', true); return; }

  // Si ya existe esa fecha, actualizar
  const idx = ventasDiarias.findIndex(v => v.fecha === fecha);
  if (idx >= 0) {
    if (!confirm(`Ya hay una venta registrada para el ${formatFechaVD(fecha)} ($${ventasDiarias[idx].monto.toFixed(2)}). ¿Reemplazar?`)) { toast("Sin cambios — venta existente conservada"); return; }
    ventasDiarias[idx] = { fecha, monto, nota };
  } else {
    ventasDiarias.push({ fecha, monto, nota });
  }
  ventasDiarias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  salvar(false);
  idbSetMany([['vpos_ventasDiarias', ventasDiarias]]).catch(console.error);
  // Sync Supabase
  if (typeof syncAhora === 'function') syncAhora('venta_diaria');
  // ── FIX: broadcast instantáneo → el otro teléfono recibe la venta en <100ms ──
  // syncAhora solo sube a Supabase pero no notifica al otro teléfono en tiempo real.
  // El broadcast 'venta_diaria_actualizada' lleva toda la lista para que el receptor
  // pueda hacer merge y no dependa del polling.
  if (typeof _broadcast === 'function') _broadcast('venta_diaria_actualizada', { ventasDiarias: ventasDiarias });

  document.getElementById('vdMonto').value = '';
  document.getElementById('vdNota').value  = '';
  // Avanzar fecha al siguiente día
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  document.getElementById('vdFecha').value = d.toISOString().split('T')[0];

  poblarFiltroMes();
  renderVentasDiarias();
  toast('✓ Venta guardada');
}

function eliminarVentaDiaria(fecha) {
  if (!confirm(`¿Eliminar la venta del ${formatFechaVD(fecha)}?`)) return;
  ventasDiarias = ventasDiarias.filter(v => v.fecha !== fecha);
  // FIX: recalcular ventasMes/ventasDia/ventasSem en este teléfono también
  if (typeof _recalcularReportesDesdeHistorial === 'function') _recalcularReportesDesdeHistorial();
  salvar(false);
  renderVentasDiarias();
  toast('Venta eliminada', true);
  // Broadcast instantáneo → otros teléfonos eliminan ese día en tiempo real
  if (typeof _broadcast === 'function') _broadcast('ventas_dia_eliminada', { fecha });
  if (typeof syncBorrarVentaDiaria === 'function') syncBorrarVentaDiaria(fecha);
}

function formatFechaVD(fechaISO) {
  // fechaISO = "YYYY-MM-DD"
  const [y, m, d] = fechaISO.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function renderVentasDiarias() {
  poblarFiltroMes();
  const sel   = document.getElementById('vdFiltroMes');
  const mes   = sel ? sel.value : new Date().toISOString().substring(0, 7);
  const lista = (ventasDiarias || []).filter(v => v.fecha && v.fecha.startsWith(mes));

  // Resumen
  const total  = lista.reduce((s, v) => s + Number(v.monto || 0), 0);
  const dias   = lista.length;
  const promedio = dias ? total / dias : 0;
  const maxDia = dias ? lista.reduce((best, v) => Number(v.monto) > Number(best.monto) ? v : best, lista[0]) : null;

  const resumen = document.getElementById('vdResumenMes');
  if (resumen) resumen.innerHTML = `
    <div class="stat-box"><div class="s-lbl">Total del Mes</div><div class="s-val" style="color:#0369a1;">$${total.toFixed(2)}</div></div>
    <div class="stat-box"><div class="s-lbl">Días Registrados</div><div class="s-val">${dias}</div></div>
    <div class="stat-box"><div class="s-lbl">Promedio Diario</div><div class="s-val" style="font-size:17px;">$${promedio.toFixed(2)}</div></div>
    <div class="stat-box"><div class="s-lbl">Mejor Día</div><div class="s-val" style="font-size:15px;">${maxDia ? '$' + Number(maxDia.monto).toFixed(2) : '—'}</div></div>
  `;

  // Tabla
  const tbody = document.getElementById('tbodyVentasDiarias');
  const tfoot = document.getElementById('tfootVentasDiarias');
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);font-weight:700;">Sin ventas registradas para este mes</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  // Ordenar desc para mostrar más reciente primero
  const listaMostrar = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
  tbody.innerHTML = listaMostrar.map(v => {
    const d = new Date(v.fecha + 'T12:00:00');
    const diaNom = DIAS_ES[d.getDay()];
    const esHoyFlag = v.fecha === new Date().toISOString().split('T')[0];
    return `<tr${esHoyFlag ? ' style="background:#f0fdf4;"' : ''}>
      <td><span class="mono" style="font-size:13px;">${formatFechaVD(v.fecha)}</span></td>
      <td><span class="badge badge-green">${diaNom}</span></td>
      <td><span class="mono td-green" style="font-size:15px;">$${Number(v.monto).toFixed(2)}</span></td>
      <td style="color:var(--text-muted);font-size:12px;">${v.nota || '—'}</td>
      <td style="text-align:right;">
        <button class="btn btn-danger" style="padding:5px 9px;font-size:11px;" onclick="eliminarVentaDiaria('${v.fecha}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  if (tfoot) tfoot.innerHTML = `
    <tr style="background:var(--green-light);">
      <td colspan="2" style="font-weight:900;color:var(--green-dark);padding:11px 12px;font-size:13px;">TOTAL DEL MES</td>
      <td class="mono td-green" style="font-size:16px;font-weight:900;padding:11px 12px;">$${total.toFixed(2)}</td>
      <td colspan="2" style="color:var(--text-muted);font-size:12px;padding:11px 12px;">${dias} días · prom $${promedio.toFixed(2)}/día</td>
    </tr>
  `;
}

function exportarVentasDiariasCSV() {
  const sel  = document.getElementById('vdFiltroMes');
  const mes  = sel ? sel.value : new Date().toISOString().substring(0, 7);
  const lista = (ventasDiarias || []).filter(v => v.fecha && v.fecha.startsWith(mes));
  if (!lista.length) { toast('No hay ventas para exportar', true); return; }
  const rows = ['Fecha,Monto,Nota', ...lista.map(v => `${formatFechaVD(v.fecha)},${Number(v.monto).toFixed(2)},"${(v.nota||'').replace(/"/g,'""')}"`)];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Ventas_${mes}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('✓ CSV exportado');
}



function actualizarTodo() {
  actualizarStats(); // siempre (navbar)
  renderCajaPanel(); // siempre (Dashboard)
  const pg = document.querySelector('.page.active');
  const pgId = pg ? pg.id : '';
  // Solo renderizar la página visible
  if (pgId === 'pgDash')         { if (typeof renderDashboardPro === 'function') renderDashboardPro(); }
  if (pgId === 'pgInventario')   { renderInv(); actualizarCats(); }
  if (pgId === 'pgReportes')     { renderVentas(); renderHistorial(); renderCritico(); renderPagos(); renderBalance(); }
  if (pgId === 'pgDestacados')   { renderDestacados(); }
  if (pgId === 'pgVentasDiarias'){ renderVentasDiarias(); }
}

// Render completo para cuando se navega a una página
function renderPagina(pgId) {
  if (pgId === 'pgDash')          { renderCajaPanel(); if (typeof renderDashboardPro === 'function') setTimeout(renderDashboardPro, 50); }
  if (pgId === 'pgInventario')    { renderInv(); actualizarCats(); poblarInvAnCat(); if (!document.getElementById('invAnDesde')?.value && !document.getElementById('invAnHasta')?.value) { invAnSetRango(30); } else { renderInvAnalisis(); } }
  if (pgId === 'pgReportes')      { renderVentas(); if (!document.getElementById('histDesde')?.value && !document.getElementById('histHasta')?.value) { histFiltroPreset('hoy'); } else { renderHistorial(); } renderCritico(); renderPagos(); renderBalance(); }
  if (pgId === 'pgDestacados')    { renderDestacados(); }
  if (pgId === 'pgVentasDiarias') { renderVentasDiarias(); }
  if (pgId === 'pgAdmin' && typeof renderAdminPanel === 'function') renderAdminPanel();
  if (pgId === 'pgFinanzasMes' && typeof renderFinanzasMes === 'function') renderFinanzasMes(pgId);
  if (pgId === 'pgCierreDia' && typeof renderCierreDia === 'function') renderCierreDia(pgId);
}

// ===== 26. INIT (async) =====

(async function init() {
  try {
    setLoadingMsg('Iniciando almacenamiento local…');
    // Reintentar hasta 4 veces — maneja recargas rápidas y pestañas duplicadas
    let idbOk = false;
    for (let t = 0; t < 4; t++) {
      try {
        _db = null; // forzar nueva apertura
        await getDB();
        idbOk = true;
        break;
      } catch (idbErr) {
        console.warn('[Init] IDB intento', t + 1, '/', 4, idbErr.message);
        if (t < 3) {
          setLoadingMsg('Iniciando almacenamiento… (' + (t + 2) + '/4)');
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }
    if (!idbOk) throw new Error('IDB no disponible tras 4 intentos');
    setIDBStatus(true);

    setLoadingMsg('Cargando caché local…');
    await migrateAndLoad();

    setLoadingBadge('Listo ✓');
    setLoadingMsg('Conectando a Supabase…');

    initKeypad();

    const inpEf = document.getElementById('inpEfectivoInicial');
    if (inpEf) inpEf.value = efectivoInicial > 0 ? efectivoInicial : '';
    const inpInv = document.getElementById('inpInventarioInicial');
    if (inpInv) inpInv.value = inventarioInicial > 0 ? inventarioInicial : '';

    const validas = ['pgDash','pgInventario','pgReportes','pgDestacados','pgVentasDiarias','pgSync','pgFinanzasMes','pgCierreDia'];
    navTo(validas.includes(_paginaActual) ? _paginaActual : 'pgDash');
    // Establecer estado inicial en el historial del navegador
    try { history.replaceState({ pgId: _paginaActual }, '', '#' + _paginaActual); } catch(e) {}

    renderCarrito();
    actualizarStats();        // siempre (navbar)
    renderPagina(_paginaActual); // solo la página activa
    actualizarSubtituloBackup();

    window.addEventListener('beforeunload', () => salvarSesion());
    setInterval(() => salvarSesion(), 30000);
    window.addEventListener('pageshow', (e) => { if (e.persisted) softReload(); });

    ocultarOverlay();
    actualizarBadgeSheets(); // Google Sheets badge
    await iniciarAutoSync();  // Restaurar sesion y rol antes de continuar

    // Cargar alarmas PDF e iniciar monitor
    await cargarAlarmasPDF();
    actualizarResumenAlarmas();
    poblarCategoriasSelectorAlarma();
    iniciarMonitorAlarmas();

  } catch (err) {
    console.error('[IDB] Error fatal en init:', err);
    setIDBStatus(false);
    setLoadingMsg('Error al iniciar la base de datos');
    setLoadingBadge('⚠ IDB no disponible');
    document.getElementById('loadingBadge').style.background = 'rgba(220,38,38,0.12)';
    document.getElementById('loadingBadge').style.color = '#dc2626';
    document.getElementById('loadingBadge').style.borderColor = 'rgba(220,38,38,0.3)';
    // Mostrar botón de reintento
    const overlay = document.getElementById('appLoadingOverlay');
    const btn = document.createElement('button');
    btn.textContent = '🔄 Reintentar'; btn.style.cssText = 'margin-top:8px;padding:12px 24px;background:var(--green);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;';
    btn.onclick = () => location.reload();
    overlay.appendChild(btn);
  }
// ===== MENÚ DESPLEGABLE INVENTARIO =====

function toggleInvDropdown(contentId, btnId) {
  const content = document.getElementById(contentId);
  const btn = document.getElementById(btnId);
  if (!content || !btn) return;
  const isOpen = content.classList.contains('open');
  // Cerrar todos primero
  document.querySelectorAll('.inv-dropdown-content').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.inv-dropdown-btn').forEach(el => el.classList.remove('open'));
  // Abrir el que se presionó (si estaba cerrado)
  if (!isOpen) {
    content.classList.add('open');
    btn.classList.add('open');
  }
}
// Exponer al scope global para que los onclick del HTML puedan llamarla
window.toggleInvDropdown = toggleInvDropdown;

// =====================================================================
//  📋 PEDIDOS ONLINE — Panel en el POS
// =====================================================================
let _ordersPolling = null;

async function _checkPedidosNuevos() {
  try {
    const nuevo = await idbGet('vpos_pedidosNuevo');
    const fab   = document.getElementById('ordersFab');
    if (!fab) return;
    if (nuevo) {
      fab.style.display = 'flex';
    }
    // Count pending
    const pedidos = (await idbGet('vpos_pedidosOnline')) || [];
    const pendientes = pedidos.filter(p => p.estado === 'nuevo').length;
    if (pendientes > 0) {
      fab.style.display = 'flex';
      fab.innerHTML = `<span class="fab-dot"></span> 📋 ${pendientes} Pedido${pendientes !== 1 ? 's' : ''} Nuevo${pendientes !== 1 ? 's' : ''}`;
    } else {
      fab.style.display = 'none';
    }
  } catch(e) {}
}

function abrirPedidosAdmin() {
  document.getElementById('ordersBg').classList.add('open');
  renderPedidosAdmin();
  // Mark as seen
  idbSet('vpos_pedidosNuevo', false).catch(() => {});
}
function cerrarPedidosAdmin() {
  document.getElementById('ordersBg').classList.remove('open');
}

async function renderPedidosAdmin() {
  const w = document.getElementById('ordersList');
  try {
    const pedidos = (await idbGet('vpos_pedidosOnline')) || [];
    if (!pedidos.length) {
      w.innerHTML = '<div style="padding:22px;text-align:center;color:var(--text-muted);font-size:13px;font-weight:700;">No hay pedidos online aún</div>';
      return;
    }
    w.innerHTML = pedidos.map((p, idx) => {
      const stLbl = { nuevo: '🕐 Nuevo', aceptado: '✅ Aceptado', rechazado: '❌ Rechazado' }[p.estado] || 'Nuevo';
      const items = (p.items || []).map(i => `${i.cant}× ${i.nom}`).join(', ');
      const acc = p.estado === 'nuevo' ? `<div class="op-actions">
        <button class="op-acc" onclick="responderPedidoPOS(${idx},'aceptado')">✅ Aceptar</button>
        <button class="op-rej" onclick="responderPedidoPOS(${idx},'rechazado')">❌ Rechazar</button>
      </div>` : '';
      return `<div class="op-card">
        <div class="op-head">
          <div class="op-num">${p.id}</div>
          <div class="op-st ${p.estado}">${stLbl}</div>
        </div>
        <div class="op-body">
          <b>${p.nombre}</b> · 📞 ${p.tel}<br>
          ${p.delivery === 'domicilio' ? `📍 ${p.dir || 'Sin dirección'}` : '🏪 Retiro en tienda'}<br>
          💳 ${p.pago} · 💰 $${p.total}<br>
          ${p.nota ? `📝 ${p.nota}<br>` : ''}📦 ${items}<br>
          🕐 ${p.fecha}
        </div>
        ${acc}
      </div>`;
    }).join('');
  } catch(e) {
    w.innerHTML = '<div style="padding:22px;text-align:center;color:var(--text-muted);">Error al cargar pedidos</div>';
  }
}

async function responderPedidoPOS(idx, decision) {
  try {
    const pedidos = (await idbGet('vpos_pedidosOnline')) || [];
    const pedido  = pedidos[idx];
    if (!pedido) return;
    pedido.estado = decision;

    if (decision === 'aceptado') {
      // Discount inventory and register sale
      const vd = (await idbGet('vpos_ventasDia')) || {};
      const vs = (await idbGet('vpos_ventasSem')) || {};
      const vm = (await idbGet('vpos_ventasMes')) || {};

      (pedido.items || []).forEach(item => {
        const p   = productos.find(x => x.id === item.id);
        const pid = String(item.id);
        if (p && (p.stock || 0) >= item.cant) { p.stock -= item.cant; actualizarStockFila(p); }
        [vd, vs, vm].forEach(r => {
          if (!r[pid]) r[pid] = { id: pid, nom: item.nom, cat: item.cat || '', cant: 0, total: 0 };
          r[pid].cant  += item.cant;
          r[pid].total += item.precio * item.cant;
        });
      });

      const venta = {
        id: pedido.id, ts: Date.now(), fechaISO: new Date().toISOString(),
        fechaStr: pedido.fecha, origen: 'tienda_online',
        // Full customer data preserved in the sale record
        cliente:   pedido.nombre,
        telefono:  pedido.tel   || '',
        direccion: pedido.dir   || (pedido.delivery==='retiro' ? 'Retiro en tienda' : ''),
        delivery:  pedido.delivery || 'domicilio',
        nota:      pedido.nota  || '',
        pago: pedido.pago, envio: pedido.envio,
        items: (pedido.items || []).map(i => ({ id: String(i.id), nom: i.nom, cant: i.cant, precio: i.precio, cat: i.cat })),
        total: pedido.total, pago_monto: pedido.total, vuelto: '0.00'
      };
      historial.unshift(venta);

      await idbSet('vpos_ventasDia', vd);
      await idbSet('vpos_ventasSem', vs);
      await idbSet('vpos_ventasMes', vm);
      salvar();
      toast('✅ Pedido aceptado — inventario actualizado');
    } else {
      toast('❌ Pedido rechazado');
    }

    await idbSet('vpos_pedidosOnline', pedidos);
    renderPedidosAdmin();
    _checkPedidosNuevos();
  } catch(e) { toast('Error: ' + e.message, true); }
}

// Start polling when app loads
setTimeout(() => {
  _checkPedidosNuevos();
  _ordersPolling = setInterval(_checkPedidosNuevos, 20000); // check every 20s
}, 2000);

window.abrirPedidosAdmin  = abrirPedidosAdmin;
window.cerrarPedidosAdmin = cerrarPedidosAdmin;
window.responderPedidoPOS = responderPedidoPOS;

})();