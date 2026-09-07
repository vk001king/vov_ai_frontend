import React, { useEffect, useRef, useState } from "react";
import { Circle, RefreshCw, X } from "lucide-react";

/* ============================================================
   Camera capture

   The original attached the stream with a setTimeout guess and
   never released tracks on unmount. This mounts the stream in an
   effect and always stops it on cleanup, so the camera light
   actually goes off.
   ============================================================ */

export default function CameraPanel({ onCapture, onClose, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [facing, setFacing] = useState("user");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onError("This browser does not support camera access.");
        onClose();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setReady(true);
      } catch {
        if (!cancelled) {
          onError(
            "Camera permission was denied, or no camera is available. " +
              "Browsers also block the camera on insecure origins other than localhost."
          );
          onClose();
        }
      }
    }

    start();

    return () => {
      cancelled = true;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facing, onClose, onError]);

  function capture() {
    const video = videoRef.current;

    if (!video?.videoWidth) {
      onError("The camera is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    onCapture(canvas.toDataURL("image/jpeg", 0.88));
    onClose();
  }

  return (
    <div className="cameraPanel">
      <div className="cameraHeader">
        <span>● LIVE VISUAL FEED {ready ? "" : "· CONNECTING"}</span>

        <div className="cameraHeaderActions">
          <button
            onClick={() =>
              setFacing((value) => (value === "user" ? "environment" : "user"))
            }
            title="Switch camera"
          >
            <RefreshCw size={14} />
          </button>

          <button onClick={onClose} title="Close camera">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="cameraFrame">
        <video ref={videoRef} autoPlay playsInline muted />

        <div className="cameraCorners" />

        <div className="cameraTarget">
          <span />
        </div>

        <div className="cameraScan" />
      </div>

      <button className="captureButton" onClick={capture} disabled={!ready}>
        <Circle size={15} />
        CAPTURE
      </button>
    </div>
  );
}
