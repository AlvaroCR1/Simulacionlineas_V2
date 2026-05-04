// ─── config/segments.js ──────────────────────────────────────────────────────
// Fuente de verdad de la topología física de la línea.
// Cada cambio aquí se propaga automáticamente a escena, simulación y UI.
//
// GEOMETRÍA DE REFERENCIA (metros de mundo Three.js):
//   Bizerba GLB real: ~1.8m de ancho → w:2.0 para que tenga espacio
//   Separación Bizerba 1 ↔ Bizerba 2: 4.5m entre centros
//   Cinta C12 queda exactamente en el centro entre M1 y M2

export const SEGMENTS = [
  // ── Bizerba 1: inicio de la línea, bien separada a la izquierda ───────────
  {
  id: "M1",
  type: "machine",
  name: "Bizerba 1",
  w: 2.0,
  h: 2.0,
  d: 1.6,
  cx: -29,      // era -25.8
  img: "bizerba",
  showBaliza: true,
},
  // ── Cinta entre Bizerba 1 y 2: centrada, más larga para el espacio ───────
  {
  id: "C12",
  type: "belt",
  name: "Cinta 1→2",
  w: 6.5,       // era 3.0 — más larga
  h: 0.22,
  d: 1.8,       // era 1.0 — más ancha para el embudo
  cx: -24.0,    // era -22.2 — recentrada entre M1 y M2
  showBaliza: false,
},
  // ── Bizerba 2: inicio del segundo cuadrado azul ───────────────────────────
  {
    id: "M2",
    type: "machine",
    name: "Bizerba 2",
    w: 2.0,
    h: 2.0,
    d: 1.6,
    cx: -19.23,
    img: "bizerba",
    showBaliza: true,
  },
  // ── Cinta Modular con operarios ───────────────────────────────────────────
  {
    id: "CM",
    type: "modular",
    name: "Cinta Modular",
    w: 5.6,
    h: 0.22,
    d: 1.1,
    cx: -14.32,
    img: "cintaMod",
    showBaliza: true,
  },
  // ── Termoselladora ULMA (modelo GLB) ─────────────────────────────────────
  {
    id: "M3",
    type: "machine",
    name: "Termoselladora",
    w: 2.8,
    h: 1.8,
    d: 2.0,
    cx: -7.0,
    img: "termo",
    showBaliza: true,
  },
  {
    id: "C34",
    type: "belt",
    name: "Cinta 3→4",
    w: 1.6,
    h: 0.22,
    d: 1.0,
    cx: -3,
    showBaliza: false,
  },
  {
    id: "M4",
    type: "machine",
    name: "GLMI",
    w: 1.6,
    h: 1.6,
    d: 1.6,
    cx: -0.4,
    img: "glmi",
    showBaliza: true,
  },
  {
    id: "C45",
    type: "belt",
    name: "Cinta 4→5",
    w: 1.6,
    h: 0.22,
    d: 1.0,
    cx: 2.42,
    showBaliza: false,
  },
  {
    id: "M5",
    type: "machine",
    name: "Etiquetadoras",
    w: 1.6,
    h: 1.6,
    d: 1.6,
    cx: 4.5,
    img: "etiqueta",
    showBaliza: true,
  },
  {
    id: "C56",
    type: "belt",
    name: "Cinta 5→6",
    w: 1.6,
    h: 0.22,
    d: 1.0,
    cx: 6.65,
    showBaliza: false,
  },
  {
    id: "M6",
    type: "machine",
    name: "Det. Metales",
    w: 1.0,
    h: 1.3,
    d: 1.1,
    cx: 8.0,
    img: "detector",
    showBaliza: true,
  },
];

/**
 * CTRL_DEFS: cada entrada es UN solo pulsador físico con un único comportamiento.
 *
 * type:
 *   "seta"     → parada de emergencia: para TODA la línea siempre
 *   "botonera" → parada secuencial aguas arriba desde segId
 *
 * pauseOnly: array de segIds exactos (solo botonera) — anula la regla aguas-arriba.
 *
 * groupId: cuando seta y botonera están en la MISMA caja física comparten groupId.
 *   controls.js los dibuja en una sola carcasa (seta izq, botonera der).
 */
export const CTRL_DEFS = [
  // ── Caja frontal junto a Bizerba 1 ──────────────────────────────────────
 {
    id: "seta_M1_front",
    segId: "M1",
    type: "seta",
    side: "front",
    dx: 3.5,
    dz: 0,
    groupId: "box_M1_front",
  },
  {
    id: "btn_M1_front",
    segId: "M1",
    type: "botonera",
    side: "front",
    dx: 3.5,
    dz: 0,
    groupId: "box_M1_front",
    pauseOnly: ["M1", "C12"],
  },
  {
    id: "seta_M1_back",
    segId: "M1",
    type: "seta",
    side: "back",
    dx: 3.5,
    dz: 0,
    groupId: "box_M1_back",
  },
  {
    id: "btn_M1_back",
    segId: "M1",
    type: "botonera",
    side: "back",
    dx: 3.5,
    dz: 0,
    groupId: "box_M1_back",
    pauseOnly: ["M1", "C12"],
  },

  // ── Seta junto a Bizerba 2 (solo seta, caja simple) ─────────────────────
  {
    id: "seta_M2_front",
    segId: "M2",
    type: "seta",
    side: "front",
    dx: 1.2,
    dz: 0,
  },

  // ── Caja frontal junto a Termoselladora ─────────────────────────────────
  {
    id: "seta_M3_front",
    segId: "M3",
    type: "seta",
    side: "front",
    dx: 3.0,
    dz: 0,
    groupId: "box_M3_front",
  },
  {
    id: "btn_M3_front",
    segId: "M3",
    type: "botonera",
    side: "front",
    dx: 2.0,
    dz: 0,
    groupId: "box_M3_front",
  },

  // ── GLMI: seta y botonera en la MISMA caja ──────────────────────────────
  {
    id: "seta_M4",
    segId: "M4",
    type: "seta",
    side: "front",
    dx: 1.5,
    dz: 0,
    groupId: "box_M4_front",
  },
  {
    id: "btn_M4",
    segId: "M4",
    type: "botonera",
    side: "front",
    dx: 1.0,
    dz: 0,
    groupId: "box_M4_front",
  },

  // ── Detector de Metales: solo pulsador de paro ──────────────────────────
  {
    id: "btn_M6",
    segId: "M6",
    type: "botonera",
    side: "front",
    dx: 4.2,
    dz: 0,
  },
];
