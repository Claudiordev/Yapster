"use client";

import { useCallback, useState } from "react";

import type { GameEvent } from "@/types/event";

/** Name of an event's voice group: the event and its event code, e.g. "Crewmate Clash · K7Q2M9XD". */
export function eventVoiceName(event: Pick<GameEvent, "name" | "eventCode">) {
  return `${event.name} · ${event.eventCode}`;
}

/**
 * Voice chat of an event. Design: the backend creates ONE normal group chat per event (named
 * eventVoiceName(event)) that shows up in the Chats list like any other group, and adds the
 * verified players to it as they join. Joining voice then opens that group's call through the
 * CallProvider's startCall(conversationId); leaving hangs up. No event-specific chat UI.
 *
 * Mocked until that backend exists: it only remembers whether you are in it.
 */
export function useEventVoice() {
  const [inVoice, setInVoice] = useState(false);
  const join = useCallback(() => setInVoice(true), []);
  const leave = useCallback(() => setInVoice(false), []);

  return { inVoice, join, leave };
}
