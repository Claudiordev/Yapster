import type { ScreenShareCaptureOptions, TrackPublishOptions, VideoCodec } from "livekit-client";

import { ADAPTIVE_RESOLUTION_LADDER, ADAPTIVE_RESOLUTIONS, videoCaptureSettings } from "@/lib/mediaPrefs";
import type { VideoResolution } from "@/types/media";

/** How the share should be sent. Publishing, reconnect recovery, adaptive steps and live changes all build from this. */
export interface ScreenShareTarget {
  /** The resolution the user selected. */
  resolutionId: VideoResolution;
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
  contentHint: "motion" | "text";
  degradationPreference: "maintain-framerate" | "maintain-resolution";
}

type TargetOverrides = Partial<Pick<ScreenShareTarget, "frameRate" | "maxBitrate" | "degradationPreference">>;

/** Asked for at capture so the browser hands over the screen's native size (it never upscales); fitted to the budget right after. */
export const CAPTURE_LIMIT = { width: 7680, height: 4320 };

/** A size within this share of a step's pixels counts as that step (even-rounding leaves sizes just under it). */
const PIXEL_FILL_RATIO = 0.98;

const floorToEven = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

/** The size with this shape that holds `budgetPixels`: a 32:9 screen gets a wide frame, not a box-fitted 1920x540. */
export function fitToPixelBudget(aspect: { width: number; height: number }, budgetPixels: number): { width: number; height: number } {
  const scale = Math.sqrt(budgetPixels / (aspect.width * aspect.height));

  return { width: floorToEven(aspect.width * scale), height: floorToEven(aspect.height * scale) };
}

/** These always get their full ceiling, whatever size is shared. */
const FULL_CEILING_RESOLUTIONS: ReadonlySet<VideoResolution> = new Set<VideoResolution>(["1440p", "2160p"]);

/** Bits per pixel per frame the content needs at minimum. */
const BITS_PER_PIXEL_PER_FRAME = 0.02;

/** The bitrate table's value for the biggest step that fits inside this many pixels (the smallest step if none does). */
function tierBitrateForPixels(pixels: number): number {
  const steps = [...ADAPTIVE_RESOLUTION_LADDER].reverse().map((tier) => ADAPTIVE_RESOLUTIONS[tier]);
  let bitrate = steps[0].bitrate;

  for (const step of steps) {
    if (step.width * step.height * PIXEL_FILL_RATIO > pixels) break;
    bitrate = step.bitrate;
  }

  return bitrate;
}

/**
 * The target for the saved preferences. Pass the captured size and, at 720p or 1080p, a
 * source smaller than the configured one is sent as it is, with the ceiling for its own
 * size instead of the full one (1440p and 2160p keep their full ceiling). Overrides lower
 * it further (the adaptive engine does this per tier).
 */
export function resolveScreenShareTarget(overrides: TargetOverrides = {}, source?: { width?: number; height?: number }): ScreenShareTarget {
  const { resolution, resolutionId, maxBitrate, maxFramerate, contentHint, degradationPreference } = videoCaptureSettings();
  const target: ScreenShareTarget = { resolutionId, width: resolution.width, height: resolution.height, frameRate: maxFramerate, maxBitrate, contentHint, degradationPreference, ...overrides };
  const sourcePixels = (source?.width ?? 0) * (source?.height ?? 0);

  if (!FULL_CEILING_RESOLUTIONS.has(target.resolutionId) && source?.width && source.height && sourcePixels < target.width * target.height * PIXEL_FILL_RATIO) {
    target.width = source.width;
    target.height = source.height;
    target.maxBitrate = Math.min(target.maxBitrate, Math.round(Math.max(tierBitrateForPixels(sourcePixels), BITS_PER_PIXEL_PER_FRAME * sourcePixels * target.frameRate)));
  }

  return target;
}

/** The video half of the capture and publish options for `setScreenShareEnabled`. */
export function buildScreenShareVideoOptions(target: ScreenShareTarget, codec: VideoCodec) {
  const capture: Pick<ScreenShareCaptureOptions, "resolution" | "contentHint"> = {
    resolution: { ...CAPTURE_LIMIT, frameRate: target.frameRate },
    contentHint: target.contentHint,
  };
  const publish: Pick<TrackPublishOptions, "videoCodec" | "backupCodec" | "simulcast" | "screenShareEncoding" | "degradationPreference"> = {
    videoCodec: codec,
    backupCodec: true,
    simulcast: false,
    screenShareEncoding: { maxBitrate: target.maxBitrate, maxFramerate: target.frameRate, priority: "high" },
    degradationPreference: target.degradationPreference,
  };

  return { capture, publish };
}

/**
 * The sender parameters for a target. `scaleResolutionDownBy`: a number sets it,
 * `null` clears it (full size), `undefined` leaves it as it is. There is no
 * `minBitrate`, so the encoder can always back off on a weak link.
 */
export function buildSenderParameters(parameters: RTCRtpSendParameters, target: ScreenShareTarget, scaleResolutionDownBy?: number | null): RTCRtpSendParameters {
  const encodings = parameters.encodings?.length ? parameters.encodings : [{}];

  parameters.degradationPreference = target.degradationPreference;
  parameters.encodings = encodings.map((encoding) => {
    const next: RTCRtpEncodingParameters = { ...encoding, maxBitrate: target.maxBitrate, maxFramerate: target.frameRate, priority: "high", networkPriority: "high" };

    if (scaleResolutionDownBy === null) delete next.scaleResolutionDownBy;
    else if (scaleResolutionDownBy !== undefined) next.scaleResolutionDownBy = scaleResolutionDownBy;

    return next;
  });

  return parameters;
}
