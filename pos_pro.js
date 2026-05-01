// =====================================================================
//  DESPENSA ECONÓMICA — POS PRO v1
//  ✅ Pantalla de caja tipo supermercado real
//  ✅ Atajos de teclado completos (Enter, Esc, F1-F4, /, flechas)
//  ✅ Escaneo de código de barras ultra-rápido
//  ✅ Ticket imprimible (80mm + A4)
//  ✅ Corte de caja mejorado
//  ✅ Reportes: ventas día, ganancias, top productos
//  ✅ Roles admin/cajero con restricciones visuales
// =====================================================================

// ── Atajos de teclado globales ────────────────────────────────────────
(function initKeyboardPOS() {
  let _scanBuffer = '';
  let _scanTimer  = null;
  const SCAN_TIMEOUT = 120; // ms entre chars de scanner (más rápido que humano)

  document.addEventListener('keydown', (e) => {
    const tag  = (document.activeElement?.tagName || '').toLowerCase();
    const enInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    // ── Atajos globales (siempre activos) ──
    if (e.key === 'Escape') {
      // Cerrar modal abierto
      const abierto = document.querySelector('.modal.open, .modal[style*="flex"]');
      if (abierto) {
        const btnClose = abierto.querySelector('.btn-close');
        if (btnClose) btnClose.click();
        e.preventDefault(); return;
      }
    }

    if (e.key === 'F1') { e.preventDefault(); navTo('pgDash'); return; }
    if (e.key === 'F2') { e.preventDefault(); navTo('pgInventario'); return; }
    if (e.key === 'F3') { e.preventDefault(); navTo('pgReportes'); return; }
    if (e.key === 'F4') { e.preventDefault(); abrirCorteCaja(); return; }

    // ── Foco rápido en búsqueda: "/" o cualquier letra/número sin input activo ──
    if (!enInput) {
      if (e.key === '/' || e.key === 'F6') {
        e.preventDefault();
        const busq = document.getElementById('busquedaVenta') || document.getElementById('busquedaInv');
        if (busq) { busq.focus(); busq.select(); }
        return;
      }
      // Tecla numérica/letra → redirigir al input de búsqueda de venta
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        const busq = document.getElementById('busquedaVenta');
        if (busq && document.getElementById('pgDash')?.classList.contains('active')) {
          busq.focus();
          // No preventDefault para que el char llegue al input
        }
      }
    }

    // ── Cobro rápido: Enter en pantalla de venta ──
    if (e.key === 'Enter' && !e.shiftKey) {
      const modalCobro = document.getElementById('modalCobro');
      if (modalCobro?.classList.contains('open') || modalCobro?.style.display === 'flex') {
        e.preventDefault();
        const btnFinalizar = document.getElementById('btnFinalizarVenta') || 
                             modalCobro.querySelector('button[onclick*="finalizar"]');
        if (btnFinalizar && !btnFinalizar.disabled) btnFinalizar.click();
        return;
      }
      if (document.getElementById('pgDash')?.classList.contains('active') && !enInput) {
        e.preventDefault();
        const btnCobrar = document.querySelector('[onclick*="cobrar"], [onclick*="abrirCobro"]');
        if (btnCobrar && !btnCobrar.disabled) btnCobrar.click();
        return;
      }
    }

    // ── Teclado numérico en modal de cobro ──
    if (document.getElementById('modalCobro')?.classList.contains('open')) {
      if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
        // Solo si no hay input activo
        if (!enInput) {
          e.preventDefault();
          posProAgregarDigito(e.key);
          return;
        }
      }
      if (e.key === 'Backspace' && !enInput) {
        e.preventDefault(); posProBorrarDigito(); return;
      }
    }

    // ── Scanner de código de barras ──
    // Los scanners envían chars muy rápido y terminan con Enter
    if (!enInput || document.activeElement?.id === 'busquedaVenta') {
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        _scanBuffer += e.key;
        clearTimeout(_scanTimer);
        _scanTimer = setTimeout(() => { _scanBuffer = ''; }, SCAN_TIMEOUT);
      }
      if (e.key === 'Enter' && _scanBuffer.length >= 3) {
        const cod = _scanBuffer.trim();
        _scanBuffer = '';
        clearTimeout(_scanTimer);
        if (cod.length >= 3) {
          e.preventDefault();
          posProEscanearCodigo(cod);
        }
      }
    }
  });
})();

// ── Agregar dígito en cobro (para teclado físico y pantalla) ──────────
function posProAgregarDigito(d) {
  if (typeof cobroDigits === 'undefined') return;
  if (d === '.' && cobroDigits.includes('.')) return;
  if (d === '.' && cobroDigits === '') { window.cobroDigits = '0.'; }
  else { window.cobroDigits = (window.cobroDigits || '') + d; }
  actualizarDisplayCobro();
}

