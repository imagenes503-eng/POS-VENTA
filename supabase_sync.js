// =====================================================================
//  DESPENSA ECONÓMICA — Supabase Sync v9
//  ✅ Login con Supabase Auth (correo + contraseña)
//  ✅ Refresh token automático (sesión persistente sin re-login)
//  ✅ Roles admin/supervisor/cajero desde tabla perfiles
//  ✅ RLS real por tienda usando JWT del usuario
//  ✅ Restricciones visuales reforzadas por rol
//  ✅ URL+Key guardadas en Supabase
//  ✅ Sistema de membresías con validación de expiración
//  ✅ Usuarios exentos: Santiago / Madelline
//  ✅ Pago en efectivo y tarjeta
// =====================================================================

// ── Usuarios exentos de membresía (Super Admins) ─────────────────────
const _EMAILS_EXENTOS = ['emilioenri71@gmail.com', 'a10.11.2002m@gmail.com'];

const _PLANES_MEMBRESIA = [
  { id: 'semanal',    label: 'Semanal',         precio: 3.00,  dias: 7,    icono: '📅', popular: false },
  { id: 'mensual',    label: 'Mensual',          precio: 11.00, dias: 30,   icono: '🗓️', popular: true  },
  { id: 'anual',      label: 'Anual',            precio: 125.00,dias: 365,  icono: '🏆', popular: false },
  { id: 'definitivo', label: 'Pago Único Total', precio: 500.00,dias: null, icono: '♾️', popular: false },
];

let _sesionActiva  = false;
let _tiendaId      = null;
let _usuarioActual = null; // { id, email, nombre, rol }
let _authToken     = null;
let _refreshToken  = null; // Para renovar JWT automáticamente
let _refreshInterval = null;
let _dispositivoId = localStorage.getItem('vpos_dispositivoId') || ('dev_' + Math.random().toString(36).slice(2,8));
localStorage.setItem('vpos_dispositivoId', _dispositivoId);

const ROLES = {
  admin:      { label: 'Admin',      color: '#7c3aed', puede: ['vender','inventario','reportes','gastos','config','usuarios','fusionar','reiniciar','corte_caja','exportar'] },
  supervisor: { label: 'Supervisor', color: '#d97706', puede: ['vender','inventario','reportes','corte_caja'] },
  cajero:     { label: 'Cajero',     color: '#1d4ed8', puede: ['vender'] }
};

function _puedeHacer(accion) {
  if (!_usuarioActual) return false;
  return (ROLES[_usuarioActual.rol] || ROLES.cajero).puede.includes(accion);
}

// ── Credenciales de Supabase ─────────────────────────────────────────
// Puedes escribir aquí tus credenciales para que cualquier dispositivo
// las tenga automáticamente sin necesidad de configurarlas.
// La anon key es pública y segura para estar en el frontend.
const _SB_URL_DEFAULT = 'https://bmusprrznlqkgzkpyfsi.supabase.co';  // ← pega aquí tu Project URL
const _SB_KEY_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdXNwcnJ6bmxxa2d6a3B5ZnNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjM5NDQsImV4cCI6MjA4OTY5OTk0NH0.ohhqWt0RPsg4m5r8TlQAfUuR62CiGZImMBE1FB9c-7w';  // ← pega aquí tu anon public key

function _sbUrl() {
  return (localStorage.getItem('vpos_supabaseUrl') || _SB_URL_DEFAULT).replace(/\/$/, '');
}
function _sbKey() {
  return localStorage.getItem('vpos_supabaseKey') || _SB_KEY_DEFAULT;
}
function _getTiendaId() { return _tiendaId || localStorage.getItem('vpos_tiendaId') || ''; }

