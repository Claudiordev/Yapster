/**
 * The audio choices from Settings (microphone / speaker device and volume), kept in
 * localStorage. Settings announces changes so a call in progress can apply them live.
 */
export const INPUT_DEVICE_KEY = "audio-input-device";
export const OUTPUT_DEVICE_KEY = "audio-output-device";
export const INPUT_VOLUME_KEY = "audio-input-volume";
export const OUTPUT_VOLUME_KEY = "audio-output-volume";

/** 0-200% like the call volume menus; 100% leaves the sound unchanged. */
export const MAX_VOLUME = 200;

const CHANGED_EVENT = "audio-settings-changed";

function readVolume(key: string): number {
  try {
    const value = Number(localStorage.getItem(key) ?? 100);

    return Number.isFinite(value) ? Math.min(MAX_VOLUME, Math.max(0, value)) : 100;
  } catch {
    return 100;
  }
}

function readDevice(key: string): string {
  try {
    return localStorage.getItem(key) || "default";
  } catch {
    return "default";
  }
}

export const readInputVolume = () => readVolume(INPUT_VOLUME_KEY);
export const readOutputVolume = () => readVolume(OUTPUT_VOLUME_KEY);
export const readInputDevice = () => readDevice(INPUT_DEVICE_KEY);
export const readOutputDevice = () => readDevice(OUTPUT_DEVICE_KEY);

export function notifyAudioSettingsChanged(): void {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function onAudioSettingsChanged(listener: () => void): () => void {
  window.addEventListener(CHANGED_EVENT, listener);

  return () => window.removeEventListener(CHANGED_EVENT, listener);
}