function posProBorrarDigito() {
  if (typeof cobroDigits === 'undefined') return;
  window.cobroDigits = (window.cobroDigits || '').slice(0, -1);
  actualizarDisplayCobro();
}

function actualizarDisplayCobro() {
  const el = document.getElementById('cobroInput') || document.getElementById('cobroEfectivo');
  if (el) el.value = window.cobroDigits || '';
  // Actualizar vuelto
  const totalEl = document.getElementById('cobroMonto');
  const total   = parseFloat(totalEl?.textContent?.replace(/[$,]/g, '') || '0');
  const pago    = parseFloat(window.cobroDigits || '0');
  const vueltoEl = document.getElementById('cobroVuelto') || document.querySelector('.cobro-vuelto');
  if (vueltoEl) vueltoEl.textContent = '$' + Math.max(0, pago - total).toFixed(2);
}

// ── Escanear código de barras ─────────────────────────────────────────
function posProEscanearCodigo(cod) {
  if (typeof productos === 'undefined') return;
  const codLower = cod.toLowerCase().trim();
  // Buscar por campo cod (código de barras) o por abreviación
  const prod = productos.find(p =>
    (p.cod && p.cod.toLowerCase() === codLower) ||
    (p.abrev && p.abrev.toLowerCase() === codLower) ||
    String(p.id) === codLower
  );
  if (prod) {
    if (prod.stock <= 0) {
      toast(`⚠ Sin stock: ${prod.nom}`, true);
      posProFlashRed();
      return;
    }
    // Agregar al carrito
    if (typeof agregarAlCarrito === 'function') agregarAlCarrito(prod.id);
    else if (typeof _agregarAlCarritoConPaquete === 'function') _agregarAlCarritoConPaquete(prod.id);
    toast(`✓ ${prod.nom} agregado`);
    posProFlashGreen();
    // Limpiar campo de búsqueda
    const busq = document.getElementById('busquedaVenta');
    if (busq) { busq.value = ''; busq.dispatchEvent(new Event('input')); }
  } else {
    toast(`⚠ Código no encontrado: ${cod}`, true);
    posProFlashRed();
  }
}

// ── Flash visual de feedback en escaneo ──────────────────────────────
function posProFlashGreen() {
  const el = document.getElementById('cajaPanelDash') || document.querySelector('.caja-panel');
  if (!el) return;
  el.style.transition = 'box-shadow 0.1s';
  el.style.boxShadow = '0 0 0 4px #16a34a';
  setTimeout(() => { el.style.boxShadow = ''; }, 300);
}
function posProFlashRed() {
  const el = document.getElementById('cajaPanelDash') || document.querySelector('.caja-panel');
  if (!el) return;
  el.style.transition = 'box-shadow 0.1s';
  el.style.boxShadow = '0 0 0 4px #dc2626';
  setTimeout(() => { el.style.boxShadow = ''; }, 400);
}

// =====================================================================
//  TICKET IMPRIMIBLE (80mm térmico + A4)
// =====================================================================

/**
 * Imprime ticket de 80mm para impresora térmica
 * Llámalo después de finalizar la venta pasando el objeto venta
 */
