// StrawberryLineTwin.jsx  v4.2
// Arquitectura de callbacks:
//   useEffect([engine]) asigna onSpawn/onReachM2/onReachM4/onTick directamente.
//   onSpawn usa window.THREE y stRef.current.scene via lazy getter.
//   El animate loop NO toca callbacks -- solo mueve meshes y renderiza.

import { useEffect, useRef, useState } from "react";
import { IMG } from "./config/images.js";
import { SEGMENTS, CTRL_DEFS } from "./config/segments.js";
import {
  BELT_TOP,
  GROUND_Y,
  TRAY_SPEED,
  DEFAULT_TRAY_INTERVAL,
  BG_COLOR,
} from "./config/constants.js";
import { computePaused } from "./simulation/pauseLogic.js";
import { buildBizerba } from "./scene/machines/buildBizerba.js";
import { buildTermoselladora } from "./scene/machines/buildTermoselladora.js";
import { buildGLMI } from "./scene/machines/buildGLMI.js";
import { buildEtiquetadora } from "./scene/machines/buildEtiquetadora.js";
import { buildDetector } from "./scene/machines/buildDetector.js";
import { buildAllControls } from "./scene/controls.js";
import {
  makeBeltTex,
  makeModularBeltTex,
  makePhotoTex,
} from "./scene/textures.js";
import { buildModularCircular } from "./scene/machines/buildModularCircular.js";
import ChatBot from "./ui/ChatBot";

// ─── Geometría de la línea ────────────────────────────────────────────────────
const SEG_CX = {
  M1: -25.8,
  M2: -19.23,
  CM: -14.32,
  M3: -7.0,
  M4: -0.4,
  M5: 4.5,
};
const SEG_W = { M1: 2.0, M2: 2.0, M4: 1.6 };

// Velocidades visuales fijas — desacopladas del engineSpeed
// La sincronización temporal real la hacen los callbacks onReachM2/onReachM4
const V_M1M2 = 1.5;  // u/s visual M1→M2
const V_M2M4 = 0.8;  // u/s visual M2→M4
const V_POST = 1.5;  // u/s visual tras GLMI

// Colores por tipo de pesada
const COL = {
  ok: 0x00cc66,
  reject: 0xee2211,
  sensor: 0xff8800,
  system: 0x4488ff,
  glmi_rej: 0xff2200,
};

function trayCol(tipo) {
  return COL[tipo] || COL.system;
}

function buildMachine(THREE, group, seg, imgEl, texOffsets) {
  if (seg.id === "M1" || seg.id === "M2")
    buildBizerba(THREE, group, seg, imgEl, texOffsets);
  else if (seg.id === "M3")
    buildTermoselladora(THREE, group, seg, imgEl, texOffsets);
  else if (seg.id === "M4") buildGLMI(THREE, group, seg, imgEl, texOffsets);
  else if (seg.id === "M5")
    buildEtiquetadora(THREE, group, seg, imgEl, texOffsets);
  else if (seg.id === "M6") buildDetector(THREE, group, seg, imgEl, texOffsets);
}

function makeInitialState() {
  return {
    glmiCount: 0,
    glmiSensorGroup: null,
    glmiCountTimestamps: [],
    glmiGroup: null,
    running: false,
    trays: [],
    trayMap: {},
    ctrlStates: {},
    pausedSegments: new Set(),
    elapsed: 0,
    lastTime: null,
    trayIdCounter: 0,
    textureOffsets: {},
    balizaObjects: [],
    controlObjects: [],
    loadedTextures: {},
    renderer: null,
    scene: null,
    camera: null,
    raycaster: null,
    mouse: null,
    _engineSpeed: 10,
    orbit: {
      theta: 0.05,
      phi: 1.05,
      radius: 22,
      targetX: -18,
      targetY: 0.5,
      targetZ: 0,
      isDragging: false,
      isRightDragging: false,
      lastX: 0,
      lastY: 0,
      dragStartX: 0,
      dragStartY: 0,
      moved: false,
    },
    _cleanup: null,
  };
}

// ─── buildTrayMesh — a nivel módulo para acceso desde cualquier closure ───────
function buildTrayMesh(THREE, color, withStrawberries = true) {
  const g = new THREE.Group();
  g.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.13, 0.27),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
      })
    )
  );
  const rec = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.06, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.8 })
  );
  rec.position.y = -0.025;
  g.add(rec);
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.015, 0.29),
    new THREE.MeshStandardMaterial({
      color: 0x8899aa,
      roughness: 0.3,
      metalness: 0.6,
    })
  );
  lip.position.y = 0.07;
  g.add(lip);
  if (withStrawberries) {
    [
      [0, -1], [0, 0], [0, 1],
      [1, -1], [1, 0], [1, 1],
    ].forEach(([px, pz]) => {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xcc1122, roughness: 0.6 })
      );
      s.position.set((px - 0.5) * 0.13, 0.075, pz * 0.085);
      g.add(s);
    });
  }
  const film = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.27),
    new THREE.MeshStandardMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.14,
      roughness: 0.05,
    })
  );
  film.rotation.x = -Math.PI / 2;
  film.position.y = 0.13;
  g.add(film);
  return g;
}

