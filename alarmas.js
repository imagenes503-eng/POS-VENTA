// ===== SCANNER CÓDIGO DE BARRAS (html5-qrcode) =====
let _html5Qr = null;
let _scannerRunning = false;
let _lastScanTs = 0;

async function abrirScannerVenta() {
  _scannerModo = 'venta';
  ocultarResultadoScanner();
  document.getElementById('modalScanner').style.display = 'flex';
  setScannerStatus('Iniciando cámara…');
  await iniciarScanner();
}

async function _loadHtml5Qrcode() {
  if (window.Html5Qrcode) return; // ya cargada
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function iniciarScanner() {
  // ── Limpiar instancia previa ANTES de cualquier otra operación ──────
  if (_html5Qr) {
    if (_scannerRunning) {
      try { await _html5Qr.stop(); } catch(e) {}
    }
    try { _html5Qr.clear(); } catch(e) {}
    _html5Qr = null;
    _scannerRunning = false;
    // Pequeña pausa para que el navegador libere la cámara
    await new Promise(r => setTimeout(r, 250));
  }

  try {
    await _loadHtml5Qrcode();

    // Firefox Android no soporta ZXing-WASM (formatsToSupport) ni el enum
    // supportedScanTypes — ambos causan fallo silencioso. Se detecta Firefox
    // y se usa una config mínima compatible. Chrome/Safari usan config optimizada.
    const esFirefox = /firefox/i.test(navigator.userAgent);

    const config = esFirefox
      ? {
          // Config mínima Firefox: sin WASM, sin enums problemáticos
          fps: 15,
          qrbox: { width: 250, height: 110 },
        }
      : {
          // Config optimizada Chrome/Safari
          fps: 30,
          qrbox: { width: 280, height: 120 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ]
        };

    _html5Qr = new Html5Qrcode('scannerRegion', { verbose: false });

    // Estrategia multi-nivel compatible con Chrome, Firefox y Safari:
    // 1) { ideal: 'environment' } — suave, funciona en todos los browsers y SO
    // 2) Listar cámaras y elegir la trasera por label (fallback Android/Firefox)
    // 3) Cualquier cámara disponible (último recurso desktop/Firefox sin trasera)
    const onScan = (codigo) => onCodigoEscaneado(codigo);
    const onErr  = () => {};

    let iniciado = false;

    // Intento 1: constraint suave — Chrome/Safari/Firefox lo respetan correctamente
    try {
      await _html5Qr.start({ facingMode: { ideal: 'environment' } }, config, onScan, onErr);
      iniciado = true;
    } catch (e1) { /* continuar */ }

    // Intento 2: elegir cámara trasera por ID (Firefox desktop / algunos Android)
    if (!iniciado) {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const rear = cameras.find(c => /back|environ|rear|poste|trasera/i.test(c.label || ''));
          const camId = rear ? rear.id : cameras[0].id;
          try { _html5Qr.clear(); } catch(_) {}
          _html5Qr = new Html5Qrcode('scannerRegion', { verbose: false });
          await _html5Qr.start(camId, config, onScan, onErr);
          iniciado = true;
        }
      } catch (e2) { /* continuar */ }
    }

    // Intento 3: cualquier cámara (último recurso)
    if (!iniciado) {
      try { _html5Qr.clear(); } catch(_) {}
      _html5Qr = new Html5Qrcode('scannerRegion', { verbose: false });
      await _html5Qr.start({ facingMode: 'user' }, config, onScan, onErr);
    }

    _scannerRunning = true;
    setScannerStatus('📷 Apunta al código de barras…');

    // Ocultar controles extra que inyecta html5-qrcode
    setTimeout(() => {
      const extras = document.querySelectorAll('#scannerRegion button, #scannerRegion select, #scannerRegion img[alt="Info"]');
      extras.forEach(el => { if (!el.id) el.style.display = 'none'; });
    }, 800);

  } catch(err) {
    _scannerRunning = false;
    const errStr = err ? (err.message || err.toString()) : '';
    const esPermiso  = /NotAllowed|Permission|permission|denied/i.test(errStr);
    const esNoCamera = /NotFound|DevicesNotFound|Requested device/i.test(errStr);

    const region = document.getElementById('scannerRegion');

    if (esPermiso) {
      if (region) {
        region.innerHTML = `
          <div style="padding:20px;text-align:center;color:#fff;">
            <div style="font-size:40px;margin-bottom:12px;">📵</div>
            <div style="font-size:15px;font-weight:900;margin-bottom:8px;">Permiso de cámara bloqueado</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.7;margin-bottom:14px;">
              Tu navegador bloqueó el acceso a la cámara.
            </div>
            <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:14px;text-align:left;font-size:12px;color:rgba(255,255,255,0.9);line-height:1.9;">
              <b>Chrome / Android:</b><br>
              🔒 Toca el candado → Permisos → Cámara → Permitir<br><br>
              <b>Safari / iPhone:</b><br>
              ⚙️ Ajustes del iPhone → Safari → Cámara → Permitir<br><br>
              <b>Firefox:</b><br>
              🔒 Candado en la barra → Permisos de cámara → Permitir<br><br>
              Luego recarga la página.
            </div>
            <button onclick="location.reload()" style="margin-top:14px;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:10px 22px;font-size:14px;font-weight:900;cursor:pointer;">🔄 Recargar página</button>
          </div>`;
      }
      setScannerStatus('⚠ Permiso de cámara denegado');
    } else if (esNoCamera) {
      if (region) {
        region.innerHTML = `<div style="padding:24px;text-align:center;color:#fff;">
          <div style="font-size:36px;margin-bottom:10px;">📷</div>
          <div style="font-size:14px;font-weight:900;">No se detectó cámara</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:6px;">Usa el buscador manual o un lector de código de barras físico.</div>
        </div>`;
      }
      setScannerStatus('⚠ No se encontró cámara');
      toast('⚠ No se encontró cámara en este dispositivo', true);
    } else {
      setScannerStatus('⚠ Error: ' + errStr.slice(0, 70));
      toast('⚠ Error al iniciar cámara', true);
    }
  }
}

