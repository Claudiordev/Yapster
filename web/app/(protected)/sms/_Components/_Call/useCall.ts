"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  type LocalTrack,
  type LocalVideoTrack,
  type Participant,
  ParticipantEvent,
  type RemoteTrack,
  type RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";

import { addToast } from "@heroui/toast";
import { useSound } from "react-sounds";

import {
  ADAPTIVE_RESOLUTION_LADDER,
  ADAPTIVE_RESOLUTIONS,
  type AdaptiveResolutionTier,
  readAudioProcessingPrefs,
  readScreenShareAudioPref,
  readVideoPrefs,
  videoCaptureSettings,
} from "@/lib/media-prefs";
import { useRealtime } from "@/lib/useRealtime";

export interface CallParticipant {
  identity: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
}

export interface ScreenShare {
  track: LocalTrack | RemoteTrack;
  identity: string;
}

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
//
// The static ceiling set at share-start (see toggleScreenShare) is a MAX, not
// a floor -- on a congested link, "detail"/maintain-resolution used to hold
// the encoder there and let bandwidth estimation crush the bitrate at full
// res instead (see the comment on contentHint above). Now that we run
// "motion"/maintain-framerate, nothing stops that same collapse on its own --
// this closed loop is what's supposed to catch it: watch the same stats
// startSenderStatsLogging already polls, and when the link clearly can't
// sustain the current tier, step resolution/bitrate down to one it can, then
// step back up once things look clear again. Modeled on fluxerapp/fluxer's
// AdaptiveScreenShareEngine, trimmed down: one resolution ladder (no separate
// frame-rate ladder -- 30/60 is the whole choice here) and no per-mode
// (gaming vs. screenshare) branching.
const ADAPTIVE_POLL_INTERVAL_MS = 3000; // matches startSenderStatsLogging's own interval
const ADAPTIVE_STEP_DOWN_STREAK = 4; // ~4 bad polls before acting -- ignore one-off blips
const ADAPTIVE_STEP_UP_STREAK = 3; // ~3 clean polls before trying to recover
const ADAPTIVE_STEP_DOWN_COOLDOWN_MS = 10_000;
const ADAPTIVE_STEP_UP_BASE_COOLDOWN_MS = 5_000;
const ADAPTIVE_STEP_UP_MAX_COOLDOWN_MS = 30_000; // doubles each step-up, caps here
const ADAPTIVE_BANDWIDTH_BITRATE_STEP_FACTOR = 0.6; // first move on a bandwidth limit: cut bitrate, not resolution

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
  configuredFrameRate: 30 | 60;
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
  configuredFrameRate: 30 | 60,
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
  frameRate: 30 | 60,
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
    await track.setDegradationPreference("maintain-framerate");
  }

  const parameters = sender.getParameters();
  const encodings = parameters.encodings?.length ? parameters.encodings : [{}];

  parameters.degradationPreference = "maintain-framerate";
  parameters.encodings = encodings.map((encoding) => ({
    ...encoding,
    ...(scaleResolutionDownBy !== undefined ? { scaleResolutionDownBy } : {}),
    maxBitrate,
    maxFramerate: frameRate,
  }));
  await sender.setParameters(parameters);
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
  const { resolution, maxBitrate, maxFramerate } = videoCaptureSettings();

  await track.mediaStreamTrack.applyConstraints({
    width: { ideal: resolution.width, max: resolution.width },
    height: { ideal: resolution.height, max: resolution.height },
    frameRate: { ideal: maxFramerate, max: maxFramerate },
  });

  if (typeof track.setDegradationPreference === "function") {
    await track.setDegradationPreference("maintain-framerate");
  }

  const sender = track.sender;

  if (!sender)
    throw new Error("Screen-share sender is unavailable after reconnect");

  const parameters = sender.getParameters();
  const encodings = parameters.encodings?.length ? parameters.encodings : [{}];

  parameters.degradationPreference = "maintain-framerate";
  parameters.encodings = encodings.map((encoding) => {
    const restored = {
      ...encoding,
      maxBitrate,
      maxFramerate,
    };

    // Omitting the field from a spread is not enough: the old encoding may
    // already contain the adaptive downscale applied before the reconnect.
    delete restored.scaleResolutionDownBy;

    return restored;
  });

  await sender.setParameters(parameters);
}

