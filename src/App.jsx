
import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8001";

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [model, setModel] = useState("auto");
  const [availableModels, setAvailableModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState("");

  const messagesEndRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedChats = localStorage.getItem("vov_chat_history");

    if (savedChats) {
      try {
        setChatHistory(JSON.parse(savedChats));
      } catch {
        setChatHistory([]);
      }
    }

    checkBackend();
    loadModels();

    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(
      "vov_chat_history",
      JSON.stringify(chatHistory)
    );
  }, [chatHistory]);

  async function checkBackend() {
    try {
      const response = await fetch(`${API_URL}/`);

      setBackendOnline(response.ok);
    } catch {
      setBackendOnline(false);
    }
  }

  async function loadModels() {
    try {
      const response = await fetch(`${API_URL}/models`);

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data.models)) {
        setAvailableModels(data.models);
        return;
      }

      if (
        data.models &&
        Array.isArray(data.models.installed)
      ) {
        setAvailableModels(data.models.installed);
        return;
      }

      if (Array.isArray(data.installed)) {
        setAvailableModels(data.installed);
      }
    } catch (error) {
      console.log("Model loading error:", error);
    }
  }

  function newChat() {
    setMessages([]);
    setMessage("");
    setCapturedImage(null);
  }

  async function sendMessage() {
    const text = message.trim();

    if (!text || loading) return;

    const userMessage = {
      role: "user",
      content: text,
      image: capturedImage,
    };

    const updatedMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedMessages);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
            model: model,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Backend error: ${response.status}`
        );
      }

      const data = await response.json();

      const assistantMessage = {
        role: "assistant",
        content:
          data.response ||
          "VOV AI did not return a response.",
        model:
          data.model ||
          (model === "auto" ? "Auto" : model),
      };

      const finalMessages = [
        ...updatedMessages,
        assistantMessage,
      ];

      setMessages(finalMessages);

      setChatHistory((previous) => {
        const title =
          text.length > 35
            ? text.substring(0, 35) + "..."
            : text;

        const newSavedChat = {
          id: Date.now(),
          title,
          messages: finalMessages,
        };

        return [
          newSavedChat,
          ...previous,
        ];
      });

      setCapturedImage(null);
    } catch (error) {
      console.error(error);

      const errorMessage = {
        role: "assistant",
        content:
          "I couldn't connect to the VOV AI backend. Make sure FastAPI is running on port 8001.",
        model: "System",
      };

      setMessages((previous) => [
        ...previous,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
      checkBackend();
    }
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }

  function openChat(chat) {
    setMessages(chat.messages || []);
    setMessage("");
  }

  function deleteHistory() {
    localStorage.removeItem("vov_chat_history");
    setChatHistory([]);
  }

  function useSuggestion(text) {
    setMessage(text);
  }

  function getModelName(item) {
    if (typeof item === "string") return item;
    if (item?.name) return item.name;
    if (item?.model) return item.model;
    return null;
  }

  /* ============================================================
     CAMERA
     ============================================================ */

  async function startCamera() {
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera is not supported by this browser."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (error) {
      console.error(error);

      setCameraError(
        "Camera permission was denied or the camera is unavailable."
      );
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  }

  function captureImage() {
    const video = videoRef.current;

    if (!video || !video.videoWidth) {
      setCameraError("Camera is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const image = canvas.toDataURL(
      "image/jpeg",
      0.88
    );

    setCapturedImage(image);
    stopCamera();
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setCameraError("Please select an image file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setCapturedImage(reader.result);
      setCameraError("");
    };

    reader.readAsDataURL(file);

    event.target.value = "";
  }

  function removeImage() {
    setCapturedImage(null);
  }

  return (
    <div className="app">

      {/* ======================================================
          SIDEBAR
          ====================================================== */}

      <aside className="sidebar">

        <div className="cyberLines" />

        <div className="brand">
          <div className="brandMark">V</div>

          <div>
            <div className="brandName">
              VOV AI
            </div>

            <div className="brandSub">
              VISUAL INTELLIGENCE
            </div>
          </div>
        </div>

        <button
          className="newChatButton"
          onClick={newChat}
        >
          <span>+</span>
          New chat
        </button>

        <div className="historyHeader">
          <span>Chat history</span>

          {chatHistory.length > 0 && (
            <button
              className="clearButton"
              onClick={deleteHistory}
            >
              Clear
            </button>
          )}
        </div>

        <div className="historyList">
          {chatHistory.length === 0 ? (
            <div className="noHistory">
              Your conversations will appear here.
            </div>
          ) : (
            chatHistory.map((chat) => (
              <button
                key={chat.id}
                className="historyItem"
                onClick={() => openChat(chat)}
              >
                <span className="historyIcon">
                  ◈
                </span>

                <span className="historyTitle">
                  {chat.title}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="sidebarBottom">
          <div className="connection">
            <span
              className={
                backendOnline
                  ? "connectionDot online"
                  : "connectionDot offline"
              }
            />

            <span>
              {backendOnline
                ? "SYSTEM ONLINE"
                : "SYSTEM OFFLINE"}
            </span>
          </div>

          <div className="localText">
            VOV AI • LOCAL CORE
          </div>
        </div>
      </aside>

      {/* ======================================================
          MAIN
          ====================================================== */}

      <main className="main">

        <div className="scanline" />

        {/* TOP BAR */}

        <header className="topBar">

          <div className="topTitle">
            <div className="statusOrb" />

            <div>
              <h1>VOV AI</h1>
              <span>VISUAL ASSISTANT // ONLINE</span>
            </div>
          </div>

          <div className="modelArea">
            <span className="modelLabel">
              CORE
            </span>

            <select
              value={model}
              onChange={(event) =>
                setModel(event.target.value)
              }
              className="modelSelect"
            >
              <option value="auto">
                AUTO
              </option>

              {availableModels.map((item) => {
                const modelName =
                  getModelName(item);

                if (!modelName) return null;

                return (
                  <option
                    key={modelName}
                    value={modelName}
                  >
                    {modelName}
                  </option>
                );
              })}
            </select>
          </div>
        </header>

        {/* ======================================================
            CHAT
            ====================================================== */}

        <section className="chatArea">

          {messages.length === 0 ? (

            <div className="welcome">

              <div className="assistantCore">

                <div className="coreRing ringOne" />
                <div className="coreRing ringTwo" />
                <div className="coreRing ringThree" />

                <div className="coreSphere">
                  V
                </div>

              </div>

              <div className="systemLabel">
                VISUAL ASSISTANT
              </div>

              <h2>
                VOV is ready.
              </h2>

              <p>
                Talk to VOV, show it an image,
                or activate your camera.
              </p>

              <div className="visionActions">

                <button
                  className="visionButton cameraButton"
                  onClick={startCamera}
                >
                  <span>◉</span>
                  Camera
                </button>

                <button
                  className="visionButton uploadButton"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  <span>▣</span>
                  Upload image
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImageUpload}
                />

              </div>

              <div className="suggestions">

                <button
                  onClick={() =>
                    useSuggestion(
                      "What can you help me with?"
                    )
                  }
                >
                  Ask VOV
                </button>

                <button
                  onClick={() =>
                    useSuggestion(
                      "Help me understand this image"
                    )
                  }
                >
                  Analyze image
                </button>

                <button
                  onClick={() =>
                    useSuggestion(
                      "Help me build something"
                    )
                  }
                >
                  Build something
                </button>

              </div>

            </div>

          ) : (

            <div className="messages">

              {messages.map((item, index) => (

                <div
                  className={`message ${
                    item.role === "user"
                      ? "userMessage"
                      : "assistantMessage"
                  }`}
                  key={index}
                >

                  <div
                    className={`messageAvatar ${
                      item.role === "user"
                        ? "userAvatar"
                        : "vovAvatar"
                    }`}
                  >
                    {item.role === "user"
                      ? "U"
                      : "V"}
                  </div>

                  <div className="messageBody">

                    <div className="messageHeader">
                      <strong>
                        {item.role === "user"
                          ? "YOU"
                          : "VOV AI"}
                      </strong>

                      {item.role ===
                        "assistant" &&
                        item.model && (
                          <span className="modelBadge">
                            {item.model}
                          </span>
                        )}
                    </div>

                    {item.image && (
                      <img
                        className="messageImage"
                        src={item.image}
                        alt="Uploaded visual"
                      />
                    )}

                    <div className="messageText">
                      {item.content}
                    </div>

                  </div>

                </div>

              ))}

              {loading && (
                <div className="message assistantMessage">

                  <div className="messageAvatar vovAvatar">
                    V
                  </div>

                  <div className="messageBody">

                    <div className="messageHeader">
                      <strong>VOV AI</strong>

                      <span className="modelBadge">
                        {model === "auto"
                          ? "AUTO"
                          : model}
                      </span>
                    </div>

                    <div className="thinking">
                      <span className="thinkingDot" />
                      <span className="thinkingDot" />
                      <span className="thinkingDot" />
                      <span>PROCESSING...</span>
                    </div>

                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />

            </div>
          )}

        </section>

        {/* ======================================================
            CAMERA PANEL
            ====================================================== */}

        {cameraOpen && (
          <div className="cameraPanel">

            <div className="cameraHeader">
              <span>
                ● LIVE VISUAL FEED
              </span>

              <button
                onClick={stopCamera}
              >
                ×
              </button>
            </div>

            <div className="cameraFrame">

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
              />

              <div className="cameraCorners" />

              <div className="cameraTarget">
                <span />
              </div>

              <div className="cameraScan" />

            </div>

            <button
              className="captureButton"
              onClick={captureImage}
            >
              <span>◎</span>
              CAPTURE
            </button>

          </div>
        )}

        {/* ======================================================
            INPUT
            ====================================================== */}

        <div className="inputContainer">

          {cameraError && (
            <div className="cameraError">
              ⚠ {cameraError}
            </div>
          )}

          {capturedImage && (
            <div className="imagePreview">

              <img
                src={capturedImage}
                alt="Selected visual"
              />

              <div className="imagePreviewInfo">
                <strong>
                  VISUAL ATTACHED
                </strong>

                <span>
                  Ready to reference in your message
                </span>
              </div>

              <button
                onClick={removeImage}
                title="Remove image"
              >
                ×
              </button>

            </div>
          )}

          <div className="inputBox">

            <button
              className="miniVisionButton"
              onClick={startCamera}
              title="Open camera"
            >
              ◉
            </button>

            <textarea
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder={
                capturedImage
                  ? "Ask VOV about this visual..."
                  : "Message VOV AI..."
              }
              rows={1}
            />

            <button
              className="sendButton"
              onClick={sendMessage}
              disabled={
                loading ||
                !message.trim()
              }
            >
              ↑
            </button>

          </div>

          <div className="inputFooter">
            <span>
              ENTER SEND • SHIFT + ENTER NEW LINE
            </span>

            <span>
              VOV VISUAL CORE
            </span>
          </div>

        </div>

      </main>
    </div>
  );
}

export default App;

