// =====================================================================
//  📊 MÓDULO FINANCIERO MENSUAL — Despensa Económica
//
//  ROLES:
//  ✅ Super Admin & Admin de tienda → configurar Efectivo Inicial + Inventario Inicial
//  ✅ Cajeros → registrar Ventas por Día, Pagos de Factura, Gastos Mensuales
//  ✅ Todos → ver resumen y totales actualizados diariamente
//
//  PERSISTENCIA: Supabase (tabla finanzas_mes) + IndexedDB local como caché
// =====================================================================

// ── Estilos del módulo ────────────────────────────────────────────────
(function _inyectarEstilosFinanzas() {
  if (document.getElementById('finanzasMesStyles')) return;
  const s = document.createElement('style');
  s.id = 'finanzasMesStyles';
  s.textContent = `
    /* ══════════════════════════════════════════
       LAYOUT GENERAL DE LA SECCIÓN FINANZAS
    ══════════════════════════════════════════ */
    #pgFinanzasMes {
      padding: 0 0 80px 0;
    }

    /* ── Hero / cabecera del mes ── */
    .fm-hero {
      background: linear-gradient(135deg, #052e16 0%, #14532d 60%, #166534 100%);
      padding: 22px 18px 18px;
      margin-bottom: 18px;
    }
    .fm-hero-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .fm-hero-title {
      font-size: 18px;
      font-weight: 900;
      color: #fff;
      font-family: Nunito, sans-serif;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .fm-hero-mes {
      font-size: 12px;
      font-weight: 900;
      color: rgba(255,255,255,0.7);
      font-family: Nunito, sans-serif;
    }
    .fm-mes-select {
      padding: 6px 10px;
      background: rgba(255,255,255,0.12);
      border: 1.5px solid rgba(255,255,255,0.25);
      border-radius: 9px;
      color: #fff;
      font-size: 13px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      cursor: pointer;
      outline: none;
    }
    .fm-mes-select option { color: #052e16; background: #fff; }

    /* ── Cards resumen ── */
    .fm-resumen-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding: 0 14px 14px;
    }
    @media (min-width: 560px) {
      .fm-resumen-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (min-width: 800px) {
      .fm-resumen-grid { grid-template-columns: repeat(5, 1fr); }
    }
    .fm-card {
      background: rgba(255,255,255,0.1);
      border: 1.5px solid rgba(255,255,255,0.18);
      border-radius: 14px;
      padding: 13px 14px;
      backdrop-filter: blur(8px);
    }
    .fm-card-label {
      font-size: 10px;
      font-weight: 900;
      color: rgba(255,255,255,0.65);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: Nunito, sans-serif;
      margin-bottom: 5px;
    }
    .fm-card-val {
      font-size: 20px;
      font-weight: 900;
      color: #fff;
      font-family: Nunito, sans-serif;
      line-height: 1;
    }
    .fm-card-val.positivo { color: #86efac; }
    .fm-card-val.negativo { color: #fca5a5; }
    .fm-card-sub {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255,255,255,0.5);
      font-family: Nunito, sans-serif;
      margin-top: 3px;
    }

    /* ── Sección de contenido principal ── */
    .fm-body {
      padding: 0 14px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* ── Panel de configuración inicial (solo Admin) ── */
    .fm-panel {
      background: var(--surface2);
      border: 1.5px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
    }
    .fm-panel-header {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 13px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .fm-panel-icon {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .fm-panel-title {
      font-size: 14px;
      font-weight: 900;
      color: var(--text);
      font-family: Nunito, sans-serif;
      flex: 1;
    }
    .fm-panel-body { padding: 16px; }

    /* ── Inputs de configuración ── */
    .fm-config-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    @media (max-width: 400px) {
      .fm-config-grid { grid-template-columns: 1fr; }
    }
    .fm-field label {
      display: block;
      font-size: 10px;
      font-weight: 900;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: Nunito, sans-serif;
      margin-bottom: 5px;
    }
    .fm-inp {
      width: 100%;
      padding: 11px 13px;
      border: 1.5px solid var(--border);
      border-radius: 11px;
      font-size: 15px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      color: var(--text);
      background: var(--surface);
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }
    .fm-inp:focus { border-color: var(--green); background: #fff; }

    /* ── Botones de guardar ── */
    .btn-fm-guardar {
      width: 100%;
      padding: 13px;
      background: linear-gradient(135deg, #16a34a, #15803d);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(22,163,74,0.3);
      transition: all 0.15s;
    }
    .btn-fm-guardar:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(22,163,74,0.4); }
    .btn-fm-guardar:disabled { opacity: 0.6; cursor: wait; transform: none; }

    /* ── Formulario de registro de movimiento ── */
    .fm-mov-form {
      display: grid;
      gap: 10px;
    }
    .fm-mov-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: end;
    }
    @media (max-width: 380px) {
      .fm-mov-row { grid-template-columns: 1fr; }
    }
    .btn-fm-add {
      padding: 11px 18px;
      background: var(--green);
      color: #fff;
      border: none;
      border-radius: 11px;
      font-size: 13px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .btn-fm-add:hover { background: var(--green-dark); }
    .btn-fm-add:disabled { opacity: 0.6; cursor: wait; }

    /* ── Tabla de movimientos ── */
    .fm-mov-list {
      max-height: 260px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #bbf7d0 transparent;
    }
    .fm-mov-list::-webkit-scrollbar { width: 4px; }
    .fm-mov-list::-webkit-scrollbar-thumb { background: #bbf7d0; border-radius: 10px; }

    .fm-mov-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-bottom: 1px solid var(--border);
      font-family: Nunito, sans-serif;
    }
    .fm-mov-item:last-child { border-bottom: none; }
    .fm-mov-fecha {
      font-size: 11px;
      font-weight: 900;
      color: var(--text-muted);
      min-width: 52px;
    }
    .fm-mov-nota {
      flex: 1;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
    }
    .fm-mov-monto {
      font-size: 14px;
      font-weight: 900;
      white-space: nowrap;
    }
    .fm-mov-monto.ingreso { color: #16a34a; }
    .fm-mov-monto.egreso  { color: #dc2626; }
    .btn-fm-del {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      font-size: 13px;
      padding: 3px 5px;
      border-radius: 6px;
      transition: all 0.1s;
    }
    .btn-fm-del:hover { background: rgba(220,38,38,0.1); color: #dc2626; }

    /* ── Total de sección ── */
    .fm-mov-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: var(--green-light);
      border-radius: 0 0 12px 12px;
      font-family: Nunito, sans-serif;
    }
    .fm-mov-total span:first-child {
      font-size: 12px;
      font-weight: 900;
      color: var(--green-dark);
    }
    .fm-mov-total span:last-child {
      font-size: 16px;
      font-weight: 900;
      color: var(--green-dark);
    }

    /* ── Alerta de saldo proyectado ── */
    .fm-proyeccion {
      border-radius: 14px;
      padding: 16px;
      font-family: Nunito, sans-serif;
      border: 1.5px solid;
    }
    .fm-proyeccion.ok {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .fm-proyeccion.warn {
      background: #fffbeb;
      border-color: #fde68a;
    }
    .fm-proyeccion.danger {
      background: #fef2f2;
      border-color: #fca5a5;
    }
    .fm-proy-title {
      font-size: 13px;
      font-weight: 900;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .fm-proy-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .fm-proy-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .fm-proy-lbl {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      opacity: 0.6;
    }
    .fm-proy-val {
      font-size: 16px;
      font-weight: 900;
    }

    /* ── Badge de rol ── */
    .fm-rol-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
    }
    .fm-rol-badge.admin  { background: #ede9fe; color: #7c3aed; border: 1px solid #c4b5fd; }
    .fm-rol-badge.cajero { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }

    /* ── Empty state ── */
    .fm-empty {
      text-align: center;
      padding: 20px;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      font-family: Nunito, sans-serif;
    }

    /* ── Readonly display ── */
    .fm-readonly-val {
      padding: 11px 13px;
      background: #f0fdf4;
      border: 1.5px solid #bbf7d0;
      border-radius: 11px;
      font-size: 16px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      color: #15803d;
    }
  `;
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════════════════════
//  ESTADO DEL MÓDULO
// ══════════════════════════════════════════════════════════════════════

let _fmMesActual = new Date().toISOString().substring(0, 7); // "YYYY-MM"
let _fmDatos = {
  efectivoInicial: 0,
  inventarioInicial: 0,
  ventas: [],       // [{ id, fecha, monto, nota }]
  facturas: [],     // [{ id, fecha, monto, nota }]
  gastos: [],       // [{ id, fecha, monto, nota }]
};

// ── Helpers de fecha ──────────────────────────────────────────────────
function _fmFechaHoy() { return new Date().toISOString().split('T')[0]; }

function _fmFmtFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function _fmMesLabel(ym) {
  const [y, m] = ym.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
}

// ── Determinar rol del usuario actual ────────────────────────────────
function _fmRol() {
  if (typeof _esSuperAdmin === 'function' && _esSuperAdmin()) return 'superadmin';
  if (typeof _usuarioActual !== 'undefined' && _usuarioActual) {
    return _usuarioActual.rol || 'cajero'; // 'admin' | 'cajero'
  }
  return 'cajero';
}

function _fmEsAdmin() {
  const r = _fmRol();
  return r === 'superadmin' || r === 'admin';
}

// ════════════════════════════════════════════════════════════════════
//  PERSISTENCIA — IDB local + Supabase
// ════════════════════════════════════════════════════════════════════

const _FM_IDB_KEY = mes => `fm_datos_${mes}`;

async function _fmGuardarLocal(mes, datos) {
  try {
    if (typeof idbSet === 'function') {
      await idbSet(_FM_IDB_KEY(mes), datos);
    } else {
      localStorage.setItem(_FM_IDB_KEY(mes), JSON.stringify(datos));
    }
  } catch(e) { console.warn('[FM] Error guardando local:', e); }
}

async function _fmCargarLocal(mes) {
  try {
    if (typeof idbGet === 'function') {
      return await idbGet(_FM_IDB_KEY(mes)) || null;
    } else {
      const raw = localStorage.getItem(_FM_IDB_KEY(mes));
      return raw ? JSON.parse(raw) : null;
    }
  } catch(e) { return null; }
}

// ── Subir/bajar de Supabase ───────────────────────────────────────────
async function _fmSubirSupabase(mes, datos) {
  if (typeof _sbPost !== 'function' || typeof _getTiendaId !== 'function') return;
  const id = `${_getTiendaId()}_${mes}`;
  try {
    await _sbPost('finanzas_mes', {
      id,
      tienda_id: _getTiendaId(),
      mes,
      datos: JSON.stringify(datos),
      updated_at: new Date().toISOString()
    }, true); // upsert
  } catch(e) { console.warn('[FM] Error Supabase upload:', e.message); }
}

async function _fmBajarSupabase(mes) {
  if (typeof _sbGet !== 'function' || typeof _getTiendaId !== 'function') return null;
  try {
    const rows = await _sbGet('finanzas_mes', {
      select: 'datos',
      tienda_id: 'eq.' + _getTiendaId(),
      mes: 'eq.' + mes,
      limit: 1
    });
    if (rows && rows.length > 0) {
      return typeof rows[0].datos === 'string' ? JSON.parse(rows[0].datos) : rows[0].datos;
    }
  } catch(e) { console.warn('[FM] Error Supabase download:', e.message); }
  return null;
}

// ── Cargar datos para un mes ──────────────────────────────────────────
async function _fmCargar(mes) {
  // Intentar Supabase primero (datos más frescos), luego IDB
  let datos = await _fmBajarSupabase(mes);
  if (!datos) datos = await _fmCargarLocal(mes);
  return datos || {
    efectivoInicial: 0,
    inventarioInicial: 0,
    ventas: [],
    facturas: [],
    gastos: [],
  };
}

// ── Guardar y sincronizar ─────────────────────────────────────────────
async function _fmGuardar(mes, datos) {
  await _fmGuardarLocal(mes, datos);
  await _fmSubirSupabase(mes, datos);
  if(typeof syncAhora==='function') syncAhora('todo');
}

// ════════════════════════════════════════════════════════════════════
//  RENDERIZADO PRINCIPAL
// ════════════════════════════════════════════════════════════════════

async function renderFinanzasMes(pgId) {
  pgId = pgId || 'pgFinanzasMes';
  const pg = document.getElementById(pgId);
  if (!pg) return;

  // Cargar datos del mes actual
  _fmDatos = await _fmCargar(_fmMesActual);

  const esAdmin = _fmEsAdmin();
  const rol = _fmRol();
  const rolLabel = rol === 'superadmin' ? '👑 Super Admin' : esAdmin ? '🔑 Admin' : '🏪 Cajero';
  const rolClass = esAdmin ? 'admin' : 'cajero';

  // Calcular totales
  const totalVentas   = (_fmDatos.ventas   || []).reduce((s, v) => s + Number(v.monto || 0), 0);
  const totalFacturas = (_fmDatos.facturas  || []).reduce((s, v) => s + Number(v.monto || 0), 0);
  const totalGastos   = (_fmDatos.gastos   || []).reduce((s, v) => s + Number(v.monto || 0), 0);
  const efectivoIni   = Number(_fmDatos.efectivoInicial  || 0);
  const inventarioIni = Number(_fmDatos.inventarioInicial || 0);

  // Proyecciones
  const dineroDisponible   = efectivoIni + totalVentas - totalFacturas - totalGastos;
  const inventarioActual   = inventarioIni - totalVentas; // simplificado: ventas = salida de inventario
  const totalEgresos       = totalFacturas + totalGastos;

  // Opciones de mes (últimos 6 meses)
  const mesesOpc = [];
  const hoy = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const ym = d.toISOString().substring(0, 7);
    mesesOpc.push(ym);
  }
  const mesSelectHTML = `
    <select class="fm-mes-select" id="fmMesSelect" onchange="_fmCambiarMes(this.value)">
      ${mesesOpc.map(m => `<option value="${m}" ${m === _fmMesActual ? 'selected' : ''}>${_fmMesLabel(m)}</option>`).join('')}
    </select>`;

  // Estado de proyección
  const proyState = dineroDisponible >= 0 ? 'ok' : dineroDisponible >= -500 ? 'warn' : 'danger';
  const proyIcon  = proyState === 'ok' ? '✅' : proyState === 'warn' ? '⚠️' : '🚨';

  pg.innerHTML = `
    <!-- HERO -->
    <div class="fm-hero">
      <div class="fm-hero-top">
        <div>
          <div class="fm-hero-title">📊 Finanzas del Mes</div>
          <div class="fm-hero-mes">${_fmMesLabel(_fmMesActual)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="fm-rol-badge ${rolClass}">${rolLabel}</span>
          ${mesSelectHTML}
        </div>
      </div>

      <!-- CARDS RESUMEN -->
      <div class="fm-resumen-grid">
        <div class="fm-card">
          <div class="fm-card-label">💵 Efectivo Inicial</div>
          <div class="fm-card-val">$${efectivoIni.toFixed(2)}</div>
          <div class="fm-card-sub">Inicio del mes</div>
        </div>
        <div class="fm-card">
          <div class="fm-card-label">📦 Inventario Inicial</div>
          <div class="fm-card-val">$${inventarioIni.toFixed(2)}</div>
          <div class="fm-card-sub">Valor al inicio</div>
        </div>
        <div class="fm-card">
          <div class="fm-card-label">💹 Ventas del Mes</div>
          <div class="fm-card-val positivo">$${totalVentas.toFixed(2)}</div>
          <div class="fm-card-sub">${(_fmDatos.ventas || []).length} días registrados</div>
        </div>
        <div class="fm-card">
          <div class="fm-card-label">🧾 Egresos Totales</div>
          <div class="fm-card-val negativo">$${totalEgresos.toFixed(2)}</div>
          <div class="fm-card-sub">Facturas + Gastos</div>
        </div>
        <div class="fm-card">
          <div class="fm-card-label">💰 Saldo Disponible</div>
          <div class="fm-card-val ${dineroDisponible >= 0 ? 'positivo' : 'negativo'}">$${dineroDisponible.toFixed(2)}</div>
          <div class="fm-card-sub">Al día de hoy</div>
        </div>
      </div>
    </div>

    <!-- CUERPO -->
    <div class="fm-body">

      <!-- ── CONFIGURACIÓN INICIAL (solo Admin) ── -->
      ${esAdmin ? `
      <div class="fm-panel">
        <div class="fm-panel-header">
          <div class="fm-panel-icon" style="background:#dcfce7;">💵</div>
          <div class="fm-panel-title">Configuración Inicial del Mes</div>
          <span style="font-size:11px;font-weight:900;color:var(--text-muted);font-family:Nunito,sans-serif;">Solo Admin</span>
        </div>
        <div class="fm-panel-body">
          <div class="fm-config-grid">
            <div class="fm-field">
              <label>Efectivo Inicial del Mes ($)</label>
              <input class="fm-inp" type="number" id="fmEfectivoIni" min="0" step="0.01"
                value="${efectivoIni > 0 ? efectivoIni : ''}"
                placeholder="0.00">
            </div>
            <div class="fm-field">
              <label>Inventario Inicial del Mes ($)</label>
              <input class="fm-inp" type="number" id="fmInventarioIni" min="0" step="0.01"
                value="${inventarioIni > 0 ? inventarioIni : ''}"
                placeholder="0.00">
            </div>
          </div>
          <button class="btn-fm-guardar" id="btnFmGuardarIni" onclick="_fmGuardarIniciales()">
            💾 Guardar valores iniciales
          </button>
        </div>
      </div>
      ` : `
      <div class="fm-panel">
        <div class="fm-panel-header">
          <div class="fm-panel-icon" style="background:#dcfce7;">💵</div>
          <div class="fm-panel-title">Valores Iniciales del Mes</div>
        </div>
        <div class="fm-panel-body">
          <div class="fm-config-grid">
            <div class="fm-field">
              <label>Efectivo Inicial</label>
              <div class="fm-readonly-val">$${efectivoIni.toFixed(2)}</div>
            </div>
            <div class="fm-field">
              <label>Inventario Inicial</label>
              <div class="fm-readonly-val">$${inventarioIni.toFixed(2)}</div>
            </div>
          </div>
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);font-family:Nunito,sans-serif;text-align:center;margin-top:4px;">
            🔒 Solo el administrador puede modificar los valores iniciales
          </div>
        </div>
      </div>
      `}

      <!-- ── VENTAS POR DÍA ── -->
      <div class="fm-panel">
        <div class="fm-panel-header">
          <div class="fm-panel-icon" style="background:#dbeafe;">💹</div>
          <div class="fm-panel-title">Ventas por Día</div>
          <span class="memb-count-badge" style="background:#dbeafe;color:#1d4ed8;border-color:#bfdbfe;" id="fmVentasCnt">${(_fmDatos.ventas||[]).length}</span>
        </div>
        <div class="fm-panel-body">
          <div class="fm-mov-form">
            <div class="fm-mov-row">
              <div class="fm-field">
                <label>Fecha</label>
                <input class="fm-inp" type="date" id="fmVentaFecha" value="${_fmFechaHoy()}">
              </div>
              <div class="fm-field">
                <label>Monto ($)</label>
                <input class="fm-inp" type="number" id="fmVentaMonto" min="0" step="0.01" placeholder="0.00">
              </div>
            </div>
            <div class="fm-field">
              <label>Nota (opcional)</label>
              <input class="fm-inp" type="text" id="fmVentaNota" placeholder="Ej: lunes con mucha clientela…">
            </div>
            <button class="btn-fm-add" id="btnFmAddVenta" onclick="_fmAgregarMovimiento('ventas','fmVentaFecha','fmVentaMonto','fmVentaNota','ingreso')">
              ➕ Registrar Venta
            </button>
          </div>
          <div style="margin-top:14px;">
            <div class="fm-mov-list" id="fmVentasList">
              ${_fmRenderLista(_fmDatos.ventas || [], 'ventas', 'ingreso')}
            </div>
            <div class="fm-mov-total">
              <span>Total ventas del mes</span>
              <span id="fmVentasTotal" style="color:#1d4ed8;">$${totalVentas.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── PAGO DE FACTURAS ── -->
      <div class="fm-panel">
        <div class="fm-panel-header">
          <div class="fm-panel-icon" style="background:#fef3c7;">🧾</div>
          <div class="fm-panel-title">Pago de Facturas</div>
          <span class="memb-count-badge" style="background:#fef3c7;color:#b45309;border-color:#fde68a;" id="fmFacturasCnt">${(_fmDatos.facturas||[]).length}</span>
        </div>
        <div class="fm-panel-body">
          <div class="fm-mov-form">
            <div class="fm-mov-row">
              <div class="fm-field">
                <label>Fecha</label>
                <input class="fm-inp" type="date" id="fmFacturaFecha" value="${_fmFechaHoy()}">
              </div>
              <div class="fm-field">
                <label>Monto ($)</label>
                <input class="fm-inp" type="number" id="fmFacturaMonto" min="0" step="0.01" placeholder="0.00">
              </div>
            </div>
            <div class="fm-field">
              <label>Proveedor / Descripción</label>
              <input class="fm-inp" type="text" id="fmFacturaNota" placeholder="Ej: Factura ENSA, Distribuidora García…">
            </div>
            <button class="btn-fm-add" id="btnFmAddFactura" onclick="_fmAgregarMovimiento('facturas','fmFacturaFecha','fmFacturaMonto','fmFacturaNota','egreso')">
              ➕ Registrar Factura
            </button>
          </div>
          <div style="margin-top:14px;">
            <div class="fm-mov-list" id="fmFacturasList">
              ${_fmRenderLista(_fmDatos.facturas || [], 'facturas', 'egreso')}
            </div>
            <div class="fm-mov-total" style="background:#fffbeb;">
              <span style="color:#b45309;">Total facturas pagadas</span>
              <span id="fmFacturasTotal" style="color:#b45309;">$${totalFacturas.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── GASTOS MENSUALES ── -->
      <div class="fm-panel">
        <div class="fm-panel-header">
          <div class="fm-panel-icon" style="background:#fee2e2;">💸</div>
          <div class="fm-panel-title">Gastos Mensuales</div>
          <span class="memb-count-badge" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5;" id="fmGastosCnt">${(_fmDatos.gastos||[]).length}</span>
        </div>
        <div class="fm-panel-body">
          <div class="fm-mov-form">
            <div class="fm-mov-row">
              <div class="fm-field">
                <label>Fecha</label>
                <input class="fm-inp" type="date" id="fmGastoFecha" value="${_fmFechaHoy()}">
              </div>
              <div class="fm-field">
                <label>Monto ($)</label>
                <input class="fm-inp" type="number" id="fmGastoMonto" min="0" step="0.01" placeholder="0.00">
              </div>
            </div>
            <div class="fm-field">
              <label>Descripción del gasto</label>
              <input class="fm-inp" type="text" id="fmGastoNota" placeholder="Ej: limpieza, mantenimiento, sueldo…">
            </div>
            <button class="btn-fm-add" id="btnFmAddGasto" onclick="_fmAgregarMovimiento('gastos','fmGastoFecha','fmGastoMonto','fmGastoNota','egreso')">
              ➕ Registrar Gasto
            </button>
          </div>
          <div style="margin-top:14px;">
            <div class="fm-mov-list" id="fmGastosList">
              ${_fmRenderLista(_fmDatos.gastos || [], 'gastos', 'egreso')}
            </div>
            <div class="fm-mov-total" style="background:#fef2f2;">
              <span style="color:#dc2626;">Total gastos del mes</span>
              <span id="fmGastosTotal" style="color:#dc2626;">$${totalGastos.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── PROYECCIÓN / RESUMEN INTELIGENTE ── -->
      <div class="fm-proyeccion ${proyState}">
        <div class="fm-proy-title" style="color:${proyState==='ok'?'#15803d':proyState==='warn'?'#b45309':'#dc2626'}">
          ${proyIcon} Resumen del mes — ${_fmMesLabel(_fmMesActual)}
        </div>
        <div class="fm-proy-grid">
          <div class="fm-proy-item" style="color:${proyState==='ok'?'#15803d':proyState==='warn'?'#b45309':'#dc2626'}">
            <span class="fm-proy-lbl">💰 Dinero disponible hoy</span>
            <span class="fm-proy-val" id="fmPrDinero">$${dineroDisponible.toFixed(2)}</span>
          </div>
          <div class="fm-proy-item" style="color:#7c3aed;">
            <span class="fm-proy-lbl">📦 Inventario estimado</span>
            <span class="fm-proy-val" id="fmPrInventario">$${Math.max(0, inventarioActual).toFixed(2)}</span>
          </div>
          <div class="fm-proy-item" style="color:#1d4ed8;">
            <span class="fm-proy-lbl">💹 Total ventas</span>
            <span class="fm-proy-val" id="fmPrVentas">$${totalVentas.toFixed(2)}</span>
          </div>
          <div class="fm-proy-item" style="color:#dc2626;">
            <span class="fm-proy-lbl">🧾 Total egresos</span>
            <span class="fm-proy-val" id="fmPrEgresos">$${totalEgresos.toFixed(2)}</span>
          </div>
        </div>
        ${proyState !== 'ok' ? `
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${proyState==='warn'?'#fde68a':'#fca5a5'};font-size:12px;font-weight:700;font-family:Nunito,sans-serif;color:${proyState==='warn'?'#92400e':'#991b1b'};">
          ${proyState === 'warn'
            ? '⚠️ El saldo disponible es bajo. Verifica tus gastos y facturas.'
            : '🚨 El saldo es negativo. Los egresos superan el efectivo inicial más las ventas.'}
        </div>` : ''}
      </div>

    </div><!-- /fm-body -->
  `;
}

