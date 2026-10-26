import type { VideoCodec } from "livekit-client";

/** Codecs every viewer can decode; AV1/H.265 are left out until receivers are checked too. */
type ScreenShareCodec = Extract<VideoCodec, "h264" | "vp9" | "vp8">;

export type EncodeSupport = "hardware" | "software" | "unsupported";

export interface EncodeProbeConfig {
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
}

const H264_PROFILE_LEVEL_IDS = ["640028", "640c28", "4d0028", "420028", "42e028"];

const PROBE_CONTENT_TYPES: Record<ScreenShareCodec, string[]> = {
  h264: H264_PROFILE_LEVEL_IDS.map((id) => `video/H264;level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=${id}`),
  vp9: ["video/VP9"],
  vp8: ["video/VP8"],
};

const CPU_LIMITED_KEY = "screen-share-cpu-limited-codecs";

interface EncodingInfo {
  supported?: boolean;
  powerEfficient?: boolean;
}

type MediaCapabilitiesWithEncoding = { encodingInfo?: (config: unknown) => Promise<EncodingInfo | undefined> };

/** Codecs the browser can send, from RTCRtpSender; null where that API is missing. */
function senderCodecs(): Set<string> | null {
  const capabilities = typeof RTCRtpSender === "undefined" ? null : RTCRtpSender.getCapabilities?.("video");

  return capabilities ? new Set(capabilities.codecs.map((codec) => codec.mimeType.toLowerCase())) : null;
}

/**
 * `powerEfficient` from the WebRTC encoding probe is how Chromium reports a
 * hardware encoder. Probing H.264 across several profiles, any hardware hit counts.
 */
async function probeCodec(codec: ScreenShareCodec, video: EncodeProbeConfig, supportedBySender: Set<string> | null): Promise<EncodeSupport> {
  if (supportedBySender && !supportedBySender.has(`video/${codec}`)) return "unsupported";

  const mediaCapabilities = (typeof navigator === "undefined" ? undefined : navigator.mediaCapabilities) as MediaCapabilitiesWithEncoding | undefined;

  // No probe (Firefox, Safari): the codec is sendable, but we can't tell how.
  if (!mediaCapabilities?.encodingInfo) return "software";

  const answers = await Promise.all(
    PROBE_CONTENT_TYPES[codec].map((contentType) =>
      mediaCapabilities.encodingInfo!({ type: "webrtc", video: { contentType, ...video } }).catch(() => undefined),
    ),
  );

  if (answers.some((answer) => answer?.supported && answer.powerEfficient)) return "hardware";
  if (answers.some((answer) => answer?.supported)) return "software";

  return "unsupported";
}

const probes = new Map<string, Promise<Record<ScreenShareCodec, EncodeSupport>>>();

/** Cached per capture size and bitrate: a high resolution can exceed what a hardware encoder takes. */
export function probeScreenShareEncoders(video: EncodeProbeConfig): Promise<Record<ScreenShareCodec, EncodeSupport>> {
  const key = `${video.width}x${video.height}@${video.framerate}/${video.bitrate}`;
  let probe = probes.get(key);

  if (!probe) {
    const supportedBySender = senderCodecs();

    probe = Promise.all((Object.keys(PROBE_CONTENT_TYPES) as ScreenShareCodec[]).map(async (codec) => [codec, await probeCodec(codec, video, supportedBySender)] as const)).then(
      (entries) => Object.fromEntries(entries) as Record<ScreenShareCodec, EncodeSupport>,
    );
    probes.set(key, probe);
  }

  return probe;
}

function readCpuLimited(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(CPU_LIMITED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Remember (for this browser session) that a codec saturated the CPU or stalled, so the next share ranks it last. */
export function markCodecUnsuitable(codec: string): void {
  try {
    sessionStorage.setItem(CPU_LIMITED_KEY, JSON.stringify(Array.from(readCpuLimited().add(codec))));
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
}

/** Best codec first: hardware encoders, then H.264 > VP8 > VP9 when only software is left (VP9 costs the most CPU). */
export function rankScreenShareCodecs(support: Record<ScreenShareCodec, EncodeSupport>, firefox: boolean, cpuLimited: ReadonlySet<string>): ScreenShareCodec[] {
  const usable = (codec: ScreenShareCodec) => support[codec] !== "unsupported" && (!firefox || codec !== "vp9");
  const hardware = (codec: ScreenShareCodec) => support[codec] === "hardware";
  const anyHardware = (["h264", "vp9", "vp8"] as const).some(hardware);
  const preference: ScreenShareCodec[] = firefox ? ["vp8", "h264"] : anyHardware ? ["h264", "vp9", "vp8"] : ["h264", "vp8", "vp9"];
  const ranked = preference.filter(usable);
  const ordered = [...ranked.filter(hardware), ...ranked.filter((codec) => !hardware(codec))];

  // A codec that already pegged the CPU this session goes last, but stays as a fallback.
  const fresh = ordered.filter((codec) => !cpuLimited.has(codec));
  const result = [...fresh, ...ordered.filter((codec) => cpuLimited.has(codec))];

  return result.length > 0 ? result : ["vp8"];
}

export interface ScreenShareCodecChoice {
  codec: ScreenShareCodec;
  support: EncodeSupport;
  /** The best codec left is itself one that already saturated the CPU this session. */
  cpuLimited: boolean;
}

/** Pick the codec this browser can encode best at the given capture settings. */
export async function selectScreenShareCodec(video: EncodeProbeConfig): Promise<ScreenShareCodecChoice> {
  const support = await probeScreenShareEncoders(video);
  const firefox = typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);
  const cpuLimited = readCpuLimited();
  const [codec] = rankScreenShareCodecs(support, firefox, cpuLimited);

  return { codec, support: support[codec] ?? "software", cpuLimited: cpuLimited.has(codec) };
}