// Headers con JWT del usuario autenticado (más seguro que anon key)
function _headers(extra) {
  const key = _sbKey();
  const auth = _authToken ? ('Bearer ' + _authToken) : ('Bearer ' + key);
  return Object.assign({ 'apikey': key, 'Authorization': auth, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, extra || {});
}

async function _sbGet(tabla, params) {
  const url = _sbUrl(), key = _sbKey();
  if (!url || !key) throw new Error('Sin configuración de Supabase');
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const resp = await fetch(url + '/rest/v1/' + tabla + qs, { headers: _headers({'Prefer': ''}) });
  if (!resp.ok) { const txt = await resp.text(); throw new Error('HTTP ' + resp.status + ': ' + txt); }
  return resp.json();
}

// Llamar a una función RPC de Supabase (PostgreSQL function)
async function _sbRpc(nombreFuncion, params) {
  const url = _sbUrl(), key = _sbKey();
  if (!url || !key) throw new Error('Sin configuración de Supabase');
  const resp = await fetch(url + '/rest/v1/rpc/' + nombreFuncion, {
    method: 'POST',
    headers: _headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(params || {})
  });
  if (!resp.ok) { const txt = await resp.text(); throw new Error('HTTP ' + resp.status + ': ' + txt); }
  return resp.json();
}

async function _sbPost(tabla, body, upsert) {
  const url = _sbUrl(), key = _sbKey();
  if (!url || !key) throw new Error('Sin config');
  const h = _headers({ 'Prefer': upsert ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal' });
  const resp = await fetch(url + '/rest/v1/' + tabla, { method: 'POST', headers: h, body: JSON.stringify(body) });
  if (!resp.ok) { const txt = await resp.text(); throw new Error('HTTP ' + resp.status + ': ' + txt); }
}

// PATCH: actualizar registro(s) que cumplan filtro — más confiable que upsert para updates
async function _sbPatch(tabla, filtro, body) {
  const url = _sbUrl(), key = _sbKey();
  if (!url || !key) throw new Error('Sin config');
  const qs = '?' + new URLSearchParams(filtro).toString();
  const h = _headers({ 'Prefer': 'return=minimal' });
  const resp = await fetch(url + '/rest/v1/' + tabla + qs, {
    method: 'PATCH', headers: h, body: JSON.stringify(body)
  });
  if (!resp.ok) { const txt = await resp.text(); throw new Error('HTTP ' + resp.status + ': ' + txt); }
}

async function _sbDeleteFiltro(tabla, filtro) {
  const url = _sbUrl(), key = _sbKey();
  if (!url || !key) return;
  await fetch(url + '/rest/v1/' + tabla + '?' + new URLSearchParams(filtro).toString(), {
    method: 'DELETE', headers: _headers({'Prefer': 'return=minimal'})
  });
}

// =====================================================================
//  🔐 SUPABASE AUTH
// =====================================================================

async function _authSignUp(email, password) {
  const url = _sbUrl(), key = _sbKey();
  const resp = await fetch(url + '/auth/v1/signup', {
    method: 'POST',
    headers: { 'apikey': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.msg || data.error_description || 'Error al registrar');
  return data;
}

async function _authSignIn(email, password) {
  const url = _sbUrl(), key = _sbKey();
  const resp = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.msg || data.error_description || 'Correo o contraseña incorrectos');
  return data; // { access_token, user: { id, email } }
}

async function _authSignOut() {
  const url = _sbUrl(), key = _sbKey();
  if (!_authToken) return;
  await fetch(url + '/auth/v1/logout', {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + _authToken }
  }).catch(() => {});
}

// =====================================================================
//  🔐 LOGIN MODAL
// =====================================================================

function abrirLogin() {
  if (_sesionActiva) {
    if (!document.getElementById('modalCerrarSesion')) {
      const m = document.createElement('div');
      m.id = 'modalCerrarSesion';
      m.style.cssText = 'position:fixed;inset:0;z-index:10065;background:rgba(5,46,22,0.75);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:16px;';
      m.innerHTML = `
        <div style="background:#fff;border-radius:20px;width:100%;max-width:340px;box-shadow:0 24px 60px rgba(0,0,0,0.4);overflow:hidden;">
          <div style="background:linear-gradient(135deg,#166534,#16a34a);padding:22px 24px 18px;text-align:center;">
            <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 10px;">👤</div>
            <div style="color:#fff;font-size:16px;font-weight:900;font-family:Nunito,sans-serif;" id="csDlgNombre">—</div>
            <div style="color:rgba(255,255,255,0.75);font-size:12px;font-weight:700;font-family:Nunito,sans-serif;margin-top:3px;" id="csDlgEmail">—</div>
          </div>
          <div style="padding:22px 24px;">
            <div style="font-size:14px;font-weight:700;color:#374151;font-family:Nunito,sans-serif;text-align:center;margin-bottom:20px;line-height:1.6;">
              ¿Deseas cerrar la sesión actual?
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <button onclick="document.getElementById('modalCerrarSesion').style.display='none'"
                style="padding:13px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;color:#374151;">
                ✕ Cancelar
              </button>
              <button onclick="document.getElementById('modalCerrarSesion').style.display='none';cerrarSesion();"
                style="padding:13px;background:linear-gradient(135deg,#dc2626,#991b1b);border:none;border-radius:12px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;color:#fff;box-shadow:0 4px 14px rgba(220,38,38,0.3);">
                🚪 Cerrar sesión
              </button>
            </div>
          </div>
        </div>`;
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
      document.body.appendChild(m);
    }
    document.getElementById('csDlgNombre').textContent = _usuarioActual?.nombre || _usuarioActual?.email || '\u2014';
    document.getElementById('csDlgEmail').textContent  = _usuarioActual?.email || '';
    document.getElementById('modalCerrarSesion').style.display = 'flex';
    return;
  }
  _crearModalLogin();
  const modal = document.getElementById('modalLogin');
  if (modal) modal.style.display = 'flex';
}
function _crearModalLogin() {
  if (document.getElementById('modalLogin')) return;

  // Inyectar estilos de la pantalla de login
  if (!document.getElementById('loginStyles')) {
    const style = document.createElement('style');
    style.id = 'loginStyles';
    style.textContent = `
      #modalLogin {
        position: fixed; inset: 0; z-index: 10000;
        background: linear-gradient(135deg, #052e16 0%, #14532d 40%, #166534 100%);
        display: flex; align-items: center; justify-content: center;
        padding: 16px; overflow-y: auto;
        animation: loginFadeIn 0.4s ease;
      }
      @keyframes loginFadeIn { from { opacity: 0; } to { opacity: 1; } }
      #modalLogin.open { display: flex !important; }
      .login-card {
        background: #fff; border-radius: 24px; width: 100%; max-width: 440px;
        box-shadow: 0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08);
        overflow: hidden; animation: loginSlideUp 0.4s cubic-bezier(0.22,1,0.36,1);
      }
      @keyframes loginSlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      .login-header {
        background: linear-gradient(135deg, #16a34a, #15803d);
        padding: 32px 28px 28px; text-align: center; position: relative;
      }
      .login-header-icon {
        width: 64px; height: 64px; background: rgba(255,255,255,0.2);
        border-radius: 20px; display: flex; align-items: center; justify-content: center;
        font-size: 32px; margin: 0 auto 14px; border: 2px solid rgba(255,255,255,0.3);
        backdrop-filter: blur(10px);
      }
      .login-header h1 { color: #fff; font-size: 22px; font-weight: 900; margin: 0 0 6px; font-family: Nunito, sans-serif; }
      .login-header p { color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 700; margin: 0; font-family: Nunito, sans-serif; }
      .login-tabs {
        display: grid; grid-template-columns: 1fr 1fr; gap: 0;
        border-bottom: 2px solid #f0fdf4;
      }
      .login-tab-btn {
        padding: 14px 8px; border: none; background: #fff; font-family: Nunito, sans-serif;
        font-weight: 900; font-size: 14px; cursor: pointer; color: #6b7280;
        border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.2s;
      }
      .login-tab-btn.active { color: #16a34a; border-bottom-color: #16a34a; background: #f0fdf4; }
      .login-body { padding: 24px 28px; }
      .login-field { margin-bottom: 16px; }
      .login-field label {
        display: block; font-size: 11px; font-weight: 900; color: #6b7280;
        text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px;
        font-family: Nunito, sans-serif;
      }
      .login-field input {
        width: 100%; padding: 12px 16px; border: 2px solid #d1fae5;
        border-radius: 12px; font-size: 15px; font-family: Nunito, sans-serif; font-weight: 700;
        box-sizing: border-box; outline: none; transition: border-color 0.2s;
        background: #f9fafb; color: #052e16;
      }
      .login-field input:focus { border-color: #16a34a; background: #fff; }
      .login-field .field-hint { font-size: 11px; color: #9ca3af; font-weight: 700; margin-top: 5px; font-family: Nunito, sans-serif; }
      .login-btn-main {
        width: 100%; padding: 15px; background: linear-gradient(135deg, #16a34a, #15803d);
        color: #fff; border: none; border-radius: 14px; font-size: 16px; font-weight: 900;
        font-family: Nunito, sans-serif; cursor: pointer; margin-top: 4px;
        box-shadow: 0 4px 20px rgba(22,163,74,0.4); transition: all 0.2s;
        letter-spacing: 0.3px;
      }
      .login-btn-main:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(22,163,74,0.5); }
      .login-btn-main:active { transform: translateY(0); }
      .login-btn-main:disabled { opacity: 0.7; cursor: wait; transform: none; }
      .login-error {
        background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 10px;
        padding: 11px 14px; font-size: 13px; color: #dc2626; font-weight: 700;
        text-align: center; margin-bottom: 14px; display: none; font-family: Nunito, sans-serif;
      }
      .login-divider {
        text-align: center; margin: 16px 0 0; font-size: 12px; color: #9ca3af;
        font-weight: 700; font-family: Nunito, sans-serif;
      }
      .login-divider button {
        background: none; border: none; color: #6b7280; font-size: 12px; font-weight: 700;
        font-family: Nunito, sans-serif; cursor: pointer; text-decoration: underline;
        text-underline-offset: 3px;
      }
      /* MODAL MEMBRESÍA */
      #modalMembresia {
        position: fixed; inset: 0; z-index: 10001;
        background: rgba(5,46,22,0.85); backdrop-filter: blur(8px);
        display: none; align-items: center; justify-content: center; padding: 16px;
        overflow-y: auto;
      }
      #modalMembresia.open { display: flex; }
      .membresia-card {
        background: #fff; border-radius: 24px; width: 100%; max-width: 480px;
        box-shadow: 0 32px 80px rgba(0,0,0,0.5);
        animation: loginSlideUp 0.35s cubic-bezier(0.22,1,0.36,1);
        overflow: hidden;
      }
      .membresia-header {
        background: linear-gradient(135deg, #1e3a5f, #1d4ed8);
        padding: 28px 24px 22px; text-align: center;
      }
      .membresia-header h2 { color: #fff; font-size: 20px; font-weight: 900; margin: 0 0 6px; font-family: Nunito, sans-serif; }
      .membresia-header p { color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 700; margin: 0; font-family: Nunito, sans-serif; }
      .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 20px 20px 0; }
      .plan-card {
        border: 2px solid #e5e7eb; border-radius: 16px; padding: 16px 12px; cursor: pointer;
        transition: all 0.2s; position: relative; background: #fff; text-align: center;
      }
      .plan-card:hover { border-color: #86efac; background: #f0fdf4; transform: translateY(-2px); }
      .plan-card.selected { border-color: #16a34a; background: #f0fdf4; box-shadow: 0 0 0 3px rgba(22,163,74,0.15); }
      .plan-card.popular::before {
        content: '⭐ Popular'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
        background: #16a34a; color: #fff; font-size: 10px; font-weight: 900; font-family: Nunito, sans-serif;
        padding: 3px 10px; border-radius: 20px; white-space: nowrap;
      }
      .plan-icono { font-size: 24px; margin-bottom: 6px; }
      .plan-nombre { font-size: 13px; font-weight: 900; color: #052e16; font-family: Nunito, sans-serif; margin-bottom: 4px; }
      .plan-precio { font-size: 22px; font-weight: 900; color: #16a34a; font-family: Nunito, sans-serif; }
      .plan-precio span { font-size: 12px; color: #6b7280; font-weight: 700; }
      .plan-duracion { font-size: 11px; color: #9ca3af; font-weight: 700; font-family: Nunito, sans-serif; margin-top: 3px; }
      .pago-metodo-section { padding: 16px 20px 0; }
      .pago-metodo-section label { font-size: 11px; font-weight: 900; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6px; font-family: Nunito, sans-serif; display: block; margin-bottom: 10px; }
      .pago-metodos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .pago-metodo-btn {
        padding: 12px 8px; border: 2px solid #e5e7eb; border-radius: 12px; cursor: pointer;
        background: #fff; font-family: Nunito, sans-serif; font-weight: 900; font-size: 13px;
        transition: all 0.2s; text-align: center; color: #374151;
      }
      .pago-metodo-btn:hover { border-color: #86efac; background: #f0fdf4; }
      .pago-metodo-btn.selected { border-color: #1d4ed8; background: #eff6ff; color: #1d4ed8; }
      .membresia-footer { padding: 16px 20px 20px; }
      .membresia-resumen {
        background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;
        padding: 12px 16px; margin-bottom: 14px; font-family: Nunito, sans-serif;
      }
      .membresia-resumen .res-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #166534; font-weight: 700; }
      .membresia-resumen .res-row.total { font-size: 16px; font-weight: 900; color: #052e16; margin-top: 8px; padding-top: 8px; border-top: 1px solid #bbf7d0; }
      .btn-pagar {
        width: 100%; padding: 15px; border: none; border-radius: 14px;
        font-size: 16px; font-weight: 900; font-family: Nunito, sans-serif;
        cursor: pointer; transition: all 0.2s; letter-spacing: 0.3px;
      }
      .btn-pagar.efectivo { background: linear-gradient(135deg, #059669, #065f46); color: #fff; box-shadow: 0 4px 16px rgba(5,150,105,0.4); }
      .btn-pagar.tarjeta { background: linear-gradient(135deg, #1d4ed8, #1e40af); color: #fff; box-shadow: 0 4px 16px rgba(29,78,216,0.4); }
      .btn-pagar:hover { transform: translateY(-1px); }
      .btn-pagar:disabled { opacity: 0.6; cursor: wait; transform: none; }
      .efectivo-instrucciones {
        background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px;
        padding: 14px 16px; font-size: 13px; color: #92400e; font-weight: 700;
        font-family: Nunito, sans-serif; line-height: 1.6; display: none;
      }
      .efectivo-instrucciones.visible { display: block; }
    `;
    document.head.appendChild(style);
  }

  const modal = document.createElement('div');
  modal.id = 'modalLogin';
  modal.innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <div class="login-header-icon">🏪</div>
        <h1>Despensa Económica</h1>
        <p id="loginSubtitle">Sistema de Ventas Profesional</p>
      </div>
      <div class="login-tabs">
        <button class="login-tab-btn active" id="tabEntrar" onclick="_loginTab('entrar')">🔑 Iniciar Sesión</button>
        <button class="login-tab-btn" id="tabRegistrar" onclick="_loginTab('registrar')">✨ Registrarse</button>
      </div>
      <div class="login-body">
        <div id="loginError" class="login-error"></div>

        <div id="campoNombre" class="login-field" style="display:none;">
          <label>Nombre completo</label>
          <input id="loginNombre" type="text" placeholder="Tu nombre">
        </div>
        <div id="campoNombreTienda" class="login-field" style="display:none;">
          <label>Nombre de tu tienda</label>
          <input id="loginNombreTienda" type="text" placeholder="Ej: Tienda García, Super Hernández">
          <div class="field-hint">Este nombre aparecerá en tu app y tus reportes PDF</div>
        </div>
        <div id="campoTienda" class="login-field" style="display:none;">
          <label>ID de Tienda</label>
          <input id="loginTiendaId" type="text" placeholder="ej: tienda1, despensa" value="${localStorage.getItem('vpos_tiendaId') || ''}">
          <div class="field-hint">ID técnico — usa el mismo en todos tus dispositivos</div>
        </div>
        <div class="login-field">
          <label>Correo electrónico</label>
          <input id="loginEmail" type="email" placeholder="correo@ejemplo.com" value="${localStorage.getItem('vpos_email') || ''}">
        </div>
        <div class="login-field">
          <label>Contraseña</label>
          <div style="position:relative;">
            <input id="loginPassword" type="password" placeholder="mínimo 6 caracteres" style="padding-right:44px;width:100%;box-sizing:border-box;">
            <button type="button" id="btnTogglePass"
              onclick="(function(){const i=document.getElementById('loginPassword');const b=document.getElementById('btnTogglePass');i.type=i.type==='password'?'text':'password';b.textContent=i.type==='password'?'👁':'🙈';})()"
              style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:4px;color:#6b7280;">👁</button>
          </div>
          <div style="text-align:right;margin-top:6px;">
            <button type="button" onclick="_abrirRecuperarPass()"
              style="background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;color:#16a34a;font-family:Nunito,sans-serif;padding:0;text-decoration:underline;">
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>

        <button onclick="intentarLogin()" id="btnLogin" class="login-btn-main">
          🔑 Entrar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') intentarLogin(); });

  // Crear también modal de membresía
  _crearModalMembresia();
}

function _loginTab(tab) {
  const esRegistrar = tab === 'registrar';
  document.getElementById('campoNombre').style.display = esRegistrar ? '' : 'none';
  document.getElementById('campoNombreTienda').style.display = esRegistrar ? '' : 'none';
  document.getElementById('campoTienda').style.display = esRegistrar ? '' : 'none';
  document.getElementById('tabEntrar').classList.toggle('active', !esRegistrar);
  document.getElementById('tabRegistrar').classList.toggle('active', esRegistrar);
  document.getElementById('btnLogin').textContent = esRegistrar ? '✅ Crear cuenta' : '🔑 Entrar';
  document.getElementById('loginSubtitle').textContent = esRegistrar ? 'Crea tu cuenta para tu tienda' : 'Sistema de Ventas Profesional';
  document.getElementById('loginError').style.display = 'none';
  window._loginMode = tab;
}

async function intentarLogin() {
  const esRegistrar = window._loginMode === 'registrar';
  const email    = (document.getElementById('loginEmail')?.value || '').trim();
  const password = (document.getElementById('loginPassword')?.value || '').trim();
  const btn      = document.getElementById('btnLogin');
  const errEl    = document.getElementById('loginError');
  errEl.style.display = 'none';

  if (!email || !email.includes('@')) { _mostrarLoginError('Ingresa un correo válido'); return; }
  if (!password || password.length < 6) { _mostrarLoginError('La contraseña debe tener al menos 6 caracteres'); return; }
  if (!_sbUrl() || !_sbKey()) { _mostrarLoginError('Primero configura Supabase en ⚙️ Sheets'); return; }

  btn.disabled = true;
  btn.textContent = esRegistrar ? 'Creando cuenta...' : 'Entrando...';

  try {
    if (esRegistrar) {
      // ── REGISTRO ───────────────────────────────────────────────────
      const nombre        = (document.getElementById('loginNombre')?.value || '').trim();
      const nombreTienda  = (document.getElementById('loginNombreTienda')?.value || '').trim();
      const tiendaId      = (document.getElementById('loginTiendaId')?.value || '').trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '');
      if (!nombre)        { _mostrarLoginError('Ingresa tu nombre'); btn.disabled = false; btn.textContent = '✅ Crear cuenta'; return; }
      if (!nombreTienda)  { _mostrarLoginError('Ingresa el nombre de tu tienda'); btn.disabled = false; btn.textContent = '✅ Crear cuenta'; return; }
      if (!tiendaId)      { _mostrarLoginError('Ingresa el ID de tienda'); btn.disabled = false; btn.textContent = '✅ Crear cuenta'; return; }

      // ── Verificar si el correo ya tiene un perfil (activo o inactivo) ──
      const perfilesExistentes = await _sbGet('perfiles', { select: 'id,activo,tienda_id', email: 'eq.' + email }).catch(() => []);
      if (perfilesExistentes && perfilesExistentes.length > 0) {
        const activo = perfilesExistentes.find(p => p.activo);
        if (activo) {
          _mostrarLoginError('Ya existe una cuenta activa con ese correo. Usa "Entrar" para iniciar sesión.');
        } else {
          _mostrarLoginError('Este correo ya tiene una cuenta registrada (inactiva). Contacta al administrador para reactivarla.');
        }
        btn.disabled = false; btn.textContent = '✅ Crear cuenta'; return;
      }

      const authData = await _authSignUp(email, password);
      const userId   = authData.user?.id || authData.id;
      if (!userId) throw new Error('No se pudo crear la cuenta');

      // Verificar si ya hay admin en esta tienda
      const admins = await _sbGet('perfiles', { select: 'id', tienda_id: 'eq.' + tiendaId, rol: 'eq.admin' }).catch(() => []);
      const esAdmin = !admins || admins.length === 0;

      // Registrar la tienda en la tabla tiendas (requerido por foreign key de productos)
      await _sbPost('tiendas', {
        id: tiendaId,
        nombre: nombreTienda,
        created_at: new Date().toISOString()
      }, true).catch(e => console.warn('[Registro] tienda insert:', e.message));

      // Crear perfil con nombre de tienda
      await _sbPost('perfiles', {
        id: userId, tienda_id: tiendaId, email,
        nombre: nombre, tienda_nombre: nombreTienda,
        rol: esAdmin ? 'admin' : 'cajero',
        activo: true, created_at: new Date().toISOString()
      }, true);

      toast(esAdmin ? '✅ Cuenta creada — eres el Admin de esta tienda' : '✅ Cuenta creada como Cajero');

      // Auto-login después de registro
      await _completarLogin(email, password, tiendaId);

    } else {
      // ── LOGIN ───────────────────────────────────────────────────────
      await _completarLogin(email, password, null);
    }
  } catch(e) {
    _mostrarLoginError(e.message);
    btn.disabled = false;
    btn.textContent = esRegistrar ? '✅ Crear cuenta' : '🔑 Entrar';
  }
}

async function _completarLogin(email, password, tiendaIdOverride) {
  const authData = await _authSignIn(email, password);
  _authToken    = authData.access_token;
  _refreshToken = authData.refresh_token || null;
  const userId = authData.user?.id;

  // Guardar refresh token para persistencia sin re-login
  if (_refreshToken) localStorage.setItem('vpos_refreshToken', _refreshToken);

  // Buscar perfil activo: primero por userId, si no hay buscar por email
  let perfiles = await _sbGet('perfiles', { select: '*', id: 'eq.' + userId, activo: 'eq.true' }).catch(() => []);

  if (!perfiles || !perfiles.length) {
    // Puede haber múltiples perfiles con el mismo correo — buscar el activo por email
    perfiles = await _sbGet('perfiles', { select: '*', email: 'eq.' + email, activo: 'eq.true', limit: 1 }).catch(() => []);
  }

  if (!perfiles || !perfiles.length) {
    throw new Error('Tu cuenta ha sido desactivada. Contacta al administrador para reactivarla.');
  }

  const perfil = perfiles[0];
  _usuarioActual = { ...perfil, email };
  _tiendaId = tiendaIdOverride || perfil.tienda_id;
  _sesionActiva = true;

  // Guardar en localStorage
  // ── Si cambió la tienda respecto a la sesión anterior, limpiar datos locales ──
  const _tiendaAnterior = localStorage.getItem('vpos_tiendaId');
  if (_tiendaAnterior && _tiendaAnterior !== _tiendaId) {
    console.log('[Login] Cambio de tienda:', _tiendaAnterior, '→', _tiendaId, '— limpiando IndexedDB');
    const clavesLimpiar = ['vpos_productos','vpos_historial','vpos_pagos','vpos_ventasDiarias','vpos_ventasMes','vpos_ventasSem','vpos_restockLog'];
    for (const k of clavesLimpiar) { try { await idbSet(k, []); } catch(e) {} }
    if (typeof productos !== 'undefined') productos = [];
    if (typeof historial !== 'undefined') historial = [];
    if (typeof pagos     !== 'undefined') pagos = [];
  }
  localStorage.setItem('vpos_email', email);
  localStorage.setItem('vpos_authToken', _authToken);
  localStorage.setItem('vpos_usuarioData', JSON.stringify(_usuarioActual));
  localStorage.setItem('vpos_tiendaId', _tiendaId);
  localStorage.setItem('vpos_sesionActiva', '1');

  // ── Verificar membresía ──────────────────────────────────────────
  const esExento = _EMAILS_EXENTOS.includes(email.toLowerCase().trim());
  if (!esExento) {
    const membresiaActiva = await _verificarMembresia(userId, email);
    if (!membresiaActiva) {
      // Cerrar pantalla de login y mostrar modal de membresía
      const modalLogin = document.getElementById('modalLogin');
      if (modalLogin) modalLogin.style.display = 'none';
      _abrirModalMembresia(email, userId);
      return; // No continuar hasta que pague
    }
  }

  // Continuar con login normal
  _finalizarLogin();
}

async function _finalizarLogin() {
  const modalLogin = document.getElementById('modalLogin');
  if (modalLogin) modalLogin.style.display = 'none';
  _actualizarBadgeLogin();
  _aplicarRestriccionesPorRol();
  _registrarAccion('login', 'Inicio de sesion');
  _actualizarTabAdmin();
  _actualizarNombreTienda();

  toast('✅ Bienvenido ' + _usuarioActual.nombre + ' · ' + (ROLES[_usuarioActual.rol]?.label || ''));

  // Iniciar renovación automática del JWT cada 50 minutos
  _iniciarRefreshToken();

  // Descargar datos frescos de Supabase (fuente de verdad) de inmediato
  const btn = document.getElementById('btnLogin');
  if (btn) btn.textContent = 'Cargando datos...';
  await _cargarDatosAlIniciar();
  if (btn) btn.textContent = 'Iniciar sesión';

  // Iniciar Realtime (WebSocket) + polling fallback para recibir cambios de otros dispositivos
  _iniciarPolling();
  // Check inmediato al conectar (por si hubo cambios mientras no había sesión)
  setTimeout(_autoFusionar, 800);
}

// ── Actualizar nombre de la tienda en toda la UI ──────────────────────
function _actualizarNombreTienda() {
  // Para el super admin siempre es "Despensa Económica"
  const esSA = _esSuperAdmin();
  const nombre = esSA
    ? 'Despensa Económica'
    : (_usuarioActual?.tienda_nombre || _getTiendaId() || 'Mi Tienda');

  // Guardar en localStorage para persistir entre recargas
  localStorage.setItem('vpos_tiendaNombre', nombre);

  _aplicarNombreTiendaDOM(nombre);
}

function _aplicarNombreTiendaDOM(nombre) {
  // Separar en dos partes para el estilo: primera palabra bold + resto opaco
  const partes = nombre.split(' ');
  const p1 = partes[0];
  const p2 = partes.length > 1 ? ' ' + partes.slice(1).join(' ') : '';
  const html = p1 + (p2 ? `<span>${p2}</span>` : '');

  // Navbar logo
  const logo = document.querySelector('.logo');
  if (logo) logo.innerHTML = html;

  // Loading logo
  const loadingLogo = document.querySelector('.loading-logo');
  if (loadingLogo) loadingLogo.innerHTML = html;

  // Drawer brand
  const drawerBrand = document.querySelector('.drawer-brand');
  if (drawerBrand) drawerBrand.innerHTML = html;

  // Footer del drawer
  const drawerFooter = document.querySelector('.drawer-footer-txt');
  if (drawerFooter) drawerFooter.textContent = nombre + ' — Sistema de Punto de Venta';

  // Título de la pestaña del navegador
  document.title = nombre + ' — Sistema de Ventas';
}

async function _cargarDatosAlIniciar() {
  // Intentar snapshot fusionado primero (rápido — muestra datos al instante)
  let tieneDatosPrevios = false;
  try {
    const fusionId = _getTiendaId() + '_fusionado';
    const snaps = await _sbGet('sync_snapshots', { select: 'datos', id: 'eq.' + fusionId });
    if (snaps && snaps.length > 0) {
      await _aplicarDatos(JSON.parse(snaps[0].datos));
      tieneDatosPrevios = true;
    }
  } catch(e) { console.warn('[cargarDatos snapshot]', e.message); }

  // SIEMPRE cargar desde Supabase (fuente de verdad):
  // - Si no había snapshot: carga completa
  // - Si había snapshot: repara productos con nombre/precio vacíos (corrupción por broadcast)
  await _autoCargarDesdeSupa();
  // Reintentar fotos que fallaron + subir fotos nuevas sin subir
  setTimeout(async () => { await _syncFotosPendientes(); await _autoSyncFotos(); }, 3000);
}

function entrarSinLogin() {
  const modal = document.getElementById('modalLogin');
  if (modal) modal.style.display = 'none';
}
function _mostrarLoginError(msg) {
  const el = document.getElementById('loginError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function cerrarSesion() {
  await _authSignOut();
  _detenerPolling(); // cierra WebSocket y polling
  clearInterval(_refreshInterval); // detener renovación automática
  _supabaseClient = null; // forzar nuevo cliente en el próximo login
  _sesionActiva = false; _tiendaId = null; _usuarioActual = null; _authToken = null; _refreshToken = null;
  localStorage.removeItem('vpos_sesionActiva');
  localStorage.removeItem('vpos_usuarioData');
  localStorage.removeItem('vpos_authToken');
  localStorage.removeItem('vpos_refreshToken');
  _actualizarBadgeLogin();
  _quitarRestriccionesPorRol();
  toast('Sesion cerrada');
  setTimeout(() => { abrirLogin(); }, 600);
}

// ── Recuperar contraseña ─────────────────────────────────────────────
function _abrirRecuperarPass() {
  // Crear modal si no existe
  if (!document.getElementById('modalRecuperarPass')) {
    const m = document.createElement('div');
    m.id = 'modalRecuperarPass';
    m.style.cssText = 'position:fixed;inset:0;z-index:10070;background:rgba(5,46,22,0.8);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:16px;';
    m.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:100%;max-width:400px;box-shadow:0 24px 60px rgba(0,0,0,0.4);overflow:hidden;">
        <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:22px 24px 18px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:26px;">🔑</span>
          <div>
            <div style="color:#fff;font-size:16px;font-weight:900;font-family:Nunito,sans-serif;">Recuperar contraseña</div>
            <div style="color:rgba(255,255,255,0.75);font-size:12px;font-weight:700;font-family:Nunito,sans-serif;">Te enviaremos un enlace por correo</div>
          </div>
        </div>
        <div style="padding:22px 24px;">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:11px;font-weight:900;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-family:Nunito,sans-serif;margin-bottom:6px;">Correo electrónico</label>
            <input id="recPassEmail" type="email" placeholder="tu@correo.com"
              style="width:100%;padding:12px 14px;border:1.5px solid #d1fae5;border-radius:11px;font-size:15px;font-weight:700;font-family:Nunito,sans-serif;box-sizing:border-box;outline:none;">
          </div>
          <div id="recPassMsg" style="display:none;padding:10px 13px;border-radius:10px;font-size:13px;font-weight:700;font-family:Nunito,sans-serif;margin-bottom:14px;"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button onclick="document.getElementById('modalRecuperarPass').style.display='none'"
              style="padding:13px;background:#f3f4f6;border:1.5px solid #d1d5db;border-radius:12px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;color:#374151;">
              ✕ Cancelar
            </button>
            <button id="btnEnviarRecPass" onclick="_enviarRecuperarPass()"
              style="padding:13px;background:linear-gradient(135deg,#16a34a,#15803d);border:none;border-radius:12px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;color:#fff;box-shadow:0 4px 14px rgba(22,163,74,0.3);">
              📧 Enviar enlace
            </button>
          </div>
        </div>
      </div>`;
    m.addEventListener('click', e => { if(e.target===m) m.style.display='none'; });
    document.body.appendChild(m);
  }
  // Prellenar con email del login si existe
  const loginEmail = document.getElementById('loginEmail')?.value?.trim();
  const recEmail   = document.getElementById('recPassEmail');
  if (recEmail && loginEmail) recEmail.value = loginEmail;
  document.getElementById('recPassMsg').style.display = 'none';
  document.getElementById('modalRecuperarPass').style.display = 'flex';
}

async function _enviarRecuperarPass() {
  const email = (document.getElementById('recPassEmail')?.value || '').trim();
  const msg   = document.getElementById('recPassMsg');
  const btn   = document.getElementById('btnEnviarRecPass');
  if (!email || !email.includes('@')) {
    if (msg) { msg.style.display='block'; msg.style.background='#fef2f2'; msg.style.color='#dc2626'; msg.textContent='⚠ Ingresa un correo válido'; }
    return;
  }
  if (btn) { btn.disabled=true; btn.textContent='⏳ Enviando…'; }
  try {
    const url = _sbUrl(), key = _sbKey();
    const resp = await fetch(url + '/auth/v1/recover', {
      method: 'POST',
      headers: { 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (msg) {
      msg.style.display = 'block';
      if (resp.ok || resp.status === 200) {
        msg.style.background = '#f0fdf4'; msg.style.color = '#15803d';
        msg.textContent = '✅ Enlace enviado. Revisa tu bandeja de entrada (y spam).';
        if (btn) { btn.disabled=false; btn.textContent='📧 Enviar enlace'; }
      } else {
        msg.style.background = '#fef2f2'; msg.style.color = '#dc2626';
        msg.textContent = '⚠ No se pudo enviar. Verifica el correo.';
        if (btn) { btn.disabled=false; btn.textContent='📧 Enviar enlace'; }
      }
    }
  } catch(e) {
    if (msg) { msg.style.display='block'; msg.style.background='#fef2f2'; msg.style.color='#dc2626'; msg.textContent='⚠ Error: '+e.message; }
    if (btn) { btn.disabled=false; btn.textContent='📧 Enviar enlace'; }
  }
}
window._abrirRecuperarPass  = _abrirRecuperarPass;
window._enviarRecuperarPass = _enviarRecuperarPass;

function _actualizarBadgeLogin() {
  const activa = _sesionActiva && _tiendaId;
  document.querySelectorAll('.login-status').forEach(el => {
    el.textContent = activa ? ('Sync: ' + _getTiendaId()) : 'Iniciar sesion';
    el.style.color = activa ? '#16a34a' : '#6b7280';
  });
  actualizarBadgeSheets();
}

// ── Renovación automática de JWT (cada 50 min) ────────────────────────
function _iniciarRefreshToken() {
  clearInterval(_refreshInterval);
  _refreshInterval = setInterval(async () => {
    const rt = _refreshToken || localStorage.getItem('vpos_refreshToken');
    if (!rt) return;
    try {
      const url = _sbUrl(), key = _sbKey();
      const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'apikey': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      });
      const data = await r.json();
      if (data.access_token) {
        _authToken    = data.access_token;
        _refreshToken = data.refresh_token || rt;
        localStorage.setItem('vpos_authToken',    _authToken);
        localStorage.setItem('vpos_refreshToken', _refreshToken);
      }
    } catch(e) { console.warn('[Auth] Refresh token falló:', e); }
  }, 50 * 60 * 1000); // 50 minutos
}

async function restaurarSesion() {
  if (localStorage.getItem('vpos_sesionActiva') !== '1') return;
  const savedToken   = localStorage.getItem('vpos_authToken');
  const savedRefresh = localStorage.getItem('vpos_refreshToken');
  const savedUser    = localStorage.getItem('vpos_usuarioData');
  const savedTienda  = localStorage.getItem('vpos_tiendaId');
  if (!savedToken || !savedUser) return;

  _authToken    = savedToken;
  _refreshToken = savedRefresh || null;
  _tiendaId     = savedTienda;
  _sesionActiva = true;

  // Intentar renovar el token inmediatamente para verificar que sigue válido
  if (savedRefresh) {
    try {
      const url = _sbUrl(), key = _sbKey();
      const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'apikey': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: savedRefresh })
      });
      const data = await r.json();
      if (data.access_token) {
        _authToken    = data.access_token;
        _refreshToken = data.refresh_token || savedRefresh;
        localStorage.setItem('vpos_authToken',    _authToken);
        localStorage.setItem('vpos_refreshToken', _refreshToken);
      }
    } catch(e) {
      console.warn('[Auth] Sin conexión al restaurar — usando caché offline');
    }
  }

  try {
    // SIEMPRE leer perfil fresco desde Supabase para obtener rol actualizado
    const tempUser = JSON.parse(savedUser);
    const perfiles = await _sbGet('perfiles', { select: '*', id: 'eq.' + tempUser.id, activo: 'eq.true' });
    if (!perfiles || !perfiles.length) {
      // Cuenta desactivada — forzar cierre de sesión
      _sesionActiva = false; _tiendaId = null; _usuarioActual = null; _authToken = null; _refreshToken = null;
      localStorage.removeItem('vpos_sesionActiva');
      localStorage.removeItem('vpos_authToken');
      localStorage.removeItem('vpos_refreshToken');
      localStorage.removeItem('vpos_usuarioData');
      setTimeout(() => abrirLogin(), 300);
      return;
    }
    if (perfiles && perfiles.length > 0) {
      _usuarioActual = { ...perfiles[0], email: tempUser.email };
      localStorage.setItem('vpos_usuarioData', JSON.stringify(_usuarioActual));
    }
    _actualizarBadgeLogin();
    _aplicarRestriccionesPorRol();
    _actualizarTabAdmin();
    _actualizarNombreTienda();
    const ml = document.getElementById('modalLogin');
    if (ml) ml.style.display = 'none';
    // Iniciar renovación automática
    _iniciarRefreshToken();
    // Descargar datos frescos de Supabase al restaurar sesión
    _autoCargarDesdeSupa();
    // Iniciar Realtime (WebSocket) + polling fallback
    _iniciarPolling();
    // Check inmediato al restaurar sesión
    setTimeout(_autoFusionar, 800);
  } catch(e) {
    try { _usuarioActual = JSON.parse(savedUser); } catch(e2) {}
    _actualizarBadgeLogin();
    if (_usuarioActual) _aplicarRestriccionesPorRol();
    if (_usuarioActual) _actualizarTabAdmin();
    if (_usuarioActual) _actualizarNombreTienda();
    _iniciarRefreshToken();
  }
}

// Auto-carga directa desde tablas de Supabase al iniciar sesión (sin necesitar snapshot)
async function _autoCargarDesdeSupa() {
  if (!_sbUrl()||!_sbKey()||!_sesionActiva) return;
  try {
    _dot('yellow');

    // ── Productos ──────────────────────────────────────────────────────
    const prods = await _sbGet('productos', { select: '*', tienda_id: 'eq.' + _getTiendaId(), limit: 2000 }).catch(() => null);
    if (prods && prods.length > 0) {
      const sbProds = prods.map(p => ({
        // Strip tenant prefix from Supabase id (format: 'tiendaXXX_numericId')
        id: (()=>{ const raw=String(p.id||''); const u=raw.lastIndexOf('_'); const n=Number(u>=0?raw.slice(u+1):raw); return isNaN(n)?raw:n; })(),
        nom: p.nom || '', cat: p.cat || '',
        compra: Number(p.compra) || 0, venta: Number(p.venta) || 0,
        stock: Number(p.stock) || 0, min: Number(p.min) || 0,
        cod: p.cod || '', abrev: p.abrev || '',
        img: p.img || null, paquetes: p.paquetes || [], lotes: p.lotes || [],
        _ts: Number(p._ts) || 0
      }));
      // MERGE: comparar _ts para saber qué versión es más reciente
      const localById = {};
      (productos||[]).forEach(lp => { localById[String(lp.id)] = lp; });
      const merged = sbProds.map(sp => {
        const local = localById[String(sp.id)];
        if (local) {
          const localInvalido = !(local.nom || '').trim() || (!(local.venta) && !(local.compra));
          if (localInvalido) {
            return {
              ...sp,
              stock: Math.max(Number(sp.stock) || 0, Number(local.stock) || 0),
              img:      local.img || sp.img || null,
              paquetes: (sp.paquetes && sp.paquetes.length) ? sp.paquetes : (local.paquetes || []),
              lotes:    (sp.lotes    && sp.lotes.length)    ? sp.lotes    : (local.lotes    || []),
            };
          }
          // Supabase tiene versión más nueva (editada en otro dispositivo) → usarla
          const localTs = Number(local._ts) || 0;
          const sbTs    = Number(sp._ts)    || 0;
          if (sbTs > localTs) {
            return {
              ...sp,
              stock:    Math.max(Number(sp.stock) || 0, Number(local.stock) || 0),
              img:      sp.img || local.img || null,  // Supabase tiene versión más nueva → usar su imagen
              paquetes: (local.paquetes && local.paquetes.length) ? local.paquetes : (sp.paquetes || []),
              lotes:    (local.lotes    && local.lotes.length)    ? local.lotes    : (sp.lotes    || []),
            };
          }
          // Datos locales son más recientes — conservarlos
          return {
            ...local,
            img:      local.img      || sp.img      || null,
            paquetes: (local.paquetes && local.paquetes.length) ? local.paquetes : (sp.paquetes || []),
            lotes:    (local.lotes    && local.lotes.length)    ? local.lotes    : (sp.lotes    || []),
          };
        }
        // Producto nuevo de Supabase que no existe local
        return { ...sp, img: sp.img || null, paquetes: sp.paquetes || [], lotes: sp.lotes || [] };
      });
      // ── FIX BUG 3: filtrar productos eliminados localmente antes de aplicar ──
      const eliminados = typeof productosEliminados !== 'undefined' ? new Set((productosEliminados||[]).map(String)) : new Set();
      const mergedFiltrado = merged.filter(p => !eliminados.has(String(p.id)));

      // ── conservar productos que solo existen en local (no sincronizados aún) ──
      const sbIds = new Set(sbProds.map(p => String(p.id)));
      const soloLocales = (productos||[]).filter(lp => !sbIds.has(String(lp.id)) && !eliminados.has(String(lp.id)));
      productos = [...mergedFiltrado, ...soloLocales];
      if (soloLocales.length > 0) {
        console.log('[AutoCarga] ⚠️ Preservando', soloLocales.length, 'productos locales no sincronizados — re-subiendo a Supabase…');
        setTimeout(() => _subirStockBase().catch(e => console.warn('[AutoCarga] re-upload local:', e.message)), 3000);
      }
      idbSet('vpos_productos', productos).catch(() => {});
      idbSet('vpos_productosEliminados', typeof productosEliminados !== 'undefined' ? productosEliminados : []).catch(() => {});
      console.log('[AutoCarga] Productos:', productos.length, '(Supabase:', prods.length, '| solo local:', soloLocales.length + ', eliminados filtrados:', (merged.length - mergedFiltrado.length) + ')');
    } else if (productos && productos.length > 0) {
      await _subirStockBase();
    }

    // ── Ventas / Historial ─────────────────────────────────────────────
    const ventas = await _sbGet('ventas', { select: '*', tienda_id: 'eq.' + _getTiendaId(), order: 'fecha_iso.desc', limit: 1000 }).catch(() => null);
    if (ventas && ventas.length > 0) {
      historial = ventas.map(v => {
        // Parsear items_json (array completo) con fallback a items texto
        let items = [];
        if (v.items_json) {
          try {
            const parsed = typeof v.items_json === 'string' ? JSON.parse(v.items_json) : v.items_json;
            if (Array.isArray(parsed)) items = parsed;
          } catch(e) {}
        }
        // Si items_json no vino, intentar reconstruir desde el string "2x Arroz | 1x Frijol"
        if (!items.length && v.items && typeof v.items === 'string') {
          items = v.items.split('|').map(s => s.trim()).filter(Boolean).map(s => {
            const m = s.match(/^(\d+)x\s+(.+)$/);
            if (m) {
              const nom = m[2].trim();
              const p   = (typeof productos !== 'undefined' ? productos : []).find(x => x.nom === nom);
              return { id: p ? String(p.id) : null, nom, cant: Number(m[1]) || 1, precio: p ? p.venta : 0, cat: p ? p.cat : '' };
            }
            return null;
          }).filter(Boolean);
        }
        const fechaISO = v.fecha_iso || v.fecha || new Date().toISOString();
        return {
          id: v.id,
          fecha: fechaISO,
          fechaISO,
          ts: Date.parse(fechaISO) || 0,
          total: Number(v.total) || 0,
          pago: Number(v.pago) || 0,
          vuelto: Number(v.vuelto) || 0,
          items,
          items_json: v.items_json || null
        };
      });
      historial.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      if (typeof normalizeHistorial === 'function') historial = normalizeHistorial(historial);
      idbSet('vpos_historial', historial).catch(() => {});
      console.log('[AutoCarga] Ventas:', ventas.length);

      // ── RECALCULAR ventasDia / ventasSem / ventasMes desde historial ──
      // FIX SYNC: usar _recalcularReportesDesdeHistorial() para respetar el timestamp
      // del último reset manual del día (vpos_reinicioDiaTs), igual que en app.js.
      // Esto garantiza que si otro teléfono hizo "Reiniciar día", al cargar desde
      // Supabase no se restauren ventas anteriores al corte.
      if (typeof _recalcularReportesDesdeHistorial === 'function') {
        _recalcularReportesDesdeHistorial();
      } else {
        // Fallback por si app.js no cargó aún
        const hoy    = new Date().toDateString();
        const lunes  = _lunesDeLaSemana();
        const ahora  = new Date();
        ventasDia = {}; ventasSem = {}; ventasMes = {};
        historial.forEach(v => {
          if (!v.fechaISO && !v.fecha) return;
          const fecha = new Date(v.fechaISO || v.fecha);
          const esHoy = fecha.toDateString() === hoy;
          const esSem = fecha >= lunes;
          const esMes = fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
          (v.items || []).forEach(it => {
            const pid  = String(it.id || ''); if (!pid || pid === 'null') return;
            const cant = Number(it.cant || 0);
            const tot  = cant * Number(it.precio || 0);
            const base = { id: pid, nom: it.nom || '', cat: it.cat || '', cant: 0, total: 0 };
            if (esHoy) { if (!ventasDia[pid]) ventasDia[pid] = {...base}; ventasDia[pid].cant += cant; ventasDia[pid].total += tot; }
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
      idbSet('vpos_ventasDia', ventasDia).catch(() => {});
      idbSet('vpos_ventasSem', ventasSem).catch(() => {});
      idbSet('vpos_ventasMes', ventasMes).catch(() => {});
    }

    // ── Pagos ──────────────────────────────────────────────────────────
    const pagosData = await _sbGet('pagos', { select: '*', tienda_id: 'eq.' + _getTiendaId(), order: 'fecha_iso.desc', limit: 500 }).catch(() => null);
    if (pagosData && pagosData.length > 0) {
      // Filtrar pagos que el usuario eliminó localmente (evita que vuelvan desde Supabase)
      const eliminadosPagos = typeof pagosEliminados !== 'undefined' ? new Set((pagosEliminados||[]).map(String)) : new Set();
      // Intentar borrar en Supabase los que aún no se borraron (ej: estaban offline al eliminar)
      if (eliminadosPagos.size > 0) {
        for (const pid of eliminadosPagos) {
          try { await _sbDeleteFiltro('pagos', { id: 'eq.' + pid }); } catch(e) {}
        }
      }
      pagos = pagosData
        .filter(p => !eliminadosPagos.has(String(p.id)))
        .map(p => ({
          // FIX: normalizar id siempre a string para que borrarGasto() lo filtre bien
          id: String(p.id),
          fechaISO: p.fecha_iso || p.fecha || new Date().toISOString(),
          fecha: p.fecha_iso || p.fecha || new Date().toISOString(),
          fechaStr: p.fecha_iso ? new Date(p.fecha_iso).toLocaleString('es-SV') : (p.fecha ? new Date(p.fecha).toLocaleString('es-SV') : '—'),
          ts: Date.parse(p.fecha_iso || p.fecha || '') || 0,
          monto: Number(p.monto) || 0,
          // FIX: mapear nom → concepto para que renderPagos muestre la descripción
          concepto: p.nom || p.nota || p.concepto || '',
          cat: p.cat || 'GASTO', nom: p.nom || '', nota: p.nota || ''
        }));
      if (typeof normalizePagos === 'function') pagos = normalizePagos(pagos);
      idbSet('vpos_pagos', pagos).catch(() => {});
    }

    // ── Restock log ────────────────────────────────────────────────────
    const restock = await _sbGet('restock_log', { select: '*', tienda_id: 'eq.' + _getTiendaId(), order: 'ts.desc', limit: 500 }).catch(() => null);
    if (restock && restock.length > 0) {
      restockLog = restock.map(r => ({
        id: r.id, ts: r.ts, prodId: r.prod_id,
        cant: r.cant, precioCompra: r.precio_compra, fechaStr: r.fecha_str
      }));
      idbSet('vpos_restockLog', restockLog).catch(() => {});
    }

    // ── Ventas diarias ─────────────────────────────────────────────────
    const vd = await _sbGet('ventas_diarias', { select: '*', tienda_id: 'eq.' + _getTiendaId(), order: 'fecha.desc', limit: 365 }).catch(() => null);
    if (vd && vd.length > 0) {
      // FIX race condition: NO reemplazar ciegamente. Supabase puede tener un valor
      // desactualizado si el upload de la venta reciente aún no terminó. Mergear
      // por fecha tomando el monto mayor para no retroceder ventas ya registradas.
      vd.forEach(row => {
        const sbMonto = Number(row.monto) || 0;
        const idx = ventasDiarias.findIndex(v => v.fecha === row.fecha);
        if (idx >= 0) {
          // Solo actualizar si Supabase trae un valor mayor (otro dispositivo vendió más)
          if (sbMonto > Number(ventasDiarias[idx].monto || 0)) {
            ventasDiarias[idx].monto = sbMonto;
          }
          // Conservar nota de Supabase si no hay una local
          if (!ventasDiarias[idx].nota && row.nota) ventasDiarias[idx].nota = row.nota;
        } else {
          // Fecha que no existe localmente → agregarla desde Supabase
          ventasDiarias.push({ fecha: row.fecha, monto: sbMonto, nota: row.nota || '' });
        }
      });
      ventasDiarias.sort((a, b) => a.fecha.localeCompare(b.fecha));
      idbSet('vpos_ventasDiarias', ventasDiarias).catch(() => {});
    }

    // ── Config ─────────────────────────────────────────────────────────
    const cfg = await _sbGet('config', { select: '*', tienda_id: 'eq.' + _getTiendaId() }).catch(() => null);
    if (cfg && cfg.length > 0) {
      cfg.forEach(row => {
        if (row.clave === 'efectivoInicial') {
          efectivoInicial = parseFloat(row.valor) || 0;
          idbSet('vpos_efectivoInicial', efectivoInicial).catch(() => {});
          const el = document.getElementById('inpEfectivoInicial');
          if (el) el.value = efectivoInicial > 0 ? efectivoInicial : '';
        }
        if (row.clave === 'inventarioInicial') {
          inventarioInicial = parseFloat(row.valor) || 0;
          idbSet('vpos_inventarioInicial', inventarioInicial).catch(() => {});
          const el = document.getElementById('inpInventarioInicial');
          if (el) el.value = inventarioInicial > 0 ? inventarioInicial : '';
        }
      });
    }

    if (typeof actualizarTodo === 'function') actualizarTodo();
    _dot('green');
    console.log('[AutoCarga] ✅ Supabase → datos frescos aplicados. ventasDia/Sem/Mes recalculados.');
  } catch(e) {
    console.warn('[AutoCarga] Sin conexión a Supabase, usando caché IDB:', e.message);
    _dot('red');
  }
}

// =====================================================================
//  🔒 CONTROL DE ACCESO POR ROL
// =====================================================================

function _aplicarRestriccionesPorRol() {
  if (!_usuarioActual) return;
  const esSuperAdmin = _esSuperAdmin();
  const rol = _usuarioActual.rol || 'cajero';
  const esCajero     = rol === 'cajero';
  const esSupervisor = rol === 'supervisor';
  const esAdmin      = rol === 'admin';

  // Super admins (Santiago y Madelline) ven TODO sin restricciones
  if (esSuperAdmin) {
    // Mostrar badge de super admin
    _actualizarBadgeRol();
    return;
  }

  if (esCajero) {
    // Cajero: solo puede ver Venta y Ventas por Día — ocultar todo lo demás
    ['pgReportes','pgInventario','pgSync','pgFinanzasMes','pgCierreDia'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.nav-tab, .drawer-nav-item').forEach(tab => {
      const onclick = tab.getAttribute('onclick') || '';
      if (['pgReportes','pgInventario','pgSync','pgFinanzasMes','pgCierreDia'].some(p => onclick.includes(p))) {
        tab.style.display = 'none';
      }
    });
    // Ocultar backup bar (exportar, restaurar, fusionar)
    const backupBar = document.querySelector('.backup-bar');
    if (backupBar) backupBar.style.display = 'none';
    // Ocultar botones de corte y reportes (pos_pro.js)
    ['btnCorteCajaNv','btnReporteNv'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    // Cajero SÍ puede ver Ventas por Día — asegurar que esté visible
    const dniVD = document.getElementById('dniVentasDiarias');
    if (dniVD) dniVD.style.display = '';
    const tabVD = document.querySelector('.nav-tab[onclick*="pgVentasDiarias"]');
    if (tabVD) tabVD.style.display = '';
  } else if (esSupervisor) {
    // Supervisor: puede ver inventario y reportes, no puede config ni usuarios
    const pgSync = document.getElementById('pgSync');
    if (pgSync) pgSync.style.display = 'none';
    document.querySelectorAll('.nav-tab, .drawer-nav-item').forEach(tab => {
      const onclick = tab.getAttribute('onclick') || '';
      if (onclick.includes('pgSync')) tab.style.display = 'none';
    });
    document.querySelectorAll('.btn-backup, .btn-restore').forEach(btn => {
      const oc = btn.getAttribute('onclick') || '';
      if (oc.includes('exportarDatos') || oc.includes('inputImportar') || oc.includes('inputFusionar')) {
        btn.style.display = 'none';
      }
    });
    // Supervisor puede usar corte de caja y reportes
    ['btnCorteCajaNv','btnReporteNv'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = '';
    });
  } else {
    // Admin de tienda (cliente con membresía): solo ve Venta, Inventario, Reportes, Ventas x Día
    const pgsOcultar = ['pgSync', 'pgDestacados', 'pgFinanzasMes', 'pgCierreDia'];
    pgsOcultar.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.nav-tab, .drawer-nav-item').forEach(tab => {
      const onclick = tab.getAttribute('onclick') || '';
      if (pgsOcultar.some(p => onclick.includes(p))) tab.style.display = 'none';
    });
    // Ocultar Backup, Restaurar, Fusionar
    document.querySelectorAll('.btn-backup, .btn-restore').forEach(btn => {
      const oc  = btn.getAttribute('onclick') || '';
      const txt = (btn.textContent || '').trim();
      if (oc.includes('exportarDatos') || oc.includes('inputImportar') || oc.includes('inputFusionar') ||
          txt.includes('Backup') || txt.includes('Restaurar') || txt.includes('Fusionar')) {
        btn.style.display = 'none';
      }
    });
  }

  // Actualizar badge de rol en el botón de sesión
  _actualizarBadgeRol();
}

function _actualizarBadgeRol() {
  if (!_usuarioActual) return;
  const rol = _usuarioActual.rol || 'cajero';
  const rolInfo = ROLES[rol] || ROLES.cajero;
  document.querySelectorAll('.login-status').forEach(el => {
    el.innerHTML = `<span style="background:${rolInfo.color}22;color:${rolInfo.color};border-radius:6px;padding:2px 7px;font-size:11px;font-weight:900;">${rolInfo.label}</span> ${_usuarioActual.nombre || _usuarioActual.email || ''}`;
  });
}

function _quitarRestriccionesPorRol() {
  ['pgReportes','pgInventario','pgVentasDiarias','pgSync','pgFinanzasMes','pgCierreDia'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = '';
  });
  document.querySelectorAll('.nav-tab, .drawer-nav-item').forEach(el => { el.style.display = ''; });
  const backupBar = document.querySelector('.backup-bar');
  if (backupBar) backupBar.style.display = '';
  document.querySelectorAll('.btn-backup, .btn-restore').forEach(btn => { btn.style.display = ''; });
}

function _registrarAccion(accion, detalle) {
  if (!_sbUrl() || !_sbKey() || !_usuarioActual) return;
  _sbPost('acciones_log', {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    tienda_id: _getTiendaId(),
    usuario_id: _usuarioActual.id || '',
    usuario_nom: _usuarioActual.nombre || _usuarioActual.email || '',
    accion, detalle: detalle || '',
    created_at: new Date().toISOString()
  }, false).catch(() => {});
}

// =====================================================================
//  👥 GESTIÓN DE USUARIOS (solo Admin)
// =====================================================================

async function abrirGestionUsuarios() {
  if (!_puedeHacer('usuarios')) { toast('Solo el Admin puede gestionar usuarios', true); return; }
  if (!_sbUrl() || !_sbKey()) { toast('Primero configura Supabase', true); return; }
  const rows = await _sbGet('perfiles', { select: '*', tienda_id: 'eq.' + _getTiendaId(), order: 'created_at.asc' }).catch(() => []);
  if (document.getElementById('modalUsuarios')) document.getElementById('modalUsuarios').remove();
  const modal = document.createElement('div');
  modal.id = 'modalUsuarios';
  modal.className = 'modal';
  const lista = (rows || []).map(u => {
    const rolInfo = ROLES[u.rol] || ROLES.cajero;
    return `<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);margin-bottom:8px;">
      <div style="flex:1;">
        <div style="font-weight:900;font-size:14px;color:var(--text);">${u.nombre}</div>
        <div style="font-size:12px;color:var(--text-muted);">${u.email}</div>
      </div>
      <span style="background:${rolInfo.color};color:#fff;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:900;">${rolInfo.label}</span>
      ${u.id !== _usuarioActual?.id ? `<select onchange="cambiarRolUsuario('${u.id}',this.value)" style="padding:6px;border-radius:8px;border:1px solid var(--border);font-family:Nunito,sans-serif;font-weight:700;font-size:12px;">
        <option value="admin" ${u.rol==='admin'?'selected':''}>Admin</option>
        <option value="cajero" ${u.rol==='cajero'?'selected':''}>Cajero</option>
      </select>` : '<span style="font-size:11px;color:var(--text-muted);">(tú)</span>'}
    </div>`;
  }).join('');
  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-header" style="background:linear-gradient(135deg,#4c1d95,#7c3aed);">
        <h3 style="color:#fff;">👥 Usuarios de la tienda</h3>
        <button class="btn-close" onclick="cerrarModal('modalUsuarios')" style="background:rgba(255,255,255,0.15);color:#fff;">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:12px;">Los usuarios se registran desde el botón "Sesion" → "Registrarse"</div>
        ${lista || '<div style="text-align:center;color:var(--text-muted);padding:20px;">No hay usuarios</div>'}
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModal('modalUsuarios'); });
  abrirModal('modalUsuarios');
}

async function cambiarRolUsuario(userId, nuevoRol) {
  await _sbPost('perfiles', { id: userId, rol: nuevoRol }, true);
  _registrarAccion('cambiar_rol', userId + ' -> ' + nuevoRol);
  toast('Rol actualizado');
}

async function verRegistroAcciones() {
  if (!_puedeHacer('reportes')) { toast('Solo el Admin puede ver el registro', true); return; }
  const rows = await _sbGet('acciones_log', {
    select: '*', tienda_id: 'eq.' + _getTiendaId(), order: 'created_at.desc', limit: 100
  }).catch(() => []);
  if (document.getElementById('modalAcciones')) document.getElementById('modalAcciones').remove();
  const modal = document.createElement('div');
  modal.id = 'modalAcciones';
  modal.className = 'modal';
  const lista = (rows || []).map(a => {
    const fecha = a.created_at ? new Date(a.created_at).toLocaleString('es-SV') : '';
    return `<div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start;">
      <div style="flex:1;">
        <span style="font-weight:900;font-size:13px;color:var(--text);">${a.usuario_nom}</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:6px;">${a.accion}</span>
        ${a.detalle ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+a.detalle+'</div>' : ''}
      </div>
      <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${fecha}</span>
    </div>`;
  }).join('');
  modal.innerHTML = `
    <div class="modal-box" style="max-width:500px;">
      <div class="modal-header" style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);">
        <h3 style="color:#fff;">📋 Registro de Acciones</h3>
        <button class="btn-close" onclick="cerrarModal('modalAcciones')" style="background:rgba(255,255,255,0.15);color:#fff;">✕</button>
      </div>
      <div class="modal-body" style="padding:0;max-height:70vh;overflow-y:auto;">
        ${lista || '<div style="text-align:center;padding:30px;color:var(--text-muted);">Sin registros</div>'}
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModal('modalAcciones'); });
  abrirModal('modalAcciones');
}

