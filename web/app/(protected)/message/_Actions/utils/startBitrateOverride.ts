/**
 * Forces a higher WebRTC start bitrate for one published track's video, on top of
 * whatever livekit-client (2.21.0) already negotiates on its own.
 *
 * livekit-client already munges `x-google-start-bitrate` into the offer for every
 * video track (LocalParticipant.publishTrack -> PCTransport.setTrackCodecBitrate),
 * at ~90% of the track's maxBitrate, uncapped for screen share. This module runs
 * AFTER that and overwrites the value with whatever this call site asks for
 * (normally the track's full maxBitrate), by patching RTCPeerConnection's native
 * setLocalDescription just for this page.
 *
 * This is a hint to Chromium's congestion controller, not a guarantee: it can
 * still lower the actual send rate below the hint if the real network can't
 * sustain it. It re-applies on every setLocalDescription, so renegotiations are
 * covered too, not just the first offer.
 */

interface Target {
  /** Codec name as it appears in the SDP's a=rtpmap (e.g. "H264", "VP8"). */
  codec: string;
  startKbps: number;
}

// trackId (RTCRtpSender track id, i.e. MediaStreamTrack.id) -> desired start bitrate.
const targets = new Map<string, Target>();

let installed = false;

/** Registers the desired start bitrate (kbps) for a locally published video track. */
export function setStartBitrateTarget(trackId: string, codec: string, startKbps: number): void {
  targets.set(trackId, { codec: codec.toUpperCase(), startKbps: Math.max(1, Math.round(startKbps)) });
}

export function clearStartBitrateTarget(trackId: string): void {
  targets.delete(trackId);
}

/**
 * A single codec (e.g. "H264") is offered as several payload types in the same m=video
 * section -- one per profile-level-id/packetization-mode combination Chrome supports.
 * Answer negotiation can pick any of them depending on what the far side/decoder
 * supports, and it's NOT necessarily the first one listed. Writing the hint onto only
 * one payload (as both livekit-client's own munging and an earlier version of this
 * function did) means it silently misses whenever a different payload gets picked --
 * confirmed in practice: chrome://webrtc-internals showed the negotiated payload's
 * fmtp with no x-google-start-bitrate at all, while an unused sibling payload had it.
 * So every payload for the codec gets the hint, not just the first.
 */
function applyStartBitrate(sdp: string, trackId: string, codec: string, startKbps: number): string {
  const sections = sdp.split(/(?=^m=)/m);
  const rtpmapRe = new RegExp(`^a=rtpmap:(\\d+) ${codec}/90000$`, "gim");

  return sections
    .map((section) => {
      if (!section.startsWith("m=video")) return section;
      if (!new RegExp(`a=msid:\\S+ ${trackId}(\\s|$)`, "m").test(section)) return section;

      const payloadTypes = Array.from(section.matchAll(rtpmapRe), (m) => m[1]);

      if (payloadTypes.length === 0) return section;

      let patched = section;

      for (const payloadType of payloadTypes) {
        const fmtpRe = new RegExp(`^a=fmtp:${payloadType} (.*)$`, "m");
        const fmtpMatch = patched.match(fmtpRe);

        if (fmtpMatch) {
          const cleaned = fmtpMatch[1].replace(/;?x-google-start-bitrate=\d+/gi, "");

          patched = patched.replace(
            fmtpRe,
            `a=fmtp:${payloadType} ${cleaned}${cleaned ? ";" : ""}x-google-start-bitrate=${startKbps}`,
          );
        } else {
          // No existing fmtp line for this payload (can happen for VP8) -- add one
          // right after its rtpmap line.
          const rtpmapLineRe = new RegExp(`^a=rtpmap:${payloadType} ${codec}/90000$`, "m");

          patched = patched.replace(
            rtpmapLineRe,
            (line) => `${line}\r\na=fmtp:${payloadType} x-google-start-bitrate=${startKbps}`,
          );
        }
      }

      return patched;
    })
    .join("");
}

/**
 * Patches RTCPeerConnection.prototype.setLocalDescription once for the page. Safe to
 * call repeatedly (e.g. once per call join) — only patches on the first call.
 */
export function installStartBitrateOverride(): void {
  if (installed || typeof RTCPeerConnection === "undefined") return;

  installed = true;

  const original = RTCPeerConnection.prototype.setLocalDescription;

  RTCPeerConnection.prototype.setLocalDescription = function patchedSetLocalDescription(
    this: RTCPeerConnection,
    description?: RTCLocalSessionDescriptionInit,
  ) {
    if (description?.type === "offer" && description.sdp && targets.size > 0) {
      let sdp = description.sdp;

      for (const [trackId, target] of Array.from(targets.entries())) {
        sdp = applyStartBitrate(sdp, trackId, target.codec, target.startKbps);
      }

      return (original as (description?: RTCLocalSessionDescriptionInit) => Promise<void>).call(this, {
        ...description,
        sdp,
      });
    }

    return (original as (description?: RTCLocalSessionDescriptionInit) => Promise<void>).call(this, description);
  };
}
