// =====================================================================
//  💳 GESTIÓN DE MEMBRESÍAS ACTIVAS — Con scroll horizontal y eliminación
//  Solo accesible para el Super Admin (emails exentos)
// =====================================================================

// ── Inyectar estilos del módulo ───────────────────────────────────────
(function _inyectarEstilosMembresias() {
  if (document.getElementById('membAdminStyles')) return;
  const s = document.createElement('style');
  s.id = 'membAdminStyles';
  s.textContent = `
    /* ── Contenedor principal ── */
    #seccionMembresiasActivas {
      margin: 0 0 18px 0;
    }
    .memb-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .memb-section-title {
      font-size: 15px;
      font-weight: 900;
      color: var(--text);
      font-family: Nunito, sans-serif;
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .memb-count-badge {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
      border-radius: 20px;
      padding: 2px 9px;
      font-size: 12px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
    }
    .memb-refresh-btn {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 5px 11px;
      font-size: 12px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      cursor: pointer;
      color: var(--text-muted);
      transition: all 0.15s;
    }
    .memb-refresh-btn:hover { background: var(--border); color: var(--text); }

    /* ── Scroll horizontal ── */
    .memb-scroll-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 6px;
      /* scrollbar delgada */
      scrollbar-width: thin;
      scrollbar-color: #bbf7d0 transparent;
    }
    .memb-scroll-wrap::-webkit-scrollbar { height: 5px; }
    .memb-scroll-wrap::-webkit-scrollbar-track { background: transparent; }
    .memb-scroll-wrap::-webkit-scrollbar-thumb { background: #bbf7d0; border-radius: 10px; }

    /* ── Tabla de membresías ── */
    .memb-table {
      border-collapse: separate;
      border-spacing: 0;
      width: max-content;
      min-width: 100%;
      font-family: Nunito, sans-serif;
    }
    .memb-table thead th {
      background: #f0fdf4;
      color: #15803d;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 9px 14px;
      white-space: nowrap;
      border-bottom: 2px solid #bbf7d0;
      position: sticky;
      top: 0;
    }
    .memb-table thead th:first-child { border-radius: 10px 0 0 0; }
    .memb-table thead th:last-child  { border-radius: 0 10px 0 0; }

    .memb-table tbody tr {
      transition: background 0.15s;
    }
    .memb-table tbody tr:hover { background: #f0fdf4; }
    .memb-table tbody tr:last-child td { border-bottom: none; }

    .memb-table td {
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
      vertical-align: middle;
    }

    /* ── Celdas especiales ── */
    .memb-avatar-cell {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .memb-av {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 900;
      color: #fff;
      flex-shrink: 0;
    }
    .memb-av-name { font-weight: 900; font-size: 13px; color: var(--text); }
    .memb-av-email { font-size: 11px; color: var(--text-muted); font-weight: 700; margin-top: 1px; }

    .memb-plan-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 900;
    }
    .memb-plan-chip.activa {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .memb-plan-chip.vence-pronto {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .memb-plan-chip.definitivo {
      background: #ede9fe;
      color: #7c3aed;
      border: 1px solid #c4b5fd;
    }

    .memb-dias-bar {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 120px;
    }
    .memb-dias-track {
      flex: 1;
      height: 6px;
      background: #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }
    .memb-dias-fill {
      height: 100%;
      border-radius: 10px;
      transition: width 0.3s;
    }
    .memb-dias-label {
      font-size: 11px;
      font-weight: 900;
      color: var(--text-muted);
      white-space: nowrap;
    }

    /* ── Botón eliminar ── */
    .btn-eliminar-memb {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      background: rgba(220, 38, 38, 0.08);
      color: #dc2626;
      border: 1.5px solid rgba(220, 38, 38, 0.22);
      border-radius: 8px;
      font-size: 12px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .btn-eliminar-memb:hover {
      background: rgba(220, 38, 38, 0.15);
      border-color: rgba(220, 38, 38, 0.4);
      transform: translateY(-1px);
    }
    .btn-eliminar-memb:active { transform: translateY(0); }
    .btn-eliminar-memb:disabled { opacity: 0.5; cursor: wait; transform: none; }

    /* ── Modal de confirmación de eliminación ── */
    #modalEliminarMemb {
      position: fixed;
      inset: 0;
      z-index: 10050;
      background: rgba(5, 46, 22, 0.7);
      backdrop-filter: blur(6px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    #modalEliminarMemb.open { display: flex; }
    .eliminar-memb-card {
      background: #fff;
      border-radius: 20px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.4);
      overflow: hidden;
      animation: loginSlideUp 0.3s cubic-bezier(0.22,1,0.36,1);
    }
    .eliminar-memb-header {
      background: linear-gradient(135deg, #7f1d1d, #dc2626);
      padding: 22px 24px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .eliminar-memb-header .icon { font-size: 28px; }
    .eliminar-memb-header h3 {
      color: #fff;
      font-size: 17px;
      font-weight: 900;
      margin: 0;
      font-family: Nunito, sans-serif;
    }
    .eliminar-memb-body { padding: 22px 24px; }
    .eliminar-memb-info {
      background: #fef2f2;
      border: 1.5px solid #fca5a5;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 18px;
    }
    .eliminar-memb-info .ei-nombre {
      font-size: 16px;
      font-weight: 900;
      color: #7f1d1d;
      font-family: Nunito, sans-serif;
      margin-bottom: 4px;
    }
    .eliminar-memb-info .ei-detail {
      font-size: 13px;
      font-weight: 700;
      color: #991b1b;
      font-family: Nunito, sans-serif;
      line-height: 1.7;
    }
    .eliminar-memb-warn {
      font-size: 13px;
      font-weight: 700;
      color: #6b7280;
      font-family: Nunito, sans-serif;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .eliminar-memb-btns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .btn-cancel-elim {
      padding: 13px;
      background: var(--surface2);
      border: 1.5px solid var(--border);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      cursor: pointer;
      color: var(--text);
      transition: all 0.15s;
    }
    .btn-cancel-elim:hover { background: var(--border); }
    .btn-confirm-elim {
      padding: 13px;
      background: linear-gradient(135deg, #dc2626, #991b1b);
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 900;
      font-family: Nunito, sans-serif;
      cursor: pointer;
      color: #fff;
      box-shadow: 0 4px 14px rgba(220,38,38,0.35);
      transition: all 0.15s;
    }
    .btn-confirm-elim:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(220,38,38,0.45); }
    .btn-confirm-elim:disabled { opacity: 0.6; cursor: wait; transform: none; }

    /* ── Empty state ── */
    .memb-empty {
      text-align: center;
      padding: 30px 20px;
      color: var(--text-muted);
    }
    .memb-empty-icon { font-size: 36px; margin-bottom: 10px; }
    .memb-empty-txt { font-size: 14px; font-weight: 900; font-family: Nunito, sans-serif; }

    /* ── Indicador scroll ── */
    .memb-scroll-hint {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 700;
      font-family: Nunito, sans-serif;
      text-align: right;
      margin-bottom: 6px;
      display: none;
    }
    .memb-scroll-hint.show { display: block; }
  `;
  document.head.appendChild(s);
})();

