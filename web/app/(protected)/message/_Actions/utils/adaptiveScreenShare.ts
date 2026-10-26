import type { LocalVideoTrack } from "livekit-client";

import { addToast } from "@heroui/toast";
import { ADAPTIVE_RESOLUTION_LADDER, ADAPTIVE_RESOLUTIONS, readStreamingMode, screenShareDegradationPreference } from "@/lib/mediaPrefs";
import type { AdaptiveResolutionTier } from "@/types/media";
import { applyScreenShareTarget } from "./screenShareSender";
import { resolveScreenShareTarget } from "./screenShareTarget";

/**
 * Off: WebRTC reports a transient "bandwidth" limit while it probes at startup,
 * which this engine would mistake for a bad link and step down from. libwebrtc
 * and LiveKit handle adaptation instead; the engine stays for a future opt-in.
 */
export const ADAPTIVE_SCREEN_SHARE_QUALITY_ENABLED = false;

/** Matches the sender stats polling interval. */
export const ADAPTIVE_POLL_INTERVAL_MS = 3000;

const STEP_DOWN_STREAK = 4; // bad polls in a row before acting
const STEP_UP_STREAK = 3; // clean polls in a row before recovering
const STEP_DOWN_COOLDOWN_MS = 10_000;
const STEP_UP_BASE_COOLDOWN_MS = 5_000;
const STEP_UP_MAX_COOLDOWN_MS = 30_000; // doubles per step down, capped here
const BANDWIDTH_BITRATE_STEP_FACTOR = 0.6; // first answer to a bandwidth limit

export type AdaptiveQualityLimitation =
  | "cpu"
  | "bandwidth"
  | "other"
  | "none"
  | "unknown";

export interface AdaptiveScreenShareState {
  configuredTier: AdaptiveResolutionTier;
  configuredFrameRate: 60;
  effectiveTierIndex: number;
  bandwidthBitrateStepActive: boolean;
  badStreak: number;
  goodStreak: number;
  lastStepDownAt: number;
  lastStepUpAt: number;
  stepUpCooldownMs: number;
  isAdapted: boolean;
  adjusting: boolean;
}

export function freshAdaptiveState(
  configuredTier: AdaptiveResolutionTier,
  configuredFrameRate: 60,
): AdaptiveScreenShareState {
  return {
    configuredTier,
    configuredFrameRate,
    effectiveTierIndex: ADAPTIVE_RESOLUTION_LADDER.indexOf(configuredTier),
    bandwidthBitrateStepActive: false,
    badStreak: 0,
    goodStreak: 0,
    lastStepDownAt: 0,
    lastStepUpAt: 0,
    stepUpCooldownMs: STEP_UP_BASE_COOLDOWN_MS,
    isAdapted: false,
    adjusting: false,
  };
}

const tierBitrate = (tier: AdaptiveResolutionTier) =>
  ADAPTIVE_RESOLUTIONS[tier].bitrate;

/** Apply a resolution, frame rate and bitrate tier to the live sender without republishing. */
async function applyTier(
  track: LocalVideoTrack,
  tier: AdaptiveResolutionTier,
  frameRate: 60,
  maxBitrate: number,
): Promise<void> {
  const sender = track.sender;

  if (!sender) return;

  const { width, height } = ADAPTIVE_RESOLUTIONS[tier];
  const captured = track.mediaStreamTrack.getSettings();
  // A screen capture can't be re-captured at a new size, so ask the encoder
  // to downscale instead.
  const scaleResolutionDownBy =
    captured.width && captured.height
      ? Math.max(1, captured.width / width, captured.height / height)
      : undefined;

  try {
    await track.mediaStreamTrack.applyConstraints({
      frameRate: { ideal: frameRate, max: frameRate },
    });
  } catch {
    // Best effort: maxFramerate below still applies.
  }

  const target = resolveScreenShareTarget({
    frameRate,
    maxBitrate,
    degradationPreference: screenShareDegradationPreference(readStreamingMode(), tier, maxBitrate),
  });

  await applyScreenShareTarget(track, target, scaleResolutionDownBy);
}

