import {
  isResolutionAllowed,
  readScreenShareAudioPref,
  readVideoPrefs,
  VIDEO_RESOLUTIONS,
  writeScreenShareAudioPref,
  writeVideoResolution,
} from "@/lib/mediaPrefs";
import type { DesktopQualityOption } from "@/types/desktop";
import type { VideoResolution } from "@/types/media";

/**
 * In the desktop app, opens the share modal where the source and the stream
 * quality are picked together. The choice is saved to the same preferences as
 * Settings, so the capture that follows (and Settings) pick it up.
 *
 * Resolves false when the user cancelled; true when there's no desktop modal
 * (a browser) or a choice was made, i.e. the caller should start the share.
 */
export async function pickDesktopScreenShare(
  roles: readonly string[],
): Promise<boolean> {
  const desktop = typeof window === "undefined" ? undefined : window.inarowDesktop;

  if (!desktop?.pickScreenShare) return true;

  const options = (Object.keys(VIDEO_RESOLUTIONS) as VideoResolution[]).map(
    (id): DesktopQualityOption => {
      const { width, height, bitrate } = VIDEO_RESOLUTIONS[id];

      return {
        id,
        label: id,
        detail: `${width}×${height} · up to ${(bitrate / 1_000_000).toFixed(1)} Mbps · 60 fps`,
        locked: isResolutionAllowed(id, roles)
          ? null
          : id === "2160p"
            ? "Premium+ only"
            : "Premium only",
      };
    },
  );

  const picked = await desktop.pickScreenShare({
    options,
    resolution: readVideoPrefs().resolution,
    audio: readScreenShareAudioPref(),
  });

  if (!picked) return false;

  writeVideoResolution(picked.resolution);
  writeScreenShareAudioPref(picked.audio);

  return true;
}
