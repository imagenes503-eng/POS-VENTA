// ===== CÁMARA Y QUITAR FONDO =====
let _streamCamara = null;
let _facingMode = 'environment'; // trasera por defecto
let _fotoDataURL = null;
let _fotoConFondoQuitado = null;

async function abrirCamara() {
  try {
    if (_streamCamara) { _streamCamara.getTracks().forEach(t => t.stop()); _streamCamara = null; }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false
    });
    _streamCamara = stream;
    const video = document.getElementById('videoStream');
    video.srcObject = stream;
    document.getElementById('modalCamara').classList.add('open');
  } catch (err) {
    console.error('Cámara:', err);
    if (err.name === 'NotAllowedError') toast('⚠ Permiso de cámara denegado. Actívalo en tu navegador.', true);
    else if (err.name === 'NotFoundError') toast('⚠ No se encontró cámara en este dispositivo.', true);
    else toast('⚠ No se pudo acceder a la cámara: ' + err.message, true);
  }
}

async function flipCamara() {
  _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
  if (_streamCamara) { _streamCamara.getTracks().forEach(t => t.stop()); }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false
    });
    _streamCamara = stream;
    document.getElementById('videoStream').srcObject = stream;
  } catch(e) { toast('No se pudo cambiar la cámara', true); }
}

function cerrarCamara() {
  if (_streamCamara) { _streamCamara.getTracks().forEach(t => t.stop()); _streamCamara = null; }
  document.getElementById('modalCamara').classList.remove('open');
}

function capturarFoto() {
  const video = document.getElementById('videoStream');
  const canvas = document.getElementById('canvasCaptura');
  const size = Math.min(video.videoWidth, video.videoHeight);
  const offsetX = (video.videoWidth - size) / 2;
  const offsetY = (video.videoHeight - size) / 2;
  canvas.width = Math.min(size, 800);
  canvas.height = Math.min(size, 800);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, canvas.width, canvas.height);
  _fotoDataURL = canvas.toDataURL('image/jpeg', 0.92);
  _fotoConFondoQuitado = null;

  // Mostrar modal de revisión
  cerrarCamara();
  document.getElementById('fotoPreviewImg').src = _fotoDataURL;
  document.getElementById('bgCheckerboard').style.display = 'none';
  document.getElementById('procesandoBg').style.display = 'none';
  document.getElementById('bgStatusMsg').textContent = '';
  document.getElementById('btnQuitarFondoModal').disabled = false;
  document.getElementById('btnQuitarFondoModal').style.display = '';
  document.getElementById('btnUsarFoto').textContent = '✅ Usar esta foto';
  document.getElementById('modalFotoCapturada').classList.add('open');
}

function retomar() {
  document.getElementById('modalFotoCapturada').classList.remove('open');
  abrirCamara();
}

function usarFotoCapturada() {
  const dataURL = _fotoConFondoQuitado || _fotoDataURL;
  if (!dataURL) return;
  _imagenPendiente = dataURL;
  const prev = document.getElementById('imgPreview');
  prev.innerHTML = `<img src="${dataURL}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`;
  prev.style.border = '2px solid var(--green)';
  document.getElementById('btnQuitarImg').style.display = '';
  document.getElementById('btnQuitarFondo').style.display = '';
  document.getElementById('modalFotoCapturada').classList.remove('open');
  toast('✓ Foto guardada en el producto');
}

// ===== QUITAR FONDO — algoritmo local por canvas =====
// Técnica: detección del color de fondo (esquinas) + flood-fill alpha masking
async function quitarFondoDesdeModal() {
  if (!_fotoDataURL) return;
  const btn = document.getElementById('btnQuitarFondoModal');
  btn.disabled = true;
  document.getElementById('procesandoBg').style.display = 'flex';
  document.getElementById('procesandoTxt').textContent = 'Analizando imagen…';
  document.getElementById('bgStatusMsg').textContent = '';

  await new Promise(r => setTimeout(r, 50)); // yield para que el UI actualice

  try {
    document.getElementById('procesandoTxt').textContent = 'Quitando fondo…';
    const resultado = await removeBackgroundLocal(_fotoDataURL);
    _fotoConFondoQuitado = resultado;
    document.getElementById('fotoPreviewImg').src = resultado;
    document.getElementById('bgCheckerboard').style.display = 'block';
    document.getElementById('procesandoBg').style.display = 'none';
    document.getElementById('bgStatusMsg').textContent = '✓ Fondo eliminado. Revisa el resultado.';
    document.getElementById('btnQuitarFondoModal').style.display = 'none';
    document.getElementById('btnUsarFoto').textContent = '✅ Usar foto sin fondo';
  } catch(e) {
    document.getElementById('procesandoBg').style.display = 'none';
    document.getElementById('bgStatusMsg').textContent = '⚠ ' + e.message;
    btn.disabled = false;
  }
}

