/**
 * parseWeighingData.js  v3.0
 * Empareja tarrinas por índice entre las tres máquinas.
 * Incorpora paradas nombradas desde B2Go.
 * Exporta: parseWeighingFile(file) → { trays, meta }
 */

export const FLAG_TYPE = {
  OK: "ok",
  REJECT: "reject",
  SENSOR: "sensor",
  SYSTEM: "system",
};

// Colores 3D por tipo (hex numérico para Three.js)
export const TRAY_COLOR_HEX = {
  ok: 0x00cc66,
  reject: 0xee2211,
  sensor: 0xff8800,
  system: 0x4488ff,
  glmi_reject: 0xff2200, // rechazo definitivo trampilla
};

const DEVICE_MAP = {
  "CWE ENTRADA L12": "M1",
  "CWE INTERMEDIO L12": "M2",
  "GLMI LINEA12": "M4",
};

// ─── Paradas nombradas de B2Go ────────────────────────────────────────────────
// Fuente: imagen PARADAS.png de la OF 1000819289 (2026-04-27)
// tipo: "planificada" | "no_planificada"
// color en TimelinePlayer: rojo=no_planificada, amarillo=planificada
const NAMED_STOPS = [
  {
    nombre: "SETUP",
    tipo: "no_planificada",
    startMs: 1745749560000,
    endMs: 1745751720000,
  },
  {
    nombre: "Cambio etiquetas",
    tipo: "planificada",
    startMs: 1745755380000,
    endMs: 1745755461000,
  },
  {
    nombre: "Descanso 30 min.",
    tipo: "planificada",
    startMs: 1745758980000,
    endMs: 1745761080000,
  },
  {
    nombre: "Cambio etiquetas",
    tipo: "planificada",
    startMs: 1745762160000,
    endMs: 1745762220000,
  },
];

function classifyFlag(flag) {
  if (flag === 0) return FLAG_TYPE.OK;
  if (flag & 4096) return FLAG_TYPE.SYSTEM;
  if (flag & 2048) return FLAG_TYPE.SYSTEM;
  if (flag & 8) return FLAG_TYPE.REJECT;
  if (flag & 4) return FLAG_TYPE.SENSOR;
  return FLAG_TYPE.SYSTEM;
}

function parseDateSafe(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  const d = new Date(String(value).replace(" ", "T"));
  return isNaN(d) ? null : d;
}

