"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  AudioPresets,
  type LocalAudioTrack,
  type LocalTrack,
  type LocalVideoTrack,
  ParticipantEvent,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";

import { addToast } from "@heroui/toast";
import {
  onAudioSettingsChanged,
  readInputDevice,
  readInputVolume,
  readOutputDevice,
  readOutputVolume,
} from "@/lib/audioSettings";
import { MicGainProcessor } from "@/lib/micGainProcessor";
import { useSound } from "react-sounds";

import { ADAPTIVE_RESOLUTION_LADDER, ADAPTIVE_RESOLUTIONS, DEFAULT_SCREEN_SHARE_AUDIO, readAudioProcessingPrefs, readScreenShareAudioPref, readVideoPrefs, videoCaptureSettings } from "@/lib/mediaPrefs";
import type { AdaptiveResolutionTier } from "@/types/media";
import { readProblemDetail } from "@/lib/problemDetails";
import { useRealtime } from "@/lib/hooks/useRealtime";
import type { CallParticipant, ScreenShare } from "@/types/call";
import {
  clearStartBitrateTarget,
  installStartBitrateOverride,
  setStartBitrateTarget,
} from "./utils/startBitrateOverride";

/**
 * The slice of a raw WebRTC stats report the screen-share logging reads.
 * Hand-rolled because lib.dom's RTCOutboundRtpStreamStats predates the fields
 * that actually explain a starved encoder (qualityLimitationReason,
 * encoderImplementation) and has no remote-inbound entry at all.
 */
interface ScreenShareSendStats {
  type: string;
  timestamp: number;
  // outbound-rtp
  bytesSent?: number;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  targetBitrate?: number;
  keyFramesEncoded?: number;
  qualityLimitationReason?: string;
  encoderImplementation?: string;
  powerEfficientEncoder?: boolean;
  // Cumulative across the whole stream -- averaged over the interval below.
  qpSum?: number;
  framesEncoded?: number;
  // remote-inbound-rtp
  packetsLost?: number;
  roundTripTime?: number;
  // candidate-pair
  availableOutgoingBitrate?: number;
  localCandidateId?: string;
  // local-candidate
  protocol?: string;
  candidateType?: string;
}

/**
 * Loudness (0..1 RMS) above which someone counts as speaking. Low on purpose:
 * the ring should react to any real mic input, not just confident speech.
 */
const SPEAKING_RMS_THRESHOLD = 0.015;

/**
 * Keep the ring lit this long after the last frame over the threshold, so it
 * stays steady through the natural gaps between syllables instead of strobing.
 */
const SPEAKING_HOLD_MS = 250;

/** localhost, loopback, or RFC1918 — addresses that only mean "this network". */
/** Participant attribute each client sets while it is deafened, so others can show it. */
const DEAFENED_ATTRIBUTE = "deafened";

function isLocalAddress(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * The voice service builds its LiveKit URL from one server-side env var, so it
 * can only ever name a single host: pick localhost and LAN browsers can't
 * reach it, pick the LAN IP and it's wrong for anyone on the Docker host.
 *
 * When the configured host is a local/private address — i.e. it just means
 * "the machine running the stack" — retarget it at whatever host THIS browser
 * used to reach the app, keeping the configured port. Same approach as the
 * chat socket's resolveWsBase(). A genuinely remote LiveKit deployment (public
 * hostname) is left alone, since there the env var is the only source of truth.
 */
function livekitUrlForThisBrowser(serverUrl: string): string {
  if (typeof window === "undefined") return serverUrl;

  try {
    const url = new URL(serverUrl);

    if (!isLocalAddress(url.hostname)) return serverUrl;

    url.hostname = window.location.hostname;
    // Follow the page's scheme: a wss:// page can't open a ws:// socket.
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    return url.toString();
  } catch {
    return serverUrl;
  }
}

/**
 * Marks the tab as actively playing media. Chrome (and, to a lesser degree,
 * mobile Safari) exempts tabs with an active media session from most of the
 * background-tab timer/JS throttling that otherwise starves LiveKit's
 * signaling pings and gets a backgrounded call dropped -- this is the same
 * lever music/video-call web apps rely on to survive being backgrounded.
 */
function setMediaSessionActive(title: string) {
  if (typeof navigator === "undefined" || !navigator.mediaSession) return;

  navigator.mediaSession.metadata = new MediaMetadata({ title });
  navigator.mediaSession.playbackState = "playing";
}

function clearMediaSession() {
  if (typeof navigator === "undefined" || !navigator.mediaSession) return;

  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
}

// ── Adaptive screen-share quality ───────────────────────────────────────────
const ADAPTIVE_POLL_INTERVAL_MS = 3000; // matches startSenderStatsLogging's own interval
const ADAPTIVE_STEP_DOWN_STREAK = 4; // ~4 bad polls before acting -- ignore one-off blips
const ADAPTIVE_STEP_UP_STREAK = 3; // ~3 clean polls before trying to recover
const ADAPTIVE_STEP_DOWN_COOLDOWN_MS = 10_000;
const ADAPTIVE_STEP_UP_BASE_COOLDOWN_MS = 5_000;
const ADAPTIVE_STEP_UP_MAX_COOLDOWN_MS = 30_000; // doubles each step-up, caps here
const ADAPTIVE_BANDWIDTH_BITRATE_STEP_FACTOR = 0.6; // first move on a bandwidth limit: cut bitrate, not resolution

const SCREEN_SHARE_STARTUP_KEYFRAME_DELAYS_MS = [500, 1_500, 3_000] as const;

// High-quality-first by default. WebRTC reports a transient "bandwidth"
// limitation while its congestion controller is still probing at startup. An
// always-on application-level ladder mistakes that normal ramp-up for a bad
// connection, lowers the sender ceiling, and can then take 1-2 minutes to
// climb back through its cooldowns. Keep the engine available for a future
// explicit user preference, but let LiveKit/libwebrtc own adaptation for now.
const ADAPTIVE_SCREEN_SHARE_QUALITY_ENABLED = false;

type AdaptiveQualityLimitation =
  | "cpu"
  | "bandwidth"
  | "other"
  | "none"
  | "unknown";

function isAdaptiveStepDownReason(reason: AdaptiveQualityLimitation): boolean {
  return reason === "cpu" || reason === "bandwidth";
}

interface AdaptiveScreenShareState {
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

function freshAdaptiveState(
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
    stepUpCooldownMs: ADAPTIVE_STEP_UP_BASE_COOLDOWN_MS,
    isAdapted: false,
    adjusting: false,
  };
}

/** Apply a resolution/frame-rate/bitrate tier to a live screen-share sender, without republishing the track. */
async function applyAdaptiveScreenShareTier(
  track: LocalVideoTrack,
  tier: AdaptiveResolutionTier,
  frameRate: 60,
  maxBitrate: number,
): Promise<void> {
  const sender = track.sender;

  if (!sender) return;

  const { width, height } = ADAPTIVE_RESOLUTIONS[tier];
  const captured = track.mediaStreamTrack.getSettings();
  // Screen-capture tracks generally can't be re-captured at a new resolution
  // on demand (unlike a camera) -- scaleResolutionDownBy asks the ENCODER to
  // downsample from whatever was actually captured, which every browser here
  // supports without renegotiating anything.
  const scaleResolutionDownBy =
    captured.width &&
    captured.height &&
    captured.width > 0 &&
    captured.height > 0
      ? Math.max(1, captured.width / width, captured.height / height)
      : undefined;

  try {
    await track.mediaStreamTrack.applyConstraints({
      frameRate: { ideal: frameRate, max: frameRate },
    });
  } catch {
    // Best-effort -- scaleResolutionDownBy + maxFramerate below still apply.
  }
  if (typeof track.setDegradationPreference === "function") {
    await track.setDegradationPreference("maintain-resolution");
  }

  const parameters = sender.getParameters();
  const encodings = parameters.encodings?.length ? parameters.encodings : [{}];

  parameters.degradationPreference = "maintain-resolution";
  parameters.encodings = encodings.map((encoding) => ({
    ...encoding,
    ...(scaleResolutionDownBy !== undefined ? { scaleResolutionDownBy } : {}),
    // Keep the floor aligned with this tier's ceiling. If the adaptive engine
    // selects another tier later, both values move together.
    minBitrate: maxBitrate,
    maxBitrate,
    maxFramerate: frameRate,
  }));

  try {
    await sender.setParameters(parameters);
  } catch {
    parameters.encodings = parameters.encodings.map((encoding) => {
      const fallback = { ...encoding };

      delete (fallback as { minBitrate?: number }).minBitrate;

      return fallback;
    });
    await sender.setParameters(parameters);
  }
}

/**
 * Return a reused screen-capture track to the user's configured ceiling.
 *
 * LiveKit can keep the MediaStreamTrack while replacing its RTCPeerConnection
 * during a full reconnect. If the adaptive engine previously constrained that
 * track to a lower tier, the replacement publisher otherwise starts with those
 * reduced capture settings and can remain stuck there indefinitely.
 */
async function restoreConfiguredScreenShare(
  track: LocalVideoTrack,
): Promise<void> {
  const { resolution, maxFramerate } = videoCaptureSettings();

  await track.mediaStreamTrack.applyConstraints({
    width: { ideal: resolution.width, max: resolution.width },
    height: { ideal: resolution.height, max: resolution.height },
    frameRate: { ideal: maxFramerate, max: maxFramerate },
  });

  if (typeof track.setDegradationPreference === "function") {
    await track.setDegradationPreference("maintain-resolution");
  }

  await enforceConfiguredScreenShareSender(track);
}

