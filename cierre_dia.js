// =====================================================================
//  📋 CIERRE DIARIO DE CAJA — v8
// =====================================================================
(function _estilosCierre() {
  if (document.getElementById('cierreDiaStyles')) return;
  const s = document.createElement('style');
  s.id = 'cierreDiaStyles';
  s.textContent = `
    #pgCierreDia { padding:0 0 100px; }
    /* Hero */
    .cd-hero { background:linear-gradient(135deg,#0c4a6e,#075985,#0369a1); padding:20px 18px 16px; margin-bottom:16px; }
    .cd-hero-top { display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px; }
    .cd-hero-title { font-size:18px;font-weight:900;color:#fff;font-family:Nunito,sans-serif; }
    .cd-hero-fecha { font-size:12px;font-weight:900;color:rgba(255,255,255,0.7);font-family:Nunito,sans-serif; }
    .cd-fecha-inp { padding:6px 10px;background:rgba(255,255,255,0.12);border:1.5px solid rgba(255,255,255,0.25);border-radius:9px;color:#fff;font-size:13px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;outline:none; }
    .cd-fecha-inp::-webkit-calendar-picker-indicator { filter:invert(1); }
    .cd-hero-stats { display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }
    .cd-hstat { background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:10px 12px; }
    .cd-hstat-lbl { font-size:10px;font-weight:900;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.4px;font-family:Nunito,sans-serif;margin-bottom:3px; }
    .cd-hstat-val { font-size:16px;font-weight:900;color:#fff;font-family:Nunito,sans-serif;line-height:1; }
    /* Body */
    .cd-body { padding:0 14px;display:flex;flex-direction:column;gap:16px; }
    .cd-panel { background:var(--surface2);border:1.5px solid var(--border);border-radius:16px;overflow:hidden; }
    .cd-panel-header { display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface);flex-wrap:wrap;gap:6px; }
    .cd-panel-icon { width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0; }
    .cd-panel-title { font-size:13px;font-weight:900;color:var(--text);font-family:Nunito,sans-serif;flex:1;min-width:120px; }
    .cd-panel-body { padding:14px 16px; }
    .cd-montos-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px; }
    @media(min-width:480px){ .cd-montos-grid { grid-template-columns:repeat(3,1fr); } }
    .cd-field label { display:block;font-size:10px;font-weight:900;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;font-family:Nunito,sans-serif;margin-bottom:4px; }
    .cd-inp { width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;color:var(--text);background:var(--surface);box-sizing:border-box;outline:none;transition:border-color 0.2s; }
    .cd-inp:focus { border-color:#0369a1;background:#fff; }
    .cd-inp.big { font-size:20px;padding:12px 14px; }
    .cd-total-row { display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:10px;font-family:Nunito,sans-serif;margin-top:8px;background:#f0f9ff; }
    .cd-total-row span:first-child { font-size:12px;font-weight:900;color:#0369a1; }
    .cd-total-row span:last-child  { font-size:17px;font-weight:900;color:#0369a1; }
    .cd-total-row.green span { color:#15803d!important; } .cd-total-row.green { background:#f0fdf4; }
    .cd-total-row.amber span { color:#b45309!important; } .cd-total-row.amber { background:#fffbeb; }
    .cd-total-row.red   span { color:#dc2626!important; } .cd-total-row.red   { background:#fef2f2; }
    .cd-total-row.purple span { color:#7c3aed!important; } .cd-total-row.purple { background:#faf5ff; }
    .cd-sep { font-size:10px;font-weight:900;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;margin-top:14px; }
    .cd-btn-update { padding:7px 12px;background:rgba(3,105,161,0.1);border:1.5px solid rgba(3,105,161,0.3);border-radius:9px;font-size:11px;font-weight:900;font-family:Nunito,sans-serif;color:#0369a1;cursor:pointer;transition:all 0.15s;white-space:nowrap; }
    .cd-btn-update:hover { background:rgba(3,105,161,0.18); }
    .cd-btn-update.green { background:rgba(22,163,74,0.1);border-color:rgba(22,163,74,0.3);color:#15803d; }
    .cd-btn-update.green:hover { background:rgba(22,163,74,0.18); }
    .cd-btn-update.red { background:rgba(220,38,38,0.08);border-color:rgba(220,38,38,0.3);color:#dc2626; }
    .cd-item-list { display:flex;flex-direction:column;gap:6px;margin-bottom:10px; }
    .cd-item-row { background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 12px; }
    .cd-item-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:4px; }
    .cd-item-desc { font-size:12px;font-weight:900;color:var(--text);font-family:Nunito,sans-serif; }
    .cd-item-monto { font-size:13px;font-weight:900;font-family:Nunito,sans-serif; }
    .cd-item-del { background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:2px 5px;border-radius:5px; }
    .cd-item-del:hover { background:rgba(220,38,38,0.1);color:#dc2626; }
    .cd-item-denoms { display:flex;flex-wrap:wrap;gap:4px;margin-top:4px; }
    .cd-item-denom { font-size:10px;font-weight:700;font-family:Nunito,sans-serif;background:#fef2f2;border:1px solid #fca5a5;border-radius:5px;padding:2px 7px;color:#dc2626; }
    .cd-item-denom.inv { background:#dcfce7;border-color:#86efac;color:#15803d; }
    .cd-btn-add { padding:10px 14px;background:#0369a1;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;white-space:nowrap;transition:all 0.15s; }
    .cd-btn-add:hover { background:#075985; }
    .cd-cambio-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px; }
    @media(min-width:480px){ .cd-cambio-grid { grid-template-columns:repeat(3,1fr); } }
    .cd-cambio-item { background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:10px 11px; }
    .cd-cambio-lbl { font-size:10px;font-weight:900;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;font-family:Nunito,sans-serif;margin-bottom:6px; }
    .cd-add-row { display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end; }
    /* Tabla mensual */
    .cd-mes-tabla { width:100%;border-collapse:collapse;font-family:Nunito,sans-serif;font-size:12px; }
    .cd-mes-tabla th { background:#e0f2fe;color:#0369a1;font-weight:900;padding:7px 10px;text-align:left;border-bottom:2px solid #bae6fd; }
    .cd-mes-tabla td { padding:7px 10px;border-bottom:1px solid var(--border);color:var(--text);font-weight:700; }
    .cd-mes-tabla tr:last-child td { border-bottom:none; }
    .cd-mes-tabla tr:hover td { background:#f0f9ff; }
    /* Captura — en pantalla es responsive, al descargar es 1080x1920 */
    .cd-cap-wrap { width:100%;margin-bottom:12px; }
    .cd-resumen-captura {
      background:#fff;border:3px solid #0369a1;font-family:Nunito,sans-serif;
      width:100%;box-sizing:border-box;
    }
    .cd-cap-inner { padding:24px 20px;box-sizing:border-box; }
    .cd-cap-title { font-size:22px;font-weight:900;color:#0c4a6e;text-align:center;margin-bottom:4px; }
    .cd-cap-fecha { font-size:13px;font-weight:700;color:#0369a1;text-align:center;margin-bottom:18px; }
    /* Divisor AZUL MARCADO entre secciones grandes */
    .cd-cap-divider { height:3px;background:#0369a1;border-radius:2px;margin:16px 0;opacity:1; }
    .cd-cap-2col { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px; }
    @media(max-width:500px){ .cd-cap-2col { grid-template-columns:1fr; } }
    /* Borde azul más marcado en cada columna */
    .cd-cap-col { border:2px solid #0369a1;border-radius:10px;padding:12px; }
    .cd-cap-section-title { font-size:11px;font-weight:900;color:#fff;background:#0369a1;border-radius:6px;padding:5px 8px;margin-bottom:8px;text-align:center;text-transform:uppercase;letter-spacing:0.5px; }
    /* Líneas tipo cuaderno — azules visibles entre cada fila */
    .cd-cap-row { display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;color:#1e3a5f;padding:5px 0;border-bottom:2px solid #bae6fd; }
    .cd-cap-row:last-child { border-bottom:none; }
    /* Línea azul marcada para totales de sección */
    .cd-cap-row.total { font-size:14px;font-weight:900;border-top:3px solid #0369a1;border-bottom:none;margin-top:4px;padding-top:6px;background:#f0f9ff;border-radius:0 0 6px 6px;padding-left:4px;padding-right:4px; }
    .cd-cap-row.grand { font-size:14px;font-weight:900;color:#0c4a6e;background:#e0f2fe;border-radius:8px;padding:10px 12px;margin-top:6px;border-bottom:none;border:2px solid #0369a1; }
    /* Tamaños 1080×1920 SOLO al descargar — aplicados vía JS */
    .cd-print-mode .cd-resumen-captura { width:1080px!important; }
    .cd-print-mode .cd-cap-inner { padding:56px 64px!important; }
    .cd-print-mode .cd-cap-title { font-size:56px!important; }
    .cd-print-mode .cd-cap-fecha { font-size:28px!important; }
    .cd-print-mode .cd-cap-2col { gap:24px!important;margin-bottom:24px!important; }
    .cd-print-mode .cd-cap-col { padding:22px!important;border-width:2px!important; }
    .cd-print-mode .cd-cap-section-title { font-size:19px!important;padding:7px 14px!important;margin-bottom:12px!important; }
    .cd-print-mode .cd-cap-row { font-size:21px!important;padding:7px 0!important;border-bottom-width:1.5px!important; }
    .cd-print-mode .cd-cap-row.total { font-size:24px!important;border-top-width:3px!important;margin-top:6px!important;padding-top:10px!important; }
    .cd-print-mode .cd-cap-row.grand { font-size:26px!important;padding:14px 18px!important;margin-top:8px!important; }
    .cd-print-mode .cd-cap-divider { height:4px!important;margin:28px 0!important; }
    .cd-print-mode .cd-cap-col { padding:28px!important; }
    .cd-print-mode #capAyerWrap .cd-cap-row,
    .cd-print-mode .cd-cap-col .cd-cap-row { font-size:22px!important;padding:8px 0!important; }
    .cd-print-mode #capAyerWrap .cd-cap-row.total,
    .cd-print-mode .cd-cap-col .cd-cap-row.total { font-size:26px!important; }
    .val-pos { color:#15803d; } .val-neg { color:#dc2626; } .val-warn { color:#b45309; }
    .val-blue { color:#0369a1; } .val-purple { color:#7c3aed; }
    .btn-cd-captura { width:100%;padding:14px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:13px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(22,163,74,0.3);transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:8px; }
    .btn-cd-captura:hover { transform:translateY(-1px); }
    .btn-cd-captura:disabled { opacity:0.6;cursor:wait;transform:none; }
    .btn-cd-pdf { width:100%;padding:13px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;border-radius:13px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(220,38,38,0.3);transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px; }
    .btn-cd-pdf:hover { transform:translateY(-1px); }
    .cd-nota-area { width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:700;font-family:Nunito,sans-serif;color:var(--text);background:var(--surface);box-sizing:border-box;outline:none;resize:vertical;min-height:70px; }
  `;
  document.head.appendChild(s);
})();

