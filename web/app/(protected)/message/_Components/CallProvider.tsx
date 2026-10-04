"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useCall } from "../_Actions/useCall";
import { useCallRoles } from "../_Actions/useCallRoles";

import { ScreenShareAudio } from "./_Call/ScreenShareView";
import { useChat } from "./ChatProvider";

type CallState = ReturnType<typeof useCall>;

interface CallSession extends CallState {
  /** The conversation the call is in, or null when not in a call. */
  callConversationId: string | null;
  /** When the call connected (epoch ms), for the elapsed timer. */
  callStartedAt: number | null;
  /** Identity of the screen share being watched full-size, if any. */
  watching: string | null;
  /**
   * Current roles of the other people in the call, re-read whenever someone joins or
   * leaves. Kept here (not in a chat view) so switching chats never shows stale badges.
   */
  participantRoles: Record<string, string[]>;
  /** Join `conversationId`'s call; if already in another call, switch to this one. */
  startCall: (conversationId: string) => void;
  /** Hang up, from anywhere. */
  leaveCall: () => void;
  watchShare: (identity: string) => void;
  closeShare: () => void;
}

const CallContext = createContext<CallSession | null>(null);

interface VoicePrefs {
  muted: boolean;
  deafened: boolean;
}

const DEFAULT_VOICE_PREFS: VoicePrefs = { muted: false, deafened: false };
const VOICE_PREFS_KEY = "voice-prefs";

function readVoicePrefs(): VoicePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(VOICE_PREFS_KEY) ?? "null");

    if (raw && typeof raw === "object") {
      return { muted: raw.muted === true, deafened: raw.deafened === true };
    }
  } catch {
    // Unreadable or blocked storage: start unmuted.
  }

  return DEFAULT_VOICE_PREFS;
}

function writeVoicePrefs(prefs: VoicePrefs): void {
  try {
    localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not persisted; the in-memory value still applies.
  }
}