// Quitar fondo desde el botón de la ficha del producto (ya cargada)
async function quitarFondoImagen() {
  if (!_imagenPendiente) { toast('Primero carga o toma una foto', true); return; }
  const btn = document.getElementById('btnQuitarFondo');
  btn.disabled = true;
  btn.textContent = '⏳ Procesando…';
  try {
    const resultado = await removeBackgroundLocal(_imagenPendiente);
    _imagenPendiente = resultado;
    const prev = document.getElementById('imgPreview');
    prev.innerHTML = `<img src="${resultado}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;background:repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 0 0/14px 14px;">`;
    toast('✓ Fondo eliminado correctamente');
  } catch(e) {
    toast('⚠ ' + e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Quitar fondo';
  }
}

/**
 * Elimina el fondo de una imagen usando canvas.
 * Estrategia: muestrea los bordes para obtener el color dominante del fondo,
 * luego hace flood-fill desde las esquinas eliminando píxeles similares (con tolerancia).
 */
function removeBackgroundLocal(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.width, H = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, W, H);
      const data = imageData.data;

      // 1) Muestrear colores del borde para encontrar el fondo dominante
      const borderSamples = [];
      const step = Math.max(1, Math.floor(Math.min(W, H) / 60));
      for (let x = 0; x < W; x += step) {
        borderSamples.push(getPixel(data, W, x, 0));
        borderSamples.push(getPixel(data, W, x, H - 1));
      }
      for (let y = 0; y < H; y += step) {
        borderSamples.push(getPixel(data, W, 0, y));
        borderSamples.push(getPixel(data, W, W - 1, y));
      }
      // Color promedio del borde
      let rS = 0, gS = 0, bS = 0;
      borderSamples.forEach(([r,g,b]) => { rS+=r; gS+=g; bS+=b; });
      const bg = [rS/borderSamples.length, gS/borderSamples.length, bS/borderSamples.length];

      // 2) Flood-fill desde las 4 esquinas
      const tolerance = 42;
      const visited = new Uint8Array(W * H);
      const queue = [];

      // Agregar píxeles de borde similares al fondo
      for (let x = 0; x < W; x++) {
        tryEnqueue(data, W, H, visited, queue, bg, tolerance, x, 0);
        tryEnqueue(data, W, H, visited, queue, bg, tolerance, x, H-1);
      }
      for (let y = 0; y < H; y++) {
        tryEnqueue(data, W, H, visited, queue, bg, tolerance, 0, y);
        tryEnqueue(data, W, H, visited, queue, bg, tolerance, W-1, y);
      }

      // BFS flood fill
      let idx = 0;
      while (idx < queue.length) {
        const [x, y] = queue[idx++];
        const pos = (y * W + x) * 4;
        data[pos + 3] = 0; // transparente
        // vecinos
        if (x > 0)   tryEnqueue(data, W, H, visited, queue, bg, tolerance, x-1, y);
        if (x < W-1) tryEnqueue(data, W, H, visited, queue, bg, tolerance, x+1, y);
        if (y > 0)   tryEnqueue(data, W, H, visited, queue, bg, tolerance, x, y-1);
        if (y < H-1) tryEnqueue(data, W, H, visited, queue, bg, tolerance, x, y+1);
      }

      // 3) Suavizar bordes (erosión leve del canal alpha)
      softEdges(data, W, H);

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = dataURL;
  });
}

function getPixel(data, W, x, y) {
  const i = (y * W + x) * 4;
  return [data[i], data[i+1], data[i+2]];
}

function colorDist(r1,g1,b1, r2,g2,b2) {
  return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
}

function tryEnqueue(data, W, H, visited, queue, bg, tol, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const idx = y * W + x;
  if (visited[idx]) return;
  const i = idx * 4;
  if (data[i+3] === 0) { visited[idx] = 1; return; }
  if (colorDist(data[i], data[i+1], data[i+2], bg[0], bg[1], bg[2]) <= tol) {
    visited[idx] = 1;
    queue.push([x, y]);
  }
}

function softEdges(data, W, H) {
  // Reduce alpha de píxeles en el borde de la máscara para suavizar
  for (let y = 1; y < H-1; y++) {
    for (let x = 1; x < W-1; x++) {
      const i = (y * W + x) * 4;
      if (data[i+3] > 0) {
        const neighbors = [
          data[((y-1)*W+x)*4+3],
          data[((y+1)*W+x)*4+3],
          data[(y*W+x-1)*4+3],
          data[(y*W+x+1)*4+3]
        ];
        const transparentNeighbors = neighbors.filter(a => a === 0).length;
        if (transparentNeighbors >= 2) {
          data[i+3] = Math.floor(data[i+3] * 0.5);
        }
      }
    }
  }
}