/**
 * TimelinePlayer.jsx  v3.0
 * Panel inferior de reproducción histórica.
 * Novedades:
 *   - Paradas nombradas con color y tooltip en la barra de tiempo
 *   - Log muestra spawn (M1), llegada M2, llegada M4 con color correcto
 *   - Leyenda de colores de tarrinas
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { SPEEDS } from "../simulation/timelineEngine";
import { FLAG_TYPE } from "../config/parseWeighingData";

const MACHINE_COLOR = { M1: "#378ADD", M2: "#1D9E75", M4: "#EF9F27" };
const MACHINE_LABEL = { M1: "Bizerba 1", M2: "Bizerba 2", M4: "GLMI" };
const STOP_COLOR = {
  planificada: "#EF9F27",
  no_planificada: "#E24B4A",
  auto: "#666",
};
const MAX_LOG = 60;

function fmtTime(date) {
  if (!date) return "--:--:--";
  try {
    return date.toTimeString().slice(0, 8);
  } catch {
    return "--:--:--";
  }
}
function fmtDur(ms) {
  if (!ms || ms < 0) return "--";
  const s = Math.floor(ms / 1000),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}min`
    : `${m}min ${String(s % 60).padStart(2, "0")}s`;
}
function fmtG(val) {
  return val != null ? `${(val * 1000).toFixed(0)}g` : "—";
}
function fmtPct(v) {
  return v != null ? `${v.toFixed(1)}%` : "—";
}

const S = {
  root: {
    width: "100%",
    background: "#0d1117",
    borderTop: "1px solid #1e2e40",
    fontFamily: "monospace",
    userSelect: "none",
    color: "#c9d1d9",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 14px",
    borderBottom: "1px solid #1e2e40",
    cursor: "pointer",
  },
  body: { padding: "10px 14px 12px" },
  dropZone: {
    border: "1.5px dashed #2a3a50",
    borderRadius: 8,
    padding: "18px",
    textAlign: "center",
    cursor: "pointer",
    color: "#4a6a8a",
    fontSize: 13,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: 8,
    marginBottom: 10,
  },
  kpi: { background: "#161b22", borderRadius: 8, padding: "8px 10px" },
  track: { position: "relative", height: 20, margin: "8px 0 2px" },
  bar: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    height: 8,
    background: "#1e2e40",
    borderRadius: 4,
    cursor: "pointer",
    overflow: "visible",
  },
  fill: {
    height: "100%",
    background: "#378ADD",
    borderRadius: 4,
    pointerEvents: "none",
  },
  thumb: {
    position: "absolute",
    top: -5,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#0d1117",
    border: "2px solid #378ADD",
    transform: "translateX(-50%)",
    cursor: "grab",
    zIndex: 2,
  },
  btn: {
    background: "#161b22",
    border: "1px solid #2a3a50",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    cursor: "pointer",
    color: "#c9d1d9",
    fontFamily: "monospace",
  },
  btnPlay: {
    background: "#1a3a5c",
    border: "1px solid #378ADD",
    borderRadius: 6,
    padding: "5px 14px",
    fontSize: 12,
    cursor: "pointer",
    color: "#78b8e8",
    fontFamily: "monospace",
  },
  spdBtn: {
    background: "transparent",
    border: "1px solid #2a3a50",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 11,
    cursor: "pointer",
    color: "#6a8aaa",
    fontFamily: "monospace",
  },
  spdSel: { borderColor: "#378ADD", color: "#78b8e8", fontWeight: "bold" },
  machRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
    fontSize: 11,
  },
  barBg: {
    flex: 1,
    height: 5,
    background: "#1e2e40",
    borderRadius: 3,
    overflow: "hidden",
  },
  logRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "3px 0",
    borderBottom: "1px solid #1a2230",
    fontSize: 11,
  },
};

export default function TimelinePlayer({ engine, onLoad, visible = true }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ps, setPs] = useState(null); // playerState
  const [log, setLog] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [tooltip, setTooltip] = useState(null); // { stop, x }
  const trackRef = useRef(null);
  const logRef = useRef(null);

  // ── Suscripción al engine ──────────────────────────────────────────────────
  useEffect(() => {
    if (!engine) {
      setPs(null);
      setLog([]);
      return;
    }
    const prevTick = engine.onTick;
    engine.onTick = (state) => {
      if (prevTick) prevTick(state);
      setPs({ ...state });
    };

    // Log: spawns y llegadas
    const prevSpawn = engine.onSpawn;
    const prevM2 = engine.onReachM2;
    const prevM4 = engine.onReachM4;

    engine.onSpawn = (tray) => {
      if (prevSpawn) prevSpawn(tray);
      setLog((prev) =>
        [{ t: tray.tMs_M1, machine: "M1", tipo: tray.tipo_M1, peso: tray.peso_M1, id: tray.id, event: "spawn" }, ...prev].slice(0, MAX_LOG)
      );
    };
    engine.onReachM2 = (tray) => {
      if (prevM2) prevM2(tray);
      if (!tray.tipo_M2 || tray.tipo_M2 === "system") return;
      setLog((prev) =>
        [{ t: tray.tMs_M2, machine: "M2", tipo: tray.tipo_M2, peso: tray.peso_M2, id: tray.id, event: "m2" }, ...prev].slice(0, MAX_LOG)
      );
    };
    engine.onReachM4 = (tray) => {
      if (prevM4) prevM4(tray);
      if (!tray.tipo_M4 || tray.tipo_M4 === "system") return;
      setLog((prev) =>
        [{ t: tray.tMs_M4, machine: "M4", tipo: tray.tipo_M4, peso: tray.peso_M4, id: tray.id, event: "m4" }, ...prev].slice(0, MAX_LOG)
      );
    };

    setPs({ ...engine.state });
    return () => {
      if (engine) engine.onTick = null;
    };
  }, [engine]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [log.length]);

  // ── Seek por puntero ───────────────────────────────────────────────────────
  const seekFromPointer = useCallback(
    (clientX) => {
      if (!engine || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      engine.seekTo(ratio * engine._durationMs);
      setLog([]);
    },
    [engine]
  );

  useEffect(() => {
    if (!dragging) return;
    const mv = (e) => seekFromPointer(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, seekFromPointer]);

  // ── Drag & drop archivo ────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && onLoad) onLoad(f);
  };

  if (!visible) return null;

  const meta = ps?.meta || engine?._meta || null;
  const stops = meta?.stops || [];

  // ── Sin datos ──────────────────────────────────────────────────────────────
  if (!engine) {
    return (
      <div style={S.root}>
        <div style={S.header} onClick={() => setCollapsed((c) => !c)}>
          <span style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>
            REPRODUCTOR HISTÓRICO
          </span>
          <span style={{ fontSize: 10, color: "#4a6a8a" }}>
            Sin datos cargados
          </span>
        </div>
        {!collapsed && (
          <div style={S.body}>
            <label
              style={{
                ...S.dropZone,
                background: dragOver ? "#1a2e44" : undefined,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f && onLoad) onLoad(f);
                }}
              />
              <div
                style={{
                  marginBottom: 4,
                  fontWeight: "bold",
                  color: "#6a9abd",
                }}
              >
                📂 Arrastra el Excel de la OF aquí
              </div>
              <div style={{ fontSize: 11 }}>
                o haz clic · formato: Exportacion_OF
              </div>
            </label>
          </div>
        )}
      </div>
    );
  }

  // ── Con datos ──────────────────────────────────────────────────────────────
  const progress = ps?.progress ?? 0;
  const cursorDate = ps?.cursorDate;
  const playing = ps?.playing ?? false;
  const speed = ps?.speed ?? 10;
  const reachedEnd = ps?.reachedEnd ?? false;

  const machines = meta ? Object.entries(meta.byMachine) : [];
  const totalOk = machines.reduce((s, [, m]) => s + m.ok, 0);
  const totalRej = machines.reduce((s, [, m]) => s + m.reject, 0);
  const totalAll = machines.reduce((s, [, m]) => s + m.total, 0);

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header} onClick={() => setCollapsed((c) => !c)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#4a6a8a", letterSpacing: 1 }}>
            OF
          </span>
          <span style={{ fontSize: 12, fontWeight: "bold", color: "#78b8e8" }}>
            {meta?.of || "—"}
          </span>
          <span style={{ fontSize: 11, color: "#4a6a8a" }}>
            {meta?.articulo || ""}
          </span>
        </div>
        <span style={{ fontSize: 10, color: "#4a6a8a" }}>
          {collapsed ? "▲ expandir" : "▼ colapsar"}
        </span>
      </div>

      {!collapsed && (
        <div style={S.body}>
          {/* KPIs */}
          <div style={S.kpiGrid}>
            {[
              [totalAll.toLocaleString(), "Tarrinas", "#c9d1d9"],
              [
                totalOk.toLocaleString(),
                `Aceptadas (${
                  totalAll > 0 ? fmtPct((totalOk / totalAll) * 100) : "—"
                })`,
                "#3fb950",
              ],
              [
                totalRej.toLocaleString(),
                `Rechazadas (${
                  totalAll > 0 ? fmtPct((totalRej / totalAll) * 100) : "—"
                })`,
                "#f85149",
              ],
              [
                fmtDur(meta?.durationMs),
                `${fmtTime(new Date(meta?.startMs))} → ${fmtTime(
                  new Date(meta?.endMs)
                )}`,
                "#c9d1d9",
              ],
            ].map(([v, l, c], i) => (
              <div key={i} style={S.kpi}>
                <div style={{ fontSize: 16, fontWeight: 500, color: c }}>
                  {v}
                </div>
                <div style={{ fontSize: 10, color: "#4a6a8a", marginTop: 2 }}>
                  {l}
                </div>
              </div>
            ))}
          </div>

          {/* Barra de tiempo */}
          <div style={S.track}>
            <div
              ref={trackRef}
              style={S.bar}
              onClick={(e) => {
                if (!dragging) seekFromPointer(e.clientX);
              }}
            >
              <div
                style={{ ...S.fill, width: `${(progress * 100).toFixed(2)}%` }}
              />

              {/* Ticks de paradas con tooltip */}
              {stops.map((stop, i) => {
                const pct = (
                  ((stop.startMs - meta.startMs) / meta.durationMs) *
                  100
                ).toFixed(2);
                const col = STOP_COLOR[stop.tipo] || "#666";
                const h = stop.isNamed ? 16 : stop.isLineStop ? 14 : 10;
                const w = stop.isNamed ? 3 : 2;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      top: stop.isNamed ? -5 : -3,
                      left: `${pct}%`,
                      width: w,
                      height: h,
                      background: col,
                      borderRadius: 1,
                      cursor: "help",
                      zIndex: 1,
                    }}
                    onMouseEnter={(e) => setTooltip({ stop, x: e.clientX })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}

              {/* Thumb */}
              <div
                style={{ ...S.thumb, left: `${(progress * 100).toFixed(2)}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragging(true);
                }}
              />
            </div>
          </div>

          {/* Tooltip de parada */}
          {tooltip && (
            <div
              style={{
                position: "fixed",
                bottom: 180,
                left: Math.min(tooltip.x, window.innerWidth - 220),
                background: "#1e2e40",
                border: "1px solid #2a3a50",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 11,
                zIndex: 999,
                pointerEvents: "none",
                borderLeft: `3px solid ${
                  STOP_COLOR[tooltip.stop.tipo] || "#666"
                }`,
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  color: "#c9d1d9",
                  marginBottom: 2,
                }}
              >
                {tooltip.stop.nombre || "Parada detectada"}
              </div>
              <div style={{ color: "#4a6a8a" }}>
                {fmtTime(new Date(tooltip.stop.startMs))} →{" "}
                {fmtTime(new Date(tooltip.stop.endMs))}
              </div>
              <div style={{ color: "#4a6a8a" }}>
                Duración: {fmtDur(tooltip.stop.durationMs)}
              </div>
              {tooltip.stop.tipo && (
                <div
                  style={{
                    color: STOP_COLOR[tooltip.stop.tipo],
                    marginTop: 2,
                    textTransform: "uppercase",
                    fontSize: 10,
                  }}
                >
                  {tooltip.stop.tipo}
                </div>
              )}
            </div>
          )}

          {/* Tiempos */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "#4a6a8a",
              margin: "12px 0 8px",
            }}
          >
            <span>{fmtTime(new Date(meta?.startMs))}</span>
            <span
              style={{ fontWeight: "bold", color: "#78b8e8", fontSize: 12 }}
            >
              {fmtTime(cursorDate)}
            </span>
            <span>{fmtTime(new Date(meta?.endMs))}</span>
          </div>

          {/* Controles */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              style={S.btn}
              onClick={() => engine.seekTo(0)}
              title="Inicio"
            >
              ⏮
            </button>
            <button
              style={S.btnPlay}
              onClick={() => (playing ? engine.pause() : engine.play())}
            >
              {reachedEnd ? "↺ Repetir" : playing ? "⏸ Pausa" : "▶ Play"}
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: "#4a6a8a" }}>Velocidad</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                style={{ ...S.spdBtn, ...(speed === s ? S.spdSel : {}) }}
                onClick={() => engine.setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>

          {/* Estado por máquina */}
          <div style={{ marginBottom: 8 }}>
            {machines.map(([mId, m]) => (
              <div key={mId} style={S.machRow}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: MACHINE_COLOR[mId],
                    flexShrink: 0,
                  }}
                />
                <span style={{ minWidth: 80, color: "#6a8aaa" }}>
                  {MACHINE_LABEL[mId]}
                </span>
                <div style={S.barBg}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      background: MACHINE_COLOR[mId],
                      width: `${m.yieldPct?.toFixed(1) || 0}%`,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: "#4a6a8a",
                    minWidth: 38,
                    textAlign: "right",
                  }}
                >
                  {fmtPct(m.yieldPct)}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "#4a6a8a",
                    minWidth: 58,
                    textAlign: "right",
                  }}
                >
                  {m.total?.toLocaleString()} tar.
                </span>
              </div>
            ))}
          </div>

          {/* Leyenda */}
          <div
            style={{
              display: "flex",
              gap: 14,
              fontSize: 10,
              color: "#4a6a8a",
              marginBottom: 8,
            }}
          >
            {[
              ["#00cc66", "OK"],
              ["#ee2211", "Rechazo"],
              ["#ff8800", "Sensor"],
              ["#E24B4A", "▐ No planif."],
              ["#EF9F27", "▐ Planificada"],
            ].map(([c, l]) => (
              <span
                key={l}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: l.includes("▐") ? 1 : "50%",
                    background: l.includes("▐") ? c : c,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                {l.replace("▐ ", "")}
              </span>
            ))}
          </div>

          {/* Log de eventos */}
          {log.length > 0 && (
            <div
              ref={logRef}
              style={{
                maxHeight: 100,
                overflowY: "auto",
                borderTop: "1px solid #1e2e40",
                paddingTop: 4,
              }}
            >
              {log.map((ev, i) => {
                const col =
                  ev.tipo === "ok"
                    ? "#3fb950"
                    : ev.tipo === "reject"
                    ? "#f85149"
                    : "#d29922";
                const evt =
                  ev.event === "spawn"
                    ? "M1 →"
                    : ev.event === "m2"
                    ? "→ M2"
                    : ev.event === "m4"
                    ? "→ GLMI"
                    : "";
                return (
                  <div key={i} style={S.logRow}>
                    <span
                      style={{
                        color: "#4a6a8a",
                        minWidth: 58,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtTime(new Date(ev.t))}
                    </span>
                    <span
                      style={{ color: MACHINE_COLOR[ev.machine], minWidth: 24 }}
                    >
                      {evt}
                    </span>
                    <span style={{ color: col }}>
                      {ev.tipo === "ok"
                        ? `${fmtG(ev.peso)} ✓`
                        : `${fmtG(ev.peso)} ✗`}
                    </span>
                    <span style={{ color: "#2a3a50", fontSize: 10 }}>
                      #{ev.id}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
