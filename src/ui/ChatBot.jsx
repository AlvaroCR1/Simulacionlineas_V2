// src/ui/ChatBot.jsx
import React, { useState, useRef, useEffect } from "react";

const BACKEND_URL = "https://lineasproduccionv2-production.up.railway.app/chat";

const SYSTEM_CONTEXT = `Eres el asistente experto del gemelo digital de una línea de envasado de fresas de una empresa hortofrutícola.

LÍNEA DE PRODUCCIÓN (izquierda a derecha):
1. Bizerba 1 — Balanza/etiquetadora de peso
2. Cinta transportadora
3. Bizerba 2 — Segunda balanza/etiquetadora
4. Cinta Modular
5. Termoselladora ULMA — Sellado de bandejas (modelo GLB real)
6. Cinta transportadora
7. GLMI — Máquina de inspección
8. Cinta transportadora
9. Etiquetadoras — Aplicación de etiquetas finales
10. Cinta transportadora
11. Detector de Metales — Control de calidad final

CONTROLES DE SEGURIDAD:
- Setas de emergencia (STOP total de línea)
- Botoneras de parada por segmento (paran aguas arriba desde ese punto)

ENTORNO:
- Nave industrial con suelo azul #3888BC
- Balizas luminosas: verde (operativa) / rojo (parada)
- Tarrinas de fresas animadas en la línea

Responde siempre en español. Sé conciso y técnico.`;

const ChatBot = ({ simulationState = null }) => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hola, soy el asistente del gemelo digital. Puedo ayudarte con dudas sobre la línea de envasado, máquinas, paradas o simulación. ¿En qué puedo ayudarte?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildPrompt = (userText) => {
    const isFirstMessage = messages.length <= 1;

    let context = isFirstMessage ? SYSTEM_CONTEXT : "";

    if (simulationState && isFirstMessage) {
      context += `\n\nESTADO ACTUAL:\n${JSON.stringify(simulationState)}`;
    }

    const historial = messages
      .slice(-4)
      .map(
        (m) => `${m.role === "assistant" ? "Asistente" : "Usuario"}: ${m.text}`
      )
      .join("\n");

    return `${context}\n\nHISTORIAL:\n${historial}\n\nUsuario: ${userText}\nAsistente:`;
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(trimmed) }),
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const data = await response.json();
      const botText = data.text || "Sin respuesta del asistente.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: botText.trim() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error de conexión: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const styles = {
    container: {
      display: "flex",
      flexDirection: "column",
      height: isOpen ? "340px" : "40px",
      border: "1px solid #334155",
      borderRadius: "8px",
      overflow: "hidden",
      background: "#0f172a",
      transition: "height 0.3s ease",
      marginTop: "8px",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      background: "#1e293b",
      borderBottom: "1px solid #334155",
      cursor: "pointer",
      flexShrink: 0,
    },
    headerTitle: {
      color: "#94a3b8",
      fontSize: "12px",
      fontWeight: "600",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    dot: {
      width: "7px",
      height: "7px",
      borderRadius: "50%",
      background: "#22c55e",
      flexShrink: 0,
    },
    toggle: {
      color: "#64748b",
      fontSize: "14px",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "0 4px",
    },
    messages: {
      flex: 1,
      overflowY: "auto",
      padding: "10px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
    bubble: (role) => ({
      maxWidth: "85%",
      alignSelf: role === "user" ? "flex-end" : "flex-start",
      background: role === "user" ? "#1d4ed8" : "#1e293b",
      color: role === "user" ? "#eff6ff" : "#cbd5e1",
      borderRadius:
        role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
      padding: "8px 10px",
      fontSize: "12px",
      lineHeight: "1.5",
      border: role === "assistant" ? "1px solid #334155" : "none",
    }),
    inputArea: {
      display: "flex",
      padding: "8px",
      gap: "6px",
      borderTop: "1px solid #334155",
      background: "#0f172a",
      flexShrink: 0,
    },
    input: {
      flex: 1,
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "6px",
      color: "#e2e8f0",
      fontSize: "12px",
      padding: "6px 10px",
      outline: "none",
      resize: "none",
    },
    sendBtn: {
      background: loading ? "#334155" : "#1d4ed8",
      border: "none",
      borderRadius: "6px",
      color: "#fff",
      cursor: loading ? "not-allowed" : "pointer",
      fontSize: "14px",
      padding: "6px 10px",
      flexShrink: 0,
    },
    loadingDots: {
      color: "#64748b",
      fontSize: "18px",
      alignSelf: "flex-start",
      padding: "4px 8px",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsOpen((v) => !v)}>
        <span style={styles.headerTitle}>
          <span style={styles.dot} />
          Asistente IA — Línea de Fresas
        </span>
        <button style={styles.toggle}>{isOpen ? "▼" : "▲"}</button>
      </div>

      {isOpen && (
        <>
          <div style={styles.messages}>
            {messages.map((msg, i) => (
              <div key={i} style={styles.bubble(msg.role)}>
                {msg.text}
              </div>
            ))}
            {loading && <div style={styles.loadingDots}>···</div>}
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.inputArea}>
            <textarea
              style={styles.input}
              rows={1}
              placeholder="Pregunta sobre la línea..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              style={styles.sendBtn}
              onClick={sendMessage}
              disabled={loading}
            >
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatBot;
