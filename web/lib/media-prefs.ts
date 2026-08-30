"use client";

/**
 * Mic processing preferences, shared between the Settings panel (which writes
 * them) and the call (which reads them when publishing the microphone).
 *
 * These map to the browser's own getUserMedia constraints — the processing is
 * done by the browser/OS on capture, before anything is encoded or sent, so
 * turning one off genuinely disables it rather than just relabelling it.
 *
 * Stored in localStorage alongside the audio device choices. Both default ON:
 * that's what you want on a laptop with open speakers, but musicians and
 * anyone on a good headset usually want them off, since they colour the
 * signal and can clip quiet passages.
 */
export const NOISE_SUPPRESSION_KEY = "audio-noise-suppression";
export const ECHO_CANCELLATION_KEY = "audio-echo-cancellation";

export interface AudioProcessingPrefs {
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

/** Absent key = on; only an explicit "false" turns a filter off. */
function readFlag(key: string): boolean {
  if (typeof window === "undefined") return true;

  return window.localStorage.getItem(key) !== "false";
}

export function readAudioProcessingPrefs(): AudioProcessingPrefs {
  return {
    noiseSuppression: readFlag(NOISE_SUPPRESSION_KEY),
    echoCancellation: readFlag(ECHO_CANCELLATION_KEY),
  };
}

export function writeAudioProcessingPref(key: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(enabled));
}

// ── Video (screen share) ───────────────────────────────────────────────────

export const VIDEO_RESOLUTION_KEY = "video-resolution";
export const VIDEO_FRAME_RATE_KEY = "video-frame-rate";
export const SCREEN_SHARE_AUDIO_KEY = "screen-share-audio";
/** Shared default used by the settings page, in-call settings, and call hook. */
export const DEFAULT_SCREEN_SHARE_AUDIO = true;

export type VideoResolution = "720p" | "1080p" | "1440p" | "2160p";
export type VideoFrameRate = 30 | 60;

/**
 * Capture size and target bitrate per resolution.
 *
 * The bitrates are the "quality" half of the setting: resolution alone only
 * decides how many pixels are captured, and without raising the ceiling the
 * encoder just spends the same bits on more of them, which looks *worse* (soft,
 * blocky on motion). These are geared to screen content — mostly static, but
 * needing crisp text — and are roughly double what you'd use for camera video
 * at the same size. 60fps carries about 1.5x the bitrate of 30fps, since twice
 * the frames at an unchanged budget would halve the quality of each.
 */
export const VIDEO_RESOLUTIONS: Record<
  VideoResolution,
  { width: number; height: number; bitrate30: number; bitrate60: number }
> = {
  "720p": {
    width: 1280,
    height: 720,
    bitrate30: 2_500_000,
    bitrate60: 3_500_000,
  },
  "1080p": {
    width: 1920,
    height: 1080,
    bitrate30: 5_000_000,
    bitrate60: 7_500_000,
  },
  "1440p": {
    width: 2560,
    height: 1440,
    bitrate30: 9_000_000,
    bitrate60: 13_000_000,
  },
  "2160p": {
    width: 3840,
    height: 2160,
    // 4K60 screen content needs substantially more than camera video to keep
    // fine text edges legible while also retaining smooth motion.
    bitrate30: 18_000_000,
    bitrate60: 25_000_000,
  },
};

// ── Adaptive screen-share quality ───────────────────────────────────────────
//
// Extra tiers below the user-selectable ones, used only by the runtime
// step-down engine in useCall.ts when the link can't sustain the configured
// resolution -- never offered in Settings. The configured resolution above is
// the ceiling this steps down from and back up to.

export type AdaptiveResolutionTier =
  | "2160p"
  | "1440p"
  | "1080p"
  | "720p"
  | "480p"
  | "240p";

/** Highest quality first -- index order is the step-down direction. */
export const ADAPTIVE_RESOLUTION_LADDER: readonly AdaptiveResolutionTier[] = [
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "480p",
  "240p",
];

export const ADAPTIVE_RESOLUTIONS: Record<
  AdaptiveResolutionTier,
  { width: number; height: number; bitrate30: number; bitrate60: number }
> = {
  ...VIDEO_RESOLUTIONS,
  "480p": {
    width: 854,
    height: 480,
    bitrate30: 1_200_000,
    bitrate60: 1_800_000,
  },
  "240p": { width: 426, height: 240, bitrate30: 400_000, bitrate60: 600_000 },
};

export interface VideoPrefs {
  resolution: VideoResolution;
  frameRate: VideoFrameRate;
}

// Default new users to the highest built-in screen-share quality.
export const DEFAULT_VIDEO_PREFS: VideoPrefs = {
  resolution: "1440p",
  frameRate: 60,
};

/** An explicit local preference wins; absent preference defaults to enabled. */
export function readScreenShareAudioPref(): boolean {
  if (typeof window === "undefined") return DEFAULT_SCREEN_SHARE_AUDIO;

  const stored = window.localStorage.getItem(SCREEN_SHARE_AUDIO_KEY);

  return stored === null ? DEFAULT_SCREEN_SHARE_AUDIO : stored === "true";
}

export function writeScreenShareAudioPref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCREEN_SHARE_AUDIO_KEY, String(enabled));
}

export function readVideoPrefs(): VideoPrefs {
  if (typeof window === "undefined") return DEFAULT_VIDEO_PREFS;

  const resolution = window.localStorage.getItem(VIDEO_RESOLUTION_KEY);
  const frameRate = Number(window.localStorage.getItem(VIDEO_FRAME_RATE_KEY));

  return {
    resolution:
      resolution && resolution in VIDEO_RESOLUTIONS
        ? (resolution as VideoResolution)
        : DEFAULT_VIDEO_PREFS.resolution,
    frameRate:
      frameRate === 30 || frameRate === 60
        ? frameRate
        : DEFAULT_VIDEO_PREFS.frameRate,
  };
}

/** Capture constraints + publish bitrate for the current video preferences. */
export function videoCaptureSettings(prefs: VideoPrefs = readVideoPrefs()) {
  const { width, height, bitrate30, bitrate60 } =
    VIDEO_RESOLUTIONS[prefs.resolution];

  return {
    resolution: { width, height, frameRate: prefs.frameRate },
    maxBitrate: prefs.frameRate === 60 ? bitrate60 : bitrate30,
    maxFramerate: prefs.frameRate,
  };
}