// =====================================================================
//  📤 ENVIAR / FUSIONAR / DESCARGAR
// =====================================================================

async function enviarDatosNube() {
  if (!_sbUrl()||!_sbKey()) { toast('Primero configura Supabase',true); return; }
  if (!_sesionActiva) { toast('Primero inicia sesion',true); return; }
  if (!_puedeHacer('fusionar')) { toast('Solo el Admin puede enviar datos',true); return; }
  if (!confirm('Esto sube todos tus datos actuales a Supabase.\nEl otro telefono podra fusionarlos.\n\n¿Continuar?')) return;
  _dot('yellow'); toast('Subiendo datos...');
  try {
    const snap = { version: typeof APP_SCHEMA_VERSION!=='undefined'?APP_SCHEMA_VERSION:4, exportado: new Date().toISOString(),
      dispositivo: _dispositivoId, efectivoInicial: typeof efectivoInicial!=='undefined'?efectivoInicial:0,
      inventarioInicial: typeof inventarioInicial!=='undefined'?inventarioInicial:0,
      productos, ventasDia, ventasSem, ventasMes, historial, pagos, ventasDiarias, restockLog: restockLog||[] };
    await _sbPost('sync_snapshots', { id: _getTiendaId()+'_'+_dispositivoId, tienda_id: _getTiendaId(),
      dispositivo_id: _dispositivoId, datos: JSON.stringify(snap), created_at: new Date().toISOString() }, true);
    _registrarAccion('enviar_datos', productos.length+' productos');
    _dot('green'); toast('✅ Datos subidos. El otro telefono puede usar "Fusionar y actualizar".');
  } catch(e) { _dot('red'); toast('Error: '+e.message,true); }
}

async function fusionarYActualizar() {
  if (!_sbUrl()||!_sbKey()) { toast('Primero configura Supabase',true); return; }
  if (!_sesionActiva) { toast('Primero inicia sesion',true); return; }
  if (!_puedeHacer('fusionar')) { toast('Solo el Admin puede fusionar datos',true); return; }
  if (!confirm('Fusiona los datos de todos los telefonos con los tuyos.\n¿Continuar?')) return;
  _dot('yellow'); toast('Fusionando...');
  try {
    const todosSnaps = await _sbGet('sync_snapshots', { select:'*', tienda_id:'eq.'+_getTiendaId() });
    if (!todosSnaps||!todosSnaps.length) { toast('No hay datos en Supabase. Usa "Enviar datos" primero.',true); return; }
    const miSnap = { version:4, exportado:new Date().toISOString(), dispositivo:_dispositivoId,
      efectivoInicial:typeof efectivoInicial!=='undefined'?efectivoInicial:0,
      inventarioInicial:typeof inventarioInicial!=='undefined'?inventarioInicial:0,
      productos, ventasDia, ventasSem, ventasMes, historial, pagos, ventasDiarias, restockLog:restockLog||[] };
    const remotos = todosSnaps.filter(s=>s.dispositivo_id!=='fusion'&&s.dispositivo_id!==_dispositivoId)
      .map(s=>{try{return JSON.parse(s.datos);}catch(e){return null;}}).filter(Boolean);
    let resultado = miSnap;
    for (const r of remotos) resultado = _fusionarDos(resultado, r);
    await _aplicarDatos(resultado);
    const fusionId = _getTiendaId()+'_fusionado';
    await _sbPost('sync_snapshots', { id:fusionId, tienda_id:_getTiendaId(), dispositivo_id:'fusion',
      datos:JSON.stringify(resultado), created_at:new Date().toISOString() }, true);
    for (const s of todosSnaps) { if (s.dispositivo_id!=='fusion') { await _sbDeleteFiltro('sync_snapshots',{id:'eq.'+s.id}).catch(()=>{}); } }
    _registrarAccion('fusionar', remotos.length+' telefonos');
    _dot('green'); toast('✅ Fusion completada. El otro telefono puede usar "Descargar datos actualizados".');
  } catch(e) { _dot('red'); toast('Error: '+e.message,true); console.error(e); }
}

async function descargarDatosActualizados() {
  if (!_sbUrl()||!_sbKey()) { toast('Primero configura Supabase',true); return; }
  if (!_sesionActiva) { toast('Primero inicia sesion',true); return; }
  if (!_puedeHacer('fusionar')) { toast('Solo el Admin puede descargar datos',true); return; }
  if (!confirm('Descarga los datos fusionados y reemplaza los tuyos.\n¿Continuar?')) return;
  _dot('yellow'); toast('Descargando...');
  try {
    const fusionId = _getTiendaId()+'_fusionado';
    const rows = await _sbGet('sync_snapshots',{select:'datos',id:'eq.'+fusionId});
    if (!rows||!rows.length) { toast('No hay datos fusionados. Usa "Fusionar y actualizar" primero.',true); return; }
    await _aplicarDatos(JSON.parse(rows[0].datos));
    setTimeout(async()=>{
      try {
        const nuevoSnap = { version:4, exportado:new Date().toISOString(), dispositivo:_dispositivoId,
          efectivoInicial:typeof efectivoInicial!=='undefined'?efectivoInicial:0,
          inventarioInicial:typeof inventarioInicial!=='undefined'?inventarioInicial:0,
          productos,ventasDia,ventasSem,ventasMes,historial,pagos,ventasDiarias,restockLog:restockLog||[] };
        await _sbPost('sync_snapshots',{id:_getTiendaId()+'_'+_dispositivoId,tienda_id:_getTiendaId(),
          dispositivo_id:_dispositivoId,datos:JSON.stringify(nuevoSnap),created_at:new Date().toISOString()},true);
        await _sbDeleteFiltro('sync_snapshots',{id:'eq.'+fusionId});
      } catch(e){}
    },1000);
    _registrarAccion('descargar_datos','');
    _dot('green');
  } catch(e) { _dot('red'); toast('Error: '+e.message,true); }
}

