"use client";

import { useEffect, useState } from "react";

export type MicStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "denied"
  | "error";

interface MicStreamOptions {
  open: boolean;
  wsUrl?: string;
  chunkMs?: number;
}

interface MicStreamState {
  status: MicStatus;
  error: string | null;
  analyser: AnalyserNode | null;
}

export function useMicStream({
  open,
  wsUrl,
  chunkMs = 250,
}: MicStreamOptions): MicStreamState {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    if (!open) return;

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let ws: WebSocket | null = null;
    let audioCtx: AudioContext | null = null;
    let cancelled = false;

    async function start() {
      setStatus("requesting");
      setError(null);

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "NotAllowedError") {
          setStatus("denied");
          setError("Microphone permission was denied.");
        } else {
          setStatus("error");
          setError("Couldn't access the microphone.");
        }

        return;
      }

      if (cancelled || !stream) {
        stream?.getTracks().forEach((t) => t.stop());

        return;
      }

      // Web Audio analyser drives the live waveform
      try {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const a = audioCtx.createAnalyser();

        a.fftSize = 64;
        a.smoothingTimeConstant = 0.7;
        source.connect(a);
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        setAnalyser(a);
      } catch {
        // AudioContext is best-effort — keep recording even if it fails
      }

      // WebSocket — only attempted if a URL was supplied
      if (wsUrl) {
        try {
          ws = new WebSocket(wsUrl);
          ws.binaryType = "arraybuffer";
        } catch {
          // Silent — recording continues without upload
        }
      }

      // MediaRecorder — chunks audio for upload
      const mimeType = MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus",
      )
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      try {
        recorder = new MediaRecorder(stream, { mimeType });
      } catch {
        setStatus("error");
        setError("Recording is not supported in this browser.");

        return;
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.start(chunkMs);
      setStatus("recording");
    }

    start();

    return () => {
      cancelled = true;
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        // ignore
      }
      stream?.getTracks().forEach((t) => t.stop());
      try {
        audioCtx?.close();
      } catch {
        // ignore
      }
      try {
        ws?.close();
      } catch {
        // ignore
      }
      setAnalyser(null);
      setStatus("idle");
      setError(null);
    };
  }, [open, wsUrl, chunkMs]);

  return { status, error, analyser };
}