/** Reassert the high-quality publish settings after LiveKit creates/replaces a sender. */
async function enforceConfiguredScreenShareSender(
  track: LocalVideoTrack,
): Promise<void> {
  const { maxBitrate, maxFramerate } = videoCaptureSettings();

  const sender = track.sender;

  if (!sender) throw new Error("Screen-share sender is unavailable");

  const parameters = sender.getParameters();
  const encodings = parameters.encodings?.length ? parameters.encodings : [{}];

  parameters.degradationPreference = "maintain-resolution";
  parameters.encodings = encodings.map((encoding) => {
    const restored = {
      ...encoding,
      maxBitrate,
      maxFramerate,
      // Best-effort Chromium hint. Browsers that reject the non-standard field
      // retry below with the standard max-bitrate and priority settings intact.
      // The selected resolution/frame-rate bitrate is both the requested floor
      // and ceiling (for example, 1440p60 => 13 Mbps for each).
      minBitrate: maxBitrate,
      priority: "high" as const,
      networkPriority: "high" as const,
    };

    // Omitting the field from a spread is not enough: the old encoding may
    // already contain the adaptive downscale applied before the reconnect.
    delete restored.scaleResolutionDownBy;

    return restored;
  });

  try {
    await sender.setParameters(parameters);
  } catch {
    parameters.encodings = parameters.encodings.map((encoding) => {
      const fallback = { ...encoding };

      delete (fallback as { minBitrate?: number }).minBitrate;

      return fallback;
    });
    await sender.setParameters(parameters);
  }
}

/**
 * Ask the browser encoder for a fresh intra frame without restarting capture.
 *
 * Chromium exposes this as the optional second setParameters argument. The
 * field has not reached this project's TypeScript DOM declarations yet, so the
 * narrow intersection keeps the unsupported extension contained here. Other
 * browsers may reject it; the existing stream continues normally in that case.
 */
async function requestScreenShareKeyFrame(
  track: LocalVideoTrack,
): Promise<boolean> {
  const sender = track.sender;

  if (!sender || track.mediaStreamTrack.readyState !== "live") return false;

  const parameters = sender.getParameters();
  const encodingCount = parameters.encodings?.length ?? 0;

  // The extension requires exactly one option per negotiated encoding.
  if (encodingCount === 0) return false;

  const keyFrameOptions = {
    encodingOptions: Array.from({ length: encodingCount }, () => ({
      keyFrame: true,
    })),
  } as RTCSetParameterOptions & {
    encodingOptions: Array<{ keyFrame: boolean }>;
  };

  try {
    await sender.setParameters(parameters, keyFrameOptions);

    return true;
  } catch {
    return false;
  }
}

function currentAdaptiveBitrate(state: AdaptiveScreenShareState): number {
  const tier = ADAPTIVE_RESOLUTION_LADDER[state.effectiveTierIndex];
  return ADAPTIVE_RESOLUTIONS[tier].bitrate;
}

function bitrateForTier(tier: AdaptiveResolutionTier): number {
  return ADAPTIVE_RESOLUTIONS[tier].bitrate;
}

async function stepAdaptiveScreenShareDown(
  track: LocalVideoTrack,
  state: AdaptiveScreenShareState,
  reason: AdaptiveQualityLimitation,
): Promise<void> {
  const currentTier = ADAPTIVE_RESOLUTION_LADDER[state.effectiveTierIndex];

  // Bandwidth (not CPU) limits get one lighter move first: cut the bitrate at
  // the same resolution before giving up pixels. A CPU limit wouldn't be
  // helped by a lower bitrate -- the encoder is the bottleneck, not the
  // network -- so that case skips straight to a lower tier.
  if (reason === "bandwidth" && !state.bandwidthBitrateStepActive) {
    const reducedBitrate = Math.max(
      100_000,
      Math.round(
        currentAdaptiveBitrate(state) * ADAPTIVE_BANDWIDTH_BITRATE_STEP_FACTOR,
      ),
    );

    try {
      await applyAdaptiveScreenShareTier(
        track,
        currentTier,
        state.configuredFrameRate,
        reducedBitrate,
      );
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
      // Transient failure (e.g. track ended mid-poll) -- next bad streak retries.
    }
    return;
  }

  const nextIndex = state.effectiveTierIndex + 1;

  if (nextIndex >= ADAPTIVE_RESOLUTION_LADDER.length) {
    state.badStreak = 0; // already at the floor tier, nothing lower to try

    return;
  }

  const nextTier = ADAPTIVE_RESOLUTION_LADDER[nextIndex];
  const nextBitrate = bitrateForTier(nextTier);

  try {
    await applyAdaptiveScreenShareTier(
      track,
      nextTier,
      state.configuredFrameRate,
      nextBitrate,
    );
    state.effectiveTierIndex = nextIndex;
    state.bandwidthBitrateStepActive = false;
    state.isAdapted = true;
    state.badStreak = 0;
    state.goodStreak = 0;
    state.lastStepDownAt = Date.now();
    // Back off further each time we step down again shortly after stepping
    // up -- otherwise a marginal link flaps between two tiers every ~15s.
    state.stepUpCooldownMs = Math.min(
      state.stepUpCooldownMs * 2,
      ADAPTIVE_STEP_UP_MAX_COOLDOWN_MS,
    );
    addToast({
      color: "warning",
      title: "Screen share quality lowered",
      description: `Switched to ${nextTier} — ${reason === "cpu" ? "CPU limited" : "bandwidth limited"}.`,
    });
  } catch {
    // Transient failure -- next bad streak retries.
  }
}

async function stepAdaptiveScreenShareUp(
  track: LocalVideoTrack,
  state: AdaptiveScreenShareState,
): Promise<void> {
  const configuredIndex = ADAPTIVE_RESOLUTION_LADDER.indexOf(
    state.configuredTier,
  );

  // A bitrate-only cut recovers before a resolution step -- undo the cheaper
  // move first, same order stepAdaptiveScreenShareDown applied it in.
  if (state.bandwidthBitrateStepActive) {
    const currentTier = ADAPTIVE_RESOLUTION_LADDER[state.effectiveTierIndex];
    const restoredBitrate = bitrateForTier(currentTier);

    try {
      await applyAdaptiveScreenShareTier(
        track,
        currentTier,
        state.configuredFrameRate,
        restoredBitrate,
      );
      state.bandwidthBitrateStepActive = false;
      state.goodStreak = 0;
      state.lastStepUpAt = Date.now();
      if (state.effectiveTierIndex === configuredIndex) {
        state.isAdapted = false;
        state.stepUpCooldownMs = ADAPTIVE_STEP_UP_BASE_COOLDOWN_MS;
      }
    } catch {
      // Transient failure -- next good streak retries.
    }
    return;
  }

  if (state.effectiveTierIndex <= configuredIndex) {
    // Already back at (or above, shouldn't happen) the configured ceiling.
    state.isAdapted = false;
    state.goodStreak = 0;
    state.stepUpCooldownMs = ADAPTIVE_STEP_UP_BASE_COOLDOWN_MS;

    return;
  }

  const nextIndex = state.effectiveTierIndex - 1;
  const nextTier = ADAPTIVE_RESOLUTION_LADDER[nextIndex];
  const nextBitrate = bitrateForTier(nextTier);

  try {
    await applyAdaptiveScreenShareTier(
      track,
      nextTier,
      state.configuredFrameRate,
      nextBitrate,
    );
    state.effectiveTierIndex = nextIndex;
    state.goodStreak = 0;
    state.lastStepUpAt = Date.now();
    if (nextIndex === configuredIndex) {
      state.isAdapted = false;
      state.stepUpCooldownMs = ADAPTIVE_STEP_UP_BASE_COOLDOWN_MS;
    }
    addToast({
      color: "success",
      title: "Screen share quality restored",
      description: `Raised to ${nextTier}.`,
    });
  } catch {
    // Transient failure -- next good streak retries.
  }
}

async function runAdaptiveScreenShareStep(
  track: LocalVideoTrack,
  state: AdaptiveScreenShareState,
  reason: AdaptiveQualityLimitation,
): Promise<void> {
  if (state.adjusting) return;

  const now = Date.now();

  if (isAdaptiveStepDownReason(reason)) {
    state.badStreak++;
    state.goodStreak = 0;
  } else if (reason === "none") {
    state.badStreak = 0;
    if (state.isAdapted) state.goodStreak++;
  } else {
    // "other"/"unknown" -- not a clear signal either way, don't act on it.
    state.badStreak = 0;
    state.goodStreak = 0;
  }

  if (
    state.badStreak >= ADAPTIVE_STEP_DOWN_STREAK &&
    now - state.lastStepDownAt >= ADAPTIVE_STEP_DOWN_COOLDOWN_MS
  ) {
    state.adjusting = true;
    try {
      await stepAdaptiveScreenShareDown(track, state, reason);
    } finally {
      state.adjusting = false;
    }
    return;
  }
  if (
    state.isAdapted &&
    state.goodStreak >= ADAPTIVE_STEP_UP_STREAK &&
    now - state.lastStepUpAt >= state.stepUpCooldownMs &&
    now - state.lastStepDownAt >= ADAPTIVE_STEP_DOWN_COOLDOWN_MS
  ) {
    state.adjusting = true;
    try {
      await stepAdaptiveScreenShareUp(track, state);
    } finally {
      state.adjusting = false;
    }
  }
}