function onCodigoEscaneado(codigo) {
  if (_scannerModo === 'inventario') { onCodigoInventario(codigo); return; }
  const now = Date.now();
  if (now - _lastScanTs < 600) return; // anti-rebote
  _lastScanTs = now;

  if (navigator.vibrate) navigator.vibrate([60, 30, 60]);

  const codLimpio = codigo.trim();
  setScannerStatus('Leído: ' + codLimpio);

  // Buscar en inventario por código exacto, luego por nombre
  let prod = productos.find(p => (p.cod || '').trim() === codLimpio);
  if (!prod) {
    // Intento flexible: el código guardado puede tener ceros a la izquierda distintos
    prod = productos.find(p => {
      const c = (p.cod || '').trim();
      return c && (c === codLimpio || c.replace(/^0+/, '') === codLimpio.replace(/^0+/, ''));
    });
  }

  if (prod) {
    document.getElementById('scannerNoEncontrado').style.display = 'none';
    const box = document.getElementById('scannerResultBox');
    box.style.display = 'flex';
    document.getElementById('scannerResultNom').textContent = prod.nom;
    document.getElementById('scannerResultMeta').textContent =
      '$' + fmtP(prod.venta || 0) + '  •  Stock: ' + (prod.stock || 0) + '  •  ' + codLimpio;

    // Agregar inmediatamente — sin delay
    cerrarScanner();
    if ((prod.stock || 0) <= 0) {
      toast('⚠ ' + prod.nom + ' — sin stock', true);
    } else {
      (prod.paquetes || []).length > 0 ? abrirPickerPaquetes(prod) : addCarrito(prod);
    }

  } else {
    document.getElementById('scannerResultBox').style.display = 'none';
    const noEnc = document.getElementById('scannerNoEncontrado');
    noEnc.style.display = 'block';
    document.getElementById('scannerCodLeido').textContent = 'Código: ' + codLimpio;
    // Poner el código en el buscador manual
    const inp = document.getElementById('busquedaVenta');
    if (inp) inp.value = codLimpio;
    setTimeout(() => { noEnc.style.display = 'none'; }, 3500);
  }
}

async function cerrarScanner() {
  if (_html5Qr) {
    if (_scannerRunning) {
      try { await _html5Qr.stop(); } catch(e) {}
    }
    try { _html5Qr.clear(); } catch(e) {}
    _html5Qr = null;
  }
  _scannerRunning = false;
  _scannerModo = 'venta';
  document.getElementById('modalScanner').style.display = 'none';
  ocultarResultadoScanner();
}

function setScannerStatus(txt) {
  const el = document.getElementById('scannerStatusTxt');
  if (el) el.textContent = txt;
}

function ocultarResultadoScanner() {
  const a = document.getElementById('scannerResultBox');
  const b = document.getElementById('scannerNoEncontrado');
  if (a) a.style.display = 'none';
  if (b) b.style.display = 'none';
}

// ===== ALARMAS PDF =====
let alarmasPDF = []; // [{id, nombre, dias:[0-6], hora:'HH:MM', fechaDesde:'', fechaHasta:'', categoria:'todas', activa:true}]
// dias: 0=Dom,1=Lun,2=Mar,3=Mie,4=Jue,5=Vie,6=Sab
const DIAS_NOMBRES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
let _alarmaInterval = null;
let _alarmaEditId = null;

async function cargarAlarmasPDF() {
  try { const r = await idbGet('vpos_alarmasPDF'); if (r) alarmasPDF = r; } catch(e) {}
}
function guardarAlarmasPDF() {
  idbSet('vpos_alarmasPDF', alarmasPDF).catch(console.error);
}

function abrirModalAlarmas() {
  poblarCategoriasSelectorAlarma();
  renderListaAlarmas();
  resetFormAlarma();
  abrirModal('modalAlarmas');
}

function renderListaAlarmas() {
  const cont = document.getElementById('alarmasLista');
  if (!cont) return;
  if (!alarmasPDF.length) {
    cont.innerHTML = `<div class="empty" style="padding:20px 0;"><span class="empty-icon">⏰</span><div style="font-size:13px;color:var(--text-muted);font-weight:700;">Sin alarmas programadas</div></div>`;
    return;
  }
  cont.innerHTML = alarmasPDF.map((a,i) => {
    const diasStr = a.dias.length===7 ? 'Todos los días' : a.dias.map(d=>DIAS_NOMBRES[d]).join(', ');
    const catLabel = a.categoria === 'todas' ? 'Todas' : a.categoria;
    return `<div style="background:${a.activa?'var(--green-light)':'var(--surface2)'};border:1.5px solid ${a.activa?'var(--border-mid)':'var(--border)'};border-radius:var(--r-sm);padding:10px 12px;margin-bottom:8px;transition:all 0.2s;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="font-size:13px;font-weight:900;color:${a.activa?'var(--green-dark)':'var(--text-muted)'};">⏰ ${a.nombre}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button onclick="toggleAlarma(${i})" style="background:${a.activa?'var(--green)':'var(--surface2)'};color:${a.activa?'#fff':'var(--text-muted)'};border:1px solid ${a.activa?'var(--green)':'var(--border-mid)'};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:900;cursor:pointer;font-family:'Nunito',sans-serif;">${a.activa?'ON':'OFF'}</button>
          <button onclick="editarAlarma(${i})" style="background:var(--blue-light);color:var(--blue);border:1px solid rgba(29,78,216,0.2);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:900;cursor:pointer;font-family:'Nunito',sans-serif;">✏️</button>
          <button onclick="eliminarAlarma(${i})" style="background:var(--red-light);color:var(--red);border:1px solid rgba(220,38,38,0.2);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:900;cursor:pointer;font-family:'Nunito',sans-serif;">🗑</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-dim);font-weight:700;display:flex;flex-wrap:wrap;gap:6px;">
        <span style="background:rgba(217,119,6,0.12);color:#92400e;border-radius:4px;padding:2px 7px;">🕐 ${a.hora}</span>
        <span style="background:rgba(29,78,216,0.08);color:var(--blue);border-radius:4px;padding:2px 7px;">📅 ${diasStr}</span>
        <span style="background:rgba(22,163,74,0.1);color:var(--green-dark);border-radius:4px;padding:2px 7px;">📦 ${catLabel}</span>
        ${a.fechaDesde||a.fechaHasta ? `<span style="background:var(--surface2);color:var(--text-muted);border-radius:4px;padding:2px 7px;">📆 ${a.fechaDesde||'inicio'} → ${a.fechaHasta||'hoy'}</span>` : `<span style="background:var(--surface2);color:var(--text-muted);border-radius:4px;padding:2px 7px;">📆 Período automático</span>`}
      </div>
    </div>`;
  }).join('');
}

function resetFormAlarma() {
  _alarmaEditId = null;
  document.getElementById('alarmaFormTitulo').textContent = '➕ Nueva Alarma';
  document.getElementById('alarmaNombre').value = '';
  document.getElementById('alarmaHora').value = '08:00';
  document.getElementById('alarmaCategoriaSel').value = 'todas';
  document.getElementById('alarmaDesde').value = '';
  document.getElementById('alarmaHasta').value = '';
  document.querySelectorAll('.dia-btn').forEach(b => b.classList.remove('activo'));
  document.getElementById('btnGuardarAlarma').textContent = '💾 Guardar Alarma';
}

function toggleDiaBtn(el, dia) {
  el.classList.toggle('activo');
}