// ── Estado del módulo ─────────────────────────────────────────────────
let _membActivas = [];
let _membEliminarTarget = null; // { memId, userId, nombre, email, plan }

// ── Función principal: renderizar sección de membresías activas ───────
async function renderMembresíasActivas(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Solo super admin
  if (typeof _esSuperAdmin === 'function' && !_esSuperAdmin()) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div id="seccionMembresiasActivas">
      <div class="memb-section-header">
        <div class="memb-section-title">
          💳 Membresías Activas
          <span class="memb-count-badge" id="membActivasCount">—</span>
        </div>
        <button class="memb-refresh-btn" onclick="renderMembresíasActivas('${containerId}')">
          🔄 Actualizar
        </button>
        <button class="memb-refresh-btn" style="background:#fef2f2;color:#dc2626;border-color:#fca5a5;" onclick="_limpiarMembresiasInactivas()">
          🗑 Limpiar inactivas + backup JSON
        </button>
      </div>
      <div class="memb-scroll-hint" id="membScrollHint">← desliza para ver más →</div>
      <div class="memb-scroll-wrap">
        <div id="membTablaWrap">
          <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;font-weight:700;">
            ⏳ Cargando membresías…
          </div>
        </div>
      </div>
    </div>
  `;

  await _cargarYRenderTablaMemb();
}

// Eliminar membresías inactivas y descargar backup JSON
async function _limpiarMembresiasInactivas() {
  if (!confirm('¿Limpiar TODAS las membresías inactivas?\n\nPrimero se descargará un backup JSON con los datos. Luego se borrarán de Supabase.')) return;

  try {
    if (typeof toast === 'function') toast('⏳ Generando backup…');

    // 1. Obtener TODAS las membresías (activas e inactivas)
    const todasMemb = await _sbGet('membresias', { select: '*', order: 'created_at.desc', limit: 1000 }).catch(() => []);
    const inactivas = (todasMemb || []).filter(m => !m.activa);

    if (!inactivas.length) {
      if (typeof toast === 'function') toast('No hay membresías inactivas para limpiar');
      return;
    }

    // 2. Descargar backup JSON
    const backup = {
      fecha_backup: new Date().toISOString(),
      tienda_id: typeof _getTiendaId === 'function' ? _getTiendaId() : '—',
      total_inactivas: inactivas.length,
      membresias_inactivas: inactivas
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `backup_membresias_inactivas_${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 3. Borrar inactivas de Supabase una por una
    let borradas = 0;
    for (const m of inactivas) {
      try {
        await _sbDeleteFiltro('membresias', { id: 'eq.' + m.id });
        borradas++;
      } catch(e) { console.warn('[limpiar memb]', e); }
    }

    if (typeof toast === 'function') toast(`✅ Backup descargado + ${borradas} membresías inactivas eliminadas`);
    if (typeof _registrarAccion === 'function') _registrarAccion('limpiar_inactivas', `${borradas} membresías inactivas eliminadas`);

    // Re-renderizar
    const containerId = document.getElementById('seccionMembresiasActivas')?.closest('[id]')?.id || 'membActivasContainer';
    await _cargarYRenderTablaMemb();

  } catch(e) {
    if (typeof toast === 'function') toast('❌ Error: ' + e.message, true);
    console.error('[limpiarInactivas]', e);
  }
}

