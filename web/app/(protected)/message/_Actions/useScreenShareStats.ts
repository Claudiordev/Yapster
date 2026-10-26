"use client";

import { useCallback, useRef } from "react";
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";

import { readVideoPrefs } from "@/lib/mediaPrefs";
import type { AdaptiveResolutionTier } from "@/types/media";
import { ADAPTIVE_POLL_INTERVAL_MS, ADAPTIVE_SCREEN_SHARE_QUALITY_ENABLED, type AdaptiveQualityLimitation, type AdaptiveScreenShareState, freshAdaptiveState, runAdaptiveScreenShareStep } from "./utils/adaptiveScreenShare";
import { enforceConfiguredScreenShareSender, reconcileCaptureWithFrames, requestScreenShareKeyFrame } from "./utils/screenShareSender";
import { resolveScreenShareTarget } from "./utils/screenShareTarget";
import { type EncodeSupport, markCodecUnsuitable } from "./utils/screenShareCodec";
import { inspectScreenShareEncoder } from "./utils/screenShareEncoderCheck";

const STARTUP_KEYFRAME_DELAYS_MS = [500, 1_500, 3_000] as const;

/** Encoder start-up check: first look, then every interval, up to this many looks. */
const ENCODER_CHECK_FIRST_MS = 2_500;
const ENCODER_CHECK_INTERVAL_MS = 2_000;
const ENCODER_CHECK_MAX_LOOKS = 12;
/** Consecutive stalled looks before acting, so a slow-starting encoder isn't mistaken for a dead one. */
const ENCODER_STALLED_LOOKS = 2;

/** Polls of "cpu" limitation in a row before the codec is marked as too heavy for this machine. */
const CPU_LIMITED_POLLS = 4;