function editarAlarma(i) {
  const a = alarmasPDF[i];
  _alarmaEditId = i;
  document.getElementById('alarmaFormTitulo').textContent = '✏️ Editar Alarma';
  document.getElementById('alarmaNombre').value = a.nombre;
  document.getElementById('alarmaHora').value = a.hora;
  document.getElementById('alarmaCategoriaSel').value = a.categoria;
  document.getElementById('alarmaDesde').value = a.fechaDesde || '';
  document.getElementById('alarmaHasta').value = a.fechaHasta || '';
  document.querySelectorAll('.dia-btn').forEach(b => {
    const d = parseInt(b.dataset.dia);
    b.classList.toggle('activo', a.dias.includes(d));
  });
  document.getElementById('btnGuardarAlarma').textContent = '✔ Actualizar Alarma';
  document.getElementById('alarmaFormSection').scrollIntoView({behavior:'smooth'});
}

function toggleAlarma(i) {
  alarmasPDF[i].activa = !alarmasPDF[i].activa;
  guardarAlarmasPDF();
  renderListaAlarmas();
  actualizarResumenAlarmas();
  toast(alarmasPDF[i].activa ? '✅ Alarma activada' : '⏸ Alarma pausada');
}

function eliminarAlarma(i) {
  if (!confirm(`¿Eliminar la alarma "${alarmasPDF[i].nombre}"?`)) return;
  alarmasPDF.splice(i, 1);
  guardarAlarmasPDF();
  renderListaAlarmas();
  actualizarResumenAlarmas();
  toast('🗑 Alarma eliminada');
}

function guardarAlarma() {
  const nombre = document.getElementById('alarmaNombre').value.trim();
  const hora = document.getElementById('alarmaHora').value;
  const categoria = document.getElementById('alarmaCategoriaSel').value;
  const fechaDesde = document.getElementById('alarmaDesde').value;
  const fechaHasta = document.getElementById('alarmaHasta').value;
  const diasActivos = [...document.querySelectorAll('.dia-btn.activo')].map(b => parseInt(b.dataset.dia));

  if (!nombre) { toast('⚠ Ponle un nombre a la alarma', true); return; }
  if (!hora) { toast('⚠ Selecciona una hora', true); return; }
  if (!diasActivos.length) { toast('⚠ Selecciona al menos un día', true); return; }

  const alarma = { id: _alarmaEditId !== null ? alarmasPDF[_alarmaEditId].id : Date.now(), nombre, dias: diasActivos, hora, fechaDesde, fechaHasta, categoria, activa: true };

  if (_alarmaEditId !== null) {
    alarmasPDF[_alarmaEditId] = alarma;
    toast('✅ Alarma actualizada');
  } else {
    alarmasPDF.push(alarma);
    toast('✅ Alarma creada');
  }
  guardarAlarmasPDF();
  renderListaAlarmas();
  actualizarResumenAlarmas();
  resetFormAlarma();
}

function actualizarResumenAlarmas() {
  const activas = alarmasPDF.filter(a => a.activa).length;
  const badge = document.getElementById('alarmaBadge');
  const resumen = document.getElementById('alarmasResumen');
  if (!badge || !resumen) return;
  if (activas === 0) {
    badge.style.display = 'none';
    resumen.textContent = 'Sin alarmas activas';
  } else {
    badge.style.display = 'inline';
    badge.textContent = activas;
    const proxima = obtenerProximaAlarma();
    resumen.textContent = proxima ? `Próxima: ${proxima}` : `${activas} alarma${activas>1?'s':''} activa${activas>1?'s':''}`;
  }
}

function obtenerProximaAlarma() {
  const ahora = new Date();
  const diaSemana = ahora.getDay();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  let minDiff = Infinity, nombreProxima = '';
  alarmasPDF.filter(a=>a.activa).forEach(a => {
    const [h,m] = a.hora.split(':').map(Number);
    const minAlarma = h*60+m;
    a.dias.forEach(d => {
      let diff = (d - diaSemana + 7) % 7;
      if (diff === 0 && minAlarma <= horaActual) diff = 7;
      const totalMin = diff * 1440 + minAlarma - horaActual;
      if (totalMin < minDiff) { minDiff = totalMin; nombreProxima = `${a.nombre} — ${DIAS_NOMBRES[d]} ${a.hora}`; }
    });
  });
  return nombreProxima;
}

function verificarAlarmas() {
  if (!alarmasPDF.length) return;
  const ahora = new Date();
  const diaSemana = ahora.getDay();
  const horaActual = `${String(ahora.getHours()).padStart(2,'0')}:${String(ahora.getMinutes()).padStart(2,'0')}`;
  const claveHoy = `${ahora.getFullYear()}-${ahora.getMonth()}-${ahora.getDate()}`;

  alarmasPDF.filter(a => a.activa).forEach(a => {
    if (!a.dias.includes(diaSemana)) return;
    if (a.hora !== horaActual) return;
    const claveFirada = `alarma_disparada_${a.id}_${claveHoy}`;
    if (sessionStorage.getItem(claveFirada)) return;
    sessionStorage.setItem(claveFirada, '1');
    dispararAlarma(a);
  });
}

function dispararAlarma(a) {
  // Vibrar si disponible
  if (navigator.vibrate) navigator.vibrate([200,100,200,100,200]);

  // Notificación nativa si hay permiso
  if (Notification && Notification.permission === 'granted') {
    new Notification('⏰ Alarma PDF — ' + a.nombre, {
      body: `Es hora de descargar tu PDF${a.categoria!=='todas'?' de '+a.categoria:''}`,
      icon: '',
      tag: 'alarma-pdf-' + a.id
    });
  }

  // Modal de aviso en pantalla
  document.getElementById('alarmaAvisoNombre').textContent = a.nombre;
  document.getElementById('alarmaAvisoCategoria').textContent = a.categoria === 'todas' ? 'Todas las categorías' : a.categoria;
  document.getElementById('alarmaAvisoDias').textContent = a.dias.map(d=>DIAS_NOMBRES[d]).join(', ');
  document.getElementById('alarmaAvisoHora').textContent = a.hora;
  document.getElementById('alarmaAvisoFechas').textContent = a.fechaDesde || a.fechaHasta ? `${a.fechaDesde||'—'} → ${a.fechaHasta||'hoy'}` : 'Período automático (últimos 7 días)';
  document.getElementById('btnAlarmaDescargar').onclick = () => {
    cerrarModal('modalAlarmaAviso');
    ejecutarDescargaAlarma(a);
  };
  abrirModal('modalAlarmaAviso');
}