async function limpiarSupabase() {
  if (!_puedeHacer('config')) { toast('Solo el Admin puede limpiar Supabase',true); return; }
  if (!_sbUrl()||!_sbKey()) { toast('Primero configura Supabase',true); return; }
  if (!document.getElementById('modalLimpiarSupa')) {
    const m = document.createElement('div');
    m.id = 'modalLimpiarSupa';
    m.style.cssText = 'position:fixed;inset:0;z-index:10070;background:rgba(5,46,22,0.75);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:16px;';
    m.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,0.4);overflow:hidden;animation:loginSlideUp 0.3s cubic-bezier(0.22,1,0.36,1);">
        <div style="background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:22px 24px 18px;text-align:center;">
          <div style="font-size:36px;margin-bottom:10px;">\u26a0\ufe0f</div>
          <div style="color:#fff;font-size:17px;font-weight:900;font-family:Nunito,sans-serif;">Limpiar base de datos</div>
          <div style="color:rgba(255,255,255,0.75);font-size:12px;font-weight:700;font-family:Nunito,sans-serif;margin-top:4px;">Esta acci\u00f3n no se puede deshacer</div>
        </div>
        <div style="padding:22px 24px;">
          <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:14px 16px;margin-bottom:18px;font-size:13px;font-weight:700;color:#991b1b;font-family:Nunito,sans-serif;line-height:1.6;">
            Esto borrará <strong>TODOS</strong> los datos de Supabase (ventas, pagos, productos, logs) y reseteará el <strong>efectivo e inventario inicial</strong> a $0. Los demás datos de este teléfono no se borran.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button onclick="document.getElementById('modalLimpiarSupa').style.display='none'"
              style="padding:13px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;color:#374151;">
              \u2715 Cancelar
            </button>
            <button id="btnConfirmarLimpiar" onclick="_ejecutarLimpiarSupabase()"
              style="padding:13px;background:linear-gradient(135deg,#dc2626,#991b1b);border:none;border-radius:12px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;color:#fff;box-shadow:0 4px 14px rgba(220,38,38,0.3);">
              \U0001f5d1 S\u00ed, borrar todo
            </button>
          </div>
        </div>
      </div>`;
    m.addEventListener('click', e => { if(e.target===m) m.style.display='none'; });
    document.body.appendChild(m);
  }
  document.getElementById('modalLimpiarSupa').style.display = 'flex';
}

async function _ejecutarLimpiarSupabase() {
  const btn = document.getElementById('btnConfirmarLimpiar');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Limpiando…'; }
  document.getElementById('modalLimpiarSupa').style.display='none';
  _dot('yellow'); toast('Limpiando Supabase...');
  try {
    const tablas = ['sync_snapshots','sync_invites','ventas','pagos','restock_log','deleted_log','acciones_log'];
    for (const t of tablas) {
      await fetch(_sbUrl()+'/rest/v1/'+t+'?id=neq.null',{method:'DELETE',headers:_headers({'Prefer':'return=minimal'})}).catch(()=>{});
      await fetch(_sbUrl()+'/rest/v1/'+t+'?fecha=neq.null',{method:'DELETE',headers:_headers({'Prefer':'return=minimal'})}).catch(()=>{});
    }
    await fetch(_sbUrl()+'/rest/v1/ventas_diarias?fecha=neq.null',{method:'DELETE',headers:_headers({'Prefer':'return=minimal'})}).catch(()=>{});
    await fetch(_sbUrl()+'/rest/v1/productos?id=neq.null',{method:'DELETE',headers:_headers({'Prefer':'return=minimal'})}).catch(()=>{});

    // ── Limpiar finanzas y cierres en Supabase ──────────────────────────
    const tid = _getTiendaId();
    if (tid) {
      await fetch(_sbUrl()+'/rest/v1/finanzas_mes?tienda_id=eq.'+encodeURIComponent(tid),{method:'DELETE',headers:_headers({'Prefer':'return=minimal'})}).catch(()=>{});
      await fetch(_sbUrl()+'/rest/v1/cierre_diario?tienda_id=eq.'+encodeURIComponent(tid),{method:'DELETE',headers:_headers({'Prefer':'return=minimal'})}).catch(()=>{});
    }

    // ── Resetear efectivo e inventario inicial en IDB y UI ──────────────
    if (typeof window.efectivoInicial !== 'undefined')   window.efectivoInicial   = 0;
    if (typeof window.inventarioInicial !== 'undefined') window.inventarioInicial = 0;
    if (typeof idbSet === 'function') {
      await idbSet('vpos_efectivoInicial',   0).catch(()=>{});
      await idbSet('vpos_inventarioInicial', 0).catch(()=>{});
    }
    const inpEf  = document.getElementById('inpEfectivoInicial');
    const inpInv = document.getElementById('inpInventarioInicial');
    if (inpEf)  inpEf.value  = '';
    if (inpInv) inpInv.value = '';
    if (typeof renderCajaPanel === 'function') renderCajaPanel();
    if (typeof renderReportes  === 'function') renderReportes();

    _dot('green'); toast('✅ Supabase limpiado. Efectivo e inventario inicial reseteados.');
  } catch(e) { _dot('red'); toast('Error: '+e.message,true); }
  finally { if(btn){btn.disabled=false;btn.textContent='🗑 Sí, borrar todo';} }
}
window._ejecutarLimpiarSupabase = _ejecutarLimpiarSupabase;
// =====================================================================
//  FUSIÓN (misma lógica de antes)
// =====================================================================

function _fusionarDos(local, ext) {
  const idsCobrosLocal=new Set((local.historial||[]).map(v=>v.id));
  const idsCobrosExt=new Set((ext.historial||[]).map(v=>v.id));

  // FIX BUG 3: unir las listas de eliminados de ambos dispositivos
  const eliminadosLocal = new Set((local.productosEliminados||[]).map(String));
  const eliminadosExt   = new Set((ext.productosEliminados||[]).map(String));
  const todosEliminados = new Set([...eliminadosLocal, ...eliminadosExt]);

  // Primero filtrar productos locales que el otro dispositivo también borró
  local.productos = (local.productos||[]).filter(p => !eliminadosExt.has(String(p.id)));

  const idsLocal=new Set((local.productos||[]).map(p=>String(p.id)));
  // Solo agregar productos externos que NO están en la lista de eliminados
  (ext.productos||[]).forEach(ep=>{
    const eid = String(ep.id);
    if(!idsLocal.has(eid) && !todosEliminados.has(eid)){
      // FIX BUG 2: preservar imagen local si existe, traer la del externo si no
      local.productos.push(ep);
      idsLocal.add(eid);
    }
  });

  // FIX: para productos que ya están en local, si tienen datos vacíos (corruptos),
  // usar los datos del externo como base (más completos).
  local.productos = local.productos.map(lp => {
    const extP = (ext.productos||[]).find(ep => String(ep.id) === String(lp.id));
    if (!extP) return lp;
    const localInvalido = !(lp.nom || '').trim() || (!(lp.venta) && !(lp.compra));
    if (localInvalido && extP) {
      // Datos externos más completos — usarlos como base, preservar stock local si mayor
      return {
        ...extP,
        stock: Math.max(Number(extP.stock) || 0, Number(lp.stock) || 0),
        img: lp.img || extP.img || null,
      };
    }
    // Datos locales válidos — comparar _ts para saber qué imagen es más reciente
    const localTs = Number(lp._ts) || 0;
    const extTs   = Number(extP._ts) || 0;
    // Tomar la imagen del lado más reciente; si hay empate, preferir cualquier imagen
    if (extTs > localTs && extP.img) return { ...lp, ...extP, img: extP.img, stock: Math.max(Number(lp.stock)||0, Number(extP.stock)||0) };
    if (!lp.img && extP.img) return { ...lp, img: extP.img };
    return lp;
  });

  // Persistir la lista unificada de eliminados
  local.productosEliminados = [...todosEliminados];

  const seenH=new Set((local.historial||[]).map(v=>v.id));
  (ext.historial||[]).forEach(v=>{if(!seenH.has(v.id)){local.historial.push(v);seenH.add(v.id);}});
  local.historial.sort((a,b)=>(b.ts||0)-(a.ts||0));
  const hoy=new Date().toDateString(), lunes=_lunesDeLaSemana(), ahora=new Date();

  // FIX Bug 1: respetar reinicioDiaTs al recalcular ventasDia.
  // Tomamos el timestamp de reset MÁS RECIENTE entre local, ext y localStorage.
  const tsLocal2  = local.reinicioDiaTs  || localStorage.getItem('vpos_reinicioDiaTs')  || '';
  const tsExt2    = ext.reinicioDiaTs    || '';
  const tsResetFusion = tsLocal2 > tsExt2 ? tsLocal2 : tsExt2;
  const resetCutoff   = tsResetFusion ? new Date(tsResetFusion) : null;
  // Propagar el timestamp ganador al snapshot resultante
  if (tsResetFusion) {
    local.reinicioDiaTs   = tsResetFusion;
    local.reinicioDiaFecha = local.reinicioDiaFecha || ext.reinicioDiaFecha || new Date().toDateString();
  }

  local.ventasDia={}; local.ventasSem={}; local.ventasMes={};
  local.historial.forEach(v=>{
    if(!v.fechaISO&&!v.fecha) return;
    const fecha=new Date(v.fechaISO||v.fecha);
    const esHoy=fecha.toDateString()===hoy, esSem=fecha>=lunes;
    const esMes=fecha.getMonth()===ahora.getMonth()&&fecha.getFullYear()===ahora.getFullYear();
    // Si hubo reset manual hoy, ignorar ventas anteriores al corte en ventasDia
    const pasaCorte = !esHoy || !resetCutoff || fecha >= resetCutoff;
    (v.items||[]).forEach(it=>{
      const pid=String(it.id||''); if(!pid) return;
      const cant=Number(it.cant||0), total=cant*Number(it.precio||0);
      const base={id:pid,nom:it.nom||'',cat:it.cat||'',cant:0,total:0};
      if(esHoy&&pasaCorte){if(!local.ventasDia[pid])local.ventasDia[pid]={...base};local.ventasDia[pid].cant+=cant;local.ventasDia[pid].total+=total;}
      if(esSem){if(!local.ventasSem[pid])local.ventasSem[pid]={...base};local.ventasSem[pid].cant+=cant;local.ventasSem[pid].total+=total;}
      if(esMes){if(!local.ventasMes[pid])local.ventasMes[pid]={...base};local.ventasMes[pid].cant+=cant;local.ventasMes[pid].total+=total;}
    });
  });
  const seenP=new Set((local.pagos||[]).map(g=>String(g.id)));
  (ext.pagos||[]).forEach(g=>{if(!seenP.has(String(g.id))){local.pagos.push(g);seenP.add(String(g.id));}});
  if(!local.ventasDiarias) local.ventasDiarias=[];
  (ext.ventasDiarias||[]).forEach(vExt=>{
    const idx=local.ventasDiarias.findIndex(vL=>vL.fecha===vExt.fecha);
    if(idx>=0){if(Number(vExt.monto)>Number(local.ventasDiarias[idx].monto))local.ventasDiarias[idx].monto=Number(vExt.monto);}
    else local.ventasDiarias.push({...vExt});
  });
  local.ventasDiarias.sort((a,b)=>a.fecha.localeCompare(b.fecha));
  if(!local.restockLog) local.restockLog=[];
  const seenR=new Set(local.restockLog.map(r=>r.id));
  (ext.restockLog||[]).forEach(r=>{if(!seenR.has(r.id)){local.restockLog.push(r);seenR.add(r.id);}});
  local.restockLog.sort((a,b)=>(a.ts||0)-(b.ts||0));
  (local.productos||[]).forEach(p=>{
    const pid=String(p.id);
    const extProd=(ext.productos||[]).find(ep=>String(ep.id)===pid);
    const stockLocal=p.stock||0, stockExt=extProd?(extProd.stock||0):0;
    let vendioLocal=0;
    (local.historial||[]).forEach(v=>{if(idsCobrosLocal.has(v.id)&&!idsCobrosExt.has(v.id))(v.items||[]).forEach(it=>{if(String(it.id)===pid)vendioLocal+=Number(it.cant||0);});});
    let vendioExt=0;
    (ext.historial||[]).forEach(v=>{if(idsCobrosExt.has(v.id)&&!idsCobrosLocal.has(v.id))(v.items||[]).forEach(it=>{if(String(it.id)===pid)vendioExt+=Number(it.cant||0);});});
    const stockBase=Math.max(stockLocal+vendioLocal,extProd?(stockExt+vendioExt):(stockLocal+vendioLocal));
    p.stock=Math.max(0,stockBase-vendioLocal-vendioExt);
  });
  local.efectivoInicial=Math.max(parseFloat(local.efectivoInicial||0),parseFloat(ext.efectivoInicial||0));
  local.inventarioInicial=Math.max(parseFloat(local.inventarioInicial||0),parseFloat(ext.inventarioInicial||0));
  return local;
}

function _lunesDeLaSemana(){const hoy=new Date(),dia=hoy.getDay(),diff=dia===0?-6:1-dia,lunes=new Date(hoy);lunes.setDate(hoy.getDate()+diff);lunes.setHours(0,0,0,0);return lunes;}

async function _aplicarDatos(datos) {
  if (!datos||!datos.productos) return;

  // FIX BUG 2: antes de aplicar, mapear imágenes locales por id para preservarlas
  const imgsPorId = {};
  (typeof productos !== 'undefined' ? productos : []).forEach(p => {
    if (p.img) imgsPorId[String(p.id)] = p.img;
  });

  // Aplicar datos en memoria (fuente de verdad viene de Supabase/snapshot)
  productos=datos.productos||[]; ventasDia=datos.ventasDia||{}; ventasSem=datos.ventasSem||{};
  ventasMes=datos.ventasMes||{}; historial=datos.historial||[]; pagos=datos.pagos||[];
  ventasDiarias=datos.ventasDiarias||[]; restockLog=datos.restockLog||[];

  // FIX BUG 3: restaurar lista de eliminados desde el snapshot
  if (typeof productosEliminados !== 'undefined') {
    const eliminadosSnap = datos.productosEliminados || [];
    // Unir con los eliminados locales que ya teníamos
    const union = new Set([...productosEliminados, ...eliminadosSnap.map(String)]);
    productosEliminados = [...union];
    // Aplicar filtro: quitar productos que están en la lista de eliminados
    productos = productos.filter(p => !union.has(String(p.id)));
  }

  // FIX BUG 2: restaurar imágenes locales que el snapshot no trae (img: null en snapshot)
  productos = productos.map(p => ({
    ...p,
    img: p.img || imgsPorId[String(p.id)] || null
  }));

  if(typeof normalizeReport==='function'){ventasDia=normalizeReport(ventasDia);ventasSem=normalizeReport(ventasSem);ventasMes=normalizeReport(ventasMes);}
  if(typeof normalizeHistorial==='function') historial=normalizeHistorial(historial);
  if(typeof normalizePagos==='function') pagos=normalizePagos(pagos);
  // FIX SYNC: aplicar timestamp de reset del día desde el snapshot remoto
  // Si el snapshot de otro teléfono tiene un reset más reciente, adoptarlo para que
  // _recalcularReportesDesdeHistorial() excluya las ventas anteriores al corte.
  if (datos.reinicioDiaTs && datos.reinicioDiaFecha) {
    const tsLocal  = localStorage.getItem('vpos_reinicioDiaTs')  || '';
    const tsRemoto = datos.reinicioDiaTs;
    if (tsRemoto > tsLocal) {
      localStorage.setItem('vpos_reinicioDiaTs',   tsRemoto);
      localStorage.setItem('vpos_reinicioDiaFecha', datos.reinicioDiaFecha);
      // Recalcular ventasDia respetando el nuevo corte
      if (typeof _recalcularReportesDesdeHistorial === 'function') _recalcularReportesDesdeHistorial();
    }
  }
  if(datos.efectivoInicial!==undefined){efectivoInicial=parseFloat(datos.efectivoInicial)||0;idbSet('vpos_efectivoInicial',efectivoInicial).catch(()=>{});const el=document.getElementById('inpEfectivoInicial');if(el)el.value=efectivoInicial>0?efectivoInicial:'';}
  if(datos.inventarioInicial!==undefined){inventarioInicial=parseFloat(datos.inventarioInicial)||0;idbSet('vpos_inventarioInicial',inventarioInicial).catch(()=>{});const el=document.getElementById('inpInventarioInicial');if(el)el.value=inventarioInicial>0?inventarioInicial:'';}
  // Actualizar caché IDB en paralelo (no bloquea la UI)
  idbSetMany([
    ['vpos_productos',productos],['vpos_ventasDia',ventasDia],['vpos_ventasSem',ventasSem],
    ['vpos_ventasMes',ventasMes],['vpos_historial',historial],['vpos_pagos',pagos],
    ['vpos_ventasDiarias',ventasDiarias],['vpos_restockLog',restockLog],
    ['vpos_productosEliminados', typeof productosEliminados !== 'undefined' ? productosEliminados : []]
  ]).catch(()=>{});
  actualizarTodo();
  toast('✅ '+productos.length+' productos cargados correctamente',false,true);
}

// =====================================================================
//  📵 MODO OFFLINE ROBUSTO
//  Detecta conexión, guarda operaciones en IDB, las replaya al volver
// =====================================================================

let _estaOnline       = navigator.onLine;
let _flushingQueue    = false;
let _offlineListener  = false;

// ── Modo "Usar sin internet" — almacenamiento solo local ─────────────
let _modoSoloLocal = localStorage.getItem('vpos_modoSoloLocal') === '1';

// ── Detectar y reaccionar a cambios de conexión ───────────────────────
function _iniciarDetectorConexion() {
  if (_offlineListener) return;
  _offlineListener = true;

  const alOnline = async () => {
    if (_estaOnline) return;
    _estaOnline = true;
    if (_modoSoloLocal) {
      // En modo solo local: registrar que hay internet pero no sincronizar
      console.log('[Offline] 🌐 Internet disponible — modo local activo, sin sincronizar');
      return;
    }
    _setOfflineUI(false);
    console.log('[Offline] 🌐 Conexión restaurada — vaciando cola');
    toast('🌐 Conexión restaurada — sincronizando datos…');
    await _flushOfflineQueue();
    // Retomar Realtime + polling y enviar snapshot
    _realtimeChannel = null; // forzar reconexión del WebSocket
    _iniciarPolling();
    if (typeof _autoEnviarSnapshot === 'function') _autoEnviarSnapshot();
  };

  const alOffline = () => {
    _estaOnline = false;
    _setOfflineUI(true);
    _detenerPolling();
    console.log('[Offline] 📵 Sin conexión — modo offline activado');
  };

  window.addEventListener('online',  alOnline);
  window.addEventListener('offline', alOffline);

  // Estado inicial
  if (!navigator.onLine) {
    _estaOnline = false;
    _setOfflineUI(true);
  }
}

// ── UI del modo offline ───────────────────────────────────────────────
function _setOfflineUI(offline) {
  const banner = document.getElementById('offlineBanner');
  const badge  = document.getElementById('offlineBadge');
  // En modo solo local, no mostrar banner de "sin red" — es intencional
  const mostrar = offline && !_modoSoloLocal;
  if (banner) banner.classList.toggle('visible', mostrar);
  if (badge)  badge.classList.toggle('visible',  mostrar);
  document.body.classList.toggle('offline-mode', mostrar);
  if (!offline) {
    // Resetear contador
    const cnt = document.getElementById('oqCountBadge');
    if (cnt) { cnt.textContent = '0'; cnt.classList.remove('visible'); }
  }
}

async function _actualizarContadorCola() {
  try {
    const n = await oqCount();
    const cnt = document.getElementById('oqCountBadge');
    if (!cnt) return;
    if (n > 0) { cnt.textContent = n; cnt.classList.add('visible'); }
    else        { cnt.classList.remove('visible'); }
  } catch(e) {}
}

// ── Encolar operación para cuando vuelva internet ────────────────────
async function _encolarOffline(operacion, datos) {
  try {
    await oqPush(operacion, datos);
    await _actualizarContadorCola();
    console.log('[Offline] 📥 Encolado:', operacion);
  } catch(e) {
    console.warn('[Offline] Error encolando:', e.message);
  }
}

// ── Vaciar cola cuando vuelve internet ───────────────────────────────
async function _flushOfflineQueue() {
  if (_flushingQueue) return;
  _flushingQueue = true;
  try {
    const pendientes = await oqGetAll();
    if (!pendientes.length) { _flushingQueue = false; return; }

    console.log('[Offline] 🚀 Vaciando', pendientes.length, 'operaciones pendientes');
    let procesados = 0;

    for (const entry of pendientes) {
      try {
        const d = entry.datos;
        switch (entry.operacion) {
          case 'venta':
            await _sbPost('ventas', {
              id: d.id, fecha_iso: d.fechaISO || d.fecha,
              total: parseFloat(d.total) || 0, pago: parseFloat(d.pago) || 0,
              vuelto: parseFloat(d.vuelto) || 0,
              tienda_id: _getTiendaId(),
              items: (Array.isArray(d.items) ? d.items.map(x=>x.cant+'x '+x.nom).join(' | ') : d.items) || ''
            }, true);
            break;
          case 'pago':
            await _sbPost('pagos', {
              id: String(d.id), fecha_iso: d.fechaISO || new Date().toISOString(),
              monto: parseFloat(d.monto) || 0, cat: d.cat || 'GASTO',
              nom: d.nom || d.concepto || '', nota: d.nota || '',
              tienda_id: _getTiendaId()
            }, true);
            break;
          case 'producto':
            await _sbPost('productos', d, true);
            break;
          case 'snapshot':
            await _sbPost('sync_snapshots', d, true);
            break;
          case 'todo':
            await _subirHistorial();
            await _subirStockBase();
            await _subirPagos();
            await _subirVentasDiarias();
            break;
        }
        await oqDelete(entry.id);
        procesados++;
      } catch(e) {
        console.warn('[Offline] Error procesando entrada', entry.id, ':', e.message);
        // No borramos — lo reintentamos la próxima vez
      }
    }

    await _actualizarContadorCola();
    if (procesados > 0) {
      localStorage.setItem('vpos_ultimoSync', new Date().toISOString());
      if (typeof _actualizarBadgeSync === 'function') _actualizarBadgeSync();
      _dot('green');
      toast('✅ ' + procesados + ' operaciones sincronizadas con la nube');
      console.log('[Offline] ✅ Cola vaciada:', procesados, 'de', pendientes.length);
    }
  } catch(e) {
    console.warn('[Offline] Error vaciando cola:', e.message);
  } finally {
    _flushingQueue = false;
  }
}

// ── Verificar si hay conexión antes de llamar a Supabase ─────────────
function _hayConexion() {
  if (_modoSoloLocal) return false; // Modo sin internet: siempre local
  return _estaOnline && navigator.onLine;
}

// ── Toggle modo "Usar sin internet" ──────────────────────────────────
async function toggleModoSoloLocal() {
  _modoSoloLocal = !_modoSoloLocal;
  localStorage.setItem('vpos_modoSoloLocal', _modoSoloLocal ? '1' : '0');
  _actualizarUILocalMode();

  if (!_modoSoloLocal) {
    // Se desactivó el modo local → si hay internet, subir datos pendientes
    if (navigator.onLine) {
      _estaOnline = true;
      _setOfflineUI(false);
      toast('🌐 Modo en línea activado — sincronizando datos…');
      await _flushOfflineQueue();
      _iniciarPolling();
      if (typeof _autoEnviarSnapshot === 'function') _autoEnviarSnapshot();
    } else {
      toast('📡 Modo en línea activado — esperando señal para sincronizar');
    }
  } else {
    // Se activó el modo local
    _detenerPolling();
    _setOfflineUI(false); // Ocultar banner "sin red" pero mostrar indicador local
    _actualizarUILocalMode();
    toast('📱 Modo sin internet activado — datos guardados localmente');
  }
}
window.toggleModoSoloLocal = toggleModoSoloLocal;

function _actualizarUILocalMode() {
  const badge  = document.getElementById('localModeBadge');
  const btnDrw = document.getElementById('btnModoLocalDrawer');
  const btnNav = document.getElementById('btnModoLocalNav');

  if (badge) {
    badge.style.display = _modoSoloLocal ? 'flex' : 'none';
  }
  if (btnDrw) {
    if (_modoSoloLocal) {
      btnDrw.classList.add('modo-local-activo');
      btnDrw.querySelector('.dni-title').textContent  = 'Usar con internet';
      btnDrw.querySelector('.dni-sub').textContent    = 'Sincroniza datos a Supabase';
      btnDrw.querySelector('.dni-icon').textContent   = '🌐';
    } else {
      btnDrw.classList.remove('modo-local-activo');
      btnDrw.querySelector('.dni-title').textContent  = 'Usar sin internet';
      btnDrw.querySelector('.dni-sub').textContent    = 'Guarda datos solo localmente';
      btnDrw.querySelector('.dni-icon').textContent   = '📱';
    }
  }
  if (btnNav) {
    btnNav.textContent   = _modoSoloLocal ? '🌐 En línea' : '📱 Sin internet';
    btnNav.title         = _modoSoloLocal ? 'Volver al modo en línea (Supabase)' : 'Usar almacenamiento local sin internet';
    btnNav.style.background = _modoSoloLocal
      ? 'rgba(245,158,11,0.35)'
      : 'rgba(255,255,255,0.15)';
    btnNav.style.borderColor = _modoSoloLocal
      ? 'rgba(245,158,11,0.7)'
      : 'rgba(255,255,255,0.3)';
  }
}

// =====================================================================
// =====================================================================
let _syncQueue=[],_syncRunning=false,_syncTimer=null,_lastVenta=null;
function syncAhora(tipo,datos){
  if(!_sbUrl()||!_sbKey())return;
  if(tipo==='venta'&&datos)_lastVenta=datos;
  if(!_syncQueue.includes(tipo))_syncQueue.push(tipo);
  clearTimeout(_syncTimer);
  // 80ms — agrupa ráfagas de cambios, pero prácticamente instantáneo para el usuario
  _syncTimer=setTimeout(_ejecutarSync, 80);
}

// Sync universal — sube TODO a Supabase sin importar sesión
async function syncTodo(){
  if(!_sbUrl()||!_sbKey())return;
  clearTimeout(_syncTimer);
  _syncQueue=['todo'];
  await _ejecutarSync();
}
window.syncTodo=syncTodo;
async function _ejecutarSync(){
  if(_syncRunning){setTimeout(_ejecutarSync,1500);return;}
  if(!_syncQueue.length)return;
  if(!_sbUrl()||!_sbKey())return;
  // Sin internet → encolar en IDB y salir sin perder datos
  if(!_hayConexion()){
    await _encolarOffline('todo',{ts:Date.now()});
    _syncQueue=[];
    _dot('red');
    return;
  }
  _syncRunning=true;
  const queue=[..._syncQueue];_syncQueue=[];
  try{
    for(const tipo of queue){
      if(tipo==='venta'&&_lastVenta){
        const v=_lastVenta;_lastVenta=null;
        const itemsArr=Array.isArray(v.items)?v.items:[];
        const itemsStr=itemsArr.length?itemsArr.map(x=>x.cant+'x '+x.nom).join(' | '):(v.items||'');
        // items_json no existe en el schema de Supabase → solo enviar items como texto
        await _sbPost('ventas',{id:v.id,fecha_iso:v.fechaISO||v.fecha||new Date().toISOString(),
          total:parseFloat(v.total)||0,pago:parseFloat(v.pago)||0,vuelto:parseFloat(v.vuelto)||0,
          tienda_id:_getTiendaId(),
          items:itemsStr},true);
      }
      if(tipo==='historial'||tipo==='todo') await _subirHistorial();
      if(tipo==='productos'||tipo==='todo') await _subirStockBase();
      if(tipo==='restock'||tipo==='todo')   await _subirRestockLog();
      if(tipo==='venta_diaria'||tipo==='todo') await _subirVentasDiarias();
      if(tipo==='pagos'||tipo==='todo')     await _subirPagos();
      if(tipo==='config'||tipo==='todo')    await _subirConfig();
    }
    localStorage.setItem('vpos_ultimoSync',new Date().toISOString());
    _actualizarBadgeSync();_dot('green');
  }catch(e){
    console.warn('[Sync]',e.message);
    if(!_hayConexion()||e.message.includes('fetch')||e.message.includes('Network')||e.message.includes('Failed')){
      await _encolarOffline('todo',{ts:Date.now()});
    }
    _dot('red');
  }finally{
    _syncRunning=false;
    if(_syncQueue.length)setTimeout(_ejecutarSync,1000);
  }
}
// =====================================================================
//  🔄 SYNC AUTOMÁTICO EN TIEMPO REAL — usa el mismo mecanismo que funciona
//  Basado en sync_snapshots (igual que los botones manuales que sí funcionan)
// =====================================================================
let _ultimaFechaVenta    = null;
let _ultimaFechaPago     = null;
let _autoSyncSubiendo    = false;
let _autoSyncFusionando  = false;
let _snapTimestamp       = null;


// ── Subir snapshot automático (equivale a "Enviar mis datos a la nube") ──
async function _autoEnviarSnapshot() {
  if (!_sesionActiva || !_sbUrl() || !_sbKey()) return;
  if (_autoSyncSubiendo) return;

  const snap = {
    id: _getTiendaId() + '_' + _dispositivoId,
    tienda_id: _getTiendaId(),
    dispositivo_id: _dispositivoId,
    datos: JSON.stringify({
      version: typeof APP_SCHEMA_VERSION !== 'undefined' ? APP_SCHEMA_VERSION : 4,
      exportado: new Date().toISOString(),
      dispositivo: _dispositivoId,
      efectivoInicial:   typeof efectivoInicial   !== 'undefined' ? efectivoInicial   : 0,
      inventarioInicial: typeof inventarioInicial !== 'undefined' ? inventarioInicial : 0,
      // Strip base64 img from snapshot (too heavy), but URLs son ligeras — incluirlas
      productos: (productos||[]).map(p=>({...p, img: (p.img && p.img.startsWith('http')) ? p.img : null})),
      ventasDia, ventasSem, ventasMes,
      historial, pagos, ventasDiarias, restockLog: restockLog || [],
      // FIX BUG 3: incluir lista de IDs borrados para que otros dispositivos no los reagreguen
      productosEliminados: typeof productosEliminados !== 'undefined' ? (productosEliminados || []) : [],
      // FIX SYNC: propagar timestamp del último reset manual del día al snapshot
      // para que teléfonos que carguen este snapshot también respeten el corte
      reinicioDiaTs:   localStorage.getItem('vpos_reinicioDiaTs')   || null,
      reinicioDiaFecha: localStorage.getItem('vpos_reinicioDiaFecha') || null
    }),
    created_at: new Date().toISOString()
  };

  // Si no hay internet → encolar en IDB para cuando se reconecte
  if (!_hayConexion()) {
    await _encolarOffline('snapshot', snap);
    return;
  }

  _autoSyncSubiendo = true;
  try {
    await _sbPost('sync_snapshots', snap, true);
    _snapTimestamp = new Date().toISOString();
    _dot('green');
  } catch(e) {
    console.warn('[AutoSync] Error subiendo snapshot:', e.message);
    await _encolarOffline('snapshot', snap);
    _dot('red');
  } finally {
    _autoSyncSubiendo = false;
  }
}

// ── Fusionar automáticamente (equivale a "Fusionar y actualizar") ──
async function _autoFusionar() {
  if (!_sesionActiva || !_sbUrl() || !_sbKey()) return;
  if (_autoSyncFusionando || _autoSyncSubiendo) return;
  _autoSyncFusionando = true;
  try {
    // Buscar snapshots de OTROS dispositivos de la misma tienda
    const todosSnaps = await _sbGet('sync_snapshots', {
      select: '*',
      tienda_id: 'eq.' + _getTiendaId()
    }).catch(() => null);

    if (!todosSnaps || !todosSnaps.length) { _autoSyncFusionando = false; return; }

    // Solo los snapshots de otros dispositivos (no el nuestro, no el fusionado)
    const remotos = todosSnaps
      .filter(s => s.dispositivo_id !== _dispositivoId && s.dispositivo_id !== 'fusion')
      .map(s => { try { return JSON.parse(s.datos); } catch(e) { return null; } })
      .filter(Boolean);

    if (!remotos.length) { _autoSyncFusionando = false; return; }

    // Hay datos de otros dispositivos → fusionar
    console.log('[AutoSync] 🔀 Fusionando', remotos.length, 'snapshot(s) de otros dispositivos');
    _dot('yellow');

    const miSnap = {
      version: 4, exportado: new Date().toISOString(), dispositivo: _dispositivoId,
      efectivoInicial:   typeof efectivoInicial   !== 'undefined' ? efectivoInicial   : 0,
      inventarioInicial: typeof inventarioInicial !== 'undefined' ? inventarioInicial : 0,
      productos, ventasDia, ventasSem, ventasMes,
      historial, pagos, ventasDiarias, restockLog: restockLog || []
    };

    let resultado = miSnap;
    for (const r of remotos) resultado = _fusionarDos(resultado, r);

    // Aplicar resultado en memoria + IDB (sin confirm, silencioso)
    await _aplicarDatos(resultado);

    // Guardar fusión en Supabase y borrar snapshots individuales
    const fusionId = _getTiendaId() + '_fusionado';
    await _sbPost('sync_snapshots', {
      id: fusionId, tienda_id: _getTiendaId(), dispositivo_id: 'fusion',
      datos: JSON.stringify(resultado), created_at: new Date().toISOString()
    }, true);

    // Borrar los snapshots individuales de otros dispositivos
    for (const s of todosSnaps) {
      if (s.dispositivo_id !== 'fusion' && s.dispositivo_id !== _dispositivoId) {
        await _sbDeleteFiltro('sync_snapshots', { id: 'eq.' + s.id }).catch(() => {});
      }
    }

    if (typeof actualizarTodo === 'function') actualizarTodo();
    _dot('green');
    console.log('[AutoSync] ✅ Fusión automática aplicada');
  } catch(e) {
    console.warn('[AutoSync] Error en fusión:', e.message);
    _dot('red');
  } finally {
    _autoSyncFusionando = false;
  }
}
// =====================================================================
//  ⚡ SUPABASE REALTIME — Broadcast instantáneo + postgres_changes respaldo
//  Broadcast: peer-to-peer <100ms, sin pasar por BD, sin restricciones de filtro
//  postgres_changes: solo para detectar cambios al reconectar/abrir sesión
// =====================================================================
let _realtimeChannel  = null;
let _realtimeActivo   = false;
let _pollingTimer     = null;
let _supabaseClient   = null;

function _getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  const sdk = window.supabase || window.Supabase;
  if (!sdk || !sdk.createClient) return null;
  try {
    _supabaseClient = sdk.createClient(_sbUrl(), _sbKey(), {
      realtime: { params: { eventsPerSecond: 20 } }
    });
    return _supabaseClient;
  } catch(e) {
    console.warn('[Realtime] No se pudo crear cliente:', e.message);
    return null;
  }
}

// ── Enviar broadcast a todos los otros dispositivos de la misma tienda ──
function _broadcast(evento, datos) {
  if (!_realtimeChannel || !_realtimeActivo) return;
  try {
    _realtimeChannel.send({ type: 'broadcast', event: evento, payload: datos });
  } catch(e) { console.warn('[Broadcast] Error:', e.message); }
}

function _iniciarPolling() {
  _iniciarRealtime();
  if (_pollingTimer) return;
  _pollingTimer = setInterval(() => {
    if (!_realtimeActivo) _autoFusionar();
  }, 10000);
  console.log('[Sync] Realtime iniciado, polling seguridad 10s');
}

function _detenerPolling() {
  if (_realtimeChannel && _supabaseClient) {
    try { _supabaseClient.removeChannel(_realtimeChannel); } catch(e) {}
    _realtimeChannel = null;
  }
  _realtimeActivo = false;
  if (_pollingTimer) { clearInterval(_pollingTimer); _pollingTimer = null; }
}

function _iniciarRealtime() {
  if (_realtimeChannel) return;
  const client = _getSupabaseClient();
  if (!client) {
    console.warn('[Realtime] SDK no disponible — polling 3s');
    if (!_pollingTimer) _pollingTimer = setInterval(_autoFusionar, 3000);
    return;
  }
  const tiendaId = _getTiendaId();
  if (!tiendaId) return;

  try {
    _realtimeChannel = client
      .channel('pos_' + tiendaId, { config: { broadcast: { self: false, ack: false } } })

      // BROADCAST: venta nueva — instantáneo <100ms
      .on('broadcast', { event: 'venta' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        if ((historial||[]).some(h => String(h.id) === String(payload.id))) return;
        console.log('[Realtime] 🧾 Venta:', payload.id, '$'+payload.total);
        _aplicarVentaRealtime(payload);
      })

      // BROADCAST: producto actualizado (datos + stock)
      .on('broadcast', { event: 'producto' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        const idx = (productos||[]).findIndex(x => String(x.id) === String(payload.id));
        if (idx >= 0) {
          // Preservar imagen local si el broadcast no la trae (img:null en broadcasts)
          const imgLocal = productos[idx].img;
          Object.assign(productos[idx], payload);
          if (!payload.img && imgLocal) productos[idx].img = imgLocal;
        } else {
          productos.push(payload);
        }
        idbSet('vpos_productos', productos).catch(()=>{});
        if (typeof actualizarTodo === 'function') actualizarTodo();
        // Si el modal de paquetes está abierto para este producto, refrescarlo
        if (typeof _pkgProdIdActivo !== 'undefined' &&
            String(_pkgProdIdActivo) === String(payload.id) &&
            typeof renderPkgLista === 'function') {
          const p = productos[idx >= 0 ? idx : productos.length - 1];
          if (p) renderPkgLista(p);
        }
        _dot('green');
      })

      // BROADCAST: producto borrado
      .on('broadcast', { event: 'producto_borrado' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        const idStr = String(payload.id);
        productos = (productos||[]).filter(p => String(p.id) !== idStr);
        if (typeof productosEliminados !== 'undefined' && !productosEliminados.includes(idStr))
          productosEliminados.push(idStr);
        idbSet('vpos_productos', productos).catch(()=>{});
        idbSet('vpos_productosEliminados', typeof productosEliminados !== 'undefined' ? productosEliminados : []).catch(()=>{});
        if (typeof actualizarTodo === 'function') actualizarTodo();
        _dot('green');
        console.log('[Realtime] 🗑 Producto borrado:', idStr);
      })

      // BROADCAST: pago/gasto borrado — sincroniza eliminación a otros teléfonos en tiempo real
      .on('broadcast', { event: 'pago_borrado' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        const idStr = String(payload.id);
        if (typeof pagosEliminados !== 'undefined' && !pagosEliminados.includes(idStr))
          pagosEliminados.push(idStr);
        if (typeof pagos !== 'undefined')
          pagos = pagos.filter(g => String(g.id) !== idStr);
        idbSet('vpos_pagos', typeof pagos !== 'undefined' ? pagos : []).catch(() => {});
        idbSet('vpos_pagosEliminados', typeof pagosEliminados !== 'undefined' ? pagosEliminados : []).catch(() => {});
        if (typeof actualizarTodo === 'function') actualizarTodo();
        _dot('green');
        console.log('[Realtime] 🗑 Pago borrado desde otro dispositivo:', idStr);
      })

      // BROADCAST: imagen de producto
      .on('broadcast', { event: 'producto_img' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        const p = (productos||[]).find(x => String(x.id) === String(payload.id));
        if (p) {
          p.img = payload.img || null;
          idbSet('vpos_productos', productos).catch(()=>{});
          if (typeof actualizarTodo === 'function') actualizarTodo();
          _dot('green');
          console.log('[Realtime] 🖼 Imagen:', payload.id, payload.img ? 'actualizada' : 'borrada');
        }
      })

      // BROADCAST: historial editado/eliminado — para devolucionas y eliminaciones
      .on('broadcast', { event: 'historial_actualizado' }, ({ payload }) => {
        if (!payload || !payload.historial) return;
        // Reconstruir el historial con fechaStr correctos
        const nuevo = payload.historial.map(v => ({
          ...v,
          fechaStr: v.fechaStr || (v.fechaISO ? new Date(v.fechaISO).toLocaleString('es-SV') : '—')
        }));
        historial = nuevo;
        // FIX: si el payload incluye ventasDiarias (ej: al borrar historial completo),
        //      también limpiarlas para que el capital total quede consistente entre teléfonos
        if (payload.ventasDiarias !== undefined) {
          ventasDiarias = payload.ventasDiarias || [];
          idbSet('vpos_ventasDiarias', ventasDiarias).catch(() => {});
        }
        // ── FIX DESCUADRE: aplicar stock restaurado por devolución ──
        // Cuando un teléfono hace una devolución, el broadcast trae los productos
        // afectados con su nuevo stock. Aplicarlos aquí evita el descuadre.
        if (payload.productos_devolucion && Array.isArray(payload.productos_devolucion)) {
          payload.productos_devolucion.forEach(updatedProd => {
            const idx = (productos||[]).findIndex(p => String(p.id) === String(updatedProd.id));
            if (idx >= 0) {
              const imgLocal = productos[idx].img;
              Object.assign(productos[idx], updatedProd);
              if (!updatedProd.img && imgLocal) productos[idx].img = imgLocal;
            }
          });
          idbSet('vpos_productos', productos).catch(() => {});
          console.log('[Realtime] 📦 Stocks restaurados por devolución:', payload.productos_devolucion.length, 'producto(s)');
        }
        // Recalcular reportes desde el historial actualizado
        if (typeof _validarFechaReportes === 'function') _validarFechaReportes();
        if (typeof _recalcularReportesDesdeHistorial === 'function') _recalcularReportesDesdeHistorial();
        idbSet('vpos_historial', historial).catch(()=>{});
        idbSet('vpos_ventasDia', ventasDia).catch(()=>{});
        idbSet('vpos_ventasSem', ventasSem).catch(()=>{});
        idbSet('vpos_ventasMes', ventasMes).catch(()=>{});
        if (typeof actualizarTodo === 'function') actualizarTodo();
        _dot('green');
        console.log('[Realtime] 🗑 Historial actualizado:', historial.length, 'cobros');
      })

      // BROADCAST: reinicio del día — sincroniza el reset a todos los teléfonos
      // FIX BUG 1 & 2: el teléfono que reinicia avisa a los demás para que borren
      //                 ventasDia en sus pantallas y no dupliquen el capital total
      .on('broadcast', { event: 'reinicio_dia' }, ({ payload }) => {
        if (!payload || !payload.ts) return;
        const tsRemoto  = payload.ts;
        const tsLocal   = localStorage.getItem('vpos_reinicioDiaTs') || '';
        // Solo aplicar si el reset remoto es MÁS NUEVO que el nuestro (evita bucles)
        if (tsRemoto <= tsLocal) return;
        console.log('[Realtime] 🔄 Reset día recibido de otro dispositivo:', tsRemoto);
        ventasDia = {};
        localStorage.setItem('vpos_reinicioDiaTs',    tsRemoto);
        localStorage.setItem('vpos_reinicioDiaFecha', payload.fecha || new Date().toDateString());
        localStorage.setItem('vpos_reporteFechaDia',  payload.fecha || new Date().toDateString());
        idbSet('vpos_ventasDia', ventasDia).catch(() => {});
        if (typeof actualizarTodo === 'function') actualizarTodo();
        _dot('green');
        if (typeof toast === 'function') toast('🔄 Día reiniciado desde otro teléfono');
      })

      // BROADCAST: venta_diaria_actualizada — se guardó o actualizó una venta por día
      // ── FIX: guardarVentaDiaria() solo hacía syncAhora (Supabase), sin broadcast.
      //    Ahora emite este evento y el receptor hace merge instantáneo en <100ms.
      .on('broadcast', { event: 'venta_diaria_actualizada' }, ({ payload }) => {
        if (!payload || !Array.isArray(payload.ventasDiarias)) return;
        // Merge: tomar el monto mayor para no retroceder valores locales
        (payload.ventasDiarias || []).forEach(vExt => {
          const idx = (ventasDiarias||[]).findIndex(v => v.fecha === vExt.fecha);
          if (idx >= 0) {
            // Actualizar si el remoto tiene monto diferente (puede ser edición)
            if (Number(vExt.monto) !== Number(ventasDiarias[idx].monto)) {
              ventasDiarias[idx].monto = Number(vExt.monto) || 0;
            }
            if (vExt.nota !== undefined) ventasDiarias[idx].nota = vExt.nota;
          } else {
            ventasDiarias.push({ fecha: vExt.fecha, monto: Number(vExt.monto) || 0, nota: vExt.nota || '' });
          }
        });
        ventasDiarias.sort((a, b) => a.fecha.localeCompare(b.fecha));
        idbSet('vpos_ventasDiarias', ventasDiarias).catch(()=>{});
        if (typeof _recalcularReportesDesdeHistorial === 'function') _recalcularReportesDesdeHistorial();
        idbSet('vpos_ventasMes', ventasMes).catch(()=>{});
        if (typeof actualizarTodo === 'function') actualizarTodo();
        _dot('green');
        console.log('[Realtime] 📅 Ventas diarias actualizadas:', ventasDiarias.length, 'días');
      })

      // BROADCAST: ventas_dia_eliminada — un día borrado del historial de ventas diarias
      .on('broadcast', { event: 'ventas_dia_eliminada' }, ({ payload }) => {
        if (!payload || !payload.fecha) return;
        const antes = (ventasDiarias||[]).length;
        ventasDiarias = (ventasDiarias||[]).filter(v => v.fecha !== payload.fecha);
        if (ventasDiarias.length !== antes) {
          idbSet('vpos_ventasDiarias', ventasDiarias).catch(()=>{});
          // FIX: recalcular ventasMes/ventasDia/ventasSem en el teléfono receptor
          if (typeof _recalcularReportesDesdeHistorial === 'function') _recalcularReportesDesdeHistorial();
          idbSet('vpos_ventasMes', ventasMes).catch(()=>{});
          idbSet('vpos_ventasDia', ventasDia).catch(()=>{});
          idbSet('vpos_ventasSem', ventasSem).catch(()=>{});
          if (typeof actualizarTodo === 'function') actualizarTodo();
          _dot('green');
          console.log('[Realtime] 🗑 Venta día eliminada:', payload.fecha);
        }
      })

      // BROADCAST: reinicio_sem — semana reiniciada (toda o por categoría)
      .on('broadcast', { event: 'reinicio_sem' }, ({ payload }) => {
        if (!payload) return;
        ventasSem = payload.ventasSem || {};
        idbSet('vpos_ventasSem', ventasSem).catch(()=>{});
        if (typeof actualizarTodo === 'function') actualizarTodo();
        _dot('green');
        console.log('[Realtime] 🔄 Semana reiniciada desde otro teléfono');
        if (typeof toast === 'function') toast('🔄 Semana reiniciada desde otro teléfono');
      })

      // BROADCAST: reinicio_mes — cierre de mes completo
      .on('broadcast', { event: 'reinicio_mes' }, ({ payload }) => {
        if (!payload || !payload.ts) return;
        console.log('[Realtime] 🗓 Cierre de mes recibido:', payload.ts);
        ventasDia = {}; ventasSem = {}; ventasMes = {};
        historial = []; pagos = []; ventasDiarias = []; restockLog = restockLog || [];
        if (payload.efectivoInicial !== undefined) {
          efectivoInicial   = payload.efectivoInicial   || 0;
          inventarioInicial = payload.inventarioInicial || 0;
          idbSet('vpos_efectivoInicial',   efectivoInicial).catch(()=>{});
          idbSet('vpos_inventarioInicial', inventarioInicial).catch(()=>{});
        }
        ['vpos_ventasDia','vpos_ventasSem','vpos_ventasMes','vpos_historial','vpos_pagos','vpos_ventasDiarias'].forEach(k =>
          idbSet(k, k.includes('Dia')||k.includes('Sem')||k.includes('Mes') ? {} : []).catch(()=>{})
        );
        if (typeof actualizarTodo === 'function') actualizarTodo();
        _dot('green');
        if (typeof toast === 'function') toast('🗓 Mes cerrado desde otro teléfono — datos reiniciados');
      })

      // BROADCAST: snapshot_push — señal para recargar snapshot más reciente
      .on('broadcast', { event: 'snapshot_push' }, ({ payload }) => {
        if (!payload || payload.tienda !== _getTiendaId()) return;
        console.log('[Realtime] 📥 snapshot_push → recargando desde Supabase');
        setTimeout(() => {
          if (typeof _autoCargarDesdeSupa === 'function') _autoCargarDesdeSupa();
        }, 500);
      })

      // postgres_changes: snapshot completo al reconectar (respaldo)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sync_snapshots',
        filter: 'tienda_id=eq.' + tiendaId
      }, (payload) => {
        const rec = payload.new || {};
        if (rec.dispositivo_id === _dispositivoId || rec.dispositivo_id === 'fusion') return;
        console.log('[Realtime] 📡 Snapshot de', rec.dispositivo_id);
        setTimeout(_autoFusionar, 300);
      })

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          _realtimeActivo = true;
          console.log('[Realtime] ✅ Broadcast activo — sync <100ms');
          _dot('green');
          setTimeout(_autoFusionar, 600);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          _realtimeActivo = false;
          _realtimeChannel = null;
          console.warn('[Realtime] ⚠', status, '— polling 3s, reintento en 8s');
          if (!_pollingTimer) _pollingTimer = setInterval(_autoFusionar, 3000);
          setTimeout(() => { if (_sesionActiva && !_realtimeActivo) _iniciarRealtime(); }, 8000);
        } else if (status === 'CLOSED') {
          _realtimeActivo = false;
          _realtimeChannel = null;
          if (_sesionActiva) setTimeout(() => { if (!_realtimeActivo) _iniciarRealtime(); }, 4000);
        }
      });

  } catch(e) {
    console.warn('[Realtime] Error:', e.message);
    _realtimeChannel = null;
    if (!_pollingTimer) _pollingTimer = setInterval(_autoFusionar, 3000);
  }
}

// Aplicar venta recibida por broadcast
function _aplicarVentaRealtime(v) {
  let items = [];
  if (v.items_json) {
    try { const p = typeof v.items_json === 'string' ? JSON.parse(v.items_json) : v.items_json; if (Array.isArray(p)) items = p; } catch(e) {}
  }
  if (!items.length && v.items) {
    items = String(v.items).split('|').map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^(\d+)x\s+(.+)$/);
      if (!m) return null;
      const nom = m[2].trim();
      const prod = (productos||[]).find(x => x.nom === nom);
      return { id: prod ? String(prod.id) : null, nom, cant: Number(m[1])||1, precio: prod ? prod.venta : 0, cat: prod ? prod.cat : '' };
    }).filter(Boolean);
  }
  const fechaISO = v.fechaISO || v.fecha_iso || new Date().toISOString();
  const nv = { id: v.id, fecha: fechaISO, fechaISO, ts: Date.parse(fechaISO)||0,
    total: Number(v.total)||0, pago: Number(v.pago)||0, vuelto: Number(v.vuelto)||0,
    items, items_json: v.items_json||null };
  historial = [nv, ...(historial||[])];

  // FIX: Descontar stock del inventario al recibir venta de otro dispositivo.
  // Sin esto, el otro teléfono suma el dinero a la caja PERO el producto sigue
  // en el inventario → capital total inflado (doble conteo).
  // El snapshot posterior sobreescribe productos con el stock correcto de Supabase,
  // por lo que no hay riesgo de doble descuento.
  (function() {
    let stockCambio = false;
    items.forEach(item => {
      const pid = String(item.id || '');
      if (!pid || pid === 'null') return;
      const p = (productos || []).find(x => String(x.id) === pid);
      if (p && typeof p.stock === 'number') {
        const cant = Number(item.cant || 0);
        p.stock = Math.max(0, p.stock - cant);
        stockCambio = true;
        if (typeof actualizarStockFila === 'function') actualizarStockFila(p);
      }
    });
    if (stockCambio) idbSet('vpos_productos', productos).catch(() => {});
  })();
  // ──────────────────────────────────────────────────────────────────────

  // CRÍTICO: validar que ventasDia/Sem/Mes sean del período actual ANTES de sumar
  // Si no son de hoy (dispositivo que no se usó en un día), resetear primero
  if (typeof _validarFechaReportes === 'function') _validarFechaReportes();

  // Ahora sumar la nueva venta al período correspondiente
  const fechaObj = new Date(fechaISO);
  const hoy = new Date().toDateString(), lunes = _lunesDeLaSemana(), ahora = new Date();
  const esHoy = fechaObj.toDateString() === hoy;
  const esSem = fechaObj >= lunes;
  const esMes = fechaObj.getMonth() === ahora.getMonth() && fechaObj.getFullYear() === ahora.getFullYear();
  items.forEach(it => {
    const pid = String(it.id||''); if (!pid || pid === 'null') return;
    const cant = Number(it.cant||0), tot = cant * Number(it.precio||0);
    const base = { id: pid, nom: it.nom||'', cat: it.cat||'', cant: 0, total: 0 };
    if (esHoy) { if (!ventasDia[pid]) ventasDia[pid]={...base}; ventasDia[pid].cant+=cant; ventasDia[pid].total+=tot; }
    if (esSem) { if (!ventasSem[pid]) ventasSem[pid]={...base}; ventasSem[pid].cant+=cant; ventasSem[pid].total+=tot; }
    if (esMes) { if (!ventasMes[pid]) ventasMes[pid]={...base}; ventasMes[pid].cant+=cant; ventasMes[pid].total+=tot; }
  });
  idbSet('vpos_historial', historial).catch(()=>{});
  idbSet('vpos_ventasDia', ventasDia).catch(()=>{});
  idbSet('vpos_ventasSem', ventasSem).catch(()=>{});
  idbSet('vpos_ventasMes', ventasMes).catch(()=>{});
  if (typeof actualizarTodo === 'function') actualizarTodo();
  _dot('green');
}

async function _pollNuevosDatos() { await _autoFusionar(); }


// Subir historial de cobros a Supabase
// =====================================================================
//  🔒 VENTA ATÓMICA — múltiples cajas sin descuadre de stock
//  Usa RPC de PostgreSQL con FOR UPDATE para garantizar consistencia.
//  Si dos cajas venden el mismo producto al mismo tiempo, la segunda
//  espera a que la primera termine — nunca quedan stocks negativos.
// =====================================================================

// Resultado: { ok, stocks:[{id,stock}], error? }
// Si ok=true  → la venta se registró y stocks tiene el stock actualizado de cada producto
// Si ok=false → mostrar error al cajero (ej: "Sin stock: Arroz")
// Si offline  → fallback al comportamiento local (sin RPC)
async function registrarVentaAtomica(venta) {
  if (!_hayConexion() || !_sbUrl() || !_sbKey()) {
    return { ok: false, offline: true }; // fallback al flujo local
  }
  try {
    const tiendaId = _getTiendaId() || 'sin_tienda';
    const itemsArr = Array.isArray(venta.items) ? venta.items : [];
    const resultado = await _sbRpc('registrar_venta_atomica', {
      p_venta_id:   venta.id,
      p_tienda_id:  tiendaId,
      p_fecha_iso:  venta.fechaISO || new Date().toISOString(),
      p_total:      parseFloat(venta.total) || 0,
      p_pago:       parseFloat(venta.pago)  || 0,
      p_vuelto:     parseFloat(venta.vuelto)|| 0,
      p_items_txt:  itemsArr.map(x => x.cant + 'x ' + x.nom).join(' | '),
      p_items_json: itemsArr
    });
    return resultado; // { ok, stocks, error? }
  } catch(e) {
    console.warn('[RPC] registrar_venta_atomica falló:', e.message);
    // Si es error de red → fallback offline
    if (e.message.includes('fetch') || e.message.includes('Network') || !navigator.onLine) {
      return { ok: false, offline: true };
    }
    // Error de la base de datos (ej: función no existe aún) → fallback local
    return { ok: false, offline: true, rpcError: e.message };
  }
}

window.registrarVentaAtomica = registrarVentaAtomica;

async function _subirHistorial(){
  if(!historial||!historial.length){
    // Historial borrado localmente → eliminar TODAS las ventas en Supabase para esta tienda
    // RLS de Supabase garantiza que solo se borran las filas del usuario autenticado
    try{ await _sbDeleteFiltro('ventas',{id:'not.is.null'}); }catch(e){ console.warn('[subirHistorial] delete vacío:',e.message); }
    return;
  }
  try{
    for(let i=0;i<historial.length;i+=50){
      const tid=_getTiendaId();
      const rows=historial.slice(i,i+50).map(v=>({
        id:String(v.id),fecha_iso:v.fechaISO||v.fecha||new Date().toISOString(),
        total:parseFloat(v.total)||0,pago:parseFloat(v.pago)||0,vuelto:parseFloat(v.vuelto)||0,
        tienda_id:tid,
        items:(v.items||[]).map(x=>x.cant+'x '+x.nom).join(' | ')
        // items_json eliminado: columna no existe en schema de Supabase
      }));
      await _sbPost('ventas',rows,true);
    }
  }catch(e){console.warn('[subirHistorial]',e.message);}
}
async function _subirStockBase(){
  if(!productos||!productos.length||!_sbUrl()||!_sbKey())return;
  const tid=_getTiendaId()||'sin_tienda';

  // ── Intentar con columnas completas, si falla usar solo columnas base ──
  // Las URLs de Supabase Storage son cortas y van en la fila principal.
  // Las imágenes base64 (~100KB) se manejan por separado para no superar límites de row.
  const _getImgUrl = (p) => (p.img && p.img.startsWith('http')) ? p.img : null;

  // Nivel 1: completo con paquetes como array (requiere columna JSONB en Supabase)
  // IMPORTANTE: TODAS las filas del batch deben tener las MISMAS claves (PGRST102)
  // Por eso img siempre se incluye, aunque sea null
  const rowsCompleto = productos.map(p=>({
    id:tid+'_'+String(p.id), tienda_id:tid,
    nom:p.nom||'',cat:p.cat||'',
    compra:Number(p.compra)||0,venta:Number(p.venta)||0,
    stock_base:_calcStockBase(p),stock:Number(p.stock)||0,min:Number(p.min)||0,
    cod:p.cod||'',abrev:p.abrev||'',
    paquetes:p.paquetes||[],lotes:p.lotes||[],
    _ts: p._ts || 0,
    img: _getImgUrl(p) // null si no hay URL — clave siempre presente para evitar PGRST102
  }));

  // Nivel 2: paquetes serializados como texto JSON (por si la columna es TEXT no JSONB)
  const rowsConPaquetesStr = productos.map(p=>({
    id:tid+'_'+String(p.id), tienda_id:tid,
    nom:p.nom||'',cat:p.cat||'',
    compra:Number(p.compra)||0,venta:Number(p.venta)||0,
    stock:Number(p.stock)||0,min:Number(p.min)||0,
    cod:p.cod||'',
    paquetes: JSON.stringify(p.paquetes||[]),
    img: _getImgUrl(p)
  }));

  // Nivel 3: mínimo absoluto — siempre debe funcionar
  const rowsBase = productos.map(p=>({
    id:tid+'_'+String(p.id), tienda_id:tid,
    nom:p.nom||'',cat:p.cat||'',
    compra:Number(p.compra)||0,venta:Number(p.venta)||0,
    stock:Number(p.stock)||0,min:Number(p.min)||0,
    cod:p.cod||'',
    img: _getImgUrl(p)
  }));

  // Intentar en cascada: completo → paquetes como string → mínimo
  let nivelSync = 1; // 1=completo, 2=paquetesStr, 3=base
  for(let i=0;i<rowsCompleto.length;i+=50){
    try{
      if(nivelSync===1) await _sbPost('productos',rowsCompleto.slice(i,i+50),true);
      else if(nivelSync===2) await _sbPost('productos',rowsConPaquetesStr.slice(i,i+50),true);
      else await _sbPost('productos',rowsBase.slice(i,i+50),true);
    }catch(e1){
      console.warn('[Sync productos] Nivel '+nivelSync+' falló:',e1.message);
      nivelSync++;
      if(nivelSync===2){
        try{ await _sbPost('productos',rowsConPaquetesStr.slice(i,i+50),true); continue; }
        catch(e2){ console.warn('[Sync productos] Nivel 2 falló:',e2.message); nivelSync=3; }
      }
      if(nivelSync===3){
        try{ await _sbPost('productos',rowsBase.slice(i,i+50),true); }
        catch(e3){
          console.error('[Sync productos] ❌ Error crítico en lote',i,':',e3.message);
          if(typeof toast==='function') toast('Error al sincronizar productos: ' + e3.message, true);
          throw e3;
        }
      }
    }
  }

  // ── Subir imágenes individualmente ──
  for(const p of productos){
    if(!p.img) continue;
    const rid=tid+'_'+String(p.id);
    try{
      const compImg = p.img.startsWith('http') ? p.img : await _comprimirImg(p.img, 380, 0.82);
      await _sbPost('productos',{id:rid,tienda_id:tid,img:compImg},true);
      console.log('[imgSync] ✅ img subida prod',p.id,'tienda:',tid);
    }catch(e){
      console.warn('[imgSync] ❌ prod',p.id,':',e.message);
      _imgPendientes.set(String(p.id), p);
    }
  }
}

// ── Cola de fotos pendientes (cuando falla el upload) ──
const _imgPendientes = new Map(); // prodId → prod

// ── Sync just the img of ONE product immediately after save ──
async function syncImgProducto(prod) {
  if (!prod || !_sbUrl() || !_sbKey()) {
    console.warn('[imgSync] ⚠ Sin config Supabase — foto de prod', prod?.id, 'queda pendiente');
    if (prod) _imgPendientes.set(String(prod.id), prod);
    return;
  }

  // Si no hay token de sesión, encolar para reintentar después del login
  if (!_authToken) {
    console.warn('[imgSync] ⚠ Sin _authToken — foto de prod', prod.id, 'queda en cola');
    _imgPendientes.set(String(prod.id), prod);
    return;
  }

  const tid = _getTiendaId();
  if (!tid) {
    console.warn('[imgSync] ⚠ Sin tienda_id — foto de prod', prod.id, 'queda en cola');
    _imgPendientes.set(String(prod.id), prod);
    return;
  }

  const rid = tid + '_' + String(prod.id);
  try {
    if (prod.img) {
      // URL pública (Supabase Storage) → guardar directamente sin pasar por canvas
      // Base64 → comprimir primero para no exceder límites de columna
      const compImg = prod.img.startsWith('http')
        ? prod.img
        : await _comprimirImg(prod.img, 380, 0.82);

      // Estrategia dual para máxima confiabilidad:
      // 1. PATCH en columna img (actualiza fila existente sin tocar otras columnas)
      // 2. Si falla PATCH (fila no existe aún), hacer upsert completo
      let guardado = false;
      try {
        await _sbPatch('productos', { id: 'eq.' + rid }, { img: compImg });
        guardado = true;
      } catch(ePatch) {
        console.warn('[imgSync] PATCH falló, intentando upsert completo:', ePatch.message);
      }

      if (!guardado) {
        await _sbPost('productos', {
          id: rid, tienda_id: tid, img: compImg,
          nom: prod.nom || '', cat: prod.cat || '',
          compra: Number(prod.compra) || 0,
          venta:  Number(prod.venta)  || 0,
          stock:  Number(prod.stock)  || 0,
          min:    Number(prod.min)    || 0,
          cod:    prod.cod   || '',
          abrev:  prod.abrev || '',
          _ts:    prod._ts   || Date.now()
        }, true);
      }

      // Broadcast inmediato de la imagen a todos los dispositivos conectados
      if (typeof _broadcast === 'function') {
        _broadcast('producto_img', { id: String(prod.id), img: compImg });
        // Además forzar recarga desde Supabase en dispositivos que puedan haber
        // perdido el broadcast (red inestable, dispositivo en background, etc.)
        _broadcast('snapshot_push', { tienda: tid });
      }
      console.log('[imgSync] ✅ img guardada prod', prod.id, '— tienda:', tid,
        prod.img.startsWith('http') ? '(URL)' : '(base64)');
      _imgPendientes.delete(String(prod.id));
    } else {
      await _sbPatch('productos', { id: 'eq.' + rid }, { img: null });
      if (typeof _broadcast === 'function') _broadcast('producto_img', { id: String(prod.id), img: null });
      console.log('[imgSync] 🗑 img borrada para prod', prod.id);
      _imgPendientes.delete(String(prod.id));
    }
  } catch(e) {
    console.warn('[imgSync] ❌ prod', prod.id, '| tienda:', tid, '| error:', e.message);
    // Encolar para reintentar en el próximo ciclo
    _imgPendientes.set(String(prod.id), prod);
    // Mostrar toast de advertencia solo si hay muchos fallos
    if (_imgPendientes.size === 1) {
      toast('Foto guardada localmente — se sincronizará al reconectar', false);
    }
  }
}
window.syncImgProducto = syncImgProducto;

// ── Reintentar fotos pendientes (se llama al restaurar sesión) ──
async function _syncFotosPendientes() {
  if (_imgPendientes.size === 0) return;
  if (!_authToken || !_getTiendaId()) return;
  console.log('[imgSync] Reintentando', _imgPendientes.size, 'fotos pendientes...');
  for (const [id, prod] of [..._imgPendientes.entries()]) {
    await syncImgProducto(prod);
    await new Promise(r => setTimeout(r, 400));
  }
}
window._syncFotosPendientes = _syncFotosPendientes;

// ── Auto-subir todas las fotos locales al Supabase al hacer login ──
// Corre en background sin bloquear el inicio de la app
async function _autoSyncFotos() {
  if (!_sbUrl() || !_sbKey() || !_sesionActiva) return;
  if (typeof productos === 'undefined' || !productos.length) return;
  const conFoto = productos.filter(p => p.img);
  if (!conFoto.length) return;
  console.log('[autoFotos] Verificando', conFoto.length, 'fotos...');
  const tid = _getTiendaId();
  // Obtener IDs de productos que YA tienen foto en Supabase
  const enSupa = await _sbGet('productos', {
    select: 'id',
    tienda_id: 'eq.' + tid,
    img: 'not.is.null'
  }).catch(() => []);
  const yaSubidos = new Set((enSupa || []).map(p => tid + '_' + String(p.id).split('_').pop()));
  // Subir solo las que faltan
  let subidas = 0;
  for (const prod of conFoto) {
    const rid = tid + '_' + String(prod.id);
    if (yaSubidos.has(rid)) continue;
    try {
      await syncImgProducto(prod);
      subidas++;
      await new Promise(r => setTimeout(r, 300)); // no saturar
    } catch(e) {
      console.warn('[autoFotos] Error prod', prod.id, e.message);
    }
  }
  if (subidas > 0) console.log('[autoFotos] ✅ Subidas', subidas, 'fotos nuevas');
}
window._autoSyncFotos = _autoSyncFotos;

// Compress a base64 image to target size
function _comprimirImg(src, maxDim, quality){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      let w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){const f=maxDim/Math.max(w,h);w=Math.round(w*f);h=Math.round(h*f);}
      c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      let q=quality,url=c.toDataURL('image/jpeg',q);
      // Max 90KB base64
      while(url.length>90*1024&&q>0.2){q-=0.08;url=c.toDataURL('image/jpeg',q);}
      res(url);
    };
    img.onerror=()=>res(src); // fallback: send as-is
    img.src=src;
  });
}
function _calcStockBase(p){const pid=String(p.id);let v=0;(historial||[]).forEach(h=>{(h.items||[]).forEach(it=>{if(String(it.id)===pid)v+=Number(it.cant||0);});});return(p.stock||0)+v;}
async function _subirConfig(){try{const tid=_getTiendaId();await _sbPost('config',{clave:'efectivoInicial',tienda_id:tid,valor:String(typeof efectivoInicial!=='undefined'?efectivoInicial:0),updated_at:new Date().toISOString()},true);await _sbPost('config',{clave:'inventarioInicial',tienda_id:tid,valor:String(typeof inventarioInicial!=='undefined'?inventarioInicial:0),updated_at:new Date().toISOString()},true);}catch(e){}}
async function _subirRestockLog(){if(!restockLog||!restockLog.length)return;const tid=_getTiendaId();for(let i=0;i<restockLog.length;i+=50)await _sbPost('restock_log',restockLog.slice(i,i+50).map(r=>({id:r.id,ts:r.ts||0,prod_id:String(r.prodId),cant:r.cant||0,precio_compra:r.precioCompra||0,fecha_str:r.fechaStr||'',tienda_id:tid})),true);}
async function _subirVentasDiarias(){
  const tid=_getTiendaId();if(!tid)return;
  if(!ventasDiarias||!ventasDiarias.length){
    // Solo borrar las de ESTA tienda, nunca las de otras tiendas
    try{ await _sbDeleteFiltro('ventas_diarias',{tienda_id:'eq.'+tid}); }catch(e){ console.warn('[subirVD] delete vacío:',e.message); }
    return;
  }
  await _sbPost('ventas_diarias',ventasDiarias.map(v=>({fecha:tid+'_'+v.fecha,tienda_id:tid,monto:parseFloat(v.monto)||0,nota:v.nota||''})),true);
}
async function _subirPagos(){
  const tid=_getTiendaId();if(!tid)return;
  if(!pagos||!pagos.length){
    // Solo borrar los pagos de ESTA tienda
    try{ await _sbDeleteFiltro('pagos',{tienda_id:'eq.'+tid}); }catch(e){ console.warn('[subirPagos] delete vacío:',e.message); }
    return;
  }
  try{for(let i=0;i<pagos.length;i+=50)await _sbPost('pagos',pagos.slice(i,i+50).map(g=>({id:String(g.id),fecha_iso:g.fechaISO||new Date().toISOString(),monto:parseFloat(g.monto)||0,cat:g.cat||'GASTO',nom:g.nom||g.concepto||'',nota:g.nota||'',tienda_id:tid})),true);}catch(e){}
}

// =====================================================================
//  🗑️ BORRAR EN SUPABASE
// =====================================================================
async function syncBorrarProducto(id){
  if(!_sbUrl()||!_sbKey())return;
  try{
    const tid = _getTiendaId() || 'sin_tienda';
    const supaId = tid + '_' + String(id);
    // Borrar el producto completo de Supabase
    await _sbDeleteFiltro('productos',{id:'eq.'+supaId});
    // Registrar en deleted_log para auditoría
    await _sbPost('deleted_log',{id:'del_prod_'+supaId+'_'+Date.now(),tabla:'productos',registro_id:supaId,deleted_at:new Date().toISOString()},true);
    // Subir snapshot actualizado inmediatamente para que otros dispositivos reciban el borrado
    if (typeof _autoEnviarSnapshot === 'function') setTimeout(_autoEnviarSnapshot, 300);
    console.log('[syncBorrarProducto] ✅ Eliminado de Supabase:', supaId);
  }catch(e){console.warn('[syncBorrarProducto]',e.message);}
}
async function syncBorrarPago(id){if(!_sbUrl()||!_sbKey())return;try{await _sbDeleteFiltro('pagos',{id:'eq.'+String(id)});await _sbPost('deleted_log',{id:'del_pago_'+String(id)+'_'+Date.now(),tabla:'pagos',registro_id:String(id),deleted_at:new Date().toISOString()},true);}catch(e){}}
async function syncBorrarVentaDiaria(fecha){if(!_sbUrl()||!_sbKey())return;try{const tid=_getTiendaId();await _sbDeleteFiltro('ventas_diarias',{fecha:'eq.'+tid+'_'+fecha,tienda_id:'eq.'+tid});await _sbPost('deleted_log',{id:'del_vd_'+fecha+'_'+Date.now(),tabla:'ventas_diarias',registro_id:fecha,deleted_at:new Date().toISOString()},true);}catch(e){}}

async function sheetsEnviar(accion,datos){if(!_sbUrl()||!_sbKey())return;try{if(accion==='VENTA'){await _sbPost('ventas',{id:datos.id,fecha_iso:datos.fecha||new Date().toISOString(),total:parseFloat(datos.total)||0,pago:parseFloat(datos.pago)||0,vuelto:parseFloat(datos.vuelto)||0,items:datos.items||''},true);syncAhora('productos');}if(accion==='PRODUCTOS')syncAhora('productos');if(accion==='VENTAS_DIARIAS')syncAhora('venta_diaria');}catch(e){console.warn('[sheetsEnviar]',e.message);}}
async function sheetsImportar(){await descargarDatosActualizados();}

// =====================================================================
//  CONFIG
// =====================================================================
function abrirConfigSheets(){document.getElementById('sbUrlInput').value=_sbUrl();document.getElementById('sbKeyInput').value=_sbKey();_actualizarBadgeSync();abrirModal('modalSheetsConfig');}
function guardarConfigSheets(){const url=document.getElementById('sbUrlInput').value.trim(),key=document.getElementById('sbKeyInput').value.trim();if(url&&!url.startsWith('https://')){toast('La URL debe empezar con https://',true);return;}localStorage.setItem('vpos_supabaseUrl',url);localStorage.setItem('vpos_supabaseKey',key);// Resetear cliente Realtime para que reconecte con las nuevas credenciales
_detenerPolling();_supabaseClient=null;_realtimeChannel=null;actualizarBadgeSheets();cerrarModal('modalSheetsConfig');toast(url?'Supabase conectado':'Supabase desconectado');if(_sesionActiva&&url)setTimeout(()=>_iniciarPolling(),500);}
async function migrarColumnasPaquetes() {
  const url = _sbUrl(), key = _sbKey();
  if (!url || !key) { toast('Primero configura Supabase', true); return; }

  // Usamos la API REST de Supabase con una query directa
  // No podemos ejecutar DDL con la anon key — pero podemos detectar el error
  // y guiar al usuario con el SQL exacto
  try {
    // Intentar insertar una fila con la columna paquetes para ver si ya existe
    const testRow = [{
      id: '__test_paquetes__',
      tienda_id: _getTiendaId() || 'test',
      nom: '__test__', cat: '', compra: 0, venta: 0, stock: 0, min: 0, cod: '',
      paquetes: []
    }];
    const resp = await fetch(url + '/rest/v1/productos', {
      method: 'POST',
      headers: _headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(testRow)
    });

    if (resp.ok) {
      // Columna existe — limpiar fila de test
      await fetch(url + '/rest/v1/productos?id=eq.__test_paquetes__', {
        method: 'DELETE', headers: _headers({})
      });
      toast('✅ La columna paquetes ya existe. Sincronizando...', false);
      await _subirStockBase();
      return;
    }

    const errTxt = await resp.text();
    if (errTxt.includes('paquetes') || errTxt.includes('42703') || errTxt.includes('PGRST204')) {
      // Columna no existe — mostrar SQL
      _mostrarSQLMigracion();
    } else {
      toast('Error: ' + errTxt.substring(0, 120), true);
    }
  } catch(e) {
    toast('Error: ' + e.message, true);
  }
}

function _mostrarSQLMigracion() {
  const sql = `-- Pega esto en Supabase → SQL Editor → New Query → Run
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS paquetes  JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS lotes     JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS abrev     TEXT     DEFAULT '',
  ADD COLUMN IF NOT EXISTS stock_base INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS _ts       BIGINT   DEFAULT 0;`;

  // Crear modal con el SQL
  let m = document.getElementById('modalSQLMigracion');
  if (!m) {
    m = document.createElement('div');
    m.id = 'modalSQLMigracion';
    m.className = 'modal';
    m.innerHTML = `
    <div class="modal-box modal-md">
      <div class="modal-header" style="background:linear-gradient(to right,#fff7ed,#fff);">
        <div><h3 style="color:#c2410c;">🔧 Migración de Base de Datos</h3>
        <div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-top:2px;">Ejecuta este SQL en Supabase una sola vez</div></div>
        <button class="btn-close" onclick="cerrarModal('modalSQLMigracion')">✕</button>
      </div>
      <div class="modal-body" style="padding:16px;">
        <div style="font-size:12px;font-weight:700;color:#7c2d12;margin-bottom:10px;line-height:1.6;">
          1️⃣ Ve a <b>supabase.com</b> → tu proyecto → <b>SQL Editor</b><br>
          2️⃣ Crea una <b>New Query</b><br>
          3️⃣ Pega el código de abajo y presiona <b>Run</b><br>
          4️⃣ Regresa aquí y presiona <b>Sincronizar ahora</b>
        </div>
        <textarea id="sqlMigracionTxt" readonly
          style="width:100%;height:130px;font-family:'Space Mono',monospace;font-size:11px;
          background:#1e1e1e;color:#4ade80;border:none;border-radius:10px;padding:12px;
          resize:none;box-sizing:border-box;line-height:1.6;"></textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
          <button onclick="navigator.clipboard.writeText(document.getElementById('sqlMigracionTxt').value).then(()=>toast('SQL copiado'))"
            style="padding:12px;background:#f5f3ff;border:1.5px solid #c4b5fd;border-radius:10px;
            font-size:13px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;color:#7c3aed;">
            📋 Copiar SQL
          </button>
          <button onclick="cerrarModal('modalSQLMigracion');syncTodo();toast('Sincronizando...')"
            style="padding:12px;background:linear-gradient(135deg,#16a34a,#15803d);border:none;border-radius:10px;
            font-size:13px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;color:#fff;">
            🔄 Sincronizar ahora
          </button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('sqlMigracionTxt').value = sql;
  abrirModal('modalSQLMigracion');
}
window.migrarColumnasPaquetes = migrarColumnasPaquetes;