/** The slice of a raw WebRTC stats entry that lib.dom's typings don't cover. */
interface SendStats {
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

/** The slice of a raw receiver stats entry this log reads. */
interface ReceiveStats {
  type: string;
  timestamp: number;
  kind?: string;
  mediaType?: string;
  state?: string;
  nominated?: boolean;
  bytesReceived?: number;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  framesDecoded?: number;
  framesDropped?: number;
  freezeCount?: number;
  totalFreezesDuration?: number;
  packetsLost?: number;
  nackCount?: number;
  pliCount?: number;
  jitter?: number;
  jitterBufferDelay?: number;
  jitterBufferEmittedCount?: number;
  decoderImplementation?: string;
  localCandidateId?: string;
  protocol?: string;
  candidateType?: string;
}

interface PreviousSample {
  bytes: number;
  at: number;
  qpSum?: number;
  framesEncoded?: number;
  framesDropped?: number;
  framesDecoded?: number;
}

const kbps = (bps?: number) => (bps ? Math.round(bps / 1000) : undefined);

/**
 * Console logging of the quality a screen share actually gets (as opposed to
 * what was requested), for our own send stream and any number of received ones.
 * Keys are `send:<sid>` and `recv:<identity>:<sid>`.
 */
export function useScreenShareStats() {
  const timersRef = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const keyFrameTimersRef = useRef(new Map<string, Set<ReturnType<typeof setTimeout>>>());
  const previousRef = useRef(new Map<string, PreviousSample>());
  /** What the capture was asked for, so the publish handler can log it beside the actual. */
  const requestedSettingsRef = useRef<{ width: number; height: number; frameRate: number; maxBitrate: number; codec: string; support: EncodeSupport } | null>(null);
  const adaptiveRef = useRef<AdaptiveScreenShareState | null>(null);
  /** Set by useScreenShare: called when a software-encoded share has been CPU limited for several polls. */
  const onCpuLimitedRef = useRef<(() => void) | null>(null);
  /** Set by useScreenShare: called when the encoder never produced a frame although the capture is delivering them. */
  const onEncoderStalledRef = useRef<(() => void) | null>(null);
  const encoderCheckTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const stopScreenShareStatsLogging = useCallback((key: string) => {
    const timer = timersRef.current.get(key);

    if (timer) clearInterval(timer);
    clearTimeout(encoderCheckTimersRef.current.get(key));
    encoderCheckTimersRef.current.delete(key);
    keyFrameTimersRef.current.get(key)?.forEach((keyFrameTimer) => clearTimeout(keyFrameTimer));
    timersRef.current.delete(key);
    keyFrameTimersRef.current.delete(key);
    previousRef.current.delete(key);
    if (key.startsWith("send:")) adaptiveRef.current = null;
  }, []);

  const stopAllScreenShareStatsLogging = useCallback(() => {
    timersRef.current.forEach((timer) => clearInterval(timer));
    encoderCheckTimersRef.current.forEach((timer) => clearTimeout(timer));
    encoderCheckTimersRef.current.clear();
    keyFrameTimersRef.current.forEach((timers) => timers.forEach((timer) => clearTimeout(timer)));
    timersRef.current.clear();
    keyFrameTimersRef.current.clear();
    previousRef.current.clear();
    adaptiveRef.current = null;
  }, []);

  const startSenderStatsLogging = useCallback(
    (track: LocalVideoTrack) => {
      const key = `send:${track.sid ?? "local-screen"}`;

      stopScreenShareStatsLogging(key);

      const requested = requestedSettingsRef.current;
      const actual = track.mediaStreamTrack.getSettings();

      // eslint-disable-next-line no-console
      console.info("[screen-share] capture started", {
        requested: requested ? `${requested.width}x${requested.height}@${requested.frameRate}fps, ceiling ${Math.round(requested.maxBitrate / 1000)}kbps, ${requested.codec} (${requested.support} encoder expected)` : "unknown",
        actual: `${actual.width}x${actual.height}@${actual.frameRate}fps`,
      });

      const prefs = readVideoPrefs();

      adaptiveRef.current = ADAPTIVE_SCREEN_SHARE_QUALITY_ENABLED ? freshAdaptiveState(prefs.resolution as AdaptiveResolutionTier, prefs.frameRate) : null;

      // LiveKit applies the settings at publish time; reassert them on the
      // concrete sender so renegotiation can't leave a lower ceiling behind.
      // Startup keyframes wait on this so the setParameters calls can't race.
      const senderConfigured = enforceConfiguredScreenShareSender(track).then(
        () => {
          const applied = track.sender?.getParameters().encodings?.[0];

          // eslint-disable-next-line no-console
          console.info("[screen-share] sender bitrate configured", {
            configuredMaxKbps: kbps(resolveScreenShareTarget().maxBitrate),
            appliedMaxKbps: kbps(applied?.maxBitrate),
          });

          return true;
        },
        (error: unknown) => {
          // eslint-disable-next-line no-console
          console.warn("[screen-share] could not enforce sender settings", error);

          return false;
        },
      );

      // A few early keyframes refresh a static screen once the bandwidth estimate rises.
      const keyFrameTimers = new Set<ReturnType<typeof setTimeout>>();

      keyFrameTimersRef.current.set(key, keyFrameTimers);
      STARTUP_KEYFRAME_DELAYS_MS.forEach((delayMs) => {
        const timer = setTimeout(() => {
          keyFrameTimers.delete(timer);
          if (keyFrameTimers.size === 0) keyFrameTimersRef.current.delete(key);

          void senderConfigured.then(async (configured) => {
            if (configured && (await requestScreenShareKeyFrame(track))) {
              // eslint-disable-next-line no-console
              console.info("[screen-share] startup keyframe requested", { afterMs: delayMs });
            }
          });
        }, delayMs);

        keyFrameTimers.add(timer);
      });

      // Start-up check: is the encoder really producing frames for the codec we asked for?
      let looks = 0;
      let stalledLooks = 0;
      const checkEncoder = (delayMs: number) => {
        encoderCheckTimersRef.current.set(
          key,
          setTimeout(async () => {
            looks += 1;
            try {
              const report = await track.sender?.getStats();
              const requestedNow = requestedSettingsRef.current;

              if (report && requestedNow) {
                const { state, activeCodecs } = inspectScreenShareEncoder(report, requestedNow.codec);

                if (state === "verified") {
                  if (activeCodecs.length > 0 && !activeCodecs.includes(requestedNow.codec)) {
                    // Negotiation picked another codec: track the one really in use.
                    // eslint-disable-next-line no-console
                    console.warn("[screen-share] encoder is using a different codec than requested", { requested: requestedNow.codec, active: activeCodecs });
                    requestedSettingsRef.current = { ...requestedNow, codec: activeCodecs[0] };
                  }

                  return;
                }

                stalledLooks = state === "stalled" ? stalledLooks + 1 : 0;
                if (stalledLooks >= ENCODER_STALLED_LOOKS) {
                  // eslint-disable-next-line no-console
                  console.warn("[screen-share] encoder is stalled: the capture delivers frames but none are encoded", { codec: requestedNow.codec });
                  markCodecUnsuitable(requestedNow.codec);
                  onEncoderStalledRef.current?.();

                  return;
                }
              }
            } catch {
              // Stats unavailable this time; look again.
            }
            if (looks < ENCODER_CHECK_MAX_LOOKS) checkEncoder(ENCODER_CHECK_INTERVAL_MS);
          }, delayMs),
        );
      };

      checkEncoder(ENCODER_CHECK_FIRST_MS);

      let cpuLimitedPolls = 0;
      let reconciledFrame = "";

      timersRef.current.set(
        key,
        setInterval(async () => {
          // The raw report, not track.getSenderStats(): a slow share can be a
          // CPU-bound encoder, a collapsed bandwidth estimate or packet loss,
          // and only the full report tells them apart.
          const report = await track.sender?.getStats();

          if (!report) return;

          let outbound: SendStats | undefined;
          let remoteInbound: SendStats | undefined;
          let candidatePair: SendStats | undefined;

          report.forEach((entry: SendStats) => {
            // The highest-resolution outbound stream is what a viewer sees.
            if (entry.type === "outbound-rtp" && (!outbound || (entry.frameWidth ?? 0) > (outbound.frameWidth ?? 0))) outbound = entry;
            if (entry.type === "remote-inbound-rtp") remoteInbound = entry;
            // availableOutgoingBitrate is only set on the selected pair.
            if (entry.type === "candidate-pair" && entry.availableOutgoingBitrate !== undefined) candidatePair = entry;
          });

          if (!outbound) return;

          // Media on TCP is the usual reason a link that can carry the bitrate
          // doesn't: head-of-line stalls read as congestion, so the estimate
          // stays low.
          const localCandidate = candidatePair?.localCandidateId ? (report.get(candidatePair.localCandidateId) as SendStats | undefined) : undefined;

          const now = outbound.timestamp;
          const previous = previousRef.current.get(key);
          const bitrateKbps = previous && outbound.bytesSent !== undefined && now > previous.at ? Math.round(((outbound.bytesSent - previous.bytes) * 8) / (now - previous.at)) : undefined;

          // Average quantiser over this interval: high QP at full size and
          // frame rate means the encoder is starved of bits.
          const framesDelta = (outbound.framesEncoded ?? 0) - (previous?.framesEncoded ?? 0);
          const avgQp = previous && framesDelta > 0 && outbound.qpSum !== undefined && previous.qpSum !== undefined ? Math.round((outbound.qpSum - previous.qpSum) / framesDelta) : undefined;

          previousRef.current.set(key, { bytes: outbound.bytesSent ?? 0, at: now, qpSum: outbound.qpSum, framesEncoded: outbound.framesEncoded });

          // One readable line first: the console hides all but the first few properties of the object.
          const transport = localCandidate ? `${localCandidate.protocol ?? "?"}/${localCandidate.candidateType ?? "?"}` : "?";

          // eslint-disable-next-line no-console
          console.info(
            `[screen-share] sending ${outbound.frameWidth ?? "?"}x${outbound.frameHeight ?? "?"} ${outbound.framesPerSecond ?? "?"}fps | ${bitrateKbps ?? "?"}/${kbps(outbound.targetBitrate) ?? "?"} kbps (sent/target) | limit=${outbound.qualityLimitationReason ?? "not reported"} | ${outbound.encoderImplementation ?? "?"} | ${transport} | rtt ${remoteInbound?.roundTripTime ? Math.round(remoteInbound.roundTripTime * 1000) : "?"}ms lost ${remoteInbound?.packetsLost ?? "?"}`,
            {
            resolution: `${outbound.frameWidth ?? "?"}x${outbound.frameHeight ?? "?"}`,
            fps: outbound.framesPerSecond,
            targetKbps: kbps(outbound.targetBitrate),
            actualKbps: bitrateKbps,
            keyFramesEncoded: outbound.keyFramesEncoded,
            // If this is small, the estimate collapsed and the network is the problem.
            estimateKbps: kbps(candidatePair?.availableOutgoingBitrate),
            avgQp,
            qualityLimitationReason: outbound.qualityLimitationReason,
            transport: localCandidate ? `${localCandidate.protocol ?? "?"}/${localCandidate.candidateType ?? "?"}` : undefined,
            encoder: outbound.encoderImplementation,
            powerEfficient: outbound.powerEfficientEncoder,
            packetsLost: remoteInbound?.packetsLost,
            rttMs: remoteInbound?.roundTripTime ? Math.round(remoteInbound.roundTripTime * 1000) : undefined,
            },
          );

          // The encoder's real frame size (unlike getSettings()): resize an oversized capture and
          // set the ceiling for what is really sent. Again whenever the size changes.
          const frameKey = `${outbound.frameWidth}x${outbound.frameHeight}`;

          if (outbound.frameWidth && outbound.frameHeight && frameKey !== reconciledFrame) {
            reconciledFrame = frameKey;
            void reconcileCaptureWithFrames(track, { width: outbound.frameWidth, height: outbound.frameHeight }).then(
              (result) => {
                // eslint-disable-next-line no-console
                console.info("[screen-share] capture reconciled", result);
              },
              () => {},
            );
          }

          // A software encoder pegging the CPU is what drops frames in bursts. Remember the
          // codec and ask for a switch; a hardware encoder that is "CPU limited" is a capture
          // or system problem a different codec won't fix.
          cpuLimitedPolls = outbound.qualityLimitationReason === "cpu" ? cpuLimitedPolls + 1 : 0;
          const requestedNow = requestedSettingsRef.current;

          if (cpuLimitedPolls === CPU_LIMITED_POLLS && requestedNow) {
            const software = requestedNow.support !== "hardware" || outbound.powerEfficientEncoder === false;

            // eslint-disable-next-line no-console
            console.warn("[screen-share] encoder is CPU limited", { codec: requestedNow.codec, encoder: outbound.encoderImplementation, software });
            if (software) {
              markCodecUnsuitable(requestedNow.codec);
              onCpuLimitedRef.current?.();
            }
          }

          if (adaptiveRef.current) {
            void runAdaptiveScreenShareStep(track, adaptiveRef.current, outbound.qualityLimitationReason as AdaptiveQualityLimitation);
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

      timersRef.current.set(
        key,
        setInterval(async () => {
          // The raw report: getReceiverStats() leaves out freezes, retransmits and the jitter
          // buffer, which are what tell a late-arriving stream from a slow decoder.
          const report = await track.receiver?.getStats();

          if (!report) return;

          let inbound: ReceiveStats | undefined;
          let candidatePair: ReceiveStats | undefined;

          report.forEach((entry: ReceiveStats) => {
            if (entry.type === "inbound-rtp" && (entry.kind ?? entry.mediaType) === "video") inbound = entry;
            if (entry.type === "candidate-pair" && entry.state === "succeeded" && entry.nominated) candidatePair = entry;
          });

          if (!inbound) return;

          const localCandidate = candidatePair?.localCandidateId ? (report.get(candidatePair.localCandidateId) as ReceiveStats | undefined) : undefined;
          const previous = previousRef.current.get(key);
          const bitrateKbps = previous && inbound.bytesReceived !== undefined && inbound.timestamp > previous.at ? Math.round(((inbound.bytesReceived - previous.bytes) * 8) / (inbound.timestamp - previous.at)) : undefined;
          // Drops and freezes since the last poll, to tell "dropping now" from "dropped earlier".
          const droppedNow = (inbound.framesDropped ?? 0) - (previous?.framesDropped ?? 0);
          const decodedNow = (inbound.framesDecoded ?? 0) - (previous?.framesDecoded ?? 0);
          const jitterBufferMs = inbound.jitterBufferEmittedCount ? Math.round(((inbound.jitterBufferDelay ?? 0) / inbound.jitterBufferEmittedCount) * 1000) : undefined;

          previousRef.current.set(key, { bytes: inbound.bytesReceived ?? 0, at: inbound.timestamp, framesDropped: inbound.framesDropped, framesDecoded: inbound.framesDecoded });

          // eslint-disable-next-line no-console
          console.info(`[screen-share] receiving from ${identity}`, {
            resolution: `${inbound.frameWidth ?? "?"}x${inbound.frameHeight ?? "?"}`,
            fps: inbound.framesPerSecond,
            actualKbps: bitrateKbps,
            decodedNow,
            droppedNow,
            droppedTotal: inbound.framesDropped,
            freezes: inbound.freezeCount,
            frozenSeconds: inbound.totalFreezesDuration !== undefined ? Math.round(inbound.totalFreezesDuration * 10) / 10 : undefined,
            packetsLost: inbound.packetsLost,
            retransmits: inbound.nackCount,
            keyframeRequests: inbound.pliCount,
            jitterMs: inbound.jitter !== undefined ? Math.round(inbound.jitter * 1000) : undefined,
            jitterBufferMs,
            transport: localCandidate ? `${localCandidate.protocol ?? "?"}/${localCandidate.candidateType ?? "?"}` : undefined,
            decoder: inbound.decoderImplementation,
          });
        }, 3000),
      );
    },
    [stopScreenShareStatsLogging],
  );

  return { requestedSettingsRef, onCpuLimitedRef, onEncoderStalledRef, startSenderStatsLogging, startReceiverStatsLogging, stopScreenShareStatsLogging, stopAllScreenShareStatsLogging };
}