// ══ Estado ══════════════════════════════════════════════════════════════
let _cdFecha  = new Date().toISOString().split('T')[0];
let _cdGastos = [];   // [{id,desc,montos,total,inventario:{costo,ganancia}}]
let _cdDeudas = [];
let _cdCambiosAplicados = []; // historial de cambios para captura
let _cdVentaSnapshot = null;  // última venta aplicada
let _cdSaldoAyerCache = null; // saldo del día anterior para captura
let _cdVentaAyerCache = null; // venta del día anterior para captura (Fix 4+8)
// Registro mensual (persiste en IDB)
let _cdMesData = {
  saldoInicio: 0,      // saldo en efectivo al inicio del mes
  inventarioInicial: 0,// valor del inventario al inicio del mes
  ventas: [],          // [{fecha,total,alquiler}]
  gastos: [],          // [{fecha,desc,total,tipoInv,costoInv,gananciaInv}]
};

const _CD_DENOMS = [
  {id:'Billetes',label:'💵 Billetes'},{id:'Monedas',label:'🪙 M. Dólar'},
  {id:'Coras',label:'🔵 Coras'},{id:'C10',label:'🟡 10 cts'},
  {id:'C05',label:'🟤 5 cts'},{id:'C01',label:'⚪ 1 cto'},
];

