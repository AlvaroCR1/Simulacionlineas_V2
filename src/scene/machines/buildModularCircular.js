// ─── scene/machines/buildModularCircular.js ───────────────────────────────────
// Construye el recorrido circular BAJO la cinta modular CM.
// Basado en el plano LMT-009: las tarrinas rechazadas en M2 bajan por un
// discriminador y circulan por un bucle inferior donde las operarias las cogen
// y ajustan el peso antes de que vuelvan al flujo hacia la Termoselladora.
//
// Geometría (en coordenadas de mundo, relativa al grupo CM en cx=-14.32):
//   CM.cx = -14.32, CM.w = 5.6
//   Nivel inferior: BELT_TOP - 0.65 (bajo la cinta modular)
//   El bucle ocupa todo el ancho de CM más los bordes
//   Forma: U abierta por la derecha (salida hacia Termoselladora)

import { BELT_TOP, GROUND_Y } from "../../config/constants.js";
import { makeModularBeltTex } from "../textures.js";

// Geometría exportada para animar tarrinas desde StrawberryLineTwin
export const CIRCULAR_GEOM = {
  levelY: BELT_TOP - 0.65, // altura del nivel circular
  entryX: -16.5, // X donde la tarrina baja (lado M2)
  exitX: -11.8, // X donde la tarrina vuelve a subir (lado Termo)
  loopZ: 0.9, // desplazamiento Z del bucle inferior
};

