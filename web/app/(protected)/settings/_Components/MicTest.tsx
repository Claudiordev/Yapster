"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/button";

const BAR_COUNT = 24;

/** What the browser's error means for the user, instead of one generic message. */
function micErrorMessage(error: unknown): string {
  switch ((error as { name?: string } | null)?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Allow it for this site (or app) in its permission settings, and in Windows: Settings > Privacy > Microphone.";
    case "NotFoundError":
      return "No microphone was found. Plug one in or pick another in the device list.";
    case "NotReadableError":
    case "AbortError":
      return "The microphone is in use by another app, or the system is blocking it.";
    case "OverconstrainedError":
      return "The selected microphone isn't available. Choose another one.";
    default:
      return "Couldn't access the microphone.";
  }
}

/**
 * Live microphone meter: requests the mic, runs the signal through a Web Audio
 * AnalyserNode and animates a row of bars from the frequency data, while playing
 * it back so you can hear yourself (through the chosen output device where the
 * browser allows). It always shuts down: Stop, closing settings, switching device,
 * hiding the tab, or the mic disappearing. Needs a secure context (HTTPS/localhost)
 * — getUserMedia is undefined over plain HTTP.
 */
export function MicTest({
  deviceId,
  outputId,
  inputVolume = 100,
  outputVolume = 100,
}: {
  deviceId: string;
  outputId?: string;
  /** Microphone gain, 0-200%. Moves the level bars and what you hear. */
  inputVolume?: number;
  /** Playback level of the monitor, 0-200%. */
  outputVolume?: number;
}) {
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const startingRef = useRef(false);
  // The live gain nodes, so the sliders can move while the test runs.
  const inputGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const mountedRef = useRef(true);

  function resetBars() {
    barsRef.current.forEach((el) => {
      if (el) el.style.height = "8%";
    });
  }

  function stop() {
    cleanupRef.current?.();
    cleanupRef.current = undefined;
    setTesting(false);
    resetBars();
  }

  async function start() {
    // A second press while the permission prompt is open would leave a stream running.
    if (startingRef.current || cleanupRef.current) return;

    startingRef.current = true;
    setError(null);

    const md =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;

    if (!md?.getUserMedia) {
      startingRef.current = false;
      setError("Microphone access needs a secure (HTTPS) connection.");

      return;
    }

    try {
      const stream = await md
        .getUserMedia({
          audio:
            deviceId && deviceId !== "default"
              ? { deviceId: { exact: deviceId } }
              : true,
        })
        // The chosen device can be gone (unplugged, or an id saved on another machine):
        // test the default one instead of failing.
        .catch((error: unknown) => {
          if ((error as { name?: string } | null)?.name !== "OverconstrainedError") {
            throw error;
          }

          return md.getUserMedia({ audio: true });
        });

      // Closed (or settings left) while the permission prompt was open: don't start.
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());

        return;
      }

      const ctx = new AudioContext();

      // Play through the chosen speaker where supported (Chromium); else the default.
      const sinkable = ctx as AudioContext & {
        setSinkId?: (id: string) => Promise<void>;
      };

      if (outputId && outputId !== "default" && sinkable.setSinkId) {
        await sinkable.setSinkId(outputId).catch(() => {});
      }
      if (ctx.state === "suspended") await ctx.resume();

      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(stream);
      const inputGain = ctx.createGain();
      const outputGain = ctx.createGain();

      inputGain.gain.value = inputVolume / 100;
      outputGain.gain.value = outputVolume / 100;
      inputGainRef.current = inputGain;
      outputGainRef.current = outputGain;
      analyser.fftSize = 64;
      // mic -> input volume -> meter, and on to the speakers: input volume moves both.
      source.connect(inputGain);
      inputGain.connect(analyser);
      // Hear yourself. Speakers can feed back into the mic; the hint says to use headphones.
      inputGain.connect(outputGain).connect(ctx.destination);
      // The mic vanishing (unplugged, permission revoked) ends the test too.
      stream.getAudioTracks().forEach((t) => t.addEventListener("ended", stop));

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = barsRef.current;

        for (let i = 0; i < bars.length; i++) {
          const el = bars[i];

          if (el) el.style.height = `${Math.max(8, (data[i] / 255) * 100)}%`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      tick();

      cleanupRef.current = () => {
        cancelAnimationFrame(rafRef.current);
        stream.getAudioTracks().forEach((t) => t.removeEventListener("ended", stop));
        source.disconnect();
        inputGainRef.current = null;
        outputGainRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
      setTesting(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("[mic-test] getUserMedia failed", error);
      setError(micErrorMessage(error));
    } finally {
      startingRef.current = false;
    }
  }

  // Slider moves apply immediately, mid-test.
  useEffect(() => {
    // A short ramp instead of a jump, so dragging a slider doesn't crackle.
    for (const [node, volume] of [
      [inputGainRef.current, inputVolume],
      [outputGainRef.current, outputVolume],
    ] as const) {
      node?.gain.setTargetAtTime(volume / 100, node.context.currentTime, 0.02);
    }
  }, [inputVolume, outputVolume]);

  // Closing settings (unmount) ends the test.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cleanupRef.current?.();
      cleanupRef.current = undefined;
    };
  }, []);

  // Changing the microphone or output mid-test, or leaving the tab, ends it too.
  useEffect(() => {
    if (!testing) return;

    const onHidden = () => {
      if (document.hidden) stop();
    };

    document.addEventListener("visibilitychange", onHidden);

    return () => document.removeEventListener("visibilitychange", onHidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testing]);

  useEffect(() => {
    if (cleanupRef.current) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, outputId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mic test</h2>
          <p className="text-tiny text-default-500">
            Speak to see your level and hear yourself. Use headphones to avoid echo.
          </p>
        </div>
        <Button
          className={testing ? "" : "bg-brand text-white hover:bg-brand-hover"}
          size="sm"
          variant={testing ? "flat" : "solid"}
          onPress={testing ? stop : start}
        >
          {testing ? "Stop" : "Test"}
        </Button>
      </div>

      <div className="flex h-20 items-end gap-1 rounded-medium bg-content2 p-3">
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className="flex-1 rounded-full bg-brand"
            style={{ height: "8%" }}
          />
        ))}
      </div>

      {error && <p className="text-tiny text-danger">{error}</p>}
    </div>
  );
}