async function stepDown(
  track: LocalVideoTrack,
  state: AdaptiveScreenShareState,
  reason: AdaptiveQualityLimitation,
): Promise<void> {
  const currentTier = ADAPTIVE_RESOLUTION_LADDER[state.effectiveTierIndex];

  // A bandwidth limit first gets a lighter move: cut bitrate at the same
  // resolution. A CPU limit skips this, since a lower bitrate doesn't help.
  if (reason === "bandwidth" && !state.bandwidthBitrateStepActive) {
    const reduced = Math.max(
      100_000,
      Math.round(tierBitrate(currentTier) * BANDWIDTH_BITRATE_STEP_FACTOR),
    );

    try {
      await applyTier(track, currentTier, state.configuredFrameRate, reduced);
      state.bandwidthBitrateStepActive = true;
      state.isAdapted = true;
      state.badStreak = 0;
      state.goodStreak = 0;
      state.lastStepDownAt = Date.now();
      addToast({
        color: "warning",
        title: "Screen share quality lowered",
        description: "Bandwidth limited — reduced bitrate.",
      });
    } catch {
      // Transient (e.g. track ended mid-poll); the next bad streak retries.
    }

    return;
  }

  const nextIndex = state.effectiveTierIndex + 1;

  if (nextIndex >= ADAPTIVE_RESOLUTION_LADDER.length) {
    state.badStreak = 0; // already at the lowest tier

    return;
  }

  const nextTier = ADAPTIVE_RESOLUTION_LADDER[nextIndex];

  try {
    await applyTier(
      track,
      nextTier,
      state.configuredFrameRate,
      tierBitrate(nextTier),
    );
    state.effectiveTierIndex = nextIndex;
    state.bandwidthBitrateStepActive = false;
    state.isAdapted = true;
    state.badStreak = 0;
    state.goodStreak = 0;
    state.lastStepDownAt = Date.now();
    // Back off each time we step down again soon after stepping up.
    state.stepUpCooldownMs = Math.min(
      state.stepUpCooldownMs * 2,
      STEP_UP_MAX_COOLDOWN_MS,
    );
    addToast({
      color: "warning",
      title: "Screen share quality lowered",
      description: `Switched to ${nextTier} — ${reason === "cpu" ? "CPU limited" : "bandwidth limited"}.`,
    });
  } catch {
    // Transient; the next bad streak retries.
  }
}

async function stepUp(
  track: LocalVideoTrack,
  state: AdaptiveScreenShareState,
): Promise<void> {
  const configuredIndex = ADAPTIVE_RESOLUTION_LADDER.indexOf(
    state.configuredTier,
  );
  const recovered = () => {
    state.isAdapted = false;
    state.stepUpCooldownMs = STEP_UP_BASE_COOLDOWN_MS;
  };

  // Undo the cheaper move (bitrate) before the resolution step.
  if (state.bandwidthBitrateStepActive) {
    const currentTier = ADAPTIVE_RESOLUTION_LADDER[state.effectiveTierIndex];

    try {
      await applyTier(
        track,
        currentTier,
        state.configuredFrameRate,
        tierBitrate(currentTier),
      );
      state.bandwidthBitrateStepActive = false;
      state.goodStreak = 0;
      state.lastStepUpAt = Date.now();
      if (state.effectiveTierIndex === configuredIndex) recovered();
    } catch {
      // Transient; the next good streak retries.
    }

    return;
  }

  if (state.effectiveTierIndex <= configuredIndex) {
    recovered();
    state.goodStreak = 0;

    return;
  }

  const nextIndex = state.effectiveTierIndex - 1;
  const nextTier = ADAPTIVE_RESOLUTION_LADDER[nextIndex];

  try {
    await applyTier(
      track,
      nextTier,
      state.configuredFrameRate,
      tierBitrate(nextTier),
    );
    state.effectiveTierIndex = nextIndex;
    state.goodStreak = 0;
    state.lastStepUpAt = Date.now();
    if (nextIndex === configuredIndex) recovered();
    addToast({
      color: "success",
      title: "Screen share quality restored",
      description: `Raised to ${nextTier}.`,
    });
  } catch {
    // Transient; the next good streak retries.
  }
}

/** Feed one stats poll into the engine; steps the tier down or up when a streak is long enough. */
export async function runAdaptiveScreenShareStep(
  track: LocalVideoTrack,
  state: AdaptiveScreenShareState,
  reason: AdaptiveQualityLimitation,
): Promise<void> {
  if (state.adjusting) return;

  const now = Date.now();

  if (reason === "cpu" || reason === "bandwidth") {
    state.badStreak++;
    state.goodStreak = 0;
  } else if (reason === "none") {
    state.badStreak = 0;
    if (state.isAdapted) state.goodStreak++;
  } else {
    // "other" / "unknown": no clear signal either way.
    state.badStreak = 0;
    state.goodStreak = 0;
  }

  const shouldStepDown =
    state.badStreak >= STEP_DOWN_STREAK &&
    now - state.lastStepDownAt >= STEP_DOWN_COOLDOWN_MS;
  const shouldStepUp =
    state.isAdapted &&
    state.goodStreak >= STEP_UP_STREAK &&
    now - state.lastStepUpAt >= state.stepUpCooldownMs &&
    now - state.lastStepDownAt >= STEP_DOWN_COOLDOWN_MS;

  if (!shouldStepDown && !shouldStepUp) return;

  state.adjusting = true;
  try {
    if (shouldStepDown) await stepDown(track, state, reason);
    else await stepUp(track, state);
  } finally {
    state.adjusting = false;
  }
}
