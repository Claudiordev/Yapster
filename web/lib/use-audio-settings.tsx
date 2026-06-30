"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Persisted under the same localStorage keys the settings panel has always
// used, so previously-saved choices carry over.
const INPUT_DEVICE_KEY = "audio-input-device";
const OUTPUT_DEVICE_KEY = "audio-output-device";
const INPUT_VOLUME_KEY = "audio-input-volume";
const OUTPUT_VOLUME_KEY = "audio-output-volume";

const STORAGE_KEYS = [
  INPUT_DEVICE_KEY,
  OUTPUT_DEVICE_KEY,
  INPUT_VOLUME_KEY,
  OUTPUT_VOLUME_KEY,
];

export const DEFAULT_DEVICE = "default";
const DEFAULT_VOLUME = 100;

export interface AudioSettings {
  /** Selected microphone (audio input) device id; "default" = system default. */
  inputDeviceId: string;
  /** Selected speaker (audio output) device id; "default" = system default. */
  outputDeviceId: string;
  /** Microphone input gain, 0–100. */
  inputVolume: number;
  /** Speaker output volume, 0–100. */
  outputVolume: number;
}

export interface AudioSettingsContextValue extends AudioSettings {
  setInputDeviceId: (id: string) => void;
  setOutputDeviceId: (id: string) => void;
  setInputVolume: (volume: number) => void;
  setOutputVolume: (volume: number) => void;
}

const DEFAULTS: AudioSettings = {
  inputDeviceId: DEFAULT_DEVICE,
  outputDeviceId: DEFAULT_DEVICE,
  inputVolume: DEFAULT_VOLUME,
  outputVolume: DEFAULT_VOLUME,
};

const AudioSettingsContext = createContext<AudioSettingsContextValue | null>(
  null,
);

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;

  return Math.min(100, Math.max(0, Math.round(value)));
}

function readStored(): AudioSettings {
  if (typeof window === "undefined") return DEFAULTS;

  const ls = window.localStorage;
  const inputVol = ls.getItem(INPUT_VOLUME_KEY);
  const outputVol = ls.getItem(OUTPUT_VOLUME_KEY);

  return {
    inputDeviceId: ls.getItem(INPUT_DEVICE_KEY) || DEFAULT_DEVICE,
    outputDeviceId: ls.getItem(OUTPUT_DEVICE_KEY) || DEFAULT_DEVICE,
    inputVolume:
      inputVol === null ? DEFAULT_VOLUME : clampVolume(Number(inputVol)),
    outputVolume:
      outputVol === null ? DEFAULT_VOLUME : clampVolume(Number(outputVol)),
  };
}

/**
 * Single source of truth for the user's audio preferences — microphone and
 * speaker devices plus their volumes. Mounted once in the protected layout so
 * every `useAudioSettings()` consumer (the settings panel, the call flow, the
 * mic test) shares the same values. Persisted to localStorage and kept in sync
 * across browser tabs.
 */
export function AudioSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULTS);

  // Hydrate from storage on mount. Doing this in an effect (rather than as the
  // initial state) keeps the server and first client render identical.
  useEffect(() => {
    setSettings(readStored());
  }, []);

  // Persist whenever the settings change.
  useEffect(() => {
    try {
      const ls = window.localStorage;

      ls.setItem(INPUT_DEVICE_KEY, settings.inputDeviceId);
      ls.setItem(OUTPUT_DEVICE_KEY, settings.outputDeviceId);
      ls.setItem(INPUT_VOLUME_KEY, String(settings.inputVolume));
      ls.setItem(OUTPUT_VOLUME_KEY, String(settings.outputVolume));
    } catch {
      // Storage may be unavailable (private mode / disabled) — ignore.
    }
  }, [settings]);

  // Stay consistent when another tab changes a value.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key && STORAGE_KEYS.includes(event.key)) {
        setSettings(readStored());
      }
    }

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<AudioSettingsContextValue>(
    () => ({
      ...settings,
      setInputDeviceId: (id) =>
        setSettings((s) => ({ ...s, inputDeviceId: id || DEFAULT_DEVICE })),
      setOutputDeviceId: (id) =>
        setSettings((s) => ({ ...s, outputDeviceId: id || DEFAULT_DEVICE })),
      setInputVolume: (volume) =>
        setSettings((s) => ({ ...s, inputVolume: clampVolume(volume) })),
      setOutputVolume: (volume) =>
        setSettings((s) => ({ ...s, outputVolume: clampVolume(volume) })),
    }),
    [settings],
  );

  return (
    <AudioSettingsContext.Provider value={value}>
      {children}
    </AudioSettingsContext.Provider>
  );
}

export function useAudioSettings(): AudioSettingsContextValue {
  const ctx = useContext(AudioSettingsContext);

  if (!ctx) {
    throw new Error(
      "useAudioSettings must be used within an AudioSettingsProvider",
    );
  }

  return ctx;
}