// ─── _doSpawn — spawna una tarrina en M1 ─────────────────────────────────────
// THREE y st se pasan explícitamente para evitar dependencias de closure
function _doSpawn(THREE, st, tray) {
  console.log("doSpawn scene:", !!st.scene, "tray:", tray.id);
  const isRej = tray.tipo_M1 === "reject" || tray.tipo_M1 === "sensor";
  const color = trayCol(tray.tipo_M1);
  const mesh = buildTrayMesh(THREE, color, !isRej);

  const startX = SEG_CX.M1 - SEG_W.M1 / 2 + 0.1;
  mesh.position.set(startX, BELT_TOP + 0.065, 0);
  mesh.scale.set(0.95, 0.95, 0.95);
  mesh.userData.trayId = tray.id;
  st.scene.add(mesh);

  const obj = {
    id: tray.id,
    tray,
    mesh,
    phase: "M1M2",
    speedX: V_M1M2,
    speedY: 0,
    destX: SEG_CX.M2 + 1.5,
    segId: "M1",
    isDeviated: isRej,
    targetZ: isRej ? -1.1 : 0,
    targetY: BELT_TOP + 0.065,
    isFalling: false,
    glmiCounted: false,
  };
  st.trays.push(obj);
  st.trayMap[tray.id] = obj;
}


