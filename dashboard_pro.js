// =====================================================================
//  DESPENSA ECONÓMICA — dashboard_pro.js
//  ✅ Dashboard tipo negocio real (KPIs, alertas, gráficas)
//  ✅ Sistema multi-cliente (cada tienda = datos separados)
//  ✅ Control de turnos (solo admin puede cambiar cajero)
//  ✅ Backup/Restore completo en JSON
//  ✅ Gestión de usuarios mejorada
// =====================================================================

// =====================================================================
//  SECCIÓN 1 — DASHBOARD PRO
// =====================================================================

function renderDashboardPro() {
  const cont = document.getElementById('dashProContainer');
  if (!cont) return;

  const hoy     = new Date();
  const hoyStr  = hoy.toDateString();

  // ── FIX: respetar timestamp del reset manual del día ──
  const _resetTs = (() => {
    const ts = localStorage.getItem('vpos_reinicioDiaTs');
    const fd = localStorage.getItem('vpos_reinicioDiaFecha');
    if (!ts || !fd || fd !== hoyStr) return null;
    return new Date(ts);
  })();

  // ── Ventas del día ──
  const ventasHoy = (historial || []).filter(v => {
    const f = new Date(v.fechaISO || v.ts || 0);
    if (f.toDateString() !== hoyStr) return false;
    if (_resetTs && f < _resetTs) return false; // ignorar ventas antes del reset
    return true;
  });
  const totalHoy  = ventasHoy.reduce((a, v) => a + parseFloat(v.total || 0), 0);
  const numVentas = ventasHoy.length;

  // ── Ganancia del día ──
  const gananciaHoy = ventasHoy.reduce((acc, v) => {
    return acc + (v.items || []).reduce((a, it) => {
      const prod    = (productos || []).find(p => p.nom === it.nom || String(p.id) === String(it.id));
      const compra  = prod ? parseFloat(prod.compra || 0) : 0;
      return a + (parseFloat(it.precio || 0) - compra) * Number(it.cant || 1);
    }, 0);
  }, 0);
  const margenHoy = totalHoy > 0 ? (gananciaHoy / totalHoy * 100).toFixed(1) : '0.0';

  // ── Productos bajos en stock ──
  const prodsBajos = (productos || [])
    .filter(p => p.stock <= (p.min || 0) + 2 && p.stock >= 0)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  // ── Ventas por hora (hoy) ──
  const porHora = {};
  ventasHoy.forEach(v => {
    const h = new Date(v.fechaISO || v.ts || 0).getHours();
    if (!porHora[h]) porHora[h] = 0;
    porHora[h] += parseFloat(v.total || 0);
  });
  const maxHora = Math.max(...Object.values(porHora), 1);

  // ── Top 5 productos hoy ──
  const topProds = {};
  ventasHoy.forEach(v => {
    (v.items || []).forEach(it => {
      if (!topProds[it.nom]) topProds[it.nom] = 0;
      topProds[it.nom] += Number(it.cant || 1);
    });
  });
  const top5 = Object.entries(topProds).sort((a,b) => b[1]-a[1]).slice(0,5);

  // ── Turno actual ──
  const turnoActual = _turnoActual || null;

  // ── Render ──
  cont.innerHTML = `
    <!-- Saludo + fecha -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
      <div>
        <div style="font-size:22px;font-weight:900;color:var(--text);">
          ${_getSaludo()}, <span style="color:var(--green);">${(typeof _usuarioActual !== 'undefined' && _usuarioActual?.nombre) || 'usuario'}</span> 👋
        </div>
        <div style="font-size:13px;color:var(--text-muted);font-weight:700;margin-top:2px;">
          ${hoy.toLocaleDateString('es-SV',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-green" onclick="abrirCambioTurno()" style="padding:10px 16px;font-size:13px;">
          🔄 Cambiar turno
        </button>
        <button class="btn btn-ghost" onclick="abrirBackupPanel()" style="padding:10px 16px;font-size:13px;">
          💾 Backup
        </button>
      </div>
    </div>

    <!-- Banner turno activo -->
    ${turnoActual ? `
    <div style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);border-radius:12px;padding:12px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 14px rgba(29,78,216,.3);">
      <div style="font-size:22px;">👤</div>
      <div style="flex:1;">
        <div style="font-weight:900;font-size:14px;color:#fff;">Turno activo: ${turnoActual.cajero}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:2px;">Inicio: ${turnoActual.inicio} · ${turnoActual.nota || 'Sin nota'}</div>
      </div>
      <div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:#93c5fd;">${_tiempoTurno(turnoActual.tsInicio)}</div>
    </div>` : ''}

    <!-- KPIs principales -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px;">
      ${_kpiDash('💰', 'Ventas hoy', '$' + totalHoy.toFixed(2), '#16a34a', numVentas + ' transacciones')}
      ${_kpiDash('✨', 'Ganancia', '$' + gananciaHoy.toFixed(2), '#059669', 'Margen ' + margenHoy + '%')}
      ${_kpiDash('🏷️', 'Transacciones', numVentas, '#1d4ed8', numVentas === 0 ? 'Sin ventas aún' : 'Promedio $' + (numVentas > 0 ? (totalHoy/numVentas).toFixed(2) : '0'))}
      ${_kpiDash('📦', 'Productos', (productos||[]).length, '#7c3aed', prodsBajos.length + ' con stock bajo')}
    </div>

    <!-- Dos columnas: gráfica + alertas -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">

      <!-- Ventas por hora -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-icon">⏰</div> Ventas por hora</div>
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;">Hoy</div>
        </div>
        <div class="card-body" style="padding:16px;">
          ${Object.keys(porHora).length === 0
            ? '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">Sin ventas aún hoy</div>'
            : `<div style="display:flex;align-items:flex-end;gap:4px;height:90px;">
                ${Array.from({length:14},(_,i)=>i+7).map(h => {
                  const val = porHora[h] || 0;
                  const pct  = Math.max(4, (val/maxHora)*80);
                  const active = val > 0;
                  return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;" title="$${val.toFixed(0)}">
                    <div style="width:100%;background:${active?'var(--green)':'var(--green-100)'};border-radius:3px 3px 0 0;height:${pct}px;transition:height .4s;min-height:4px;"></div>
                    <div style="font-size:8px;font-weight:700;color:var(--text-muted);">${h}h</div>
                  </div>`;
                }).join('')}
              </div>`}
        </div>
      </div>

      <!-- Alertas de stock bajo -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-icon">⚠️</div> Stock bajo</div>
          <span style="background:rgba(220,38,38,.1);color:var(--red);border:1px solid rgba(220,38,38,.2);border-radius:100px;padding:2px 9px;font-size:11px;font-weight:900;">${prodsBajos.length}</span>
        </div>
        <div class="card-body" style="padding:12px 16px;">
          ${prodsBajos.length === 0
            ? '<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:13px;">✅ Todo el stock está bien</div>'
            : prodsBajos.map(p => `
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--green-100);">
              <div style="width:32px;height:32px;border-radius:8px;background:${p.stock===0?'rgba(220,38,38,.1)':'rgba(217,119,6,.1)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">
                ${p.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '📦'}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:900;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.nom}</div>
                <div style="font-size:10px;color:var(--text-muted);font-weight:700;">${p.cat||''}</div>
              </div>
              <div style="font-family:'Space Mono',monospace;font-size:15px;font-weight:900;color:${p.stock===0?'var(--red)':'var(--amber)'};">${p.stock}</div>
            </div>`).join('')}
          ${prodsBajos.length > 0 ? `<button class="btn btn-ghost" onclick="navTo('pgInventario')" style="width:100%;margin-top:10px;font-size:12px;padding:8px;">Ver inventario →</button>` : ''}
        </div>
      </div>
    </div>

    <!-- Top productos + Últimas ventas -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

      <!-- Top 5 del día -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-icon">🏆</div> Top del día</div>
        </div>
        <div class="card-body" style="padding:12px 16px;">
          ${top5.length === 0
            ? '<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:13px;">Sin ventas aún</div>'
            : top5.map(([nom, cant], i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;${i<4?'border-bottom:1px solid var(--green-100);':''}">
              <div style="width:24px;height:24px;border-radius:50%;background:${['#fbbf24','#9ca3af','#cd7c00','var(--green-100)','var(--green-100)'][i]};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:${i<3?'#fff':'var(--green)'};">${i+1}</div>
              <div style="flex:1;font-size:13px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nom}</div>
              <div style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:var(--text-muted);">${cant} uds</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Últimas 5 ventas -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-icon">🕐</div> Últimas ventas</div>
          <button class="btn btn-ghost" onclick="navTo('pgReportes')" style="padding:5px 10px;font-size:11px;">Ver todas</button>
        </div>
        <div class="card-body" style="padding:12px 16px;">
          ${ventasHoy.length === 0
            ? '<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:13px;">Sin ventas aún</div>'
            : ventasHoy.slice(0,5).map(v => {
                const hora = new Date(v.fechaISO||v.ts||0).toLocaleTimeString('es-SV',{hour:'2-digit',minute:'2-digit'});
                const items = (v.items||[]).map(i=>i.nom).join(', ').slice(0,35);
                return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--green-100);">
                  <div style="font-size:10px;font-family:'Space Mono',monospace;color:var(--text-muted);width:38px;flex-shrink:0;">${hora}</div>
                  <div style="flex:1;font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${items}…</div>
                  <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:900;color:var(--green);">$${parseFloat(v.total).toFixed(2)}</div>
                </div>`;
              }).join('')}
        </div>
      </div>
    </div>
  `;
}

function _kpiDash(icon, label, value, color, sub) {
  return `
  <div style="background:#fff;border:1.5px solid ${color}22;border-radius:16px;padding:18px 16px;box-shadow:0 2px 8px ${color}14;transition:all .2s;cursor:default;"
    onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px ${color}28';"
    onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px ${color}14';">
    <div style="font-size:26px;margin-bottom:6px;">${icon}</div>
    <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:${color};line-height:1.1;">${value}</div>
    <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">${label}</div>
    ${sub ? `<div style="font-size:10px;color:${color};font-weight:700;margin-top:3px;opacity:.8;">${sub}</div>` : ''}
  </div>`;
}

function _getSaludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function _tiempoTurno(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return mins + 'm';
  return Math.floor(mins/60) + 'h ' + (mins%60) + 'm';
}

// Auto-refresh del dashboard cada 60 segundos
let _dashTimer = null;
function _startDashRefresh() {
  clearInterval(_dashTimer);
  _dashTimer = setInterval(() => {
    if (document.getElementById('dashProContainer')) renderDashboardPro();
  }, 60000);
}

// =====================================================================
//  SECCIÓN 2 — CONTROL DE TURNOS
// =====================================================================

let _turnoActual = JSON.parse(localStorage.getItem('vpos_turnoActual') || 'null');

function abrirCambioTurno() {
  if (typeof _puedeHacer === 'function' && !_puedeHacer('config')) {
    _pedirClaveAdminParaTurno();
    return;
  }
  _mostrarModalTurno();
}

function _mostrarModalTurno() {
  if (document.getElementById('modalCambioTurno')) document.getElementById('modalCambioTurno').remove();

  const turno = _turnoActual;
  const usuarios = typeof _usuariosCache !== 'undefined' ? _usuariosCache : [];

  const div = document.createElement('div');
  div.id = 'modalCambioTurno';
  div.className = 'modal';
  div.innerHTML = `
  <div class="modal-box" style="max-width:460px;">
    <div class="modal-header" style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);">
      <h3 style="color:#fff;">🔄 Control de Turno</h3>
      <button class="btn-close" onclick="cerrarModal('modalCambioTurno')" style="background:rgba(255,255,255,.15);color:#fff;">✕</button>
    </div>
    <div class="modal-body">

      ${turno ? `
      <div style="background:var(--green-50);border:1.5px solid var(--green-200);border-radius:12px;padding:14px 16px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--green-700);margin-bottom:6px;">Turno actual</div>
        <div style="font-weight:900;font-size:15px;">${turno.cajero}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Desde: ${turno.inicio}</div>
        ${turno.nota ? `<div style="font-size:12px;color:var(--text-muted);">${turno.nota}</div>` : ''}
      </div>` : `
      <div style="background:rgba(217,119,6,.08);border:1.5px solid rgba(217,119,6,.3);border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;font-weight:700;color:var(--amber);">
        ⚠️ No hay turno activo
      </div>`}

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="field">
          <label>Nombre del cajero</label>
          <input id="turnoNombreCajero" type="text" placeholder="Ej: María García"
            value="${turno ? turno.cajero : ''}"
            style="font-size:15px;" autofocus>
        </div>
        <div class="field">
          <label>Nota del turno (opcional)</label>
          <input id="turnoNota" type="text" placeholder="Ej: Turno mañana, caja inicial $50"
            value="${turno ? (turno.nota||'') : ''}">
        </div>
        <div class="field">
          <label>Efectivo inicial en caja</label>
          <input id="turnoEfectivo" type="number" placeholder="0.00" step="0.01" min="0"
            value="${turno ? '' : (typeof efectivoInicial !== 'undefined' ? efectivoInicial : 0)}">
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:18px;">
        <button class="btn btn-green" style="flex:1;padding:14px;" onclick="confirmarCambioTurno()">
          ✅ ${turno ? 'Cambiar turno' : 'Iniciar turno'}
        </button>
        ${turno ? `<button class="btn btn-danger" style="padding:14px 18px;" onclick="cerrarTurno()">🔴 Cerrar turno</button>` : ''}
      </div>
    </div>
  </div>`;

  document.body.appendChild(div);
  div.addEventListener('click', e => { if (e.target === div) cerrarModal('modalCambioTurno'); });
  div.classList.add('open');
  setTimeout(() => document.getElementById('turnoNombreCajero')?.focus(), 100);
}

function confirmarCambioTurno() {
  const nombre   = document.getElementById('turnoNombreCajero')?.value.trim();
  const nota     = document.getElementById('turnoNota')?.value.trim();
  const efectivo = parseFloat(document.getElementById('turnoEfectivo')?.value || '0');

  if (!nombre) { toast('Ingresa el nombre del cajero', true); return; }

  const prevTurno = _turnoActual;

  _turnoActual = {
    cajero  : nombre,
    nota    : nota,
    inicio  : new Date().toLocaleString('es-SV'),
    tsInicio: Date.now(),
    efectivo: efectivo
  };
  localStorage.setItem('vpos_turnoActual', JSON.stringify(_turnoActual));

  // Actualizar efectivo inicial si se especificó
  if (efectivo > 0 && typeof idbSet === 'function') {
    window.efectivoInicial = efectivo;
    idbSet('vpos_efectivoInicial', efectivo).catch(console.error);
  }

  // Registrar en log de acciones
  if (typeof _registrarAccion === 'function') {
    const prev = prevTurno ? ` (reemplaza a ${prevTurno.cajero})` : '';
    _registrarAccion('cambio_turno', `Turno iniciado: ${nombre}${prev}`);
  }

  cerrarModal('modalCambioTurno');
  toast(`✅ Turno iniciado — ${nombre}`);

  // Actualizar dashboard
  setTimeout(renderDashboardPro, 200);
}

function cerrarTurno() {
  if (!_turnoActual) return;
  if (!confirm(`¿Cerrar el turno de ${_turnoActual.cajero}?`)) return;

  if (typeof _registrarAccion === 'function') {
    _registrarAccion('cierre_turno', `Turno cerrado: ${_turnoActual.cajero}`);
  }

  _turnoActual = null;
  localStorage.removeItem('vpos_turnoActual');
  cerrarModal('modalCambioTurno');
  toast('Turno cerrado');
  setTimeout(renderDashboardPro, 200);
}

// Cajero pide clave al admin para cambiar turno
function _pedirClaveAdminParaTurno() {
  if (document.getElementById('modalClaveAdmin')) document.getElementById('modalClaveAdmin').remove();

  const div = document.createElement('div');
  div.id = 'modalClaveAdmin';
  div.className = 'modal';
  div.innerHTML = `
  <div class="modal-box" style="max-width:360px;">
    <div class="modal-header">
      <h3>🔐 Autorización Admin</h3>
      <button class="btn-close" onclick="cerrarModal('modalClaveAdmin')">✕</button>
    </div>
    <div class="modal-body">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;font-weight:700;">
        Solo el administrador puede cambiar el turno. Pídele que ingrese su contraseña.
      </div>
      <div class="field">
        <label>Contraseña del administrador</label>
        <input id="claveAdminTurno" type="password" placeholder="••••••••"
          onkeydown="if(event.key==='Enter') verificarClaveAdminTurno()">
      </div>
      <div id="errorClaveAdmin" style="color:var(--red);font-size:12px;font-weight:700;display:none;margin-top:6px;"></div>
      <button class="btn btn-green" style="width:100%;margin-top:14px;padding:14px;" onclick="verificarClaveAdminTurno()">
        🔓 Verificar y cambiar turno
      </button>
    </div>
  </div>`;

  document.body.appendChild(div);
  div.addEventListener('click', e => { if (e.target === div) cerrarModal('modalClaveAdmin'); });
  div.classList.add('open');
  setTimeout(() => document.getElementById('claveAdminTurno')?.focus(), 100);
}

async function verificarClaveAdminTurno() {
  const clave = document.getElementById('claveAdminTurno')?.value;
  if (!clave) { toast('Ingresa la contraseña', true); return; }

  const errEl = document.getElementById('errorClaveAdmin');

  // Verificar con Supabase Auth
  try {
    // Buscar el admin de esta tienda
    const admins = typeof _sbGet === 'function'
      ? await _sbGet('perfiles', { select: 'email', tienda_id: 'eq.' + (typeof _getTiendaId === 'function' ? _getTiendaId() : ''), rol: 'eq.admin', limit: 1 }).catch(() => [])
      : [];

    if (!admins || !admins.length) {
      if (errEl) { errEl.textContent = 'No se encontró administrador'; errEl.style.display = 'block'; }
      return;
    }

    const adminEmail = admins[0].email;
    const url = typeof _sbUrl === 'function' ? _sbUrl() : '';
    const key = typeof _sbKey === 'function' ? _sbKey() : '';

    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: clave })
    });
    const data = await r.json();

    if (data.access_token) {
      cerrarModal('modalClaveAdmin');
      setTimeout(_mostrarModalTurno, 200);
    } else {
      if (errEl) { errEl.textContent = 'Contraseña incorrecta'; errEl.style.display = 'block'; }
      document.getElementById('claveAdminTurno').value = '';
      document.getElementById('claveAdminTurno').focus();
    }
  } catch(e) {
    if (errEl) { errEl.textContent = 'Error de conexión'; errEl.style.display = 'block'; }
  }
}

// =====================================================================
//  SECCIÓN 3 — BACKUP / RESTORE COMPLETO JSON
// =====================================================================

function abrirBackupPanel() {
  if (document.getElementById('modalBackupPro')) document.getElementById('modalBackupPro').remove();

  const ultimoBackup = localStorage.getItem('vpos_ultimoBackupPro');
  const tiendaId     = typeof _getTiendaId === 'function' ? _getTiendaId() : 'tienda';

  const div = document.createElement('div');
  div.id = 'modalBackupPro';
  div.className = 'modal';
  div.innerHTML = `
  <div class="modal-box" style="max-width:500px;">
    <div class="modal-header" style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);">
      <h3 style="color:#fff;">💾 Backup & Restore</h3>
      <button class="btn-close" onclick="cerrarModal('modalBackupPro')" style="background:rgba(255,255,255,.15);color:#fff;">✕</button>
    </div>
    <div class="modal-body">

      <!-- Info -->
      <div style="background:var(--green-50);border:1.5px solid var(--green-200);border-radius:12px;padding:14px 16px;margin-bottom:18px;">
        <div style="font-size:13px;font-weight:800;color:var(--green-700);margin-bottom:4px;">📊 Estado actual</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;font-weight:700;color:var(--text-muted);">
          <div>📦 ${(productos||[]).length} productos</div>
          <div>🧾 ${(historial||[]).length} ventas</div>
          <div>💸 ${(pagos||[]).length} gastos</div>
          <div>🏪 Tienda: <b>${tiendaId}</b></div>
        </div>
        ${ultimoBackup ? `<div style="font-size:11px;color:var(--green-700);margin-top:8px;font-weight:700;">Último backup: ${new Date(ultimoBackup).toLocaleString('es-SV')}</div>` : '<div style="font-size:11px;color:var(--amber);margin-top:8px;font-weight:700;">⚠️ Sin backups guardados</div>'}
      </div>

      <!-- Opciones de export -->
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:10px;">Exportar</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button class="btn btn-green" style="padding:14px;flex-direction:column;gap:4px;" onclick="exportarBackupCompleto()">
            <span style="font-size:20px;">📥</span>
            <span>Backup completo</span>
            <span style="font-size:10px;opacity:.8;font-weight:700;">Todo en JSON</span>
          </button>
          <button class="btn btn-ghost" style="padding:14px;flex-direction:column;gap:4px;" onclick="exportarSoloProductos()">
            <span style="font-size:20px;">📦</span>
            <span>Solo productos</span>
            <span style="font-size:10px;opacity:.8;font-weight:700;">Catálogo JSON</span>
          </button>
          <button class="btn btn-ghost" style="padding:14px;flex-direction:column;gap:4px;" onclick="exportarSoloVentas()">
            <span style="font-size:20px;">🧾</span>
            <span>Solo ventas</span>
            <span style="font-size:10px;opacity:.8;font-weight:700;">Historial JSON</span>
          </button>
          <button class="btn btn-ghost" style="padding:14px;flex-direction:column;gap:4px;" onclick="generarReportePDF()">
            <span style="font-size:20px;">📄</span>
            <span>Reporte PDF</span>
            <span style="font-size:10px;opacity:.8;font-weight:700;">Resumen del mes</span>
          </button>
        </div>
      </div>

      <!-- Importar -->
      <div>
        <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:10px;">Importar / Restaurar</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button class="btn btn-ghost" style="padding:14px;flex-direction:column;gap:4px;border-color:var(--amber);color:var(--amber);"
            onclick="document.getElementById('inputRestoreCompleto').click()">
            <span style="font-size:20px;">📤</span>
            <span>Restaurar backup</span>
            <span style="font-size:10px;font-weight:700;">Reemplaza todo</span>
          </button>
          <button class="btn btn-ghost" style="padding:14px;flex-direction:column;gap:4px;"
            onclick="document.getElementById('inputFusionarPro').click()">
            <span style="font-size:20px;">🔀</span>
            <span>Fusionar datos</span>
            <span style="font-size:10px;font-weight:700;">Combina sin borrar</span>
          </button>
        </div>
        <input type="file" id="inputRestoreCompleto" accept=".json" style="display:none" onchange="restaurarBackupCompleto(event)">
        <input type="file" id="inputFusionarPro" accept=".json" style="display:none" onchange="fusionarDatos(event)">
      </div>

      <div id="backupProgressMsg" style="display:none;margin-top:14px;padding:10px 14px;background:var(--green-50);border:1px solid var(--green-200);border-radius:8px;font-size:13px;font-weight:700;color:var(--green-700);"></div>
    </div>
  </div>`;

  document.body.appendChild(div);
  div.addEventListener('click', e => { if (e.target === div) cerrarModal('modalBackupPro'); });
  div.classList.add('open');
}

function exportarBackupCompleto() {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'tienda';
  const usuario  = typeof _usuarioActual !== 'undefined' ? _usuarioActual?.email : '';

  const datos = {
    _meta: {
      version      : typeof APP_SCHEMA_VERSION !== 'undefined' ? APP_SCHEMA_VERSION : 4,
      exportado    : new Date().toISOString(),
      tienda_id    : tiendaId,
      usuario      : usuario,
      app          : 'Despensa Económica',
      tipo         : 'backup_completo'
    },
    efectivoInicial,
    inventarioInicial,
    productos    : productos     || [],
    ventasDia    : ventasDia     || {},
    ventasSem    : ventasSem     || {},
    ventasMes    : ventasMes     || {},
    historial    : historial     || [],
    pagos        : pagos         || [],
    ventasDiarias: ventasDiarias || [],
    restockLog   : restockLog    || [],
    turnoActual  : _turnoActual  || null
  };

  _descargarJSON(datos, `Backup_${tiendaId}_${_hoyStr()}.json`);
  localStorage.setItem('vpos_ultimoBackupPro', new Date().toISOString());

  if (typeof _registrarAccion === 'function') _registrarAccion('backup', 'Backup completo exportado');
  _backupMsg('✅ Backup exportado — guárdalo en lugar seguro');
  if (typeof actualizarSubtituloBackup === 'function') actualizarSubtituloBackup();
}

function exportarSoloProductos() {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'tienda';
  const datos = {
    _meta: { tipo: 'productos', exportado: new Date().toISOString(), tienda_id: tiendaId },
    productos: productos || []
  };
  _descargarJSON(datos, `Productos_${tiendaId}_${_hoyStr()}.json`);
  _backupMsg('✅ Catálogo de productos exportado');
}

function exportarSoloVentas() {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'tienda';
  const datos = {
    _meta: { tipo: 'ventas', exportado: new Date().toISOString(), tienda_id: tiendaId },
    historial    : historial      || [],
    ventasDiarias: ventasDiarias  || [],
    pagos        : pagos          || []
  };
  _descargarJSON(datos, `Ventas_${tiendaId}_${_hoyStr()}.json`);
  _backupMsg('✅ Historial de ventas exportado');
}

function restaurarBackupCompleto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const datos = JSON.parse(e.target.result);
      if (!datos.productos && !datos._meta) {
        toast('Archivo inválido — no es un backup de Despensa Económica', true);
        event.target.value = ''; return;
      }

      const meta  = datos._meta || {};
      const nProd = (datos.productos||[]).length;
      const nVent = (datos.historial||[]).length;
      const nPago = (datos.pagos||[]).length;
      const fecha = meta.exportado ? new Date(meta.exportado).toLocaleDateString('es-SV') : 'desconocida';

      if (!confirm(
        `¿Restaurar este backup?\n\n` +
        `📅 Fecha: ${fecha}\n` +
        `🏪 Tienda: ${meta.tienda_id || 'desconocida'}\n` +
        `📦 ${nProd} productos\n` +
        `🧾 ${nVent} ventas\n` +
        `💸 ${nPago} gastos\n\n` +
        `⚠️ ESTO REEMPLAZARÁ TODOS TUS DATOS ACTUALES.`
      )) { event.target.value = ''; return; }

      // Restaurar datos
      window.productos     = datos.productos     || [];
      window.ventasDia     = datos.ventasDia     || {};
      window.ventasSem     = datos.ventasSem     || {};
      window.ventasMes     = datos.ventasMes     || {};
      window.historial     = datos.historial     || [];
      window.pagos         = datos.pagos         || [];
      window.ventasDiarias = datos.ventasDiarias || [];
      window.restockLog    = datos.restockLog    || [];

      if (datos.efectivoInicial   != null) window.efectivoInicial   = parseFloat(datos.efectivoInicial)   || 0;
      if (datos.inventarioInicial != null) window.inventarioInicial = parseFloat(datos.inventarioInicial) || 0;
      if (datos.turnoActual) { _turnoActual = datos.turnoActual; localStorage.setItem('vpos_turnoActual', JSON.stringify(_turnoActual)); }

      // Normalizar
      if (typeof normalizeReport    === 'function') { window.ventasDia = normalizeReport(window.ventasDia); window.ventasSem = normalizeReport(window.ventasSem); window.ventasMes = normalizeReport(window.ventasMes); }
      if (typeof normalizeHistorial === 'function') window.historial = normalizeHistorial(window.historial);
      if (typeof normalizePagos     === 'function') window.pagos     = normalizePagos(window.pagos);

      if (typeof salvar === 'function') salvar();
      if (typeof _registrarAccion === 'function') _registrarAccion('restore', `Backup restaurado: ${nProd} prods, ${nVent} ventas`);

      event.target.value = '';
      cerrarModal('modalBackupPro');
      toast(`✅ Backup restaurado — ${nProd} productos cargados`);
      setTimeout(renderDashboardPro, 300);

    } catch (err) {
      toast('Error al leer el archivo: ' + err.message, true);
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function _descargarJSON(datos, nombre) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _backupMsg(msg) {
  const el = document.getElementById('backupProgressMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { if (el) el.style.display = 'none'; }, 4000);
}

function _hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// =====================================================================
//  SECCIÓN 4 — SISTEMA MULTI-CLIENTE
// =====================================================================

/**
 * Panel de selección de tienda al inicio (multi-cliente)
 * Se muestra si el usuario tiene acceso a múltiples tiendas
 */
async function verificarMultiTienda() {
  // Cada usuario opera SOLO su propia tienda — el super admin no es excepción.
  // Esta función queda desactivada para evitar que se mezclen tiendas de clientes.
  return;
}

function _mostrarSelectorTienda(tiendas) {
  if (document.getElementById('modalSelectorTienda')) return;

  const div = document.createElement('div');
  div.id = 'modalSelectorTienda';
  div.className = 'modal';
  div.innerHTML = `
  <div class="modal-box" style="max-width:420px;">
    <div class="modal-header" style="background:linear-gradient(135deg,#4c1d95,#7c3aed);">
      <h3 style="color:#fff;">🏪 Seleccionar tienda</h3>
    </div>
    <div class="modal-body">
      <div style="font-size:13px;color:var(--text-muted);font-weight:700;margin-bottom:14px;">
        Tienes acceso a múltiples tiendas. ¿Con cuál quieres trabajar?
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${tiendas.map(t => `
        <button class="btn btn-ghost" style="padding:14px 18px;text-align:left;justify-content:flex-start;gap:12px;"
          onclick="seleccionarTienda('${t.tienda_id}')">
          <span style="font-size:22px;">🏪</span>
          <div>
            <div style="font-weight:900;font-size:14px;">${t.tienda_nombre || t.tienda_id}</div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;">ID: ${t.tienda_id}</div>
          </div>
        </button>`).join('')}
      </div>
    </div>
  </div>`;

  document.body.appendChild(div);
  div.classList.add('open');
}

async function seleccionarTienda(tiendaId) {
  if (typeof _tiendaId !== 'undefined') window._tiendaId = tiendaId;
  localStorage.setItem('vpos_tiendaId', tiendaId);
  cerrarModal('modalSelectorTienda');
  toast('🏪 Tienda: ' + tiendaId);
  if (typeof _autoCargarDesdeSupa === 'function') {
    if (typeof NProgress !== 'undefined') NProgress.start();
    await _autoCargarDesdeSupa();
    if (typeof NProgress !== 'undefined') NProgress.done();
  }
  setTimeout(renderDashboardPro, 300);
}

// =====================================================================
//  SECCIÓN 5 — GESTIÓN DE USUARIOS MEJORADA
// =====================================================================

async function abrirGestionUsuariosPro() {
  if (typeof _puedeHacer === 'function' && !_puedeHacer('usuarios')) {
    toast('Solo el Admin puede gestionar usuarios', true); return;
  }
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : '';
  let usuarios = [];
  try {
    usuarios = typeof _sbGet === 'function'
      ? await _sbGet('perfiles', { select: '*', tienda_id: 'eq.' + tiendaId, order: 'created_at.asc' })
      : [];
  } catch(e) {}

  if (document.getElementById('modalUsuariosPro')) document.getElementById('modalUsuariosPro').remove();

  const div = document.createElement('div');
  div.id = 'modalUsuariosPro';
  div.className = 'modal';
  div.innerHTML = `
  <div class="modal-box" style="max-width:520px;">
    <div class="modal-header" style="background:linear-gradient(135deg,#4c1d95,#7c3aed);">
      <h3 style="color:#fff;">👥 Usuarios de la tienda</h3>
      <button class="btn-close" onclick="cerrarModal('modalUsuariosPro')" style="background:rgba(255,255,255,.15);color:#fff;">✕</button>
    </div>
    <div class="modal-body">

      <div style="background:rgba(124,58,237,.06);border:1.5px solid rgba(124,58,237,.2);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;font-weight:700;color:#5b21b6;">
        💡 Los usuarios se registran desde el botón "Sesión" → "Registrarse".
        El primer usuario de cada tienda es automáticamente Admin.
      </div>

      <div id="listaUsuariosPro">
        ${usuarios.length === 0
          ? '<div style="text-align:center;color:var(--text-muted);padding:24px;">Sin usuarios</div>'
          : usuarios.map(u => _renderUsuarioRow(u)).join('')}
      </div>

      <!-- Invitar usuario -->
      <div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px;">
        <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:10px;">Agregar usuario</div>
        <div style="display:flex;gap:8px;">
          <input id="inviteEmail" type="email" placeholder="correo@ejemplo.com" style="flex:1;">
          <select id="inviteRol" style="width:120px;">
            <option value="cajero">Cajero</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style="font-size:11px;color:var(--text-muted);font-weight:700;margin:6px 0 10px;">
          El usuario debe registrarse con este correo. Su tienda se asignará automáticamente.
        </div>
        <button class="btn btn-green" style="width:100%;padding:12px;" onclick="invitarUsuario()">
          ➕ Agregar usuario a esta tienda
        </button>
      </div>
    </div>
  </div>`;

  document.body.appendChild(div);
  div.addEventListener('click', e => { if (e.target === div) cerrarModal('modalUsuariosPro'); });
  div.classList.add('open');
}

function _renderUsuarioRow(u) {
  const rolInfo  = (typeof ROLES !== 'undefined' ? ROLES[u.rol] : null) || { label: u.rol || 'cajero', color: '#6b7280' };
  const esYo     = typeof _usuarioActual !== 'undefined' && u.id === _usuarioActual?.id;
  const esTurno  = _turnoActual && _turnoActual.cajero === u.nombre;

  return `
  <div style="display:flex;align-items:center;gap:10px;padding:12px;background:${esYo?'var(--green-50)':'var(--surface2)'};border-radius:12px;border:1.5px solid ${esYo?'var(--green-200)':'var(--border)'};margin-bottom:8px;transition:all .15s;">
    <div style="width:38px;height:38px;border-radius:50%;background:${rolInfo.color}22;border:2px solid ${rolInfo.color}44;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
      ${u.rol==='admin'?'👑':u.rol==='supervisor'?'🔧':'👤'}
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:900;font-size:14px;display:flex;align-items:center;gap:6px;">
        ${u.nombre || u.email?.split('@')[0]}
        ${esYo ? '<span style="font-size:10px;background:var(--green-100);color:var(--green-700);border-radius:100px;padding:1px 7px;">tú</span>' : ''}
        ${esTurno ? '<span style="font-size:10px;background:rgba(29,78,216,.1);color:#1d4ed8;border-radius:100px;padding:1px 7px;">en turno</span>' : ''}
      </div>
      <div style="font-size:11px;color:var(--text-muted);font-weight:700;">${u.email}</div>
    </div>
    <span style="background:${rolInfo.color};color:#fff;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:900;flex-shrink:0;">${rolInfo.label}</span>
    ${!esYo ? `
    <select onchange="cambiarRolUsuarioPro('${u.id}',this.value)"
      style="padding:6px 8px;border-radius:8px;border:1px solid var(--border);font-family:Nunito,sans-serif;font-weight:700;font-size:12px;background:#fff;">
      <option value="cajero"     ${u.rol==='cajero'    ?'selected':''}>Cajero</option>
      <option value="supervisor" ${u.rol==='supervisor'?'selected':''}>Supervisor</option>
      <option value="admin"      ${u.rol==='admin'     ?'selected':''}>Admin</option>
    </select>
    <button onclick="desactivarUsuario('${u.id}','${u.nombre||u.email}')"
      style="background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.2);color:var(--red);border-radius:8px;padding:6px 8px;cursor:pointer;font-size:13px;flex-shrink:0;"
      title="Desactivar usuario">🚫</button>` : ''}
  </div>`;
}

async function cambiarRolUsuarioPro(userId, nuevoRol) {
  if (typeof _sbUpsert === 'function') {
    await _sbUpsert('perfiles', { id: userId, rol: nuevoRol }).catch(e => toast('Error: '+e.message, true));
    if (typeof _registrarAccion === 'function') _registrarAccion('cambiar_rol', userId + ' → ' + nuevoRol);
    toast('✅ Rol actualizado a ' + nuevoRol);
  }
}

async function desactivarUsuario(userId, nombre) {
  if (!confirm(`¿Desactivar a ${nombre}? No podrá iniciar sesión.`)) return;
  if (typeof _sbUpsert === 'function') {
    await _sbUpsert('perfiles', { id: userId, activo: false }).catch(e => toast('Error: '+e.message, true));
    if (typeof _registrarAccion === 'function') _registrarAccion('desactivar_usuario', nombre);
    toast('Usuario desactivado');
    setTimeout(abrirGestionUsuariosPro, 300);
  }
}

async function invitarUsuario() {
  const email = document.getElementById('inviteEmail')?.value.trim();
  const rol   = document.getElementById('inviteRol')?.value || 'cajero';
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : '';
  const tiendaNombre = typeof _usuarioActual !== 'undefined' ? (_usuarioActual?.tienda_nombre || tiendaId) : tiendaId;

  if (!email) { toast('Ingresa el correo del usuario', true); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Correo inválido', true); return; }

  // Guardar pre-registro: cuando ese email se registre, se asignará a esta tienda
  if (typeof _sbUpsert === 'function') {
    try {
      await _sbUpsert('sync_invites', {
        id: 'inv_' + email.replace('@','_').replace('.','_') + '_' + tiendaId,
        datos: JSON.stringify({ email, rol, tienda_id: tiendaId, tienda_nombre: tiendaNombre, created_at: new Date().toISOString() }),
        created_at: new Date().toISOString()
      });
      toast(`✅ Cuando ${email} se registre, tendrá rol ${rol} en esta tienda`);
      if (document.getElementById('inviteEmail')) document.getElementById('inviteEmail').value = '';
    } catch(e) {
      toast('Error al guardar invitación: ' + e.message, true);
    }
  } else {
    toast('Sin conexión a Supabase', true);
  }
}

// =====================================================================
//  SECCIÓN 6 — REPORTE PDF MENSUAL
// =====================================================================

function generarReportePDF() {
  if (typeof window.jspdf === 'undefined') {
    toast('⚠️ PDF no disponible, exporta en JSON', true);
    exportarBackupCompleto();
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  const W    = doc.internal.pageSize.getWidth();
  const VERDE = [22, 163, 74];
  const NEGRO = [5, 46, 22];
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'Tienda';
  const fecha    = new Date().toLocaleDateString('es-SV', { year:'numeric', month:'long' });

  const totalMes  = Object.values(ventasMes||{}).reduce((a,p)=>a+(p.total||0),0);
  const gastosMes = (pagos||[]).reduce((a,p)=>a+parseFloat(p.monto||0),0);
  const ganancia  = Object.values(ventasMes||{}).reduce((acc,p)=>{
    const prod = (productos||[]).find(x=>x.nom===p.nom);
    return acc+(prod?(p.total-(parseFloat(prod.compra||0)*p.cant)):0);
  },0);

  // Header
  doc.setFillColor(...VERDE);
  doc.rect(0,0,W,32,'F');
  doc.setFont('helvetica','bold');
  doc.setFontSize(18); doc.setTextColor(255,255,255);
  doc.text('Despensa Económica', 14, 14);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.text('Reporte Mensual · ' + tiendaId, 14, 21);
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text(fecha, W-14, 18, { align:'right' });

  let y = 44;

  // KPIs
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...NEGRO);
  doc.text('Resumen del mes', 14, y); y += 8;
  [
    ['💰 Total vendido', '$' + totalMes.toFixed(2)],
    ['💸 Total gastos',  '$' + gastosMes.toFixed(2)],
    ['✨ Ganancia neta', '$' + ganancia.toFixed(2)],
    ['📊 Margen',        totalMes>0?(ganancia/totalMes*100).toFixed(1)+'%':'0%'],
  ].forEach(([lbl,val]) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(100,116,139);
    doc.text(lbl, 14, y);
    doc.setFont('helvetica','bold'); doc.setTextColor(...NEGRO);
    doc.text(val, W-14, y, { align:'right' });
    y += 7;
  });

  y += 6;
  // Top productos
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...NEGRO);
  doc.text('Top productos del mes', 14, y); y += 7;
  const top = Object.entries(ventasMes||{}).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
  top.forEach(([,p],i) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.setTextColor(71,85,105);
    doc.text(`${i+1}. ${p.nom}`, 16, y);
    doc.setFont('helvetica','bold'); doc.setTextColor(...NEGRO);
    doc.text(`${p.cant} uds · $${(p.total||0).toFixed(2)}`, W-14, y, { align:'right' });
    y += 6;
  });

  doc.save(`Reporte_${tiendaId}_${_hoyStr()}.pdf`);
  _backupMsg('✅ Reporte PDF generado');
}

// =====================================================================
//  SECCIÓN 7 — INICIALIZACIÓN
// =====================================================================

function initDashboardPro() {
  // Inyectar container en pgDash si no existe
  const pgDash = document.getElementById('pgDash');
  if (!pgDash) return;

  let cont = document.getElementById('dashProContainer');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'dashProContainer';
    // Insertar antes del dash-hero o al inicio
    const hero = pgDash.querySelector('.dash-hero');
    if (hero) {
      pgDash.insertBefore(cont, hero.nextSibling);
    } else {
      pgDash.prepend(cont);
    }
  }

  renderDashboardPro();
  _startDashRefresh();

  // Verificar multi-tienda después de login
  if (typeof _sesionActiva !== 'undefined' && _sesionActiva) {
    setTimeout(verificarMultiTienda, 1500);
  }
}

// Esperar a que los datos estén listos
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initDashboardPro, 800));
} else {
  setTimeout(initDashboardPro, 800);
}

// Exponer globalmente
window.renderDashboardPro      = renderDashboardPro;
window.abrirCambioTurno        = abrirCambioTurno;
window.confirmarCambioTurno    = confirmarCambioTurno;
window.cerrarTurno             = cerrarTurno;
window.verificarClaveAdminTurno = verificarClaveAdminTurno;
window.abrirBackupPanel        = abrirBackupPanel;
window.exportarBackupCompleto  = exportarBackupCompleto;
window.exportarSoloProductos   = exportarSoloProductos;
window.exportarSoloVentas      = exportarSoloVentas;
window.restaurarBackupCompleto = restaurarBackupCompleto;
window.generarReportePDF       = generarReportePDF;
window.abrirGestionUsuariosPro = abrirGestionUsuariosPro;
window.cambiarRolUsuarioPro    = cambiarRolUsuarioPro;
window.desactivarUsuario       = desactivarUsuario;
window.invitarUsuario          = invitarUsuario;
window.seleccionarTienda       = seleccionarTienda;
