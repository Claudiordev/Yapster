import type { EventGame, EventStatus, GameEvent } from "@/types/event";
import { EVENT_GAME_BY_ID } from "./eventGames";

export type EventTab = "all" | EventStatus;

export const EVENT_TABS: { id: EventTab; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "live", label: "Live now" },
  { id: "upcoming", label: "Upcoming" },
  { id: "finished", label: "Finished" },
];

export interface EventFilters {
  query: string;
  /** Selected game card, or null for every game. */
  game: EventGame | null;
  /** Options of the Filters modal. */
  openSpotsOnly: boolean;
}

export function hasOpenSpots(event: GameEvent) {
  return event.players < event.maxPlayers;
}

/** Search + game + modal options; the tab is applied separately so tab counts stay honest. */
export function matchesFilters(event: GameEvent, filters: EventFilters) {
  if (filters.game && event.game !== filters.game) return false;
  if (filters.openSpotsOnly && !hasOpenSpots(event)) return false;

  const query = filters.query.trim().toLowerCase();

  if (!query) return true;

  return [event.name, event.hostedBy, EVENT_GAME_BY_ID[event.game].label].some(
    (field) => field.toLowerCase().includes(query),
  );
}

export function matchesTab(event: GameEvent, tab: EventTab) {
  return tab === "all" || event.status === tab;
}

export function countByTab(events: GameEvent[]): Record<EventTab, number> {
  return {
    all: events.length,
    live: events.filter((e) => e.status === "live").length,
    upcoming: events.filter((e) => e.status === "upcoming").length,
    finished: events.filter((e) => e.status === "finished").length,
  };
}

/** Number of Filters-modal options currently on (shown as a badge on the button). */
export function countActiveFilters(filters: Pick<EventFilters, "openSpotsOnly">) {
  return filters.openSpotsOnly ? 1 : 0;
}

export interface RowAction {
  label: string;
  /** brand = the red key; neutral = the grey key. */
  tone: "brand" | "neutral";
  /** Whether pressing it opens the event's detail page (otherwise it does nothing yet). */
  opensDetail: boolean;
  disabled: boolean;
}

/** The button each row shows, from the event's status, spots and whether you joined. */
export function getRowAction(event: GameEvent): RowAction {
  if (event.status === "finished") {
    return { label: "Results", tone: "neutral", opensDetail: false, disabled: false };
  }
  // Once a session has started it can only be watched, never joined.
  if (event.status === "live") {
    return { label: "View live", tone: "neutral", opensDetail: false, disabled: false };
  }
  if (event.joined) {
    return { label: "Joined", tone: "neutral", opensDetail: true, disabled: false };
  }

  return hasOpenSpots(event)
    ? { label: "Join", tone: "brand", opensDetail: true, disabled: false }
    : { label: "Full", tone: "neutral", opensDetail: false, disabled: true };
}

export function formatPrize(euros: number) {
  return `€${euros.toLocaleString("en-US")}`;
}
