"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

import { Icon } from "@/components/Icon/Icon";
import type { EventsState } from "../../_Actions/useEvents";
import { EVENT_GAMES } from "./utils/eventGames";
import {
  countActiveFilters,
  EVENT_TABS,
} from "./utils/eventFilters";
import { EventRow, EVENT_GRID } from "./EventRow";
import { EventsFiltersModal } from "./EventsFiltersModal";
import { GameCard } from "./GameCard";

const COLUMNS = ["Event", "Hosted by", "Starts", "Players", "Prize pool"];

export default function EventsPage({
  events,
  onClose,
}: {
  events: EventsState;
  onClose?: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = countActiveFilters(events);

  return (
    <div className="relative h-full overflow-y-auto bg-content1 text-foreground dark:bg-surface-sidebar">
      {onClose && (
        <Button
          isIconOnly
          aria-label="Close"
          className="chat-profile-action chat-profile-settings absolute right-5 top-4 z-10"
          variant="light"
          onPress={onClose}
        >
          <Icon name="close" size={16} />
        </Button>
      )}

      <div className="mx-auto max-w-[1100px] px-6 pb-16 pt-8">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">
          Find your next event.
        </h1>
        <p className="mt-1 text-sm text-default-500">
          Pick your game. Bring your friends. Play for{" "}
          <span className="font-bold text-[#f5b73b]">cash prizes</span>.
        </p>

        {/* Game cards: toggle filters */}
        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EVENT_GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              liveEvents={events.gameStats[game.id]?.live ?? 0}
              openEvents={events.gameStats[game.id]?.open ?? 0}
              dimmed={events.game !== null && events.game !== game.id}
              selected={events.game === game.id}
              onPress={() => events.toggleGame(game.id)}
            />
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-6 border-b border-divider">
          {EVENT_TABS.map((tab) => {
            const active = events.tab === tab.id;

            return (
              <button
                key={tab.id}
                aria-pressed={active}
                className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors ${
                  active
                    ? "border-brand text-foreground"
                    : "border-transparent text-default-500 hover:text-foreground"
                }`}
                type="button"
                onClick={() => events.setTab(tab.id)}
              >
                {tab.id === "live" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                )}
                {tab.label}
                <span
                  className={`rounded-small px-1.5 text-tiny ${
                    active ? "bg-brand-deep text-white" : "bg-default-200 text-default-500"
                  }`}
                >
                  {events.counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + filters */}
        <div className="mt-4 flex items-center gap-3">
          <Input
            aria-label="Search events or organizers"
            className="w-[22%] min-w-[14rem]"
            classNames={{ inputWrapper: "h-10 border-[#46424d] bg-[#18191d]" }}
            placeholder="Search events or organizers"
            startContent={<Icon className="text-default-400" name="search" size={16} />}
            value={events.query}
            variant="bordered"
            onValueChange={events.setQuery}
          />
          <Button
            className="chat-profile-action chat-profile-settings ml-auto flex-shrink-0 px-4 text-sm font-semibold"
            startContent={<Icon name="sliders" size={16} />}
            variant="light"
            onPress={() => setFiltersOpen(true)}
          >
            Filters
            {activeFilters > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        {/* List */}
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[820px]">
            <div
              className={`${EVENT_GRID} px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-default-400`}
            >
              {COLUMNS.map((label) => (
                <span key={label}>{label}</span>
              ))}
              <span />
            </div>

            <div className="flex flex-col gap-3 pb-1">
              {events.visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-default-400">
                  No events match your filters.
                </p>
              ) : (
                events.visible.map((event) => (
                  <EventRow key={event.id} event={event} onOpen={events.openEvent} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <EventsFiltersModal
        isOpen={filtersOpen}
        openSpotsOnly={events.openSpotsOnly}
        onApply={(filters) => events.setOpenSpotsOnly(filters.openSpotsOnly)}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
