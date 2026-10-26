export type VideoResolution = "720p" | "1080p" | "1440p" | "2160p";

/** Screen share is 60 fps only. */
export type VideoFrameRate = 60;

/** "gaming" favours smooth motion; "screenshare" favours sharp text/UI. */
export type StreamingMode = "gaming" | "screenshare";

export interface VideoPrefs {
  resolution: VideoResolution;
  frameRate: VideoFrameRate;
}

export interface AudioProcessingPrefs {
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

export type AdaptiveResolutionTier =
  | "2160p"
  | "1440p"
  | "1080p"
  | "720p"
  | "480p"
  | "240p";