function desconectarSupabase(){localStorage.removeItem('vpos_supabaseUrl');localStorage.removeItem('vpos_supabaseKey');actualizarBadgeSheets();cerrarModal('modalSheetsConfig');toast('Supabase desconectado');}
function actualizarBadgeSheets(){const url=_sbUrl(),sesion=_sesionActiva&&_tiendaId;document.querySelectorAll('.sheets-status').forEach(el=>{if(sesion){el.textContent='Sync: '+_tiendaId;el.style.color='#16a34a';}else{el.textContent=url?'Sin sesion':'Sync';el.style.color=url?'#d97706':'#6b7280';}});document.querySelectorAll('.login-status').forEach(el=>{if(sesion){el.textContent='Sync: '+_tiendaId;el.style.color='#16a34a';}else{el.textContent='Iniciar sesion';el.style.color='#6b7280';}});}
function _actualizarBadgeSync(){const ts=localStorage.getItem('vpos_ultimoSync');const el=document.getElementById('ultimoSyncLabel');if(!el)return;el.textContent=ts?'Ultimo sync: '+new Date(ts).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}):'Nunca sincronizado';}
async function iniciarAutoSync() {
  // Iniciar detector de conexión offline desde el primer momento
  _iniciarDetectorConexion();

  // Aplicar estado del modo solo local al arrancar
  _actualizarUILocalMode();
  if (_modoSoloLocal) {
    _detenerPolling();
    console.log('[LocalMode] Modo sin internet activo — usando solo almacenamiento local');
  }

  // Aplicar nombre de tienda guardado antes del login
  const nombreGuardado = localStorage.getItem('vpos_tiendaNombre');
  if (nombreGuardado) _aplicarNombreTiendaDOM(nombreGuardado);

  await restaurarSesion();
  // Si no hay sesión restaurada, mostrar pantalla de login
  if (!_sesionActiva) {
    setTimeout(() => { abrirLogin(); }, 200);
  }

  // Si hay operaciones pendientes en la cola offline, vaciarlas ahora
  if (_hayConexion()) {
    const n = await oqCount().catch(() => 0);
    if (n > 0) {
      console.log('[Offline] Hay', n, 'operaciones pendientes al iniciar — vaciando');
      setTimeout(_flushOfflineQueue, 1000);
    }
  }
}
function _dot(color){let d=document.getElementById('syncDot');if(!d){d=document.createElement('div');d.id='syncDot';d.style.cssText='position:fixed;top:8px;right:8px;z-index:9999;width:9px;height:9px;border-radius:50%;transition:all .3s;pointer-events:none;';document.body.appendChild(d);}d.style.background={yellow:'#f59e0b',green:'#16a34a',red:'#ef4444'}[color]||'#ccc';d.style.opacity='1';if(color!=='yellow')setTimeout(()=>{d.style.opacity='0';},color==='green'?2000:5000);}
async function sheetsExportarProductos(){if(!_sbUrl()){toast('Primero configura Supabase',true);return;}try{await _subirStockBase();toast('Inventario enviado ('+productos.length+' productos)');}catch(e){toast('Error: '+e.message,true);}}
async function sheetsExportarVentasDiarias(){if(!_sbUrl()){toast('Primero configura Supabase',true);return;}await _subirVentasDiarias();toast('Ventas diarias enviadas');}
async function sheetsExportarTodo(){if(!_sbUrl()){toast('Primero configura Supabase',true);return;}toast('Exportando...');await _subirStockBase();await _subirVentasDiarias();await _subirRestockLog();await _subirPagos();localStorage.setItem('vpos_ultimoSync',new Date().toISOString());_actualizarBadgeSync();toast('Todo exportado a Supabase');}
async function testConexionSupabase(){const url=(document.getElementById('sbUrlInput')?.value||'').trim().replace(/\/$/,''),key=(document.getElementById('sbKeyInput')?.value||'').trim(),btn=document.getElementById('btnTestConexion');if(!url||!key){toast('Ingresa la URL y la Key primero',true);return;}if(btn){btn.disabled=true;btn.textContent='Probando...';}try{const r=await fetch(url+'/rest/v1/productos?select=id&limit=1',{headers:{'apikey':key,'Authorization':'Bearer '+key}});if(!r.ok){const t=await r.text();throw new Error('HTTP '+r.status+' — '+t);}toast('Conexion exitosa a Supabase');}catch(e){toast('Error: '+e.message,true);}finally{if(btn){btn.disabled=false;btn.textContent='Probar conexion';}}}