export function buildModularCircular(THREE, scene, CM_cx) {
  const group = new THREE.Group();
  // El grupo se coloca en el mismo espacio de mundo (no relativo a CM)
  group.position.set(0, 0, 0);

  const inox = new THREE.MeshStandardMaterial({
    color: 0xa0b0b8,
    roughness: 0.3,
    metalness: 0.65,
  });
  const darkInox = new THREE.MeshStandardMaterial({
    color: 0x485058,
    roughness: 0.5,
    metalness: 0.6,
  });
  const rollerMat = new THREE.MeshStandardMaterial({
    color: 0x889aaa,
    roughness: 0.3,
    metalness: 0.8,
  });

  const lvl = CIRCULAR_GEOM.levelY;
  const loopW = Math.abs(CIRCULAR_GEOM.exitX - CIRCULAR_GEOM.entryX); // 4.7u
  const cx = (CIRCULAR_GEOM.entryX + CIRCULAR_GEOM.exitX) / 2; // centro X

  // ── Cinta inferior larga (recorrido circular en X) ────────────────────────
  const bt = makeModularBeltTex(THREE);
  bt.repeat.set(8, 1);

  // Tramo inferior frontal (z positivo = lado operarias)
  const beltLow = new THREE.Mesh(
    new THREE.BoxGeometry(loopW, 0.04, 0.55),
    new THREE.MeshStandardMaterial({
      map: bt,
      color: 0x9aaabb,
      roughness: 0.65,
      metalness: 0.22,
    })
  );
  beltLow.position.set(cx, lvl, 0.3);
  group.add(beltLow);

  // Tramo inferior trasero (z negativo)
  const beltLowBack = new THREE.Mesh(
    new THREE.BoxGeometry(loopW, 0.04, 0.55),
    new THREE.MeshStandardMaterial({
      map: bt,
      color: 0x9aaabb,
      roughness: 0.65,
      metalness: 0.22,
    })
  );
  beltLowBack.position.set(cx, lvl, -0.3);
  group.add(beltLowBack);

  // ── Rodillos de retorno en los extremos ───────────────────────────────────
  [CIRCULAR_GEOM.entryX, CIRCULAR_GEOM.exitX].forEach((rx) => {
    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.2, 14),
      rollerMat
    );
    roller.rotation.z = Math.PI / 2;
    roller.position.set(rx, lvl, 0);
    roller.castShadow = true;
    group.add(roller);
  });

  // ── Perfiles laterales de soporte ────────────────────────────────────────
  [-0.58, 0.58].forEach((dz) => {
    // Rail longitudinal
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(loopW + 0.2, 0.06, 0.04),
      darkInox
    );
    rail.position.set(cx, lvl + 0.05, dz);
    group.add(rail);
  });

  // ── Patas de soporte ──────────────────────────────────────────────────────
  const legH = Math.abs(GROUND_Y - lvl);
  [-2.0, -0.5, 1.0, 2.5].forEach((dx) => {
    [-0.55, 0.55].forEach((dz) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, legH, 8),
        inox
      );
      leg.position.set(cx + dx, GROUND_Y + legH / 2, dz);
      leg.castShadow = true;
      group.add(leg);
    });
  });

  // ── Guía de bajada desde M2 (rampa lateral) ───────────────────────────────
  // Conecta visualmente el nivel BELT_TOP con el nivel circular
  const rampH = BELT_TOP - lvl;
  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, rampH, 0.55),
    new THREE.MeshStandardMaterial({
      color: 0x778899,
      roughness: 0.4,
      metalness: 0.6,
      transparent: true,
      opacity: 0.8,
    })
  );
  ramp.position.set(CIRCULAR_GEOM.entryX - 0.3, lvl + rampH / 2, 0);
  ramp.rotation.z = Math.PI / 12; // ligeramente inclinada
  group.add(ramp);

  // ── Guía de subida hacia Termoselladora ──────────────────────────────────
  const rampUp = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, rampH, 0.55),
    new THREE.MeshStandardMaterial({
      color: 0x778899,
      roughness: 0.4,
      metalness: 0.6,
      transparent: true,
      opacity: 0.8,
    })
  );
  rampUp.position.set(CIRCULAR_GEOM.exitX + 0.3, lvl + rampH / 2, 0);
  rampUp.rotation.z = -Math.PI / 12;
  group.add(rampUp);

  // ── Señales visuales de operarias (siluetas simplificadas) ───────────────
  const operCanvas = document.createElement("canvas");
  operCanvas.width = 128;
  operCanvas.height = 128;
  const oc = operCanvas.getContext("2d");
  oc.fillStyle = "#0a1428";
  oc.fillRect(0, 0, 128, 128);
  // Silueta operaria
  oc.fillStyle = "#4488cc";
  oc.beginPath();
  oc.arc(64, 28, 18, 0, Math.PI * 2);
  oc.fill(); // cabeza
  oc.fillRect(46, 46, 36, 42); // cuerpo
  oc.fillStyle = "#2255aa";
  oc.fillRect(30, 48, 16, 36); // brazo izq
  oc.fillRect(82, 48, 16, 36); // brazo der
  oc.fillRect(50, 88, 14, 28); // pierna izq
  oc.fillRect(64, 88, 14, 28); // pierna der
  const operTex = new THREE.CanvasTexture(operCanvas);

  // 3 operarias a lo largo del módulo circular
  [-1.5, 0, 1.5].forEach((dx) => {
    const oper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.56),
      new THREE.MeshStandardMaterial({
        map: operTex,
        transparent: true,
        opacity: 0.9,
        alphaTest: 0.1,
        depthWrite: false,
      })
    );
    oper.position.set(cx + dx, lvl + 0.55, 0.72);
    group.add(oper);

    // Billboard: hacer que la operaria siempre mire a cámara
    // (simplificado: solo una cara visible)
  });

  // ── Letrero "MÓDULO CIRCULAR" ──────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a3a60";
  ctx.fillRect(0, 0, 384, 64);
  ctx.fillStyle = "#78b8e8";
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("LMT-009 · MÓDULO CIRCULAR", 192, 32);
  const labelTex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.3),
    new THREE.MeshStandardMaterial({
      map: labelTex,
      emissive: 0x001133,
      emissiveIntensity: 0.5,
    })
  );
  label.position.set(cx, lvl + 0.8, 0.72);
  group.add(label);

  scene.add(group);
  return group;
}
