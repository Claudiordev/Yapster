"use client";

import * as React from "react";

const STORAGE_KEY = "webphone.audio-settings";

export interface AudioSettings {
  /** Microphone input gain, 0–100. */
  microphoneVolume: number;
  /** Selected speaker (audio output) device id. Empty string = system default. */
  speakerDeviceId: string;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  microphoneVolume: 100,
  speakerDeviceId: "",
};

export interface AudioSettingsContextValue {
  settings: AudioSettings;
  setMicrophoneVolume: (volume: number) => void;
  setSpeakerDeviceId: (deviceId: string) => void;
  updateSettings: (partial: Partial<AudioSettings>) => void;
}

const AudioSettingsContext =
  React.createContext<AudioSettingsContextValue | null>(null);

function clampVolume(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_AUDIO_SETTINGS.microphoneVolume;

  return Math.min(100, Math.max(0, Math.round(value)));
}

function readStoredSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_AUDIO_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return DEFAULT_AUDIO_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<AudioSettings>;

    return {
      microphoneVolume:
        typeof parsed.microphoneVolume === "number"
          ? clampVolume(parsed.microphoneVolume)
          : DEFAULT_AUDIO_SETTINGS.microphoneVolume,
      speakerDeviceId:
        typeof parsed.speakerDeviceId === "string"
          ? parsed.speakerDeviceId
          : DEFAULT_AUDIO_SETTINGS.speakerDeviceId,
    };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

/**
 * Provides microphone volume and speaker device selection to the whole app.
 *
 * Mounted in `app/providers.tsx` so the values are global: any component can
 * read or update them via {@link useAudioSettings}. Values are persisted to
 * localStorage and kept in sync across browser tabs.
 */
export function AudioSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = React.useState<AudioSettings>(
    DEFAULT_AUDIO_SETTINGS,
  );

  // Hydrate from localStorage on mount. Reading in an effect (rather than the
  // initial state) keeps the server-rendered markup and first client render in
  // sync, avoiding a hydration mismatch.
  React.useEffect(() => {
    setSettings(readStoredSettings());
  }, []);

  // Persist whenever the settings change.
  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable (private mode, disabled) — ignore.
    }
  }, [settings]);

  // Keep settings consistent when changed in another tab.
  React.useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setSettings(readStoredSettings());
    }

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = React.useMemo<AudioSettingsContextValue>(
    () => ({
      settings,
      setMicrophoneVolume: (volume) =>
        setSettings((current) => ({
          ...current,
          microphoneVolume: clampVolume(volume),
        })),
      setSpeakerDeviceId: (deviceId) =>
        setSettings((current) => ({ ...current, speakerDeviceId: deviceId })),
      updateSettings: (partial) =>
        setSettings((current) => {
          const next = { ...current, ...partial };

          if (partial.microphoneVolume !== undefined) {
            next.microphoneVolume = clampVolume(partial.microphoneVolume);
          }

          return next;
        }),
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
  const context = React.useContext(AudioSettingsContext);

  if (!context) {
    throw new Error(
      "useAudioSettings must be used within an AudioSettingsProvider",
    );
  }

  return context;
}