// =====================================================================
//  💳 SISTEMA DE MEMBRESÍAS
//  Solo aplica a usuarios que NO están en _EMAILS_EXENTOS
// =====================================================================

async function _verificarMembresia(userId, email) {
  try {
    const rows = await _sbGet('membresias', {
      select: '*',
      user_id: 'eq.' + userId,
      activa: 'eq.true',
      order: 'fecha_inicio.desc',
      limit: 1
    });
    if (!rows || rows.length === 0) return false;
    const mem = rows[0];
    // Definitivo nunca vence
    if (!mem.fecha_vencimiento) return true;
    // Verificar si aún está vigente
    const ahora = new Date();
    const vence = new Date(mem.fecha_vencimiento);
    if (vence > ahora) return true;
    // Marcar como inactiva
    await _sbPost('membresias', { id: mem.id, activa: false }, true);
    return false;
  } catch(e) {
    console.warn('[verificarMembresia]', e.message);
    // Si no se puede verificar (sin internet), permitir si hay token guardado
    return !!localStorage.getItem('vpos_membresiaActiva');
  }
}

function _crearModalMembresia() {
  if (document.getElementById('modalMembresia')) return;
  const modal = document.createElement('div');
  modal.id = 'modalMembresia';

  const planesHTML = _PLANES_MEMBRESIA.map((p, i) => `
    <div class="plan-card ${p.popular ? 'popular' : ''}" id="planCard_${p.id}"
      onclick="_seleccionarPlan('${p.id}')">
      <div class="plan-icono">${p.icono}</div>
      <div class="plan-nombre">${p.label}</div>
      <div class="plan-precio">$${p.precio.toFixed(2)}<span>${p.dias ? ' / ' + (p.dias === 7 ? 'sem' : p.dias === 30 ? 'mes' : 'año') : ''}</span></div>
      <div class="plan-duracion">${p.dias ? p.dias + ' días' : 'Para siempre'}</div>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="membresia-card">
      <div class="membresia-header">
        <h2>🔓 Activa tu Membresía</h2>
        <p>Elige el plan que mejor se adapte a tu negocio</p>
      </div>

      <div class="plan-grid">
        ${planesHTML}
      </div>

      <div class="pago-metodo-section" style="margin-top:16px;">
        <label>Método de pago</label>
        <div class="pago-metodos">
          <button class="pago-metodo-btn selected" id="metodoEfectivo" onclick="_seleccionarMetodo('efectivo')">
            💵 Efectivo
          </button>
          <button class="pago-metodo-btn" id="metodoTarjeta" onclick="_seleccionarMetodo('tarjeta')">
            💳 Tarjeta
          </button>
        </div>
      </div>

      <div class="membresia-footer">
        <div class="membresia-resumen" id="membresiaResumen" style="display:none;">
          <div class="res-row">
            <span>Plan seleccionado</span>
            <span id="resumenPlan">—</span>
          </div>
          <div class="res-row">
            <span>Duración</span>
            <span id="resumenDuracion">—</span>
          </div>
          <div class="res-row">
            <span>Método</span>
            <span id="resumenMetodo">—</span>
          </div>
          <div class="res-row total">
            <span>Total a pagar</span>
            <span id="resumenTotal">—</span>
          </div>
        </div>

        <!-- Instrucciones pago en efectivo -->
        <div class="efectivo-instrucciones" id="efectivoInstrucciones">
          <div style="font-size:15px;font-weight:900;margin-bottom:8px;">📋 Instrucciones para pago en efectivo:</div>
          <div>1️⃣ Anota el plan y monto seleccionado</div>
          <div>2️⃣ Realiza el pago al administrador del sistema</div>
          <div>3️⃣ El administrador activará tu cuenta manualmente</div>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid #fde68a;font-size:12px;color:#b45309;">
            📞 Contacto: <strong>al administrador de tu tienda</strong>
          </div>
          <div style="margin-top:10px;">
            <button onclick="_confirmarPagoEfectivo()" id="btnConfirmarEfectivo" class="btn-pagar efectivo" style="margin-top:8px;">
              ✅ Confirmar — Pagaré en efectivo
            </button>
          </div>
        </div>

        <div id="membresiaBtnContainer">
          <button id="btnActivarMembresia" class="btn-pagar tarjeta" onclick="_procesarPago()" style="display:none;">
            💳 Pagar con Tarjeta
          </button>
        </div>

        <div id="membresiaError" style="display:none;background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:11px;font-size:13px;color:#dc2626;font-weight:700;text-align:center;margin-top:10px;font-family:Nunito,sans-serif;"></div>

        <div style="text-align:center;margin-top:14px;">
          <button onclick="_volverAlLogin()" style="background:none;border:none;color:#9ca3af;font-size:12px;font-weight:700;font-family:Nunito,sans-serif;cursor:pointer;text-decoration:underline;text-underline-offset:3px;">
            ← Volver / Usar otra cuenta
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

let _planSeleccionado = null;
let _metodoSeleccionado = 'efectivo';
let _membresiaUserId = null;
let _membresiaEmail = null;

function _abrirModalMembresia(email, userId) {
  _membresiaEmail = email;
  _membresiaUserId = userId;
  const modal = document.getElementById('modalMembresia');
  if (modal) modal.style.display = 'flex';
  // Reset
  _planSeleccionado = null;
  _metodoSeleccionado = 'efectivo';
  document.getElementById('membresiaResumen').style.display = 'none';
  document.getElementById('efectivoInstrucciones').classList.remove('visible');
  document.getElementById('btnActivarMembresia').style.display = 'none';
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('metodoEfectivo').classList.add('selected');
  document.getElementById('metodoTarjeta').classList.remove('selected');
}

function _seleccionarPlan(planId) {
  _planSeleccionado = _PLANES_MEMBRESIA.find(p => p.id === planId);
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('planCard_' + planId).classList.add('selected');
  _actualizarResumenMembresia();
}

function _seleccionarMetodo(metodo) {
  _metodoSeleccionado = metodo;
  document.getElementById('metodoEfectivo').classList.toggle('selected', metodo === 'efectivo');
  document.getElementById('metodoTarjeta').classList.toggle('selected', metodo === 'tarjeta');
  _actualizarResumenMembresia();
}

function _actualizarResumenMembresia() {
  if (!_planSeleccionado) return;
  const resumen = document.getElementById('membresiaResumen');
  const efectivoInstr = document.getElementById('efectivoInstrucciones');
  const btnTarjeta = document.getElementById('btnActivarMembresia');

  resumen.style.display = 'block';
  document.getElementById('resumenPlan').textContent = _planSeleccionado.icono + ' ' + _planSeleccionado.label;
  document.getElementById('resumenDuracion').textContent = _planSeleccionado.dias ? _planSeleccionado.dias + ' días' : 'Para siempre ♾️';
  document.getElementById('resumenMetodo').textContent = _metodoSeleccionado === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta';
  document.getElementById('resumenTotal').textContent = '$' + _planSeleccionado.precio.toFixed(2);

  if (_metodoSeleccionado === 'efectivo') {
    efectivoInstr.classList.add('visible');
    btnTarjeta.style.display = 'none';
  } else {
    efectivoInstr.classList.remove('visible');
    btnTarjeta.style.display = 'block';
    btnTarjeta.textContent = '💳 Pagar $' + _planSeleccionado.precio.toFixed(2) + ' con Tarjeta';
  }
}

async function _confirmarPagoEfectivo() {
  if (!_planSeleccionado) { _mostrarMembresiaError('Selecciona un plan primero'); return; }
  const btn = document.getElementById('btnConfirmarEfectivo');
  btn.disabled = true;
  btn.textContent = '⏳ Registrando solicitud...';
  try {
    await _guardarSolicitudMembresia('efectivo_pendiente');
    document.getElementById('modalMembresia').style.display = 'none';
    // Mostrar confirmación y esperar activación manual
    _mostrarConfirmacionEfectivo();
  } catch(e) {
    _mostrarMembresiaError('Error al registrar: ' + e.message);
    btn.disabled = false;
    btn.textContent = '✅ Confirmar — Pagaré en efectivo';
  }
}

function _mostrarConfirmacionEfectivo() {
  // Crear overlay de confirmación
  const overlay = document.createElement('div');
  overlay.id = 'confirmacionEfectivo';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:10002;
    background:linear-gradient(135deg,#052e16,#14532d);
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:36px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.5);">
      <div style="font-size:56px;margin-bottom:16px;">⏳</div>
      <h2 style="font-size:20px;font-weight:900;color:#052e16;font-family:Nunito,sans-serif;margin:0 0 12px;">Solicitud Registrada</h2>
      <p style="font-size:14px;color:#4b7a5a;font-weight:700;font-family:Nunito,sans-serif;line-height:1.6;margin:0 0 20px;">
        Tu solicitud de membresía <strong>${_planSeleccionado?.label || ''}</strong> por
        <strong>$${_planSeleccionado?.precio?.toFixed(2) || ''}</strong> fue registrada.<br><br>
        El administrador activará tu cuenta después de recibir el pago en efectivo.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;margin-bottom:20px;font-size:13px;color:#166534;font-weight:700;font-family:Nunito,sans-serif;text-align:left;line-height:1.8;">
        <div>📧 Tu correo: <strong>${_membresiaEmail || ''}</strong></div>
        <div>💰 Monto: <strong>$${_planSeleccionado?.precio?.toFixed(2) || ''}</strong></div>
        <div>📅 Plan: <strong>${_planSeleccionado?.label || ''}</strong></div>
      </div>
      <button onclick="document.getElementById('confirmacionEfectivo').remove(); _volverAlLogin();"
        style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:15px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;width:100%;">
        Entendido — Esperaré activación
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function _procesarPago() {
  if (!_planSeleccionado) { _mostrarMembresiaError('Selecciona un plan primero'); return; }
  const btn = document.getElementById('btnActivarMembresia');
  btn.disabled = true;
  btn.textContent = '⏳ Procesando pago...';
  try {
    // Aquí integrarías tu pasarela de pago (Stripe, PayPal, etc.)
    // Por ahora se registra como pendiente de confirmación
    await _guardarSolicitudMembresia('tarjeta_pendiente');
    document.getElementById('modalMembresia').style.display = 'none';
    _mostrarConfirmacionTarjeta();
  } catch(e) {
    _mostrarMembresiaError('Error: ' + e.message);
    btn.disabled = false;
    btn.textContent = '💳 Pagar con Tarjeta';
  }
}

function _mostrarConfirmacionTarjeta() {
  const overlay = document.createElement('div');
  overlay.id = 'confirmacionTarjeta';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:10002;
    background:linear-gradient(135deg,#1e3a5f,#1e40af);
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:36px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.5);">
      <div style="font-size:56px;margin-bottom:16px;">💳</div>
      <h2 style="font-size:20px;font-weight:900;color:#052e16;font-family:Nunito,sans-serif;margin:0 0 12px;">Pago con Tarjeta</h2>
      <p style="font-size:14px;color:#374151;font-weight:700;font-family:Nunito,sans-serif;line-height:1.6;margin:0 0 20px;">
        Para activar tu plan <strong>${_planSeleccionado?.label || ''}</strong>,
        contacta al administrador para configurar el pago con tarjeta por
        <strong>$${_planSeleccionado?.precio?.toFixed(2) || ''}</strong>.
      </p>
      <button onclick="document.getElementById('confirmacionTarjeta').remove(); _volverAlLogin();"
        style="background:linear-gradient(135deg,#1d4ed8,#1e40af);color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:15px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;width:100%;">
        Entendido
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function _guardarSolicitudMembresia(estadoPago) {
  const ahora = new Date();
  const plan = _planSeleccionado;
  let fechaVenc = null;
  if (plan.dias) {
    fechaVenc = new Date(ahora.getTime() + plan.dias * 24 * 60 * 60 * 1000).toISOString();
  }
  await _sbPost('membresias', {
    id: 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    user_id: _membresiaUserId,
    email: _membresiaEmail,
    nombre: _usuarioActual?.nombre || '',
    tipo: plan.id,
    monto: plan.precio,
    pago: estadoPago,
    fecha_inicio: ahora.toISOString(),
    fecha_vencimiento: fechaVenc,
    activa: estadoPago === 'completado' // Solo activa si pago completado
  }, true);
}

function _mostrarMembresiaError(msg) {
  const el = document.getElementById('membresiaError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _volverAlLogin() {
  const m = document.getElementById('modalMembresia');
  if (m) m.style.display = 'none';
  // Cerrar sesión temporal y volver al login
  _sesionActiva = false; _tiendaId = null; _usuarioActual = null; _authToken = null;
  localStorage.removeItem('vpos_sesionActiva');
  localStorage.removeItem('vpos_authToken');
  abrirLogin();
}

// ── Admin: Activar membresía manualmente ─────────────────────────────
async function activarMembresiaManual(email, tipoMembresia) {
  if (!_esSuperAdmin()) { toast('Solo el administrador principal puede activar membresías', true); return; }
  const plan = _PLANES_MEMBRESIA.find(p => p.id === tipoMembresia);
  if (!plan) { toast('Tipo de membresía inválido: ' + tipoMembresia, true); return; }
  try {
    const ahora = new Date();
    let fechaVenc = null;
    if (plan.dias) {
      fechaVenc = new Date(ahora.getTime() + plan.dias * 24 * 60 * 60 * 1000).toISOString();
    }

    // Buscar solicitudes pendientes de ese email (efectivo O tarjeta)
    const pendientes = await _sbGet('membresias', {
      select: '*',
      email: 'eq.' + email,
      activa: 'eq.false',
      order: 'fecha_inicio.desc',
      limit: 1
    }).catch(() => []);

    if (pendientes && pendientes.length > 0) {
      // Actualizar el registro existente con PATCH (más confiable que upsert)
      await _sbPatch('membresias', { id: 'eq.' + pendientes[0].id }, {
        tipo: tipoMembresia,
        monto: plan.precio,
        pago: 'efectivo_confirmado',
        activa: true,
        fecha_inicio: ahora.toISOString(),
        fecha_vencimiento: fechaVenc
      });
    } else {
      // No hay solicitud previa — crear membresía activa directamente
      const users = await _sbGet('perfiles', { select: 'id', email: 'eq.' + email }).catch(() => []);
      const userId = users && users.length > 0 ? users[0].id : null;
      if (!userId) { toast('No se encontró usuario con ese correo', true); return; }
      await _sbPost('membresias', {
        id: 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        user_id: userId,
        email: email,
        nombre: users[0]?.nombre || '',
        tipo: tipoMembresia,
        monto: plan.precio,
        pago: 'efectivo_confirmado',
        fecha_inicio: ahora.toISOString(),
        fecha_vencimiento: fechaVenc,
        activa: true
      }, false);
    }
    _registrarAccion('activar_membresia', email + ' → ' + tipoMembresia);
    toast('✅ Membresía ' + plan.label + ' activada para ' + email);
  } catch(e) {
    toast('Error al activar: ' + e.message, true);
    console.error('[activarMembresia]', e);
  }
}

// =====================================================================
//  👑 PANEL DE ADMINISTRADOR — funciones completas
// =====================================================================

let _notifPendienteActual = null; // membresía pendiente en notif flotante

// ── Mostrar/ocultar tab de Admin según rol ────────────────────────────
// Solo el dueño principal (emails exentos) puede ver el panel Admin global
function _esSuperAdmin() {
  return _EMAILS_EXENTOS.includes((_usuarioActual?.email || '').toLowerCase().trim());
}

function _actualizarTabAdmin() {
  const esSuperAdmin = _esSuperAdmin();
  const tabAdmin = document.getElementById('tabAdmin');
  const dniAdmin = document.getElementById('dniAdmin');
  if (tabAdmin) tabAdmin.style.display = esSuperAdmin ? '' : 'none';
  if (dniAdmin) dniAdmin.style.display = esSuperAdmin ? '' : 'none';
  if (esSuperAdmin) {
    const heroUser = document.getElementById('adminHeroUser');
    if (heroUser) heroUser.textContent = _usuarioActual.nombre || _usuarioActual.email;
    iniciarMonitorMembresiasPendientes();
  }
  // Ocultar/mostrar botón "Ver Código" según si es super admin
  _actualizarBotonCodigo();
}

// Oculta el botón "Ver Código" para usuarios que no son el dueño principal
function _actualizarBotonCodigo() {
  const esSuperAdmin = _esSuperAdmin();
  document.querySelectorAll('.btn-ver-codigo').forEach(btn => {
    btn.style.display = esSuperAdmin ? '' : 'none';
  });
}

// ── Render completo del panel admin ──────────────────────────────────
async function renderAdminPanel() {
  if (!_esSuperAdmin()) {
    document.getElementById('pgAdmin').innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:48px;margin-bottom:16px;">🔒</div>
        <div style="font-size:18px;font-weight:900;color:var(--text);">Acceso restringido</div>
        <div style="font-size:14px;color:var(--text-muted);font-weight:700;margin-top:8px;">Solo el administrador principal puede ver este panel</div>
      </div>`;
    return;
  }
  adminCargarStats();
  adminCargarPendientes();
  adminCargarMembresias();
  adminCargarUsuarios();
  // Membresías activas con botón eliminar
  if (typeof renderMembresíasActivas === 'function') renderMembresíasActivas('membActivasContainer');
}

