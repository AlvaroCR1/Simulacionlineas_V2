// ─── scene/controls.js ───────────────────────────────────────────────────────
// v6: seta_M2_front va montada en un armario eléctrico con soporte

import { SEGMENTS, CTRL_DEFS } from "../config/segments.js";

const BELT_TOP = 0.22;

export function buildAllControls(THREE, scene) {
  const controlObjects = [];
  const initialCtrlStates = {};
  CTRL_DEFS.forEach((def) => {
    initialCtrlStates[def.id] = false;
  });

  const groups = {};
  const singles = [];
  CTRL_DEFS.forEach((def) => {
    if (def.groupId) {
      if (!groups[def.groupId]) groups[def.groupId] = [];
      groups[def.groupId].push(def);
    } else {
      singles.push(def);
    }
  });

  Object.values(groups).forEach((defs) =>
    buildSharedBox(THREE, scene, defs, controlObjects)
  );
  singles.forEach((def) => {
    if (def.id === "seta_M2_front") {
      buildArmarioElectrico(THREE, scene, def, controlObjects);
    } else {
      buildSingleBox(THREE, scene, def, controlObjects);
    }
  });

  return { controlObjects, initialCtrlStates };
}

// ─── Armario eléctrico para seta_M2_front ────────────────────────────────────
function buildArmarioElectrico(THREE, scene, def, controlObjects) {
  const seg = SEGMENTS.find((s) => s.id === def.segId);
  const segCM = SEGMENTS.find((s) => s.id === "CM");
  if (!seg || !segCM) return;

  // El armario termina donde empieza CM
  const cmStart = segCM.cx - segCM.w / 2; // inicio de CM en X
  const setaX = seg.cx + def.dx; // posición X de la seta
  const armW = cmStart - setaX + 0.2; // ancho del armario (desde seta hasta CM)
  const armH = 1.2; // altura del armario
  const armD = 0.25; // profundidad del armario
  const armCX = setaX + armW / 2 - 0.15; // centro X del armario
  const armY = armH / 2 + 0.0; // base apoyada en el suelo
  const armZ = seg.d / 2 - 0.6 / 2; // frontal, pegado a la línea

  const cG = new THREE.Group();
  cG.position.set(armCX, 0, armZ);

  // ── Cuerpo del armario ───────────────────────────────────────────────────
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6,
    roughness: 0.45,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, armD), bodyMat);
  body.position.y = armY;
  body.castShadow = true;
  cG.add(body);

  // Puerta delantera (ligeramente más clara)
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0xb0b8be,
    roughness: 0.4,
    metalness: 0.55,
  });
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(armW - 0.04, armH - 0.04, 0.025),
    doorMat
  );
  door.position.set(0, armY, armD / 2 + 0.01);
  cG.add(door);

  // Bisagra izquierda
  const hingeMat = new THREE.MeshStandardMaterial({
    color: 0x777788,
    roughness: 0.3,
    metalness: 0.8,
  });
  [-0.15, 0.15].forEach((hy) => {
    const hinge = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.06, 0.04),
      hingeMat
    );
    hinge.position.set(-armW / 2 + 0.03, armY + hy, armD / 2 + 0.02);
    cG.add(hinge);
  });

  // Maneta de cierre
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.12, 0.04),
    hingeMat
  );
  handle.position.set(armW / 2 - 0.06, armY, armD / 2 + 0.03);
  cG.add(handle);

  // Zócalo inferior
  const zocMat = new THREE.MeshStandardMaterial({
    color: 0x666672,
    roughness: 0.5,
    metalness: 0.7,
  });
  const zoc = new THREE.Mesh(
    new THREE.BoxGeometry(armW + 0.04, 0.08, armD + 0.04),
    zocMat
  );
  zoc.position.set(0, -1.25 + 0.04, 0);
  cG.add(zoc);

  // Ribete superior
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(armW + 0.04, 0.04, armD + 0.04),
    zocMat
  );
  top.position.set(0, armY + armH / 2 + 0.02, 0);
  cG.add(top);

  // Logo / placa identificativa
  const plcCanvas = document.createElement("canvas");
  plcCanvas.width = 256;
  plcCanvas.height = 64;
  const plcCtx = plcCanvas.getContext("2d");
  plcCtx.fillStyle = "#1a2a3a";
  plcCtx.fillRect(0, 0, 256, 64);
  plcCtx.fillStyle = "#88ccff";
  plcCtx.font = "bold 18px monospace";
  plcCtx.textAlign = "center";
  plcCtx.textBaseline = "middle";
  plcCtx.fillText("CUADRO ELÉCTRICO", 128, 22);
  plcCtx.fillStyle = "#44aa66";
  plcCtx.font = "13px monospace";
  plcCtx.fillText("BIZERBA 2", 128, 46);
  const placa = new THREE.Mesh(
    new THREE.PlaneGeometry(armW * 0.7, 0.12),
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(plcCanvas),
      roughness: 0.8,
    })
  );
  placa.position.set(0, armY + armH * 0.35, armD / 2 + 0.015);
  cG.add(placa);

  // ── Soporte (pata de apoyo) ──────────────────────────────────────────────
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x666677,
    roughness: 0.5,
    metalness: 0.7,
  });

  // Dos patas verticales
  [-armW / 2 + 0.08, armW / 2 - 0.08].forEach((px) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.25, 0.06),
      postMat
    );
    leg.position.set(px, -1.25 + 0.625, -armD / 2 + 0.03);
    cG.add(leg);
    // Pie antideslizante
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.04, 0.14),
      postMat
    );
    foot.position.set(px, -1.25 + 0.02, -armD / 2 + 0.03);
    cG.add(foot);
  });

  // Travesaño horizontal inferior
  const crossBar = new THREE.Mesh(
    new THREE.BoxGeometry(armW - 0.1, 0.05, 0.06),
    postMat
  );
  crossBar.position.set(0, -1.25 + 0.12, -armD / 2 + 0.03);
  cG.add(crossBar);

  // ── Seta de emergencia en el centro de la puerta ─────────────────────────
  const setaY = armY + armH * 0.15; // ligeramente por encima del centro

  // Anillo soporte rojo oscuro
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.02, 16),
    new THREE.MeshStandardMaterial({
      color: 0x7a1500,
      roughness: 0.3,
      metalness: 0.8,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, setaY, armD / 2 + 0.04);
  cG.add(ring);

  // Disco rojo
  const setaMat = new THREE.MeshStandardMaterial({
    color: 0xdd0000,
    roughness: 0.3,
    metalness: 0.1,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.028, 14),
    setaMat
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, setaY, armD / 2 + 0.057);
  disc.userData.ctrlId = def.id;
  cG.add(disc);

  // Etiqueta EM
  const lc = document.createElement("canvas");
  lc.width = 64;
  lc.height = 64;
  const ctx = lc.getContext("2d");
  ctx.fillStyle = "#cc0000";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EM", 32, 32);
  const lbl = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.08),
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(lc),
      transparent: true,
      depthWrite: false,
    })
  );
  lbl.position.set(0, setaY, armD / 2 + 0.075);
  cG.add(lbl);

  scene.add(cG);
  controlObjects.push({ ctrlId: def.id, mesh: disc, meshType: "seta" });
}