// ── Render de lista de movimientos ────────────────────────────────────
function _fmRenderLista(items, tipo, estiloMonto) {
  if (!items || !items.length) {
    return `<div class="fm-empty">Sin registros aún</div>`;
  }
  const ordenado = [...items].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return ordenado.map(item => `
    <div class="fm-mov-item">
      <span class="fm-mov-fecha">${_fmFmtFecha(item.fecha)}</span>
      <span class="fm-mov-nota">${item.nota || '—'}</span>
      <span class="fm-mov-monto ${estiloMonto}">${estiloMonto==='ingreso'?'+':'-'}$${Number(item.monto).toFixed(2)}</span>
      <button class="btn-fm-del" onclick="_fmEliminarMovimiento('${tipo}','${item.id}')" title="Eliminar">✕</button>
    </div>
  `).join('');
}

// ── Agregar movimiento ────────────────────────────────────────────────
async function _fmAgregarMovimiento(tipo, fechaId, montoId, notaId, estiloMonto) {
  const fecha = document.getElementById(fechaId)?.value;
  const monto = parseFloat(document.getElementById(montoId)?.value || '0');
  const nota  = document.getElementById(notaId)?.value?.trim() || '';

  if (!fecha) { if (typeof toast === 'function') toast('Selecciona una fecha', true); return; }
  if (!monto || monto <= 0) { if (typeof toast === 'function') toast('Ingresa un monto válido', true); return; }

  // Validar que el cajero no pueda modificar iniciales
  if (!_fmEsAdmin() && (tipo !== 'ventas' && tipo !== 'facturas' && tipo !== 'gastos')) {
    if (typeof toast === 'function') toast('Sin permiso para esta acción', true);
    return;
  }

  const id = tipo + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
  if (!_fmDatos[tipo]) _fmDatos[tipo] = [];
  _fmDatos[tipo].push({ id, fecha, monto, nota });

  // Guardar
  await _fmGuardar(_fmMesActual, _fmDatos);

  // Limpiar inputs
  if (document.getElementById(montoId)) document.getElementById(montoId).value = '';
  if (document.getElementById(notaId))  document.getElementById(notaId).value  = '';

  if (typeof toast === 'function') toast('✓ Registrado correctamente');

  _fmActualizarUI(tipo, estiloMonto);
}