// ── Stats rápidas del admin ───────────────────────────────────────────
async function adminCargarStats() {
  try {
    const [usuarios, membresias] = await Promise.all([
      _sbGet('perfiles', { select: 'id,rol,activo', tienda_id: 'eq.' + _getTiendaId() }).catch(() => []),
      _sbGet('membresias', { select: 'id,activa,monto,pago,fecha_inicio' }).catch(() => [])
    ]);
    const activas = (membresias || []).filter(m => m.activa).length;
    const pendientes = (membresias || []).filter(m =>
      (m.pago === 'efectivo_pendiente' || m.pago === 'tarjeta_pendiente') && !m.activa
    ).length;
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const ingresosMes = (membresias || [])
      .filter(m => m.activa && new Date(m.fecha_inicio) >= inicioMes)
      .reduce((s, m) => s + Number(m.monto || 0), 0);

    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('adminStatUsuarios', (usuarios || []).length);
    el('adminStatActivas', activas);
    el('adminStatPendientes', pendientes);
    el('adminStatIngresos', '$' + ingresosMes.toFixed(2));

    // Actualizar badge de pendientes
    const badge = document.getElementById('adminPendBadge');
    if (badge) {
      badge.textContent = pendientes;
      badge.style.display = pendientes > 0 ? '' : 'none';
    }
  } catch(e) { console.warn('[adminStats]', e.message); }
}