async function _cargarYRenderTablaMemb() {
  const wrap = document.getElementById('membTablaWrap');
  if (!wrap) return;

  try {
    const rows = await _sbGet('membresias', {
      select: '*',
      activa: 'eq.true',
      order: 'fecha_inicio.desc'
    }).catch(() => []);

    _membActivas = rows || [];

    const badge = document.getElementById('membActivasCount');
    if (badge) badge.textContent = _membActivas.length;

    // Mostrar hint de scroll si hay datos
    const hint = document.getElementById('membScrollHint');
    if (hint && _membActivas.length > 0) hint.classList.add('show');

    if (!_membActivas.length) {
      wrap.innerHTML = `
        <div class="memb-empty">
          <div class="memb-empty-icon">✅</div>
          <div class="memb-empty-txt">No hay membresías activas actualmente</div>
        </div>`;
      return;
    }

    const ahora = new Date();

    const filas = _membActivas.map(m => {
      const plan = (typeof _PLANES_MEMBRESIA !== 'undefined'
        ? _PLANES_MEMBRESIA.find(p => p.id === m.tipo)
        : null) || { label: m.tipo, icono: '📋', dias: null };

      const inicio = m.fecha_inicio ? new Date(m.fecha_inicio) : null;
      const vence  = m.fecha_vencimiento ? new Date(m.fecha_vencimiento) : null;
      const nombre = m.nombre || '—';
      const email  = m.email  || '—';
      const inicial = nombre.charAt(0).toUpperCase();

      // Color del avatar
      const avatarColors = [
        'linear-gradient(135deg,#059669,#065f46)',
        'linear-gradient(135deg,#1d4ed8,#1e40af)',
        'linear-gradient(135deg,#7c3aed,#6d28d9)',
        'linear-gradient(135deg,#ea580c,#c2410c)',
        'linear-gradient(135deg,#0369a1,#075985)',
      ];
      const avatarColor = avatarColors[nombre.charCodeAt(0) % avatarColors.length];

      // Días restantes
      let diasRestantesHTML = '';
      let chipClass = 'activa';
      if (!vence) {
        diasRestantesHTML = '<span style="color:#7c3aed;font-weight:900;font-size:12px;">♾️ Sin vencimiento</span>';
        chipClass = 'definitivo';
      } else {
        const diffMs = vence - ahora;
        const dias   = Math.max(0, Math.ceil(diffMs / 86400000));
        const total  = plan.dias || 30;
        const pct    = Math.max(0, Math.min(100, (dias / total) * 100));
        const fillColor = pct > 40 ? '#16a34a' : pct > 15 ? '#d97706' : '#dc2626';
        if (dias <= 5) chipClass = 'vence-pronto';
        diasRestantesHTML = `
          <div class="memb-dias-bar">
            <div class="memb-dias-track">
              <div class="memb-dias-fill" style="width:${pct}%;background:${fillColor};"></div>
            </div>
            <span class="memb-dias-label" style="color:${fillColor};">${dias}d</span>
          </div>`;
      }

      const fechaInicioStr = inicio
        ? inicio.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';
      const fechaVenceStr = vence
        ? vence.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '♾️';

      const metodo = m.pago === 'efectivo_confirmado' ? '💵 Efectivo'
        : m.pago === 'tarjeta_confirmado' ? '💳 Tarjeta'
        : m.pago || '—';

      return `
        <tr>
          <td>
            <div class="memb-avatar-cell">
              <div class="memb-av" style="background:${avatarColor};">${inicial}</div>
              <div>
                <div class="memb-av-name">${nombre}</div>
                <div class="memb-av-email">${email}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="memb-plan-chip ${chipClass}">
              ${plan.icono} ${plan.label}
            </span>
          </td>
          <td style="font-size:13px;font-weight:900;color:var(--green-dark);">
            $${Number(m.monto || 0).toFixed(2)}
          </td>
          <td>${metodo}</td>
          <td style="color:var(--text-muted);font-size:12px;">${fechaInicioStr}</td>
          <td style="color:var(--text-muted);font-size:12px;">${fechaVenceStr}</td>
          <td>${diasRestantesHTML}</td>
          <td>
            <button class="btn-eliminar-memb"
              onclick="_confirmarEliminarMemb('${m.id}','${m.user_id || ''}','${nombre.replace(/'/g,"\\'")}','${email.replace(/'/g,"\\'")}','${plan.label}','$${Number(m.monto||0).toFixed(2)} · ${plan.icono} ${plan.label}')">
              🗑 Eliminar
            </button>
          </td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <table class="memb-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Plan</th>
            <th>Monto</th>
            <th>Método pago</th>
            <th>Inicio</th>
            <th>Vence</th>
            <th>Tiempo restante</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>`;

  } catch (e) {
    if (wrap) wrap.innerHTML = `<div style="color:var(--red);padding:16px;font-size:13px;font-weight:700;">Error: ${e.message}</div>`;
  }
}

// ── Abrir modal de confirmación ───────────────────────────────────────
function _confirmarEliminarMemb(memId, userId, nombre, email, planLabel, resumen) {
  _membEliminarTarget = { memId, userId, nombre, email, planLabel };

  // Crear modal si no existe
  if (!document.getElementById('modalEliminarMemb')) {
    _crearModalEliminarMemb();
  }

  // Rellenar datos
  document.getElementById('elimMembNombre').textContent = nombre;
  document.getElementById('elimMembDetalle').innerHTML =
    `📧 ${email}<br>` +
    `💳 ${resumen}`;

  document.getElementById('modalEliminarMemb').classList.add('open');
}

function _crearModalEliminarMemb() {
  const modal = document.createElement('div');
  modal.id = 'modalEliminarMemb';
  modal.innerHTML = `
    <div class="eliminar-memb-card">
      <div class="eliminar-memb-header">
        <span class="icon">⚠️</span>
        <h3>Eliminar Membresía Activa</h3>
      </div>
      <div class="eliminar-memb-body">
        <div class="eliminar-memb-info">
          <div class="ei-nombre" id="elimMembNombre">—</div>
          <div class="ei-detail" id="elimMembDetalle">—</div>
        </div>
        <div class="eliminar-memb-warn">
          Al eliminar esta membresía el usuario <strong>perderá el acceso inmediatamente</strong>
          y no podrá iniciar sesión hasta obtener una nueva membresía. Esta acción no se puede deshacer.
        </div>
        <div class="eliminar-memb-btns">
          <button class="btn-cancel-elim" onclick="_cancelarEliminarMemb()">✕ Cancelar</button>
          <button class="btn-confirm-elim" id="btnConfirmElimMemb" onclick="_ejecutarEliminarMemb()">
            🗑 Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Cerrar al hacer clic fuera
  modal.addEventListener('click', e => {
    if (e.target === modal) _cancelarEliminarMemb();
  });
}

function _cancelarEliminarMemb() {
  const modal = document.getElementById('modalEliminarMemb');
  if (modal) modal.classList.remove('open');
  _membEliminarTarget = null;
}

async function _ejecutarEliminarMemb() {
  if (!_membEliminarTarget) return;
  const { memId, userId, nombre, email } = _membEliminarTarget;

  const btn = document.getElementById('btnConfirmElimMemb');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Eliminando…'; }

  try {
    // 1. Eliminar membresía completamente de la base de datos
    if (typeof _sbDeleteFiltro === 'function') {
      await _sbDeleteFiltro('membresias', { id: 'eq.' + memId });
    }

    // 2. Registrar acción
    if (typeof _registrarAccion === 'function') {
      _registrarAccion('eliminar_membresia', `${nombre} (${email}) — membresía eliminada permanentemente`);
    }

    if (typeof toast === 'function') {
      toast(`✅ Membresía de ${nombre} eliminada. Si quiere volver, debe registrarse de nuevo.`);
    }

    // Cerrar modal
    _cancelarEliminarMemb();

    // Re-renderizar tabla
    await _cargarYRenderTablaMemb();

    // Actualizar stats del panel si existe
    if (typeof adminCargarStats === 'function') adminCargarStats();

  } catch (e) {
    if (typeof toast === 'function') toast('❌ Error al eliminar: ' + e.message, true);
    console.error('[eliminarMemb]', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑 Sí, eliminar'; }
  }
}

// ── Exponer globalmente ───────────────────────────────────────────────
window.renderMembresíasActivas  = renderMembresíasActivas;
window._confirmarEliminarMemb   = _confirmarEliminarMemb;
window._cancelarEliminarMemb    = _cancelarEliminarMemb;
window._ejecutarEliminarMemb    = _ejecutarEliminarMemb;
window._limpiarMembresiasInactivas = _limpiarMembresiasInactivas;