// ─── Caja compartida: seta izq + botonera der ────────────────────────────────
function buildSharedBox(THREE, scene, defs, controlObjects) {
  const setaDef = defs.find((d) => d.type === "seta");
  const btnDef = defs.find((d) => d.type === "botonera");
  if (!setaDef && !btnDef) return;

  const refDef = setaDef || btnDef;
  const seg = SEGMENTS.find((s) => s.id === refDef.segId);
  if (!seg) return;

  const boxW = 0.6,
    boxH = 0.28,
    boxD = 0.2;
  const cG = new THREE.Group();

  const px = seg.cx + refDef.dx;
  const py = BELT_TOP + boxD / 2;
  let pz = 0;
  if (refDef.side === "front") pz = seg.d / 2 - boxH / 2 - 0.02;
  else if (refDef.side === "back") pz = -(seg.d / 2 - boxH / 2 - 0.02);

  cG.position.set(px, py, pz);
  cG.rotation.x = -Math.PI / 2;
  if (refDef.side === "back") cG.rotation.z = Math.PI;

  addBoxBody(THREE, cG, boxW, boxH, boxD);

  if (setaDef) {
    const mesh = addSetaDisc(THREE, cG, -0.17, boxD, setaDef.id);
    controlObjects.push({ ctrlId: setaDef.id, mesh, meshType: "seta" });
  }
  if (btnDef) {
    const mesh = addBtnDisc(THREE, cG, 0.17, boxD, btnDef.id);
    controlObjects.push({ ctrlId: btnDef.id, mesh, meshType: "botonera" });
  }

  scene.add(cG);
}

