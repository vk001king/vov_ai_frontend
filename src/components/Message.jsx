import React, { useState } from "react";
import { Brain, Check, ChevronDown, ChevronRight, Copy } from "lucide-react";

import Markdown from "./Markdown.jsx";

export default function Message({ item }) {
  const [showThinking, setShowThinking] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = item.role === "user";

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(item.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={`message ${isUser ? "userMessage" : "assistantMessage"}`}>
      <div className={`messageAvatar ${isUser ? "userAvatar" : "vovAvatar"}`}>
        {isUser ? "U" : "V"}
      </div>

      <div className="messageBody">
        <div className="messageHeader">
          <strong>{isUser ? "YOU" : "VOV AI"}</strong>

          {!isUser && item.model && (
            <span className="modelBadge">{item.model}</span>
          )}

          {item.error && <span className="errorBadge">ERROR</span>}

          {!isUser && item.content && (
            <button
              className="messageCopy"
              onClick={copyMessage}
              title="Copy reply"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          )}
        </div>

        {Array.isArray(item.images) && item.images.length > 0 && (
          <div className="messageImages">
            {item.images.map((image, index) => (
              <img
                className="messageImage"
                key={index}
                src={
                  image.startsWith("data:")
                    ? image
                    : `data:image/jpeg;base64,${image}`
                }
                alt="Attached visual"
              />
            ))}
          </div>
        )}

        {!isUser && item.thinking && (
          <div className="thinkingBlock">
            <button
              className="thinkingToggle"
              onClick={() => setShowThinking((value) => !value)}
            >
              {showThinking ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}
              <Brain size={13} />
              Reasoning
            </button>

            {showThinking && (
              <div className="thinkingContent">{item.thinking}</div>
            )}
          </div>
        )}

        <div className={item.error ? "messageText messageError" : "messageText"}>
          {isUser ? item.content : <Markdown text={item.content} />}
        </div>
      </div>
    </div>
  );
}