function ejecutarDescargaAlarma(a) {
  // Prepoblar los campos de PDF Rango y ejecutar descarga
  const hoy = new Date();
  const hasta = hoy.toISOString().split('T')[0];
  let desde = a.fechaDesde;
  if (!desde) {
    const d = new Date(hoy); d.setDate(d.getDate()-7);
    desde = d.toISOString().split('T')[0];
  }
  const hastaFinal = a.fechaHasta || hasta;

  document.getElementById('pdfFechaDesde').value = desde;
  document.getElementById('pdfFechaHasta').value = hastaFinal;
  // Ir a la pestaña de reportes si no está activa
  const tabReportes = document.querySelector('[data-pg="reportes"]') || document.querySelector('[onclick*="reportes"]');

  // Llenar categoría si el selector existe y la opción también
  const sel = document.getElementById('pdfCategoria');
  if (sel) {
    const opt = [...sel.options].find(o => o.value === a.categoria);
    if (opt) sel.value = a.categoria;
  }
  generarPDFRango();
}

function pedirPermisoNotificaciones() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function poblarCategoriasSelectorAlarma() {
  const sel = document.getElementById('alarmaCategoriaSel');
  if (!sel) return;
  const cats = [...new Set(productos.map(p => p.cat).filter(Boolean))].sort();
  const valorActual = sel.value;
  sel.innerHTML = '<option value="todas">📦 Todas las categorías</option>';
  cats.forEach(c => { const o = document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
  if (valorActual && [...sel.options].find(o=>o.value===valorActual)) sel.value = valorActual;
}

function iniciarMonitorAlarmas() {
  if (_alarmaInterval) clearInterval(_alarmaInterval);
  _alarmaInterval = setInterval(verificarAlarmas, 30000); // cada 30s
  verificarAlarmas(); // verificar al iniciar
  pedirPermisoNotificaciones();
}

// ===== SCANNER PARA INVENTARIO =====
let _scannerModo = 'venta'; // 'venta' | 'inventario'

async function abrirScannerInventario() {
  _scannerModo = 'inventario';
  ocultarResultadoScanner();
  document.getElementById('modalScanner').style.display = 'flex';
  setScannerStatus('Iniciando cámara…');
  await iniciarScanner();
}

// ===== SCANNER INVENTARIO — onCodigoInventario =====
function onCodigoInventario(codigo) {
  const now = Date.now();
  if (now - _lastScanTs < 600) return;
  _lastScanTs = now;
  if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
  const codLimpio = codigo.trim();
  const existe = productos.find(p => (p.cod || '').trim() === codLimpio);
  setTimeout(async () => {
    await cerrarScanner();
    const titulo = document.querySelector('#modalScanner [style*="font-size:16px"]');
    if (titulo) titulo.textContent = '▦ Lector de Código de Barras';
    _scannerModo = 'venta';
    const inp = document.getElementById('inpCod');
    if (inp) {
      inp.value = codLimpio;
      inp.focus();
      inp.style.borderColor = 'var(--green)';
      inp.style.background = '#f0fdf4';
      setTimeout(() => { inp.style.borderColor = ''; inp.style.background = ''; }, 2000);
    }
    if (existe) {
      toast('⚠ Código ya existe: ' + existe.nom, true);
    } else {
      toast('✓ Código escaneado: ' + codLimpio);
    }
  }, 400);
}

// ===== SYNC P2P =====
let _syncCamStream = null;
let _syncScanLoop = null;
let _syncDatosServidor = null; // guardamos los datos empaquetados

// ── Helpers UI ──
function syncSetStatus(id, msg, color) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
}
function syncLog(msg) {
  const el = document.getElementById('syncC_log');
  if (!el) return;
  el.style.display = 'block';
  const d = document.createElement('div');
  d.textContent = msg;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}
function syncMostrarResultado(ok, titulo, desc) {
  ['syncPaso0','syncPasoServidor','syncPasoCliente'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('syncPasoResultado').style.display = 'block';
  document.getElementById('syncR_icon').textContent = ok ? '✅' : '❌';
  document.getElementById('syncR_titulo').textContent = titulo;
  document.getElementById('syncR_titulo').style.color = ok ? 'var(--green-dark)' : 'var(--red)';
  document.getElementById('syncR_desc').textContent = desc;
}

// ── Elegir rol ──
function syncElegirRol(rol) {
  document.getElementById('syncPaso0').style.display = 'none';
  if (rol === 'servidor') {
    document.getElementById('syncPasoServidor').style.display = 'block';
    syncPrepararServidor();
  } else {
    document.getElementById('syncPasoCliente').style.display = 'block';
    // Verificar si llegamos con datos en la URL
    const params = new URLSearchParams(window.location.search);
    const d = params.get('syncdata');
    if (d) {
      syncLog('📦 Datos detectados en la URL — importando…');
      syncProcesarDatos(d);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
}

function syncReset() {
  syncCerrarCamara();
  _syncDatosServidor = null;
  document.getElementById('syncPaso0').style.display = 'block';
  ['syncPasoServidor','syncPasoCliente','syncPasoResultado'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Limpiar log
  const log = document.getElementById('syncC_log');
  if (log) { log.innerHTML = ''; log.style.display = 'none'; }
  const inp = document.getElementById('syncC_urlInput');
  if (inp) inp.value = '';
}

// ── SERVIDOR: empaquetar datos y mostrar QR ──
async function syncPrepararServidor() {
  const statusEl = document.getElementById('syncS_status');
  statusEl.textContent = '⏳ Empaquetando datos…';
  statusEl.style.background = '#eef2ff';
  statusEl.style.color = '#4f46e5';

  try {
    const datos = {
      v: 1,
      ts: new Date().toISOString(),
      productos: productos,
      historial: historial,
      ventasDiarias: ventasDiarias || []
    };

    _syncDatosServidor = datos;
    const json = JSON.stringify(datos);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const kb = Math.round(b64.length / 1024);

    const nP = datos.productos.length;
    const nV = datos.historial.length;

    statusEl.textContent = `✅ ${nP} productos · ${nV} ventas · ${kb} KB`;
    statusEl.style.background = '#dcfce7';
    statusEl.style.color = '#15803d';

    if (b64.length <= 2500) {
      // QR directo: caben en un QR
      const baseURL = window.location.href.split('?')[0];
      const fullURL = baseURL + '?syncdata=' + b64;
      syncMostrarQR(fullURL, kb, fullURL);
    } else {
      // Muy grande para QR → solo archivo
      document.getElementById('syncS_archivoSection').style.display = 'block';
      document.getElementById('syncS_qrSection').style.display = 'none';
      statusEl.textContent = `📁 Datos: ${kb} KB — usa el botón para descargar`;
      statusEl.style.background = '#fef3c7';
      statusEl.style.color = '#92400e';
    }
  } catch(err) {
    statusEl.textContent = '❌ Error: ' + err.message;
    statusEl.style.background = '#fee2e2';
    statusEl.style.color = '#dc2626';
  }
}

function syncMostrarQR(urlConDatos, kb, linkText) {
  document.getElementById('syncS_qrSection').style.display = 'block';
  document.getElementById('syncS_qrInfo').textContent = kb + ' KB de datos en el QR';

  // Intentar cargar QR con imagen (necesita internet brevemente)
  const img = document.getElementById('syncS_qrImg');
  const canvas = document.getElementById('syncS_qrCanvas');
  const qrAPIurl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(urlConDatos) + '&format=png&margin=4';

  img.style.display = 'block';
  canvas.style.display = 'none';
  img.src = qrAPIurl;
  img.onerror = () => {
    // Sin internet: mostrar QR de texto generado manualmente
    img.style.display = 'none';
    canvas.style.display = 'block';
    syncQRTextoFallback(canvas, urlConDatos);
  };

  // Mostrar caja de enlace para copiar/enviar
  document.getElementById('syncS_linkBox').style.display = 'block';
  document.getElementById('syncS_linkText').textContent = linkText.length > 100
    ? linkText.substring(0, 100) + '…'
    : linkText;

  // Guardar enlace para copiar
  document.getElementById('syncS_linkBox').dataset.fullLink = linkText;
}

function syncQRTextoFallback(canvas, texto) {
  // QR manual simple con texto
  const ctx = canvas.getContext('2d');
  const sz = 220;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, sz, sz);
  ctx.fillStyle = '#4f46e5';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('⚠ Sin internet para QR', sz/2, 20);
  ctx.fillText('Usa el enlace de abajo ↓', sz/2, 38);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#374151';
  const words = texto.match(/.{1,26}/g) || [];
  words.slice(0, 12).forEach((w, i) => ctx.fillText(w, sz/2, 58 + i * 13));
}

function syncCopiarLink() {
  const link = document.getElementById('syncS_linkBox').dataset.fullLink || '';
  if (!link) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => toast('✓ Enlace copiado'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = link;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('✓ Enlace copiado');
  }
}

async function syncDescargarJSON() {
  if (!_syncDatosServidor) return;
  const json = JSON.stringify(_syncDatosServidor, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sync_despensa_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('✓ Archivo descargado');
}

// ── CLIENTE: cámara ──
async function syncAbrirCamara() {
  const btn = document.getElementById('syncC_btnCamara');
  const wrap = document.getElementById('syncC_videoWrap');
  const video = document.getElementById('syncC_video');

  btn.textContent = '⏳ Abriendo cámara…';
  btn.disabled = true;

  // Cargar jsQR primero para no tener doble await después de getUserMedia
  await new Promise((resolve) => {
    if (typeof jsQR !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js';
    s.onload = resolve;
    s.onerror = () => { syncLog('⚠ Sin internet para cargar escáner. Usa pegar enlace o archivo.'); resolve(); };
    document.head.appendChild(s);
  });

  // Intentar cámara trasera → delantera → cualquiera
  const constraints = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
    { video: { facingMode: 'user' } },
    { video: true }
  ];

  let stream = null;
  for (const c of constraints) {
    try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch(_) {}
  }

  if (!stream) {
    btn.textContent = '📷 Abrir cámara y escanear QR';
    btn.disabled = false;
    syncLog('❌ No se pudo acceder a la cámara. Verifica los permisos del navegador.');
    toast('No se pudo acceder a la cámara', true);
    return;
  }

  _syncCamStream = stream;
  video.srcObject = stream;
  try { await video.play(); } catch(_) {}
  wrap.style.display = 'block';
  btn.style.display = 'none';

  if (typeof jsQR !== 'undefined') {
    syncIniciarScanLoop();
  } else {
    syncLog('⚠ Escáner no disponible. Usa pegar enlace o archivo.');
  }
}

function syncIniciarScanLoop() {
  const video = document.getElementById('syncC_video');
  const canvas = document.getElementById('syncC_canvas');
  const ctx = canvas.getContext('2d');

  syncLog('📷 Cámara lista — apunta al QR del Teléfono #1');

  _syncScanLoop = setInterval(() => {
    if (video.readyState < video.HAVE_ENOUGH_DATA) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    try {
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        clearInterval(_syncScanLoop); _syncScanLoop = null;
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        syncLog('✅ QR detectado');
        syncCerrarCamara();
        syncProcesarTextoQR(code.data);
      }
    } catch(e) {}
  }, 300);
}

function syncCerrarCamara() {
  if (_syncCamStream) { _syncCamStream.getTracks().forEach(t => t.stop()); _syncCamStream = null; }
  if (_syncScanLoop) { clearInterval(_syncScanLoop); _syncScanLoop = null; }
  const wrap = document.getElementById('syncC_videoWrap');
  const btn = document.getElementById('syncC_btnCamara');
  if (wrap) wrap.style.display = 'none';
  if (btn) { btn.style.display = 'flex'; btn.disabled = false; btn.textContent = '📷 Abrir cámara y escanear QR'; }
}

function syncProcesarTextoQR(texto) {
  syncLog('🔍 Procesando QR…');
  try {
    const url = new URL(texto);
    const d = url.searchParams.get('syncdata');
    if (d) { syncProcesarDatos(d); return; }
    document.getElementById('syncC_urlInput').value = texto;
    syncLog('🔗 URL detectada — presiona Importar');
  } catch(e) {
    // Intentar como JSON directo
    try {
      const obj = JSON.parse(texto);
      syncAplicarDatos(obj);
    } catch(e2) {
      document.getElementById('syncC_urlInput').value = texto;
      syncLog('⚠ No se reconoció el formato. Intenta pegar el enlace manualmente.');
    }
  }
}

function syncProcesarURL() {
  const val = document.getElementById('syncC_urlInput').value.trim();
  if (!val) { toast('Pega el enlace primero', true); return; }
  syncLog('🔗 Procesando enlace…');
  syncProcesarTextoQR(val);
}

function syncProcesarDatos(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    syncAplicarDatos(obj);
  } catch(err) {
    syncLog('❌ Error al leer datos: ' + err.message);
    toast('Error al leer los datos del QR', true);
  }
}

function syncAbrirArchivo() {
  document.getElementById('syncC_fileInput').click();
}

async function syncLeerArchivo(e) {
  const file = e.target.files[0];
  if (!file) return;
  syncLog('📂 Leyendo archivo: ' + file.name);
  try {
    const txt = await file.text();
    const obj = JSON.parse(txt);
    syncAplicarDatos(obj);
  } catch(err) {
    syncLog('❌ Error al leer archivo: ' + err.message);
    toast('Archivo inválido', true);
  }
  e.target.value = '';
}

async function syncAplicarDatos(datos) {
  if (!datos || !datos.productos) {
    syncLog('❌ Archivo inválido — no contiene productos');
    toast('Datos inválidos', true);
    return;
  }

  const nP = datos.productos.length;
  const nV = (datos.historial || []).length;
  syncLog(`📦 Recibido: ${nP} productos · ${nV} ventas`);
  syncLog('💾 Guardando en base de datos…');

  try {
    productos = datos.productos;
    historial = datos.historial || [];
    if (Array.isArray(datos.ventasDiarias)) ventasDiarias = datos.ventasDiarias;

    await idbSetMany([
      ['vpos_productos',     productos],
      ['vpos_historial',     historial],
      ['vpos_ventasDiarias', ventasDiarias],
    ]);

    renderInv();
    renderHistorial();
    actualizarStats();

    syncLog('✅ ¡Sincronización completada!');
    setTimeout(() => {
      syncMostrarResultado(true,
        '¡Sincronización exitosa!',
        nP + ' productos y ' + nV + ' ventas importadas correctamente desde el Teléfono #1.'
      );
    }, 800);
  } catch(err) {
    syncLog('❌ Error al guardar: ' + err.message);
    syncMostrarResultado(false, 'Error al guardar', err.message);
  }
}

// Auto-detectar syncdata en URL al cargar
(function() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('syncdata')) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        navTo('pgSync');
        syncElegirRol('cliente');
      }, 1800);
    });
  }
})();

