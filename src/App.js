// ─── App.js  v3.0 ─────────────────────────────────────────────────────────────
// El engine controla st.running vía play/pause.
// handleFileLoad destruye el engine anterior correctamente.
import { useState, useCallback } from "react";
import StrawberryLineTwin from "./StrawberryLineTwin";
import TimelinePlayer from "./ui/TimelinePlayer";
import { parseWeighingFile } from "./config/parseWeighingData";
import { TimelineEngine } from "./simulation/timelineEngine";

export default function App() {
  const [engine, setEngine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileLoad = useCallback(async (file) => {
    try {
      setLoading(true);
      setError(null);
      // Destruir engine anterior limpiamente
      setEngine((prev) => {
        if (prev) prev.destroy();
        return null;
      });

      const { trays, meta } = await parseWeighingFile(file);
      const eng = new TimelineEngine(trays, meta);
      setEngine(eng);
    } catch (err) {
      console.error("Error cargando Excel:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#0a0f18",
      }}
    >
      {/* Canvas 3D */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <StrawberryLineTwin engine={engine} />
      </div>

      {/* Reproductor histórico — siempre visible */}
      <TimelinePlayer engine={engine} onLoad={handleFileLoad} />

      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 500,
          }}
        >
          <div
            style={{
              background: "#1e2e40",
              borderRadius: 10,
              padding: "20px 32px",
              color: "#78b8e8",
              fontSize: 13,
              fontFamily: "monospace",
            }}
          >
            ⏳ Procesando Excel…
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 180,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(200,30,30,0.95)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "monospace",
            zIndex: 500,
            maxWidth: 400,
            textAlign: "center",
            cursor: "pointer",
          }}
          onClick={() => setError(null)}
        >
          ⚠ {error} &nbsp;✕
        </div>
      )}
    </div>
  );
}