// ─── Caja individual ──────────────────────────────────────────────────────────
function buildSingleBox(THREE, scene, def, controlObjects) {
  const seg = SEGMENTS.find((s) => s.id === def.segId);
  if (!seg) return;

  const boxW = 0.3,
    boxH = 0.28,
    boxD = 0.2;
  const cG = new THREE.Group();

  const px = seg.cx + def.dx;
  const py = BELT_TOP + boxD / 2;
  let pz = 0;
  if (def.side === "front") pz = seg.d / 2 - boxH / 2 - 0.02;
  else if (def.side === "back") pz = -(seg.d / 2 - boxH / 2 - 0.02);
  else if (def.side === "right") pz = def.dz || 0;
  if (def.dz && def.side === "front") pz += def.dz;

  cG.position.set(px, py, pz);
  cG.rotation.x = -Math.PI / 2;
  if (def.side === "back") cG.rotation.z = Math.PI;
  if (def.side === "right") cG.rotation.z = -Math.PI / 2;

  addBoxBody(THREE, cG, boxW, boxH, boxD);

  if (def.type === "seta") {
    const mesh = addSetaDisc(THREE, cG, 0, boxD, def.id);
    controlObjects.push({ ctrlId: def.id, mesh, meshType: "seta" });
  } else {
    const mesh = addBtnDisc(THREE, cG, 0, boxD, def.id);
    controlObjects.push({ ctrlId: def.id, mesh, meshType: "botonera" });
  }

  scene.add(cG);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addBoxBody(THREE, cG, boxW, boxH, boxD) {
  cG.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(boxW, boxH, boxD),
      new THREE.MeshStandardMaterial({
        color: 0x8a8e92,
        roughness: 0.55,
        metalness: 0.5,
      })
    )
  );
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(boxW - 0.02, boxH - 0.02, 0.02),
    new THREE.MeshStandardMaterial({
      color: 0x9a9ea2,
      roughness: 0.4,
      metalness: 0.6,
    })
  );
  lid.position.z = boxD / 2 + 0.01;
  cG.add(lid);
  const screwMat = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    roughness: 0.2,
    metalness: 0.9,
  });
  [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ].forEach(([cx, cy]) => {
    const s = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.015, 6),
      screwMat
    );
    s.rotation.x = Math.PI / 2;
    s.position.set(
      cx * (boxW / 2 - 0.04),
      cy * (boxH / 2 - 0.04),
      boxD / 2 + 0.015
    );
    cG.add(s);
  });
}

function addSetaDisc(THREE, cG, offsetX, boxD, ctrlId) {
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.02, 16),
    new THREE.MeshStandardMaterial({
      color: 0x7a1500,
      roughness: 0.3,
      metalness: 0.8,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(offsetX, 0, boxD / 2 + 0.04);
  cG.add(ring);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xdd0000,
    roughness: 0.3,
    metalness: 0.1,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.028, 14),
    mat
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(offsetX, 0, boxD / 2 + 0.057);
  disc.userData.ctrlId = ctrlId;
  cG.add(disc);
  addLabel(THREE, cG, "EM", "#cc0000", "#fff", offsetX, boxD / 2 + 0.075);
  return disc;
}

function addBtnDisc(THREE, cG, offsetX, boxD, ctrlId) {
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.02, 16),
    new THREE.MeshStandardMaterial({
      color: 0x444455,
      roughness: 0.3,
      metalness: 0.8,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(offsetX, 0, boxD / 2 + 0.04);
  cG.add(ring);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.5,
    metalness: 0.3,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.028, 14),
    mat
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(offsetX, 0, boxD / 2 + 0.057);
  disc.userData.ctrlId = ctrlId;
  cG.add(disc);
  addLabel(THREE, cG, "STOP", "#111", "#fff", offsetX, boxD / 2 + 0.075);
  return disc;
}

function addLabel(THREE, cG, text, bgColor, fgColor, offsetX, offsetZ) {
  const lc = document.createElement("canvas");
  lc.width = 64;
  lc.height = 64;
  const ctx = lc.getContext("2d");
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = fgColor;
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 32, 32);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.08),
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(lc),
      transparent: true,
      depthWrite: false,
    })
  );
  mesh.position.set(offsetX, 0, offsetZ);
  cG.add(mesh);
}
