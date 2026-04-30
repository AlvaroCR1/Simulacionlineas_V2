// ─── scene/machines/buildGLMI.js ─────────────────────────────────────────────
// GLMI LPE-005 — Etiquetadora peso-precio
// Añadido v4.0: trampilla animable para rechazos definitivos
// La trampilla se abre (rota -90° en X) cuando llega onReachM4 con tipo=reject
// Referencia de uso: group.userData.openTrapDoor() / closeTrapDoor()

import { BELT_TOP, GROUND_Y } from "../../config/constants.js";
import { makeBeltTex } from "../textures.js";

// Exportamos la geometría de la trampilla para que StrawberryLineTwin
// pueda usarla en el callback onReachM4
export const TRAPDOOR_GEOM = {
  // Posición relativa al grupo del segmento M4
  localX: 1.8, // borde de salida del GLMI
  localY: BELT_TOP, // nivel de la cinta
  localZ: 0.1,
  width: 0.42,
  depth: 0.5,
  // Duración de la animación (ms)
  openMs: 400,
  closeMs: 600,
};

export function buildGLMI(THREE, group, seg, imgEl, texOffsets) {
  // ── Cinta — siempre se construye ───────────────────────────────────────────
  const bt = makeBeltTex(THREE);
  texOffsets[seg.id] = bt;
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w + 2.2, 0.04, seg.d * 0.5),
    new THREE.MeshStandardMaterial({ map: bt, color: 0xf0ece4, roughness: 0.9 })
  );
  belt.position.y = BELT_TOP - 0.02;
  belt.position.x = BELT_TOP - 0.1;
  group.add(belt);

  // ── Display contador ───────────────────────────────────────────────────────
  const displayCanvas = document.createElement("canvas");
  displayCanvas.width = 512;
  displayCanvas.height = 256;
  const dctx = displayCanvas.getContext("2d");

  function drawDisplay(dctx, tpm, total) {
    dctx.fillStyle = "#0a1a0a";
    dctx.fillRect(0, 0, 512, 256);
    dctx.fillStyle = "#00ff44";
    dctx.textAlign = "center";
    dctx.font = "bold 36px monospace";
    dctx.fillText("TARRINAS/MIN", 256, 55);
    dctx.font = "bold 110px monospace";
    dctx.fillText(String(tpm), 256, 165);
    dctx.fillStyle = "#00aa33";
    dctx.font = "28px monospace";
    dctx.fillText("TOTAL: " + total, 256, 230);
  }
  drawDisplay(dctx, 0, 0);

  const displayTex = new THREE.CanvasTexture(displayCanvas);
  const displayBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.4,
      metalness: 0.6,
    })
  );
  displayBox.position.set(0, 1.0, seg.d / 2 - 1.2);
  group.add(displayBox);

  const displayScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.5),
    new THREE.MeshStandardMaterial({
      map: displayTex,
      emissive: 0x002200,
      emissiveIntensity: 0.8,
    })
  );
  displayScreen.position.set(0, 1.0, seg.d / 2 - 1.15);
  group.add(displayScreen);

  // ── Sensor invisible al final de la cinta ─────────────────────────────────
  const sensorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.3, seg.d * 0.6),
    new THREE.MeshStandardMaterial({ visible: false })
  );
  sensorMesh.position.set(seg.w / 2 + 0.8, BELT_TOP, 0);
  sensorMesh.userData.isGLMISensor = true;
  group.add(sensorMesh);

  // ── TRAMPILLA ──────────────────────────────────────────────────────────────
  // Estructura: un grupo pivotado en el borde posterior de la trampilla
  // Al abrirse rota -90° en X → la tarrina cae hacia abajo
  const trapGroup = new THREE.Group();
  trapGroup.position.set(
    TRAPDOOR_GEOM.localX,
    TRAPDOOR_GEOM.localY,
    TRAPDOOR_GEOM.localZ
  );

  // Plano de la trampilla (en reposo = horizontal, abierta = vertical hacia abajo)
  const trapMat = new THREE.MeshStandardMaterial({
    color: 0x778899,
    roughness: 0.4,
    metalness: 0.7,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const trapDoor = new THREE.Mesh(
    new THREE.BoxGeometry(TRAPDOOR_GEOM.width, 0.025, TRAPDOOR_GEOM.depth),
    trapMat
  );
  // Pivote en el borde trasero: desplazar la geometría para que rote desde ese borde
  trapDoor.position.set(0, 0, -TRAPDOOR_GEOM.depth / 2);
  trapGroup.add(trapDoor);

  // Bisagras decorativas
  const hingeMat = new THREE.MeshStandardMaterial({
    color: 0x445566,
    roughness: 0.3,
    metalness: 0.8,
  });
  [-0.12, 0.12].forEach((dz) => {
    const hinge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8),
      hingeMat
    );
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0, 0.01, dz);
    trapGroup.add(hinge);
  });

  // Marco de la trampilla (fijo, no rota)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x334455,
    roughness: 0.5,
    metalness: 0.7,
  });
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(
      TRAPDOOR_GEOM.width + 0.06,
      0.03,
      TRAPDOOR_GEOM.depth + 0.06
    ),
    frameMat
  );
  frame.position.set(
    TRAPDOOR_GEOM.localX,
    TRAPDOOR_GEOM.localY - 0.015,
    TRAPDOOR_GEOM.localZ
  );
  group.add(frame);

  // Hueco bajo la trampilla (cilindro gris oscuro = pozo de caída)
  const chuteMat = new THREE.MeshStandardMaterial({
    color: 0x1a2028,
    roughness: 0.8,
    metalness: 0.2,
    transparent: true,
    opacity: 0.7,
    side: THREE.BackSide,
  });
  const chuteH = BELT_TOP - GROUND_Y;
  const chute = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.18, chuteH, 8, 1, true),
    chuteMat
  );
  chute.position.set(
    TRAPDOOR_GEOM.localX,
    BELT_TOP - chuteH / 2,
    TRAPDOOR_GEOM.localZ
  );
  group.add(chute);

  // Letrero "RECHAZO" sobre la trampilla
  const rejCanvas = document.createElement("canvas");
  rejCanvas.width = 256;
  rejCanvas.height = 64;
  const rctx = rejCanvas.getContext("2d");
  rctx.fillStyle = "#3a0a0a";
  rctx.fillRect(0, 0, 256, 64);
  rctx.fillStyle = "#ff4444";
  rctx.font = "bold 22px monospace";
  rctx.textAlign = "center";
  rctx.textBaseline = "middle";
  rctx.fillText("⚠ RECHAZO", 128, 32);
  const rejTex = new THREE.CanvasTexture(rejCanvas);
  const rejLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.12),
    new THREE.MeshStandardMaterial({
      map: rejTex,
      emissive: 0x220000,
      emissiveIntensity: 0.6,
    })
  );
  rejLabel.position.set(
    TRAPDOOR_GEOM.localX,
    BELT_TOP + 0.15,
    TRAPDOOR_GEOM.localZ - 0.3
  );
  rejLabel.rotation.x = -Math.PI / 6;
  group.add(rejLabel);

  group.add(trapGroup);

  // ── API de animación de la trampilla ───────────────────────────────────────
  let trapState = "closed"; // "closed" | "opening" | "open" | "closing"
  let trapProgress = 0; // 0=cerrada, 1=abierta
  let trapTimer = null;

  function openTrapDoor() {
    if (trapState === "open" || trapState === "opening") return;
    trapState = "opening";
    const startT = performance.now();
    const duration = TRAPDOOR_GEOM.openMs;

    function animOpen(now) {
      trapProgress = Math.min((now - startT) / duration, 1);
      // Rota desde 0 a -PI/2 (se abre hacia abajo)
      trapGroup.rotation.x = (-Math.PI / 2) * trapProgress;
      if (trapProgress < 1) {
        trapTimer = requestAnimationFrame(animOpen);
      } else {
        trapState = "open";
        // Cerrar automáticamente tras 1.5s (tiempo suficiente para ver la caída)
        setTimeout(() => closeTrapDoor(), 1500);
      }
    }
    if (trapTimer) cancelAnimationFrame(trapTimer);
    trapTimer = requestAnimationFrame(animOpen);
  }

  function closeTrapDoor() {
    if (trapState === "closed" || trapState === "closing") return;
    trapState = "closing";
    const startProgress = trapProgress;
    const startT = performance.now();
    const duration = TRAPDOOR_GEOM.closeMs;

    function animClose(now) {
      const t = Math.min((now - startT) / duration, 1);
      trapProgress = startProgress * (1 - t);
      trapGroup.rotation.x = (-Math.PI / 2) * trapProgress;
      if (t < 1) {
        trapTimer = requestAnimationFrame(animClose);
      } else {
        trapState = "closed";
        trapProgress = 0;
      }
    }
    if (trapTimer) cancelAnimationFrame(trapTimer);
    trapTimer = requestAnimationFrame(animClose);
  }

  // Exportar en userData para que StrawberryLineTwin llame openTrapDoor()
  group.userData.glmiDisplay = {
    canvas: displayCanvas,
    texture: displayTex,
    drawDisplay,
  };
  group.userData.glmiSensorX = seg.w / 2 + 0.8;
  group.userData.openTrapDoor = openTrapDoor;
  group.userData.closeTrapDoor = closeTrapDoor;

  // ── Modelo GLB ─────────────────────────────────────────────────────────────
  if (!window.THREE || !window.THREE.GLTFLoader) {
    console.warn("GLTFLoader no disponible — usando fallback GLMI");
    buildFallback(THREE, group, seg);
    return;
  }

  const loader = new window.THREE.GLTFLoader();
  loader.load(
    "/GLMI.glb",
    (gltf) => {
      const model = gltf.scene;
      const wrapper = new THREE.Group();
      wrapper.add(model);
      model.rotation.y = 0;
      wrapper.updateMatrixWorld(true);
      model.updateMatrixWorld(true);

      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity,
        maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;
      model.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.geometry.computeBoundingBox();
          const b = child.geometry.boundingBox
            .clone()
            .applyMatrix4(child.matrixWorld);
          minX = Math.min(minX, b.min.x);
          maxX = Math.max(maxX, b.max.x);
          minY = Math.min(minY, b.min.y);
          maxY = Math.max(maxY, b.max.y);
          minZ = Math.min(minZ, b.min.z);
          maxZ = Math.max(maxZ, b.max.z);
        }
      });

      const sizeX = maxX - minX,
        sizeY = maxY - minY,
        sizeZ = maxZ - minZ;
      const centerX = (minX + maxX) / 2,
        centerZ = (minZ + maxZ) / 2;

      if (!sizeX || !sizeY || !sizeZ || !isFinite(sizeX)) {
        buildFallback(THREE, group, seg);
        return;
      }

      const scale =
        Math.min(
          (seg.w * 0.9) / sizeX,
          (seg.h * 0.9) / sizeY,
          (seg.d * 0.9) / sizeZ
        ) * 3.0;
      wrapper.scale.setScalar(scale);
      wrapper.position.set(
        -centerX * scale,
        -minY * scale - 1.25,
        -centerZ * scale - 0.6
      );

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) child.material.needsUpdate = true;
        }
      });
      group.add(wrapper);
    },
    null,
    () => buildFallback(THREE, group, seg)
  );
}

function buildFallback(THREE, group, seg) {
  const inox = new THREE.MeshStandardMaterial({
    color: 0xb8c4ca,
    roughness: 0.28,
    metalness: 0.72,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(seg.w, seg.h, seg.d), inox);
  body.position.y = seg.h / 2 - 1.25;
  body.castShadow = true;
  group.add(body);
  const rib = new THREE.Mesh(
    new THREE.BoxGeometry(seg.w + 0.04, 0.05, seg.d + 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x2a2e32,
      roughness: 0.4,
      metalness: 0.7,
    })
  );
  rib.position.y = seg.h - 1.25 + 0.025;
  group.add(rib);
}
