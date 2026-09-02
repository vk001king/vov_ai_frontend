import React from "react";
import {
  Hammer,
  MessageSquare,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

export default function Sidebar({
  view,
  onChangeView,
  sessions,
  activeSessionId,
  onNewChat,
  onOpenSession,
  onDeleteSession,
  onClearSessions,
  backendOnline,
  ollamaOnline,
  modelCount,
}) {
  return (
    <aside className="sidebar">
      <div className="cyberLines" />

      <div className="brand">
        <div className="brandMark">V</div>

        <div>
          <div className="brandName">VOV AI</div>
          <div className="brandSub">LOCAL BUILD CORE</div>
        </div>
      </div>

      <div className="viewTabs">
        <button
          className={view === "chat" ? "viewTab active" : "viewTab"}
          onClick={() => onChangeView("chat")}
        >
          <MessageSquare size={14} />
          Chat
        </button>

        <button
          className={view === "builder" ? "viewTab active" : "viewTab"}
          onClick={() => onChangeView("builder")}
        >
          <Hammer size={14} />
          Builder
        </button>
      </div>

      <button className="newChatButton" onClick={onNewChat}>
        <Plus size={15} />
        New chat
      </button>

      <div className="historyHeader">
        <span>Chat history</span>

        {sessions.length > 0 && (
          <button className="clearButton" onClick={onClearSessions}>
            Clear all
          </button>
        )}
      </div>

      <div className="historyList">
        {sessions.length === 0 ? (
          <div className="noHistory">Your conversations will appear here.</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={
                session.id === activeSessionId
                  ? "historyItem active"
                  : "historyItem"
              }
            >
              <button
                className="historyOpen"
                onClick={() => onOpenSession(session.id)}
                title={session.title}
              >
                <span className="historyIcon">◈</span>

                <span className="historyTitle">{session.title}</span>

                {session.message_count > 0 && (
                  <span className="historyCount">{session.message_count}</span>
                )}
              </button>

              <button
                className="historyDelete"
                title="Delete this chat"
                onClick={() => onDeleteSession(session.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="sidebarBottom">
        <div className="connection">
          <span
            className={
              backendOnline ? "connectionDot online" : "connectionDot offline"
            }
          />

          <span>{backendOnline ? "API ONLINE" : "API OFFLINE"}</span>
        </div>

        <div className="connection">
          {ollamaOnline ? <Wifi size={12} /> : <WifiOff size={12} />}

          <span>
            {ollamaOnline ? `OLLAMA · ${modelCount} MODELS` : "OLLAMA OFFLINE"}
          </span>
        </div>

        <div className="localText">VOV AI • RUNS ENTIRELY ON YOUR MACHINE</div>
      </div>
    </aside>
  );
}
