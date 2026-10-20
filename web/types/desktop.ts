import type { VideoResolution } from "@/types/media";

export interface DesktopQualityOption {
  id: VideoResolution;
  label: string;
  detail: string;
  /** Why the option can't be picked (e.g. "Premium only"); null when available. */
  locked: string | null;
}

export interface DesktopScreenSharePick {
  resolution: VideoResolution;
  audio: boolean;
}

/** The bridge the Electron shell exposes (desktop/src/preload.ts); absent in a normal browser. */
export interface InARowDesktop {
  isDesktop: true;
  platform: string;
  pickScreenShare: (options: {
    options: DesktopQualityOption[];
    resolution: VideoResolution;
    audio: boolean;
  }) => Promise<DesktopScreenSharePick | null>;
}

declare global {
  interface Window {
    inarowDesktop?: InARowDesktop;
  }
}
