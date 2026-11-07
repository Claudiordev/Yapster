"use client";

import { useEvents } from "../../_Actions/useEvents";
import EventDetailPage from "./EventDetailPage";
import EventsPage from "./EventsPage";

/**
 * Events feature panel — the full page rendered as an overlay over the chat
 * area (Discord-style); the left nav stays put. Closing returns to messages.
 * Pressing Join on a row swaps the list for that event's detail page; the state
 * lives here, so the list keeps its filters when you come back.
 */
export function EventsPanel({ onClose }: { onClose: () => void }) {
  const events = useEvents();

  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      {events.selected ? (
        <EventDetailPage
          event={events.selected}
          onBack={events.closeEvent}
          onClose={onClose}
          onContribute={events.contribute}
          onToggleJoin={events.toggleJoin}
        />
      ) : (
        <EventsPage events={events} onClose={onClose} />
      )}
    </div>
  );
}