export default function StrawberryLineTwin({ engine }) {
  const mountRef = useRef(null);
  const stRef = useRef(makeInitialState());
  const engineRef = useRef(null); // ← REF CLAVE: accesible desde el closure de Three.js
  const rafRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accordion, setAccordion] = useState({
    estado: true,
    controles: false,
    nav: false,
  });
  const [ui, setUi] = useState({
    running: false,
    ctrlStates: {},
    pausedSegments: new Set(),
    segmentStatuses: {},
    engineLoaded: false,
  });

  // Conectar engine: todos los callbacks se asignan aqui, no en el loop.
  // onSpawn usa window.THREE y stRef.current.scene via lazy getter —
  // ambos estan garantizados cuando el usuario pulsa Play.
  useEffect(() => {
    const st = stRef.current;

    if (!engine) {
      engineRef.current = null;
      setUi((p) => ({ ...p, engineLoaded: false, running: false }));
      st.running = false;
      return;
    }

    engineRef.current = engine;
    setUi((p) => ({ ...p, engineLoaded: true }));

    const initState = engine.state;
    if (initState) {
      st.running = initState.playing;
      st._engineSpeed = initState.speed || 10;
    }

    engine.onTick = (state) => {
      st._engineSpeed = state.speed || 10;
      if (state.playing !== st.running) {
        st.running = state.playing;
        if (!state.playing) st.lastTime = null;
        setUi((p) => ({ ...p, running: state.playing }));
      }
    };

    engine.onSpawn = (tray) => {
  const THREE = window.THREE;
  const scene = stRef.current.scene;
  console.log("onSpawn guard:", !!THREE, !!scene);
  if (!THREE || !scene) return;
  _doSpawn(THREE, stRef.current, tray);
};

    engine.onReachM2 = (tray) => {
      const obj = st.trayMap[tray.id];
      if (!obj) return;
      if (tray.tipo_M2 && tray.tipo_M2 !== "system") {
        const body = obj.mesh.children[0];
        if (body?.material) {
          body.material.color.setHex(trayCol(tray.tipo_M2));
          body.material.needsUpdate = true;
        }
      }
      obj.phase = "M2M4";
      obj.speedX = V_M2M4;
      obj.destX = SEG_CX.M4 + 0.8;
      obj.segId = "M2";
      obj.targetZ = 0;
      obj.targetY =
        tray.tipo_M2 === "reject" || tray.tipo_M2 === "sensor"
          ? BELT_TOP + 0.065 - 0.6
          : BELT_TOP + 0.065;
    };

    engine.onReachM4 = (tray) => {
      const obj = st.trayMap[tray.id];
      if (!obj) return;
      const isGlmiRej = tray.tipo_M4 === "reject" || tray.tipo_M4 === "sensor";
      if (isGlmiRej) {
        const body = obj.mesh.children[0];
        if (body?.material) {
          body.material.color.setHex(COL.glmi_rej);
          body.material.needsUpdate = true;
        }
        if (st.glmiGroup?.userData?.openTrapDoor) {
          st.glmiGroup.userData.openTrapDoor();
        }
        obj.phase = "falling";
        obj.isFalling = true;
        obj.speedX = 0;
        obj.speedY = -2.5;
      } else {
        if (tray.tipo_M4 && tray.tipo_M4 !== "system") {
          const body = obj.mesh.children[0];
          if (body?.material) {
            body.material.color.setHex(trayCol(tray.tipo_M4));
            body.material.needsUpdate = true;
          }
        }
        obj.targetY = BELT_TOP + 0.065;
        obj.phase = "M4out";
        obj.speedX = V_POST;
        obj.destX = SEG_CX.M5 + 5;
        obj.segId = "M4";
      }
    };

    engine.onStop = (stop) => {
      const dur = Math.min(stop.durationMs / (engine._speed || 10), 8000);
      st.balizaObjects.forEach((b) => {
        const affected =
          stop.isLineStop ||
          (stop.machines || []).some((m) => {
            const map = { bizerba1: "M1", bizerba2: "M2", glmi: "M4" };
            return map[m] === b.segId;
          });
        if (affected) b.dome.userData.stopUntil = Date.now() + dur;
      });
    };

    return () => {
      engine.onSpawn = null;
      engine.onReachM2 = null;
      engine.onReachM4 = null;
      engine.onStop = null;
      engine.onTick = null;
    };
  }, [engine]);

  // ── Limpieza de tarrinas al reiniciar ─────────────────────────────────────
  const handleReset = () => {
    const st = stRef.current;
    st.running = false;
    st.trays.forEach((t) => {
      if (st.scene) st.scene.remove(t.mesh);
    });
    st.trays = [];
    st.trayMap = {};
    st.elapsed = 0;
    st.lastTime = null;
    st.glmiCount = 0;
    st.glmiCountTimestamps = [];
    setUi((p) => ({ ...p, running: false }));
    if (engine) engine.seekTo(0);
  };

  // ── Three.js init — se ejecuta UNA SOLA VEZ ───────────────────────────────
  useEffect(() => {
    const st = stRef.current;
    const container = mountRef.current;
    if (!container) return;

    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
      s2.onload = () => initThree(st, container);
      s2.onerror = () => initThree(st, container);
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (st._cleanup) st._cleanup();
      if (st.renderer) {
        st.renderer.dispose();
        if (st.renderer.domElement.parentNode === container)
          container.removeChild(st.renderer.domElement);
      }
     if (s1.parentNode) document.head.removeChild(s1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initThree(st, container) {
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    st.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8e4de);
    scene.fog = new THREE.FogExp2(0xddd8d0, 0.01);
    st.scene = scene;

    const camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    st.camera = camera;
    updateCamera(THREE, st);
    st.raycaster = new THREE.Raycaster();
    st.mouse = new THREE.Vector2();

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xfff8f0, 0.9);
    sun.position.set(0, 20, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const f1 = new THREE.DirectionalLight(0xd8eeff, 0.4);
f1.position.set(-15, 8, 12);
scene.add(f1);
const f2 = new THREE.DirectionalLight(0xffe8d0, 0.3);
f2.position.set(15, 5, -10);
scene.add(f2);

    buildGround(THREE, scene, st);

    const keys = Object.keys(IMG);
    let pending = keys.length;
    if (!pending) {
      buildScene(THREE, scene, st);
    } else {
      keys.forEach((key) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          st.loadedTextures[key] = img;
          if (!--pending) buildScene(THREE, scene, st);
        };
        img.onerror = () => {
          if (!--pending) buildScene(THREE, scene, st);
        };
        img.src = IMG[key];
      });
    }

    // Controles de ratón
    const dom = renderer.domElement;
    function onMD(e) {
      const o = st.orbit;
      if (e.button === 0) {
        o.isDragging = true; o.moved = false;
        o.dragStartX = o.lastX = e.clientX;
        o.dragStartY = o.lastY = e.clientY;
      } else if (e.button === 2) {
        o.isRightDragging = true;
        o.lastX = e.clientX; o.lastY = e.clientY;
      }
    }
    function onMM(e) {
      const o = st.orbit;
      if (o.isDragging) {
        const dx = e.clientX - o.lastX, dy = e.clientY - o.lastY;
        if (Math.abs(e.clientX - o.dragStartX) > 3 || Math.abs(e.clientY - o.dragStartY) > 3)
          o.moved = true;
        o.theta -= dx * 0.008;
        o.phi = Math.max(0.1, Math.min(Math.PI * 0.46, o.phi - dy * 0.008));
        o.lastX = e.clientX; o.lastY = e.clientY;
        updateCamera(THREE, st);
      }
      if (o.isRightDragging) {
        const dx = e.clientX - o.lastX, dy = e.clientY - o.lastY;
        const cp = st.camera.position;
        const fx = cp.x - o.targetX, fy = cp.y - o.targetY, fz = cp.z - o.targetZ;
        const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
        const rx = (fy / fl) * 0 - (fz / fl) * 1, rz = (fx / fl) * 1 - (fy / fl) * 0;
        const rl = Math.sqrt(rx * rx + rz * rz), pan = o.radius * 0.0012;
        o.targetX = Math.max(-43, Math.min(37, o.targetX + (rx / rl) * dx * pan));
        o.targetZ = Math.max(-15, Math.min(15, o.targetZ + (rz / rl) * dx * pan));
        o.targetY = Math.max(0.5, Math.min(9, o.targetY + dy * pan));
        o.lastX = e.clientX; o.lastY = e.clientY;
        updateCamera(THREE, st);
      }
    }
    function onMU(e) {
      const o = st.orbit;
      if (e.button === 0) {
        if (!o.moved) handleClick(e, THREE, st);
        o.isDragging = false;
      }
      if (e.button === 2) o.isRightDragging = false;
    }
    function onW(e) {
      st.orbit.radius = Math.max(4, Math.min(55, st.orbit.radius * (1 + e.deltaY * 0.001)));
      updateCamera(THREE, st);
    }
    dom.addEventListener("mousedown", onMD);
    dom.addEventListener("mousemove", onMM);
    dom.addEventListener("mouseup", onMU);
    dom.addEventListener("wheel", onW);
    dom.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // ── ANIMATE LOOP ──────────────────────────────────────────────────────────
    function animate(time) {
      rafRef.current = requestAnimationFrame(animate);

      // Los callbacks estan asignados en useEffect. El loop solo lee engineRef.current.

      if (!st.lastTime) st.lastTime = time;
      const delta = Math.min((time - st.lastTime) / 1000, 0.05);
      st.lastTime = time;

      if (st.running) {
        st.elapsed += delta;

        // Animar texturas de cinta
        for (const sid in st.textureOffsets)
          if (!st.pausedSegments.has(sid))
            st.textureOffsets[sid].offset.x -= delta * 0.35;

        // Contador sensor GLMI
        if (st.glmiSensorGroup) {
          const gSeg = SEGMENTS.find((s) => s.id === "M4");
          const sx = gSeg ? gSeg.cx + gSeg.w / 2 + 0.8 : 0;
          st.trays.forEach((t) => {
            if (
              !t.glmiCounted &&
              t.mesh.position.x > sx &&
              t.mesh.position.x < sx + 0.3
            ) {
              t.glmiCounted = true;
              st.glmiCount++;
              const now = st.elapsed;
              st.glmiCountTimestamps.push(now);
              st.glmiCountTimestamps = st.glmiCountTimestamps.filter(
                (ts) => now - ts < 60
              );
              const disp = st.glmiSensorGroup.userData.glmiDisplay;
              if (disp) {
                const dc = disp.canvas.getContext("2d");
                disp.drawDisplay(dc, st.glmiCountTimestamps.length, st.glmiCount);
                disp.texture.needsUpdate = true;
              }
            }
          });
        }
      }

      // ── Mover tarrinas ────────────────────────────────────────────────────
      // NOTA: las tarrinas siempre se mueven si están en escena.
      // st.running solo controla si se spawnean nuevas y si las texturas avanzan.
      // Congelarlas con !st.running causaba que se acumulasen fuera de cámara
      // en velocidades altas (10x-60x) antes de que onTick actualizase running.
      const toRemove = [];
      st.trays.forEach((t) => {
        const pos = t.mesh.position;

        // Interpolación suave Z (desvío embudo M1)
        if (t.targetZ !== undefined && Math.abs(pos.z - t.targetZ) > 0.01)
          pos.z += (t.targetZ - pos.z) * Math.min(delta * 4, 1);

        // Interpolación suave Y (módulo circular / trampilla)
        if (t.targetY !== undefined && !t.isFalling && Math.abs(pos.y - t.targetY) > 0.005)
          pos.y += (t.targetY - pos.y) * Math.min(delta * 3, 1);

        if (t.isFalling) {
          pos.y += t.speedY * delta;
          if (pos.y < GROUND_Y - 1) { toRemove.push(t); return; }
        } else if (st.running) {
          pos.x += t.speedX * delta;
        }
        // Actualizar segId para el sistema de pausas
        const seg = SEGMENTS.find((s) => s.id === t.segId);
        if (seg && pos.x > seg.cx + seg.w / 2) {
          const idx = SEGMENTS.findIndex((s) => s.id === t.segId);
          if (idx < SEGMENTS.length - 1) t.segId = SEGMENTS[idx + 1].id;
        }

        // Eliminar cuando sale de escena
        if (!t.isFalling && t.phase === "M4out" && pos.x > t.destX) {
          toRemove.push(t); return;
        }
        if (!t.isFalling && pos.x > SEG_CX.M5 + 8) {
          toRemove.push(t); return;
        }
      });

      toRemove.forEach((t) => {
        if (st.scene) st.scene.remove(t.mesh);
        delete st.trayMap[t.id];
        st.trays = st.trays.filter((x) => x !== t);
      });

      // ── Balizas ───────────────────────────────────────────────────────────
      const nowMs = Date.now();
      st.balizaObjects.forEach((b) => {
        const isStop = b.dome.userData.stopUntil && nowMs < b.dome.userData.stopUntil;
        if (!st.running) {
          b.dome.material.color.setHex(0x222233);
          b.dome.material.emissive.setHex(0x000000);
          b.dome.material.emissiveIntensity = 0;
          b.dome.material.opacity = 0.92;
          if (b.light) { b.light.color.setHex(0x000000); b.light.intensity = 0; }
        } else if (st.pausedSegments.has(b.segId) || isStop) {
          b.dome.material.color.setHex(0xff0000);
          b.dome.material.emissive.setHex(0xff0000);
          b.dome.material.emissiveIntensity = 3.0;
          b.dome.material.opacity = 1.0;
          if (b.light) { b.light.color.setHex(0xff0000); b.light.intensity = 1.5; }
        } else {
          const p = 1.8 + 1.2 * Math.sin(st.elapsed * 6);
          b.dome.material.color.setHex(0x00ff00);
          b.dome.material.emissive.setHex(0x00ff00);
          b.dome.material.emissiveIntensity = p * 0.5;
          b.dome.material.opacity = 1.0;
          if (b.light) { b.light.color.setHex(0x39ff14); b.light.intensity = p * 0.8; }
        }
      });

      // ── Controles físicos ─────────────────────────────────────────────────
      st.controlObjects.forEach((c) => {
        const act = st.ctrlStates[c.ctrlId];
        c.mesh.material.emissive.setHex(
          act ? (c.meshType === "seta" ? 0xdd0000 : 0xff6600) : 0x000000
        );
        c.mesh.material.emissiveIntensity = act ? 1.2 : 0;
      });

      // ── Actualizar UI (estado segmentos) ──────────────────────────────────
      const statuses = {};
      SEGMENTS.forEach((s) => {
        statuses[s.id] = !st.running ? "stopped"
          : st.pausedSegments.has(s.id) ? "paused" : "running";
      });
      setUi((prev) => ({
        ...prev,
        segmentStatuses: statuses,
        running: st.running,
        pausedSegments: new Set(st.pausedSegments),
      }));

      renderer.render(scene, camera);
    }
    rafRef.current = requestAnimationFrame(animate);

    st._cleanup = () => {
      dom.removeEventListener("mousedown", onMD);
      dom.removeEventListener("mousemove", onMM);
      dom.removeEventListener("mouseup", onMU);
      dom.removeEventListener("wheel", onW);
    };
  }

  function updateCamera(THREE, st) {
    const o = st.orbit, c = st.camera;
    if (!c) return;
    c.position.set(
      o.targetX + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
      o.targetY + o.radius * Math.cos(o.phi),
      o.targetZ + o.radius * Math.sin(o.phi) * Math.cos(o.theta)
    );
    c.lookAt(o.targetX, o.targetY, o.targetZ);
  }

  function handleClick(e, THREE, st) {
    const rect = st.renderer.domElement.getBoundingClientRect();
    st.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    st.mouse.y = ((e.clientY - rect.top) / rect.height) * -2 + 1;
    st.raycaster.setFromCamera(st.mouse, st.camera);
    const hits = st.raycaster.intersectObjects(st.scene.children, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj) {
        if (obj.userData?.ctrlId) { toggleCtrl(obj.userData.ctrlId, st); return; }
        obj = obj.parent;
      }
    }
  }

  function toggleCtrl(id, st) {
    st.ctrlStates[id] = !st.ctrlStates[id];
    const paused = computePaused(st.ctrlStates);
    st.pausedSegments = paused;
    setUi((prev) => ({
      ...prev,
      ctrlStates: { ...st.ctrlStates },
      pausedSegments: new Set(paused),
    }));
  }

  // ── buildGround ────────────────────────────────────────────────────────────
  function buildGround(THREE, scene, st) {
    const fc = document.createElement("canvas");
    fc.width = 1024; fc.height = 1024;
    const ctx = fc.getContext("2d");
    ctx.fillStyle = "#1a4d7a";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * 1024, y = Math.random() * 1024,
        r = Math.random() * 12 + 2, gv = Math.floor(Math.random() * 15);
      ctx.fillStyle = `rgba(${180 + gv},${176 + gv},${168 + gv},0.06)`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(30,70,110,0.25)"; ctx.lineWidth = 2;
    [0, 256, 512, 768, 1024].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); });
    [0, 256, 512, 768, 1024].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); });
    const ft = new THREE.CanvasTexture(fc);
    ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
    ft.repeat.set(10, 4);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 28),
      new THREE.MeshStandardMaterial({ map: ft, roughness: 0.88, metalness: 0.02 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-3, GROUND_Y, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Paredes
    const wc = document.createElement("canvas");
    wc.width = 512; wc.height = 256;
    const wctx = wc.getContext("2d");
    wctx.fillStyle = "#f0ede8"; wctx.fillRect(0, 0, 512, 256);
    wctx.strokeStyle = "rgba(200,196,190,0.6)"; wctx.lineWidth = 1.5;
    for (let rw = 0; rw < 8; rw++) {
      const off = (rw % 2) * 64;
      for (let c = -1; c < 5; c++) wctx.strokeRect(c * 128 + off, rw * 32, 128, 32);
    }
    const wt = new THREE.CanvasTexture(wc);
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(8, 2);
    const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.85, metalness: 0.0 });
    const WH = 9, WY = GROUND_Y + WH / 2, NW = 80, ND = 28;
    [[0, -ND / 2], [Math.PI, ND / 2]].forEach(([ry, pz]) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(NW, WH), wm);
      w.rotation.y = ry; w.position.set(-3, WY, pz); w.receiveShadow = true; scene.add(w);
    });
    [[Math.PI / 2, -3 - NW / 2], [-Math.PI / 2, -3 + NW / 2]].forEach(([ry, px]) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(ND, WH), wm);
      w.rotation.y = ry; w.position.set(px, WY, 0); w.receiveShadow = true; scene.add(w);
    });

    // Techo con vigas I
    const rc = document.createElement("canvas");
    rc.width = 512; rc.height = 128;
    const rctx = rc.getContext("2d");
    rctx.fillStyle = "#9aa4aa"; rctx.fillRect(0, 0, 512, 128);
    rctx.strokeStyle = "rgba(70,80,88,0.4)"; rctx.lineWidth = 2;
    for (let x = 0; x < 512; x += 32) { rctx.beginPath(); rctx.moveTo(x, 0); rctx.lineTo(x, 128); rctx.stroke(); }
    const rft = new THREE.CanvasTexture(rc);
    rft.wrapS = rft.wrapT = THREE.RepeatWrapping; rft.repeat.set(16, 4);
    const roof = new THREE.Mesh(
      new THREE.PlaneGeometry(NW, ND),
      new THREE.MeshStandardMaterial({ map: rft, roughness: 0.6, metalness: 0.45, color: 0xaab4ba })
    );
    roof.rotation.x = Math.PI / 2; roof.position.set(-3, GROUND_Y + WH, 0); scene.add(roof);

    const bm = new THREE.MeshStandardMaterial({ color: 0x6a7278, roughness: 0.5, metalness: 0.7 });
    [-35, -19, -3, 13, 29].forEach((bx) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, ND), bm);
      b.position.set(bx - 3, GROUND_Y + WH - 0.2, 0); b.castShadow = true; scene.add(b);
      const tf = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, ND), bm);
      tf.position.set(bx - 3, GROUND_Y + WH - 0.02, 0); scene.add(tf);
      const bf = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, ND), bm);
      bf.position.set(bx - 3, GROUND_Y + WH - 0.4, 0); scene.add(bf);
    });
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(NW, 0.22, 0.22), bm);
    ridge.position.set(-3, GROUND_Y + WH - 0.11, 0); scene.add(ridge);

    // Luminarias
    const fbm = new THREE.MeshStandardMaterial({ color: 0xd0d8dc, roughness: 0.4, metalness: 0.6 });
    const pgm = new THREE.MeshStandardMaterial({
      color: 0xfff8e8, roughness: 1.0, metalness: 0.0,
      emissive: 0xfff0d0, emissiveIntensity: 0.8,
    });
    [-28, -12, 4, 20].forEach((lx) => {
      [-4, 4].forEach((lz) => {
        const fix = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.36), fbm);
        fix.position.set(lx - 3, GROUND_Y + WH - 0.52, lz); scene.add(fix);
        const pan = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.28), pgm);
        pan.position.set(lx - 3, GROUND_Y + WH - 0.58, lz); scene.add(pan);
        const pl = new THREE.PointLight(0xfff5e0, 1.1, 14);
        pl.position.set(lx - 3, GROUND_Y + WH - 0.65, lz); scene.add(pl);
      });
    });
  }

  // ── buildScene ─────────────────────────────────────────────────────────────
  function buildScene(THREE, scene, st) {
    SEGMENTS.forEach((seg) => {
      const g = new THREE.Group();
      g.position.set(seg.cx, 0, 0);
      scene.add(g);
      if (seg.type === "machine") {
        const imgEl = st.loadedTextures[seg.img] || null;
        buildMachine(THREE, g, seg, imgEl, st.textureOffsets);
        if (seg.id === "M4") { st.glmiSensorGroup = g; st.glmiGroup = g; }
      } else if (seg.type === "belt") buildBelt(THREE, g, seg, st);
      else if (seg.type === "modular") buildModular(THREE, g, seg, st);
      if (seg.showBaliza) buildBaliza(THREE, g, seg, st);
    });
    buildModularCircular(THREE, scene, -14.32);
    const { controlObjects, initialCtrlStates } = buildAllControls(THREE, scene);
    st.controlObjects = controlObjects;
    st.ctrlStates = initialCtrlStates;
    setUi((prev) => ({ ...prev, ctrlStates: { ...initialCtrlStates } }));
  }

  // ── buildBelt ──────────────────────────────────────────────────────────────
  function buildBelt(THREE, group, seg, st) {
    const cm = new THREE.MeshStandardMaterial({ color: 0x3a3e43, roughness: 0.6, metalness: 0.5 });
    const rm = new THREE.MeshStandardMaterial({ color: 0x889aaa, roughness: 0.3, metalness: 0.8 });
    [-1, 1].forEach((s) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.1, 0.04), cm);
      c.position.set(0, 0.11, s * (seg.d / 2 + 0.02)); group.add(c);
    });
    [-1, 1].forEach((s) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, seg.d, 14), rm);
      r.rotation.x = Math.PI / 2; r.position.set((s * seg.w) / 2, 0.09, 0); group.add(r);
    });
    const bt = makeBeltTex(window.THREE);
    st.textureOffsets[seg.id] = bt;
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(seg.w, 0.04, seg.d * 0.88),
      new THREE.MeshStandardMaterial({ map: bt, color: 0x484e53, roughness: 0.9, metalness: 0.05 })
    );
    belt.position.y = BELT_TOP - 0.02; group.add(belt);
  }

  // ── buildModular ───────────────────────────────────────────────────────────
  function buildModular(THREE, group, seg, st) {
    const lg = new THREE.MeshStandardMaterial({ color: 0xb0bcc4, roughness: 0.35, metalness: 0.55 });
    const dk = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.5, metalness: 0.3 });
    [-2.1, -0.5, 1.1].forEach((xo) => {
      [-0.44, 0.44].forEach((zo) => {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.98, 8), lg);
        l.position.set(xo, -0.72, zo); l.castShadow = true; group.add(l);
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.04, 8), lg);
        f.position.set(xo, -1.2, zo); group.add(f);
      });
    });
    const surf = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.07, seg.d), lg);
    surf.position.y = -0.26; surf.castShadow = true; group.add(surf);
    [-1, 1].forEach((s) => {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.08, 0.045),
        new THREE.MeshStandardMaterial({ color: 0x9aaabb, roughness: 0.5, metalness: 0.5 }));
      ch.position.set(0, 0.08, s * (seg.d / 2 + 0.022)); group.add(ch);
    });
    const bt = makeModularBeltTex(THREE);
    st.textureOffsets[seg.id] = bt;
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(seg.w, 0.04, seg.d * 0.8),
      new THREE.MeshStandardMaterial({ map: bt, color: 0xb0bcc4, roughness: 0.65, metalness: 0.22 })
    );
    belt.position.y = BELT_TOP - 0.02; group.add(belt);

    // Pantallas control
    [-2.0, -0.65, 0.7, 2.05].forEach((xo) => {
      const st2 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), lg);
      st2.position.set(xo, 0.44, 0); group.add(st2);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.12), lg);
      b2.position.set(xo, 0.3, 0); group.add(b2);
      const mB = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.065), dk);
      mB.position.set(xo, 0.62, 0); mB.castShadow = true; group.add(mB);
      const mc = document.createElement("canvas");
      mc.width = 128; mc.height = 96;
      const mctx = mc.getContext("2d");
      mctx.fillStyle = "#001428"; mctx.fillRect(0, 0, 128, 96);
      mctx.fillStyle = "#1a4a8a"; mctx.font = "bold 13px Arial";
      mctx.textAlign = "center"; mctx.textBaseline = "middle";
      mctx.fillText("Surexport", 64, 34);
      mctx.fillStyle = "#00ff88"; mctx.font = "9px monospace";
      mctx.fillText("CTRL", 64, 62);
      const mS = new THREE.Mesh(
        new THREE.PlaneGeometry(0.23, 0.17),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(mc), emissive: 0x001133, emissiveIntensity: 0.65 })
      );
      mS.position.set(xo, 0.62, 0.037); group.add(mS);
      const md = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10), lg);
      md.position.set(xo, 0.295, 0); group.add(md);
    });

    // Sillas operarias
    [-2.1, -1.05, 0, 1.05, 2.1].forEach((xo) => {
      [-0.72, 0.72].forEach((zo) => {
        const seat = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 0.042, 14),
          new THREE.MeshStandardMaterial({ color: 0x252836, roughness: 0.7, metalness: 0.1 })
        );
        seat.position.set(xo, -0.66, zo); group.add(seat);
        const back = new THREE.Mesh(
          new THREE.CylinderGeometry(0.165, 0.165, 0.042, 14),
          new THREE.MeshStandardMaterial({ color: 0x252836, roughness: 0.7, metalness: 0.1 })
        );
        back.position.set(xo, -0.38, zo > 0 ? zo + 0.14 : zo - 0.14);
        back.rotation.x = zo > 0 ? -Math.PI / 8 : Math.PI / 8; group.add(back);
        const ped = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.52, 8),
          new THREE.MeshStandardMaterial({ color: 0x889aaa, roughness: 0.3, metalness: 0.8 })
        );
        ped.position.set(xo, -0.93, zo); group.add(ped);
        const star = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 0.018, 5),
          new THREE.MeshStandardMaterial({ color: 0x889aaa, roughness: 0.3, metalness: 0.8 })
        );
        star.position.set(xo, -1.18, zo); group.add(star);
      });
    });
  }

  // ── buildBaliza ────────────────────────────────────────────────────────────
  function buildBaliza(THREE, group, seg, st) {
    const topY =
      seg.id === "M4" ? seg.h - 0.1 + 0.5
      : seg.id === "M5" ? seg.h - 1.25
      : seg.id === "M6" ? seg.h - 1.25 + 0.5
      : seg.type === "machine" ? seg.h - 1.25 + 0.5
      : BELT_TOP + 0.1;
    const bG = new THREE.Group();
    bG.position.set(
      seg.id === "M4" ? 1.539 : seg.id === "M6" ? 1.5 : 0,
      topY, -0.4
    );
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.4, metalness: 0.8 })
    );
    post.position.y = 0.15; bG.add(post);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.18, 14),
      new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5, metalness: 0.6 })
    );
    body.position.y = 0.39; bG.add(body);
    const dm = new THREE.MeshStandardMaterial({
      color: 0x222233, roughness: 0.05, metalness: 0.0,
      transparent: true, opacity: 0.92,
      emissive: 0x000000, emissiveIntensity: 0,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), dm
    );
    dome.position.y = 0.48; bG.add(dome);
    const light = new THREE.PointLight(0x000000, 0, 3);
    light.position.y = 0.55; bG.add(light);
    group.add(bG);
    st.balizaObjects.push({ segId: seg.id, dome, light });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const toggleAcc = (k) => setAccordion((p) => ({ ...p, [k]: !p[k] }));
  const sColor = (s) =>
    s === "running" ? "#00ff88" : s === "paused" ? "#ff4422" : "#445566";

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "#d8d4cc", fontFamily: "monospace", overflow: "hidden",
    }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />

      <button
        onClick={() => setSidebarOpen((o) => !o)}
        style={{
          position: "fixed", top: 16, left: sidebarOpen ? 272 : 16, zIndex: 100,
          background: "rgba(20,28,40,0.92)", border: "1px solid #344860",
          color: "#a8c8e8", width: 36, height: 36, borderRadius: 6,
          cursor: "pointer", fontSize: 18, display: "flex",
          alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(8px)", transition: "left 0.25s ease",
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
        }}
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      <div style={{
        position: "fixed", top: 0, left: sidebarOpen ? 0 : -260,
        width: 260, height: "100%", zIndex: 90,
        background: "rgba(16,22,32,0.97)", borderRight: "1px solid #2a3a50",
        backdropFilter: "blur(12px)", transition: "left 0.25s ease",
        display: "flex", flexDirection: "column", overflowY: "auto",
        boxShadow: "4px 0 28px rgba(0,0,0,0.5)",
      }}>
        <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid #2a3a50" }}>
          <div style={{ color: "#78b8e8", fontSize: 11, letterSpacing: 2, marginBottom: 2 }}>
            GEMELO DIGITAL
          </div>
          <div style={{ color: "#eef2f6", fontSize: 14, fontWeight: "bold" }}>
            Línea Fresas
          </div>
          <div style={{
            marginTop: 5, display: "flex", alignItems: "center", gap: 6,
            color: ui.running ? "#00ee77" : "#ff5533", fontSize: 11,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: ui.running ? "#00ee77" : "#ff5533",
              boxShadow: ui.running ? "0 0 6px #00ee77" : "none",
            }} />
            {ui.running ? "EN MARCHA" : "DETENIDA"}
          </div>
          {!ui.engineLoaded && (
            <div style={{
              marginTop: 8, fontSize: 10, color: "#446688",
              background: "rgba(0,40,80,0.3)", borderRadius: 4, padding: "5px 8px",
            }}>
              Arrastra un Excel en la barra inferior para iniciar.
            </div>
          )}
          {ui.engineLoaded && (
            <button onClick={handleReset} style={{
              marginTop: 8, width: "100%", padding: "5px 0",
              background: "rgba(80,40,10,0.4)", border: "1px solid #664422",
              color: "#cc8833", borderRadius: 4, cursor: "pointer",
              fontSize: 11, fontFamily: "monospace",
            }}>
              ↺ Reiniciar simulación
            </button>
          )}
        </div>

        <Acc label="◉ Estado línea" open={accordion.estado} onToggle={() => toggleAcc("estado")}>
          {SEGMENTS.map((seg) => {
            const s = ui.segmentStatuses[seg.id] || "stopped";
            return (
              <div key={seg.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 11 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: sColor(s),
                  boxShadow: s === "running" ? `0 0 5px ${sColor(s)}` : "none",
                  flexShrink: 0,
                }} />
                <span style={{ color: "#6688aa", width: 32, flexShrink: 0 }}>{seg.id}</span>
                <span style={{ color: "#b8c8d8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {seg.name || seg.id}
                </span>
                <span style={{ color: sColor(s), fontSize: 10 }}>
                  {s === "running" ? "●" : s === "paused" ? "■" : "○"}
                </span>
              </div>
            );
          })}
        </Acc>

        <Acc label="⚡ Controles" open={accordion.controles} onToggle={() => toggleAcc("controles")}>
          {CTRL_DEFS.map((def) => {
            const active = ui.ctrlStates[def.id];
            const isSeta = def.type === "seta";
            return (
              <div key={def.id} style={{ marginBottom: 5, fontSize: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: isSeta ? "50%" : 2,
                  background: active ? (isSeta ? "#ee1100" : "#ee6600") : "#2a3444",
                  boxShadow: active ? `0 0 6px ${isSeta ? "#ee1100" : "#ee6600"}` : "none",
                  flexShrink: 0,
                }} />
                <span style={{ color: "#6688aa", flex: 1 }}>{def.id}</span>
                <span style={{ color: active ? "#ffaa00" : "#3a4a5a" }}>{active ? "ACTIVO" : "OK"}</span>
              </div>
            );
          })}
        </Acc>

        <Acc label="🖱 Navegación" open={accordion.nav} onToggle={() => toggleAcc("nav")}>
          {[
            ["Click izq + drag", "Rotar"],
            ["Click der + drag", "Pan"],
            ["Rueda", "Zoom"],
            ["Click control", "Activar"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 10 }}>
              <span style={{ color: "#556677" }}>{k}</span>
              <span style={{ color: "#78b8e8" }}>{v}</span>
            </div>
          ))}
        </Acc>

        <div style={{ padding: "0 14px 12px" }}>
          <ChatBot simulationState={{
            running: ui.running,
            pausedSegments: [...ui.pausedSegments],
            segmentStatuses: ui.segmentStatuses,
            ctrlStates: ui.ctrlStates,
          }} />
        </div>

        <div style={{
          padding: "10px 14px", marginTop: "auto",
          borderTop: "1px solid #1e2e40", color: "#2a3a4a", fontSize: 10,
        }}>
          Three.js r128 · Gemelo Digital v4.1
        </div>
      </div>

      <div style={{
        position: "fixed", top: 12, right: 16, zIndex: 80,
        background: "rgba(16,22,32,0.88)", border: "1px solid #2a3a50",
        borderRadius: 6, padding: "6px 14px", backdropFilter: "blur(8px)",
        color: "#78b8e8", fontSize: 11, letterSpacing: 1,
      }}>
        🍓 LÍNEA ENVASADO FRESAS
      </div>
    </div>
  );
}

function Acc({ label, open, onToggle, children }) {
  return (
    <div style={{ borderBottom: "1px solid #1e2e40" }}>
      <button onClick={onToggle} style={{
        width: "100%", padding: "9px 14px",
        background: "transparent", border: "none",
        color: "#78b8e8", fontSize: 11, fontFamily: "monospace",
        textAlign: "left", cursor: "pointer",
        display: "flex", justifyContent: "space-between", letterSpacing: 0.5,
      }}>
        <span>{label}</span>
        <span style={{ opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "4px 14px 12px" }}>{children}</div>}
    </div>
  );
}