// ── Cargar pendientes de aprobación ──────────────────────────────────
async function adminCargarPendientes() {
  const container = document.getElementById('adminPendList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-weight:700;font-size:13px;">⏳ Cargando...</div>';
  try {
    const rows = await _sbGet('membresias', {
      select: '*',
      or: '(pago.eq.efectivo_pendiente,pago.eq.tarjeta_pendiente)',
      activa: 'eq.false',
      order: 'fecha_inicio.desc'
    }).catch(() => []);

    if (!rows || !rows.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <div style="font-size:36px;margin-bottom:10px;">✅</div>
          <div style="font-size:14px;font-weight:900;color:var(--text-muted);">Sin solicitudes pendientes</div>
        </div>`;
      // Limpiar badge
      const badge = document.getElementById('adminPendBadge');
      if (badge) badge.style.display = 'none';
      return;
    }

    // Badge
    const badge = document.getElementById('adminPendBadge');
    if (badge) { badge.textContent = rows.length; badge.style.display = ''; }

    container.innerHTML = rows.map(m => {
      const plan = _PLANES_MEMBRESIA.find(p => p.id === m.tipo) || { label: m.tipo, icono: '📋', precio: m.monto };
      const fecha = m.fecha_inicio ? new Date(m.fecha_inicio).toLocaleDateString('es-SV') : '';
      const metodo = m.pago === 'tarjeta_pendiente' ? '💳 Tarjeta' : '💵 Efectivo';
      const inicial = (m.nombre || m.email || '?').charAt(0).toUpperCase();
      return `
        <div class="mem-row">
          <div class="mem-avatar">${inicial}</div>
          <div class="mem-info">
            <div class="mem-name">${m.nombre || '—'}</div>
            <div class="mem-email">${m.email} · ${fecha}</div>
          </div>
          <div class="mem-plan-tag" style="--mpt-bg:rgba(245,158,11,0.1);--mpt-c:#b45309;--mpt-b:rgba(245,158,11,0.25);">
            ${plan.icono} ${plan.label} · $${Number(m.monto).toFixed(2)}
          </div>
          <span style="font-size:11px;color:var(--text-muted);font-weight:700;flex-shrink:0;">${metodo}</span>
          <div class="mem-btns">
            <button class="btn-accept" onclick="adminAceptarMembresia('${m.id}','${m.email}','${m.tipo}')">✅ Aceptar</button>
            <button class="btn-reject" onclick="adminRechazarMembresia('${m.id}','${m.email}')">✕</button>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = `<div style="color:var(--red);padding:16px;font-size:13px;font-weight:700;">Error: ${e.message}</div>`;
  }
}

// ── Aceptar membresía ─────────────────────────────────────────────────
async function adminAceptarMembresia(memId, email, tipoMembresia) {
  if (!confirm(`¿Activar membresía "${tipoMembresia}" para ${email}?`)) return;
  try {
    const plan = _PLANES_MEMBRESIA.find(p => p.id === tipoMembresia);
    const ahora = new Date();
    let fechaVenc = null;
    if (plan && plan.dias) {
      fechaVenc = new Date(ahora.getTime() + plan.dias * 24 * 60 * 60 * 1000).toISOString();
    }
    // PATCH directo por ID — la forma más confiable de actualizar en Supabase
    await _sbPatch('membresias', { id: 'eq.' + memId }, {
      pago: 'efectivo_confirmado',
      activa: true,
      fecha_inicio: ahora.toISOString(),
      fecha_vencimiento: fechaVenc
    });
    _registrarAccion('activar_membresia', email + ' → ' + tipoMembresia);
    toast('✅ Membresía activada para ' + email);
    // Marcar como vista para que no salga en notif esta sesión
    _memPendientesVistas.add(memId);
    _notifMostrada = false; // permitir siguiente notif
    adminCargarPendientes();
    adminCargarStats();
    adminCargarMembresias();
  } catch(e) {
    toast('Error al activar: ' + e.message, true);
    console.error('[adminAceptar]', e);
  }
}

// ── Rechazar membresía ────────────────────────────────────────────────
async function adminRechazarMembresia(memId, email) {
  if (!confirm(`¿Rechazar la solicitud de ${email}?`)) return;
  try {
    await _sbPatch('membresias', { id: 'eq.' + memId }, { pago: 'rechazado', activa: false });
    _registrarAccion('rechazar_membresia', email);
    toast('Solicitud rechazada');
    _memPendientesVistas.add(memId);
    _notifMostrada = false;
    adminCargarPendientes();
    adminCargarStats();
  } catch(e) { toast('Error: ' + e.message, true); }
}

// ── Historial de membresías ───────────────────────────────────────────
async function adminCargarMembresias() {
  const container = document.getElementById('adminMemHistorial');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;font-weight:700;">⏳ Cargando...</div>';
  try {
    const rows = await _sbGet('membresias', {
      select: '*', order: 'fecha_inicio.desc', limit: 30
    }).catch(() => []);

    if (!rows || !rows.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;font-weight:700;">Sin membresías registradas</div>';
      return;
    }

    container.innerHTML = rows.map(m => {
      const plan = _PLANES_MEMBRESIA.find(p => p.id === m.tipo) || { label: m.tipo, icono: '📋' };
      const fecha = m.fecha_inicio ? new Date(m.fecha_inicio).toLocaleDateString('es-SV') : '';
      const vence = m.fecha_vencimiento ? new Date(m.fecha_vencimiento).toLocaleDateString('es-SV') : 'Nunca';
      const activa = m.activa;
      const pendiente = m.pago === 'efectivo_pendiente' || m.pago === 'tarjeta_pendiente';
      const tagBg = activa ? '--mpt-bg:#dcfce7;--mpt-c:#16a34a;--mpt-b:#bbf7d0'
        : pendiente ? '--mpt-bg:rgba(245,158,11,0.1);--mpt-c:#b45309;--mpt-b:rgba(245,158,11,0.25)'
        : '--mpt-bg:rgba(220,38,38,0.08);--mpt-c:#dc2626;--mpt-b:rgba(220,38,38,0.2)';
      const tagLabel = activa ? '✅ Activa' : pendiente ? '⏳ Pendiente' : '✕ Inactiva';
      const inicial = (m.nombre || m.email || '?').charAt(0).toUpperCase();
      return `
        <div class="mem-row">
          <div class="mem-avatar" style="background:linear-gradient(135deg,${activa?'#059669,#065f46':pendiente?'#d97706,#b45309':'#9ca3af,#6b7280'})">${inicial}</div>
          <div class="mem-info">
            <div class="mem-name">${m.nombre || '—'}</div>
            <div class="mem-email">${m.email} · ${fecha}${m.fecha_vencimiento ? ' → ' + vence : ''}</div>
          </div>
          <div class="mem-plan-tag" style="${tagBg}">${plan.icono} ${plan.label}</div>
          <div class="mem-plan-tag" style="${tagBg}">${tagLabel}</div>
        </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = `<div style="color:var(--red);padding:16px;font-size:13px;font-weight:700;">Error: ${e.message}</div>`;
  }
}

// ── Lista de usuarios ─────────────────────────────────────────────────
async function adminCargarUsuarios() {
  const container = document.getElementById('adminUserList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;font-weight:700;">⏳ Cargando...</div>';
  try {
    const [usuarios, membresias] = await Promise.all([
      _sbGet('perfiles', { select: '*', tienda_id: 'eq.' + _getTiendaId(), order: 'created_at.asc' }).catch(() => []),
      _sbGet('membresias', { select: 'user_id,activa,tipo', activa: 'eq.true' }).catch(() => [])
    ]);

    if (!usuarios || !usuarios.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;font-weight:700;">Sin usuarios</div>';
      return;
    }

    const memMap = {};
    (membresias || []).forEach(m => { memMap[m.user_id] = m; });

    container.innerHTML = `<div class="admin-users-list">${usuarios.map(u => {
      const esExentoU = _EMAILS_EXENTOS.includes((u.email||'').toLowerCase());
      const mem = memMap[u.id];
      const rolClass = u.rol === 'admin' ? '' : 'cajero';
      // Los usuarios exentos (dueños) se muestran como Admin; los demás son Clientes
      const rolLabel = esExentoU ? '👑 Admin' : '👤 Cliente';
      const rolClassFinal = esExentoU ? '' : 'cajero';
      const memTag = esExentoU
        ? '<span class="aur-mem exento">♾️ Exento</span>'
        : mem
          ? `<span class="aur-mem activa">✅ ${(_PLANES_MEMBRESIA.find(p=>p.id===mem.tipo)||{label:mem.tipo}).label}</span>`
          : '<span class="aur-mem vencida">Sin membresía</span>';
      const inicial = (u.nombre || u.email || '?').charAt(0).toUpperCase();
      const esMismoUsuario = u.id === _usuarioActual?.id;
      const tiendaLabel = u.tienda_id || '—';
      return `
        <div class="admin-user-row">
          <div class="aur-avatar">${inicial}</div>
          <div class="aur-info">
            <div class="aur-name">${u.nombre || '—'}</div>
            <div class="aur-email">${u.email || '—'}</div>
          </div>
          ${memTag}
          <span class="aur-role ${rolClassFinal}">${rolLabel}</span>
          ${!esExentoU ? `
            <button onclick="adminVerCredenciales('${(u.nombre||'').replace(/'/g,"\\'")}','${(u.email||'').replace(/'/g,"\\'")}','${tiendaLabel.replace(/'/g,"\\'")}','${u.id||''}')"
              style="background:rgba(29,78,216,0.1);color:#1d4ed8;border:1px solid rgba(29,78,216,0.25);border-radius:8px;padding:5px 10px;font-size:11px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;white-space:nowrap;"
              title="Ver datos de acceso del cliente">🔑 Datos</button>` : ''}
          ${!esMismoUsuario && !esExentoU ? `
            <button onclick="adminEliminarUsuario('${u.id}','${(u.email||'').replace(/'/g,"\\'")}','${(u.nombre||'').replace(/'/g,"\\'")}');adminCargarUsuarios();"
              style="background:rgba(220,38,38,0.1);color:#dc2626;border:1px solid rgba(220,38,38,0.25);border-radius:8px;padding:5px 10px;font-size:11px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;white-space:nowrap;"
              title="Eliminar usuario y revocar acceso">🗑 Eliminar</button>` : 
            esMismoUsuario ? '<span style="font-size:11px;color:var(--text-muted);font-weight:700;">(tú)</span>' : ''}
        </div>`;
    }).join('')}</div>`;
  } catch(e) {
    container.innerHTML = `<div style="color:var(--red);padding:16px;font-size:13px;font-weight:700;">Error: ${e.message}</div>`;
  }
}

// ── Eliminar / deshabilitar usuario ──────────────────────────────────
async function adminEliminarUsuario(userId, email, nombre) {
  if (!_esSuperAdmin()) { toast('Sin permiso', true); return; }
  const confirmar = confirm(`¿Eliminar el usuario "${nombre || email}"?\n\nSe desactivará su cuenta y no podrá iniciar sesión.\nEsta acción no se puede deshacer fácilmente.`);
  if (!confirmar) return;
  try {
    // Desactivar perfil en tabla perfiles
    await _sbPatch('perfiles', { id: 'eq.' + userId }, { activo: false });
    // Marcar membresías activas como revocadas
    await _sbPatch('membresias', { user_id: 'eq.' + userId, activa: 'eq.true' }, { activa: false, pago: 'revocado' }).catch(() => {});
    _registrarAccion('eliminar_usuario', email);
    toast('✅ Usuario ' + (nombre || email) + ' eliminado y acceso revocado');
    adminCargarStats();
    adminCargarUsuarios();
  } catch(e) {
    toast('Error al eliminar: ' + e.message, true);
    console.error('[adminEliminar]', e);
  }
}

// ── Ver datos de acceso del cliente ──────────────────────────────────
function adminVerCredenciales(nombre, email, tiendaId, userId) {
  // Crear modal si no existe
  if (!document.getElementById('modalCredCliente')) {
    const m = document.createElement('div');
    m.id = 'modalCredCliente';
    m.style.cssText = 'position:fixed;inset:0;z-index:10060;background:rgba(5,46,22,0.75);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:16px;';
    m.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:100%;max-width:400px;box-shadow:0 24px 60px rgba(0,0,0,0.4);overflow:hidden;animation:loginSlideUp 0.3s cubic-bezier(0.22,1,0.36,1);">
        <div style="background:linear-gradient(135deg,#1d4ed8,#1e40af);padding:20px 24px 16px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:26px;">🔑</span>
          <div>
            <div style="color:#fff;font-size:16px;font-weight:900;font-family:Nunito,sans-serif;">Datos de acceso</div>
            <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:700;font-family:Nunito,sans-serif;">Para ayudar al cliente a iniciar sesión</div>
          </div>
        </div>
        <div style="padding:22px 24px;">
          <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:16px;">
            <div style="margin-bottom:12px;">
              <div style="font-size:10px;font-weight:900;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px;font-family:Nunito,sans-serif;margin-bottom:4px;">👤 Nombre</div>
              <div id="credNombre" style="font-size:15px;font-weight:900;color:#1e3a8a;font-family:Nunito,sans-serif;"></div>
            </div>
            <div style="margin-bottom:12px;">
              <div style="font-size:10px;font-weight:900;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px;font-family:Nunito,sans-serif;margin-bottom:4px;">📧 Correo electrónico</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <div id="credEmail" style="font-size:14px;font-weight:900;color:#1e3a8a;font-family:Nunito,sans-serif;flex:1;word-break:break-all;"></div>
                <button onclick="navigator.clipboard.writeText(document.getElementById('credEmail').textContent).then(()=>toast('✓ Correo copiado'))"
                  style="background:#dbeafe;border:1px solid #bfdbfe;border-radius:7px;padding:4px 9px;font-size:11px;font-weight:900;cursor:pointer;color:#1d4ed8;font-family:Nunito,sans-serif;white-space:nowrap;">📋 Copiar</button>
              </div>
            </div>
            <div style="margin-bottom:4px;">
              <div style="font-size:10px;font-weight:900;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px;font-family:Nunito,sans-serif;margin-bottom:4px;">🏪 ID de Tienda</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <div id="credTienda" style="font-size:14px;font-weight:900;color:#1e3a8a;font-family:Nunito,sans-serif;flex:1;"></div>
                <button onclick="navigator.clipboard.writeText(document.getElementById('credTienda').textContent).then(()=>toast('✓ ID copiado'))"
                  style="background:#dbeafe;border:1px solid #bfdbfe;border-radius:7px;padding:4px 9px;font-size:11px;font-weight:900;cursor:pointer;color:#1d4ed8;font-family:Nunito,sans-serif;white-space:nowrap;">📋 Copiar</button>
              </div>
            </div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:11px 13px;margin-bottom:18px;font-size:12px;font-weight:700;color:#92400e;font-family:Nunito,sans-serif;line-height:1.6;">
            ⚠️ La <strong>contraseña no se almacena</strong> en el sistema por seguridad. Si el cliente la olvidó, debe usar <em>"¿Olvidaste tu contraseña?"</em> en el login para restablecerla por correo.
          </div>
          <button onclick="document.getElementById('modalCredCliente').style.display='none'"
            style="width:100%;padding:13px;background:linear-gradient(135deg,#1d4ed8,#1e40af);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:900;font-family:Nunito,sans-serif;cursor:pointer;">
            ✓ Cerrar
          </button>
        </div>
      </div>`;
    m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    document.body.appendChild(m);
  }
  document.getElementById('credNombre').textContent = nombre || '—';
  document.getElementById('credEmail').textContent  = email  || '—';
  document.getElementById('credTienda').textContent = tiendaId || '—';
  document.getElementById('modalCredCliente').style.display = 'flex';
}
window.adminVerCredenciales = adminVerCredenciales;

// ── Activar manual desde panel admin ─────────────────────────────────
async function adminActivarManual() {
  const email = (document.getElementById('adminManualEmail')?.value || '').trim();
  const plan  = document.getElementById('adminManualPlan')?.value || 'mensual';
  if (!email || !email.includes('@')) { toast('Ingresa un correo válido', true); return; }
  await activarMembresiaManual(email, plan);
  adminCargarPendientes(); adminCargarStats(); adminCargarMembresias(); adminCargarUsuarios();
  document.getElementById('adminManualEmail').value = '';
}

// ── Log de acciones ───────────────────────────────────────────────────
async function adminCargarAcciones() {
  const container = document.getElementById('adminAccionesList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;font-weight:700;">⏳ Cargando...</div>';
  try {
    const rows = await _sbGet('acciones_log', {
      select: '*', tienda_id: 'eq.' + _getTiendaId(), order: 'created_at.desc', limit: 50
    }).catch(() => []);
    if (!rows || !rows.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;font-weight:700;">Sin registros</div>';
      return;
    }
    container.innerHTML = `<div style="max-height:320px;overflow-y:auto;">` + rows.map(a => {
      const fecha = a.created_at ? new Date(a.created_at).toLocaleString('es-SV', {dateStyle:'short',timeStyle:'short'}) : '';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <span style="font-weight:900;font-size:12px;color:var(--text);">${a.usuario_nom}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:6px;">${a.accion}</span>
          ${a.detalle ? `<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">${a.detalle}</div>` : ''}
        </div>
        <span style="font-size:10px;color:var(--text-muted);white-space:nowrap;font-weight:700;">${fecha}</span>
      </div>`;
    }).join('') + '</div>';
  } catch(e) {
    container.innerHTML = `<div style="color:var(--red);padding:16px;font-size:13px;font-weight:700;">Error: ${e.message}</div>`;
  }
}

// =====================================================================
//  🔔 MONITOR DE MEMBRESÍAS PENDIENTES — notificación flotante
// =====================================================================

let _monitorMemTimer = null;
// IDs vistos en esta sesión únicamente — no persistimos para que siempre lleguen notifs nuevas
let _memPendientesVistas = new Set();
let _notifMostrada = false; // solo mostrar una notif a la vez

function iniciarMonitorMembresiasPendientes() {
  if (_monitorMemTimer) return; // ya corriendo
  // Verificar de inmediato al iniciar
  setTimeout(_verificarNuevasSolicitudes, 2000);
  _monitorMemTimer = setInterval(_verificarNuevasSolicitudes, 60000); // cada 60 seg
}

async function _verificarNuevasSolicitudes() {
  if (!_esSuperAdmin() || !_sbUrl() || !_sbKey()) return;
  try {
    const rows = await _sbGet('membresias', {
      select: 'id,nombre,email,tipo,monto,pago,fecha_inicio',
      or: '(pago.eq.efectivo_pendiente,pago.eq.tarjeta_pendiente)',
      activa: 'eq.false',
      order: 'fecha_inicio.desc'
    }).catch(() => []);

    if (!rows || !rows.length) {
      _actualizarBadgeAdminPendientes(0);
      return;
    }

    // Actualizar badge del tab Admin
    _actualizarBadgeAdminPendientes(rows.length);

    // Mostrar notif solo si no hay una ya visible Y hay solicitudes no vistas esta sesión
    if (!_notifMostrada) {
      const nueva = rows.find(m => !_memPendientesVistas.has(m.id));
      if (nueva) {
        _notifPendienteActual = nueva;
        _notifMostrada = true;
        _mostrarNotifNuevaSolicitud(nueva);
      }
    }
  } catch(e) { /* silencioso en monitor de fondo */ }
}

function _actualizarBadgeAdminPendientes(count) {
  // Badge en el tab de navbar
  const tabAdmin = document.getElementById('tabAdmin');
  if (!tabAdmin) return;
  let badge = tabAdmin.querySelector('.admin-pending-badge');
  if (count > 0) {
    if (!badge) {
      // Envolver en wrapper relativo
      let wrap = tabAdmin.parentElement;
      if (!wrap.classList.contains('nav-tab-wrap')) {
        wrap = document.createElement('div');
        wrap.className = 'nav-tab-wrap';
        tabAdmin.parentElement.insertBefore(wrap, tabAdmin);
        wrap.appendChild(tabAdmin);
      }
      badge = document.createElement('span');
      badge.className = 'admin-pending-badge';
      wrap.appendChild(badge);
    }
    badge.textContent = count;
  } else if (badge) {
    badge.remove();
  }
}

function _mostrarNotifNuevaSolicitud(mem) {
  const popup = document.getElementById('adminNotifPopup');
  if (!popup) return;
  const plan = _PLANES_MEMBRESIA.find(p => p.id === mem.tipo) || { label: mem.tipo, icono: '📋' };
  const metodo = mem.pago === 'tarjeta_pendiente' ? '💳 Tarjeta' : '💵 Efectivo';
  const fecha = mem.fecha_inicio ? new Date(mem.fecha_inicio).toLocaleDateString('es-SV') : '';

  const nNombre = document.getElementById('notifClientNombre');
  const nDetail = document.getElementById('notifClientDetail');
  if (nNombre) nNombre.textContent = (mem.nombre || mem.email || '—');
  if (nDetail) nDetail.textContent = `${plan.icono} ${plan.label} · $${Number(mem.monto).toFixed(2)} · ${metodo} · ${fecha}`;

  popup.classList.add('visible');
}

function adminCerrarNotif() {
  const popup = document.getElementById('adminNotifPopup');
  if (popup) popup.classList.remove('visible');
  _notifMostrada = false;
  // Marcar como vista en memoria de sesión (no en localStorage, para que llegue en próxima sesión)
  if (_notifPendienteActual) {
    _memPendientesVistas.add(_notifPendienteActual.id);
    _notifPendienteActual = null;
  }
}

async function adminAceptarDesdeNotif() {
  if (!_notifPendienteActual) return;
  const m = _notifPendienteActual;
  adminCerrarNotif();
  await adminAceptarMembresia(m.id, m.email, m.tipo);
}

async function adminRechazarDesdeNotif() {
  if (!_notifPendienteActual) return;
  const m = _notifPendienteActual;
  adminCerrarNotif();
  await adminRechazarMembresia(m.id, m.email);
}

// ── Llamar _actualizarTabAdmin después de restaurar sesión ────────────
const _orig_finalizarLogin = _finalizarLogin;
// Patch para activar tab admin al login
const _patchFinalizarLogin = async function() {
  await _orig_finalizarLogin.call(this);
  _actualizarTabAdmin();
};