// ===== ANÁLISIS DE INVENTARIO Y VENTAS POR CATEGORÍA =====

let _invAnTabActual = 'stock';
let _invAnCatDetalle = null;

function invAnTab(tab) {
  _invAnTabActual = tab;
  document.getElementById('invAnPanelStock').style.display  = tab === 'stock'  ? '' : 'none';
  document.getElementById('invAnPanelVentas').style.display = tab === 'ventas' ? '' : 'none';
  document.getElementById('invTabStock').className  = tab === 'stock'  ? 'btn btn-green'  : 'btn btn-ghost';
  document.getElementById('invTabVentas').className = tab === 'ventas' ? 'btn btn-green'  : 'btn btn-ghost';
  document.getElementById('invTabStock').style.padding  = '8px 16px';
  document.getElementById('invTabVentas').style.padding = '8px 16px';
  document.getElementById('invTabStock').style.fontSize  = '13px';
  document.getElementById('invTabVentas').style.fontSize = '13px';
  renderInvAnalisis();
}

function invAnSetRango(dias) {
  const hoy = new Date();
  const hasta = hoy.toISOString().split('T')[0];
  document.getElementById('invAnHasta').value = hasta;
  if (dias === 0) {
    document.getElementById('invAnDesde').value = '';
  } else {
    const desde = new Date(hoy.getTime() - (dias - 1) * 86400000);
    document.getElementById('invAnDesde').value = desde.toISOString().split('T')[0];
  }
  renderInvAnalisis();
}

