"use client";

import { useCallback, useMemo, useState } from "react";

import type { EventGame, GameEvent } from "@/types/event";
import {
  countByTab,
  matchesFilters,
  matchesTab,
  type EventTab,
} from "../_Components/_Events/utils/eventFilters";
import { MOCK_EVENTS } from "../_Components/_Events/utils/mockEvents";

/**
 * State of the Events page. Mocked: events come from a local list and joining only
 * changes local state. Swap MOCK_EVENTS for a fetch when the backend exists.
 */
export function useEvents() {
  const [events, setEvents] = useState<GameEvent[]>(MOCK_EVENTS);
  const [tab, setTab] = useState<EventTab>("all");
  const [query, setQuery] = useState("");
  const [game, setGame] = useState<EventGame | null>(null);
  const [openSpotsOnly, setOpenSpotsOnly] = useState(false);
  // The event whose detail page is open (the list is shown when null).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Everything but the tab, so the tab counts follow the search and filters.
  const filtered = useMemo(
    () => events.filter((e) => matchesFilters(e, { query, game, openSpotsOnly })),
    [events, query, game, openSpotsOnly],
  );
  const counts = useMemo(() => countByTab(filtered), [filtered]);
  const visible = useMemo(
    () => filtered.filter((e) => matchesTab(e, tab)),
    [filtered, tab],
  );

  // Per-game numbers for the game cards (not affected by the filters).
  const gameStats = useMemo(() => {
    const stats = {} as Record<EventGame, { open: number; live: number }>;

    for (const e of events) {
      stats[e.game] ??= { open: 0, live: 0 };
      if (e.status !== "finished") stats[e.game].open += 1;
      if (e.status === "live") stats[e.game].live += 1;
    }

    return stats;
  }, [events]);

  const toggleJoin = useCallback((id: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              joined: !e.joined,
              players: e.players + (e.joined ? -1 : 1),
            }
          : e,
      ),
    );
  }, []);

  /** Demo: adds to the event's displayed prize pool; no payment happens. */
  const contribute = useCallback((id: string, amount: number) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, prizePool: e.prizePool + amount } : e,
      ),
    );
  }, []);

  return {
    selected: events.find((e) => e.id === selectedId) ?? null,
    openEvent: setSelectedId,
    closeEvent: () => setSelectedId(null),
    contribute,
    tab,
    setTab,
    query,
    setQuery,
    game,
    /** Picking the selected game again clears it. */
    toggleGame: (next: EventGame) =>
      setGame((current) => (current === next ? null : next)),
    openSpotsOnly,
    setOpenSpotsOnly,
    counts,
    visible,
    gameStats,
    toggleJoin,
  };
}

export type EventsState = ReturnType<typeof useEvents>;