function _cdFmtFecha(iso){if(!iso)return'—';const[y,m,d]=iso.split('-');const dN=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];return`${dN[new Date(iso+'T12:00:00').getDay()]} ${d}/${m}/${y.slice(2)}`;}
function _cdUID(){return'cd_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);}
function _cdV(id){return parseFloat(document.getElementById(id)?.value||'0')||0;}
function _cdSet(id,v,clearZero=false){const e=document.getElementById(id);if(e&&v!=null){const n=Number(v);e.value=(clearZero&&n===0)?'':n.toFixed(2);}}
function _cdTxt(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function _cdSumArr(arr){return arr.reduce((s,x)=>s+Number(x.total||0),0);}
function _cdFmt(n){return'$'+n.toFixed(2);}
function _cdLeerMontos(px){return{Billetes:_cdV(px+'Billetes'),Monedas:_cdV(px+'Monedas'),Coras:_cdV(px+'Coras'),C10:_cdV(px+'C10'),C05:_cdV(px+'C05'),C01:_cdV(px+'C01')};}
function _cdTotalM(m){return(m.Billetes||0)+(m.Monedas||0)+(m.Coras||0)+(m.C10||0)+(m.C05||0)+(m.C01||0);}
function _cdMesKey(){return _cdFecha.substring(0,7);}

function _cdBloqueMontosHTML(px){
  return`<div class="cd-montos-grid">
    <div class="cd-field"><label>💵 Billetes ($)</label><input class="cd-inp" type="number" id="${px}Billetes" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()"></div>
    <div class="cd-field"><label>🪙 M. Dólar ($)</label><input class="cd-inp" type="number" id="${px}Monedas" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()"></div>
    <div class="cd-field"><label>🔵 Coras ($)</label><input class="cd-inp" type="number" id="${px}Coras" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()"></div>
    <div class="cd-field"><label>🟡 10 centavos ($)</label><input class="cd-inp" type="number" id="${px}C10" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()"></div>
    <div class="cd-field"><label>🟤 5 centavos ($)</label><input class="cd-inp" type="number" id="${px}C05" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()"></div>
    <div class="cd-field"><label>⚪ 1 centavo ($)</label><input class="cd-inp" type="number" id="${px}C01" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()"></div>
  </div>`;
}

// ══ Persistencia IDB ════════════════════════════════════════════════════
async function _cdCargarMes(){
  const r = await _cdSbLoad('cierreMes_'+_cdMesKey());
  if(r) _cdMesData = {...{saldoInicio:0,inventarioInicial:0,ventas:[],gastos:[]}, ...r};
  else _cdMesData = {saldoInicio:0,inventarioInicial:0,ventas:[],gastos:[]};
}
async function _cdGuardarMes(){
  await _cdSbSave('cierreMes_'+_cdMesKey(), _cdMesData);
  _cdSubirMesSupabase();
  if(typeof syncAhora==='function') syncAhora('todo');
}
// Saldo de ayer → Supabase primero
async function _cdCargarSaldoAyer(){
  const ayer=new Date(new Date(_cdFecha).getTime()-86400000).toISOString().split('T')[0];
  return await _cdSbLoad('cierreSaldo_'+ayer);
}
async function _cdGuardarSaldoHoy(saldo){
  await _cdSbSave('cierreSaldo_'+_cdFecha, saldo);
  if(typeof syncAhora==='function') syncAhora('todo');
}

// ══ Supabase ════════════════════════════════════════════════════════════
async function _cdSubirMesSupabase(){
  if(typeof _sbPost!=='function'||typeof _getTiendaId!=='function')return;
  try{
    await _sbPost('cierre_mes',{
      id:_getTiendaId()+'_'+_cdMesKey(),
      tienda_id:_getTiendaId(),
      mes:_cdMesKey(),
      datos:JSON.stringify(_cdMesData),
      updated_at:new Date().toISOString()
    },true);
  }catch(e){console.warn('[CD-MES]',e.message);}
}
async function _cdSubirCierreSupabase(cierre){
  if(typeof _sbPost!=='function'||typeof _getTiendaId!=='function')return false;
  try{
    await _sbPost('cierre_diario',{
      id:_getTiendaId()+'_'+cierre.fecha,
      tienda_id:_getTiendaId(),
      fecha:cierre.fecha,
      datos:JSON.stringify(cierre),
      updated_at:new Date().toISOString()
    },true);
    return true;
  }catch(e){console.warn('[CD]',e.message);return false;}
}

// ══ Render principal ════════════════════════════════════════════════════
async function renderCierreDia(pgId){
  pgId=pgId||'pgCierreDia';
  const pg=document.getElementById(pgId);if(!pg)return;
  await _cdCargarMes();
  const saldoAyer=await _cdCargarSaldoAyer();
  _cdSaldoAyerCache = saldoAyer;
  const ventaAyer=await _cdCargarVentaAyer();
  _cdVentaAyerCache = ventaAyer;
  // Cargar queda persistido (sobrevive reinicio de mes)
  const quedaPersistida=await _idbCargarQueda();
  const esHoy=_cdFecha===new Date().toISOString().split('T')[0];
  let vSug=0;
  if(esHoy&&typeof totalReporte==='function'&&typeof ventasDia!=='undefined')vSug=totalReporte(ventasDia);

  const cambioGrid=_CD_DENOMS.map(d=>`
    <div class="cd-cambio-item">
      <div class="cd-cambio-lbl">Sale de ${d.label}</div>
      <div class="cd-field" style="margin-bottom:6px;"><label>Monto ($)</label><input class="cd-inp" type="number" id="cdCambioSale${d.id}" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()"></div>
      <div class="cd-field"><label>Entra en</label><select class="cd-inp" id="cdCambioHacia${d.id}" onchange="_cdActualizarStats()" style="padding:9px 10px;">${_CD_DENOMS.filter(x=>x.id!==d.id).map(x=>`<option value="${x.id}">${x.label}</option>`).join('')}</select></div>
    </div>`).join('');

  // Tabla mensual
  const totalVentasMes=_cdMesData.ventas.reduce((s,v)=>s+v.total,0);
  const totalGastosMes=_cdMesData.gastos.reduce((s,g)=>s+g.total,0);
  const totalAlquilerMes=_cdMesData.ventas.reduce((s,v)=>s+(v.alquiler||0),0);
  const totalInvCosto=_cdMesData.gastos.filter(g=>g.tipoInv).reduce((s,g)=>s+(g.costoInv||0),0);
  const totalInvGanancia=_cdMesData.gastos.filter(g=>g.tipoInv).reduce((s,g)=>s+(g.gananciaInv||0),0);
  const saldoEfec=(_cdMesData.saldoInicio||0);
  const invIni=(_cdMesData.inventarioInicial||0);
  const ventasACajaMes=totalVentasMes-totalAlquilerMes;
  // Caja final = efectivo inicio - gastos + ventas a caja
  // (las ventas vienen del inventario, no se suman al inventario)
  const cajaFinal=saldoEfec-totalGastosMes+ventasACajaMes;
  // Inventario final = inventario inicio - costo de lo que se vendió + ganancia de compras al inventario
  // El costo vendido = ventas totales (el inventario se convirtió en esas ventas)
  // La ganancia de inventario = lo que se sumó al inv por recompra con ganancia
  const costoVendido=totalVentasMes; // lo que salió del inventario este mes
  const invFinal=Math.max(0, invIni - costoVendido + totalInvGanancia);
  // saldoTeorico es para mostrar en resumen (caja + inventario)
  const saldoTeorico=cajaFinal; // solo caja, inventario se muestra por separado

  pg.innerHTML=`
    <div class="cd-hero">
      <div class="cd-hero-top">
        <div><div class="cd-hero-title">📋 Cierre Diario de Caja</div><div class="cd-hero-fecha" id="cdHeroFechaLbl">${_cdFmtFecha(_cdFecha)}</div></div>
        <input type="date" class="cd-fecha-inp" id="cdFechaInput" value="${_cdFecha}" onchange="_cdCambiarFecha(this.value)">
      </div>
      <div class="cd-hero-stats">
        <div class="cd-hstat"><div class="cd-hstat-lbl">💹 Venta del Día</div><div class="cd-hstat-val" id="cdStatVenta">$0.00</div></div>
        <div class="cd-hstat"><div class="cd-hstat-lbl">📤 Gastos</div><div class="cd-hstat-val" id="cdStatGastos">$0.00</div></div>
        <div class="cd-hstat"><div class="cd-hstat-lbl">🏦 Saldo Caja</div><div class="cd-hstat-val" id="cdStatSaldo">$0.00</div></div>
      </div>
    </div>
    <div class="cd-body">

      <!-- VENTA DEL DÍA -->
      <div class="cd-panel">
        <div class="cd-panel-header">
          <div class="cd-panel-icon" style="background:#dbeafe;">💹</div>
          <div class="cd-panel-title">Venta del Día</div>
          <button class="cd-btn-update green" onclick="_cdAplicarVentaASaldo()">🔄 Actualizar Caja</button>
        </div>
        <div class="cd-panel-body">
          <div class="cd-field" style="margin-bottom:12px;">
            <label>Total vendido ($)</label>
            <input class="cd-inp big" type="number" id="cdVentaTotal" min="0" step="0.01" placeholder="0.00" value="${vSug>0?vSug.toFixed(2):''}" oninput="_cdActualizarStats()">
            ${vSug>0?`<div style="font-size:11px;color:#0369a1;font-weight:700;margin-top:4px;">💡 Del POS: $${vSug.toFixed(2)}</div>`:''}
          </div>
          <div class="cd-field" style="margin-bottom:12px;">
            <label>🏘 Menos alquiler de hoy ($) — sale de billetes</label>
            <input class="cd-inp" type="number" id="cdVentaAlquilerHoy" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()">
          </div>
          <div class="cd-sep">Desglose del dinero recibido</div>
          ${_cdBloqueMontosHTML('cdVenta')}
          <div id="cdVentaAlqMsg" style="display:none;margin-top:8px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11px;font-weight:700;color:#b45309;font-family:Nunito,sans-serif;"></div>
          <div class="cd-total-row"><span>Suma desglose</span><span id="cdVentaDesgloseTotal">$0.00</span></div>
        </div>
      </div>

      <!-- SALDO QUE QUEDÓ AYER -->
      ${saldoAyer ? `
      <div class="cd-panel">
        <div class="cd-panel-header">
          <div class="cd-panel-icon" style="background:#f5f3ff;">📅</div>
          <div class="cd-panel-title">Saldo que Quedó Ayer</div>
          <button class="cd-btn-update" onclick="_cdCargarSaldoAyerEnCaja()" title="Cargar saldo de ayer como saldo inicial de hoy">⬆ Usar como saldo inicial</button>
        </div>
        <div class="cd-panel-body">
          <div style="font-size:11px;color:#7c3aed;font-weight:700;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-family:Nunito,sans-serif;">
            El saldo que quedó en caja al cerrar el día anterior (${_cdFmtFecha(new Date(new Date(_cdFecha).getTime()-86400000).toISOString().split('T')[0])})
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${_CD_DENOMS.map(d=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:8px 10px;font-family:Nunito,sans-serif;">
              <div style="font-size:10px;font-weight:900;color:var(--text-muted);text-transform:uppercase;">${d.label}</div>
              <div style="font-size:16px;font-weight:900;color:#7c3aed;">$${(saldoAyer[d.id]||0).toFixed(2)}</div>
            </div>`).join('')}
          </div>
          <div class="cd-total-row purple" style="margin-top:10px;"><span>Total saldo de ayer</span><span>$${_cdTotalM(saldoAyer).toFixed(2)}</span></div>
        </div>
      </div>` : ''}

      <!-- SALDO EN CAJA -->
      <div class="cd-panel">
        <div class="cd-panel-header">
          <div class="cd-panel-icon" style="background:#dcfce7;">🏦</div>
          <div class="cd-panel-title">Saldo en Caja</div>
          <button class="cd-btn-update" onclick="_cdAplicarSaldoAQueda()">🔄 Actualizar Queda</button>
        </div>
        <div class="cd-panel-body">
          <div style="font-size:11px;color:#15803d;font-weight:700;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-family:Nunito,sans-serif;">
            ℹ️ Ingresa el saldo inicial la primera vez. Después se actualiza automáticamente con la venta y los gastos.
          </div>
          ${_cdBloqueMontosHTML('cdSaldo')}
          <div class="cd-field" style="margin-top:12px;">
            <label>🏘 Total alquiler acumulado ($) — guardado aparte</label>
            <input class="cd-inp" type="number" id="cdAlquiler" min="0" step="0.01" placeholder="0.00" oninput="_cdActualizarStats()">
          </div>
          <div class="cd-total-row green"><span>Total en caja</span><span id="cdSaldoTotal">$0.00</span></div>
          <div class="cd-total-row amber" style="margin-top:6px;"><span>Total alquiler acumulado</span><span id="cdAlquilerTotal">$0.00</span></div>
          <div class="cd-total-row" style="margin-top:6px;background:#e0f2fe;"><span style="color:#0369a1;font-weight:900;">💰 Total caja + alquiler</span><span id="cdCajaAlquilerTotal" style="color:#0369a1;">$0.00</span></div>
        </div>
      </div>

      <!-- GASTOS / PAGOS -->
      <div class="cd-panel">
        <div class="cd-panel-header">
          <div class="cd-panel-icon" style="background:#fee2e2;">📤</div>
          <div class="cd-panel-title">Gastos / Pagos del Día</div>
        </div>
        <div class="cd-panel-body">
          <div class="cd-item-list" id="cdGastosList"></div>
          <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:12px;margin-top:4px;">
            <div style="font-size:11px;font-weight:900;color:#dc2626;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:10px;">➕ Registrar gasto / pago</div>
            <div class="cd-field" style="margin-bottom:10px;">
              <label>Descripción</label>
              <input class="cd-inp" type="text" id="cdGastoDesc" placeholder="Ej: Pepsi, Luz, Alquiler…">
            </div>
            <div class="cd-sep" style="margin-top:0;">¿Qué se sacó de caja?</div>
            ${_cdBloqueMontosHTML('cdGastoForm')}
            <!-- Punto 6: inventario -->
            <div style="margin-top:12px;padding:10px 12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:900;color:#15803d;font-family:Nunito,sans-serif;margin-bottom:8px;">
                <input type="checkbox" id="cdGastoEsInventario" onchange="_cdToggleInvFields()" style="width:16px;height:16px;accent-color:#16a34a;"> 📦 Este pago es para inventario (tiene ganancia)
              </label>
              <div id="cdGastoInvFields" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div class="cd-field">
                  <label>Costo pagado ($)</label>
                  <input class="cd-inp" type="number" id="cdGastoInvCosto" min="0" step="0.01" placeholder="0.00">
                </div>
                <div class="cd-field">
                  <label>Valor de venta ($) con ganancia</label>
                  <input class="cd-inp" type="number" id="cdGastoInvVenta" min="0" step="0.01" placeholder="0.00" oninput="_cdCalcularGanancia()">
                </div>
                <div class="cd-field" style="grid-column:span 2;">
                  <label>Ganancia estimada</label>
                  <div id="cdGastoGananciaLbl" style="padding:8px 12px;background:#dcfce7;border-radius:8px;font-size:14px;font-weight:900;color:#15803d;font-family:Nunito,sans-serif;">$0.00</div>
                </div>
              </div>
            </div>
            <button class="cd-btn-add" style="width:100%;margin-top:10px;background:#dc2626;" onclick="_cdAgregarGasto()">✅ Registrar pago (descuenta de saldo)</button>
          </div>
          <div class="cd-total-row red" style="margin-top:12px;"><span>Total gastos del día</span><span id="cdGastosTotal">$0.00</span></div>
        </div>
      </div>

      <!-- CAMBIOS DEL DÍA -->
      <div class="cd-panel">
        <div class="cd-panel-header">
          <div class="cd-panel-icon" style="background:#fef3c7;">🔄</div>
          <div class="cd-panel-title">Cambios del Día</div>
          <button class="cd-btn-update" onclick="_cdAplicarCambios()">✓ Aplicar cambios</button>
        </div>
        <div class="cd-panel-body">
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;margin-bottom:12px;">Solo redistribuyen denominaciones — presiona "Aplicar" para actualizar Saldo y Queda.</div>
          <div class="cd-cambio-grid">${cambioGrid}</div>
          <div id="cdCambioResumen" style="margin-top:12px;"></div>
          ${_cdCambiosAplicados.length ? `
          <div style="margin-top:8px;">
            <div class="cd-sep" style="margin-top:0;">Cambios ya aplicados hoy</div>
            ${_cdCambiosAplicados.map(m=>`<div style="font-size:12px;font-weight:700;color:var(--text-muted);padding:3px 0;font-family:Nunito,sans-serif;">• ${m.de} −$${m.monto.toFixed(2)} → ${m.hacia} +$${m.monto.toFixed(2)}</div>`).join('')}
          </div>` : ''}
        </div>
      </div>

      <!-- PENDIENTES -->
      <div class="cd-panel">
        <div class="cd-panel-header">
          <div class="cd-panel-icon" style="background:#ede9fe;">📝</div>
          <div class="cd-panel-title">Pendientes / Deudas</div>
        </div>
        <div class="cd-panel-body">
          <div class="cd-item-list" id="cdDeudasList"></div>
          <div class="cd-add-row">
            <div class="cd-field"><label>Descripción</label><input class="cd-inp" type="text" id="cdDeudaDesc" placeholder="Ej: 30 coras de Santiago…"></div>
            <div class="cd-field"><label>Monto ($)</label><input class="cd-inp" type="number" id="cdDeudaMonto" min="0" step="0.01" placeholder="0.00"></div>
            <button class="cd-btn-add" onclick="_cdAgregarDeuda()">➕</button>
          </div>
          <div class="cd-total-row purple"><span>Total pendiente</span><span id="cdDeudasTotal">$0.00</span></div>
        </div>
      </div>



      <!-- NOTA -->
      <div class="cd-panel">
        <div class="cd-panel-header">
          <div class="cd-panel-icon" style="background:#f0fdf4;">📝</div>
          <div class="cd-panel-title">Nota del Día</div>
        </div>
        <div class="cd-panel-body">
          <textarea class="cd-nota-area" id="cdNota" placeholder="Observaciones del día…" oninput="_cdActualizarStats()"></textarea>
        </div>
      </div>

      <!-- REGISTRO MENSUAL -->
      <div class="cd-panel">
        <div class="cd-panel-header">
          <div class="cd-panel-icon" style="background:#dbeafe;">📅</div>
          <div class="cd-panel-title">Registro Mensual — ${_cdMesKey()}</div>
        </div>
        <div class="cd-panel-body">
          <!-- Saldos iniciales del mes -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div class="cd-field">
              <label>💵 Saldo efectivo al inicio del mes ($)</label>
              <input class="cd-inp" type="number" id="cdMesSaldoInicio" min="0" step="0.01" placeholder="0.00" value="${saldoEfec||''}" onchange="_cdGuardarSaldoInicio()">
            </div>
            <div class="cd-field">
              <label>📦 Inventario inicial del mes ($)</label>
              <input class="cd-inp" type="number" id="cdMesInvInicial" min="0" step="0.01" placeholder="0.00" value="${invIni||''}" onchange="_cdGuardarInventarioInicial()">
            </div>
          </div>
          <!-- Subtotal saldo+inventario (solo lectura) -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:#e0f2fe;border-radius:10px;font-family:Nunito,sans-serif;margin-bottom:14px;">
            <span style="font-size:12px;font-weight:900;color:#0369a1;">💰 Saldo inicial + Inventario inicial</span>
            <span style="font-size:16px;font-weight:900;color:#0369a1;">$${(saldoEfec+invIni).toFixed(2)}</span>
          </div>
          <!-- Ventas del mes -->
          <div class="cd-sep" style="margin-top:4px;">📈 Ventas registradas este mes</div>
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:8px;">
            <table class="cd-mes-tabla">
              <thead><tr><th>Fecha</th><th>Venta</th><th>Alquiler</th><th>A caja</th><th></th></tr></thead>
              <tbody>
                ${_cdMesData.ventas.length ? _cdMesData.ventas.slice().reverse().map(v=>`
                  <tr>
                    <td>${_cdFmtFecha(v.fecha)}</td>
                    <td style="color:#0369a1;font-weight:900;">$${v.total.toFixed(2)}</td>
                    <td style="color:#b45309;">$${(v.alquiler||0).toFixed(2)}</td>
                    <td style="color:#15803d;font-weight:900;">$${(v.total-(v.alquiler||0)).toFixed(2)}</td>
                    <td><button style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:13px;" onclick="_cdEliminarVentaMes('${v.id}')">✕</button></td>
                  </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Sin ventas registradas</td></tr>'}
              </tbody>
              <tfoot>
                <tr style="background:#f0fdf4;">
                  <td style="font-weight:900;color:#15803d;">Total</td>
                  <td style="font-weight:900;color:#0369a1;">$${totalVentasMes.toFixed(2)}</td>
                  <td style="font-weight:900;color:#b45309;">$${totalAlquilerMes.toFixed(2)}</td>
                  <td style="font-weight:900;color:#15803d;">$${(totalVentasMes-totalAlquilerMes).toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <!-- Gastos del mes -->
          <div class="cd-sep">📤 Gastos / Pagos registrados este mes</div>
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:8px;">
            <table class="cd-mes-tabla">
              <thead><tr><th>Fecha</th><th>Descripción</th><th>Total</th><th>Inventario</th><th></th></tr></thead>
              <tbody>
                ${_cdMesData.gastos.length ? _cdMesData.gastos.slice().reverse().map(g=>`
                  <tr>
                    <td>${_cdFmtFecha(g.fecha)}</td>
                    <td>${g.desc}</td>
                    <td style="color:#dc2626;font-weight:900;">$${g.total.toFixed(2)}</td>
                    <td style="color:#15803d;">${g.tipoInv?`Costo: $${g.costoInv.toFixed(2)} → Venta: $${(g.costoInv+g.gananciaInv).toFixed(2)} (+$${g.gananciaInv.toFixed(2)})`:'-'}</td>
                    <td><button style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:13px;" onclick="_cdEliminarGastoMes('${g.id}')">✕</button></td>
                  </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Sin gastos registrados</td></tr>'}
              </tbody>
              <tfoot>
                <tr style="background:#fef2f2;">
                  <td colspan="2" style="font-weight:900;color:#dc2626;">TOTAL GASTOS</td>
                  <td style="font-weight:900;color:#dc2626;">$${totalGastosMes.toFixed(2)}</td>
                  <td style="font-weight:900;color:#15803d;">Total ganancia inv: $${totalInvGanancia.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <!-- Resumen mensual -->
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px 16px;margin-top:8px;">
            <div style="font-size:13px;font-weight:900;color:#15803d;margin-bottom:10px;font-family:Nunito,sans-serif;">📊 Resumen del mes</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;font-family:Nunito,sans-serif;">
              <div style="color:var(--text-muted);font-weight:700;">Saldo efectivo inicio:</div><div style="font-weight:900;color:#0369a1;">$${saldoEfec.toFixed(2)}</div>
              <div style="color:var(--text-muted);font-weight:700;">− Gastos del saldo:</div><div style="font-weight:900;color:#dc2626;">-$${totalGastosMes.toFixed(2)}</div>
              <div style="color:var(--text-muted);font-weight:700;">+ Ventas a caja:</div><div style="font-weight:900;color:#15803d;">+$${ventasACajaMes.toFixed(2)}</div>
              <div style="color:var(--text-muted);font-weight:700;border-top:1px solid #bbf7d0;padding-top:6px;font-weight:900;">💵 Debería haber en CAJA:</div>
              <div style="font-weight:900;color:#0369a1;font-size:14px;border-top:1px solid #bbf7d0;padding-top:6px;">$${cajaFinal.toFixed(2)}</div>
              <div style="color:var(--text-muted);font-weight:700;margin-top:6px;">Inventario inicial:</div><div style="font-weight:900;color:#7c3aed;">$${invIni.toFixed(2)}</div>
              <div style="color:var(--text-muted);font-weight:700;">− Vendido del inventario:</div><div style="font-weight:900;color:#dc2626;">-$${totalVentasMes.toFixed(2)}</div>
              <div style="color:var(--text-muted);font-weight:700;">+ Ganancia de recompras:</div><div style="font-weight:900;color:#15803d;">+$${totalInvGanancia.toFixed(2)}</div>
              <div style="color:var(--text-muted);font-weight:700;border-top:1px solid #bbf7d0;padding-top:6px;">📦 Debería haber en INVENTARIO:</div>
              <div style="font-weight:900;color:#7c3aed;font-size:14px;border-top:1px solid #bbf7d0;padding-top:6px;">$${invFinal.toFixed(2)}</div>
            </div>
          </div>
          <!-- Botones PDF y reiniciar -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
            <button class="btn-cd-pdf" onclick="_cdGenerarPDFMensual()" style="font-size:12px;padding:11px;">📄 Descargar PDF del mes</button>
            <button class="cd-btn-update red" style="padding:11px;border-radius:10px;width:100%;" onclick="_cdReiniciarMes()">♻️ Reiniciar mes</button>
          </div>
        </div>
      </div>

      <!-- CAPTURA RESPONSIVE EN PANTALLA, 1080x1920 AL DESCARGAR -->
      <div class="cd-cap-wrap">
        <div class="cd-resumen-captura" id="cdResumenCaptura">
          <div class="cd-cap-inner">
            <div class="cd-cap-title">📋 CIERRE DE CAJA</div>
            <div class="cd-cap-fecha" id="cdCapFecha">${_cdFmtFecha(_cdFecha).toUpperCase()}</div>

            <!-- ORDEN: Venta / Gastos / Saldo ayer / Saldo hoy / Cambios / Pendientes / Queda -->

            <!-- Fila 1: Venta del Día + Gastos/Pagos -->
            <div class="cd-cap-2col">
              <div class="cd-cap-col">
                <div class="cd-cap-section-title">💹 Venta del Día</div>
                <div class="cd-cap-row"><span>Total venta</span><span class="val-blue" id="capVentaTotal">$0.00</span></div>
                <div class="cd-cap-row"><span>💵 Billetes</span><span id="capVBilletes">$0.00</span></div>
                <div class="cd-cap-row"><span>🪙 M. Dólar</span><span id="capVMonedas">$0.00</span></div>
                <div class="cd-cap-row"><span>🔵 Coras</span><span id="capVCoras">$0.00</span></div>
                <div class="cd-cap-row"><span>🟡 10 cts</span><span id="capVC10">$0.00</span></div>
                <div class="cd-cap-row"><span>🟤 5 cts</span><span id="capVC05">$0.00</span></div>
                <div class="cd-cap-row"><span>⚪ 1 cto</span><span id="capVC01">$0.00</span></div>
                <div id="capAlqHoyWrap" style="display:none;"><div class="cd-cap-row"><span>🏘 Menos alquiler de hoy</span><span class="val-warn" id="capAlqHoy">$0.00</span></div></div>
                <div class="cd-cap-row total"><span>Total venta del día</span><span class="val-blue" id="capVentaTotalFinal">$0.00</span></div>
              </div>
              <div class="cd-cap-col">
                <div class="cd-cap-section-title">📤 Gastos / Pagos</div>
                <div id="capGastosDetalleList"><div class="cd-cap-row"><span>Sin gastos</span><span>—</span></div></div>
                <div class="cd-cap-row total"><span>Total gastos</span><span class="val-neg" id="capGTotal">$0.00</span></div>
              </div>
            </div>

            <!-- Fila 2: Saldo de Ayer — ancho completo -->
            <div class="cd-cap-col" id="capAyerWrap" style="margin-bottom:12px;">
              <div class="cd-cap-section-title">📅 Esto quedó en caja ayer — <span id="capAyerFechaTitle" style="font-size:inherit;"></span></div>
              <div class="cd-cap-row"><span>💵 Billetes</span><span id="capAyerBilletes">$0.00</span></div>
              <div class="cd-cap-row"><span>🪙 M. Dólar</span><span id="capAyerMonedas">$0.00</span></div>
              <div class="cd-cap-row"><span>🔵 Coras</span><span id="capAyerCoras">$0.00</span></div>
              <div class="cd-cap-row"><span>🟡 10 centavos</span><span id="capAyerC10">$0.00</span></div>
              <div class="cd-cap-row"><span>🟤 5 centavos</span><span id="capAyerC05">$0.00</span></div>
              <div class="cd-cap-row"><span>⚪ 1 centavo</span><span id="capAyerC01">$0.00</span></div>
              <div class="cd-cap-row total"><span>Total saldo de ayer</span><span class="val-purple" id="capAyerTotal">—</span></div>
              <div id="capVentaAyerRow" style="display:none;"><div class="cd-cap-row"><span>Venta de ayer</span><span id="capVentaAyerVal" class="val-blue">$0.00</span></div></div>
            </div>

            <!-- Fila 3: Saldo en Caja — ancho completo -->
            <div class="cd-cap-col" style="margin-bottom:12px;">
              <div class="cd-cap-section-title">🏦 Saldo en Caja <span id="capSaldoFecha"></span></div>
              <div class="cd-cap-row"><span>💵 Billetes</span><span id="capSBilletes">$0.00</span></div>
              <div class="cd-cap-row"><span>🪙 M. Dólar</span><span id="capSMonedas">$0.00</span></div>
              <div class="cd-cap-row"><span>🔵 Coras</span><span id="capSCoras">$0.00</span></div>
              <div class="cd-cap-row"><span>🟡 10 centavos</span><span id="capSC10">$0.00</span></div>
              <div class="cd-cap-row"><span>🟤 5 centavos</span><span id="capSC05">$0.00</span></div>
              <div class="cd-cap-row"><span>⚪ 1 centavo</span><span id="capSC01">$0.00</span></div>
              <div class="cd-cap-row total"><span>Total en caja</span><span class="val-pos" id="capSaldoTotal">$0.00</span></div>
            </div>

            <!-- Fila 3: Cambios + Pendientes -->
            <div class="cd-cap-2col">
              <div class="cd-cap-col">
                <div class="cd-cap-section-title">🔄 Cambios del Día</div>
                <div id="capCambiosList"><div class="cd-cap-row"><span>Sin cambios</span><span>—</span></div></div>
              </div>
              <div class="cd-cap-col">
                <div class="cd-cap-section-title">📝 Pendientes</div>
                <div id="capDeudasList"><div class="cd-cap-row"><span>Sin pendientes</span><span>—</span></div></div>
                <div class="cd-cap-row total"><span>Total pendiente</span><span class="val-purple" id="capDTotal">$0.00</span></div>
              </div>
            </div>



            <!-- Alquiler acumulado -->
            <div class="cd-cap-row grand"><span>🏘 Alquiler acumulado</span><span class="val-warn" id="capAlquilerFinal">$0.00</span></div>

                        <div id="capNotaWrap" style="display:none;margin-top:16px;padding:12px 16px;background:#f0f9ff;border-radius:10px;font-size:13px;font-weight:700;color:#0369a1;font-family:Nunito,sans-serif;"></div>
          </div>
        </div>
      </div>

      <button class="btn-cd-captura" onclick="_cdTomarCaptura()">📸 Descargar imagen 1080×1920</button>

    </div>
  `;
  _cdRenderListas();_cdActualizarStats();
  // Restaurar "Queda en Efectivo" persistido si existe
  if(quedaPersistida){
    setTimeout(()=>{
      _CD_DENOMS.forEach(d=>_cdSet('cdQueda'+d.id,quedaPersistida[d.id]||0));
      _cdActualizarStats();
    },50);
  }
}

// ══ Helpers inventario ══════════════════════════════════════════════════
function _cdToggleInvFields(){
  const cb=document.getElementById('cdGastoEsInventario');
  const f=document.getElementById('cdGastoInvFields');
  if(f)f.style.display=cb?.checked?'grid':'none';
}
function _cdCalcularGanancia(){
  const costo=_cdV('cdGastoInvCosto');
  const venta=_cdV('cdGastoInvVenta');
  const lbl=document.getElementById('cdGastoGananciaLbl');
  if(lbl)lbl.textContent='$'+(Math.max(0,venta-costo)).toFixed(2);
}

// ══ Aplicar venta al saldo ══════════════════════════════════════════════
function _cdAplicarVentaASaldo(){
  const ventaTotal=_cdV('cdVentaTotal');
  if(ventaTotal<=0){if(typeof toast==='function')toast('Ingresa la venta del día primero',true);return;}
  const alqHoy=_cdV('cdVentaAlquilerHoy');
  const V=_cdLeerMontos('cdVenta');
  _cdVentaSnapshot={total:ventaTotal,alqHoy,montos:{...V}};
  // Sumar al saldo (alquiler se descuenta de billetes)
  _CD_DENOMS.forEach(d=>{
    let ap=V[d.id]||0;
    if(d.id==='Billetes')ap=Math.max(0,ap-alqHoy);
    _cdSet('cdSaldo'+d.id,_cdV('cdSaldo'+d.id)+ap);
  });
  _cdSet('cdAlquiler',_cdV('cdAlquiler')+alqHoy);
  // Registrar en mensual
  _cdMesData.ventas.push({id:_cdUID(),fecha:_cdFecha,total:ventaTotal,alquiler:alqHoy});
  _cdGuardarMes();
  // Guardar venta permanentemente en Supabase
  _cdSbSave('ventaDia_'+_cdFecha, {fecha:_cdFecha,total:ventaTotal,alquiler:alqHoy,montos:{...V}});
  // Limpiar campos venta
  _cdSet('cdVentaTotal',0,true);_cdSet('cdVentaAlquilerHoy',0,true);
  _CD_DENOMS.forEach(d=>_cdSet('cdVenta'+d.id,0,true));
  if(typeof toast==='function')toast(`✓ Venta $${ventaTotal.toFixed(2)} sumada al saldo. Alquiler $${alqHoy.toFixed(2)} apartado.`);
  _cdActualizarStats();
}

// ══ Saldo de ayer ════════════════════════════════════════════════════════
async function _cdCargarSaldoAyerEnCaja(){
  const sAyer=await _cdCargarSaldoAyer();
  if(!sAyer){if(typeof toast==='function')toast('No hay saldo guardado de ayer',true);return;}
  _CD_DENOMS.forEach(d=>_cdSet('cdSaldo'+d.id,sAyer[d.id]||0));
  if(typeof toast==='function')toast('✓ Saldo de ayer cargado como saldo inicial de hoy');
  _cdActualizarStats();
}

// Cargar venta del día anterior → Supabase primero
async function _cdCargarVentaAyer(){
  const ayerIso=new Date(new Date(_cdFecha).getTime()-86400000).toISOString().split('T')[0];
  return await _cdSbLoad('ventaDia_'+ayerIso);
}

async function _cdGuardarSaldoHoyYCapturar(){
  const Q=_cdLeerMontos('cdQueda');
  await _cdGuardarSaldoHoy(Q);
  _idbGuardarQueda(Q);
  if(typeof toast==='function')toast('✓ Saldo de hoy guardado');
}

function _cdGuardarQuedaManual(){
  const Q=_cdLeerMontos('cdQueda');
  _idbGuardarQueda(Q);
  _cdGuardarSaldoHoy(Q);
  if(typeof toast==='function')toast('✓ "Queda en Efectivo" guardado permanentemente');
  _cdActualizarStats();
}

function _cdAplicarSaldoAQueda(){
  _CD_DENOMS.forEach(d=>_cdSet('cdQueda'+d.id,_cdV('cdSaldo'+d.id)));
  if(typeof toast==='function')toast('✓ "Queda en Efectivo" actualizado');
  _cdActualizarStats();
}

// ══ Cambios ══════════════════════════════════════════════════════════════
function _cdCalcularCambiosPendientes(){
  const movs=[];
  _CD_DENOMS.forEach(d=>{
    const s=_cdV('cdCambioSale'+d.id);
    const hId=document.getElementById('cdCambioHacia'+d.id)?.value||'';
    if(s>0&&hId)movs.push({de:d.label,deId:d.id,hacia:_CD_DENOMS.find(x=>x.id===hId)?.label||hId,haciaId:hId,monto:s});
  });
  return movs;
}
function _cdAplicarCambios(){
  const movs=_cdCalcularCambiosPendientes();
  if(!movs.length){if(typeof toast==='function')toast('Ingresa al menos un cambio',true);return;}
  movs.forEach(m=>{
    _cdSet('cdSaldo'+m.deId,Math.max(0,_cdV('cdSaldo'+m.deId)-m.monto));
    _cdSet('cdSaldo'+m.haciaId,_cdV('cdSaldo'+m.haciaId)+m.monto);
    _cdSet('cdQueda'+m.deId,Math.max(0,_cdV('cdQueda'+m.deId)-m.monto));
    _cdSet('cdQueda'+m.haciaId,_cdV('cdQueda'+m.haciaId)+m.monto);
    _cdCambiosAplicados.push({...m,hora:new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})});
  });
  _CD_DENOMS.forEach(d=>_cdSet('cdCambioSale'+d.id,0));
  if(typeof toast==='function')toast('✓ Cambios aplicados');
  _cdActualizarStats();
  // Re-render para mostrar historial
  const cambResumen=document.getElementById('cdCambioResumen');
  if(cambResumen)_cdActualizarStats();
}

// ══ Listas ════════════════════════════════════════════════════════════════
function _cdRenderListas(){
  const gEl=document.getElementById('cdGastosList');
  if(gEl) gEl.innerHTML=_cdGastos.length
    ?_cdGastos.map(x=>{
        const dens=_CD_DENOMS.filter(d=>(x.montos[d.id]||0)>0).map(d=>`<span class="cd-item-denom">${d.label} $${(x.montos[d.id]||0).toFixed(2)}</span>`).join('');
        const invTag=x.inventario?`<span class="cd-item-denom inv">📦 Costo $${x.inventario.costo.toFixed(2)} → Venta $${(x.inventario.costo+x.inventario.ganancia).toFixed(2)} (+$${x.inventario.ganancia.toFixed(2)})</span>`:'';
        return`<div class="cd-item-row"><div class="cd-item-head"><span class="cd-item-desc">${x.desc}</span><div style="display:flex;align-items:center;gap:6px;"><span class="cd-item-monto" style="color:#dc2626;">-$${x.total.toFixed(2)}</span><button class="cd-item-del" onclick="_cdEliminarGasto('${x.id}')">✕</button></div></div><div class="cd-item-denoms">${dens}${invTag}</div></div>`;
      }).join('')
    :`<div style="font-size:12px;color:var(--text-muted);font-weight:700;padding:4px 0;">Sin gastos registrados</div>`;
  const dEl=document.getElementById('cdDeudasList');
  if(dEl) dEl.innerHTML=_cdDeudas.length
    ?_cdDeudas.map(x=>`<div class="cd-item-row"><div class="cd-item-head"><span class="cd-item-desc">${x.desc}</span><div style="display:flex;align-items:center;gap:6px;"><span class="cd-item-monto" style="color:#7c3aed;">$${Number(x.monto||0).toFixed(2)}</span><button class="cd-item-del" onclick="_cdEliminarDeuda('${x.id}')">✕</button></div></div></div>`).join('')
    :`<div style="font-size:12px;color:var(--text-muted);font-weight:700;padding:4px 0;">Sin pendientes</div>`;
  _cdActualizarStats();
}

function _cdAgregarGasto(){
  const desc=document.getElementById('cdGastoDesc')?.value?.trim();
  if(!desc){if(typeof toast==='function')toast('Escribe una descripción',true);return;}
  const montos={};let total=0;
  _CD_DENOMS.forEach(d=>{const v=_cdV('cdGastoForm'+d.id);montos[d.id]=v;total+=v;});
  if(total<=0){if(typeof toast==='function')toast('Ingresa al menos un monto',true);return;}
  // Inventario
  let inventario=null;
  if(document.getElementById('cdGastoEsInventario')?.checked){
    const costo=_cdV('cdGastoInvCosto')||total;
    const vtaInv=_cdV('cdGastoInvVenta');
    inventario={costo,ganancia:Math.max(0,vtaInv-costo)};
  }
  // Descontar del saldo
  _CD_DENOMS.forEach(d=>{if(montos[d.id]>0)_cdSet('cdSaldo'+d.id,Math.max(0,_cdV('cdSaldo'+d.id)-montos[d.id]));});
  const g={id:_cdUID(),desc,montos,total,inventario,fecha:_cdFecha};
  _cdGastos.push(g);
  // Registrar en mensual
  _cdMesData.gastos.push({id:g.id,fecha:_cdFecha,desc,total,tipoInv:!!inventario,costoInv:inventario?.costo||0,gananciaInv:inventario?.ganancia||0});
  _cdGuardarMes();
  document.getElementById('cdGastoDesc').value='';
  _CD_DENOMS.forEach(d=>_cdSet('cdGastoForm'+d.id,0));
  if(document.getElementById('cdGastoEsInventario'))document.getElementById('cdGastoEsInventario').checked=false;
  _cdToggleInvFields();
  _cdRenderListas();
  if(typeof toast==='function')toast(`✓ Pago registrado y descontado del saldo`);
}
function _cdEliminarGasto(id){
  const g=_cdGastos.find(x=>x.id===id);
  if(g)_CD_DENOMS.forEach(d=>{if(g.montos[d.id]>0)_cdSet('cdSaldo'+d.id,_cdV('cdSaldo'+d.id)+g.montos[d.id]);});
  _cdGastos=_cdGastos.filter(x=>x.id!==id);
  _cdMesData.gastos=_cdMesData.gastos.filter(x=>x.id!==id);
  _cdGuardarMes();_cdRenderListas();
}
function _cdAgregarDeuda(){
  const desc=document.getElementById('cdDeudaDesc')?.value?.trim();
  const monto=parseFloat(document.getElementById('cdDeudaMonto')?.value||'0');
  if(!desc||!monto||monto<=0){if(typeof toast==='function')toast('Completa descripción y monto',true);return;}
  _cdDeudas.push({id:_cdUID(),desc,monto});
  document.getElementById('cdDeudaDesc').value='';document.getElementById('cdDeudaMonto').value='';
  _cdRenderListas();
}
function _cdEliminarDeuda(id){_cdDeudas=_cdDeudas.filter(x=>x.id!==id);_cdRenderListas();}
// Eliminar de registro mensual
function _cdEliminarVentaMes(id){_cdMesData.ventas=_cdMesData.ventas.filter(v=>v.id!==id);_cdGuardarMes();renderCierreDia();}
function _cdEliminarGastoMes(id){_cdMesData.gastos=_cdMesData.gastos.filter(g=>g.id!==id);_cdGuardarMes();renderCierreDia();}
function _cdGuardarSaldoInicio(){_cdMesData.saldoInicio=_cdV('cdMesSaldoInicio');_cdGuardarMes();}
function _cdGuardarInventarioInicial(){_cdMesData.inventarioInicial=_cdV('cdMesInvInicial');_cdGuardarMes();}

// ══ Stats ════════════════════════════════════════════════════════════════
function _cdActualizarStats(){
  const ventaActual=_cdV('cdVentaTotal');
  const alqHoyActual=_cdV('cdVentaAlquilerHoy');
  const S=_cdLeerMontos('cdSaldo'),Q=_cdLeerMontos('cdQueda');
  const alquilerAcum=_cdV('cdAlquiler');
  const totalGastos=_cdSumArr(_cdGastos);
  const totalDeudas=_cdDeudas.reduce((s,x)=>s+Number(x.monto||0),0);
  const totalSaldo=_cdTotalM(S);
  const totalQueda=_cdTotalM(Q);
  const movsPendientes=_cdCalcularCambiosPendientes();
  const $=_cdFmt;

  if(alqHoyActual>0){const m=document.getElementById('cdVentaAlqMsg');if(m){m.style.display='block';m.textContent=`🏘 $${alqHoyActual.toFixed(2)} saldrán de billetes al alquiler. A caja entrarán: $${Math.max(0,ventaActual-alqHoyActual).toFixed(2)}`;}}
  else{const m=document.getElementById('cdVentaAlqMsg');if(m)m.style.display='none';}

  _cdTxt('cdStatVenta',$(ventaActual||(_cdVentaSnapshot?.total||0)));
  _cdTxt('cdStatGastos',$(totalGastos));_cdTxt('cdStatSaldo',$(totalSaldo));
  _cdTxt('cdVentaDesgloseTotal',$(_cdTotalM(_cdLeerMontos('cdVenta'))));
  _cdTxt('cdSaldoTotal',$(totalSaldo));_cdTxt('cdAlquilerTotal',$(alquilerAcum));
  _cdTxt('cdCajaAlquilerTotal',$(totalSaldo+alquilerAcum));
  _cdTxt('cdGastosTotal',$(totalGastos));_cdTxt('cdDeudasTotal',$(totalDeudas));_cdTxt('cdQuedaTotal',$(totalQueda));

  // Cambios pendientes en panel
  const cRes=document.getElementById('cdCambioResumen');
  if(cRes) cRes.innerHTML=movsPendientes.length
    ?movsPendientes.map(m=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:var(--surface);border:1px solid var(--border);border-radius:7px;margin-bottom:4px;font-size:12px;font-family:Nunito,sans-serif;"><span style="font-weight:900;color:#dc2626;">${m.de} −$${m.monto.toFixed(2)}</span><span>→</span><span style="font-weight:900;color:#15803d;">${m.hacia} +$${m.monto.toFixed(2)}</span></div>`).join(''):'';

  // Captura
  const snap=_cdVentaSnapshot;
  const capV=snap?snap.montos:_cdLeerMontos('cdVenta');
  const capVT=snap?snap.total:ventaActual;
  const capAlq=snap?snap.alqHoy:alqHoyActual;
  _cdTxt('capVentaTotal',$(capVT));
  _cdTxt('capVBilletes',$(capV.Billetes||0));_cdTxt('capVMonedas',$(capV.Monedas||0));_cdTxt('capVCoras',$(capV.Coras||0));
  _cdTxt('capVC10',$(capV.C10||0));_cdTxt('capVC05',$(capV.C05||0));_cdTxt('capVC01',$(capV.C01||0));
  const aw=document.getElementById('capAlqHoyWrap');if(aw)aw.style.display=capAlq>0?'':'none';
  _cdTxt('capAlqHoy',$(capAlq));_cdTxt('capVentaTotalFinal',$(capVT));
  // Fix 4: Add fecha to "Saldo en Caja" title in capture
  const capSaldoFechaEl = document.getElementById('capSaldoFecha');
  if(capSaldoFechaEl) capSaldoFechaEl.textContent = _cdFmtFecha(_cdFecha);
  const capAyerFechaTitleEl = document.getElementById('capAyerFechaTitle');
  if(capAyerFechaTitleEl){
    const ayerIsoTitle=new Date(new Date(_cdFecha).getTime()-86400000).toISOString().split('T')[0];
    capAyerFechaTitleEl.textContent = _cdFmtFecha(ayerIsoTitle);
  }

  _cdTxt('capSBilletes',$(S.Billetes));_cdTxt('capSMonedas',$(S.Monedas));_cdTxt('capSCoras',$(S.Coras));
  _cdTxt('capSC10',$(S.C10));_cdTxt('capSC05',$(S.C05));_cdTxt('capSC01',$(S.C01));
  _cdTxt('capSaldoTotal',$(totalSaldo));

  // Saldo de ayer en captura (Punto 4 — con fecha)
  const ay=_cdSaldoAyerCache;
  if(ay){
    const ayerIso=new Date(new Date(_cdFecha).getTime()-86400000).toISOString().split('T')[0];
    _cdTxt('capAyerFechaLbl',_cdFmtFecha(ayerIso));
    _cdTxt('capAyerBilletes',$(ay.Billetes||0));
    _cdTxt('capAyerMonedas',$(ay.Monedas||0));
    _cdTxt('capAyerCoras',$(ay.Coras||0));
    _cdTxt('capAyerC10',$(ay.C10||0));
    _cdTxt('capAyerC05',$(ay.C05||0));
    _cdTxt('capAyerC01',$(ay.C01||0));
    _cdTxt('capAyerTotal',$(_cdTotalM(ay)));
    const ayWrap=document.getElementById('capAyerWrap');if(ayWrap)ayWrap.style.display='';
  } else {
    // Show ayer section even if empty, with message
    _cdTxt('capAyerFechaTitle', '');
    const noAyer = ['capAyerBilletes','capAyerMonedas','capAyerCoras','capAyerC10','capAyerC05','capAyerC01'];
    noAyer.forEach(id=>_cdTxt(id,'—'));
    _cdTxt('capAyerTotal','Sin datos');
    const vaRow=document.getElementById('capVentaAyerRow');if(vaRow)vaRow.style.display='none';
  }
  // Venta del día anterior (Fix 4+8 — permanente)
  const va=_cdVentaAyerCache;
  const vaRow=document.getElementById('capVentaAyerRow');
  if(va&&vaRow){vaRow.style.display='';_cdTxt('capVentaAyerVal',$(va.total));}
  else if(vaRow){vaRow.style.display='none';}

  const capGD=document.getElementById('capGastosDetalleList');
  if(capGD) capGD.innerHTML=_cdGastos.length
    ?_cdGastos.map(x=>{
        const ds=_CD_DENOMS.filter(d=>(x.montos[d.id]||0)>0).map(d=>`<div class="cd-cap-row" style="font-size:18px;padding:3px 0;border-bottom:1px solid #f0f9ff;"><span>${d.label}</span><span class="val-neg">$${(x.montos[d.id]||0).toFixed(2)}</span></div>`).join('');
        // Punto 1: NO mostrar ganancia en la captura, solo descripcion y montos
        return`<div class="cd-cap-row" style="font-weight:900;font-size:20px;padding:5px 0 2px;border-bottom:none;"><span>Pago $${x.total.toFixed(2)}</span><span class="val-neg">-$${x.total.toFixed(2)}</span></div>${ds}`;
      }).join('')
    :`<div class="cd-cap-row"><span>Sin gastos</span><span>—</span></div>`;
  _cdTxt('capGTotal',$(totalGastos));

  // Cambios en captura — todos los aplicados + pendientes
  const todosLosCambios=[..._cdCambiosAplicados,...movsPendientes.map(m=>({...m,pendiente:true}))];
  const capCL=document.getElementById('capCambiosList');
  if(capCL) capCL.innerHTML=todosLosCambios.length
    ?todosLosCambios.map(m=>`<div class="cd-cap-row"><span>${m.de}→${m.hacia}${m.pendiente?' (pendiente)':''}</span><span>$${m.monto.toFixed(2)}</span></div>`).join('')
    :`<div class="cd-cap-row"><span>Sin cambios</span><span>—</span></div>`;

  const capD=document.getElementById('capDeudasList');
  if(capD) capD.innerHTML=_cdDeudas.length
    ?_cdDeudas.map(x=>`<div class="cd-cap-row"><span>${x.desc}</span><span class="val-purple">$${Number(x.monto||0).toFixed(2)}</span></div>`).join('')
    :`<div class="cd-cap-row"><span>Sin pendientes</span><span>—</span></div>`;
  _cdTxt('capDTotal',$(totalDeudas));
  // Queda en Efectivo removed from capture (Fix 4)
  _cdTxt('capAlquilerFinal',$(alquilerAcum));
  const nw=document.getElementById('capNotaWrap');
  const nt=document.getElementById('cdNota')?.value?.trim()||'';
  if(nw){nw.style.display=nt?'block':'none';nw.textContent='📝 '+nt;}
}

// ══ Captura 1080x1920 ═════════════════════════════════════════════════════
async function _cdTomarCaptura(){
  const el=document.getElementById('cdResumenCaptura');if(!el)return;
  const btn=document.querySelector('.btn-cd-captura');
  if(btn){btn.disabled=true;btn.innerHTML='⏳ Generando…';}
  try{
    if(!window.html2canvas){await new Promise((r,j)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';sc.onload=r;sc.onerror=j;document.head.appendChild(sc);});}
    // Activar modo impresión 1080px
    document.body.classList.add('cd-print-mode');
    await new Promise(r=>setTimeout(r,80)); // yield para que CSS se aplique
    const c=await window.html2canvas(el,{scale:1,useCORS:true,backgroundColor:'#ffffff',width:1080,height:Math.max(1920,el.scrollHeight),windowWidth:1080});
    document.body.classList.remove('cd-print-mode');
    const o=document.createElement('canvas');o.width=1080;o.height=1920;
    const ctx=o.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1080,1920);ctx.drawImage(c,0,0);
    const lnk=document.createElement('a');lnk.download=`Cierre_${_cdFecha}.png`;lnk.href=o.toDataURL('image/png');
    document.body.appendChild(lnk);lnk.click();document.body.removeChild(lnk);
    if(typeof toast==='function')toast('📸 Imagen 1080×1920 descargada');
  }catch(e){
    document.body.classList.remove('cd-print-mode');
    if(typeof toast==='function')toast('⚠ Error: '+e.message,true);
  }
  finally{if(btn){btn.disabled=false;btn.innerHTML='📸 Descargar imagen 1080×1920';}}
}

// ══ PDF Mensual ══════════════════════════════════════════════════════════
async function _cdGenerarPDFMensual(){
  if(typeof window.jspdf==='undefined'&&typeof window.jsPDF==='undefined'){
    if(typeof toast==='function')toast('Cargando PDF…');
    await new Promise((r,j)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';sc.onload=r;sc.onerror=j;document.head.appendChild(sc);});
  }
  const {jsPDF}=window.jspdf||window;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const mes=_cdMesKey();
  const totalV  =_cdMesData.ventas.reduce((s,v)=>s+v.total,0);
  const totalAlq=_cdMesData.ventas.reduce((s,v)=>s+(v.alquiler||0),0);
  const totalACaja=totalV-totalAlq;
  const totalG  =_cdMesData.gastos.reduce((s,g)=>s+g.total,0);
  // FIX 10: Ganancia de inventario es lo que SE SUMA al saldo inicial
  // saldoInicio ya incluye inventario+producto, NO se suma la venta diaria
  // Lo que sí se suma: ganancia de cada pago/gasto de inventario
  const totalInvG=_cdMesData.gastos.filter(g=>g.tipoInv).reduce((s,g)=>s+(g.gananciaInv||0),0);
  const sIni=_cdMesData.saldoInicio||0;
  const invIniPDF=_cdMesData.inventarioInicial||0;
  // Caja final = efectivo inicio - gastos + ventas a caja
  const cajaFinalPDF=sIni-totalG+totalACaja;
  // Inventario final = inv inicio - ventas (costo) + ganancia inventario del mes
  const invFinalPDF=Math.max(0, invIniPDF-totalV+totalInvG);
  // "Debería haber" para el PDF = caja (el inventario se muestra por separado)
  const saldoTeorico=cajaFinalPDF;
  const w=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  let y=18;

  // ── Helpers ──────────────────────────────────────────────────────────
  const checkPage=()=>{ if(y>pageH-18){doc.addPage();y=18;} };
  const row=(lbl,val,cy,colorL=[50,50,50],colorV=[12,74,110])=>{
    doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(...colorL);doc.text(lbl,14,cy);
    doc.setFont('helvetica','bold');doc.setTextColor(...colorV);doc.text(val,w-14,cy,{align:'right'});
    doc.setDrawColor(3,105,161);doc.setLineWidth(0.4);doc.line(14,cy+1.5,w-14,cy+1.5);
  };
  const rowTotal=(lbl,val,cy,color=[3,105,161])=>{
    doc.setFillColor(224,242,254);doc.rect(14,cy-5,w-28,7,'F');
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(...color);
    doc.text(lbl,16,cy);doc.text(val,w-16,cy,{align:'right'});
    doc.setDrawColor(...color);doc.setLineWidth(0.8);doc.line(14,cy+2,w-14,cy+2);
  };
  const separator=(cy)=>{doc.setDrawColor(3,105,161);doc.setLineWidth(1.2);doc.line(14,cy,w-14,cy);};
  const sectionHeader=(txt,cy,bgColor=[3,105,161])=>{
    doc.setFillColor(...bgColor);doc.rect(14,cy-6,w-28,8,'F');
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
    doc.text(txt,w/2,cy,{align:'center'});
  };

  // ── ENCABEZADO ────────────────────────────────────────────────────────
  doc.setFillColor(12,74,110);doc.rect(0,0,w,22,'F');
  doc.setFontSize(16);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
  doc.text('CIERRE MENSUAL DE CAJA',w/2,10,{align:'center'});
  doc.setFontSize(10);doc.setFont('helvetica','normal');
  doc.text('Mes: '+mes+'   |   Generado: '+new Date().toLocaleDateString('es-SV'),w/2,16,{align:'center'});
  y=30;

  // ── RESUMEN GENERAL ─────────────────────────────────────────────────
  sectionHeader('RESUMEN DEL MES',y);y+=6;
  // ── CAJA ──────────────────────────────────────────────────────────────
  row('Saldo efectivo al inicio del mes', '$'+sIni.toFixed(2),      y,[50,50,50],[3,105,161]); y+=8;
  row('Menos gastos pagados del saldo',  '-$'+totalG.toFixed(2),    y,[50,50,50],[220,38,38]); y+=8;
  row('Mas ventas que entraron a caja',  '+$'+totalACaja.toFixed(2),y,[50,50,50],[21,128,61]); y+=8;
  rowTotal('DEBERIA HABER EN CAJA: $'+cajaFinalPDF.toFixed(2), '', y,[3,105,161]); y+=12;
  // ── INVENTARIO ────────────────────────────────────────────────────────
  row('Inventario inicial del mes',         '$'+invIniPDF.toFixed(2),  y,[50,50,50],[100,50,180]); y+=8;
  row('Menos lo vendido del inventario',   '-$'+totalV.toFixed(2),    y,[50,50,50],[220,38,38]); y+=8;
  row('Mas ganancia de recompras',          '+$'+totalInvG.toFixed(2), y,[50,50,50],[21,128,61]); y+=8;
  rowTotal('DEBERIA QUEDAR EN INVENTARIO: $'+invFinalPDF.toFixed(2), '', y,[100,50,180]); y+=14;

  // ── INFORMATIVO: Ventas y Gastos del mes ─────────────────────────────
  sectionHeader('INFORMACION DEL MES',y,[21,128,61]);y+=6;
  row('Total ventas del mes',       '$'+totalV.toFixed(2),    y,[50,50,50],[3,105,161]); y+=8;
  row('Alquiler apartado del mes',  '$'+totalAlq.toFixed(2),  y,[50,50,50],[180,83,9]);  y+=8;
  row('Ventas que entraron a caja', '$'+totalACaja.toFixed(2),y,[50,50,50],[22,163,74]); y+=8;
  row('Total gastos / pagos',       '$'+totalG.toFixed(2),    y,[50,50,50],[220,38,38]); y+=8;
  // Fix 3: total ventas + caja existente (saldo inicial)
  rowTotal('Total ventas del mes + saldo efectivo inicio', '$'+(totalV+sIni).toFixed(2), y,[3,105,161]); y+=16;

  // ── VENTAS DEL MES (Fix 9: formato limpio sin emojis feos) ───────────
  checkPage();
  sectionHeader('VENTAS DEL MES ('+_cdMesData.ventas.length+')',y);y+=8;
  if(_cdMesData.ventas.length){
    // Encabezado de tabla
    doc.setFillColor(3,105,161);doc.rect(14,y-5,w-28,6,'F');
    doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
    doc.text('Fecha',16,y);doc.text('Venta total',70,y);doc.text('Alquiler',110,y);doc.text('A caja',w-16,y,{align:'right'});
    y+=7;
    _cdMesData.ventas.forEach((v,i)=>{
      checkPage();
      if(i%2===0){doc.setFillColor(240,249,255);doc.rect(14,y-5,w-28,7,'F');}
      doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(30,30,30);
      doc.text(_cdFmtFecha(v.fecha),16,y);
      doc.setFont('helvetica','bold');doc.setTextColor(3,105,161);
      doc.text('$'+v.total.toFixed(2),70,y);
      doc.setTextColor(180,83,9);
      doc.text('$'+(v.alquiler||0).toFixed(2),110,y);
      doc.setTextColor(21,128,61);
      doc.text('$'+(v.total-(v.alquiler||0)).toFixed(2),w-14,y,{align:'right'});
      doc.setDrawColor(186,230,253);doc.setLineWidth(0.25);doc.line(14,y+1.5,w-14,y+1.5);
      y+=8;
    });
    rowTotal('TOTAL  Ventas: $'+totalV.toFixed(2)+'  Alquiler: $'+totalAlq.toFixed(2)+'  A caja: $'+totalACaja.toFixed(2),'',y); y+=14;
  } else {
    doc.setFontSize(10);doc.setTextColor(150,150,150);doc.text('Sin ventas registradas',w/2,y,{align:'center'});y+=10;
  }

  // ── GASTOS DEL MES ────────────────────────────────────────────────────
  checkPage();
  sectionHeader('GASTOS Y PAGOS DEL MES ('+_cdMesData.gastos.length+')',y,[180,30,30]);y+=8;
  if(_cdMesData.gastos.length){
    doc.setFillColor(180,30,30);doc.rect(14,y-5,w-28,6,'F');
    doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
    doc.text('Fecha',16,y);doc.text('Descripcion',50,y);doc.text('Ganancia inv.',120,y);doc.text('Total pagado',w-16,y,{align:'right'});
    y+=7;
    _cdMesData.gastos.forEach((g,i)=>{
      checkPage();
      if(i%2===0){doc.setFillColor(255,242,242);doc.rect(14,y-5,w-28,7,'F');}
      doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(30,30,30);
      doc.text(_cdFmtFecha(g.fecha),16,y);
      // Fix 9: descripción limpia sin emojis
      const desc=(g.desc||'Pago').replace(/[^\x20-\x7E\u00C0-\u024F]/g,'').trim()||'Pago';
      doc.text(desc.substring(0,28),50,y);
      doc.setTextColor(21,128,61);
      doc.text(g.tipoInv?'+$'+g.gananciaInv.toFixed(2):'-',120,y);
      doc.setFont('helvetica','bold');doc.setTextColor(220,38,38);
      doc.text('$'+g.total.toFixed(2),w-14,y,{align:'right'});
      doc.setDrawColor(252,165,165);doc.setLineWidth(0.25);doc.line(14,y+1.5,w-14,y+1.5);
      y+=8;
    });
  if(!_cdMesData.gastos.length){doc.setFontSize(10);doc.setTextColor(150,150,150);doc.text('Sin gastos registrados',w/2,y,{align:'center'});y+=8;}
  rowTotal('TOTAL GASTOS', '$'+totalG.toFixed(2), y, [220,38,38]); y+=16;

  // ── PIE ───────────────────────────────────────────────────────────────
  checkPage();
  separator(y);y+=8;
  doc.setFontSize(9);doc.setFont('helvetica','italic');doc.setTextColor(120,120,120);
  doc.text('Despensa Económica — Cierre mensual '+mes,w/2,y,{align:'center'});

  doc.save(`Cierre_Mensual_${mes}.pdf`);
  if(typeof toast==='function')toast('📄 PDF del mes descargado');
}
}

// ══ Reiniciar mes ════════════════════════════════════════════════════════
function _cdReiniciarMes(){
  if(!confirm('¿Reiniciar el registro mensual?\n\nSe borrarán: ventas del mes, gastos/pagos, historial.\nNO se toca: "Esto Queda en Efectivo" (se mantiene igual).\n\nDescarga el PDF antes si quieres conservar el historial.'))return;

  // Limpiar registro mensual
  _cdMesData={saldoInicio:0,inventarioInicial:0,ventas:[],gastos:[]};
  _cdGuardarMes();

  // Limpiar venta snapshot (Punto 2 — no mostrar venta del mes anterior en captura nueva)
  _cdVentaSnapshot=null;

  // Limpiar estado diario: gastos, deudas, cambios, saldo en caja
  _cdGastos=[];_cdDeudas=[];_cdCambiosAplicados=[];

  // Limpiar campos de Venta del día y Saldo en Caja
  // pero MANTENER los campos de "Queda en Efectivo" intactos
  const quedaGuardada=_cdLeerMontos('cdQueda'); // leer antes de re-renderizar
  _idbGuardarQueda(quedaGuardada);              // persistir

  if(typeof toast==='function')toast('✓ Mes reiniciado. "Queda en Efectivo" conservado.');
  renderCierreDia();
  // Restaurar Queda después de renderizar
  setTimeout(()=>{
    _CD_DENOMS.forEach(d=>_cdSet('cdQueda'+d.id,quedaGuardada[d.id]||0));
    _cdActualizarStats();
  },100);
}

// Persistir "Queda en Efectivo" en Supabase (no en IDB) — sobrevive reinicio
function _idbGuardarQueda(montos){
  // Guardar en Supabase si está disponible
  if(typeof _sbPost==='function'&&typeof _getTiendaId==='function'){
    try{
      _sbPost('cierre_diario',{
        id:_getTiendaId()+'_queda_efectivo',
        tienda_id:_getTiendaId(),
        fecha:'queda_efectivo',
        datos:JSON.stringify({tipo:'queda_efectivo',montos,updated:new Date().toISOString()}),
        updated_at:new Date().toISOString()
      },true).catch(e=>console.warn('[Queda]',e.message));
    }catch(e){}
  }
  // También en IDB como respaldo local
  try{ idbSet('vpos_quedaEfectivo',montos); }catch(e){}
  // Y clave genérica via _cdSbSave
  _cdSbSave('quedaEfectivo', montos);
}
async function _idbCargarQueda(){
  // Intentar cargar de Supabase primero
  if(typeof _sbGet==='function'&&typeof _getTiendaId==='function'){
    try{
      const rows=await _sbGet('cierre_diario',{select:'datos',id:'eq.'+_getTiendaId()+'_queda_efectivo'});
      if(rows&&rows.length&&rows[0].datos){
        const d=JSON.parse(rows[0].datos);
        if(d.montos)return d.montos;
      }
    }catch(e){}
  }
  // Fallback a IDB
  try{ return await idbGet('vpos_quedaEfectivo')||null; }catch(e){return null;}
}

// ══ Fecha ═════════════════════════════════════════════════════════════════
function _cdCambiarFecha(fecha){
  _cdFecha=fecha;_cdVentaSnapshot=null;_cdCambiosAplicados=[];
  _cdTxt('cdHeroFechaLbl',_cdFmtFecha(fecha));_cdTxt('cdCapFecha',_cdFmtFecha(fecha).toUpperCase());
  _cdGastos=[];_cdDeudas=[];renderCierreDia();
}

// ══ Global ════════════════════════════════════════════════════════════════
window.renderCierreDia           = renderCierreDia;
window._cdAgregarGasto           = _cdAgregarGasto;
window._cdEliminarGasto          = _cdEliminarGasto;
window._cdAgregarDeuda           = _cdAgregarDeuda;
window._cdEliminarDeuda          = _cdEliminarDeuda;
window._cdEliminarVentaMes       = _cdEliminarVentaMes;
window._cdEliminarGastoMes       = _cdEliminarGastoMes;
window._cdActualizarStats        = _cdActualizarStats;
window._cdCambiarFecha           = _cdCambiarFecha;
window._cdTomarCaptura           = _cdTomarCaptura;
window._cdAplicarVentaASaldo     = _cdAplicarVentaASaldo;
window._cdAplicarSaldoAQueda     = _cdAplicarSaldoAQueda;
window._cdAplicarCambios         = _cdAplicarCambios;
window._cdCargarSaldoAyerEnCaja  = _cdCargarSaldoAyerEnCaja;
window._cdGuardarSaldoHoyYCapturar = _cdGuardarSaldoHoyYCapturar;
window._cdGuardarSaldoInicio     = _cdGuardarSaldoInicio;
window._cdGuardarInventarioInicial = _cdGuardarInventarioInicial;
window._cdGuardarQuedaManual     = _cdGuardarQuedaManual;
window._cdToggleInvFields        = _cdToggleInvFields;
window._cdCalcularGanancia       = _cdCalcularGanancia;
window._cdGenerarPDFMensual      = _cdGenerarPDFMensual;
window._cdReiniciarMes           = _cdReiniciarMes;

window._cdCargarVentaAyer = _cdCargarVentaAyer;

// ══ Storage: todo en Supabase, IDB solo como caché ═══════════════════
async function _cdSbSave(clave, valor) {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'local';
  const id = tiendaId + '_' + clave;
  try {
    await _sbPost('cierre_diario', {
      id, tienda_id: tiendaId, fecha: clave,
      datos: JSON.stringify({ clave, valor, ts: Date.now() }),
      updated_at: new Date().toISOString()
    }, true);
  } catch(e) { /* sin conexión, no pasa nada */ }
  // siempre guardar local como respaldo
  try { await idbSet('vpos_' + clave, valor); } catch(e) {}
}
async function _cdSbLoad(clave) {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'local';
  try {
    if (typeof _sbGet === 'function') {
      const rows = await _sbGet('cierre_diario', {
        select: 'datos', id: 'eq.' + tiendaId + '_' + clave
      });
      if (rows && rows.length && rows[0].datos) {
        const d = JSON.parse(rows[0].datos);
        if (d && d.valor !== undefined) return d.valor;
      }
    }
  } catch(e) {}
  // fallback IDB
  try { return await idbGet('vpos_' + clave) || null; } catch(e) { return null; }
}

window._cdCargarVentaAyer = _cdCargarVentaAyer;

// ══ Storage: todo en Supabase, IDB solo como caché ═══════════════════
async function _cdSbSave(clave, valor) {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'local';
  const id = tiendaId + '_' + clave;
  try {
    await _sbPost('cierre_diario', {
      id, tienda_id: tiendaId, fecha: clave,
      datos: JSON.stringify({ clave, valor, ts: Date.now() }),
      updated_at: new Date().toISOString()
    }, true);
  } catch(e) { /* sin conexión, no pasa nada */ }
  // siempre guardar local como respaldo
  try { await idbSet('vpos_' + clave, valor); } catch(e) {}
}
async function _cdSbLoad(clave) {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'local';
  try {
    if (typeof _sbGet === 'function') {
      const rows = await _sbGet('cierre_diario', {
        select: 'datos', id: 'eq.' + tiendaId + '_' + clave
      });
      if (rows && rows.length && rows[0].datos) {
        const d = JSON.parse(rows[0].datos);
        if (d && d.valor !== undefined) return d.valor;
      }
    }
  } catch(e) {}
  // fallback IDB
  try { return await idbGet('vpos_' + clave) || null; } catch(e) { return null; }
}
window._cdCargarVentaAyer = _cdCargarVentaAyer;

// ══ Storage: todo en Supabase, IDB solo como caché ═══════════════════
async function _cdSbSave(clave, valor) {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'local';
  const id = tiendaId + '_' + clave;
  try {
    await _sbPost('cierre_diario', {
      id, tienda_id: tiendaId, fecha: clave,
      datos: JSON.stringify({ clave, valor, ts: Date.now() }),
      updated_at: new Date().toISOString()
    }, true);
  } catch(e) { /* sin conexión, no pasa nada */ }
  // siempre guardar local como respaldo
  try { await idbSet('vpos_' + clave, valor); } catch(e) {}
}
async function _cdSbLoad(clave) {
  const tiendaId = typeof _getTiendaId === 'function' ? _getTiendaId() : 'local';
  try {
    if (typeof _sbGet === 'function') {
      const rows = await _sbGet('cierre_diario', {
        select: 'datos', id: 'eq.' + tiendaId + '_' + clave
      });
      if (rows && rows.length && rows[0].datos) {
        const d = JSON.parse(rows[0].datos);
        if (d && d.valor !== undefined) return d.valor;
      }
    }
  } catch(e) {}
  // fallback IDB
  try { return await idbGet('vpos_' + clave) || null; } catch(e) { return null; }
}
