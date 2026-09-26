"use client";

import type { AdaptiveResolutionTier, AudioProcessingPrefs, VideoFrameRate, VideoPrefs, VideoResolution } from "@/types/media";

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
export const SCREEN_SHARE_AUDIO_KEY = "screen-share-audio";
/** Shared default used by the settings page, in-call settings, and call hook. */
export const DEFAULT_SCREEN_SHARE_AUDIO = true;

/**
 * Capture size and target bitrate per resolution.
 *
 * The bitrates are the "quality" half of the setting: resolution alone only
 * decides how many pixels are captured, and without raising the ceiling the
 * encoder just spends the same bits on more of them, which looks *worse* (soft,
 * blocky on motion). These are geared to screen content — mostly static, but
 * needing crisp text — and are roughly double what you'd use for camera video
 * at the same size. Every value is for 60 fps, the only frame rate offered.
 */
export const VIDEO_RESOLUTIONS: Record<
  VideoResolution,
  { width: number; height: number; bitrate: number }
> = {
  "720p": {
    width: 1280,
    height: 720,
    bitrate: 3_500_000,
  },
  "1080p": {
    width: 1920,
    height: 1080,
    bitrate: 7_500_000,
  },
  "1440p": {
    width: 2560,
    height: 1440,
    bitrate: 13_000_000,
  },
  "2160p": {
    width: 3840,
    height: 2160,
    // 4K60 screen content needs more than camera video to keep fine text edges
    // legible with smooth motion, but this is only a ceiling: 18 Mbps keeps
    // worst-case SFU traffic down (25 Mbps was the previous ceiling).
    bitrate: 18_000_000,
  },
};

// ── Adaptive screen-share quality ───────────────────────────────────────────
//
// Extra tiers below the user-selectable ones, used only by the runtime
// step-down engine in useCall.ts when the link can't sustain the configured
// resolution -- never offered in Settings. The configured resolution above is
// the ceiling this steps down from and back up to.

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
  { width: number; height: number; bitrate: number }
> = {
  ...VIDEO_RESOLUTIONS,
  "480p": {
    width: 854,
    height: 480,
    bitrate: 1_800_000,
  },
  "240p": { width: 426, height: 240, bitrate: 600_000 },
};

/** Screen share is always 60 fps; only the resolution is user-selectable. */
export const SCREEN_SHARE_FRAME_RATE: VideoFrameRate = 60;

// Default new users to 1080p; anyone who picked a resolution keeps their saved choice.
export const DEFAULT_VIDEO_PREFS: VideoPrefs = {
  resolution: "1080p",
  frameRate: SCREEN_SHARE_FRAME_RATE,
};

// ── Who may use which resolution ────────────────────────────────────────────
//
// 1440p: PREMIUM, PREMIUM_PLUS, MODERATOR, ADMIN. 2160p: PREMIUM_PLUS, MODERATOR, ADMIN.
// Everyone else is capped at 1080p. This is the UX half only (locked options, capture
// clamp): the voice service enforces the same limits from the user's *current* roles,
// so a tampered client is still cut off. Keep both in step (ScreenSharePolicy in voice).

const RESOLUTION_RANK: readonly VideoResolution[] = ["720p", "1080p", "1440p", "2160p"];

export function maxResolutionForRoles(roles: readonly string[]): VideoResolution {
  if (["ADMIN", "MODERATOR", "PREMIUM_PLUS"].some((role) => roles.includes(role))) return "2160p";
  if (roles.includes("PREMIUM")) return "1440p";

  return "1080p";
}

export function isResolutionAllowed(resolution: VideoResolution, roles: readonly string[]): boolean {
  return RESOLUTION_RANK.indexOf(resolution) <= RESOLUTION_RANK.indexOf(maxResolutionForRoles(roles));
}

/** The chosen resolution, or the best allowed one when the choice is above what the roles permit. */
export function clampResolution(resolution: VideoResolution, roles: readonly string[]): VideoResolution {
  return isResolutionAllowed(resolution, roles) ? resolution : maxResolutionForRoles(roles);
}

// Roles of the signed-in user, kept current by RolesSync. Module state because capture
// code (videoCaptureSettings) is called from non-React helpers.
let activeRoles: readonly string[] = [];

export function setScreenShareRoles(roles: readonly string[]): void {
  activeRoles = roles;
}

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

  return {
    resolution: clampResolution(
      resolution && resolution in VIDEO_RESOLUTIONS
        ? (resolution as VideoResolution)
        : DEFAULT_VIDEO_PREFS.resolution,
      activeRoles,
    ),
    // Frame rate is no longer a preference; any old stored value is ignored.
    frameRate: SCREEN_SHARE_FRAME_RATE,
  };
}

/** Capture constraints + publish bitrate for the current video preferences. */
export function videoCaptureSettings(prefs: VideoPrefs = readVideoPrefs()) {
  const { width, height, bitrate } = VIDEO_RESOLUTIONS[prefs.resolution];

  return {
    resolution: { width, height, frameRate: prefs.frameRate },
    maxBitrate: bitrate,
    maxFramerate: prefs.frameRate,
  };
}