function poblarInvAnCat() {
  const sel = document.getElementById('invAnCat'); if (!sel) return;
  const cats = [...new Set(productos.map(p => p.cat || 'SIN CATEGORÍA'))].sort();
  const actual = sel.value;
  sel.innerHTML = '<option value="todas">📦 Todas las categorías</option>' +
    cats.map(c => `<option value="${c}"${c === actual ? ' selected' : ''}>${c}</option>`).join('');
}

function renderInvAnalisis() {
  poblarInvAnCat();
  const catFiltro = document.getElementById('invAnCat')?.value || 'todas';
  const desde     = document.getElementById('invAnDesde')?.value || '';
  const hasta     = document.getElementById('invAnHasta')?.value || '';

  // ── Filtrar productos ──────────────────────────────────────────────────
  const prods = catFiltro === 'todas' ? productos : productos.filter(p => (p.cat || 'SIN CATEGORÍA') === catFiltro);

  // ── Valor inventario actual agrupado por categoría ─────────────────────
  const invPorCat = {};
  prods.forEach(p => {
    const cat = p.cat || 'SIN CATEGORÍA';
    invPorCat[cat] ??= { cat, numProds: 0, stockTotal: 0, valorCompra: 0, valorVenta: 0 };
    invPorCat[cat].numProds++;
    invPorCat[cat].stockTotal  += (p.stock || 0);
    invPorCat[cat].valorCompra += (p.compra || 0) * (p.stock || 0);
    invPorCat[cat].valorVenta  += (p.venta  || 0) * (p.stock || 0);
  });
  const invRows = Object.values(invPorCat).sort((a, b) => b.valorVenta - a.valorVenta);
  const invTotProds     = invRows.reduce((s, r) => s + r.numProds, 0);
  const invTotStock     = invRows.reduce((s, r) => s + r.stockTotal, 0);
  const invTotCompra    = invRows.reduce((s, r) => s + r.valorCompra, 0);
  const invTotVenta     = invRows.reduce((s, r) => s + r.valorVenta, 0);
  const invTotGanancia  = invTotVenta - invTotCompra;

  // ── Ventas del período agrupadas por categoría ─────────────────────────
  const desdeTs = desde ? Date.parse(desde + 'T00:00:00') : 0;
  const hastaTs = hasta ? Date.parse(hasta + 'T23:59:59') : Date.now();

  const ventasPorCat = {};
  historial.forEach(v => {
    const ts = v.ts || (v.fechaISO ? Date.parse(v.fechaISO) : 0);
    if (!ts || ts < desdeTs || ts > hastaTs) return;
    (v.items || []).forEach(it => {
      const catItem = it.cat || (() => {
        const prod = productos.find(p => String(p.id) === String(it.id));
        return prod ? (prod.cat || 'SIN CATEGORÍA') : 'SIN CATEGORÍA';
      })();
      if (catFiltro !== 'todas' && catItem !== catFiltro) return;
      ventasPorCat[catItem] ??= { cat: catItem, prodsSet: new Set(), unidades: 0, total: 0, detalle: {} };
      ventasPorCat[catItem].prodsSet.add(it.nom || '');
      ventasPorCat[catItem].unidades += Number(it.cant || 0);
      ventasPorCat[catItem].total    += Number(it.cant || 0) * Number(it.precio || 0);
      const nomKey = it.nom || '?';
      ventasPorCat[catItem].detalle[nomKey] ??= { nom: nomKey, cant: 0, total: 0 };
      ventasPorCat[catItem].detalle[nomKey].cant  += Number(it.cant || 0);
      ventasPorCat[catItem].detalle[nomKey].total += Number(it.cant || 0) * Number(it.precio || 0);
    });
  });
  const ventRows = Object.values(ventasPorCat).sort((a, b) => b.total - a.total);
  const ventTotUnd   = ventRows.reduce((s, r) => s + r.unidades, 0);
  const ventTotTotal = ventRows.reduce((s, r) => s + r.total, 0);

  // ── Resumen rápido ─────────────────────────────────────────────────────
  const resumen = document.getElementById('invAnResumen');
  if (resumen) resumen.innerHTML = `
    <div class="stat-box"><div class="s-lbl">📦 Productos Activos</div><div class="s-val" style="font-size:20px;">${invTotProds}</div></div>
    <div class="stat-box"><div class="s-lbl">🔢 Unidades en Stock</div><div class="s-val" style="font-size:20px;">${invTotStock}</div></div>
    <div class="stat-box" style="border-color:#f59e0b;"><div class="s-lbl" style="color:#d97706;">💰 Valor Inventario</div><div class="s-val" style="color:#d97706;font-size:18px;">$${invTotVenta.toFixed(2)}</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">precio venta</div></div>
    <div class="stat-box" style="border-color:var(--green);background:var(--green-light);"><div class="s-lbl" style="color:var(--green-dark);">🛒 Vendido en Período</div><div class="s-val" style="font-size:18px;">$${ventTotTotal.toFixed(2)}</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${ventTotUnd} unidades</div></div>
  `;

  // ── Tabla inventario ───────────────────────────────────────────────────
  const tbodyStock = document.getElementById('tbodyInvAnStock');
  if (tbodyStock) {
    tbodyStock.innerHTML = invRows.length ? invRows.map(r => {
      const ganancia = r.valorVenta - r.valorCompra;
      return `<tr>
        <td class="td-bold">${r.cat}</td>
        <td style="text-align:center;" class="mono">${r.numProds}</td>
        <td style="text-align:right;" class="mono">${r.stockTotal}</td>
        <td style="text-align:right;" class="mono" style="color:var(--text-muted);">$${r.valorCompra.toFixed(2)}</td>
        <td style="text-align:right;" class="mono td-green">$${r.valorVenta.toFixed(2)}</td>
        <td style="text-align:right;" class="mono" style="color:var(--green);">$${ganancia.toFixed(2)}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="6"><div class="empty"><span class="empty-icon">📦</span>Sin productos</div></td></tr>`;
    const tfootStock = document.getElementById('tfootInvAnStock');
    if (tfootStock && invRows.length) tfootStock.innerHTML = `<tr style="background:var(--green-light);border-top:2px solid var(--border-mid);">
      <td class="td-bold" style="font-size:13px;padding:10px 12px;">TOTAL</td>
      <td class="mono" style="text-align:center;padding:10px 12px;">${invTotProds}</td>
      <td class="mono" style="text-align:right;padding:10px 12px;">${invTotStock}</td>
      <td class="mono" style="text-align:right;padding:10px 12px;color:var(--text-muted);">$${invTotCompra.toFixed(2)}</td>
      <td class="mono td-green" style="text-align:right;font-weight:900;padding:10px 12px;font-size:14px;">$${invTotVenta.toFixed(2)}</td>
      <td class="mono" style="text-align:right;font-weight:900;padding:10px 12px;color:var(--green);">$${invTotGanancia.toFixed(2)}</td>
    </tr>`;
  }

  // ── Tabla ventas del período ───────────────────────────────────────────
  const periodoStr = desde && hasta ? `del ${desde} al ${hasta}` : desde ? `desde ${desde}` : hasta ? `hasta ${hasta}` : 'todo el historial';
  const infoEl = document.getElementById('invAnVentasInfo');
  if (infoEl) infoEl.textContent = `📆 Ventas ${periodoStr}${catFiltro !== 'todas' ? ' · ' + catFiltro : ''}`;

  const tbodyVentas = document.getElementById('tbodyInvAnVentas');
  if (tbodyVentas) {
    tbodyVentas.innerHTML = ventRows.length ? ventRows.map(r => `<tr style="cursor:pointer;" onclick="invAnVerDetalle('${r.cat.replace(/'/g,"\\'")}')" title="Clic para ver detalle">
      <td class="td-bold">${r.cat} <span style="font-size:11px;color:var(--text-muted);font-weight:700;">▸ ver detalle</span></td>
      <td style="text-align:center;" class="mono">${r.prodsSet.size}</td>
      <td style="text-align:center;" class="mono">${r.unidades}</td>
      <td style="text-align:right;" class="mono td-green">$${r.total.toFixed(2)}</td>
    </tr>`).join('') : `<tr><td colspan="4"><div class="empty"><span class="empty-icon">📊</span>Sin ventas en este período</div></td></tr>`;

    const tfootVentas = document.getElementById('tfootInvAnVentas');
    if (tfootVentas && ventRows.length) tfootVentas.innerHTML = `<tr style="background:var(--green-light);border-top:2px solid var(--border-mid);">
      <td class="td-bold" style="font-size:13px;padding:10px 12px;">TOTAL</td>
      <td class="mono" style="text-align:center;padding:10px 12px;">${ventRows.reduce((s,r)=>s+r.prodsSet.size,0)}</td>
      <td class="mono" style="text-align:center;padding:10px 12px;">${ventTotUnd}</td>
      <td class="mono td-green" style="text-align:right;font-weight:900;padding:10px 12px;font-size:14px;">$${ventTotTotal.toFixed(2)}</td>
    </tr>`;
  }

  // Ocultar detalle al cambiar filtros
  _invAnCatDetalle = null;
  const det = document.getElementById('invAnDetalle');
  if (det) det.style.display = 'none';

  // Guardar ventasPorCat en variable temporal para usarla en ver detalle
  window._invAnVentasPorCat = ventasPorCat;
}

function invAnVerDetalle(cat) {
  _invAnCatDetalle = cat;
  const data = (window._invAnVentasPorCat || {})[cat];
  const det  = document.getElementById('invAnDetalle');
  const tit  = document.getElementById('invAnDetalleTitulo');
  const tbody = document.getElementById('tbodyInvAnDetalle');
  if (!det || !tit || !tbody) return;
  if (!data) { det.style.display = 'none'; return; }

  const items = Object.values(data.detalle).sort((a, b) => b.total - a.total);
  tit.textContent = `📦 Detalle de "${cat}" — ${items.length} productos`;
  tbody.innerHTML = items.map(it => `<tr>
    <td class="td-bold">${it.nom}</td>
    <td style="text-align:center;" class="mono">${it.cant}</td>
    <td style="text-align:right;" class="mono td-green">$${it.total.toFixed(2)}</td>
  </tr>`).join('');
  det.style.display = '';
  det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function generarPDFInventario() {
  if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
    toast('PDF no disponible aún, espera un momento', true); return;
  }
  const { jsPDF } = window.jspdf || window;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const catFiltro = document.getElementById('invAnCat')?.value || 'todas';
  const desde     = document.getElementById('invAnDesde')?.value || '';
  const hasta     = document.getElementById('invAnHasta')?.value || '';

  // Colores corporativos
  const VERDE = [22, 163, 74], VERDE_LIGHT = [240, 253, 244], VERDE_DARK = [21, 128, 61];
  const AZUL  = [29, 78, 216], GRIS = [100, 116, 139], NEGRO = [15, 23, 42];

  // ── Encabezado ────────────────────────────────────────────────────────
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  doc.text('Despensa Económica — Reporte de Inventario', 14, 11);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  const catLabel  = catFiltro === 'todas' ? 'Todas las categorías' : catFiltro;
  const rangoLabel = desde && hasta ? `${desde} al ${hasta}` : desde ? `Desde ${desde}` : hasta ? `Hasta ${hasta}` : 'Todo el historial';
  doc.text(`Categoría: ${catLabel}   |   Período de ventas: ${rangoLabel}`, 14, 19);
  doc.text(`Generado: ${new Date().toLocaleString('es-SV')}`, 14, 25);

  let y = 34;

  // ── Sección 1: Inventario actual ──────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...VERDE_DARK);
  doc.text('INVENTARIO ACTUAL POR CATEGORÍA', 14, y); y += 6;

  const prods = catFiltro === 'todas' ? productos : productos.filter(p => (p.cat || 'SIN CATEGORÍA') === catFiltro);
  const invPorCat = {};
  prods.forEach(p => {
    const cat = p.cat || 'SIN CATEGORÍA';
    invPorCat[cat] ??= { cat, numProds: 0, stockTotal: 0, valorCompra: 0, valorVenta: 0 };
    invPorCat[cat].numProds++;
    invPorCat[cat].stockTotal  += (p.stock || 0);
    invPorCat[cat].valorCompra += (p.compra || 0) * (p.stock || 0);
    invPorCat[cat].valorVenta  += (p.venta  || 0) * (p.stock || 0);
  });
  const invRows = Object.values(invPorCat).sort((a, b) => b.valorVenta - a.valorVenta);
  const invTotCompra = invRows.reduce((s, r) => s + r.valorCompra, 0);
  const invTotVenta  = invRows.reduce((s, r) => s + r.valorVenta, 0);

  doc.autoTable({
    head: [['Categoría', 'Productos', 'Stock', 'Valor Compra', 'Valor Venta', 'Ganancia Est.']],
    body: invRows.map(r => [r.cat, r.numProds, r.stockTotal, `$${r.valorCompra.toFixed(2)}`, `$${r.valorVenta.toFixed(2)}`, `$${(r.valorVenta - r.valorCompra).toFixed(2)}`]),
    foot: [['TOTAL', invRows.reduce((s,r)=>s+r.numProds,0), invRows.reduce((s,r)=>s+r.stockTotal,0), `$${invTotCompra.toFixed(2)}`, `$${invTotVenta.toFixed(2)}`, `$${(invTotVenta-invTotCompra).toFixed(2)}`]],
    startY: y,
    styles: { fontSize: 9, textColor: NEGRO },
    headStyles: { fillColor: VERDE_LIGHT, textColor: VERDE_DARK, fontSize: 9 },
    footStyles: { fillColor: VERDE_LIGHT, textColor: VERDE_DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 255, 249] },
    columnStyles: { 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right',fontStyle:'bold',textColor:VERDE} },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Sección 2: Ventas del período ─────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 18; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...VERDE_DARK);
  doc.text(`VENTAS DEL PERÍODO: ${rangoLabel}`, 14, y); y += 6;

  const desdeTs = desde ? Date.parse(desde + 'T00:00:00') : 0;
  const hastaTs = hasta ? Date.parse(hasta + 'T23:59:59') : Date.now();
  const ventasPorCat = {};
  historial.forEach(v => {
    const ts = v.ts || (v.fechaISO ? Date.parse(v.fechaISO) : 0);
    if (!ts || ts < desdeTs || ts > hastaTs) return;
    (v.items || []).forEach(it => {
      const catItem = it.cat || (() => { const prod = productos.find(p => String(p.id) === String(it.id)); return prod ? (prod.cat || 'SIN CATEGORÍA') : 'SIN CATEGORÍA'; })();
      if (catFiltro !== 'todas' && catItem !== catFiltro) return;
      ventasPorCat[catItem] ??= { cat: catItem, prodsSet: new Set(), unidades: 0, total: 0, detalle: {} };
      ventasPorCat[catItem].prodsSet.add(it.nom || '');
      ventasPorCat[catItem].unidades += Number(it.cant || 0);
      ventasPorCat[catItem].total    += Number(it.cant || 0) * Number(it.precio || 0);
      const nomKey = it.nom || '?';
      ventasPorCat[catItem].detalle[nomKey] ??= { nom: nomKey, cant: 0, total: 0 };
      ventasPorCat[catItem].detalle[nomKey].cant  += Number(it.cant || 0);
      ventasPorCat[catItem].detalle[nomKey].total += Number(it.cant || 0) * Number(it.precio || 0);
    });
  });
  const ventRows = Object.values(ventasPorCat).sort((a, b) => b.total - a.total);
  const ventTotUnd   = ventRows.reduce((s, r) => s + r.unidades, 0);
  const ventTotTotal = ventRows.reduce((s, r) => s + r.total, 0);

  if (!ventRows.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text('Sin ventas registradas en este período.', 14, y); y += 8;
  } else {
    doc.autoTable({
      head: [['Categoría', 'Prods. Distintos', 'Unidades', 'Total Vendido']],
      body: ventRows.map(r => [r.cat, r.prodsSet.size, r.unidades, `$${r.total.toFixed(2)}`]),
      foot: [['TOTAL', ventRows.reduce((s,r)=>s+r.prodsSet.size,0), ventTotUnd, `$${ventTotTotal.toFixed(2)}`]],
      startY: y,
      styles: { fontSize: 9, textColor: NEGRO },
      headStyles: { fillColor: [219, 234, 254], textColor: AZUL, fontSize: 9 },
      footStyles: { fillColor: [219, 234, 254], textColor: AZUL, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: { 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'right',fontStyle:'bold',textColor:VERDE} },
    });
    y = doc.lastAutoTable.finalY + 10;

    // Detalle por categoría
    ventRows.forEach(r => {
      if (y > 250) { doc.addPage(); y = 18; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...VERDE_DARK);
      doc.text(`▸ ${r.cat}  —  $${r.total.toFixed(2)} · ${r.unidades} uds`, 14, y); y += 4;
      const items = Object.values(r.detalle).sort((a, b) => b.total - a.total);
      doc.autoTable({
        head: [['Producto', 'Unidades', 'Total']],
        body: items.map(it => [it.nom, it.cant, `$${it.total.toFixed(2)}`]),
        startY: y,
        styles: { fontSize: 8, textColor: NEGRO },
        headStyles: { fillColor: VERDE_LIGHT, textColor: VERDE_DARK, fontSize: 8 },
        columnStyles: { 1:{halign:'center'}, 2:{halign:'right',fontStyle:'bold'} },
        margin: { left: 18, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 7;
    });
  }

  const nombreArchivo = `Inventario_${catFiltro !== 'todas' ? catFiltro + '_' : ''}${desde || 'inicio'}_${hasta || 'hoy'}.pdf`;
  doc.save(nombreArchivo);
  toast(`✓ PDF de inventario generado`);
}

// El análisis de inventario se inicializa en renderPagina()