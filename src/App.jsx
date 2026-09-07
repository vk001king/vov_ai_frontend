import React, { useCallback, useEffect, useRef, useState } from "react";

import "./App.css";

import * as api from "./api.js";
import BuilderPanel from "./components/BuilderPanel.jsx";
import CameraPanel from "./components/CameraPanel.jsx";
import Composer from "./components/Composer.jsx";
import Message from "./components/Message.jsx";
import Sidebar from "./components/Sidebar.jsx";

const SUGGESTIONS = [
  "Explain how JavaScript promises work, with examples",
  "Write a Python script that renames files by date",
  "Build me a landing page for a coffee shop",
  "Review this code and tell me what could break",
];

export default function App() {
  const [view, setView] = useState("chat");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [images, setImages] = useState([]);

  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  const [model, setModel] = useState("auto");
  const [availableModels, setAvailableModels] = useState([]);

  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [inputError, setInputError] = useState("");

  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  /* ---------------- bootstrap ---------------- */

  const checkHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();

      setBackendOnline(true);
      setOllamaOnline(Boolean(health.ollama));
    } catch {
      setBackendOnline(false);
      setOllamaOnline(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const data = await api.getModels();
      setAvailableModels(Array.isArray(data.installed) ? data.installed : []);
    } catch {
      setAvailableModels([]);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.listSessions();
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    loadModels();
    loadSessions();

    const timer = setInterval(checkHealth, 20000);

    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [checkHealth, loadModels, loadSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  /* ---------------- sessions ---------------- */

  function newChat() {
    abortRef.current?.abort();

    setMessages([]);
    setMessage("");
    setImages([]);
    setSessionId(null);
    setInputError("");
    setView("chat");
  }

  async function openSession(id) {
    try {
      const data = await api.getSession(id);

      setSessionId(id);
      setView("chat");
      setMessages(
        (data.messages || []).map((item) => ({
          role: item.role,
          content: item.content,
          model: item.model,
          images: item.images || [],
        }))
      );
    } catch (error) {
      setInputError(error.message);
    }
  }

  async function removeSession(id) {
    await api.deleteSession(id).catch(() => {});

    if (id === sessionId) newChat();

    loadSessions();
  }

  async function clearAllSessions() {
    if (!window.confirm("Delete every saved conversation?")) return;

    await api.clearSessions().catch(() => {});

    newChat();
    loadSessions();
  }

  /* ---------------- chat ---------------- */

  async function sendMessage() {
    const text = message.trim();

    if ((!text && images.length === 0) || loading) return;

    const attached = [...images];

    const outgoing = { role: "user", content: text, images: attached };

    setMessages((current) => [...current, outgoing]);
    setMessage("");
    setImages([]);
    setInputError("");
    setLoading(true);

    // Placeholder that fills in as tokens arrive.
    setMessages((current) => [
      ...current,
      { role: "assistant", content: "", thinking: "", model: null, pending: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    let currentSession = sessionId;
    let streamed = false;

    function patchLast(patch) {
      setMessages((current) => {
        const copy = [...current];
        const index = copy.length - 1;

        if (index >= 0 && copy[index].role === "assistant") {
          copy[index] = { ...copy[index], ...patch(copy[index]) };
        }

        return copy;
      });
    }

    try {
      await api.streamChat(
        {
          message: text || "Describe the attached image.",
          model,
          session_id: sessionId,
          images: attached.length ? attached : null,
        },
        (chunk) => {
          if (chunk.type === "session") {
            currentSession = chunk.session_id;
            return;
          }

          if (chunk.type === "thinking") {
            patchLast((previous) => ({
              thinking: (previous.thinking || "") + chunk.content,
              model: chunk.model || previous.model,
            }));
            return;
          }

          if (chunk.type === "content") {
            streamed = true;

            patchLast((previous) => ({
              content: (previous.content || "") + chunk.content,
              model: chunk.model || previous.model,
              pending: false,
            }));
            return;
          }

          if (chunk.type === "error") {
            patchLast(() => ({
              content: chunk.content,
              error: true,
              pending: false,
            }));
          }
        },
        controller.signal
      );

      if (!streamed) {
        patchLast((previous) => ({
          content:
            previous.content ||
            "The model returned an empty response. Try a different model or rephrase.",
          pending: false,
        }));
      }

      if (currentSession && currentSession !== sessionId) {
        setSessionId(currentSession);
      }

      loadSessions();
    } catch (error) {
      if (error.name === "AbortError") {
        patchLast((previous) => ({
          content: previous.content || "_Stopped._",
          pending: false,
        }));
      } else {
        patchLast(() => ({
          content:
            `Could not reach the VOV AI backend at ${api.API_URL}. ` +
            "Start it with `python main.py` in the backend folder, " +
            "and make sure Ollama is running.",
          error: true,
          pending: false,
        }));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      checkHealth();
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  /* ---------------- render ---------------- */

  const lastMessage = messages[messages.length - 1];
  const waiting = loading && lastMessage?.pending;

  return (
    <div className="app">
      <Sidebar
        view={view}
        onChangeView={setView}
        sessions={sessions}
        activeSessionId={sessionId}
        onNewChat={newChat}
        onOpenSession={openSession}
        onDeleteSession={removeSession}
        onClearSessions={clearAllSessions}
        backendOnline={backendOnline}
        ollamaOnline={ollamaOnline}
        modelCount={availableModels.length}
      />

      <main className="main">
        <div className="scanline" />

        <header className="topBar">
          <div className="topTitle">
            <div className={backendOnline ? "statusOrb" : "statusOrb dim"} />

            <div>
              <h1>VOV AI</h1>

              <span>
                {view === "chat" ? "ASSISTANT" : "PROJECT BUILDER"} //{" "}
                {ollamaOnline ? "ONLINE" : "OLLAMA OFFLINE"}
              </span>
            </div>
          </div>

          <div className="modelArea">
            <span className="modelLabel">CORE</span>

            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="modelSelect"
            >
              <option value="auto">AUTO</option>

              {availableModels.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <button
              className="refreshModels"
              title="Refresh model list"
              onClick={async () => {
                await api.getModels(true).catch(() => {});
                loadModels();
                checkHealth();
              }}
            >
              ↻
            </button>
          </div>
        </header>

        {!backendOnline && (
          <div className="offlineBanner">
            Backend unreachable at {api.API_URL} — run{" "}
            <code>python main.py</code> in the backend folder.
          </div>
        )}

        {view === "builder" ? (
          <BuilderPanel
            models={availableModels}
            model={model}
            onModelChange={setModel}
          />
        ) : (
          <>
            <section className="chatArea">
              {messages.length === 0 ? (
                <div className="welcome">
                  <div className="assistantCore">
                    <div className="coreRing ringOne" />
                    <div className="coreRing ringTwo" />
                    <div className="coreRing ringThree" />
                    <div className="coreSphere">V</div>
                  </div>

                  <div className="systemLabel">LOCAL ASSISTANT</div>

                  <h2>VOV is ready.</h2>

                  <p>
                    Ask a question, attach an image, or switch to the Builder
                    tab to generate a whole project.
                  </p>

                  <div className="suggestions">
                    {SUGGESTIONS.map((text) => (
                      <button key={text} onClick={() => setMessage(text)}>
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="messages">
                  {messages.map((item, index) => (
                    <Message item={item} key={index} />
                  ))}

                  {waiting && (
                    <div className="thinking">
                      <span className="thinkingDot" />
                      <span className="thinkingDot" />
                      <span className="thinkingDot" />
                      <span>PROCESSING...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </section>

            {cameraOpen && (
              <CameraPanel
                onCapture={(image) => setImages((current) => [...current, image])}
                onClose={() => setCameraOpen(false)}
                onError={setInputError}
              />
            )}

            <Composer
              message={message}
              onChangeMessage={setMessage}
              onSend={sendMessage}
              onStop={stopGeneration}
              loading={loading}
              images={images}
              onAddImage={(image) => setImages((current) => [...current, image])}
              onRemoveImage={(index) =>
                setImages((current) => current.filter((_, i) => i !== index))
              }
              onOpenCamera={() => {
                setInputError("");
                setCameraOpen(true);
              }}
              error={inputError}
            />
          </>
        )}
      </main>
    </div>
  );
}