/**
 * Owns THE call for the whole /message area. It lives in the layout, so opening
 * another chat doesn't unmount it: the LiveKit room, mute/deafen state, timer and
 * the watched screen share all carry on, and the call only ends on hang-up (or
 * when the user leaves /message or closes the tab). The panel and the profile
 * card's leave button just read from here.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { setActiveCall } = useChat();
  const [callConversationId, setCallConversationId] = useState<string | null>(null);
  const call = useCall(callConversationId);
  const participantRoles = useCallRoles(
    call.participants.filter((p) => !p.isLocal).map((p) => p.identity),
  );
  const [watching, setWatching] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);

  // Mic/deafen as the user last set them, app-wide. Outside a call these are the
  // source of truth; on joining they are applied to the call; during a call the
  // call's own state wins and is mirrored back here, so the two never disagree.
  const [voicePrefs, setVoicePrefs] = useState<VoicePrefs>(DEFAULT_VOICE_PREFS);
  const [prefsSynced, setPrefsSynced] = useState(false);
  const appliedForRef = useRef<string | null>(null);
  const mutedBeforeDeafenRef = useRef(false);

  useEffect(() => {
    setVoicePrefs(readVoicePrefs());
  }, []);

  const updateVoicePrefs = useCallback((next: VoicePrefs) => {
    setVoicePrefs(next);
    writeVoicePrefs(next);
  }, []);

  // Always call the latest leave() from the unmount/pagehide handlers below.
  const leaveRef = useRef(call.leave);

  leaveRef.current = call.leave;

  // Join whenever a call is started for a (new) conversation. startCall has
  // already hung up the previous call when switching.
  useEffect(() => {
    if (callConversationId) void call.join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callConversationId]);

  // New call: make it match the app-wide mic/deafen first, then start mirroring.
  useEffect(() => {
    if (!callConversationId) {
      appliedForRef.current = null;
      setPrefsSynced(false);

      return;
    }
    if (!call.connected || appliedForRef.current === callConversationId) return;

    appliedForRef.current = callConversationId;
    setPrefsSynced(false);

    void (async () => {
      if (voicePrefs.deafened && !call.deafened) await call.toggleDeafen();
      else if (voicePrefs.muted && !call.muted) await call.toggleMute();

      if (appliedForRef.current === callConversationId) setPrefsSynced(true);
    })();
    // Applied once per call; later changes flow the other way (call -> prefs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callConversationId, call.connected]);

  // In a call, whatever the call says (mute button, a mic that failed to start, ...)
  // becomes the app-wide value.
  useEffect(() => {
    if (!callConversationId || !prefsSynced) return;
    if (call.muted === voicePrefs.muted && call.deafened === voicePrefs.deafened) {
      return;
    }

    updateVoicePrefs({ muted: call.muted, deafened: call.deafened });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.muted, call.deafened, callConversationId, prefsSynced]);

  const inSyncedCall = callConversationId !== null && prefsSynced;

  const toggleMute = useCallback(async () => {
    if (inSyncedCall) return call.toggleMute();

    // Not in a call (or still applying): just flip the app-wide value. Unmuting
    // while deafened also undeafens, as in a call.
    updateVoicePrefs(
      voicePrefs.muted
        ? { muted: false, deafened: false }
        : { ...voicePrefs, muted: true },
    );
  }, [inSyncedCall, call, voicePrefs, updateVoicePrefs]);

  const toggleDeafen = useCallback(async () => {
    if (inSyncedCall) return call.toggleDeafen();

    if (!voicePrefs.deafened) {
      mutedBeforeDeafenRef.current = voicePrefs.muted;
      updateVoicePrefs({ muted: true, deafened: true });
    } else {
      updateVoicePrefs({ muted: mutedBeforeDeafenRef.current, deafened: false });
    }
  }, [inSyncedCall, call, voicePrefs, updateVoicePrefs]);

  // Leaving /message (the provider unmounts) or closing the tab ends the call.
  useEffect(() => {
    const leaveNow = () => leaveRef.current();

    window.addEventListener("pagehide", leaveNow);

    return () => {
      window.removeEventListener("pagehide", leaveNow);
      leaveNow();
    };
  }, []);

  useEffect(() => {
    setCallStartedAt(call.connected ? Date.now() : null);
  }, [call.connected]);

  // Tell the chat provider which call we're in, so it doesn't prompt us to join
  // a call we're already on when another member joins.
  useEffect(() => {
    setActiveCall(callConversationId);

    return () => setActiveCall(null);
  }, [callConversationId, setActiveCall]);

  const { screenShares, watchScreenShareAudio } = call;

  // Drop back to the tiles if whoever we were watching stopped sharing.
  useEffect(() => {
    if (watching && !screenShares.some((s) => s.identity === watching)) {
      watchScreenShareAudio(null);
      setWatching(null);
    }
  }, [screenShares, watching, watchScreenShareAudio]);

  const closeShare = useCallback(() => {
    watchScreenShareAudio(null);
    setWatching(null);
  }, [watchScreenShareAudio]);

  const watchShare = useCallback(
    (identity: string) => {
      watchScreenShareAudio(identity);
      setWatching(identity);
    },
    [watchScreenShareAudio],
  );

  const leave = call.leave;

  const startCall = useCallback(
    (conversationId: string) => {
      if (callConversationId === conversationId) return;
      if (callConversationId) {
        // Already in another call: hang that one up first, then join this one.
        closeShare();
        leave();
      }
      setCallConversationId(conversationId);
    },
    [callConversationId, closeShare, leave],
  );

  const leaveCall = useCallback(() => {
    closeShare();
    leave();
    setCallConversationId(null);
  }, [closeShare, leave]);

  return (
    <CallContext.Provider
      value={{
        ...call,
        muted: inSyncedCall ? call.muted : voicePrefs.muted,
        deafened: inSyncedCall ? call.deafened : voicePrefs.deafened,
        toggleMute,
        toggleDeafen,
        callConversationId,
        callStartedAt,
        watching,
        participantRoles,
        startCall,
        leaveCall,
        watchShare,
        closeShare,
      }}
    >
      {children}

      {/* Screen-share audio is played here, not in the panel, so it keeps going
          while you're looking at another chat. */}
      {screenShares.map((share) => (
        <ScreenShareAudio
          key={`audio-${share.identity}`}
          enabled={watching === share.identity && !call.deafened}
          track={share.audioTrack}
          volume={share.audioVolume}
        />
      ))}
    </CallContext.Provider>
  );
}

export function useCallSession(): CallSession {
  const ctx = useContext(CallContext);

  if (!ctx) throw new Error("useCallSession must be used within a CallProvider");

  return ctx;
}