interface UseCallState {
  connected: boolean;
  connecting: boolean;
  /** LiveKit is re-establishing a connection that dropped (e.g. a throttled
   *  background tab missing pings) -- still `connected`, just not live yet. */
  reconnecting: boolean;
  participants: CallParticipant[];
  muted: boolean;
  /** True while deafened: all remote audio is silenced and the mic is muted. */
  deafened: boolean;
  screenSharing: boolean;
  /** Every screen currently being shared, local and remote — one per sharer. */
  screenShares: ScreenShare[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => void;
  /**
   * Leave, unless a join happens first. Use this from an effect cleanup; use
   * `leave` for a deliberate hang-up.
   */
  scheduleLeave: () => void;
  toggleMute: () => Promise<void>;
  /** Silence everything we hear and mute our mic; press again to restore both. */
  toggleDeafen: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  /**
   * Reconnect to the call after it was moved to another server region: fresh
   * token (the backend hands out the new region's LiveKit URL), no ring or
   * leave sound for others, and a muted mic stays muted.
   */
  rejoinForServerChange: (regionName?: string) => Promise<void>;
  setParticipantVolume: (identity: string, volume: number) => void;
  toggleParticipantMute: (identity: string) => void;
  muteParticipantForEveryone: (identity: string) => Promise<boolean>;
  setScreenShareVolume: (identity: string, volume: number) => void;
  /** Play only the selected remote screen share's audio. Pass null when the
   *  expanded screen-share view is closed. */
  watchScreenShareAudio: (identity: string | null) => void;
}

/**
 * One LiveKit Room per call. The room name is always the conversation id
 * (see the voice service's membership check) -- a group call is just a DM
 * call with more members, LiveKit doesn't distinguish the two.
 */
export function useCall(conversationId: string | null): UseCallState {
  const { send, subscribe } = useRealtime();
  const roomRef = useRef<Room | null>(null);

  // Someone else arriving/leaving the call. Held in refs because the LiveKit
  // handlers below are registered once inside join() and would otherwise
  // capture the first render's play functions.
  const { play: playJoin } = useSound("ui/pop_open");
  const { play: playLeave } = useSound("ui/pop_close");
  const { play: playShareStart } = useSound("ui/success_blip", { volume: 0.5 });
  const playJoinRef = useRef(playJoin);
  const playLeaveRef = useRef(playLeave);
  const playShareStartRef = useRef(playShareStart);

  useEffect(() => {
    playJoinRef.current = playJoin;
  }, [playJoin]);
  useEffect(() => {
    playLeaveRef.current = playLeave;
  }, [playLeave]);
  useEffect(() => {
    playShareStartRef.current = playShareStart;
  }, [playShareStart]);

  // Who already got a "screen share started" blip, so a re-subscribe (reconnect,
  // renegotiation) doesn't repeat it. Shares already running when we (re)connect
  // are recorded here silently; only ones that start while we're in the call blip.
  const announcedSharesRef = useRef(new Set<string>());
  const connectedAtRef = useRef(0);
  const announceScreenShare = useCallback((identity: string, local: boolean) => {
    if (announcedSharesRef.current.has(identity)) return;

    announcedSharesRef.current.add(identity);

    const alreadyRunning = !local && Date.now() - connectedAtRef.current < 3000;

    if (!alreadyRunning) playShareStartRef.current().catch(() => {});
  }, []);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);
  const watchedScreenShareAudioRef = useRef<string | null>(null);
  const pendingScreenShareAudioTracksRef = useRef(
    new Map<string, LocalTrack | RemoteTrack>(),
  );
  const participantVolumesRef = useRef(new Map<string, number>());
  const participantAudibleVolumesRef = useRef(new Map<string, number>());
  const screenShareVolumesRef = useRef(new Map<string, number>());

  // Deafen: silences everything we hear (and mutes the mic). It works by forcing
  // every remote gain to 0, and every place that sets a gain goes through
  // `gain()`, so people who join or start sharing while deafened stay silent too.
  const [deafened, setDeafened] = useState(false);
  const deafenedRef = useRef(false);
  const micMutedBeforeDeafenRef = useRef(false);
  // Set while reconnecting to another server region: the reconnect must not
  // announce CALL_ENDED / CALL_STARTED (that would ring everyone again) or play
  // the leave sound — from everyone else's side the call just carries on.
  const silentReconnectRef = useRef(false);
  // Settings > Speaker volume: a master level on everything we hear, on top of each
  // person's own volume. Only changes our playback, never what others receive.
  const outputMasterRef = useRef(1);
  const gain = (volume: number) =>
    deafenedRef.current ? 0 : volume * outputMasterRef.current;

  useEffect(() => {
    outputMasterRef.current = readOutputVolume() / 100;
  }, []);

  const participantVolume = useCallback((identity: string) => {
    const existing = participantVolumesRef.current.get(identity);

    if (existing != null) return existing;

    const saved = localStorage.getItem(`call-volume:${identity}`);
    const stored = saved == null ? Number.NaN : Number(saved);
    const volume = Number.isFinite(stored)
      ? Math.min(200, Math.max(0, stored))
      : 100;

    participantVolumesRef.current.set(identity, volume);
    if (volume > 0) participantAudibleVolumesRef.current.set(identity, volume);

    return volume;
  }, []);

  const setParticipantVolume = useCallback(
    (identity: string, value: number) => {
      const volume = Math.round(Math.min(200, Math.max(0, value)));

      participantVolumesRef.current.set(identity, volume);
      localStorage.setItem(`call-volume:${identity}`, String(volume));
      if (volume > 0) {
        participantAudibleVolumesRef.current.set(identity, volume);
        localStorage.setItem(
          `call-volume-before-mute:${identity}`,
          String(volume),
        );
      }
      roomRef.current?.remoteParticipants
        .get(identity)
        ?.setVolume(gain(volume / 100), Track.Source.Microphone);
      setParticipants((current) =>
        current.map((participant) =>
          participant.identity === identity
            ? { ...participant, volume }
            : participant,
        ),
      );
    },
    [],
  );

  const toggleParticipantMute = useCallback(
    (identity: string) => {
      const current = participantVolume(identity);

      if (current > 0) {
        participantAudibleVolumesRef.current.set(identity, current);
        localStorage.setItem(
          `call-volume-before-mute:${identity}`,
          String(current),
        );
        setParticipantVolume(identity, 0);

        return;
      }

      const saved = Number(
        localStorage.getItem(`call-volume-before-mute:${identity}`),
      );
      const restored =
        participantAudibleVolumesRef.current.get(identity) ??
        (Number.isFinite(saved) && saved > 0 ? saved : 100);

      setParticipantVolume(identity, restored);
    },
    [participantVolume, setParticipantVolume],
  );

  const muteParticipantForEveryone = useCallback(
    async (identity: string) => {
      if (!conversationId) return false;

      try {
        const response = await fetch(
          `/api/voice/rooms/${encodeURIComponent(conversationId)}/participants/${encodeURIComponent(identity)}/mute`,
          { method: "POST" },
        );

        if (!response.ok) {
          addToast({
            title: await readProblemDetail(
              response,
              "Could not mute this participant for everyone.",
            ),
            color: "danger",
          });

          return false;
        }

        return true;
      } catch {
        addToast({
          title: "Could not mute this participant for everyone.",
          color: "danger",
        });

        return false;
      }
    },
    [conversationId],
  );

  const screenShareVolume = useCallback((identity: string) => {
    const existing = screenShareVolumesRef.current.get(identity);

    if (existing != null) return existing;

    const saved = localStorage.getItem(`screen-share-volume:${identity}`);
    const stored = saved == null ? Number.NaN : Number(saved);
    const volume = Number.isFinite(stored)
      ? Math.min(200, Math.max(0, stored))
      : 100;

    screenShareVolumesRef.current.set(identity, volume);

    return volume;
  }, []);

  /** Re-applies every remote gain (used when deafen toggles; `gain()` does the muting). */
  const applyOutputVolumes = useCallback(
    (room: Room) => {
      room.remoteParticipants.forEach((participant) => {
        participant.setVolume(
          gain(participantVolume(participant.identity) / 100),
          Track.Source.Microphone,
        );
        participant.setVolume(
          gain(
            watchedScreenShareAudioRef.current === participant.identity
              ? screenShareVolume(participant.identity) / 100
              : 0,
          ),
          Track.Source.ScreenShareAudio,
        );
      });
    },
    // `gain` only reads a ref, so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participantVolume, screenShareVolume],
  );

  const setScreenShareVolume = useCallback(
    (identity: string, value: number) => {
      const volume = Math.round(Math.min(200, Math.max(0, value)));

      screenShareVolumesRef.current.set(identity, volume);
      localStorage.setItem(`screen-share-volume:${identity}`, String(volume));
      roomRef.current?.remoteParticipants
        .get(identity)
        ?.setVolume(
          gain(watchedScreenShareAudioRef.current === identity ? volume / 100 : 0),
          Track.Source.ScreenShareAudio,
        );
      setScreenShares((current) =>
        current.map((share) =>
          share.identity === identity
            ? { ...share, audioVolume: volume }
            : share,
        ),
      );
    },
    [],
  );

