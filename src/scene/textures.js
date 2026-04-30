// ─── scene/textures.js ───────────────────────────────────────────────────────
// Funciones puras de generación de texturas mediante Canvas 2D.
// Todas reciben THREE como primer argumento para evitar dependencia del global.

/**
 * Textura de cinta transportadora (rayas verticales sobre fondo oscuro).
 * Tiene wrapS/wrapT repetitivos para que fluya con offset.x en el loop.
 */
export function makeBeltTex(THREE) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#484e53";
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = "rgba(80,90,100,0.6)";
  ctx.lineWidth = 3;
  for (let x = 0; x < 256; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 64);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

/**
 * Textura de cinta modular (rollos más claros, aspecto plástico).
 */
export function makeModularBeltTex(THREE) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#aab6c2";
  ctx.fillRect(0, 0, 512, 64);
  ctx.strokeStyle = "rgba(80,110,150,0.35)";
  ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 64);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  return t;
}

/**
 * Textura de suelo (grid azulado oscuro).
 */
export function makeGroundTex(THREE) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#181e2a";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(50,90,160,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 5);
  return t;
}

/**
 * Compone una textura a partir de una imagen real cargada.
 * Si overlayFn se proporciona, se llama después de dibujar la imagen.
 * @param {THREE} THREE
 * @param {HTMLImageElement|null} imgEl
 * @param {Function|null} overlayFn  - (ctx, canvas) => void
 */
export function makePhotoTex(THREE, imgEl, overlayFn) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fiºlStyle = "#111820";
  ctx.fillRect(0, 0, 512, 512);
  if (imgEl) {
    const iw = imgEl.naturalWidth || imgEl.width;
    const ih = imgEl.naturalHeight || imgEl.height;
    const scale = Math.max(512 / iw, 512 / ih);
    ctx.drawImage(
      imgEl,
      (512 - iw * scale) / 2,
      (512 - ih * scale) / 2,
      iw * scale,
      ih * scale
    );
  }
  if (overlayFn) overlayFn(ctx, c);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

/**
 * Textura de fallback para cuando no hay imagen disponible.
 */
export function makeFallbackTex(THREE, hex, label) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = hex || "#5a6268";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label || "", 128, 128);
  return new THREE.CanvasTexture(c);
}
