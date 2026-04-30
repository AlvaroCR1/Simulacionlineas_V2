// ─── simulation/pauseLogic.js ─────────────────────────────────────────────────
// Función PURA. Calcula qué segmentos pausar según el estado de los controles.
//
// REGLAS (en orden de prioridad):
//   1. Si CUALQUIER seta está activa → para TODA la línea inmediatamente.
//   2. Si una botonera tiene pauseOnly → para exactamente esos segmentos.
//   3. Si una botonera no tiene pauseOnly → para segId y todos los anteriores.
//
// Las setas y botoneras son ahora IDs completamente independientes en CTRL_DEFS,
// por lo que no hay ambigüedad: type:"seta" siempre para todo, type:"botonera"
// aplica la lógica secuencial.

import { SEGMENTS, CTRL_DEFS } from "../config/segments.js";

/**
 * @param {Object} ctrlStates  - { [ctrlId]: boolean }
 * @returns {Set<string>}      - conjunto de IDs de segmento pausados
 */
export function computePaused(ctrlStates) {
  const paused = new Set();
  const ids = SEGMENTS.map((s) => s.id);

  // Paso 1: ¿hay alguna seta activa? → para toda la línea
  const anyEmergency = CTRL_DEFS.some(
    (def) => def.type === "seta" && ctrlStates[def.id]
  );
  if (anyEmergency) {
    ids.forEach((id) => paused.add(id));
    return paused;
  }

  // Paso 2: botoneras activas → parada secuencial o exacta
  for (const def of CTRL_DEFS) {
    if (def.type !== "botonera") continue;
    if (!ctrlStates[def.id]) continue;

    if (def.pauseOnly) {
      def.pauseOnly.forEach((id) => paused.add(id));
    } else {
      const idx = ids.indexOf(def.segId);
      if (idx === -1) continue;
      for (let i = 0; i <= idx; i++) paused.add(ids[i]);
    }
  }

  return paused;
}