  const watchScreenShareAudio = useCallback(
    (identity: string | null) => {
      const room = roomRef.current;
      const previouslyWatched = watchedScreenShareAudioRef.current;

      if (room && previouslyWatched && previouslyWatched !== identity) {
        const previousParticipant =
          room.remoteParticipants.get(previouslyWatched);
        const previousPublication = previousParticipant?.getTrackPublication(
          Track.Source.ScreenShareAudio,
        );

        previousParticipant?.setVolume(0, Track.Source.ScreenShareAudio);
        previousPublication?.setEnabled(false);
        previousPublication?.setSubscribed(false);
      }

      watchedScreenShareAudioRef.current = identity;

      if (identity) {
        // Screen audio is a separate LiveKit publication from screen video.
        // Explicitly subscribe and enable it when the viewer chooses a stream,
        // matching the screen-share subscription flow used by Fluxer.
        const remotePublication = room?.remoteParticipants
          .get(identity)
          ?.getTrackPublication(Track.Source.ScreenShareAudio);
        const localPublication =
          room?.localParticipant.identity === identity
            ? room.localParticipant.getTrackPublication(
                Track.Source.ScreenShareAudio,
              )
            : undefined;

        if (!remotePublication && !localPublication) {
          setError(
            "This screen share is not publishing an audio track. The sender must restart the share, select the YouTube tab, and enable Share tab audio.",
          );
        } else {
          setError(null);
        }

        room?.remoteParticipants
          .get(identity)
          ?.setVolume(
            gain(screenShareVolume(identity) / 100),
            Track.Source.ScreenShareAudio,
          );
        remotePublication?.setSubscribed(true);
        remotePublication?.setEnabled(true);

        // Called directly by the Watch button, so LiveKit can unlock its audio
        // context while the browser still considers this a user gesture. This
        // also lets a screen-audio track that subscribes slightly later play.
        void room?.startAudio().catch((playbackError) => {
          // eslint-disable-next-line no-console
          console.warn("Could not enable call audio", playbackError);
        });
      }
    },
    [screenShareVolume],
  );

