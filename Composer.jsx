import React, { useEffect, useRef } from "react";
import { ArrowUp, Camera, ImagePlus, Square, X } from "lucide-react";

export default function Composer({
  message,
  onChangeMessage,
  onSend,
  onStop,
  loading,
  images,
  onAddImage,
  onRemoveImage,
  onOpenCamera,
  error,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Grow with the content instead of staying stuck at one row.
  useEffect(() => {
    const node = textareaRef.current;

    if (!node) return;

    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
  }, [message]);

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  function handleFiles(event) {
    const files = Array.from(event.target.files || []);

    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => onAddImage(reader.result);
      reader.readAsDataURL(file);
    });

    event.target.value = "";
  }

  function handlePaste(event) {
    const items = Array.from(event.clipboardData?.items || []);

    items
      .filter((item) => item.type.startsWith("image/"))
      .forEach((item) => {
        const file = item.getAsFile();

        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => onAddImage(reader.result);
        reader.readAsDataURL(file);
      });
  }

  return (
    <div className="inputContainer">
      {error && <div className="cameraError">⚠ {error}</div>}

      {images.length > 0 && (
        <div className="attachmentRow">
          {images.map((image, index) => (
            <div className="attachment" key={index}>
              <img src={image} alt={`Attachment ${index + 1}`} />

              <button
                onClick={() => onRemoveImage(index)}
                title="Remove image"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          <span className="attachmentHint">
            {images.length} image{images.length > 1 ? "s" : ""} attached · sent
            with your next message
          </span>
        </div>
      )}

      <div className="inputBox">
        <button
          className="miniVisionButton"
          onClick={onOpenCamera}
          title="Open camera"
        >
          <Camera size={16} />
        </button>

        <button
          className="miniVisionButton"
          onClick={() => fileInputRef.current?.click()}
          title="Attach an image"
        >
          <ImagePlus size={16} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFiles}
        />

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(event) => onChangeMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            images.length
              ? "Ask VOV about these images..."
              : "Message VOV AI..."
          }
          rows={1}
        />

        {loading ? (
          <button className="stopButton" onClick={onStop} title="Stop">
            <Square size={14} />
          </button>
        ) : (
          <button
            className="sendButton"
            onClick={onSend}
            disabled={!message.trim() && images.length === 0}
            title="Send"
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>

      <div className="inputFooter">
        <span>ENTER SEND • SHIFT+ENTER NEW LINE • PASTE TO ATTACH</span>
        <span>VOV VISUAL CORE</span>
      </div>
    </div>
  );
}