// ── Eliminar movimiento ───────────────────────────────────────────────
async function _fmEliminarMovimiento(tipo, id) {
  if (!confirm('¿Eliminar este registro?')) return;
  if (!_fmDatos[tipo]) return;
  _fmDatos[tipo] = _fmDatos[tipo].filter(i => i.id !== id);
  await _fmGuardar(_fmMesActual, _fmDatos);
  if (typeof toast === 'function') toast('Registro eliminado', true);

  const estiloMapa = { ventas: 'ingreso', facturas: 'egreso', gastos: 'egreso' };
  _fmActualizarUI(tipo, estiloMapa[tipo] || 'egreso');
}

// ── Actualizar UI sin re-renderizar toda la página ────────────────────
function _fmActualizarUI(tipo, estiloMonto) {
  const listId = { ventas: 'fmVentasList', facturas: 'fmFacturasList', gastos: 'fmGastosList' };
  const totalId = { ventas: 'fmVentasTotal', facturas: 'fmFacturasTotal', gastos: 'fmGastosTotal' };
  const cntId = { ventas: 'fmVentasCnt', facturas: 'fmFacturasCnt', gastos: 'fmGastosCnt' };

  const items = _fmDatos[tipo] || [];
  const el = document.getElementById(listId[tipo]);
  if (el) el.innerHTML = _fmRenderLista(items, tipo, estiloMonto);

  const total = items.reduce((s, v) => s + Number(v.monto || 0), 0);
  const elTotal = document.getElementById(totalId[tipo]);
  if (elTotal) {
    const prefix = estiloMonto === 'egreso' ? '' : '';
    elTotal.textContent = `$${total.toFixed(2)}`;
  }

  const cnt = document.getElementById(cntId[tipo]);
  if (cnt) cnt.textContent = items.length;

  // Actualizar proyección
  _fmActualizarProyeccion();
}