function currentAdaptiveBitrate(state: AdaptiveScreenShareState): number {
  const tier = ADAPTIVE_RESOLUTION_LADDER[state.effectiveTierIndex];
  const { bitrate30, bitrate60 } = ADAPTIVE_RESOLUTIONS[tier];

  return state.configuredFrameRate === 60 ? bitrate60 : bitrate30;
}

function bitrateForTier(
  tier: AdaptiveResolutionTier,
  frameRate: 30 | 60,
): number {
  const { bitrate30, bitrate60 } = ADAPTIVE_RESOLUTIONS[tier];

  return frameRate === 60 ? bitrate60 : bitrate30;
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
  const nextBitrate = bitrateForTier(nextTier, state.configuredFrameRate);

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
    const restoredBitrate = bitrateForTier(
      currentTier,
      state.configuredFrameRate,
    );

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
  const nextBitrate = bitrateForTier(nextTier, state.configuredFrameRate);

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
  toggleScreenShare: () => Promise<void>;
}

/**
 * One LiveKit Room per call. The room name is always the conversation id
 * (see the voice service's membership check) -- a group call is just a DM
 * call with more members, LiveKit doesn't distinguish the two.
 */
export function useCall(conversationId: string | null): UseCallState {
  const { send } = useRealtime();
  const roomRef = useRef<Room | null>(null);

  // Someone else arriving/leaving the call. Held in refs because the LiveKit
  // handlers below are registered once inside join() and would otherwise
  // capture the first render's play functions.
  const { play: playJoin } = useSound("ui/pop_open");
  const { play: playLeave } = useSound("ui/pop_close");
  const playJoinRef = useRef(playJoin);
  const playLeaveRef = useRef(playLeave);

  useEffect(() => {
    playJoinRef.current = playJoin;
  }, [playJoin]);
  useEffect(() => {
    playLeaveRef.current = playLeave;
  }, [playLeave]);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);

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

  const refreshParticipants = useCallback((room: Room) => {
    const local = room.localParticipant;

    setParticipants([
      {
        identity: local.identity,
        isLocal: true,
        isSpeaking: false, // ours is filled in from the analyser on the way out
        isMuted: !local.isMicrophoneEnabled,
      },
      ...Array.from(room.remoteParticipants.values()).map((p) => ({
        identity: p.identity,
        isLocal: false,
        isSpeaking: p.isSpeaking,
        isMuted: !p.isMicrophoneEnabled,
      })),
    ]);
  }, []);

  // Keyed by identity: one share per participant, and re-sharing replaces the
  // previous entry rather than stacking up.
  const addScreenShare = useCallback(
    (identity: string, track: LocalTrack | RemoteTrack) => {
      setScreenShares((prev) => [
        ...prev.filter((s) => s.identity !== identity),
        { identity, track },
      ]);
    },
    [],
  );

  const removeScreenShare = useCallback((identity: string) => {
    setScreenShares((prev) => prev.filter((s) => s.identity !== identity));
  }, []);

  const screenAudioEnabledRef = useRef(true);

  useEffect(() => {
    screenAudioEnabledRef.current = readScreenShareAudioPref();
  }, []);

  // Periodic console logging of actual (not requested) screen-share quality,
  // keyed so both a local send stream and any number of remote receive
  // streams can run side by side without clobbering each other's bitrate math.
  const screenShareStatsTimersRef = useRef(
    new Map<string, ReturnType<typeof setInterval>>(),
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

    if (timer) {
      clearInterval(timer);
      screenShareStatsTimersRef.current.delete(key);
    }
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

      // "motion"/maintain-framerate (see toggleScreenShare) needs something
      // watching for the collapse that combination is prone to on a congested
      // link -- this is that watcher, seeded from the same prefs the capture
      // itself was built from.
      const configuredPrefs = readVideoPrefs();

      adaptiveScreenShareRef.current = freshAdaptiveState(
        configuredPrefs.resolution as AdaptiveResolutionTier,
        configuredPrefs.frameRate,
      );

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

      await room.localParticipant.setScreenShareEnabled(
        enabled,
        {
          resolution,
          contentHint: "motion",
          // Ask getDisplayMedia for the selected source's audio too.
          // Chrome still requires the user to enable "Share tab audio" in
          // its picker; unsupported browsers simply return video only.
          audio: includeAudio ? { restrictOwnAudio: { ideal: true } } : false,
          systemAudio: includeAudio ? "include" : "exclude",
          suppressLocalAudioPlayback: false,
        },
        {
          screenShareEncoding: { maxBitrate, maxFramerate, priority: "high" },
          videoCodec: "h264",
          backupCodec: false,
          simulcast: false,
          degradationPreference: "maintain-framerate",
        },
      );
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
    const options = {
      noiseSuppression: prefs.noiseSuppression,
      echoCancellation: prefs.echoCancellation,
      autoGainControl: true,
    };

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
      if (conversationId) send({ type: "CALL_ENDED", conversationId });
      playLeaveRef.current().catch(() => {});
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
        setError("Could not join the call.");

        return;
      }

      const { serverUrl, token } = (await res.json()) as {
        serverUrl: string;
        token: string;
      };

      const room = new Room();

      // Remote speaking comes from LiveKit; isSpeakingChanged is per-participant
      // and more reliable than the room-level ActiveSpeakersChanged aggregate.
      const wireRemote = (p: Participant) =>
        p.on(ParticipantEvent.IsSpeakingChanged, () =>
          refreshParticipants(room),
        );

      room.on(RoomEvent.ParticipantConnected, (p) => {
        wireRemote(p);
        refreshParticipants(room);
        playJoinRef.current().catch(() => {});
      });
      room.on(RoomEvent.ParticipantDisconnected, (p) => {
        removeScreenShare(p.identity);
        refreshParticipants(room);
        playLeaveRef.current().catch(() => {});
      });
      room.on(RoomEvent.TrackMuted, () => refreshParticipants(room));
      room.on(RoomEvent.TrackUnmuted, () => refreshParticipants(room));

      // Notify other conversation members as soon as the room is actually
      // connected (fires on the initial connect and on any reconnect) --
      // decoupled from the rest of join() so a later failure (e.g. the mic
      // permission prompt) can't silently swallow the notification.
      room.on(RoomEvent.Connected, () => {
        if (conversationId) send({ type: "CALL_STARTED", conversationId });
      });

      // Remote audio doesn't play itself -- attach each subscribed track to a
      // hidden <audio> element and clean it up once unsubscribed. A remote
      // screen share is video, not auto-played anywhere -- surface the Track
      // itself so CallPanel can attach it to a visible <video>.
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();

          el.autoplay = true;
          el.dataset.livekitTrack = track.sid ?? "";
          document.body.appendChild(el);
        }
        if (track.source === Track.Source.ScreenShare) {
          addScreenShare(participant.identity, track);
          startReceiverStatsLogging(
            track as RemoteVideoTrack,
            participant.identity,
          );
        }
      });
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track, _publication, participant) => {
          track.detach().forEach((el) => el.remove());
          if (track.source === Track.Source.ScreenShare) {
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
          startSenderStatsLogging(publication.track as LocalVideoTrack);
        }
        // Unmuting republishes the mic as a NEW capture track, so the old
        // analyser would be reading a dead one -- re-point it at the new track.
        if (
          publication.source === Track.Source.Microphone &&
          publication.track
        ) {
          addAnalyser(participant.identity, publication.track.mediaStreamTrack);
        }
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
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
        setConnected(false);
        setReconnecting(false);
        setParticipants([]);
        setScreenShares([]);
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
    removeScreenShare,
    startSenderStatsLogging,
    startReceiverStatsLogging,
    stopScreenShareStatsLogging,
    stopAllScreenShareStatsLogging,
    recoverScreenShareAfterReconnect,
  ]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    if (muted) {
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
  }, [muted, publishMic, addAnalyser]);

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
    } catch {
      // Screen picker was cancelled, or unsupported in this browser -- no-op.
    }
  }, [screenSharing, setConfiguredScreenShareEnabled]);

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
    screenSharing,
    screenShares,
    error,
    join,
    leave,
    scheduleLeave,
    toggleMute,
    toggleScreenShare,
  };
}
