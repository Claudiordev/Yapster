"use client";

import { useEffect, useRef, useState } from "react";

export type RoomJoinStatus = "waiting" | "verified";

/** Mock only: how long until the "player is in the room" check passes. */
const MOCK_VERIFY_DELAY_MS = 6000;

/**
 * Tells whether the player has actually joined the in-game room. Mocked with a timer;
 * replace the timer with polling of the verification API when the backend exists.
 * `onVerified` runs once, when the check passes. Pass `active` = false to reset.
 */
export function useRoomVerification(
  active: boolean,
  onVerified: () => void,
): RoomJoinStatus {
  const [status, setStatus] = useState<RoomJoinStatus>("waiting");
  const onVerifiedRef = useRef(onVerified);

  onVerifiedRef.current = onVerified;

  useEffect(() => {
    if (!active) {
      setStatus("waiting");

      return;
    }
    const timer = setTimeout(() => {
      setStatus("verified");
      onVerifiedRef.current();
    }, MOCK_VERIFY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [active]);

  return status;
}