function imprimirTicket80mm(venta, opciones = {}) {
  const tiendaNombre = opciones.tiendaNombre || _getNombreTienda() || 'Mi Tienda';
  const tiendaTel    = opciones.telefono    || '';
  const tiendaDirec  = opciones.direccion   || '';
  const cajero       = opciones.cajero      || (typeof _usuarioActual !== 'undefined' ? (_usuarioActual?.nombre || _usuarioActual?.email || '') : '');
  const num          = opciones.num         || (typeof facturaNum !== 'undefined' ? facturaNum : '');

  const items = venta.items || [];
  let filas = items.map(it =>
    `<tr>
      <td class="td-nom">${it.nom}${it.paqueteLabel ? `<br><small>${it.paqueteLabel}</small>` : ''}</td>
      <td class="td-cant">${it.cant}</td>
      <td class="td-precio">$${Number(it.precio).toFixed(2)}</td>
      <td class="td-sub">$${(Number(it.precio) * Number(it.cant)).toFixed(2)}</td>
    </tr>`
  ).join('');

  const fecha = venta.fechaStr || new Date(venta.fechaISO || Date.now()).toLocaleString('es-SV');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ticket #${num}</title>
<style>
  @page { size: 80mm auto; margin: 2mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    color: #000;
    width: 74mm;
  }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .big    { font-size: 15px; font-weight: bold; }
  .med    { font-size: 13px; font-weight: bold; }
  .divider { border: none; border-top: 1px dashed #000; margin: 5px 0; }
  .divider-solid { border: none; border-top: 2px solid #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #000; padding: 2px 1px; }
  .td-nom    { width: 44%; padding: 2px 1px; word-break: break-word; }
  .td-cant   { width: 10%; text-align: center; padding: 2px 1px; }
  .td-precio { width: 20%; text-align: right; padding: 2px 1px; }
  .td-sub    { width: 22%; text-align: right; padding: 2px 1px; font-weight: bold; }
  .totales td { padding: 3px 1px; }
  .totales .lbl { font-weight: bold; }
  .totales .val { text-align: right; font-weight: bold; }
  .total-final { font-size: 16px; font-weight: bold; }
  .vuelto-row  { font-size: 13px; font-weight: bold; }
  .pie { font-size: 9px; text-align: center; margin-top: 8px; color: #444; }
  .barcode-area { text-align: center; margin: 6px 0 2px; letter-spacing: 3px; font-size: 9px; }
  @media print {
    body { width: 74mm; }
    button { display: none !important; }
  }
</style>
</head>
<body>
<div class="center bold big">${tiendaNombre}</div>
${tiendaDirec ? `<div class="center" style="font-size:9px">${tiendaDirec}</div>` : ''}
${tiendaTel   ? `<div class="center" style="font-size:9px">Tel: ${tiendaTel}</div>` : ''}
<hr class="divider-solid">
<div class="center bold med">TICKET #${num}</div>
<div class="center" style="font-size:9px">${fecha}</div>
${cajero ? `<div class="center" style="font-size:9px">Cajero: ${cajero}</div>` : ''}
<hr class="divider">

<table>
  <thead>
    <tr>
      <th style="text-align:left">Artículo</th>
      <th style="text-align:center">Cant</th>
      <th style="text-align:right">Precio</th>
      <th style="text-align:right">Subtotal</th>
    </tr>
  </thead>
  <tbody>${filas}</tbody>
</table>

<hr class="divider-solid">
<table class="totales">
  <tr>
    <td class="lbl">TOTAL</td>
    <td class="val total-final">$${Number(venta.total).toFixed(2)}</td>
  </tr>
  <tr>
    <td class="lbl">Efectivo</td>
    <td class="val">$${Number(venta.pago).toFixed(2)}</td>
  </tr>
  <tr class="vuelto-row">
    <td class="lbl">Vuelto</td>
    <td class="val">$${Number(venta.vuelto || 0).toFixed(2)}</td>
  </tr>
</table>

<hr class="divider">
<div class="barcode-area">|||  ${venta.id ? venta.id.slice(-8).toUpperCase() : ''}  |||</div>
<div class="pie">¡Gracias por su compra!</div>
<div class="pie">Conserve su ticket</div>
<br><br><br>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=380,height=600,scrollbars=yes');
  if (!win) { toast('⚠ Permite las ventanas emergentes para imprimir', true); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    // Cerrar automáticamente después de imprimir (en algunos navegadores)
    win.onafterprint = () => win.close();
  }, 400);
}

/**
 * Helper: obtener nombre de tienda del estado actual
 */
function _getNombreTienda() {
  if (typeof _usuarioActual !== 'undefined' && _usuarioActual?.tienda_nombre) return _usuarioActual.tienda_nombre;
  if (typeof _tiendaId !== 'undefined' && _tiendaId) return _tiendaId;
  return '';
}

// ── Hook: imprimir ticket automáticamente al finalizar venta ─────────
// Se llama desde finalizarVenta() en app.js — agrega este hook al final
function _hookTicketAlVender(venta) {
  // Verificar si el usuario quiere impresión automática
  const autoImprime = localStorage.getItem('vpos_autoImprimir') === '1';
  if (autoImprime) {
    const tiendaNombre = localStorage.getItem('vpos_tiendaNombre') || '';
    const telefono     = localStorage.getItem('vpos_tiendaTel')    || '';
    const direccion    = localStorage.getItem('vpos_tiendaDirec')  || '';
    imprimirTicket80mm(venta, { tiendaNombre, telefono, direccion });
  }
}

// =====================================================================
//  CORTE DE CAJA MEJORADO
// =====================================================================

function abrirCorteCaja() {
  // Solo admin puede hacer corte de caja
  if (typeof _puedeHacer === 'function' && !_puedeHacer('reportes')) {
    toast('⛔ Solo el administrador puede ver el corte de caja', true);
    return;
  }
  const modal = document.getElementById('modalCorteCaja');
  if (modal) { renderCorteCaja(); modal.classList.add('open'); return; }
  _crearModalCorteCaja();
}

function _crearModalCorteCaja() {
  const div = document.createElement('div');
  div.id = 'modalCorteCaja';
  div.className = 'modal';
  div.setAttribute('role', 'dialog');
  div.innerHTML = `
  <div class="modal-box modal-lg" style="max-width:620px;">
    <div class="modal-header" style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);">
      <h3 style="color:#fff;">🏧 Corte de Caja</h3>
      <button class="btn-close" onclick="cerrarModal('modalCorteCaja')" style="color:#fff;">✕</button>
    </div>
    <div class="modal-body" style="padding:0;">
      <div id="corteCajaContenido" style="padding:20px;"></div>
      <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn" style="background:var(--green);color:#fff;flex:1;" onclick="imprimirCorteCaja()">🖨️ Imprimir Corte</button>
        <button class="btn" style="background:var(--blue);color:#fff;flex:1;" onclick="exportarCortePDF()">📥 Descargar PDF</button>
        <button class="btn btn-ghost" onclick="cerrarModal('modalCorteCaja')" style="flex:0 0 auto;">Cerrar</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div);
  renderCorteCaja();
  div.classList.add('open');
}

function renderCorteCaja() {
  const cont = document.getElementById('corteCajaContenido');
  if (!cont) return;

  const hoy = new Date();
  const fechaStr = hoy.toLocaleDateString('es-SV', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // ── FIX: respetar timestamp del reset manual del día ──
  const _resetTsPos = (() => {
    const ts = localStorage.getItem('vpos_reinicioDiaTs');
    const fd = localStorage.getItem('vpos_reinicioDiaFecha');
    if (!ts || !fd || fd !== hoy.toDateString()) return null;
    return new Date(ts);
  })();

  // Calcular datos desde historial
  const ventasHoy   = (typeof historial !== 'undefined' ? historial : []).filter(v => {
    const d = new Date(v.fechaISO || v.ts || 0);
    if (d.toDateString() !== hoy.toDateString()) return false;
    if (_resetTsPos && d < _resetTsPos) return false; // ignorar ventas antes del reset
    return true;
  });

  const totalVentas     = ventasHoy.reduce((a, v) => a + parseFloat(v.total || 0), 0);
  const totalTransacc   = ventasHoy.length;
  const promedioVenta   = totalTransacc > 0 ? totalVentas / totalTransacc : 0;

  // Gastos del día
  const pagosHoy = (typeof pagos !== 'undefined' ? pagos : []).filter(p => {
    const d = new Date(p.fecha_iso || p.fechaISO || p.ts || 0);
    return d.toDateString() === hoy.toDateString();
  });
  const totalGastos = pagosHoy.reduce((a, p) => a + parseFloat(p.monto || 0), 0);

  // Efectivo inicial
  const efectInicial = typeof efectivoInicial !== 'undefined' ? efectivoInicial : 0;
  const efectivoEsperado = efectInicial + totalVentas - totalGastos;

  // Top productos del día
  const conteoProds = {};
  ventasHoy.forEach(v => {
    (v.items || []).forEach(it => {
      if (!conteoProds[it.nom]) conteoProds[it.nom] = { cant: 0, total: 0 };
      conteoProds[it.nom].cant  += Number(it.cant || 1);
      conteoProds[it.nom].total += Number(it.precio || 0) * Number(it.cant || 1);
    });
  });
  const topProds = Object.entries(conteoProds)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  // Ganancias estimadas
  const gananciaEstimada = ventasHoy.reduce((acc, v) => {
    return acc + (v.items || []).reduce((a, it) => {
      const prod = (typeof productos !== 'undefined' ? productos : []).find(p => p.nom === it.nom);
      const compra = prod ? parseFloat(prod.compra || 0) : 0;
      return a + (parseFloat(it.precio) - compra) * Number(it.cant || 1);
    }, 0);
  }, 0);

  cont.innerHTML = `
    <!-- Encabezado -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:13px;color:var(--text-muted);font-weight:700;">${fechaStr}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
        Cajero: ${typeof _usuarioActual !== 'undefined' ? (_usuarioActual?.nombre || _usuarioActual?.email || '—') : '—'}
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px;">
      ${_kpiCard('💰', 'Ventas del día', '$' + totalVentas.toFixed(2), '#16a34a')}
      ${_kpiCard('🏷️', 'Transacciones', totalTransacc, '#1d4ed8')}
      ${_kpiCard('📈', 'Promedio venta', '$' + promedioVenta.toFixed(2), '#7c3aed')}
      ${_kpiCard('📉', 'Gastos', '$' + totalGastos.toFixed(2), '#dc2626')}
      ${_kpiCard('💵', 'Efectivo esperado', '$' + efectivoEsperado.toFixed(2), '#d97706')}
      ${_kpiCard('✨', 'Ganancia estimada', '$' + gananciaEstimada.toFixed(2), '#059669')}
    </div>

    <!-- Top productos -->
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:900;font-size:14px;display:flex;align-items:center;gap:8px;">
        🏆 <span>Top productos del día</span>
      </div>
      <div style="padding:10px 16px;">
        ${topProds.length === 0
          ? '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">Sin ventas registradas hoy</div>'
          : topProds.map(([nom, d], i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;${i < topProds.length-1 ? 'border-bottom:1px solid var(--border);' : ''}">
            <div style="width:22px;height:22px;border-radius:50%;background:${i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#cd7c00':'var(--green-light)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:${i<3?'#fff':'var(--green)'};">${i+1}</div>
            <div style="flex:1;font-weight:800;font-size:13px;">${nom}</div>
            <div style="font-size:12px;color:var(--text-muted);font-weight:700;">${d.cant} uds</div>
            <div style="font-weight:900;font-size:13px;color:var(--green);">$${d.total.toFixed(2)}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Resumen de gastos -->
    ${pagosHoy.length > 0 ? `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:900;font-size:14px;">📉 Gastos del día</div>
      <div style="padding:10px 16px;">
        ${pagosHoy.slice(0,6).map((p, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:5px 0;${i<pagosHoy.length-1?'border-bottom:1px solid var(--border);':''}">
          <div style="flex:1;font-size:13px;font-weight:800;">${p.nom || p.cat || 'Gasto'}</div>
          <div style="font-size:11px;color:var(--text-muted);">${p.cat || ''}</div>
          <div style="font-weight:900;color:var(--red);">-$${parseFloat(p.monto||0).toFixed(2)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Input conteo físico -->
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-weight:900;font-size:14px;margin-bottom:10px;">💵 Conteo físico de caja</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;">
          <label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px;">Efectivo contado:</label>
          <input type="number" id="corteConteoFisico" placeholder="0.00" step="0.01" min="0"
            style="width:100%;padding:10px 12px;border:2px solid #ffc107;border-radius:8px;font-size:15px;font-weight:900;font-family:Space Mono,monospace;"
            oninput="corteActualizarDiferencia(${efectivoEsperado})">
        </div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:4px;">Diferencia</div>
          <div id="corteDiferencia" style="font-size:22px;font-weight:900;font-family:Space Mono,monospace;">—</div>
        </div>
      </div>
    </div>

    <!-- Nota -->
    <div style="margin-bottom:8px;">
      <label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px;">Nota de cierre:</label>
      <textarea id="corteNota" placeholder="Observaciones del día..." rows="2"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border-mid);border-radius:8px;font-family:Nunito,sans-serif;font-size:13px;font-weight:700;resize:vertical;"></textarea>
    </div>
  `;
}

function _kpiCard(icon, label, value, color) {
  return `<div style="background:${color}12;border:1.5px solid ${color}33;border-radius:12px;padding:14px;text-align:center;">
    <div style="font-size:22px;margin-bottom:4px;">${icon}</div>
    <div style="font-size:18px;font-weight:900;color:${color};font-family:'Space Mono',monospace;">${value}</div>
    <div style="font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">${label}</div>
  </div>`;
}

function corteActualizarDiferencia(esperado) {
  const contado = parseFloat(document.getElementById('corteConteoFisico')?.value || '0');
  const diff = contado - esperado;
  const el = document.getElementById('corteDiferencia');
  if (!el) return;
  el.textContent = (diff >= 0 ? '+' : '') + '$' + diff.toFixed(2);
  el.style.color = diff === 0 ? '#16a34a' : diff > 0 ? '#1d4ed8' : '#dc2626';
}

function imprimirCorteCaja() {
  const hoy = new Date();
  const tiendaNombre = _getNombreTienda() || 'Mi Tienda';
  const contado = document.getElementById('corteConteoFisico')?.value || '';
  const nota    = document.getElementById('corteNota')?.value || '';

  const contenidoHTML = document.getElementById('corteCajaContenido')?.innerHTML || '';

  const win = window.open('', '_blank', 'width=500,height=700');
  if (!win) { toast('⚠ Permite ventanas emergentes para imprimir', true); return; }
  win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Corte de Caja — ${tiendaNombre}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
  h1   { font-size: 20px; color: #1e3a5f; margin-bottom: 4px; }
  .sub { font-size: 12px; color: #555; margin-bottom: 20px; }
  button { display: none !important; }
  textarea, input { display: none !important; }
  label { display: none !important; }
  .extra-info { margin-top: 20px; font-size: 12px; border-top: 1px solid #ccc; padding-top: 12px; }
</style>
</head><body>
<h1>🏧 Corte de Caja — ${tiendaNombre}</h1>
<div class="sub">${hoy.toLocaleString('es-SV')}</div>
${contenidoHTML}
<div class="extra-info">
  ${contado ? `<p><strong>Efectivo contado:</strong> $${parseFloat(contado).toFixed(2)}</p>` : ''}
  ${nota    ? `<p><strong>Nota:</strong> ${nota}</p>` : ''}
  <p style="margin-top:20px;color:#888;font-size:10px;">Corte generado por Sistema Despensa Económica</p>
</div>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 500);
}

function exportarCortePDF() {
  if (typeof window.jspdf === 'undefined') {
    toast('⚠ jsPDF no disponible, usa el botón Imprimir', true);
    imprimirCorteCaja();
    return;
  }
  imprimirCorteCaja(); // fallback mientras tanto
}

// =====================================================================
//  PANEL DE REPORTES PRO
// =====================================================================

function abrirReportesDia() {
  if (typeof _puedeHacer === 'function' && !_puedeHacer('reportes')) {
    toast('⛔ Sin permisos para ver reportes', true); return;
  }
  const modal = document.getElementById('modalReportesPro');
  if (modal) { renderReportesPro(); modal.classList.add('open'); return; }
  _crearModalReportesPro();
}

function _crearModalReportesPro() {
  const div = document.createElement('div');
  div.id = 'modalReportesPro';
  div.className = 'modal';
  div.setAttribute('role', 'dialog');
  div.innerHTML = `
  <div class="modal-box modal-lg" style="max-width:700px;">
    <div class="modal-header" style="background:linear-gradient(135deg,#059669,#047857);">
      <h3 style="color:#fff;">📊 Reportes del Día</h3>
      <button class="btn-close" onclick="cerrarModal('modalReportesPro')" style="color:#fff;">✕</button>
    </div>
    <div class="modal-body" style="padding:0;">
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border);">
        <button class="rep-tab active" onclick="cambiarTabReporte('dia',this)" style="flex:1;padding:10px;border:none;background:var(--green);color:#fff;font-weight:900;font-size:13px;cursor:pointer;">📅 Hoy</button>
        <button class="rep-tab" onclick="cambiarTabReporte('semana',this)" style="flex:1;padding:10px;border:none;background:var(--surface2);font-weight:900;font-size:13px;cursor:pointer;">📆 Semana</button>
        <button class="rep-tab" onclick="cambiarTabReporte('mes',this)" style="flex:1;padding:10px;border:none;background:var(--surface2);font-weight:900;font-size:13px;cursor:pointer;">🗓️ Mes</button>
        <button class="rep-tab" onclick="cambiarTabReporte('ganancias',this)" style="flex:1;padding:10px;border:none;background:var(--surface2);font-weight:900;font-size:13px;cursor:pointer;">💰 Ganancias</button>
      </div>
      <div id="reportesProBody" style="padding:20px;max-height:60vh;overflow-y:auto;"></div>
    </div>
  </div>`;
  document.body.appendChild(div);
  renderReportesPro('dia');
  div.classList.add('open');
}

function cambiarTabReporte(tab, btnEl) {
  document.querySelectorAll('.rep-tab').forEach(b => {
    b.style.background = 'var(--surface2)';
    b.style.color = 'var(--text)';
  });
  btnEl.style.background = 'var(--green)';
  btnEl.style.color = '#fff';
  renderReportesPro(tab);
}

function renderReportesPro(tab = 'dia') {
  const cont = document.getElementById('reportesProBody');
  if (!cont) return;

  const hoy = new Date();

  let ventasFiltradas = (typeof historial !== 'undefined' ? historial : []);
  if (tab === 'dia') {
    ventasFiltradas = ventasFiltradas.filter(v => {
      const d = new Date(v.fechaISO || v.ts || 0);
      return d.toDateString() === hoy.toDateString();
    });
  } else if (tab === 'semana') {
    const hace7 = new Date(hoy.getTime() - 7 * 86400000);
    ventasFiltradas = ventasFiltradas.filter(v => new Date(v.fechaISO || v.ts || 0) >= hace7);
  } else if (tab === 'mes') {
    ventasFiltradas = ventasFiltradas.filter(v => {
      const d = new Date(v.fechaISO || v.ts || 0);
      return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
    });
  }

  const totalVentas   = ventasFiltradas.reduce((a, v) => a + parseFloat(v.total || 0), 0);
  const numVentas     = ventasFiltradas.length;
  const promedio      = numVentas > 0 ? totalVentas / numVentas : 0;

  // Agrupar por producto
  const prods = {};
  ventasFiltradas.forEach(v => {
    (v.items || []).forEach(it => {
      if (!prods[it.nom]) prods[it.nom] = { cant: 0, total: 0, compra: 0 };
      const prod = (typeof productos !== 'undefined' ? productos : []).find(p => p.nom === it.nom);
      prods[it.nom].cant  += Number(it.cant || 1);
      prods[it.nom].total += Number(it.precio) * Number(it.cant || 1);
      prods[it.nom].compra += (prod ? parseFloat(prod.compra || 0) : 0) * Number(it.cant || 1);
    });
  });

  if (tab === 'ganancias') {
    const ganancia  = Object.values(prods).reduce((a, p) => a + (p.total - p.compra), 0);
    const margen    = totalVentas > 0 ? (ganancia / totalVentas * 100) : 0;

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
        ${_kpiCard('💰', 'Total vendido', '$' + totalVentas.toFixed(2), '#16a34a')}
        ${_kpiCard('✨', 'Ganancia neta', '$' + ganancia.toFixed(2), '#059669')}
        ${_kpiCard('📊', 'Margen', margen.toFixed(1) + '%', '#7c3aed')}
      </div>
      <div style="font-weight:900;font-size:13px;margin-bottom:10px;">Ganancia por producto</div>
      ${Object.entries(prods).sort((a,b)=>(b[1].total-b[1].compra)-(a[1].total-a[1].compra)).slice(0,15).map(([nom,d]) => {
        const gan = d.total - d.compra;
        const mg  = d.total > 0 ? (gan/d.total*100) : 0;
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="flex:1;font-weight:800;font-size:13px;">${nom}</div>
          <div style="font-size:12px;color:var(--text-muted);">${d.cant} uds</div>
          <div style="font-size:12px;color:var(--text-muted);">$${d.total.toFixed(2)} ventas</div>
          <div style="font-weight:900;color:${gan>=0?'var(--green)':'var(--red)'};">+$${gan.toFixed(2)}</div>
          <div style="font-size:10px;background:${mg>20?'#dcfce7':mg>10?'#fef3c7':'#fee2e2'};color:${mg>20?'#15803d':mg>10?'#92400e':'#991b1b'};padding:2px 6px;border-radius:100px;font-weight:800;">${mg.toFixed(0)}%</div>
        </div>`;
      }).join('')}`;
    return;
  }

  // Agrupar ventas por hora (para hoy) o por día
  let agrupado = {};
  ventasFiltradas.forEach(v => {
    const d = new Date(v.fechaISO || v.ts || 0);
    const key = tab === 'dia'
      ? d.getHours() + ':00'
      : d.toLocaleDateString('es-SV', { weekday: 'short', day: 'numeric' });
    if (!agrupado[key]) agrupado[key] = { num: 0, total: 0 };
    agrupado[key].num++;
    agrupado[key].total += parseFloat(v.total || 0);
  });

  const topProds = Object.entries(prods).sort((a,b) => b[1].total - a[1].total).slice(0, 10);

  cont.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
      ${_kpiCard('💰', tab === 'dia' ? 'Ventas hoy' : 'Total período', '$' + totalVentas.toFixed(2), '#16a34a')}
      ${_kpiCard('🏷️', 'Transacciones', numVentas, '#1d4ed8')}
      ${_kpiCard('📈', 'Promedio', '$' + promedio.toFixed(2), '#7c3aed')}
    </div>

    <!-- Barras de hora/día -->
    ${Object.keys(agrupado).length > 0 ? `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;">
      <div style="font-weight:900;font-size:13px;margin-bottom:12px;">⏰ Ventas por ${tab === 'dia' ? 'hora' : 'día'}</div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:80px;">
        ${(() => {
          const maxV = Math.max(...Object.values(agrupado).map(v => v.total), 1);
          return Object.entries(agrupado).map(([k, v]) => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
              <div style="font-size:9px;font-weight:700;color:var(--text-muted);">$${v.total.toFixed(0)}</div>
              <div style="width:100%;background:var(--green);border-radius:4px 4px 0 0;height:${Math.max(4, (v.total/maxV)*60)}px;transition:height 0.3s;"></div>
              <div style="font-size:9px;font-weight:700;color:var(--text-muted);transform:rotate(-30deg);transform-origin:center;white-space:nowrap;">${k}</div>
            </div>`).join('');
        })()}
      </div>
    </div>` : ''}

    <!-- Top productos -->
    <div style="font-weight:900;font-size:13px;margin-bottom:10px;">🏆 Top productos</div>
    ${topProds.map(([nom, d], i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);">
      <div style="width:24px;height:24px;border-radius:50%;background:${i===0?'#fbbf24':i===1?'#9ca3af':i===2?'#cd7c00':'var(--green-light)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:${i<3?'#fff':'var(--green)'};">${i+1}</div>
      <div style="flex:1;font-weight:800;font-size:13px;">${nom}</div>
      <div style="font-size:12px;color:var(--text-muted);">${d.cant} uds</div>
      <div style="font-weight:900;color:var(--green);">$${d.total.toFixed(2)}</div>
    </div>`).join('')}
    ${topProds.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:30px;font-size:13px;">Sin datos para este período</div>' : ''}
  `;
}

// =====================================================================
//  INYECTAR BOTONES EXTRA EN LA NAVBAR / PANEL
// =====================================================================

/**
 * Llama esto desde init() de tu app, después de que el DOM esté listo.
 * Agrega botones de Corte de Caja y Reportes en la interfaz.
 */
function posProInyectarBotones() {
  // Botón de corte de caja en navbar (solo admin)
  const navStats = document.querySelector('.nav-stats');
  if (navStats && !document.getElementById('btnCorteCajaNv')) {
    const btn = document.createElement('button');
    btn.id = 'btnCorteCajaNv';
    btn.className = 'stat-chip';
    btn.style.cssText = 'cursor:pointer;background:rgba(29,78,216,0.25);border-color:rgba(29,78,216,0.5);';
    btn.title = 'Corte de Caja [F4]';
    btn.innerHTML = '🏧 Corte';
    btn.onclick = abrirCorteCaja;
    navStats.appendChild(btn);
  }

  // Botón de reportes rápidos
  if (navStats && !document.getElementById('btnReporteNv')) {
    const btn = document.createElement('button');
    btn.id = 'btnReporteNv';
    btn.className = 'stat-chip';
    btn.style.cssText = 'cursor:pointer;background:rgba(5,150,105,0.25);border-color:rgba(5,150,105,0.5);';
    btn.title = 'Reportes del día';
    btn.innerHTML = '📊 Reportes';
    btn.onclick = abrirReportesDia;
    navStats.appendChild(btn);
  }

  // Buscador visible en pgDash con hint de scanner
  const busq = document.getElementById('busquedaVenta');
  if (busq) {
    busq.setAttribute('placeholder', '🔍 Buscar o escanear código (/) ');
    busq.setAttribute('autocomplete', 'off');
    busq.setAttribute('autocorrect', 'off');
    busq.setAttribute('spellcheck', 'false');
  }

  // Mostrar/ocultar controles según rol
  _posProAplicarRol();
}

function _posProAplicarRol() {
  const esCajero = typeof _usuarioActual !== 'undefined' && _usuarioActual?.rol === 'cajero';
  // Ocultar botones admin para cajeros
  if (esCajero) {
    ['btnCorteCajaNv','btnReporteNv'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
}

// =====================================================================
//  PANEL CONFIG TICKET (para settings)
// =====================================================================

function abrirConfigTicket() {
  const modal = document.getElementById('modalConfigTicket');
  if (modal) { modal.classList.add('open'); return; }
  const div = document.createElement('div');
  div.id = 'modalConfigTicket';
  div.className = 'modal';
  div.innerHTML = `
  <div class="modal-box modal-sm">
    <div class="modal-header"><h3>🖨️ Configurar Ticket</h3>
      <button class="btn-close" onclick="cerrarModal('modalConfigTicket')">✕</button></div>
    <div class="modal-body">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <label style="font-weight:800;font-size:13px;">Nombre del negocio
          <input id="cfgTicketNombre" type="text" placeholder="Mi Tienda"
            value="${localStorage.getItem('vpos_tiendaNombre') || ''}"
            style="display:block;width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid var(--border-mid);border-radius:8px;font-family:Nunito,sans-serif;font-size:13px;font-weight:700;">
        </label>
        <label style="font-weight:800;font-size:13px;">Teléfono
          <input id="cfgTicketTel" type="text" placeholder="2222-3333"
            value="${localStorage.getItem('vpos_tiendaTel') || ''}"
            style="display:block;width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid var(--border-mid);border-radius:8px;font-family:Nunito,sans-serif;font-size:13px;font-weight:700;">
        </label>
        <label style="font-weight:800;font-size:13px;">Dirección
          <input id="cfgTicketDirec" type="text" placeholder="Calle Principal #1"
            value="${localStorage.getItem('vpos_tiendaDirec') || ''}"
            style="display:block;width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid var(--border-mid);border-radius:8px;font-family:Nunito,sans-serif;font-size:13px;font-weight:700;">
        </label>
        <label style="display:flex;align-items:center;gap:10px;font-weight:800;font-size:13px;cursor:pointer;">
          <input type="checkbox" id="cfgAutoImprimir" ${localStorage.getItem('vpos_autoImprimir') === '1' ? 'checked' : ''}
            style="width:18px;height:18px;cursor:pointer;">
          Imprimir ticket automáticamente al vender
        </label>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button class="btn" style="flex:1;background:var(--green);color:#fff;" onclick="guardarConfigTicket()">✅ Guardar</button>
        <button class="btn btn-ghost" onclick="cerrarModal('modalConfigTicket')" style="flex:0 0 auto;">Cancelar</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div);
  div.classList.add('open');
}

function guardarConfigTicket() {
  localStorage.setItem('vpos_tiendaNombre',  document.getElementById('cfgTicketNombre')?.value || '');
  localStorage.setItem('vpos_tiendaTel',     document.getElementById('cfgTicketTel')?.value   || '');
  localStorage.setItem('vpos_tiendaDirec',   document.getElementById('cfgTicketDirec')?.value || '');
  localStorage.setItem('vpos_autoImprimir',  document.getElementById('cfgAutoImprimir')?.checked ? '1' : '0');
  cerrarModal('modalConfigTicket');
  toast('✅ Configuración de ticket guardada');
}

// =====================================================================
//  INICIALIZACIÓN
// =====================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', posProInyectarBotones);
} else {
  // DOM ya listo (script cargado tarde)
  setTimeout(posProInyectarBotones, 800);
}