  // Our OWN mic is analysed here in the browser rather than via LiveKit's
  // participant.isSpeaking, which comes from the server's audio-level observer
  // -- that only reports every ~400ms and ignores anything under a loudness
  // threshold, so quiet or short input never lit the ring.
  //
  // Deliberately local-only: routing a *remote* WebRTC track through Web Audio
  // is a long-standing source of choppy/dropping playback in Chrome, and it's
  // the same track the <audio> element is playing. Remote participants use
  // LiveKit's isSpeaking instead -- slightly coarser, but it can't break their
  // audio.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef(
    new Map<
      string,
      { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }
    >(),
  );

  /**
   * Guards against two joins running at once. `roomRef` alone isn't enough:
   * it's only assigned after `connect()` resolves, so a second join starting
   * during that await would sail past the check and open a SECOND connection
   * with the same identity — LiveKit then kicks one as a duplicate, which
   * tears down the publisher's data channels and makes publishing fail with
   * "engine not connected within timeout". React 18's StrictMode does exactly
   * this in dev by double-invoking effects.
   *
   * `joiningRef` blocks the overlap; the token lets `leave()` disown a join
   * that's still in flight, so its room gets disconnected instead of stranded.
   */
  const joiningRef = useRef(false);
  const joinTokenRef = useRef(0);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addAnalyser = useCallback(
    (identity: string, track: MediaStreamTrack) => {
      try {
        const ctx =
          audioCtxRef.current ?? (audioCtxRef.current = new AudioContext());

        if (ctx.state === "suspended") ctx.resume().catch(() => {});

        analysersRef.current.get(identity)?.source.disconnect();

        const source = ctx.createMediaStreamSource(new MediaStream([track]));
        const analyser = ctx.createAnalyser();

        // 256 matches the sample buffer in the rAF loop below; small window so
        // the reading tracks the signal closely rather than averaging it away.
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.2;
        // Analyser only -- deliberately NOT connected to ctx.destination, which
        // would play remote audio a second time on top of the <audio> elements.
        source.connect(analyser);

        analysersRef.current.set(identity, { analyser, source });
      } catch {
        // Web Audio unavailable -- the ring just won't light; the call is fine.
      }
    },
    [],
  );

  const refreshParticipants = useCallback(
    (room: Room) => {
      const local = room.localParticipant;

      setParticipants([
        {
          identity: local.identity,
          isLocal: true,
          isSpeaking: false, // ours is filled in from the analyser on the way out
          isMuted: !local.isMicrophoneEnabled,
          isDeafened: deafenedRef.current,
          volume: 100,
        },
        ...Array.from(room.remoteParticipants.values()).map((p) => ({
          identity: p.identity,
          isLocal: false,
          isSpeaking: p.isSpeaking,
          isMuted: !p.isMicrophoneEnabled,
          isDeafened: p.attributes[DEAFENED_ATTRIBUTE] === "true",
          volume: participantVolume(p.identity),
        })),
      ]);
    },
    [participantVolume],
  );

  // ── Settings > audio applied to the call ───────────────────────────────────
  // Microphone volume rides on a LiveKit processor; devices go through LiveKit's own
  // switchActiveDevice. All of it re-applies live when Settings changes.
  const micGainRef = useRef<MicGainProcessor | null>(null);
  const appliedDevicesRef = useRef<{ input?: string; output?: string }>({});

  const attachMicGain = useCallback(async (track: LocalAudioTrack) => {
    const volume = readInputVolume() / 100;

    // At 100% (the default) the mic goes out untouched, with no processing in the way.
    if (volume === 1 && !micGainRef.current) return;

    try {
      const ctx =
        audioCtxRef.current ?? (audioCtxRef.current = new AudioContext());

      if (ctx.state === "suspended") await ctx.resume().catch(() => {});

      track.setAudioContext(ctx);

      const processor = new MicGainProcessor(volume);

      await track.setProcessor(processor);
      micGainRef.current = processor;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Could not apply the microphone volume", error);
    }
  }, []);

  const applyAudioSettings = useCallback(
    (room: Room, initial = false) => {
      outputMasterRef.current = readOutputVolume() / 100;
      applyOutputVolumes(room);

      const output = readOutputDevice();

      if (output !== (appliedDevicesRef.current.output ?? "default")) {
        appliedDevicesRef.current.output = output;
        void room.switchActiveDevice("audiooutput", output).catch(() => {});
      }

      // On join the mic is published with the saved device and volume already.
      if (initial) return;

      const input = readInputDevice();

      if (input !== (appliedDevicesRef.current.input ?? "default")) {
        appliedDevicesRef.current.input = input;
        void room.switchActiveDevice("audioinput", input).catch(() => {});
      }

      const volume = readInputVolume() / 100;

      if (micGainRef.current) {
        micGainRef.current.setGain(volume);
      } else if (volume !== 1) {
        const track = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.track as LocalAudioTrack | undefined;

        if (track) void attachMicGain(track);
      }
    },
    [applyOutputVolumes, attachMicGain],
  );

  useEffect(
    () =>
      onAudioSettingsChanged(() => {
        const room = roomRef.current;

        if (room) applyAudioSettings(room);
        else outputMasterRef.current = readOutputVolume() / 100;
      }),
    [applyAudioSettings],
  );

  // Tell the room whether we're deafened (an empty value clears the attribute).
  // Needs the token's canUpdateOwnMetadata grant; without it others just don't see it.
  useEffect(() => {
    const room = roomRef.current;

    if (!room || !connected) return;

    room.localParticipant
      .setAttributes({ [DEAFENED_ATTRIBUTE]: deafened ? "true" : "" })
      .catch(() => {});
    refreshParticipants(room);
  }, [deafened, connected, refreshParticipants]);

  // Keyed by identity: one share per participant, and re-sharing replaces the
  // previous entry rather than stacking up.
  const addScreenShare = useCallback(
    (identity: string, track: LocalTrack | RemoteTrack) => {
      const audioTrack = pendingScreenShareAudioTracksRef.current.get(identity);

      setScreenShares((prev) => [
        ...prev.filter((s) => s.identity !== identity),
        {
          identity,
          track,
          audioTrack,
          audioVolume: screenShareVolume(identity),
        },
      ]);
    },
    [screenShareVolume],
  );

  const addScreenShareAudio = useCallback(
    (identity: string, audioTrack: LocalTrack | RemoteTrack) => {
      pendingScreenShareAudioTracksRef.current.set(identity, audioTrack);
      setScreenShares((prev) =>
        prev.map((share) =>
          share.identity === identity ? { ...share, audioTrack } : share,
        ),
      );
    },
    [],
  );

  const removeScreenShareAudio = useCallback((identity: string) => {
    pendingScreenShareAudioTracksRef.current.delete(identity);
    setScreenShares((prev) =>
      prev.map((share) => {
        if (share.identity !== identity) return share;

        const { audioTrack: _audioTrack, ...videoShare } = share;

        return videoShare;
      }),
    );
  }, []);

  const removeScreenShare = useCallback((identity: string) => {
    announcedSharesRef.current.delete(identity);
    pendingScreenShareAudioTracksRef.current.delete(identity);
    setScreenShares((prev) => prev.filter((s) => s.identity !== identity));
  }, []);

  const screenAudioEnabledRef = useRef(DEFAULT_SCREEN_SHARE_AUDIO);

  useEffect(() => {
    screenAudioEnabledRef.current = readScreenShareAudioPref();
  }, []);

  // Periodic console logging of actual (not requested) screen-share quality,
  // keyed so both a local send stream and any number of remote receive
  // streams can run side by side without clobbering each other's bitrate math.
  const screenShareStatsTimersRef = useRef(
    new Map<string, ReturnType<typeof setInterval>>(),
  );
  const screenShareStartupKeyFrameTimersRef = useRef(
    new Map<string, Set<ReturnType<typeof setTimeout>>>(),
  );
  const prevScreenShareBytesRef = useRef(
    new Map<
      string,
      { bytes: number; at: number; qpSum?: number; framesEncoded?: number }
    >(),
  );
  // What we actually asked the capture for, stashed right before
  // setScreenShareEnabled so the LocalTrackPublished handler -- which only
  // gets the resulting track, not what toggleScreenShare requested -- can log
  // requested vs. actual side by side.
  const requestedScreenShareSettingsRef = useRef<{
    width: number;
    height: number;
    frameRate: number;
    maxBitrate: number;
  } | null>(null);

  // Only one local screen-share sender exists at a time, so a single slot
  // (not keyed like the stats maps above) is enough. Null = not adapting,
  // either because no share is live or adaptiveScreenShareEngine hasn't
  // started for the current one yet.
  const adaptiveScreenShareRef = useRef<AdaptiveScreenShareState | null>(null);
  const recoveringScreenShareRef = useRef(false);

  const stopScreenShareStatsLogging = useCallback((key: string) => {
    const timer = screenShareStatsTimersRef.current.get(key);
    const keyFrameTimers = screenShareStartupKeyFrameTimersRef.current.get(key);

    if (timer) {
      clearInterval(timer);
      screenShareStatsTimersRef.current.delete(key);
    }
    keyFrameTimers?.forEach((keyFrameTimer) => clearTimeout(keyFrameTimer));
    screenShareStartupKeyFrameTimersRef.current.delete(key);
    prevScreenShareBytesRef.current.delete(key);
    if (key.startsWith("send:")) adaptiveScreenShareRef.current = null;
  }, []);

  const startSenderStatsLogging = useCallback(
    (track: LocalVideoTrack) => {
      const key = `send:${track.sid ?? "local-screen"}`;

      stopScreenShareStatsLogging(key);

      const requested = requestedScreenShareSettingsRef.current;
      const actual = track.mediaStreamTrack.getSettings();

      // eslint-disable-next-line no-console
      console.info("[screen-share] capture started", {
        requested: requested
          ? `${requested.width}x${requested.height}@${requested.frameRate}fps, ceiling ${Math.round(requested.maxBitrate / 1000)}kbps`
          : "unknown",
        actual: `${actual.width}x${actual.height}@${actual.frameRate}fps`,
      });

      // Seed the optional adaptive watcher from the same preferences the
      // capture itself was built from.
      const configuredPrefs = readVideoPrefs();

      adaptiveScreenShareRef.current = ADAPTIVE_SCREEN_SHARE_QUALITY_ENABLED
        ? freshAdaptiveState(
            configuredPrefs.resolution as AdaptiveResolutionTier,
            configuredPrefs.frameRate,
          )
        : null;

      // LiveKit already applies these at publish time. Reassert them on the
      // concrete sender as well so renegotiation or browser defaults cannot
      // leave a lower ceiling/priority behind. Each startup keyframe waits for
      // this promise so setParameters calls cannot race one another.
      const senderConfigured = enforceConfiguredScreenShareSender(track).then(
        () => {
          const requestedBitrate = videoCaptureSettings().maxBitrate;
          const appliedEncoding = track.sender?.getParameters()
            .encodings?.[0] as
            | (RTCRtpEncodingParameters & { minBitrate?: number })
            | undefined;

          // eslint-disable-next-line no-console
          console.info("[screen-share] sender bitrate configured", {
            requestedMinKbps: Math.round(requestedBitrate / 1000),
            requestedMaxKbps: Math.round(requestedBitrate / 1000),
            appliedMinKbps: appliedEncoding?.minBitrate
              ? Math.round(appliedEncoding.minBitrate / 1000)
              : undefined,
            appliedMaxKbps: appliedEncoding?.maxBitrate
              ? Math.round(appliedEncoding.maxBitrate / 1000)
              : undefined,
          });

          return true;
        },
        (error: unknown) => {
          // eslint-disable-next-line no-console
          console.warn(
            "[screen-share] could not enforce sender settings",
            error,
          );

          return false;
        },
      );
      const keyFrameTimers = new Set<ReturnType<typeof setTimeout>>();

      screenShareStartupKeyFrameTimersRef.current.set(key, keyFrameTimers);
      SCREEN_SHARE_STARTUP_KEYFRAME_DELAYS_MS.forEach((delayMs) => {
        const timer = setTimeout(() => {
          keyFrameTimers.delete(timer);
          if (keyFrameTimers.size === 0) {
            screenShareStartupKeyFrameTimersRef.current.delete(key);
          }

          void senderConfigured.then(async (configured) => {
            if (!configured) return;

            const requestedKeyFrame = await requestScreenShareKeyFrame(track);

            if (requestedKeyFrame) {
              // eslint-disable-next-line no-console
              console.info("[screen-share] startup keyframe requested", {
                afterMs: delayMs,
              });
            }
          });
        }, delayMs);

        keyFrameTimers.add(timer);
      });

      screenShareStatsTimersRef.current.set(
        key,
        setInterval(async () => {
          // The raw report rather than track.getSenderStats(): a share that's
          // sending far less than its ceiling has three quite different causes
          // -- a CPU-bound encoder, a collapsed bandwidth estimate, or plain
          // packet loss -- and only the full report carries the numbers that
          // tell them apart. getSenderStats() drops all three.
          const report = await track.sender?.getStats();

          if (!report) return;

          let outbound: ScreenShareSendStats | undefined;
          let remoteInbound: ScreenShareSendStats | undefined;
          let candidatePair: ScreenShareSendStats | undefined;

          report.forEach((entry: ScreenShareSendStats) => {
            // Highest-resolution outbound-rtp wins, matching what a viewer sees.
            if (
              entry.type === "outbound-rtp" &&
              (!outbound ||
                (entry.frameWidth ?? 0) > (outbound.frameWidth ?? 0))
            ) {
              outbound = entry;
            }
            if (entry.type === "remote-inbound-rtp") remoteInbound = entry;
            // availableOutgoingBitrate is only populated on the selected pair.
            if (
              entry.type === "candidate-pair" &&
              entry.availableOutgoingBitrate !== undefined
            ) {
              candidatePair = entry;
            }
          });

          if (!outbound) return;

          // Which candidate actually won ICE. Media on TCP is the single most
          // common reason a link that can clearly carry the bitrate refuses to:
          // congestion control reads TCP's head-of-line stalls as congestion and
          // parks the estimate low, so the encoder never gets to spend the
          // ceiling no matter how large it is.
          const localCandidate = candidatePair?.localCandidateId
            ? (report.get(candidatePair.localCandidateId) as
                | ScreenShareSendStats
                | undefined)
            : undefined;

          const now = outbound.timestamp;
          const prev = prevScreenShareBytesRef.current.get(key);
          const bitrateKbps =
            prev && outbound.bytesSent !== undefined && now > prev.at
              ? Math.round(
                  ((outbound.bytesSent - prev.bytes) * 8) / (now - prev.at),
                )
              : undefined;

          // Quantiser averaged over this interval, not the stream's lifetime.
          // This is the number that means "quality": for H.264 roughly <30 is
          // clean, >40 is visibly blocky. High QP at full resolution and frame
          // rate is precisely what a starved bit supply looks like.
          const framesDelta =
            (outbound.framesEncoded ?? 0) - (prev?.framesEncoded ?? 0);
          const avgQp =
            prev &&
            framesDelta > 0 &&
            outbound.qpSum !== undefined &&
            prev.qpSum !== undefined
              ? Math.round((outbound.qpSum - prev.qpSum) / framesDelta)
              : undefined;

          prevScreenShareBytesRef.current.set(key, {
            bytes: outbound.bytesSent ?? 0,
            at: now,
            qpSum: outbound.qpSum,
            framesEncoded: outbound.framesEncoded,
          });

          // eslint-disable-next-line no-console
          console.info("[screen-share] sending", {
            resolution: `${outbound.frameWidth ?? "?"}x${outbound.frameHeight ?? "?"}`,
            fps: outbound.framesPerSecond,
            targetKbps: outbound.targetBitrate
              ? Math.round(outbound.targetBitrate / 1000)
              : undefined,
            actualKbps: bitrateKbps,
            keyFramesEncoded: outbound.keyFramesEncoded,
            // What congestion control currently thinks the link will carry. If
            // THIS is small, the ceiling and the encoder are innocent -- the
            // estimate collapsed and the network path is the thing to look at.
            estimateKbps: candidatePair?.availableOutgoingBitrate
              ? Math.round(candidatePair.availableOutgoingBitrate / 1000)
              : undefined,
            avgQp,
            qualityLimitationReason: outbound.qualityLimitationReason,
            transport: localCandidate
              ? `${localCandidate.protocol ?? "?"}/${localCandidate.candidateType ?? "?"}`
              : undefined,
            // "cpu" here (or a software encoder name) means H.264 didn't get a
            // hardware encode path and we're back to burning one core per frame.
            encoder: outbound.encoderImplementation,
            powerEfficient: outbound.powerEfficientEncoder,
            packetsLost: remoteInbound?.packetsLost,
            rttMs: remoteInbound?.roundTripTime
              ? Math.round(remoteInbound.roundTripTime * 1000)
              : undefined,
          });

          const adaptiveState = adaptiveScreenShareRef.current;

          if (adaptiveState) {
            void runAdaptiveScreenShareStep(
              track,
              adaptiveState,
              outbound.qualityLimitationReason as AdaptiveQualityLimitation,
            );
          }
        }, ADAPTIVE_POLL_INTERVAL_MS),
      );
    },
    [stopScreenShareStatsLogging],
  );

  const startReceiverStatsLogging = useCallback(
    (track: RemoteVideoTrack, identity: string) => {
      const key = `recv:${identity}:${track.sid ?? ""}`;

      stopScreenShareStatsLogging(key);

      screenShareStatsTimersRef.current.set(
        key,
        setInterval(async () => {
          const stats = await track.getReceiverStats();

          if (!stats) return;

          const now = stats.timestamp;
          const prev = prevScreenShareBytesRef.current.get(key);
          const bitrateKbps =
            prev && stats.bytesReceived !== undefined && now > prev.at
              ? Math.round(
                  ((stats.bytesReceived - prev.bytes) * 8) / (now - prev.at),
                )
              : undefined;

          prevScreenShareBytesRef.current.set(key, {
            bytes: stats.bytesReceived ?? 0,
            at: now,
          });

          const framesDecoded = stats.framesDecoded;
          const decoderImplementation = stats.decoderImplementation;

          // eslint-disable-next-line no-console
          console.info(`[screen-share] receiving from ${identity}`, {
            resolution: `${stats.frameWidth ?? "?"}x${stats.frameHeight ?? "?"}`,
            framesDecoded,
            framesDropped: stats.framesDropped,
            actualKbps: bitrateKbps,
            decoderImplementation,
          });
        }, 3000),
      );
    },
    [stopScreenShareStatsLogging],
  );

  const stopAllScreenShareStatsLogging = useCallback(() => {
    screenShareStatsTimersRef.current.forEach((timer) => clearInterval(timer));
    screenShareStatsTimersRef.current.clear();
    screenShareStartupKeyFrameTimersRef.current.forEach((timers) =>
      timers.forEach((timer) => clearTimeout(timer)),
    );
    screenShareStartupKeyFrameTimersRef.current.clear();
    prevScreenShareBytesRef.current.clear();
    adaptiveScreenShareRef.current = null;
  }, []);

  const setConfiguredScreenShareEnabled = useCallback(
    async (
      room: Room,
      enabled: boolean,
      includeAudio = screenAudioEnabledRef.current,
    ) => {
      const { resolution, maxBitrate, maxFramerate } = videoCaptureSettings();

      requestedScreenShareSettingsRef.current = enabled
        ? {
            width: resolution.width,
            height: resolution.height,
            frameRate: maxFramerate,
            maxBitrate,
          }
        : null;

      // The track (and its id) is gone once disabled, so grab it first if we'll need
      // to clear its forced start-bitrate target below.
      const outgoingTrackId = enabled
        ? undefined
        : (
            room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
              ?.track as LocalVideoTrack | undefined
          )?.mediaStreamTrack.id;

      await room.localParticipant.setScreenShareEnabled(
        enabled,
        {
          resolution,
          // Use the high-motion encoder path so games and video can ramp to the
          // selected bitrate. Timed startup keyframes above still refresh a
          // static document after WebRTC's initial bandwidth estimate rises.
          contentHint: "motion",
          // Ask Chromium for the selected source's audio. Chrome still
          // requires the user to select "Share tab audio" in its picker.
          // `restrictOwnAudio` is the capture hint used by the known-working
          // screen-share implementation and prevents the tab from receiving
          // an unintended copy of the local call audio.
          audio: includeAudio
            ? {
                // Screen audio is music/media, not speech. Avoid voice
                // processing and request the browser's native stereo 48 kHz
                // capture where supported.
                restrictOwnAudio: { ideal: true },
                channelCount: 2,
                sampleRate: 48_000,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
          systemAudio: includeAudio ? "include" : "exclude",
          suppressLocalAudioPlayback: false,
        },
        {
          screenShareEncoding: { maxBitrate, maxFramerate, priority: "high" },
          // The default music preset is 48 kbps. Screen/tab audio benefits
          // from the higher Opus ceiling, especially for games and video.
          audioPreset: AudioPresets.musicHighQualityStereo,
          forceStereo: true,
          dtx: false,
          red: true,
          // Keep screen video and screen audio in the same MediaStream for
          // better A/V synchronization on subscribers.
          stream: "screen-share",
          // VP8: unlike H264, Chrome negotiates it as one payload type per m= section
          // (no profile-level-id/packetization-mode fragmentation), so the start-bitrate
          // hint can't land on an unused sibling payload the way it did with H264.
          videoCodec: "vp9",
          backupCodec: false,
          simulcast: true,
          // Matches the fix in LiveKit's own SDKs (client-sdk-swift #1050/#1121): under
          // constraint, prefer dropping frames over resolution, so shared text/UI stays
          // sharp instead of blurring. The reviewer noted this mattered more than the
          // start-bitrate hint for their reported case.
          degradationPreference: "maintain-resolution",
        },
      );

      // livekit-client already hints ~90% of maxBitrate as the WebRTC start bitrate;
      // this forces the full target instead. Still only a hint -- Chromium's own
      // congestion controller can lower the actual send rate if the network can't
      // sustain it (see startBitrateOverride.ts for the mechanism and its limits).
      const screenTrack = room.localParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      )?.track as LocalVideoTrack | undefined;

      if (enabled && screenTrack) {
        // "vp8" here matches the videoCodec passed to setScreenShareEnabled above --
        // must stay in sync so the right SDP payload types get the hint.
        setStartBitrateTarget(screenTrack.mediaStreamTrack.id, "vp9", maxBitrate / 1000);
      } else if (outgoingTrackId) {
        clearStartBitrateTarget(outgoingTrackId);
      }
    },
    [],
  );

  /** Restore an adaptively reduced share after LiveKit replaces its publisher. */
  const recoverScreenShareAfterReconnect = useCallback(
    async (room: Room) => {
      if (recoveringScreenShareRef.current) return;

      const publication = room.localParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      );
      const track = publication?.track as LocalVideoTrack | undefined;

      if (!track) return;

      recoveringScreenShareRef.current = true;
      try {
        try {
          await restoreConfiguredScreenShare(track);
          startSenderStatsLogging(track);
        } catch (error) {
          // A full LiveKit restart can leave the LocalTrack pointing at a sender
          // created by the discarded RTCPeerConnection. Reacquiring is the only
          // safe recovery in that case; the browser may show its share picker
          // again, which is preferable to silently publishing a broken 240p
          // sender forever.
          console.warn(
            "Could not restore the screen share after reconnect; reacquiring it",
            error,
          );
          await setConfiguredScreenShareEnabled(room, false);
          await setConfiguredScreenShareEnabled(room, true);
        }
      } catch (error) {
        console.error(
          "Could not recover the screen share after reconnect",
          error,
        );
        setScreenSharing(false);
        addToast({
          color: "warning",
          title: "Screen share stopped",
          description:
            "The connection recovered, but screen sharing must be started again.",
        });
      } finally {
        recoveringScreenShareRef.current = false;
      }
    },
    [setConfiguredScreenShareEnabled, startSenderStatsLogging],
  );

  const teardownAudio = useCallback(() => {
    analysersRef.current.forEach(({ source }) => {
      try {
        source.disconnect();
      } catch {
        // already torn down
      }
    });
    analysersRef.current.clear();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    micGainRef.current = null;
    appliedDevicesRef.current = {};
  }, []);

  /**
   * Turn the mic on, retrying briefly.
   *
   * Publishing needs the publisher transport up, which races `connect()`
   * resolving — LiveKit rejects with "engine not connected within timeout" if
   * it isn't ready, and its data channels can be torn down and rebuilt while
   * the transport settles. That's transient, so a couple of spaced attempts
   * clears it; returns false only if the mic genuinely won't start.
   */
  const publishMic = useCallback(async (room: Room) => {
    const prefs = readAudioProcessingPrefs();
    const savedDevice = readInputDevice();
    const options = {
      noiseSuppression: prefs.noiseSuppression,
      echoCancellation: prefs.echoCancellation,
      autoGainControl: true,
      // `ideal`, so a device that's gone falls back to the default instead of failing.
      ...(savedDevice !== "default" ? { deviceId: { ideal: savedDevice } } : {}),
    };

    appliedDevicesRef.current.input = savedDevice;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      // Bail out if the call ended while we were waiting to retry.
      if (room.state === ConnectionState.Disconnected) return false;

      try {
        await room.localParticipant.setMicrophoneEnabled(true, options);

        return true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`Mic publish attempt ${attempt + 1} failed`, err);
      }
    }

    return false;
  }, []);

  const leave = useCallback(() => {
    // Invalidate any join still awaiting connect() -- see joinTokenRef.
    joinTokenRef.current += 1;
    // ...and release the in-flight claim, so a join that comes straight after
    // this (React's mount → cleanup → mount in StrictMode) isn't blocked by
    // the one we just cancelled. Without this the remount's join bails out and
    // the cancelled one disconnects, leaving no connection at all.
    joiningRef.current = false;

    const room = roomRef.current;

    roomRef.current = null;

    if (room) {
      room.disconnect();
      // Only announce leaving a call we actually joined; a cancelled join
      // never told anyone it had started.
      if (conversationId && !silentReconnectRef.current) {
        send({ type: "CALL_ENDED", conversationId });
      }
      if (!silentReconnectRef.current) playLeaveRef.current().catch(() => {});
    }

    teardownAudio();
    stopAllScreenShareStatsLogging();
    clearMediaSession();
    setConnected(false);
    setReconnecting(false);
    setParticipants([]);
    setSpeakingIds([]);
    setScreenSharing(false);
    setScreenShares([]);
    setMuted(false);
    deafenedRef.current = false;
    setDeafened(false);
  }, [conversationId, send, teardownAudio, stopAllScreenShareStatsLogging]);

  /**
   * Deferred teardown for effect cleanups.
   *
   * React StrictMode mounts → unmounts → mounts in dev. Leaving synchronously
   * on that throwaway unmount meant the whole call was rebuilt: a second token
   * fetch, a second connect(), a briefly duplicated identity in LiveKit and a
   * spurious connection error from the copy being discarded. Deferring by a
   * macrotask lets the immediate remount cancel it (see join), so dev behaves
   * like production and connects exactly once. A real unmount has no remount
   * to cancel it, so the timer fires and we leave normally.
   */
  const scheduleLeave = useCallback(() => {
    if (teardownTimerRef.current) clearTimeout(teardownTimerRef.current);

    teardownTimerRef.current = setTimeout(() => {
      teardownTimerRef.current = null;
      leave();
    }, 0);
  }, [leave]);

  // Sample every analyser once a frame and publish the set of people currently
  // speaking. One loop for the whole room, running only while connected.
  useEffect(() => {
    if (!connected) return;

    let frame = 0;
    const buffer = new Uint8Array(256);
    const lastLoudAt = new Map<string, number>();

    const tick = () => {
      const now = performance.now();

      analysersRef.current.forEach(({ analyser }, identity) => {
        analyser.getByteTimeDomainData(buffer);

        // Byte time-domain data is centred on 128; RMS of the deviation is
        // the signal's loudness.
        let sumSquares = 0;

        for (let i = 0; i < buffer.length; i++) {
          const deviation = (buffer[i] - 128) / 128;

          sumSquares += deviation * deviation;
        }

        if (Math.sqrt(sumSquares / buffer.length) > SPEAKING_RMS_THRESHOLD) {
          lastLoudAt.set(identity, now);
        }
      });

      const speaking: string[] = [];

      lastLoudAt.forEach((at, identity) => {
        if (now - at < SPEAKING_HOLD_MS) speaking.push(identity);
      });

      setSpeakingIds((prev) =>
        prev.length === speaking.length &&
        speaking.every((id) => prev.includes(id))
          ? prev // same set -- don't re-render every frame
          : speaking,
      );

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [connected]);

  // Leave on unmount (navigating away, closing the panel) so a connected
  // room never keeps publishing mic/screen in the background.
  useEffect(() => {
    return () => {
      if (teardownTimerRef.current) clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
      teardownAudio();
      stopAllScreenShareStatsLogging();
      clearMediaSession();
    };
  }, [teardownAudio, stopAllScreenShareStatsLogging]);

  const join = useCallback(async () => {
    // A pending deferred teardown means we're in StrictMode's throwaway
    // mount → cleanup → mount (or a fast leave/rejoin). Cancel it and keep the
    // connection we already have instead of rebuilding it.
    if (teardownTimerRef.current) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    if (!conversationId || roomRef.current || joiningRef.current) return;

    // Claimed synchronously, before the first await. Because the teardown
    // above was deferred rather than run, StrictMode's remount finds this
    // still set and returns -- so dev does exactly one token fetch and one
    // connect(), the same as production.
    joiningRef.current = true;

    const joinToken = ++joinTokenRef.current;

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch(`/api/voice/rooms/${conversationId}/token`, {
        method: "POST",
      });

      if (!res.ok) {
        setError(await readProblemDetail(res, "Could not join the call."));

        return;
      }

      const { serverUrl, token } = (await res.json()) as {
        serverUrl: string;
        token: string;
      };

      // No-op after the first call; patches RTCPeerConnection.setLocalDescription
      // for the whole page so a forced screen-share start bitrate can be applied
      // once setConfiguredScreenShareEnabled registers one below.
      installStartBitrateOverride();

      const room = new Room({ webAudioMix: true });

      // Remote speaking comes from LiveKit; isSpeakingChanged is per-participant
      // and more reliable than the room-level ActiveSpeakersChanged aggregate.
      const wireRemote = (p: RemoteParticipant) => {
        p.setVolume(
          gain(participantVolume(p.identity) / 100),
          Track.Source.Microphone,
        );
        p.setVolume(
          gain(watchedScreenShareAudioRef.current === p.identity
            ? screenShareVolume(p.identity) / 100
            : 0),
          Track.Source.ScreenShareAudio,
        );
        p.on(ParticipantEvent.IsSpeakingChanged, () =>
          refreshParticipants(room),
        );
      };

      room.on(RoomEvent.ParticipantConnected, (p) => {
        wireRemote(p);
        refreshParticipants(room);
        playJoinRef.current().catch(() => {});
      });
      // Someone (un)deafened: their attribute changed.
      room.on(RoomEvent.ParticipantAttributesChanged, (changed) => {
        if (DEAFENED_ATTRIBUTE in changed) refreshParticipants(room);
      });
      room.on(RoomEvent.ParticipantDisconnected, (p) => {
        removeScreenShare(p.identity);
        refreshParticipants(room);
        playLeaveRef.current().catch(() => {});
      });
      const refreshMuteState = () => {
        refreshParticipants(room);
        setMuted(!room.localParticipant.isMicrophoneEnabled);
      };

      room.on(RoomEvent.TrackMuted, refreshMuteState);
      // We never mute our own screen share, so this is the voice service suspending a
      // share above what our current roles allow -- end it instead of leaving a frozen tile.
      room.on(RoomEvent.TrackMuted, (publication, participant) => {
        if (!participant.isLocal || publication.source !== Track.Source.ScreenShare) return;

        addToast({
          color: "warning",
          title: "Screen share stopped",
          description: "Your plan doesn't include that resolution. Pick a lower one in Settings.",
        });
        void setConfiguredScreenShareEnabled(room, false);
      });
      room.on(RoomEvent.TrackUnmuted, refreshMuteState);

      // Screen-share audio is its own publication. It remains disabled and
      // unsubscribed until the receiver explicitly watches that share.
      room.on(RoomEvent.TrackPublished, (publication, participant) => {
        if (publication.source !== Track.Source.ScreenShareAudio) return;

        const isWatched =
          watchedScreenShareAudioRef.current === participant.identity;

        participant.setVolume(
          gain(isWatched ? screenShareVolume(participant.identity) / 100 : 0),
          Track.Source.ScreenShareAudio,
        );
        publication.setEnabled(isWatched);
        publication.setSubscribed(isWatched);
        if (isWatched) {
          setError(null);
        }
      });

      // Notify other conversation members as soon as the room is actually
      // connected (fires on the initial connect and on any reconnect) --
      // decoupled from the rest of join() so a later failure (e.g. the mic
      // permission prompt) can't silently swallow the notification.
      room.on(RoomEvent.Connected, () => {
        applyAudioSettings(room, true);
        connectedAtRef.current = Date.now();
        if (conversationId && !silentReconnectRef.current) {
          send({ type: "CALL_STARTED", conversationId });
        }
      });

      // Microphones play through hidden audio elements. Screen-share video and
      // its separate audio track are kept together in ScreenShare state and
      // attached by the expanded ScreenShareStage.
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (publication.source === Track.Source.ScreenShareAudio) {
          const isWatched =
            watchedScreenShareAudioRef.current === participant.identity;

          participant.setVolume(
            gain(isWatched ? screenShareVolume(participant.identity) / 100 : 0),
            Track.Source.ScreenShareAudio,
          );
          publication.setEnabled(isWatched);
          if (isWatched) {
            addScreenShareAudio(participant.identity, track);
          } else {
            publication.setSubscribed(false);
          }
        } else if (track.kind === Track.Kind.Audio) {
          participant.setVolume(
            gain(participantVolume(participant.identity) / 100),
            Track.Source.Microphone,
          );
          const el = track.attach();

          el.autoplay = true;
          el.dataset.livekitTrack = track.sid ?? "";
          el.dataset.livekitParticipant = participant.identity;
          el.dataset.livekitSource = publication.source;
          document.body.appendChild(el);
        }
        if (publication.source === Track.Source.ScreenShare) {
          addScreenShare(participant.identity, track);
          announceScreenShare(participant.identity, false);
          startReceiverStatsLogging(
            track as RemoteVideoTrack,
            participant.identity,
          );
        }
      });
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track, publication, participant) => {
          track.detach().forEach((el) => el.remove());
          if (publication.source === Track.Source.ScreenShareAudio) {
            removeScreenShareAudio(participant.identity);
          }
          if (publication.source === Track.Source.ScreenShare) {
            removeScreenShare(participant.identity);
            stopScreenShareStatsLogging(
              `recv:${participant.identity}:${track.sid ?? ""}`,
            );
          }
        },
      );

      // Local screen share never fires TrackSubscribed (that's remote-only) --
      // this is what gives the sharer their own preview, and also what catches
      // the browser's native "Stop sharing" bar bypassing toggleScreenShare.
      room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
        if (
          publication.source === Track.Source.ScreenShare &&
          publication.track
        ) {
          addScreenShare(participant.identity, publication.track);
          announceScreenShare(participant.identity, true);
          startSenderStatsLogging(publication.track as LocalVideoTrack);
        }
        // Unmuting republishes the mic as a NEW capture track, so the old
        // analyser would be reading a dead one -- re-point it at the new track.
        if (
          publication.source === Track.Source.Microphone &&
          publication.track
        ) {
          addAnalyser(participant.identity, publication.track.mediaStreamTrack);
          void attachMicGain(publication.track as LocalAudioTrack);
        }
        if (
          publication.source === Track.Source.ScreenShareAudio &&
          publication.track
        ) {
          addScreenShareAudio(participant.identity, publication.track);
          const mediaTrack = publication.track.mediaStreamTrack;

          // Apply fidelity hints only after Chrome has returned the display
          // track. They are optional and must not block screen-audio capture.
          mediaTrack.contentHint = "music";
          void mediaTrack
            .applyConstraints({
              channelCount: 2,
              sampleRate: 48_000,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            })
            .catch(() => {
              // Unsupported hints do not prevent using the captured track.
            });
        }
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
        if (publication.source === Track.Source.ScreenShareAudio) {
          removeScreenShareAudio(participant.identity);
        }
        if (publication.source === Track.Source.ScreenShare) {
          setScreenSharing(false);
          // Keyed by identity, not publication.track -- LiveKit clears that
          // reference before/while emitting this event, so matching on it
          // never fired and the stale last frame stayed on screen.
          removeScreenShare(participant.identity);
          stopScreenShareStatsLogging(`send:${publication.trackSid}`);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        watchedScreenShareAudioRef.current = null;
        setConnected(false);
        setReconnecting(false);
        setParticipants([]);
        setScreenShares([]);
        pendingScreenShareAudioTracksRef.current.clear();
        announcedSharesRef.current.clear();
        stopAllScreenShareStatsLogging();
        clearMediaSession();
      });
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Disconnected) setConnected(false);
      });

      // LiveKit's own reconnect (e.g. after a throttled background tab missed
      // its pings and got dropped) -- surface it as "reconnecting" rather than
      // letting the call silently look dead with no way back short of leaving
      // and rejoining.
      room.on(RoomEvent.Reconnecting, () => {
        setReconnecting(true);

        const publication = room.localParticipant.getTrackPublication(
          Track.Source.ScreenShare,
        );

        if (publication)
          stopScreenShareStatsLogging(`send:${publication.trackSid}`);
      });
      room.on(RoomEvent.Reconnected, () => {
        setReconnecting(false);
        refreshParticipants(room);
        void recoverScreenShareAfterReconnect(room);
      });

      // Default is 15s -- kept generous because ICE negotiation through
      // Docker's published ports is slower than on bare metal.
      await room.connect(livekitUrlForThisBrowser(serverUrl), token, {
        peerConnectionTimeout: 30_000,
      });

      // Left (or re-joined) while we were connecting -- this room is orphaned,
      // so drop it rather than leaving a second connection alive.
      if (joinTokenRef.current !== joinToken) {
        room.disconnect();

        return;
      }

      // We're in the call now. Commit that BEFORE touching the mic: publishing
      // is a separate step that can fail on its own, and if it does we're
      // still connected -- bailing out here would leave the controls dead
      // (roomRef null) and the UI stuck on "Connecting…" while audio flowed.
      roomRef.current = room;
      setConnected(true);
      refreshParticipants(room);
      playJoinRef.current().catch(() => {});
      setMediaSessionActive("Voice call");

      // Anyone already in the room when we arrived -- ParticipantConnected only
      // fires for people who join after us.
      room.remoteParticipants.forEach(wireRemote);

      const published = await publishMic(room);

      if (published) {
        // Our own mic, straight off the local capture track -- this is the one
        // that has to react to every input, and it never leaves the browser.
        const micTrack = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.track;

        if (micTrack) {
          addAnalyser(
            room.localParticipant.identity,
            micTrack.mediaStreamTrack,
          );
        }
        setMuted(false);
      } else {
        // In the call, just not publishing. Surfaced as muted so the mic button
        // is the obvious way to retry.
        setMuted(true);
        setError(
          "You're connected, but your microphone didn't start. Use the mic button to retry.",
        );
      }

      refreshParticipants(room);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to join call", err);
      setError(
        err instanceof Error
          ? `Could not join the call: ${err.message}`
          : "Could not join the call.",
      );
    } finally {
      // Only release the claim if we're still the current join -- a cancelled
      // one finishing late must not clear the flag (or the spinner) belonging
      // to the join that replaced it.
      if (joinTokenRef.current === joinToken) {
        joiningRef.current = false;
        setConnecting(false);
      }
    }
  }, [
    conversationId,
    refreshParticipants,
    send,
    publishMic,
    addAnalyser,
    addScreenShare,
    addScreenShareAudio,
    announceScreenShare,
    applyAudioSettings,
    attachMicGain,
    removeScreenShare,
    removeScreenShareAudio,
    setConfiguredScreenShareEnabled,
    startSenderStatsLogging,
    startReceiverStatsLogging,
    stopScreenShareStatsLogging,
    stopAllScreenShareStatsLogging,
    recoverScreenShareAfterReconnect,
    participantVolume,
    screenShareVolume,
  ]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    if (muted) {
      // Unmuting while deafened also undeafens (you can't talk without hearing).
      if (deafenedRef.current) {
        deafenedRef.current = false;
        setDeafened(false);
        applyOutputVolumes(room);
      }

      // Also the retry path when the mic failed to start on join, so it goes
      // through publishMic rather than a bare one-shot enable.
      if (await publishMic(room)) {
        setMuted(false);
        setError(null);

        const micTrack = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.track;

        if (micTrack) {
          addAnalyser(
            room.localParticipant.identity,
            micTrack.mediaStreamTrack,
          );
        }
      } else {
        setError("Your microphone still didn't start.");
      }

      return;
    }

    await room.localParticipant.setMicrophoneEnabled(false);
    setMuted(true);
  }, [muted, publishMic, addAnalyser, applyOutputVolumes]);

  const toggleDeafen = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    if (!deafenedRef.current) {
      micMutedBeforeDeafenRef.current = muted;
      deafenedRef.current = true;
      setDeafened(true);
      applyOutputVolumes(room);
      if (!muted) await toggleMute();

      return;
    }

    // Undeafen: hear everyone again, and unmute only if the mic was live before.
    deafenedRef.current = false;
    setDeafened(false);
    applyOutputVolumes(room);
    if (!micMutedBeforeDeafenRef.current && muted) await toggleMute();
  }, [muted, toggleMute, applyOutputVolumes]);

  const rejoinForServerChange = useCallback(
    async (regionName?: string) => {
      if (!roomRef.current || silentReconnectRef.current) return;

      const wasMuted = muted;

      silentReconnectRef.current = true;
      try {
        leave();
        await join();

        // join() publishes the mic; keep a muted user muted across the move.
        const room = roomRef.current as Room | null;

        if (wasMuted && room) {
          await room.localParticipant.setMicrophoneEnabled(false);
          setMuted(true);
        }

        addToast({
          title: regionName ? `Call moved to ${regionName}` : "Call server changed",
        });
      } finally {
        silentReconnectRef.current = false;
      }
    },
    [muted, leave, join],
  );

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    const next = !screenSharing;

    try {
      const includeAudio = next
        ? readScreenShareAudioPref()
        : screenAudioEnabledRef.current;

      screenAudioEnabledRef.current = includeAudio;
      await setConfiguredScreenShareEnabled(room, next, includeAudio);
      setScreenSharing(next);

      if (
        next &&
        includeAudio &&
        !room.localParticipant.getTrackPublication(
          Track.Source.ScreenShareAudio,
        )
      ) {
        setError(
          'Chrome did not provide shared audio. Select a browser tab and enable "Share tab audio" in the picker.',
        );
      } else if (next) {
        setError(null);
      }
    } catch {
      // Screen picker was cancelled, or unsupported in this browser -- no-op.
    }
  }, [screenSharing, setConfiguredScreenShareEnabled]);


  // Someone moved this call to another server region: everyone reconnects. The
  // handler is read through a ref so the subscription isn't torn down and
  // re-created every time mute/leave/join identities change.
  const rejoinForServerChangeRef = useRef(rejoinForServerChange);

  rejoinForServerChangeRef.current = rejoinForServerChange;

  useEffect(
    () =>
      subscribe("CALL_REGION_CHANGED", (event) => {
        if (event.conversationId !== conversationId) return;
        void rejoinForServerChangeRef.current(event.regionName);
      }),
    [subscribe, conversationId],
  );

  return {
    connected,
    connecting,
    reconnecting,
    // Ours is analyser-driven (instant, catches any input); everyone else's
    // comes from LiveKit, already on the roster.
    participants: participants.map((p) => ({
      ...p,
      isSpeaking:
        !p.isMuted &&
        (p.isLocal ? speakingIds.includes(p.identity) : p.isSpeaking),
    })),
    muted,
    deafened,
    screenSharing,
    screenShares,
    error,
    join,
    leave,
    scheduleLeave,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    rejoinForServerChange,
    setParticipantVolume,
    toggleParticipantMute,
    muteParticipantForEveryone,
    setScreenShareVolume,
    watchScreenShareAudio,
  };
}
