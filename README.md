# 🛒 Despensa Económica — Sistema de Ventas (POS)

PWA de punto de venta para tiendas pequeñas. Funciona 100% offline con IndexedDB y sincroniza en la nube vía Supabase.

---

## 🚀 Deploy en GitHub Pages

1. Sube todos estos archivos a un repositorio GitHub (puede ser público o privado).
2. Ve a **Settings → Pages → Source: Deploy from branch → main / root**.
3. Tu app quedará en: `https://TU_USUARIO.github.io/TU_REPO/`

**Archivos que deben estar en el repositorio:**
```
index.html
app.js
supabase_sync.js
alarmas.js
sync.js
```

---

## ☁️ Configurar Supabase (sync en la nube)

### 1. Crear proyecto
- Entra a [supabase.com](https://supabase.com) → **New project** (gratis).

### 2. Crear tablas
- Ve a **SQL Editor → New query**.
- Pega todo el contenido de `supabase_schema.sql` y ejecuta.

### 3. Obtener credenciales
- Ve a **Project Settings → API**.
- Copia la **Project URL** y la **anon public key**.

### 4. Conectar la app
- Abre la app → botón **⚙️ Sync** (o el badge en la barra superior).
- Pega la URL y la Key.
- Presiona **🔌 Probar conexión** → debería decir ✅ Conexión exitosa.
- Presiona **💾 Guardar y conectar**.
- Exporta tu inventario con **📤 Exportar todo a nube**.

### 5. Compartir entre teléfonos
- Abre la misma URL de GitHub Pages en cualquier otro teléfono.
- Configura las mismas credenciales de Supabase.
- Usa **📥 Importar desde nube** para sincronizar.

---

## 📁 Estructura de archivos

| Archivo | Descripción |
|---|---|
| `index.html` | Interfaz completa (HTML + CSS + modales) |
| `app.js` | Motor principal: IndexedDB, ventas, inventario, POS |
| `supabase_sync.js` | Sincronización en la nube (Supabase) |
| `alarmas.js` | Scanner de código de barras + alarmas de PDF |
| `sync.js` | Cámara, captura de fotos y quitar fondo |
| `supabase_schema.sql` | SQL para crear las tablas en Supabase |
| `GOOGLE_APPS_SCRIPT.js` | *(legado)* — ya no se usa, reemplazado por Supabase |

---

## 📱 Funcionalidades

- **POS táctil** con búsqueda, scanner de código de barras y paquetes
- **Inventario** con fotos, categorías, stock mínimo y alertas
- **Caja diaria** con balance, proyecciones y flujo de efectivo
- **Reportes** con gráficas, historial y exportación CSV/PDF
- **Facturas digitales** con envío por WhatsApp o Gmail
- **Alarmas de PDF** programables por día y hora
- **Sync bidireccional** entre múltiples teléfonos via Supabase
- **Funciona offline** — IndexedDB como base de datos local

---

## 🔒 Seguridad

Las políticas RLS en `supabase_schema.sql` permiten acceso público con la `anon key`. Para mayor seguridad en producción, considera restringir las políticas por usuario (Supabase Auth) o usar una clave de entorno en un backend propio.
