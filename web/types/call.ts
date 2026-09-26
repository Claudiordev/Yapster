import type { LocalTrack, RemoteTrack } from "livekit-client";

export interface CallParticipant {
  identity: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  volume: number;
}

export interface ScreenShare {
  track: LocalTrack | RemoteTrack;
  audioTrack?: LocalTrack | RemoteTrack;
  audioVolume: number;
  identity: string;
}

/** One voice server region a call can run on (served by the voice service). */
export interface CallRegion {
  id: string;
  name: string;
  /** Emoji flag, purely decorative. */
  flag?: string;
  /** Measured round trip from the user to this region, if the backend reports it. */
  latencyMs?: number | null;
}

export interface CallRegionsResponse {
  regions: CallRegion[];
  /** Region id the call is running on right now. */
  current: string;
}

export interface RoomAccessResponse {
  serverUrl: string;
  token: string;
  room: string;
  identity: string;
}