export async function parseWeighingFile(file) {
  const XLSX = window.XLSX;
  if (!XLSX)
    throw new Error(
      "SheetJS no cargado. Añade el script en public/index.html."
    );

  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.includes("Exportacion_OF")
    ? "Exportacion_OF"
    : workbook.SheetNames[0];

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    raw: false,
    dateNF: "yyyy-mm-dd hh:mm:ss",
  });
  if (!rows.length) throw new Error("Hoja vacía o formato no reconocido.");

  // ── Separar por dispositivo y ordenar ────────────────────────────────────
  const byDevice = { M1: [], M2: [], M4: [] };
  for (const r of rows) {
    const key = DEVICE_MAP[(r["DISPOSITIVO"] || "").trim()];
    if (!key) continue;
    const ts = parseDateSafe(r["FECHA_HORA"]);
    if (!ts) continue;
    byDevice[key].push({
      ts,
      tMs: ts.getTime(),
      peso: parseFloat(r["PESO_PESADA"]) || 0,
      pesoMin: parseFloat(r["PESO_MINIMO"]) || 0,
      pesoMax: parseFloat(r["PESO_MAXIMO"]) || 0,
      flag: parseInt(r["ERRORFLAG"], 10) || 0,
      tipo: classifyFlag(parseInt(r["ERRORFLAG"], 10) || 0),
      of: r["OF"] || "",
      articulo: r["ARTICULO"] || "",
      unidad: r["UNIDAD_PESADA"] || "",
      linea: r["LINEA"] || "",
    });
  }
  for (const k of ["M1", "M2", "M4"]) byDevice[k].sort((a, b) => a.tMs - b.tMs);

  // ── Emparejar por índice ──────────────────────────────────────────────────
  // tarrina #N de M1 = tarrina #N de M2 = tarrina #N de M4
  const trays = [];
  for (let i = 0; i < byDevice.M1.length; i++) {
    const r1 = byDevice.M1[i];
    const r2 = byDevice.M2[i] || null;
    const r4 = byDevice.M4[i] || null;
    if (r1.tipo === FLAG_TYPE.SYSTEM) continue;

    trays.push({
      id: i + 1,
      // M1 — siempre existe
      tMs_M1: r1.tMs,
      tipo_M1: r1.tipo,
      peso_M1: r1.peso,
      flag_M1: r1.flag,
      // M2 — puede faltar las últimas 16
      tMs_M2: r2?.tMs ?? null,
      tipo_M2: r2?.tipo ?? null,
      peso_M2: r2?.peso ?? null,
      flag_M2: r2?.flag ?? null,
      // M4 — existe para las primeras 4517
      tMs_M4: r4?.tMs ?? null,
      tipo_M4: r4?.tipo ?? null,
      peso_M4: r4?.peso ?? null,
      flag_M4: r4?.flag ?? null,
      // Común
      pesoMin: r1.pesoMin,
      pesoMax: r1.pesoMax,
      of: r1.of,
      articulo: r1.articulo,
      unidad: r1.unidad,
      linea: r1.linea,
    });
  }
  trays.sort((a, b) => a.tMs_M1 - b.tMs_M1);

  // ── Meta ─────────────────────────────────────────────────────────────────
  const startMs = trays[0].tMs_M1;
  const endMs = Math.max(...trays.map((t) => t.tMs_M4 || t.tMs_M2 || t.tMs_M1));
  const sample = trays[0];

  const byMachine = {
    M1: { total: 0, ok: 0, reject: 0, yieldPct: 0 },
    M2: { total: 0, ok: 0, reject: 0, yieldPct: 0 },
    M4: { total: 0, ok: 0, reject: 0, yieldPct: 0 },
  };
  for (const t of trays) {
    for (const [m, tk] of [
      ["M1", "tipo_M1"],
      ["M2", "tipo_M2"],
      ["M4", "tipo_M4"],
    ]) {
      const tipo = t[tk];
      if (!tipo) continue;
      byMachine[m].total++;
      if (tipo === FLAG_TYPE.OK) byMachine[m].ok++;
      if (tipo === FLAG_TYPE.REJECT) byMachine[m].reject++;
    }
  }
  for (const m of Object.values(byMachine)) {
    m.yieldPct = m.total > 0 ? (m.ok / m.total) * 100 : 0;
  }

  // ── Paradas: combinar nombradas + detectadas automáticamente ─────────────
  const autoStops = detectAutoStops(byDevice, 60_000);
  const stops = mergeStops(NAMED_STOPS, autoStops, startMs);

  return {
    trays,
    meta: {
      of: sample.of,
      articulo: sample.articulo,
      unidad: sample.unidad,
      linea: sample.linea,
      pesoMin: sample.pesoMin,
      pesoMax: sample.pesoMax,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      totalTrays: trays.length,
      byMachine,
      stops,
    },
  };
}

// ─── Detección automática de gaps > umbral ────────────────────────────────────
function detectAutoStops(byDevice, thresholdMs) {
  const raw = [];
  for (const [machineId, recs] of Object.entries(byDevice)) {
    if (!recs.length) continue;
    for (let i = 1; i < recs.length; i++) {
      const gap = recs[i].tMs - recs[i - 1].tMs;
      if (gap > thresholdMs)
        raw.push({
          machineId,
          startMs: recs[i - 1].tMs,
          endMs: recs[i].tMs,
          durationMs: gap,
        });
    }
  }
  raw.sort((a, b) => a.startMs - b.startMs);

  const grouped = [];
  for (const stop of raw) {
    const last = grouped[grouped.length - 1];
    if (last && Math.abs(stop.startMs - last.startMs) < 15_000) {
      last.machines = [...new Set([...last.machines, stop.machineId])];
      last.durationMs = Math.max(last.durationMs, stop.durationMs);
      last.endMs = Math.max(last.endMs, stop.endMs);
    } else {
      grouped.push({
        startMs: stop.startMs,
        endMs: stop.endMs,
        durationMs: stop.durationMs,
        machines: [stop.machineId],
      });
    }
  }
  grouped.forEach((g) => {
    g.isLineStop = g.machines.length >= 2;
  });
  return grouped;
}

// ─── Fusionar paradas nombradas con las detectadas ────────────────────────────
// Las nombradas tienen prioridad; si un auto-stop cae dentro de una nombrada se descarta.
function mergeStops(named, auto, startMs) {
  const result = named.map((n) => ({
    ...n,
    durationMs: n.endMs - n.startMs,
    isLineStop: true,
    isNamed: true,
  }));

  for (const a of auto) {
    const overlap = result.some(
      (n) => a.startMs < n.endMs && a.endMs > n.startMs
    );
    if (!overlap) {
      result.push({ ...a, nombre: null, tipo: "auto", isNamed: false });
    }
  }
  result.sort((a, b) => a.startMs - b.startMs);
  return result;
}
