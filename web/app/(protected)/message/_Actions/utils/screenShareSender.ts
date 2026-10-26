import type { LocalVideoTrack } from "livekit-client";

import { buildSenderParameters, fitToPixelBudget, resolveScreenShareTarget, type ScreenShareTarget } from "./screenShareTarget";

/** Write a target to the live sender and track; the one place sender settings are applied. */
export async function applyScreenShareTarget(track: LocalVideoTrack, target: ScreenShareTarget, scaleResolutionDownBy?: number | null): Promise<void> {
  const sender = track.sender;

  if (!sender) throw new Error("Screen-share sender is unavailable");

  const parameters = sender.getParameters();

  // LiveKit forces the "motion" hint on layered (VP9/AV1 `L1T3`) shares to dodge a Chrome ~5 fps limit; leave it alone there.
  if (!parameters.encodings?.some((encoding) => (encoding as { scalabilityMode?: string }).scalabilityMode)) {
    track.mediaStreamTrack.contentHint = target.contentHint;
  }
  if (typeof track.setDegradationPreference === "function") {
    await track.setDegradationPreference(target.degradationPreference);
  }

  await sender.setParameters(buildSenderParameters(sender.getParameters(), target, scaleResolutionDownBy));
}

/** Reassert the saved preferences on the sender, e.g. after renegotiation or a preference change mid-share. */
export function enforceConfiguredScreenShareSender(track: LocalVideoTrack, frame?: Size): Promise<void> {
  // `getSettings()` only echoes the request until frames flow, so the size comes from the caller
  // (the encoder's real frame size). Full size also drops any adaptive downscale.
  return applyScreenShareTarget(track, resolveScreenShareTarget({}, frame), null);
}

/** The size of the frames the encoder is producing right now, from the sender stats. */
export async function currentFrameSize(track: LocalVideoTrack): Promise<Size | undefined> {
  const report = await track.sender?.getStats();
  let frame: Size | undefined;

  report?.forEach((entry: { type: string; frameWidth?: number; frameHeight?: number }) => {
    if (entry.type === "outbound-rtp" && entry.frameWidth && entry.frameHeight && (!frame || entry.frameWidth > frame.width)) {
      frame = { width: entry.frameWidth, height: entry.frameHeight };
    }
  });

  return frame;
}

/**
 * Line the capture and sender up with the frames the encoder really produces: shrink a
 * capture that is over the pixel budget, and give a smaller source the ceiling for its own size.
 * Runs on the size from the sender stats, so it also covers a window that is resized mid-share.
 */
export async function reconcileCaptureWithFrames(track: LocalVideoTrack, frame: Size) {
  const target = resolveScreenShareTarget();
  const budget = target.width * target.height;
  const overBudget = frame.width * frame.height > budget * 1.03;
  const asked = overBudget ? fitToPixelBudget(frame, budget) : undefined;
  let error: unknown;

  if (asked) {
    try {
      await track.mediaStreamTrack.applyConstraints({
        width: { ideal: asked.width, max: asked.width },
        height: { ideal: asked.height, max: asked.height },
        frameRate: { ideal: target.frameRate, max: target.frameRate },
      });
    } catch (caught) {
      error = caught;
    }
  }

  // Sized for what will be sent once the resize lands (or what is sent now).
  const sent = asked ?? frame;
  const sized = resolveScreenShareTarget({}, sent);

  await applyScreenShareTarget(track, sized, null);

  return { frame: sizeText(frame), resized: sizeText(asked), ceilingKbps: Math.round(sized.maxBitrate / 1000), error };
}

interface Size {
  width: number;
  height: number;
}

export interface CaptureFit {
  /** Real frame size before resizing (`getSettings()` only echoes the request until frames flow). */
  native?: Size;
  asked?: Size;
  /** Real frame size after resizing; use this, not `getSettings()`, to size the bitrate. */
  final?: Size;
  error?: unknown;
}

const sizeText = (size?: Size) => (size ? `${size.width}x${size.height}` : undefined);

/** A hidden video element on the track, to read the size of the frames that really arrive. */
function openFrameProbe(mediaTrack: MediaStreamTrack) {
  const video = document.createElement("video");

  video.muted = true;
  video.srcObject = new MediaStream([mediaTrack]);
  void video.play().catch(() => {});

  const read = (): Size | undefined => (video.videoWidth > 0 ? { width: video.videoWidth, height: video.videoHeight } : undefined);

  /** Resolves with the size once `accept` approves it, or the latest size (maybe none) after `timeoutMs`. */
  const waitFor = (accept: (size: Size) => boolean, timeoutMs: number) =>
    new Promise<Size | undefined>((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const size = read();

        if ((size && accept(size)) || Date.now() - startedAt >= timeoutMs) {
          clearInterval(timer);
          resolve(size);
        }
      }, 50);
    });

  return {
    waitFor,
    close() {
      video.srcObject = null;
    },
  };
}

/**
 * Size the capture to the target's pixel budget, keeping the screen's shape. The
 * browser never upscales, so asking for the budget size is also safe on a small source.
 */
export async function fitCaptureToTarget(mediaTrack: MediaStreamTrack, target: ScreenShareTarget): Promise<CaptureFit> {
  const probe = openFrameProbe(mediaTrack);
  const budget = target.width * target.height;

  try {
    const native = await probe.waitFor(() => true, 4000);

    if (!native) return {};

    const asked = fitToPixelBudget(native, budget);
    let error: unknown;

    try {
      await mediaTrack.applyConstraints({
        width: { ideal: asked.width, max: asked.width },
        height: { ideal: asked.height, max: asked.height },
        frameRate: { ideal: target.frameRate, max: target.frameRate },
      });
    } catch (caught) {
      // Keep the current size.
      error = caught;
    }

    // Frames arrive at the new size a moment after the constraint is applied.
    const final = await probe.waitFor((size) => Math.abs(size.width * size.height - asked.width * asked.height) <= asked.width * asked.height * 0.03, 1500);

    return { native, asked, final, error };
  } finally {
    probe.close();
  }
}

export const describeCaptureFit = (fit: CaptureFit) => ({ native: sizeText(fit.native), asked: sizeText(fit.asked), final: sizeText(fit.final), error: fit.error });

/** Return a reused capture track to the saved resolution and sender settings. */
export async function restoreConfiguredScreenShare(track: LocalVideoTrack): Promise<void> {
  await fitCaptureToTarget(track.mediaStreamTrack, resolveScreenShareTarget());
  await applyScreenShareTarget(track, resolveScreenShareTarget({}, track.mediaStreamTrack.getSettings()), null);
}

/**
 * Ask the encoder for a fresh keyframe without restarting capture. Chromium-only
 * (the second `setParameters` argument isn't in the DOM typings yet); other
 * browsers reject it and the stream carries on.
 */
export async function requestScreenShareKeyFrame(
  track: LocalVideoTrack,
): Promise<boolean> {
  const sender = track.sender;

  if (!sender || track.mediaStreamTrack.readyState !== "live") return false;

  const parameters = sender.getParameters();
  const encodingCount = parameters.encodings?.length ?? 0;

  if (encodingCount === 0) return false;

  // One option per negotiated encoding.
  const options = {
    encodingOptions: Array.from({ length: encodingCount }, () => ({
      keyFrame: true,
    })),
  } as RTCSetParameterOptions & {
    encodingOptions: Array<{ keyFrame: boolean }>;
  };

  try {
    await sender.setParameters(parameters, options);

    return true;
  } catch {
    return false;
  }
}
