"use client";

import { useEffect, useRef, useState } from "react";

import { useAudioSettings } from "@/lib/use-audio-settings";

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

const volumeToGain = (volume: number) =>
  Math.min(100, Math.max(0, volume)) / 100;

export function useMicStream({
  open,
  wsUrl,
  chunkMs = 250,
}: MicStreamOptions): MicStreamState {
  // The microphone device and volume are global settings, shared with the
  // settings panel. Selecting a device restarts capture; changing the volume
  // is applied live through the gain node below without interrupting the call.
  const { inputDeviceId, inputVolume } = useAudioSettings();
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const inputVolumeRef = useRef(inputVolume);

  // Apply the microphone volume live (no recapture) and keep the latest value
  // available for the next capture's initial gain.
  useEffect(() => {
    inputVolumeRef.current = inputVolume;
    if (gainRef.current) {
      gainRef.current.gain.value = volumeToGain(inputVolume);
    }
  }, [inputVolume]);

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
        stream = await navigator.mediaDevices.getUserMedia({
          audio:
            inputDeviceId && inputDeviceId !== "default"
              ? { deviceId: { exact: inputDeviceId } }
              : true,
        });
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

      // Route the mic through a gain node so the saved microphone volume is
      // applied to what we record/transmit; the analyser (live waveform) reads
      // the same gained signal. Falls back to the raw stream if Web Audio fails.
      let recordStream: MediaStream = stream;

      try {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const gain = audioCtx.createGain();

        gain.gain.value = volumeToGain(inputVolumeRef.current);
        gainRef.current = gain;

        const a = audioCtx.createAnalyser();

        a.fftSize = 64;
        a.smoothingTimeConstant = 0.7;

        const dest = audioCtx.createMediaStreamDestination();

        source.connect(gain);
        gain.connect(a);
        gain.connect(dest);
        recordStream = dest.stream;

        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        setAnalyser(a);
      } catch {
        // AudioContext is best-effort — record the raw stream if it fails
        recordStream = stream;
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
        recorder = new MediaRecorder(recordStream, { mimeType });
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
      gainRef.current = null;
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
  }, [open, wsUrl, chunkMs, inputDeviceId]);

  return { status, error, analyser };
}