function _fmActualizarProyeccion() {
  const totalVentas   = (_fmDatos.ventas   || []).reduce((s, v) => s + Number(v.monto || 0), 0);
  const totalFacturas = (_fmDatos.facturas  || []).reduce((s, v) => s + Number(v.monto || 0), 0);
  const totalGastos   = (_fmDatos.gastos   || []).reduce((s, v) => s + Number(v.monto || 0), 0);
  const efectivoIni   = Number(_fmDatos.efectivoInicial  || 0);
  const inventarioIni = Number(_fmDatos.inventarioInicial || 0);

  const dineroDisp   = efectivoIni + totalVentas - totalFacturas - totalGastos;
  const inventarioEst = Math.max(0, inventarioIni - totalVentas);
  const totalEgresos = totalFacturas + totalGastos;

  const _set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  _set('fmPrDinero',    '$' + dineroDisp.toFixed(2));
  _set('fmPrInventario','$' + inventarioEst.toFixed(2));
  _set('fmPrVentas',    '$' + totalVentas.toFixed(2));
  _set('fmPrEgresos',   '$' + totalEgresos.toFixed(2));

  // Cards del hero
  _set('fmVentasTotal',   '$' + totalVentas.toFixed(2));
  _set('fmFacturasTotal', '$' + totalFacturas.toFixed(2));
  _set('fmGastosTotal',   '$' + totalGastos.toFixed(2));
}

