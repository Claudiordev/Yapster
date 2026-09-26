"use client";

import EventsPage from "./EventsPage";

/**
 * Events feature panel — the full page rendered as an overlay over the chat
 * area (Discord-style); the left nav stays put. Closing returns to messages.
 */
export function EventsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <EventsPage onClose={onClose} />
    </div>
  );
}
