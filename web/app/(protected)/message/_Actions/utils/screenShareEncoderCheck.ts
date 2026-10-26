/** The slice of a raw WebRTC stats entry this check reads. */
interface StatsEntry {
  type: string;
  id?: string;
  kind?: string;
  mediaType?: string;
  codecId?: string;
  mimeType?: string;
  mediaSourceId?: string;
  active?: boolean;
  framesEncoded?: number;
  frames?: number;
  framesPerSecond?: number;
}

export type EncoderState = "verified" | "stalled" | "inconclusive";

export interface EncoderInspection {
  state: EncoderState;
  /** Codecs the sender is actually encoding with, e.g. "h264". */
  activeCodecs: string[];
}

const codecOf = (mimeType?: string) => mimeType?.toLowerCase().replace("video/", "");

/**
 * Is the sender's encoder producing frames for the codec we asked for?
 * - verified: frames are coming out.
 * - stalled: the capture is delivering frames but the encoder has encoded none.
 * - inconclusive: too early to say.
 * Reports for other codecs (e.g. an idle backup codec) are ignored for the stall check.
 */
export function inspectScreenShareEncoder(stats: RTCStatsReport, codec: string): EncoderInspection {
  const byId = new Map<string, StatsEntry>();
  const outbound: StatsEntry[] = [];

  stats.forEach((entry: StatsEntry) => {
    if (entry.id) byId.set(entry.id, entry);
    if (entry.type === "outbound-rtp" && (entry.kind ?? entry.mediaType) === "video" && entry.active !== false) outbound.push(entry);
  });

  const activeCodecs = Array.from(new Set(outbound.map((entry) => codecOf(byId.get(entry.codecId ?? "")?.mimeType)).filter((c): c is string => Boolean(c))));
  const primary = outbound.filter((entry) => {
    const entryCodec = codecOf(byId.get(entry.codecId ?? "")?.mimeType);

    return !entryCodec || entryCodec === codec;
  });
  // The codec was swapped for another one (negotiation): judge whatever is actually encoding.
  const judged = primary.length > 0 ? primary : outbound;

  if (judged.some((entry) => (entry.framesEncoded ?? 0) > 0)) return { state: "verified", activeCodecs };

  const stalled = judged.some((entry) => {
    if (entry.framesEncoded !== 0) return false;

    const source = byId.get(entry.mediaSourceId ?? "");

    return (source?.frames ?? 0) >= 2 || (source?.framesPerSecond ?? 0) > 0;
  });

  return { state: stalled ? "stalled" : "inconclusive", activeCodecs };
}