// ── Guardar valores iniciales (solo Admin) ────────────────────────────
async function _fmGuardarIniciales() {
  if (!_fmEsAdmin()) { if (typeof toast === 'function') toast('Sin permiso', true); return; }

  const ef  = parseFloat(document.getElementById('fmEfectivoIni')?.value  || '0') || 0;
  const inv = parseFloat(document.getElementById('fmInventarioIni')?.value || '0') || 0;

  _fmDatos.efectivoInicial  = ef;
  _fmDatos.inventarioInicial = inv;

  const btn = document.getElementById('btnFmGuardarIni');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

  await _fmGuardar(_fmMesActual, _fmDatos);

  if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar valores iniciales'; }
  if (typeof toast === 'function') toast('✅ Valores iniciales guardados');

  // Registrar acción
  if (typeof _registrarAccion === 'function') {
    _registrarAccion('fm_iniciales', `Efectivo: $${ef.toFixed(2)} | Inventario: $${inv.toFixed(2)} | Mes: ${_fmMesActual}`);
  }

  // Actualizar proyección
  _fmActualizarProyeccion();

  // Re-renderizar hero con nuevos valores
  await renderFinanzasMes('pgFinanzasMes');
}

// ── Cambiar de mes ────────────────────────────────────────────────────
async function _fmCambiarMes(mes) {
  _fmMesActual = mes;
  await renderFinanzasMes('pgFinanzasMes');
}

// ── Registrar en renderPagina del app principal ───────────────────────
// Llama esto desde renderPagina(pgId) en app.js:
//   if (pgId === 'pgFinanzasMes') { if (typeof renderFinanzasMes==='function') renderFinanzasMes(pgId); }
//
// También agregar en actualizarTodo():
//   if (pgId === 'pgFinanzasMes') { if (typeof renderFinanzasMes==='function') renderFinanzasMes(pgId); }

// ── Exponer globalmente ───────────────────────────────────────────────
window.renderFinanzasMes       = renderFinanzasMes;
window._fmGuardarIniciales     = _fmGuardarIniciales;
window._fmAgregarMovimiento    = _fmAgregarMovimiento;
window._fmEliminarMovimiento   = _fmEliminarMovimiento;
window._fmCambiarMes           = _fmCambiarMes;
